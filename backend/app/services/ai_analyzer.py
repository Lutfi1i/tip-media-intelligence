import re
from typing import Dict, Any, List, Optional, Tuple

def _g(nama: str, parent: str, tingkat: str) -> Dict[str, Any]:
    return {"nama": nama, "parent": parent, "tingkat": tingkat}


# Gazetir wilayah prioritas: DKI Jakarta (provinsi → kota → kecamatan kunci) + Bodetabek.
# Setiap entri: kata kunci (lowercase) → nama baku + induk + tingkat administratif.
GAZETTEER_REGIONS = {
    # --- Provinsi / agregat ---
    "dki jakarta": _g("DKI Jakarta", "Indonesia", "provinsi"),
    "jakarta": _g("DKI Jakarta", "Indonesia", "provinsi"),
    "jabodetabek": _g("Jabodetabek", "Indonesia", "kawasan"),
    "bodetabek": _g("Bodetabek", "Indonesia", "kawasan"),
    "jabodetabekpunjur": _g("Jabodetabek", "Indonesia", "kawasan"),

    # --- Kota administrasi DKI ---
    "jakarta selatan": _g("Jakarta Selatan", "DKI Jakarta", "kota"),
    "jaksel": _g("Jakarta Selatan", "DKI Jakarta", "kota"),
    "jakarta timur": _g("Jakarta Timur", "DKI Jakarta", "kota"),
    "jaktim": _g("Jakarta Timur", "DKI Jakarta", "kota"),
    "jakarta barat": _g("Jakarta Barat", "DKI Jakarta", "kota"),
    "jakbar": _g("Jakarta Barat", "DKI Jakarta", "kota"),
    "jakarta pusat": _g("Jakarta Pusat", "DKI Jakarta", "kota"),
    "jakpus": _g("Jakarta Pusat", "DKI Jakarta", "kota"),
    "jakarta utara": _g("Jakarta Utara", "DKI Jakarta", "kota"),
    "jakut": _g("Jakarta Utara", "DKI Jakarta", "kota"),
    "kepulauan seribu": _g("Kepulauan Seribu", "DKI Jakarta", "kabupaten"),

    # --- Kecamatan Jakarta Selatan ---
    "kebayoran baru": _g("Kebayoran Baru", "Jakarta Selatan", "kecamatan"),
    "kebayoran lama": _g("Kebayoran Lama", "Jakarta Selatan", "kecamatan"),
    "pesanggrahan": _g("Pesanggrahan", "Jakarta Selatan", "kecamatan"),
    "cilandak": _g("Cilandak", "Jakarta Selatan", "kecamatan"),
    "pasar minggu": _g("Pasar Minggu", "Jakarta Selatan", "kecamatan"),
    "jagakarsa": _g("Jagakarsa", "Jakarta Selatan", "kecamatan"),
    "mampang": _g("Mampang Prapatan", "Jakarta Selatan", "kecamatan"),
    "mampang prapatan": _g("Mampang Prapatan", "Jakarta Selatan", "kecamatan"),
    "pancoran": _g("Pancoran", "Jakarta Selatan", "kecamatan"),
    "tebet": _g("Tebet", "Jakarta Selatan", "kecamatan"),
    "setiabudi": _g("Setiabudi", "Jakarta Selatan", "kecamatan"),
    "kemang": _g("Kemang", "Jakarta Selatan", "kelurahan"),
    "pejaten": _g("Pejaten", "Jakarta Selatan", "kelurahan"),
    "senayan": _g("Senayan", "Jakarta Selatan", "kelurahan"),
    "blok m": _g("Blok M", "Jakarta Selatan", "kelurahan"),

    # --- Kecamatan Jakarta Timur ---
    "matraman": _g("Matraman", "Jakarta Timur", "kecamatan"),
    "pulo gadung": _g("Pulo Gadung", "Jakarta Timur", "kecamatan"),
    "jatinegara": _g("Jatinegara", "Jakarta Timur", "kecamatan"),
    "duren sawit": _g("Duren Sawit", "Jakarta Timur", "kecamatan"),
    "kramat jati": _g("Kramat Jati", "Jakarta Timur", "kecamatan"),
    "makasar": _g("Makasar", "Jakarta Timur", "kecamatan"),
    "ciracas": _g("Ciracas", "Jakarta Timur", "kecamatan"),
    "cipayung": _g("Cipayung", "Jakarta Timur", "kecamatan"),
    "cakung": _g("Cakung", "Jakarta Timur", "kecamatan"),
    "pasar rebo": _g("Pasar Rebo", "Jakarta Timur", "kecamatan"),
    "rawamangun": _g("Rawamangun", "Jakarta Timur", "kelurahan"),
    "kalimalang": _g("Kalimalang", "Jakarta Timur", "kelurahan"),

    # --- Kecamatan Jakarta Pusat ---
    "gambir": _g("Gambir", "Jakarta Pusat", "kecamatan"),
    "tanah abang": _g("Tanah Abang", "Jakarta Pusat", "kecamatan"),
    "menteng": _g("Menteng", "Jakarta Pusat", "kecamatan"),
    "senen": _g("Senen", "Jakarta Pusat", "kecamatan"),
    "cempaka putih": _g("Cempaka Putih", "Jakarta Pusat", "kecamatan"),
    "johar baru": _g("Johar Baru", "Jakarta Pusat", "kecamatan"),
    "kemayoran": _g("Kemayoran", "Jakarta Pusat", "kecamatan"),
    "sawah besar": _g("Sawah Besar", "Jakarta Pusat", "kecamatan"),
    "sudirman": _g("Sudirman", "Jakarta Pusat", "kawasan"),
    "thamrin": _g("Thamrin", "Jakarta Pusat", "kawasan"),
    "monas": _g("Monas", "Jakarta Pusat", "kawasan"),

    # --- Kecamatan Jakarta Barat ---
    "cengkareng": _g("Cengkareng", "Jakarta Barat", "kecamatan"),
    "grogol petamburan": _g("Grogol Petamburan", "Jakarta Barat", "kecamatan"),
    "grogol": _g("Grogol Petamburan", "Jakarta Barat", "kecamatan"),
    "taman sari": _g("Taman Sari", "Jakarta Barat", "kecamatan"),
    "tambora": _g("Tambora", "Jakarta Barat", "kecamatan"),
    "kebon jeruk": _g("Kebon Jeruk", "Jakarta Barat", "kecamatan"),
    "kalideres": _g("Kalideres", "Jakarta Barat", "kecamatan"),
    "palmerah": _g("Palmerah", "Jakarta Barat", "kecamatan"),
    "kembangan": _g("Kembangan", "Jakarta Barat", "kecamatan"),

    # --- Kecamatan Jakarta Utara ---
    "penjaringan": _g("Penjaringan", "Jakarta Utara", "kecamatan"),
    "pademangan": _g("Pademangan", "Jakarta Utara", "kecamatan"),
    "tanjung priok": _g("Tanjung Priok", "Jakarta Utara", "kecamatan"),
    "koja": _g("Koja", "Jakarta Utara", "kecamatan"),
    "kelapa gading": _g("Kelapa Gading", "Jakarta Utara", "kecamatan"),
    "cilincing": _g("Cilincing", "Jakarta Utara", "kecamatan"),
    "ancol": _g("Ancol", "Jakarta Utara", "kawasan"),
    "pluit": _g("Pluit", "Jakarta Utara", "kelurahan"),

    # --- Bodetabek ---
    "depok": _g("Depok", "Jawa Barat", "kota"),
    "bogor": _g("Bogor", "Jawa Barat", "kota"),
    "bekasi": _g("Bekasi", "Jawa Barat", "kota"),
    "tangerang": _g("Tangerang", "Banten", "kota"),
    "tangerang selatan": _g("Tangerang Selatan", "Banten", "kota"),
    "tangsel": _g("Tangerang Selatan", "Banten", "kota"),
    "cibinong": _g("Cibinong", "Bogor", "kecamatan"),
    "cikarang": _g("Cikarang", "Bekasi", "kecamatan"),
    "serpong": _g("Serpong", "Tangerang Selatan", "kecamatan"),
    "bintaro": _g("Bintaro", "Tangerang Selatan", "kawasan"),
    "pondok aren": _g("Pondok Aren", "Tangerang Selatan", "kecamatan"),
    "ciledug": _g("Ciledug", "Tangerang", "kecamatan"),
    "cinere": _g("Cinere", "Depok", "kecamatan"),
    "sawangan": _g("Sawangan", "Depok", "kecamatan"),
    "cibubur": _g("Cibubur", "Depok", "kawasan"),
    "cimanggis": _g("Cimanggis", "Depok", "kecamatan"),
    "sukmajaya": _g("Sukmajaya", "Depok", "kecamatan"),
    "jatiasih": _g("Jatiasih", "Bekasi", "kecamatan"),
    "tambun": _g("Tambun", "Bekasi", "kecamatan"),
    "cikunir": _g("Cikunir", "Bekasi", "kawasan"),
}

