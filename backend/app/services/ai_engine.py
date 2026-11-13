"""
Multi-Model AI Engine for TIP Media Intelligence.
Supports Google Gemini, OpenAI, Ollama, Groq, and any OpenAI-compatible Chat Completions API.
Gracefully falls back to deterministic heuristic parsing if no API key is set or on network failure.
"""

import json
import logging
import re
from typing import Any, Dict, List, Optional

import httpx

from backend.app.config import settings
from backend.app.services.ai_prompts import (
    SYSTEM_PROMPT_INCIDENT_ANALYSIS,
    SYSTEM_PROMPT_EXECUTIVE_BRIEF,
)
from backend.app.services.ai_analyzer import (
    analyze_sentiment,
    analyze_topic,
    extract_locations,
    generate_issue_summary,
)

logger = logging.getLogger(__name__)


def _clean_and_parse_json(raw_text: str) -> Optional[Dict[str, Any]]:
    """Clean markdown code fences and parse JSON safely."""
    text = raw_text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.MULTILINE)
        text = re.sub(r"\s*```$", "", text, flags=re.MULTILINE).strip()
    try:
        return json.loads(text)
    except Exception:
        # Fallback regex search for { ... }
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(0))
            except Exception:
                pass
    return None


async def analyze_incident_with_ai(title: str, body: str, publisher: str = "") -> Dict[str, Any]:
    """
    Analyze article or field report with configured AI Engine or heuristic fallback.
    Returns structured sentiment, topic, location, and brief summary.
    """
    # Fallback heuristic calculation in case LLM is unconfigured or fails
    fallback_sentiment, fallback_sent_conf = analyze_sentiment(f"{title} {body}")
    fallback_topic, fallback_top_conf = analyze_topic(f"{title} {body}")
    fallback_loc, fallback_locs_mentioned, _ = extract_locations(f"{title} {body}")

    fallback_result = {
        "sentimen": fallback_sentiment if fallback_sentiment != "tidak pasti" else "netral",
        "sentimen_confidence": fallback_sent_conf,
        "topik": fallback_topic,
        "topik_confidence": fallback_top_conf,
        "lokasi_kejadian": fallback_loc,
        "lokasi_disebut": fallback_locs_mentioned,
        "ringkasan_singkat": title[:160],
        "ai_engine_used": "deterministic-heuristic",
    }

    if not settings.AI_API_KEY or not settings.AI_BASE_URL:
        return fallback_result

    url = f"{settings.AI_BASE_URL.rstrip('/')}/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.AI_API_KEY}",
        "Content-Type": "application/json",
    }

    user_content = (
        f"Judul Berita: {title}\n"
        f"Penerbit / Sumber: {publisher}\n"
        f"Isi Berita:\n{body[:2500]}"
    )

    payload = {
        "model": settings.AI_MODEL_NAME,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT_INCIDENT_ANALYSIS},
            {"role": "user", "content": user_content},
        ],
        "temperature": settings.AI_TEMPERATURE,
        "max_tokens": settings.AI_MAX_TOKENS,
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(url, headers=headers, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
                parsed = _clean_and_parse_json(content)
                if parsed and isinstance(parsed, dict):
                    return {
                        "sentimen": parsed.get("sentimen", fallback_result["sentimen"]),
                        "sentimen_confidence": float(parsed.get("sentimen_confidence", 0.85)),
                        "topik": parsed.get("topik", fallback_result["topik"]),
                        "topik_confidence": float(parsed.get("topik_confidence", 0.85)),
                        "lokasi_kejadian": parsed.get("lokasi_kejadian") or fallback_result["lokasi_kejadian"],
                        "lokasi_disebut": parsed.get("lokasi_disebut", fallback_result["lokasi_disebut"]),
                        "ringkasan_singkat": parsed.get("ringkasan_singkat", fallback_result["ringkasan_singkat"]),
                        "ai_engine_used": f"{settings.AI_PROVIDER}:{settings.AI_MODEL_NAME}",
                    }
                logger.warning("AI model returned non-JSON response, using fallback.")
            else:
                logger.warning("AI API returned status %s: %s", resp.status_code, resp.text[:200])
    except Exception as exc:
        logger.warning("AI Engine call failed: %s. Using heuristic fallback.", exc)

    return fallback_result


async def generate_executive_brief_with_ai(issue_title: str, items: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Generate Executive Decision Brief for Governor/Mayors/Regents.
    Synthesizes multiple reports into factual overview, responsible parties, unknown risks, and SLAs.
    """
    sample_texts = [item.get("konten", item.get("judul", "")) for item in items[:6]]
    fallback_summary = generate_issue_summary(issue_title, sample_texts)

    fallback_result = {
        "pokok_fakta": fallback_summary.get("ringkasan", f"Konsentrasi pelaporan isu {issue_title}."),
        "pihak_terlibat": fallback_summary.get("pihak_terlibat", ["Dinas Sumber Daya Air", "BPBD"]),
        "hal_belum_diketahui": fallback_summary.get("hal_belum_diketahui", "Estimasi dampak dan durasi pemulihan."),
        "rekomendasi_tindak_lanjut": "Instruksikan tim tanggap darurat dan posko wilayah untuk segera ke titik kejadian.",
        "unit_pic_disarankan": "BPBD & Dinas Terkait",
        "estimasi_sla_jam": 3,
        "arahan_komunikasi_publik": "Sampaikan bahwa penanganan sedang berlangsung dan minta warga tetap tenang serta memantau kanal resmi.",
        "ai_engine_used": "deterministic-heuristic",
    }

    if not settings.AI_API_KEY or not settings.AI_BASE_URL:
        return fallback_result

    url = f"{settings.AI_BASE_URL.rstrip('/')}/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.AI_API_KEY}",
        "Content-Type": "application/json",
    }

    compiled_context = "\n---\n".join([
        f"Laporan {idx + 1} ({item.get('penerbit', 'Media')}): {item.get('judul', '')}\n{item.get('konten', '')[:400]}"
        for idx, item in enumerate(items[:6])
    ])

    user_content = (
        f"Judul Isu Utama: {issue_title}\n"
        f"Kumpulan Laporan Terkait ({len(items)} laporan):\n"
        f"{compiled_context}"
    )

    payload = {
        "model": settings.AI_MODEL_NAME,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT_EXECUTIVE_BRIEF},
            {"role": "user", "content": user_content},
        ],
        "temperature": settings.AI_TEMPERATURE,
        "max_tokens": settings.AI_MAX_TOKENS,
    }

    try:
        async with httpx.AsyncClient(timeout=18.0) as client:
            resp = await client.post(url, headers=headers, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
                parsed = _clean_and_parse_json(content)
                if parsed and isinstance(parsed, dict):
                    return {
                        "pokok_fakta": parsed.get("pokok_fakta", fallback_result["pokok_fakta"]),
                        "pihak_terlibat": parsed.get("pihak_terlibat", fallback_result["pihak_terlibat"]),
                        "hal_belum_diketahui": parsed.get("hal_belum_diketahui", fallback_result["hal_belum_diketahui"]),
                        "rekomendasi_tindak_lanjut": parsed.get("rekomendasi_tindak_lanjut", fallback_result["rekomendasi_tindak_lanjut"]),
                        "unit_pic_disarankan": parsed.get("unit_pic_disarankan", fallback_result["unit_pic_disarankan"]),
                        "estimasi_sla_jam": int(parsed.get("estimasi_sla_jam", fallback_result["estimasi_sla_jam"])),
                        "arahan_komunikasi_publik": parsed.get("arahan_komunikasi_publik", fallback_result["arahan_komunikasi_publik"]),
                        "ai_engine_used": f"{settings.AI_PROVIDER}:{settings.AI_MODEL_NAME}",
                    }
    except Exception as exc:
        logger.warning("AI Executive Brief call failed: %s. Using heuristic fallback.", exc)

    return fallback_result


SYSTEM_PROMPT_DASHBOARD_INSIGHT = """Anda adalah analis intelijen media eksekutif untuk platform TIP Media Intelligence.
Buat wawasan ringkasan eksekutif dalam Bahasa Indonesia berdasarkan metrik nyata yang diberikan.
Aturan format:
1. Kembalikan HANYA JSON valid dengan struktur:
   {
     "headline": "1 kalimat ringkasan utama dengan penekanan **angka** terhadap isu.",
     "highlights": [
       {"label": "Label singkat", "text": "1 kalimat wawasan dengan penekanan **angka** dan fakta isu.", "severity": "critical|warning|info|positive"}
     ],
     "rekomendasi": "1 kalimat arahan tindakan prioritas untuk pimpinan."
   }
2. Gunakan tanda **teks** (bold markdown) pada angka penting, persentase, skor, dan nama isu kunci.
3. Jangan gunakan em dash (—); gunakan titik dua (:), koma (,), atau tanda hubung (-).
4. Maksimal 4 item di highlights. Semua angka harus sesuai data yang diberikan."""


async def generate_dashboard_ai_insight(metrics: Dict[str, Any]) -> Dict[str, Any]:
    """Hasilkan wawasan ringkasan eksekutif untuk halaman utama menggunakan AI yang terkonfigurasi, dengan fallback data nyata."""
    total_items = int(metrics.get("total_items", 0))
    vol_24h = int(metrics.get("vol_24h", 0))
    growth = metrics.get("mention_growth_pct")
    isu_prioritas = int(metrics.get("isu_prioritas", 0))
    critical_count = int(metrics.get("critical_count", 0))
    high_count = int(metrics.get("high_count", 0))
    wilayah_terdampak = int(metrics.get("wilayah_terdampak", 0))
    menunggu_verifikasi = int(metrics.get("menunggu_verifikasi", 0))
    negative_pct = float(metrics.get("negative_pct", 0.0))
    sosmed_count = int(metrics.get("sosmed_count", 0))
    berita_count = int(metrics.get("berita_count", 0))
    top_issues = metrics.get("top_issues", [])
    top_regions = metrics.get("top_regions", [])

    top_issue = top_issues[0] if top_issues else None
    top_region = top_regions[0] if top_regions else None

    if top_issue:
        headline = (
            f"Terdeteksi **{isu_prioritas} isu prioritas** (**{critical_count} kritis**, **{high_count} tinggi**) "
            f"dari **{vol_24h} konten 24 jam terakhir**, dengan sorotan utama pada **{top_issue['judul']}** "
            f"(skor **{top_issue['skor']}**, **{top_issue['volume']} laporan**)."
        )
    else:
        headline = (
            f"Pemantauan mencatat **{total_items} konten unik** (**{vol_24h} dalam 24 jam terakhir**) "
            f"di **{wilayah_terdampak} wilayah terdampak** tanpa lonjakan isu kritis baru."
        )

    highlights: List[Dict[str, str]] = []
    if top_issue:
        highlights.append({
            "label": "Isu Paling Mendesak",
            "text": (
                f"**{top_issue['judul']}** ({top_issue['kategori']}) mencatat skor urgensi **{top_issue['skor']}/100** "
                f"dengan **{top_issue['volume']} laporan** di wilayah **{top_issue['wilayah']}**."
            ),
            "severity": "critical" if critical_count > 0 else "warning",
        })

    if growth is not None:
        arah = "naik" if growth > 0 else "turun"
        highlights.append({
            "label": "Dinamika Volume & Sentimen",
            "text": (
                f"Volume percakapan 24 jam {arah} **{abs(growth)}%** dengan porsi sentimen negatif mencapai **{negative_pct:.1f}%** "
                f"(**{sosmed_count} medsos** dan **{berita_count} berita**)."
            ),
            "severity": "warning" if (growth > 15 or negative_pct >= 40) else "info",
        })
    else:
        highlights.append({
            "label": "Komposisi Kanal & Sentimen",
            "text": (
                f"Tercatat **{sosmed_count} postingan medsos** dan **{berita_count} berita** dengan tingkat sentimen negatif **{negative_pct:.1f}%**."
            ),
            "severity": "warning" if negative_pct >= 40 else "info",
        })

    if top_region:
        highlights.append({
            "label": "Konsentrasi Wilayah",
            "text": (
                f"**{wilayah_terdampak} daerah** terpantau aktif dengan konsentrasi tertinggi di **{top_region['nama']}** "
                f"(**{top_region['konten']} konten**, **{top_region['negatif_pct']}% negatif**)."
            ),
            "severity": "info",
        })

    highlights.append({
        "label": "Antrean Verifikasi Analis",
        "text": (
            f"Sebanyak **{menunggu_verifikasi} isu** menunggu verifikasi analis untuk penentuan tindak lanjut dan SLA."
            if menunggu_verifikasi > 0
            else "Seluruh antrean isu prioritas telah terverifikasi (**0 isu** tertunda)."
        ),
        "severity": "warning" if menunggu_verifikasi > 0 else "positive",
    })

    if critical_count > 0 and top_issue:
        rekomendasi = (
            f"Prioritaskan verifikasi dan koordinasi lapangan untuk **{critical_count} isu kritis**, "
            f"dimulai dari **{top_issue['judul']}** di **{top_issue['wilayah']}**."
        )
    elif menunggu_verifikasi > 0:
        rekomendasi = (
            f"Selesaikan verifikasi **{menunggu_verifikasi} isu** di antrean analis agar eskalasi ke instansi terkait berjalan tepat waktu."
        )
    else:
        rekomendasi = "Pertahankan pemantauan real-time pada kanal media sosial dan berita regional."

    fallback_result: Dict[str, Any] = {
        "headline": headline,
        "highlights": highlights[:4],
        "rekomendasi": rekomendasi,
        "ai_engine_used": "AI Engine (Heuristik Data Nyata)",
    }

    if not settings.AI_API_KEY or not settings.AI_BASE_URL:
        return fallback_result

    url = f"{settings.AI_BASE_URL.rstrip('/')}/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.AI_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": settings.AI_MODEL_NAME,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT_DASHBOARD_INSIGHT},
            {"role": "user", "content": f"Data metrik radar saat ini:\n{json.dumps(metrics, ensure_ascii=False)}"},
        ],
        "temperature": settings.AI_TEMPERATURE,
        "max_tokens": min(900, settings.AI_MAX_TOKENS),
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(url, headers=headers, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
                parsed = _clean_and_parse_json(content)
                if parsed and isinstance(parsed, dict) and parsed.get("headline"):
                    raw_highlights = parsed.get("highlights")
                    clean_highlights = (
                        [
                            {
                                "label": str(h.get("label", "Wawasan")),
                                "text": str(h.get("text", "")),
                                "severity": str(h.get("severity", "info")),
                            }
                            for h in raw_highlights
                            if isinstance(h, dict) and h.get("text")
                        ][:4]
                        if isinstance(raw_highlights, list)
                        else fallback_result["highlights"]
                    )
                    return {
                        "headline": str(parsed.get("headline", fallback_result["headline"])),
                        "highlights": clean_highlights or fallback_result["highlights"],
                        "rekomendasi": str(parsed.get("rekomendasi", fallback_result["rekomendasi"])),
                        "ai_engine_used": f"{settings.AI_PROVIDER}:{settings.AI_MODEL_NAME}",
                    }
    except Exception as exc:
        logger.warning("AI Dashboard Insight call failed: %s. Using heuristic fallback.", exc)

    return fallback_result
