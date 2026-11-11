import re
from typing import Dict, Any, List, Optional, Tuple

GAZETTEER_REGIONS = {
    "kemang": {"nama": "Kemang", "parent": "Jakarta Selatan", "tingkat": "kelurahan"},
    "pejaten": {"nama": "Pejaten", "parent": "Jakarta Selatan", "tingkat": "kelurahan"},
    "kebayoran baru": {"nama": "Kebayoran Baru", "parent": "Jakarta Selatan", "tingkat": "kecamatan"},
    "pasar minggu": {"nama": "Pasar Minggu", "parent": "Jakarta Selatan", "tingkat": "kecamatan"},
    "cilandak": {"nama": "Cilandak", "parent": "Jakarta Selatan", "tingkat": "kecamatan"},
    "mampang": {"nama": "Mampang Prapatan", "parent": "Jakarta Selatan", "tingkat": "kecamatan"},
    "tebet": {"nama": "Tebet", "parent": "Jakarta Selatan", "tingkat": "kecamatan"},
    "jakarta selatan": {"nama": "Jakarta Selatan", "parent": "DKI Jakarta", "tingkat": "kota"},
    "jaksel": {"nama": "Jakarta Selatan", "parent": "DKI Jakarta", "tingkat": "kota"},
    "jakarta timur": {"nama": "Jakarta Timur", "parent": "DKI Jakarta", "tingkat": "kota"},
    "jaktim": {"nama": "Jakarta Timur", "parent": "DKI Jakarta", "tingkat": "kota"},
    "jakarta barat": {"nama": "Jakarta Barat", "parent": "DKI Jakarta", "tingkat": "kota"},
    "jakbar": {"nama": "Jakarta Barat", "parent": "DKI Jakarta", "tingkat": "kota"},
    "jakarta pusat": {"nama": "Jakarta Pusat", "parent": "DKI Jakarta", "tingkat": "kota"},
    "jakpus": {"nama": "Jakarta Pusat", "parent": "DKI Jakarta", "tingkat": "kota"},
    "jakarta utara": {"nama": "Jakarta Utara", "parent": "DKI Jakarta", "tingkat": "kota"},
    "jakut": {"nama": "Jakarta Utara", "parent": "DKI Jakarta", "tingkat": "kota"},
    "depok": {"nama": "Depok", "parent": "Jawa Barat", "tingkat": "kota"},
    "bogor": {"nama": "Bogor", "parent": "Jawa Barat", "tingkat": "kota"},
    "bekasi": {"nama": "Bekasi", "parent": "Jawa Barat", "tingkat": "kota"},
    "tangerang": {"nama": "Tangerang", "parent": "Banten", "tingkat": "kota"},
}

TOPIC_KEYWORDS = {
    "Bencana": [
        "banjir", "genangan", "air naik", "luapan", "longsor", "gempa",
        "tanggul jebol", "curah hujan", "pohon tumbang", "cuaca ekstrem"
    ],
    "Infrastruktur": [
        "pompa", "drainase", "jalan rusak", "lampu jalan", "jembatan",
        "saluran air", "proyek", "aspal", "trotoar", "pipa pdam"
    ],
    "Pelayanan Publik": [
        "antrean", "puskesmas", "ktp", "dukcapil", "pelayanan",
        "samsat", "izin", "birokrasi", "pungli", "kelurahan"
    ],
    "Keamanan": [
        "tawuran", "pencurian", "begal", "polisi", "kejahatan",
        "patroli", "kamtibmas", "razia", "narkoba"
    ],
    "Ekonomi": [
        "harga beras", "pasar", "inflasi", "sembako", "umkm", "pedagang", "subsidi"
    ],
    "Kesehatan": [
        "demam berdarah", "dbd", "stunting", "vaksin", "wabah", "rumah sakit", "bpjs"
    ],
}

NEGATIVE_SENTIMENT_WORDS = [
    "rusak", "rusaknya", "lumpuh", "tergenang", "tenggelam", "macet", "keluhan",
    "korban", "bahaya", "mati", "mogok", "parah", "kecewa", "lambat",
    "tertunda", "gagal", "ancaman", "waspada", "kritis", "terjebak"
]

POSITIVE_SENTIMENT_WORDS = [
    "surut", "cepat tanggap", "membaik", "apresiasi", "teratasi", "bantuan",
    "tertangani", "respons cepat", "berhasil", "berfungsi kembali", "lancar",
    "aman", "kondusif", "terkendali"
]

