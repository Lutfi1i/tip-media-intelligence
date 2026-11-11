from typing import Dict, Any, List

def compute_risk_score(
    relevance_score: float,       # 0 - 100: match with priority region, keywords, mandates
    growth_ratio: float,          # e.g. 1.0 = normal, 3.0 = 3x baseline, 8.0 = 8x baseline
    impact_severity: float,       # 0 - 100: public safety, infrastructure disruption, essential service
    channel_spread_count: int,    # number of unique sources / cross-channel instances
    source_credibility: float,    # 0.0 - 1.0: average credibility of reporting sources
    sentiment_urgency: float,     # 0 - 100: negative severity & high urgency vocabulary
) -> Dict[str, Any]:
    """
    Compute 0-100 risk score based on 6 weighted factors specified in PRD Section 7:
    - Relevansi isu (wilayah, keyword, mandat): 25%
    - Kecepatan pertumbuhan vs baseline: 20%
    - Dampak potensial (layanan, keselamatan): 20%
    - Jangkauan dan sebaran lintas kanal: 15%
    - Kredibilitas sumber: 10%
    - Sentimen dan urgensi bahasa: 10%
    """
    # 1. Relevansi (0-100)
    score_relevansi = max(0.0, min(100.0, relevance_score))

    # 2. Kecepatan pertumbuhan vs baseline (0-100)
    # Calibrated: 8x is 80 pts, 15x+ is 100 pts, 3x (threshold) is 60 pts
    if growth_ratio >= 15.0:
        score_kecepatan = 100.0
    elif growth_ratio >= 8.0:
        score_kecepatan = 80.0 + (growth_ratio - 8.0) * 2.85
    elif growth_ratio >= 3.0:
        score_kecepatan = 60.0 + (growth_ratio - 3.0) * 4.0
    elif growth_ratio > 1.0:
        score_kecepatan = 25.0 + (growth_ratio - 1.0) * 17.5
    else:
        score_kecepatan = max(5.0, growth_ratio * 25.0)

    # 3. Dampak potensial (0-100)
    score_dampak = max(0.0, min(100.0, impact_severity))

    # 4. Jangkauan & sebaran (0-100)
    # 12 sources = ~68 pts, 25+ sources = 90+ pts
    score_jangkauan = min(100.0, 20.0 + (channel_spread_count * 4.0))

    # 5. Kredibilitas sumber (0-100)
    score_kredibilitas = max(0.0, min(100.0, source_credibility * 100.0))

    # 6. Sentimen & urgensi bahasa (0-100)
    score_sentimen = max(0.0, min(100.0, sentiment_urgency))

    # Weighted calculation
    total_score = (
        (score_relevansi * 0.25) +
        (score_kecepatan * 0.20) +
        (score_dampak * 0.20) +
        (score_jangkauan * 0.15) +
        (score_kredibilitas * 0.10) +
        (score_sentimen * 0.10)
    )
    final_score = round(total_score, 1)

    # Determine risk level according to PRD thresholds:
    # CRITICAL: 85-100
    # HIGH: 70-84
    # MEDIUM: 40-69
    # LOW: 0-39
    if final_score >= 85.0:
        level = "CRITICAL"
        respons = "Notifikasi segera, wajib review manusia"
    elif final_score >= 70.0:
        level = "HIGH"
        respons = "Alert prioritas, review dengan SLA singkat (<= 2 jam)"
    elif final_score >= 40.0:
        level = "MEDIUM"
        respons = "Antrean pantau, masuk laporan periodik"
    else:
        level = "LOW"
        respons = "Tersimpan dan dapat dicari di sistem"

    alasan_detail = {
        "skor_akhir": final_score,
        "level": level,
        "respons": respons,
        "faktor": {
            "relevansi_isu": {
                "bobot": "25%",
                "nilai": round(score_relevansi, 1),
                "kontribusi": round(score_relevansi * 0.25, 1),
                "catatan": "Kesesuaian wilayah prioritas dan kata kunci utama"
            },
            "kecepatan_pertumbuhan": {
                "bobot": "20%",
                "nilai": round(score_kecepatan, 1),
                "kontribusi": round(score_kecepatan * 0.20, 1),
                "catatan": f"Pertumbuhan {growth_ratio:.1f}x dari baseline normal"
            },
            "dampak_potensial": {
                "bobot": "20%",
                "nilai": round(score_dampak, 1),
                "kontribusi": round(score_dampak * 0.20, 1),
                "catatan": "Tingkat gangguan mobilitas dan keselamatan warga"
            },
            "jangkauan_sebaran": {
                "bobot": "15%",
                "nilai": round(score_jangkauan, 1),
                "kontribusi": round(score_jangkauan * 0.15, 1),
                "catatan": f"Sebaran informasi mencakup {channel_spread_count} kanal/sumber unik"
            },
            "kredibilitas_sumber": {
                "bobot": "10%",
                "nilai": round(score_kredibilitas, 1),
                "kontribusi": round(score_kredibilitas * 0.10, 1),
                "catatan": f"Rata-rata kredibilitas sumber: {source_credibility:.2f}"
            },
            "sentimen_urgensi": {
                "bobot": "10%",
                "nilai": round(score_sentimen, 1),
                "kontribusi": round(score_sentimen * 0.10, 1),
                "catatan": "Intensitas kata keluhan dan indikator urgensi publik"
            }
        }
    }

    return alasan_detail
