"""
Geographic Master Service for Indonesia & Jabodetabek.
Compliant with Kemendagri codes and PRD Teknis TIP Media Intelligence.
Supports archipelago overview (38 provinces, non-pilot grayed out) and high-resolution Jabodetabek drill-down.
"""

from typing import Dict, List, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta

from backend.app.models import RawItem, ItemAnalysis, Issue, Region

# Master 38 Indonesian Provinces (Kemendagri 2-digit Code)
# Only 31 (DKI Jakarta), 32 (Jabar - Bodetabek), 36 (Banten - Tangerang Raya) are active pilot areas.
INDONESIA_PROVINCES: List[Dict[str, Any]] = [
    {"kode": "11", "nama": "Aceh", "pulau": "Sumatera", "lat": 4.6951, "lng": 96.7494, "is_focus": False},
    {"kode": "12", "nama": "Sumatera Utara", "pulau": "Sumatera", "lat": 2.1154, "lng": 99.5451, "is_focus": False},
    {"kode": "13", "nama": "Sumatera Barat", "pulau": "Sumatera", "lat": -0.7399, "lng": 100.8000, "is_focus": False},
    {"kode": "14", "nama": "Riau", "pulau": "Sumatera", "lat": 0.2933, "lng": 101.7068, "is_focus": False},
    {"kode": "15", "nama": "Jambi", "pulau": "Sumatera", "lat": -1.4852, "lng": 102.4381, "is_focus": False},
    {"kode": "16", "nama": "Sumatera Selatan", "pulau": "Sumatera", "lat": -3.3194, "lng": 104.9144, "is_focus": False},
    {"kode": "17", "nama": "Bengkulu", "pulau": "Sumatera", "lat": -3.5778, "lng": 102.3464, "is_focus": False},
    {"kode": "18", "nama": "Lampung", "pulau": "Sumatera", "lat": -4.5586, "lng": 105.4068, "is_focus": False},
    {"kode": "19", "nama": "Kepulauan Bangka Belitung", "pulau": "Sumatera", "lat": -2.7411, "lng": 106.4406, "is_focus": False},
    {"kode": "21", "nama": "Kepulauan Riau", "pulau": "Sumatera", "lat": 3.9456, "lng": 108.1429, "is_focus": False},
    {"kode": "31", "nama": "DKI Jakarta", "pulau": "Jawa", "lat": -6.2088, "lng": 106.8456, "is_focus": True},
    {"kode": "32", "nama": "Jawa Barat (Bodetabek)", "pulau": "Jawa", "lat": -6.9175, "lng": 107.6191, "is_focus": True},
    {"kode": "33", "nama": "Jawa Tengah", "pulau": "Jawa", "lat": -7.1510, "lng": 110.1403, "is_focus": False},
    {"kode": "34", "nama": "DI Yogyakarta", "pulau": "Jawa", "lat": -7.7956, "lng": 110.3695, "is_focus": False},
    {"kode": "35", "nama": "Jawa Timur", "pulau": "Jawa", "lat": -7.5361, "lng": 112.2384, "is_focus": False},
    {"kode": "36", "nama": "Banten (Tangerang Raya)", "pulau": "Jawa", "lat": -6.4058, "lng": 106.0640, "is_focus": True},
    {"kode": "51", "nama": "Bali", "pulau": "Bali & Nusa Tenggara", "lat": -8.4095, "lng": 115.1889, "is_focus": False},
    {"kode": "52", "nama": "Nusa Tenggara Barat", "pulau": "Bali & Nusa Tenggara", "lat": -8.6529, "lng": 117.3616, "is_focus": False},
    {"kode": "53", "nama": "Nusa Tenggara Timur", "pulau": "Bali & Nusa Tenggara", "lat": -8.6574, "lng": 121.0794, "is_focus": False},
    {"kode": "61", "nama": "Kalimantan Barat", "pulau": "Kalimantan", "lat": -0.2787, "lng": 111.4753, "is_focus": False},
    {"kode": "62", "nama": "Kalimantan Tengah", "pulau": "Kalimantan", "lat": -1.6815, "lng": 113.3824, "is_focus": False},
    {"kode": "63", "nama": "Kalimantan Selatan", "pulau": "Kalimantan", "lat": -3.0926, "lng": 115.2838, "is_focus": False},
    {"kode": "64", "nama": "Kalimantan Timur", "pulau": "Kalimantan", "lat": 0.5387, "lng": 116.4194, "is_focus": False},
    {"kode": "65", "nama": "Kalimantan Utara", "pulau": "Kalimantan", "lat": 3.0731, "lng": 116.0414, "is_focus": False},
    {"kode": "71", "nama": "Sulawesi Utara", "pulau": "Sulawesi", "lat": 0.6247, "lng": 123.9750, "is_focus": False},
    {"kode": "72", "nama": "Sulawesi Tengah", "pulau": "Sulawesi", "lat": -1.4300, "lng": 121.4456, "is_focus": False},
    {"kode": "73", "nama": "Sulawesi Selatan", "pulau": "Sulawesi", "lat": -3.6687, "lng": 119.9740, "is_focus": False},
    {"kode": "74", "nama": "Sulawesi Tenggara", "pulau": "Sulawesi", "lat": -4.1449, "lng": 122.1746, "is_focus": False},
    {"kode": "75", "nama": "Gorontalo", "pulau": "Sulawesi", "lat": 0.6999, "lng": 122.4467, "is_focus": False},
    {"kode": "76", "nama": "Sulawesi Barat", "pulau": "Sulawesi", "lat": -2.8441, "lng": 119.2321, "is_focus": False},
    {"kode": "81", "nama": "Maluku", "pulau": "Maluku & Papua", "lat": -3.2385, "lng": 130.1453, "is_focus": False},
    {"kode": "82", "nama": "Maluku Utara", "pulau": "Maluku & Papua", "lat": 1.5709, "lng": 127.8088, "is_focus": False},
    {"kode": "91", "nama": "Papua Barat", "pulau": "Maluku & Papua", "lat": -1.3361, "lng": 133.1747, "is_focus": False},
    {"kode": "92", "nama": "Papua", "pulau": "Maluku & Papua", "lat": -4.2699, "lng": 138.0804, "is_focus": False},
    {"kode": "93", "nama": "Papua Selatan", "pulau": "Maluku & Papua", "lat": -7.4912, "lng": 139.9972, "is_focus": False},
    {"kode": "94", "nama": "Papua Tengah", "pulau": "Maluku & Papua", "lat": -3.5500, "lng": 136.2300, "is_focus": False},
    {"kode": "95", "nama": "Papua Pegunungan", "pulau": "Maluku & Papua", "lat": -4.0833, "lng": 138.9667, "is_focus": False},
    {"kode": "96", "nama": "Papua Barat Daya", "pulau": "Maluku & Papua", "lat": -0.8762, "lng": 131.2558, "is_focus": False},
]

