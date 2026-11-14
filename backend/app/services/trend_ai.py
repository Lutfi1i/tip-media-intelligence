"""AI Trend Analysis: ringkasan, penyebab viral, ide konten, caption, dan brief video.

Biaya dijaga dengan tiga cara: hasil di-cache per topik dan isi data (berubah otomatis saat
postingan baru masuk), batas panggilan per jam, dan konteks yang dikirim dibatasi 12
postingan. Deteksi tren dan prediksi dihitung dengan aturan dari data, bukan oleh model,
sehingga tetap tersedia tanpa kunci AI.
"""

from __future__ import annotations

import hashlib
import json
import logging
import threading
import time
from collections import deque
from typing import Any, Deque, Dict, List, Optional, Tuple

import httpx
from sqlalchemy.orm import Session

from backend.app.config import settings
from backend.app.services.social_pulse_service import _build_trends, _load_dataset, _scope_display_name
from backend.app.services.social_topics import SocialPost
from backend.app.services.trend_service import _platform_arg, _post_brief, _reach

logger = logging.getLogger(__name__)

TOPIC_CACHE_TTL = 6 * 3600
SUMMARY_CACHE_TTL = 3600
MAX_CALLS_PER_HOUR = 30
MAX_CONTEXT_POSTS = 12

_cache: Dict[str, Tuple[float, Dict[str, Any]]] = {}
_calls: Deque[float] = deque()
_lock = threading.Lock()


class AiRateLimited(Exception):
    pass


class AiUnavailable(Exception):
    pass


def ai_configured() -> bool:
    return bool(settings.AI_API_KEY and settings.AI_BASE_URL)


def _clean_text(value: Any) -> str:
    # Aturan copy proyek (DESIGN.md R-02): tanpa em dash di teks UI.
    return str(value or "").replace(" — ", ", ").replace("—", "-").strip()


def _clean(value: Any) -> Any:
    if isinstance(value, str):
        return _clean_text(value)
    if isinstance(value, list):
        return [_clean(v) for v in value]
    if isinstance(value, dict):
        return {k: _clean(v) for k, v in value.items()}
    return value


def _reserve_call() -> None:
    now = time.time()
    with _lock:
        while _calls and now - _calls[0] > 3600:
            _calls.popleft()
        if len(_calls) >= MAX_CALLS_PER_HOUR:
            wait = int(3600 - (now - _calls[0])) // 60 + 1
            raise AiRateLimited(f"Batas {MAX_CALLS_PER_HOUR} analisis AI per jam tercapai. Coba lagi dalam {wait} menit.")
        _calls.append(now)


def _chat_json(system: str, user: str, max_tokens: int = 1400, reserve: bool = True) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    """Panggil model dan kembalikan (JSON jawaban, meta). `reserve=False` bila pemanggil punya batas sendiri."""
    if not ai_configured():
        raise AiUnavailable("AI belum dikonfigurasi (AI_API_KEY kosong).")
    if reserve:
        _reserve_call()
    payload = {
        "model": settings.AI_MODEL_NAME,
        "temperature": 0.3,
        "max_tokens": max_tokens,
        "response_format": {"type": "json_object"},
        "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
    }
    try:
        resp = httpx.post(
            f"{settings.AI_BASE_URL.rstrip('/')}/chat/completions",
            headers={"Authorization": f"Bearer {settings.AI_API_KEY}"},
            json=payload,
            timeout=60.0,
        )
    except httpx.HTTPError as exc:
        raise AiUnavailable(f"Layanan AI tidak bisa dihubungi: {exc}") from exc
    if resp.status_code != 200:
        logger.warning("AI trend analysis gagal: %s %s", resp.status_code, resp.text[:200])
        raise AiUnavailable(f"Layanan AI menolak permintaan (HTTP {resp.status_code}).")
    data = resp.json()
    content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
    try:
        parsed = json.loads(content)
    except ValueError as exc:
        raise AiUnavailable("Jawaban AI bukan JSON yang valid.") from exc
    usage = data.get("usage", {})
    return parsed, {"model": settings.AI_MODEL_NAME, "token": usage.get("total_tokens")}


