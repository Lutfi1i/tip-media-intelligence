"""Kategori isu dan instansi yang disebut dalam konten media sosial.

Berbeda dari `ai_analyzer.TOPIC_KEYWORDS` (satu label per konten, dipakai untuk isu),
taksonomi ini multi-label: satu postingan bisa masuk Kuliner dan Ekonomi sekaligus, dan
bisa menyebut beberapa instansi. Klasifikasi dihitung saat query sehingga perubahan daftar
di sini langsung berlaku untuk data lama tanpa migrasi.

Pencocokan memakai batas kata, ditambah pencocokan di dalam hashtag untuk alias >= 4 huruf
(misalnya "pln" tidak dicocokkan di hashtag, tetapi "damkar" cocok dengan #DamkarDepok).
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Dict, List, Sequence, Tuple


@dataclass(frozen=True)
class Category:
    id: str
    label: str
    keywords: Tuple[str, ...]


@dataclass(frozen=True)
class Agency:
    id: str
    label: str
    group: str
    aliases: Tuple[str, ...]


CATEGORIES: Tuple[Category, ...] = (
    Category("politik", "Politik & Pemerintahan", (
        "pilkada", "pemilu", "pilpres", "dprd", "dpr", "gubernur", "wakil gubernur", "wali kota", "walikota",
        "bupati", "partai", "kampanye", "menteri", "presiden", "wapres", "wakil presiden", "perda", "pejabat",
        "kebijakan", "pemerintah", "istana", "kabinet", "kpu", "bawaslu", "koalisi", "oposisi", "politik",
    )),
    Category("hukum", "Hukum & Korupsi", (
        "korupsi", "kpk", "suap", "gratifikasi", "kejaksaan", "jaksa", "hakim", "pengadilan", "vonis", "sidang",
        "dakwaan", "putusan", "mahkamah", "pungli", "ombudsman", "tipikor",
    )),
    Category("keamanan", "Keamanan & Kriminalitas", (
        "tawuran", "pencurian", "begal", "kejahatan", "kriminal", "curanmor", "penipuan", "preman", "narkoba",
        "pengeroyokan", "pembunuhan", "penganiayaan", "perampokan", "jambret", "copet", "judi online", "judol",
        "pinjol ilegal", "ditangkap", "tersangka", "razia", "kamtibmas", "demo", "unjuk rasa", "demonstrasi",
    )),
    Category("bencana", "Bencana & Cuaca", (
        "banjir", "genangan", "longsor", "gempa", "puting beliung", "angin kencang", "pohon tumbang", "cuaca ekstrem",
        "hujan lebat", "hujan deras", "rob", "tsunami", "erupsi", "kekeringan", "evakuasi", "pengungsi", "siaga",
    )),
    Category("kebakaran", "Kebakaran", ("kebakaran", "terbakar", "damkar", "pemadam", "korsleting", "si jago merah")),
    Category("transportasi", "Lalu Lintas & Transportasi", (
        "macet", "kemacetan", "lalu lintas", "lalin", "kecelakaan", "tabrakan", "transjakarta", "mrt", "lrt", "krl",
        "commuter", "angkot", "ojol", "ojek online", "jalan tol", "tol", "contraflow", "ganjil genap", "tilang",
        "parkir", "busway", "stasiun", "terminal", "bandara", "penerbangan",
    )),
    Category("infrastruktur", "Infrastruktur & Jalan", (
        "jalan rusak", "jalan berlubang", "lubang", "drainase", "jembatan", "trotoar", "lampu jalan", "pju",
        "perbaikan jalan", "pembangunan", "proyek", "flyover", "underpass", "gorong-gorong", "saluran air",
        "pengaspalan", "aspal", "galian",
    )),
    Category("energi", "Listrik & Energi", (
        "listrik", "pemadaman listrik", "listrik padam", "mati listrik", "mati lampu", "pln", "token listrik", "bbm", "pertalite", "pertamax", "solar",
        "spbu", "elpiji", "lpg", "gas melon", "pertamina",
    )),
    Category("air", "Air Bersih", ("air bersih", "air mati", "pdam", "pam jaya", "air keruh", "krisis air", "sumur")),
    Category("lingkungan", "Lingkungan & Sampah", (
        "sampah", "tps", "tpa", "limbah", "polusi", "kualitas udara", "ispu", "pencemaran", "kali kotor",
        "sungai", "penghijauan", "pohon", "bau busuk",
    )),
    Category("kesehatan", "Kesehatan", (
        "rumah sakit", "puskesmas", "rsud", "bpjs", "dbd", "demam berdarah", "wabah", "vaksin", "imunisasi",
        "stunting", "gizi", "keracunan", "pasien", "dokter", "obat", "ispa", "covid", "kesehatan",
    )),
    Category("pendidikan", "Pendidikan", (
        "sekolah", "siswa", "guru", "ppdb", "spmb", "kjp", "kampus", "mahasiswa", "universitas", "ujian",
        "beasiswa", "zonasi", "pendidikan",
    )),
    Category("layanan", "Layanan Publik", (
        "antrean", "antri", "pelayanan", "ktp", "kartu keluarga", "dukcapil", "samsat", "perizinan", "izin", "loket",
        "pengaduan", "bansos", "bantuan sosial", "birokrasi", "layanan publik", "mal pelayanan",
    )),
    Category("ekonomi", "Ekonomi & Harga", (
        "harga", "sembako", "beras", "cabai", "minyak goreng", "inflasi", "pasar", "pedagang", "umkm", "pajak",
        "retribusi", "tarif", "daya beli", "subsidi", "investasi", "ekonomi", "bisnis",
    )),
    Category("kerja", "Ketenagakerjaan", ("phk", "lowongan", "loker", "ump", "umr", "upah", "buruh", "pengangguran", "pekerja", "gaji")),
    Category("perumahan", "Perumahan & Tata Ruang", (
        "rusun", "rusunawa", "penggusuran", "gusur", "kpr", "perumahan", "tata ruang", "permukiman", "kampung kumuh",
        "sertifikat tanah", "sengketa lahan",
    )),
    Category("kuliner", "Kuliner", (
        "kuliner", "makanan", "tempat makan", "jajanan", "jajan", "restoran", "resto", "warung", "kafe", "cafe", "coffee",
        "kopi", "street food", "bakso", "sate", "mie", "mi ayam", "seblak", "martabak", "nasi", "ayam geprek",
        "soto", "rendang", "dimsum", "boba", "es teh", "resep", "masakan", "rekomendasi makan", "makanan halal",
        "foodie", "kulineran", "takjil",
    )),
    Category("wisata", "Wisata & Event", (
        "wisata", "liburan", "destinasi", "konser", "festival", "event", "pameran", "mall", "taman", "car free day",
        "cfd", "ancol", "monas", "kebun raya", "puncak", "staycation", "hotel", "tiket",
    )),
    Category("olahraga", "Olahraga", (
        "sepak bola", "persija", "persib", "timnas", "liga", "pertandingan", "stadion", "gbk", "jis", "maraton",
        "badminton", "bulu tangkis", "voli", "basket", "pelari", "fun run", "olahraga",
    )),
    Category("hiburan", "Hiburan & Viral", (
        "viral", "artis", "selebgram", "influencer", "konten kreator", "film", "musik", "lagu", "kpop", "k-pop",
        "drama", "netizen", "fyp", "trending", "prank", "meme",
    )),
    Category("agama", "Agama & Sosial", (
        "masjid", "gereja", "vihara", "klenteng", "ramadan", "ramadhan", "lebaran", "idul fitri", "idul adha", "natal",
        "imlek", "pengajian", "ibadah", "toleransi", "zakat", "sedekah", "panti",
    )),
    Category("teknologi", "Teknologi & Digital", (
        "aplikasi", "internet", "sinyal", "wifi", "data pribadi", "kebocoran data", "hacker", "peretasan", "server down",
        "gangguan sistem", "ai", "digital", "startup", "e-wallet", "qris",
    )),
)

AGENCIES: Tuple[Agency, ...] = (
    # Utilitas
    Agency("pln", "PLN", "Utilitas", ("pln", "perusahaan listrik negara", "pln uid", "pln up3")),
    Agency("pam", "PAM Jaya / PDAM", "Utilitas", ("pam jaya", "pdam", "perumda air", "palyja", "aetra", "tirta pakuan", "tirta asasta")),
    Agency("pertamina", "Pertamina", "Utilitas", ("pertamina", "spbu", "pertamina patra niaga")),
    Agency("telkom", "Telkom / IndiHome", "Utilitas", ("telkom", "indihome", "telkomsel")),
    # Darurat & keamanan
    Agency("damkar", "Damkar / Gulkarmat", "Darurat & Keamanan", ("damkar", "pemadam kebakaran", "gulkarmat", "dinas pemadam")),
    Agency("bpbd", "BPBD", "Darurat & Keamanan", ("bpbd", "badan penanggulangan bencana")),
    Agency("basarnas", "Basarnas / Tim SAR", "Darurat & Keamanan", ("basarnas", "tim sar", "sar gabungan")),
    Agency("bmkg", "BMKG", "Darurat & Keamanan", ("bmkg",)),
    Agency("polri", "Polri", "Darurat & Keamanan", (
        "polisi", "polri", "polda", "polres", "polresta", "polsek", "polantas", "satlantas", "ditlantas", "kapolda",
        "kapolres", "kapolsek", "brimob", "tmc polda", "reskrim",
    )),
    Agency("tni", "TNI", "Darurat & Keamanan", ("tni", "kodam", "kodim", "koramil", "babinsa", "prajurit")),
    Agency("satpolpp", "Satpol PP", "Darurat & Keamanan", ("satpol pp", "satpol", "polisi pamong praja")),
    # Transportasi
    Agency("dishub", "Dinas Perhubungan", "Transportasi", ("dishub", "dinas perhubungan")),
    Agency("transjakarta", "Transjakarta", "Transportasi", ("transjakarta", "busway")),
    Agency("kai", "KAI / KAI Commuter", "Transportasi", ("kai commuter", "commuterline", "commuter line", "krl", "pt kai", "kereta api indonesia", "kci")),
    Agency("mrt", "MRT Jakarta", "Transportasi", ("mrt",)),
    Agency("lrt", "LRT", "Transportasi", ("lrt",)),
    Agency("jasamarga", "Jasa Marga", "Transportasi", ("jasa marga", "jasamarga")),
    # Pemerintah daerah
    Agency("pemprov", "Pemprov / Gubernur", "Pemerintah Daerah", ("pemprov", "gubernur", "balai kota", "balaikota", "pemerintah provinsi")),
    Agency("pemkot", "Pemkot / Pemkab", "Pemerintah Daerah", ("pemkot", "pemkab", "wali kota", "walikota", "bupati", "pemerintah kota", "pemerintah kabupaten")),
    Agency("dprd", "DPRD", "Pemerintah Daerah", ("dprd",)),
    Agency("sda", "Dinas SDA", "Pemerintah Daerah", ("dinas sda", "dinas sumber daya air")),
    Agency("binamarga", "Bina Marga / PUPR", "Pemerintah Daerah", ("bina marga", "pupr", "dinas pu", "kementerian pu")),
    Agency("dlh", "Dinas Lingkungan Hidup", "Pemerintah Daerah", ("dinas lingkungan hidup", "dlh", "sudin lh")),
    Agency("dukcapil", "Dukcapil", "Pemerintah Daerah", ("dukcapil", "disdukcapil")),
    Agency("disdik", "Dinas Pendidikan", "Pemerintah Daerah", ("dinas pendidikan", "disdik")),
    Agency("dinsos", "Dinas Sosial / Kemensos", "Pemerintah Daerah", ("dinsos", "dinas sosial", "kemensos", "kementerian sosial")),
    # Layanan & kesehatan
    Agency("dinkes", "Dinkes / Puskesmas / RSUD", "Layanan & Kesehatan", ("dinkes", "dinas kesehatan", "puskesmas", "rsud")),
    Agency("bpjs", "BPJS", "Layanan & Kesehatan", ("bpjs",)),
    Agency("samsat", "Samsat", "Layanan & Kesehatan", ("samsat",)),
    Agency("bpom", "BPOM", "Layanan & Kesehatan", ("bpom",)),
    # Penegak hukum & lembaga pusat
    Agency("kpk", "KPK", "Penegak Hukum & Pusat", ("kpk", "komisi pemberantasan korupsi")),
    Agency("kejaksaan", "Kejaksaan", "Penegak Hukum & Pusat", ("kejaksaan", "kejati", "kejari", "kejagung")),
    Agency("kpu", "KPU / Bawaslu", "Penegak Hukum & Pusat", ("kpu", "bawaslu")),
)

CATEGORY_BY_ID: Dict[str, Category] = {c.id: c for c in CATEGORIES}
AGENCY_BY_ID: Dict[str, Agency] = {a.id: a for a in AGENCIES}
UNCATEGORIZED = "lainnya"
UNCATEGORIZED_LABEL = "Lainnya"

_HASHTAG_RE = re.compile(r"#([a-z0-9_]+)")


def _compile(terms: Sequence[str]) -> Tuple[re.Pattern, Tuple[str, ...]]:
    alternation = "|".join(re.escape(t.lower()) for t in sorted(terms, key=len, reverse=True))
    word = re.compile(r"(?<![a-z0-9])(?:" + alternation + r")(?![a-z0-9])")
    compact = tuple(re.sub(r"[^a-z0-9]", "", t.lower()) for t in terms if len(re.sub(r"[^a-z0-9]", "", t)) >= 4)
    return word, compact


_CATEGORY_MATCHERS = [(c.id, *_compile(c.keywords)) for c in CATEGORIES]
_AGENCY_MATCHERS = [(a.id, *_compile(a.aliases)) for a in AGENCIES]


def _hits(text_low: str, hashtags: List[str], word: re.Pattern, compact: Tuple[str, ...]) -> int:
    n = len(word.findall(text_low))
    if compact and hashtags:
        n += sum(1 for tag in hashtags for c in compact if c in tag)
    return n


def classify(text: str) -> Tuple[List[str], List[str]]:
    """Kembalikan (id kategori, id instansi), masing-masing diurutkan dari kecocokan terbanyak."""
    low = (text or "").lower()
    tags = [t.replace("_", "") for t in _HASHTAG_RE.findall(low)]

    cat_scores = [(cid, _hits(low, tags, w, c)) for cid, w, c in _CATEGORY_MATCHERS]
    categories = [cid for cid, n in sorted(cat_scores, key=lambda x: -x[1]) if n > 0]

    ag_scores = [(aid, _hits(low, tags, w, c)) for aid, w, c in _AGENCY_MATCHERS]
    agencies = [aid for aid, n in sorted(ag_scores, key=lambda x: -x[1]) if n > 0]

    return categories or [UNCATEGORIZED], agencies


def category_label(cid: str) -> str:
    return CATEGORY_BY_ID[cid].label if cid in CATEGORY_BY_ID else UNCATEGORIZED_LABEL


def agency_label(aid: str) -> str:
    return AGENCY_BY_ID[aid].label if aid in AGENCY_BY_ID else aid


def catalog() -> Dict[str, list]:
    return {
        "categories": [{"id": c.id, "label": c.label} for c in CATEGORIES] + [{"id": UNCATEGORIZED, "label": UNCATEGORIZED_LABEL}],
        "agencies": [{"id": a.id, "label": a.label, "group": a.group} for a in AGENCIES],
    }