# Detailed 11 Jabodetabek Cities / Regencies (Kemendagri 4-digit codes)
JABODETABEK_REGIONS: List[Dict[str, Any]] = [
    {
        "kode": "31.71",
        "nama": "Jakarta Pusat",
        "jenis": "Kota Administrasi",
        "provinsi": "DKI Jakarta",
        "lat": -6.1818,
        "lng": 106.8223,
        "aliases": ["jakarta pusat", "jakpus", "menteng", "gambir", "tanah abang", "senen", "cempaka putih"],
    },
    {
        "kode": "31.72",
        "nama": "Jakarta Utara",
        "jenis": "Kota Administrasi",
        "provinsi": "DKI Jakarta",
        "lat": -6.1214,
        "lng": 106.8920,
        "aliases": ["jakarta utara", "jakut", "tanjung priok", "pluit", "kelapa gading", "penjaringan", "koja", "cilincing"],
    },
    {
        "kode": "31.73",
        "nama": "Jakarta Barat",
        "jenis": "Kota Administrasi",
        "provinsi": "DKI Jakarta",
        "lat": -6.1683,
        "lng": 106.7589,
        "aliases": ["jakarta barat", "jakbar", "kebon jeruk", "grogol", "cengkareng", "kembangan", "kalideres", "palmerah"],
    },
    {
        "kode": "31.74",
        "nama": "Jakarta Selatan",
        "jenis": "Kota Administrasi",
        "provinsi": "DKI Jakarta",
        "lat": -6.2615,
        "lng": 106.8106,
        "aliases": ["jakarta selatan", "jaksel", "kebayoran baru", "kebayoran lama", "cilandak", "pasar minggu", "mampang", "tebet", "pancoran", "setiabudi", "kemang", "blok m", "senayan"],
    },
    {
        "kode": "31.75",
        "nama": "Jakarta Timur",
        "jenis": "Kota Administrasi",
        "provinsi": "DKI Jakarta",
        "lat": -6.2250,
        "lng": 106.9004,
        "aliases": ["jakarta timur", "jaktim", "matraman", "pulo gadung", "jatinegara", "duren sawit", "kramat jati", "pasar rebo", "ciracas", "cipayung", "cakung"],
    },
    {
        "kode": "31.01",
        "nama": "Kepulauan Seribu",
        "jenis": "Kabupaten Administrasi",
        "provinsi": "DKI Jakarta",
        "lat": -5.5878,
        "lng": 106.5540,
        "aliases": ["kepulauan seribu", "pulau seribu", "pulau pramuka", "pulau tidung", "pulau pari"],
    },
    {
        "kode": "32.71",
        "nama": "Kota Bogor",
        "jenis": "Kota",
        "provinsi": "Jawa Barat",
        "lat": -6.5971,
        "lng": 106.8060,
        "aliases": ["kota bogor", "bogor kota", "kebun raya bogor", "bogor tengah", "bogor selatan", "bogor timur", "bogor utara", "bogor barat"],
    },
    {
        "kode": "32.01",
        "nama": "Kabupaten Bogor",
        "jenis": "Kabupaten",
        "provinsi": "Jawa Barat",
        "lat": -6.4797,
        "lng": 106.8247,
        "aliases": ["kabupaten bogor", "kab bogor", "cibinong", "cileungsi", "gunung putri", "puncak", "ciawi", "bojonggede", "parung"],
    },
    {
        "kode": "32.76",
        "nama": "Kota Depok",
        "jenis": "Kota",
        "provinsi": "Jawa Barat",
        "lat": -6.4025,
        "lng": 106.7942,
        "aliases": ["depok", "kota depok", "margonda", "sawangan", "cimanggis", "pancoran mas", "sukmajaya", "cinere"],
    },
    {
        "kode": "32.75",
        "nama": "Kota Bekasi",
        "jenis": "Kota",
        "provinsi": "Jawa Barat",
        "lat": -6.2383,
        "lng": 106.9756,
        "aliases": ["kota bekasi", "bekasi kota", "bekasi barat", "bekasi timur", "bekasi selatan", "bekasi utara", "rawalumbu", "pondok gede"],
    },
    {
        "kode": "32.16",
        "nama": "Kabupaten Bekasi",
        "jenis": "Kabupaten",
        "provinsi": "Jawa Barat",
        "lat": -6.2415,
        "lng": 107.0988,
        "aliases": ["kabupaten bekasi", "kab bekasi", "cikarang", "tambun", "cibitung", "sukatani"],
    },
    {
        "kode": "36.71",
        "nama": "Kota Tangerang",
        "jenis": "Kota",
        "provinsi": "Banten",
        "lat": -6.1783,
        "lng": 106.6319,
        "aliases": ["kota tangerang", "tangerang kota", "cipondoh", "karawaci", "ciledug", "batuceper", "benda"],
    },
    {
        "kode": "36.74",
        "nama": "Kota Tangerang Selatan",
        "jenis": "Kota",
        "provinsi": "Banten",
        "lat": -6.2888,
        "lng": 106.7179,
        "aliases": ["tangerang selatan", "tangsel", "bsd", "bsd city", "serpong", "bintaro", "ciputat", "pamulang"],
    },
    {
        "kode": "36.03",
        "nama": "Kabupaten Tangerang",
        "jenis": "Kabupaten",
        "provinsi": "Banten",
        "lat": -6.2088,
        "lng": 106.4673,
        "aliases": ["kabupaten tangerang", "kab tangerang", "tigaraksa", "balaraja", "cikupa", "pasar kemis"],
    },
]