TOPIC_KEYWORDS = {
    "Bencana & Cuaca": [
        "banjir", "genangan", "air naik", "luapan", "longsor", "tanah longsor", "gempa",
        "tanggul jebol", "curah hujan", "pohon tumbang", "cuaca ekstrem", "kebakaran",
        "angin kencang", "rob", "kekeringan", "tsunami", "erupsi", "banjir rob",
        "siaga banjir", "status siaga", "evakuasi"
    ],
    "Lalu Lintas & Transportasi": [
        "macet", "kemacetan", "padat merayap", "lalu lintas", "lalin", "kecelakaan",
        "tabrakan", "angkutan umum", "transjakarta", "mrt", "lrt", "krl", "angkot",
        "penutupan jalan", "rekayasa lalin", "contraflow", "one way", "jalan tol",
        "tilang", "balap liar", "portal jlnt", "pengalihan arus"
    ],
    "Infrastruktur & Jalan": [
        "pompa", "drainase", "jalan rusak", "lampu jalan", "jembatan", "saluran air",
        "proyek", "aspal", "trotoar", "pipa pdam", "perbaikan jalan", "pembangunan",
        "flyover", "underpass", "halte",
        "gorong-gorong", "siring", "turap", "beton", "pengaspalan", "pelebaran jalan"
    ],
    "Layanan Publik": [
        "antrean", "antri", "puskesmas", "ktp", "dukcapil", "pelayanan", "samsat",
        "izin", "birokrasi", "pungli", "kelurahan", "pengaduan", "loket", "bansos",
        "bantuan sosial", "kjp", "kartu jakarta pintar", "pdam", "layanan publik",
        "petugas", "lokasi layanan", "administrasi", "dokumen"
    ],
    "Keamanan & Kriminalitas": [
        "tawuran", "pencurian", "begal", "polisi", "kejahatan", "patroli", "kamtibmas",
        "razia", "narkoba", "curanmor", "penipuan", "preman", "satpol pp", "kriminal",
        "ditangkap", "tersangka", "satreskrim", "polsek", "polres", "pengeroyokan",
        "demonstrasi", "unjuk rasa"
    ],
    "Kesehatan & Lingkungan": [
        "demam berdarah", "dbd", "stunting", "vaksin", "wabah", "rumah sakit", "bpjs",
        "polusi", "kualitas udara", "ispa", "kesehatan", "gizi", "posyandu",
        "imunisasi", "covid", "pasien", "dokter", "apotek", "sampah", "tps", "limbah"
    ],
    "Ekonomi & Harga": [
        "harga beras", "pasar", "inflasi", "sembako", "umkm", "pedagang", "subsidi",
        "harga", "kenaikan tarif", "tarif", "upah minimum", "phk", "pajak", "retribusi",
        "apbd", "anggaran", "investasi", "ekonomi", "daya beli", "bahan pokok", "lapangan kerja"
    ],
    "Sosial & Warga": [
        "warga", "masyarakat", "gotong royong", "bantuan warga", "keluhan warga", "lingkungan rt",
        "lingkungan rw", "komunitas", "kegiatan warga"
    ],
}