def analyze_sentiment(text: str) -> Tuple[str, float]:
    """
    Classify sentiment into positif, netral, negatif, campuran, or tidak pasti.
    Returns (label, confidence).
    """
    lower = text.lower()
    neg_count = sum(1 for word in NEGATIVE_SENTIMENT_WORDS if word in lower)
    pos_count = sum(1 for word in POSITIVE_SENTIMENT_WORDS if word in lower)

    if neg_count > 0 and pos_count > 0:
        confidence = round(min(0.70 + (neg_count + pos_count) * 0.03, 0.95), 2)
        return "campuran", confidence
    elif neg_count > 0:
        confidence = round(min(0.75 + neg_count * 0.04, 0.96), 2)
        return "negatif", confidence
    elif pos_count > 0:
        confidence = round(min(0.75 + pos_count * 0.04, 0.95), 2)
        return "positif", confidence
    else:
        # Check if text is ambiguous or neutral
        if len(text.strip().split()) < 5:
            return "tidak pasti", 0.50
        return "netral", 0.80

def analyze_topic(text: str) -> Tuple[str, float]:
    """
    Classify organizational topic taxonomy.
    Returns (topic, confidence).
    """
    lower = text.lower()
    scores: Dict[str, int] = {}
    for topic, keywords in TOPIC_KEYWORDS.items():
        count = sum(1 for kw in keywords if kw in lower)
        if count > 0:
            scores[topic] = count

    if not scores:
        return "Umum", 0.60

    sorted_topics = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    best_topic, best_score = sorted_topics[0]
    confidence = round(min(0.70 + best_score * 0.07, 0.98), 2)
    return best_topic, confidence

def extract_locations(text: str) -> Tuple[Optional[str], List[str], float]:
    """
    Extract Kemendagri gazetteer locations.
    Differentiates primary event location and mentioned locations.
    Returns (lokasi_kejadian, lokasi_disebut_list, confidence).
    """
    lower = text.lower()
    found: List[Dict[str, Any]] = []

    for key, data in GAZETTEER_REGIONS.items():
        pattern = r"\b" + re.escape(key) + r"\b"
        matches = list(re.finditer(pattern, lower))
        if matches:
            found.append({
                "key": key,
                "nama": data["nama"],
                "parent": data["parent"],
                "tingkat": data["tingkat"],
                "first_pos": matches[0].start(),
                "count": len(matches)
            })

    if not found:
        return None, [], 0.0

    # Sort by first appearance and specificity
    def rank_key(item):
        tier_weight = 2 if item["tingkat"] == "kelurahan" else (1 if item["tingkat"] == "kecamatan" else 0)
        return (-tier_weight, item["first_pos"])

    found.sort(key=rank_key)
    primary = found[0]["nama"]
    mentioned = list(dict.fromkeys(item["nama"] for item in found))

    confidence = 0.85 if found[0]["tingkat"] in ("kelurahan", "kecamatan") else 0.72
    return primary, mentioned, confidence

def generate_issue_summary(title: str, contents: List[str]) -> Dict[str, Any]:
    """
    Generate structured issue summary:
    - Factual overview
    - Related parties (pihak_terlibat)
    - Unknown factors (hal_belum_diketahui)
    """
    combined = " ".join(contents).lower()
    
    # Identify parties
    parties = []
    if "dinas sda" in combined or "sda" in combined:
        parties.append("Dinas Sumber Daya Air")
    if "bpbd" in combined:
        parties.append("BPBD DKI Jakarta")
    if "polsek" in combined or "polisi" in combined:
        parties.append("Kepolisian Sektor")
    if "dishub" in combined:
        parties.append("Dinas Perhubungan")
    if "warga" in combined or "pengendara" in combined:
        parties.append("Warga & Pengguna Jalan")

    if not parties:
        parties.append("Warga Setempat")

    unknowns = "Penyebab pasti dan estimasi durasi surut masih dalam proses pengecekan tim teknis lapangan."
    if "pompa" in combined:
        unknowns = "Status ketersediaan pompa cadangan mobile dan waktu perbaikan pompa stasioner."

    # Formulate factual summary
    overview = f"Laporan konsentrasi informasi mengenai {title.lower()}. Terpantau akumulasi laporan dari warga dan media mengenai eskalasi situasi di lokasi kejadian."

    return {
        "ringkasan": overview,
        "pihak_terlibat": parties,
        "hal_belum_diketahui": unknowns,
    }