def get_indonesia_geo_overview(db: Session) -> Dict[str, Any]:
    """
    Returns Indonesia Archipelago geospatial overview.
    Contains:
    - 38 provinces with focus status (non-focus marked for Fase 2 - grayed out).
    - Detailed Jabodetabek active sub-regions with live article count, threat level, and heat intensity.
    """
    now = datetime.utcnow()
    since_24h = now - timedelta(hours=24)

    # Fetch recent analyses to calculate live heatmap metrics
    recent_items = (
        db.query(RawItem)
        .filter(RawItem.published_at >= since_24h)
        .all()
    )

    # Map articles to Jabodetabek regions by searching aliases in title & location
    region_metrics: Dict[str, Dict[str, Any]] = {}
    for r in JABODETABEK_REGIONS:
        region_metrics[r["kode"]] = {
            "kode": r["kode"],
            "nama": r["nama"],
            "jenis": r["jenis"],
            "provinsi": r["provinsi"],
            "lat": r["lat"],
            "lng": r["lng"],
            "mention_count": 0,
            "negative_count": 0,
            "topics": {},
            "threat_level": "rendah",
            "heat_intensity": 0.1,  # 0.0 - 1.0
            "top_issue_title": None,
        }

    for item in recent_items:
        text = f"{item.judul} {item.isi or ''}".lower()
        analysis = item.analysis

        for r in JABODETABEK_REGIONS:
            code = r["kode"]
            # Match aliases
            matched = any(alias in text for alias in r["aliases"])
            if matched:
                rm = region_metrics[code]
                rm["mention_count"] += 1
                if analysis:
                    if (analysis.sentimen or "").lower() in ("negatif", "negative"):
                        rm["negative_count"] += 1
                    topic = analysis.topik or "Umum"
                    rm["topics"][topic] = rm["topics"].get(topic, 0) + 1

    # Calculate heat intensity and threat level for each Jabodetabek region
    max_mentions = max([rm["mention_count"] for rm in region_metrics.values()] + [1])
    for rm in region_metrics.values():
        cnt = rm["mention_count"]
        neg = rm["negative_count"]
        neg_pct = (neg / cnt * 100) if cnt > 0 else 0
        intensity = min(1.0, round(cnt / max(max_mentions, 10), 2))
        rm["heat_intensity"] = max(0.15, intensity)

        if cnt >= 15 or neg >= 10:
            rm["threat_level"] = "kritis"
        elif cnt >= 8 or neg >= 5:
            rm["threat_level"] = "tinggi"
        elif cnt >= 3 or neg >= 2:
            rm["threat_level"] = "waspada"
        else:
            rm["threat_level"] = "rendah"

        # Dominant topic
        if rm["topics"]:
            rm["dominant_topic"] = max(rm["topics"].items(), key=lambda x: x[1])[0]
        else:
            rm["dominant_topic"] = "Umum"

    # Also link with top priority issues from DB
    issues = db.query(Issue).order_by(Issue.skor.desc()).limit(10).all()
    for iss in issues:
        iss_text = f"{iss.judul} {iss.ringkasan or ''}".lower()
        for rm in region_metrics.values():
            if not rm["top_issue_title"]:
                r_obj = next((x for x in JABODETABEK_REGIONS if x["kode"] == rm["kode"]), None)
                if r_obj and any(alias in iss_text for alias in r_obj["aliases"]):
                    rm["top_issue_title"] = iss.judul

    # Assemble Indonesia overview
    provinces_payload = []
    for prov in INDONESIA_PROVINCES:
        is_focus = prov["is_focus"]
        prov_data = {
            "kode": prov["kode"],
            "nama": prov["nama"],
            "pulau": prov["pulau"],
            "lat": prov["lat"],
            "lng": prov["lng"],
            "is_focus": is_focus,
            "status": "Pilot Operasional" if is_focus else "Fase 2 - Belum Menjadi Fokus",
            "keterangan": "Wilayah pemantauan live media intelligence & tanggap darurat." if is_focus else "Wilayah Nusantara tahap ekspansi berikutnya (tampil abu-abu).",
        }
        provinces_payload.append(prov_data)

    return {
        "status": "success",
        "focus_area": "Jabodetabek (DKI Jakarta, Bodetabek, Tangerang Raya)",
        "provinces": provinces_payload,
        "jabodetabek_regions": list(region_metrics.values()),
        "total_provinces": len(provinces_payload),
        "total_active_regions": len(region_metrics),
        "generated_at": now.isoformat(),
    }