NEGATIVE_SENTIMENT_WORDS = [
    "rusak", "rusaknya", "lumpuh", "tergenang", "tenggelam", "macet", "keluhan",
    "korban", "bahaya", "mati", "mogok", "parah", "kecewa", "lambat",
    "tertunda", "gagal", "ancaman", "waspada", "kritis", "terjebak",
    "kecelakaan", "kebakaran", "ambruk", "roboh", "tewas", "luka", "terluka",
    "ditangkap", "tersangka", "protes", "demo", "menolak", "keluhkan", "terlambat",
    "penumpukan", "kemacetan", "padat merayap", "tawuran", "begal", "curanmor",
    "meluber", "jebol", "terendam", "merendam", "menggenang", "kerusakan", "kekurangan",
    "banjir", "luapan", "longsor"
]

POSITIVE_SENTIMENT_WORDS = [
    "surut", "cepat tanggap", "membaik", "apresiasi", "teratasi", "bantuan",
    "tertangani", "respons cepat", "berhasil", "berfungsi kembali", "lancar",
    "aman", "kondusif", "terkendali", "diresmikan", "beroperasi", "selesai",
    "tuntas", "tertib", "perbaikan", "peningkatan", "dukungan", "sinergi",
    "optimal", "terpenuhi", "ditangani"
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
        return "Sosial & Warga", 0.60

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