def _cached(key: str, ttl: int) -> Optional[Dict[str, Any]]:
    hit = _cache.get(key)
    if hit and time.time() - hit[0] < ttl:
        return hit[1]
    return None


def _post_line(p: SocialPost) -> str:
    metrics = []
    if p.views is not None:
        metrics.append(f"{p.views} views")
    if p.interactions is not None:
        metrics.append(f"{p.interactions} interaksi")
    text = " ".join(f"{p.title} {p.text}".split())[:280]
    return f"[{p.id}] {p.platform} | {p.author or p.publisher or 'akun tidak diketahui'} | {', '.join(metrics) or 'tanpa metrik'} | {text}"


# ---------------------------------------------------------------------------
# Aturan: deteksi dan prediksi
# ---------------------------------------------------------------------------

def detect_and_project(trend: Dict[str, Any]) -> Dict[str, Any]:
    """Status dari mesin laju + proyeksi arah dari bentuk timeline. Bukan keluaran model."""
    counts = [b["count"] for b in trend.get("timeline", [])]
    third = max(1, len(counts) // 3)
    early, late = sum(counts[:third]), sum(counts[-third:])
    if sum(counts) < 3:
        arah, alasan = "belum bisa diperkirakan", "Data terlalu sedikit untuk membaca arah."
    elif late > early * 1.5 and late >= 2:
        arah, alasan = "cenderung naik", f"Sepertiga akhir periode berisi {late} postingan, dibanding {early} di sepertiga awal."
    elif late * 1.5 < early:
        arah, alasan = "cenderung turun", f"Sepertiga akhir periode berisi {late} postingan, dibanding {early} di sepertiga awal."
    else:
        arah, alasan = "cenderung stabil", f"Volume awal ({early}) dan akhir periode ({late}) tidak jauh berbeda."
    return {
        "status": trend["velocity_status"],
        "tren_baru": trend["velocity_status"] == "BARU",
        "pertumbuhan_pct": trend["growth_pct"],
        "prediksi": {"arah": arah, "alasan": alasan, "catatan": "Perkiraan dari laju saat ini, bukan kepastian."},
    }


# ---------------------------------------------------------------------------
# Analisis per topik
# ---------------------------------------------------------------------------

TOPIC_SYSTEM = """Anda analis tren media sosial Indonesia yang membantu kreator konten.
Gunakan HANYA fakta dari postingan yang diberikan. Jangan mengarang angka, nama, atau kejadian.
Arti data: "status" adalah laju dibanding periode sebelumnya. BARU = belum ada data pembanding, jadi JANGAN
menyebut naik atau turun. SINYAL LEMAH = postingan terlalu sedikit. MENINGKAT/LONJAKAN TINGGI = naik, MENURUN = turun.
"negatif %" adalah porsi postingan bernada negatif; di bawah 20% berarti mayoritas tidak negatif.
Bila bukti tidak cukup untuk suatu bagian, katakan terus terang di bagian itu.
Tulis dalam Bahasa Indonesia yang lugas. Jangan memakai tanda pisah panjang (em dash).
Jawab dalam JSON dengan kunci persis:
{
  "ringkasan": "2-3 kalimat inti percakapan",
  "penyebab_viral": ["alasan singkat, sebut nomor postingan [id] sebagai bukti", "..."],
  "sentimen": "1 kalimat tentang nada percakapan",
  "potensi_konten": {"tingkat": "rendah|sedang|tinggi", "alasan": "1 kalimat"},
  "ide_konten": [{"judul": "...", "format": "video pendek|carousel|thread|artikel|live", "platform": ["TikTok"], "alasan": "..."}],
  "caption": "caption siap pakai, maksimal 300 karakter",
  "hashtag": ["#contoh"],
  "brief_video": {"judul": "...", "durasi_detik": 30, "hook": "kalimat 3 detik pertama", "adegan": [{"detik": "0-3", "visual": "...", "narasi": "..."}], "cta": "..."}
}
Berikan 3 ide_konten, 6-10 hashtag, dan 4-6 adegan. Jika topik sensitif (bencana, kriminal, duka), sarankan konten informatif dan empatik, bukan sensasional."""


def _normalize_topic_ai(raw: Dict[str, Any]) -> Dict[str, Any]:
    def as_list(v: Any) -> List[Any]:
        return v if isinstance(v, list) else []

    brief = raw.get("brief_video") if isinstance(raw.get("brief_video"), dict) else {}
    potensi = raw.get("potensi_konten") if isinstance(raw.get("potensi_konten"), dict) else {}
    tingkat = str(potensi.get("tingkat", "")).lower()
    return _clean({
        "ringkasan": raw.get("ringkasan", ""),
        "penyebab_viral": [str(x) for x in as_list(raw.get("penyebab_viral"))][:5],
        "sentimen": raw.get("sentimen", ""),
        "potensi_konten": {
            "tingkat": tingkat if tingkat in ("rendah", "sedang", "tinggi") else "tidak diketahui",
            "alasan": potensi.get("alasan", ""),
        },
        "ide_konten": [
            {
                "judul": i.get("judul", ""),
                "format": i.get("format", ""),
                "platform": [str(x) for x in as_list(i.get("platform"))][:3],
                "alasan": i.get("alasan", ""),
            }
            for i in as_list(raw.get("ide_konten"))[:4]
            if isinstance(i, dict)
        ],
        "caption": str(raw.get("caption", ""))[:400],
        "hashtag": [("#" + str(h).lstrip("#")).replace(" ", "") for h in as_list(raw.get("hashtag"))][:12],
        "brief_video": {
            "judul": brief.get("judul", ""),
            "durasi_detik": brief.get("durasi_detik") if isinstance(brief.get("durasi_detik"), int) else None,
            "hook": brief.get("hook", ""),
            "adegan": [
                {"detik": str(a.get("detik", "")), "visual": a.get("visual", ""), "narasi": a.get("narasi", "")}
                for a in as_list(brief.get("adegan"))[:8]
                if isinstance(a, dict)
            ],
            "cta": brief.get("cta", ""),
        },
    })


def analyze_topic(
    db: Session, topic_key: str, periode: str, lokasi: str, platform: Optional[str], refresh: bool = False
) -> Dict[str, Any]:
    ds = _load_dataset(db, periode, lokasi or "ID", "context", None, _platform_arg(platform))
    trends = _build_trends(db, ds, periode, "laju")
    trend = next((t for t in trends if t["topic_key"] == topic_key), None)
    if trend is None:
        raise LookupError("Topik tidak ditemukan untuk filter ini. Muat ulang daftar tren.")

    by_id = {p.id: p for p in ds.current}
    posts = sorted((by_id[i] for i in trend["post_ids"] if i in by_id), key=_reach, reverse=True)[:MAX_CONTEXT_POSTS]
    rules = detect_and_project(trend)
    base = {
        "topic_key": topic_key,
        "topik": trend["topic"],
        "postingan": trend["mention_count"],
        "platform": trend["platforms"],
        "sentimen_pct": trend["sentiment_pct"],
        "kategori": [c["label"] for c in trend["categories"]],
        "lokasi": trend["locations"],
        **rules,
        "sumber": [_post_brief(p) for p in posts],
    }
    if not ai_configured():
        return {**base, "ai": None, "ai_error": "AI belum dikonfigurasi. Bagian berbasis aturan tetap ditampilkan."}

    data_hash = hashlib.sha1(",".join(map(str, sorted(trend["post_ids"]))).encode()).hexdigest()[:12]
    key = f"topik|{topic_key}|{periode}|{lokasi}|{platform}|{data_hash}"
    hit = None if refresh else _cached(key, TOPIC_CACHE_TTL)
    if hit:
        return {**base, **hit, "cache": True}

    user = "\n".join([
        f"Topik: {trend['topic']}",
        f"Periode: {ds.period.label}. Lokasi filter: {_scope_display_name(lokasi or 'ID')}. Platform: {platform or 'Semua'}.",
        f"Jumlah postingan: {trend['mention_count']}. Status laju: {trend['velocity_status']}.",
        f"Sentimen (%): {json.dumps(trend['sentiment_pct'], ensure_ascii=False)}.",
        f"Platform: {', '.join(trend['platforms'])}. Kategori: {', '.join(c['label'] for c in trend['categories']) or '-'}.",
        f"Hashtag terkait: {' '.join(trend['hashtags']) or '-'}. Frasa terkait: {', '.join(trend['related_phrases']) or '-'}.",
        "",
        "Postingan (format: [id] platform | akun | metrik | teks):",
        *[_post_line(p) for p in posts],
    ])
    try:
        raw, meta = _chat_json(TOPIC_SYSTEM, user)
    except (AiUnavailable, AiRateLimited) as exc:
        return {**base, "ai": None, "ai_error": str(exc)}
    result = {"ai": _normalize_topic_ai(raw), "ai_meta": {**meta, "dibuat": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}}
    _cache[key] = (time.time(), result)
    return {**base, **result, "cache": False}


# ---------------------------------------------------------------------------
# Ringkasan semua tren
# ---------------------------------------------------------------------------

SUMMARY_SYSTEM = """Anda analis tren media sosial Indonesia. Dari daftar tren berikut, tulis ringkasan untuk kreator konten.
Gunakan hanya data yang diberikan, jangan mengarang angka. Bahasa Indonesia lugas, tanpa tanda pisah panjang (em dash).
Arti data: "status" adalah laju dibanding periode sebelumnya. BARU = belum ada data pembanding, jadi JANGAN
menyebut naik atau turun. SINYAL LEMAH = postingan terlalu sedikit. MENINGKAT/LONJAKAN TINGGI = naik, MENURUN = turun.
"negatif %" adalah porsi postingan bernada negatif; di bawah 20% berarti mayoritas tidak negatif.
Jawab JSON: {"ringkasan": "3-4 kalimat", "poin": [{"topik": "...", "insight": "1 kalimat"}], "rekomendasi_topik": [{"topik": "...", "alasan": "...", "platform": ["TikTok"]}]}
Maksimal 5 poin dan 3 rekomendasi. Rekomendasi hanya untuk topik yang aman dan cocok dijadikan konten."""


def summarize_trends(db: Session, periode: str, lokasi: str, platform: Optional[str], refresh: bool = False) -> Dict[str, Any]:
    ds = _load_dataset(db, periode, lokasi or "ID", "context", None, _platform_arg(platform))
    trends = _build_trends(db, ds, periode, "laju")[:8]
    if not trends:
        return {"ai": None, "ai_error": "Belum ada tren untuk diringkas pada filter ini.", "tren": 0}
    if not ai_configured():
        return {"ai": None, "ai_error": "AI belum dikonfigurasi.", "tren": len(trends)}
    data_hash = hashlib.sha1("|".join(f"{t['topic_key']}:{t['mention_count']}" for t in trends).encode()).hexdigest()[:12]
    key = f"ringkasan|{periode}|{lokasi}|{platform}|{data_hash}"
    hit = None if refresh else _cached(key, SUMMARY_CACHE_TTL)
    if hit:
        return {**hit, "tren": len(trends), "cache": True}

    lines = [
        f"Periode: {ds.period.label}. Lokasi: {_scope_display_name(lokasi or 'ID')} (sebut wilayah ini, bukan Indonesia, "
        f"bila bukan nasional). Platform: {platform or 'Semua'}. Total postingan: {len(ds.current)}."
    ]
    for t in trends:
        samples = "; ".join(m["judul"][:90] for m in t["sample_mentions"][:2])
        lines.append(
            f"- {t['topic']}: {t['mention_count']} postingan, status {t['velocity_status']}, "
            f"negatif {t['sentiment_pct'].get('negatif', 0)}%, platform {', '.join(t['platforms'][:3])}. Contoh: {samples}"
        )
    try:
        raw, meta = _chat_json(SUMMARY_SYSTEM, "\n".join(lines), max_tokens=900)
    except (AiUnavailable, AiRateLimited) as exc:
        return {"ai": None, "ai_error": str(exc), "tren": len(trends)}
    ai = _clean({
        "ringkasan": raw.get("ringkasan", ""),
        "poin": [p for p in raw.get("poin", []) if isinstance(p, dict)][:5],
        "rekomendasi_topik": [r for r in raw.get("rekomendasi_topik", []) if isinstance(r, dict)][:3],
    })
    result = {"ai": ai, "ai_meta": {**meta, "dibuat": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}}
    _cache[key] = (time.time(), result)
    return {**result, "tren": len(trends), "cache": False}