def get_region_detail_and_issues(db: Session, kode_wilayah: str) -> Dict[str, Any]:
    """
    Drill down into a specific regency/city by Kemendagri code.
    Returns matched issues, real news articles, and local threat parameters.
    """
    region_info = next((r for r in JABODETABEK_REGIONS if r["kode"] == kode_wilayah), None)
    if not region_info:
        # Check if it's a province code
        prov_info = next((p for p in INDONESIA_PROVINCES if p["kode"] == kode_wilayah), None)
        if prov_info:
            return {
                "kode": prov_info["kode"],
                "nama": prov_info["nama"],
                "is_focus": prov_info["is_focus"],
                "status": "Pilot Operasional" if prov_info["is_focus"] else "Fase 2 - Belum Menjadi Fokus",
                "pesan": "Wilayah ini belum masuk fase monitoring live Jabodetabek." if not prov_info["is_focus"] else "Wilayah aktif.",
                "issues": [],
                "recent_articles": [],
            }
        return {"error": f"Wilayah dengan kode {kode_wilayah} tidak ditemukan."}

    aliases = region_info["aliases"]

    # Find matching recent raw items
    items = db.query(RawItem).order_by(RawItem.published_at.desc()).limit(150).all()
    matched_items = []
    for item in items:
        text = f"{item.judul} {item.isi or ''}".lower()
        if any(alias in text for alias in aliases):
            analysis = item.analysis
            matched_items.append({
                "id": item.id,
                "judul": item.judul,
                "url": item.url_kanonik,
                "penerbit": item.penerbit,
                "published_at": item.published_at.isoformat() if item.published_at else None,
                "sentimen": analysis.sentimen if analysis else "netral",
                "topik": analysis.topik if analysis else "Umum",
                "ringkasan": analysis.ringkasan if analysis else item.judul,
            })

    # Find matching issues
    all_issues = db.query(Issue).order_by(Issue.skor.desc()).all()
    matched_issues = []
    for iss in all_issues:
        iss_text = f"{iss.judul} {iss.ringkasan or ''}".lower()
        if any(alias in iss_text for alias in aliases):
            matched_issues.append({
                "id": iss.id,
                "judul": iss.judul,
                "status": iss.status,
                "kategori": iss.kategori,
                "tingkat_bahaya": iss.level.lower() if iss.level else "medium",
                "skor": iss.skor,
                "ringkasan": iss.ringkasan,
                "volume_24jam": iss.current_volume,
            })

    return {
        "kode": region_info["kode"],
        "nama": region_info["nama"],
        "jenis": region_info["jenis"],
        "provinsi": region_info["provinsi"],
        "lat": region_info["lat"],
        "lng": region_info["lng"],
        "is_focus": True,
        "total_articles": len(matched_items),
        "total_issues": len(matched_issues),
        "issues": matched_issues,
        "recent_articles": matched_items[:15],
    }
