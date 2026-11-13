"""
Geographic Master Service for Indonesia & Pulau Jawa (Fokus Utama).
Compliant with Kemendagri codes and PRD Teknis TIP Media Intelligence.
Supports archipelago overview (38 provinces) and high-resolution Jawa drill-down (DKI, Jabar, Banten, Jateng, DIY, Jatim).
"""

from typing import Dict, List, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
import re

from backend.app.models import RawItem, ItemAnalysis, Issue, Region, Source

# Master 38 Indonesian Provinces (Kemendagri 2-digit Code)
# Pulau Jawa (31, 32, 33, 34, 35, 36) adalah Wilayah Fokus Utama Operasional.
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
    {"kode": "32", "nama": "Jawa Barat", "pulau": "Jawa", "lat": -6.9175, "lng": 107.6191, "is_focus": True},
    {"kode": "33", "nama": "Jawa Tengah", "pulau": "Jawa", "lat": -7.1510, "lng": 110.1403, "is_focus": True},
    {"kode": "34", "nama": "DI Yogyakarta", "pulau": "Jawa", "lat": -7.7956, "lng": 110.3695, "is_focus": True},
    {"kode": "35", "nama": "Jawa Timur", "pulau": "Jawa", "lat": -7.5361, "lng": 112.2384, "is_focus": True},
    {"kode": "36", "nama": "Banten", "pulau": "Jawa", "lat": -6.4058, "lng": 106.0640, "is_focus": True},
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

# Master Kabupaten & Kota di Seluruh Pulau Jawa (DKI, Jabar, Banten, Jateng, DIY, Jatim)
JAWA_REGIONS: List[Dict[str, Any]] = [
    # --- DKI Jakarta ---
    {"kode": "31.71", "nama": "Jakarta Pusat", "jenis": "Kota Administrasi", "provinsi": "DKI Jakarta", "lat": -6.1818, "lng": 106.8223, "aliases": ["jakarta pusat", "jakpus", "menteng", "gambir", "tanah abang", "senen", "cempaka putih", "monas", "kemayoran"]},
    {"kode": "31.72", "nama": "Jakarta Utara", "jenis": "Kota Administrasi", "provinsi": "DKI Jakarta", "lat": -6.1214, "lng": 106.8920, "aliases": ["jakarta utara", "jakut", "tanjung priok", "pluit", "kelapa gading", "penjaringan", "koja", "cilincing", "ancol", "marunda"]},
    {"kode": "31.73", "nama": "Jakarta Barat", "jenis": "Kota Administrasi", "provinsi": "DKI Jakarta", "lat": -6.1683, "lng": 106.7589, "aliases": ["jakarta barat", "jakbar", "kebon jeruk", "grogol", "cengkareng", "kembangan", "kalideres", "palmerah", "tomang"]},
    {"kode": "31.74", "nama": "Jakarta Selatan", "jenis": "Kota Administrasi", "provinsi": "DKI Jakarta", "lat": -6.2615, "lng": 106.8106, "aliases": ["jakarta selatan", "jaksel", "kebayoran baru", "kebayoran lama", "cilandak", "pasar minggu", "mampang", "tebet", "pancoran", "setiabudi", "kemang", "blok m", "senayan"]},
    {"kode": "31.75", "nama": "Jakarta Timur", "jenis": "Kota Administrasi", "provinsi": "DKI Jakarta", "lat": -6.2250, "lng": 106.9004, "aliases": ["jakarta timur", "jaktim", "matraman", "pulo gadung", "jatinegara", "duren sawit", "kramat jati", "pasar rebo", "ciracas", "cipayung", "cakung", "cawang"]},
    {"kode": "31.01", "nama": "Kepulauan Seribu", "jenis": "Kabupaten Administrasi", "provinsi": "DKI Jakarta", "lat": -5.5878, "lng": 106.5540, "aliases": ["kepulauan seribu", "pulau seribu", "pulau pramuka", "pulau tidung", "pulau pari"]},

    # --- Banten & Tangerang Raya ---
    {"kode": "36.71", "nama": "Kota Tangerang", "jenis": "Kota", "provinsi": "Banten", "lat": -6.1783, "lng": 106.6319, "aliases": ["kota tangerang", "tangerang kota", "pemkot tangerang", "cipondoh", "karawaci", "ciledug", "batuceper", "benda", "tangerang"]},
    {"kode": "36.74", "nama": "Kota Tangerang Selatan", "jenis": "Kota", "provinsi": "Banten", "lat": -6.2888, "lng": 106.7179, "aliases": ["tangerang selatan", "tangsel", "bsd", "bsd city", "serpong", "bintaro", "ciputat", "pamulang"]},
    {"kode": "36.03", "nama": "Kabupaten Tangerang", "jenis": "Kabupaten", "provinsi": "Banten", "lat": -6.2088, "lng": 106.4673, "aliases": ["kabupaten tangerang", "kab tangerang", "pemkab tangerang", "tigaraksa", "balaraja", "cikupa", "pasar kemis"]},
    {"kode": "36.73", "nama": "Kota Serang", "jenis": "Kota", "provinsi": "Banten", "lat": -6.1104, "lng": 106.1640, "aliases": ["kota serang", "serang kota", "pemkot serang", "kasemen", "serang"]},
    {"kode": "36.04", "nama": "Kabupaten Serang", "jenis": "Kabupaten", "provinsi": "Banten", "lat": -6.1667, "lng": 105.9833, "aliases": ["kabupaten serang", "kab serang", "ciruas", "kramatwatu", "anyer"]},
    {"kode": "36.72", "nama": "Kota Cilegon", "jenis": "Kota", "provinsi": "Banten", "lat": -6.0022, "lng": 106.0125, "aliases": ["kota cilegon", "cilegon", "merak", "pelabuhan merak"]},
    {"kode": "36.02", "nama": "Kabupaten Lebak", "jenis": "Kabupaten", "provinsi": "Banten", "lat": -6.6500, "lng": 106.2167, "aliases": ["kabupaten lebak", "lebak", "rangkasbitung"]},
    {"kode": "36.01", "nama": "Kabupaten Pandeglang", "jenis": "Kabupaten", "provinsi": "Banten", "lat": -6.3083, "lng": 106.1067, "aliases": ["kabupaten pandeglang", "pandeglang", "labuan", "panimbang"]},

    # --- Jawa Barat (Bodetabek + Priangan & Pantura) ---
    {"kode": "32.71", "nama": "Kota Bogor", "jenis": "Kota", "provinsi": "Jawa Barat", "lat": -6.5971, "lng": 106.8060, "aliases": ["kota bogor", "bogor kota", "pemkot bogor", "polresta bogor", "stasiun bogor", "alun-alun bogor", "kebun raya bogor", "bogor tengah", "bogor selatan", "bogor timur", "bogor utara", "bogor barat"]},
    {"kode": "32.01", "nama": "Kabupaten Bogor", "jenis": "Kabupaten", "provinsi": "Jawa Barat", "lat": -6.4797, "lng": 106.8247, "aliases": ["kabupaten bogor", "kab bogor", "pemkab bogor", "cibinong", "cileungsi", "gunung putri", "puncak", "ciawi", "bojonggede", "parung", "sentul"]},
    {"kode": "32.76", "nama": "Kota Depok", "jenis": "Kota", "provinsi": "Jawa Barat", "lat": -6.4025, "lng": 106.7942, "aliases": ["depok", "kota depok", "margonda", "sawangan", "cimanggis", "pancoran mas", "sukmajaya", "cinere"]},
    {"kode": "32.75", "nama": "Kota Bekasi", "jenis": "Kota", "provinsi": "Jawa Barat", "lat": -6.2383, "lng": 106.9756, "aliases": ["kota bekasi", "bekasi kota", "pemkot bekasi", "bekasi barat", "bekasi timur", "bekasi selatan", "bekasi utara", "rawalumbu", "pondok gede", "kranji", "bekasi"]},
    {"kode": "32.16", "nama": "Kabupaten Bekasi", "jenis": "Kabupaten", "provinsi": "Jawa Barat", "lat": -6.2415, "lng": 107.0988, "aliases": ["kabupaten bekasi", "kab bekasi", "pemkab bekasi", "cikarang", "tambun", "cibitung", "sukatani"]},
    {"kode": "32.73", "nama": "Kota Bandung", "jenis": "Kota", "provinsi": "Jawa Barat", "lat": -6.9175, "lng": 107.6191, "aliases": ["kota bandung", "bandung kota", "pemkot bandung", "dago", "gedebage", "pasteur", "asia afrika", "bandung"]},
    {"kode": "32.04", "nama": "Kabupaten Bandung", "jenis": "Kabupaten", "provinsi": "Jawa Barat", "lat": -7.0253, "lng": 107.5198, "aliases": ["kabupaten bandung", "kab bandung", "pemkab bandung", "soreang", "ciwidey", "rancaekek", "baleendah"]},
    {"kode": "32.77", "nama": "Kota Cimahi", "jenis": "Kota", "provinsi": "Jawa Barat", "lat": -6.8722, "lng": 107.5422, "aliases": ["kota cimahi", "cimahi"]},
    {"kode": "32.17", "nama": "Kabupaten Bandung Barat", "jenis": "Kabupaten", "provinsi": "Jawa Barat", "lat": -6.8431, "lng": 107.4942, "aliases": ["kabupaten bandung barat", "bandung barat", "padalarang", "ngamprah", "lembang"]},
    {"kode": "32.15", "nama": "Kabupaten Karawang", "jenis": "Kabupaten", "provinsi": "Jawa Barat", "lat": -6.3050, "lng": 107.3000, "aliases": ["kabupaten karawang", "karawang", "cikampek", "klari"]},
    {"kode": "32.14", "nama": "Kabupaten Purwakarta", "jenis": "Kabupaten", "provinsi": "Jawa Barat", "lat": -6.5389, "lng": 107.4439, "aliases": ["kabupaten purwakarta", "purwakarta", "sadang", "jatiluhur"]},
    {"kode": "32.13", "nama": "Kabupaten Subang", "jenis": "Kabupaten", "provinsi": "Jawa Barat", "lat": -6.5683, "lng": 107.7583, "aliases": ["kabupaten subang", "subang", "patimban", "kalijati"]},
    {"kode": "32.74", "nama": "Kota Cirebon", "jenis": "Kota", "provinsi": "Jawa Barat", "lat": -6.7063, "lng": 108.5570, "aliases": ["kota cirebon", "cirebon kota", "kesambi", "kejaksan", "cirebon"]},
    {"kode": "32.09", "nama": "Kabupaten Cirebon", "jenis": "Kabupaten", "provinsi": "Jawa Barat", "lat": -6.7589, "lng": 108.4811, "aliases": ["kabupaten cirebon", "kab cirebon", "sumber", "plered"]},
    {"kode": "32.72", "nama": "Kota Sukabumi", "jenis": "Kota", "provinsi": "Jawa Barat", "lat": -6.9277, "lng": 106.9299, "aliases": ["kota sukabumi", "sukabumi kota", "sukabumi"]},
    {"kode": "32.02", "nama": "Kabupaten Sukabumi", "jenis": "Kabupaten", "provinsi": "Jawa Barat", "lat": -6.9850, "lng": 106.7550, "aliases": ["kabupaten sukabumi", "kab sukabumi", "pelabuhan ratu", "palabuhanratu", "cibadak"]},
    {"kode": "32.78", "nama": "Kota Tasikmalaya", "jenis": "Kota", "provinsi": "Jawa Barat", "lat": -7.3274, "lng": 108.2207, "aliases": ["kota tasikmalaya", "tasikmalaya kota", "tasikmalaya", "tasik"]},
    {"kode": "32.05", "nama": "Kabupaten Garut", "jenis": "Kabupaten", "provinsi": "Jawa Barat", "lat": -7.2167, "lng": 107.9000, "aliases": ["kabupaten garut", "garut", "tarogong"]},
    {"kode": "32.03", "nama": "Kabupaten Cianjur", "jenis": "Kabupaten", "provinsi": "Jawa Barat", "lat": -6.8167, "lng": 107.1333, "aliases": ["kabupaten cianjur", "cianjur", "cipanas"]},

    # --- Jawa Tengah & DI Yogyakarta ---
    {"kode": "33.74", "nama": "Kota Semarang", "jenis": "Kota", "provinsi": "Jawa Tengah", "lat": -6.9932, "lng": 110.4203, "aliases": ["kota semarang", "semarang kota", "simpang lima", "tembalang", "banyumanik", "tugu muda", "semarang"]},
    {"kode": "33.22", "nama": "Kabupaten Semarang", "jenis": "Kabupaten", "provinsi": "Jawa Tengah", "lat": -7.1408, "lng": 110.4061, "aliases": ["kabupaten semarang", "kab semarang", "ungaran", "ambarawa"]},
    {"kode": "33.72", "nama": "Kota Surakarta (Solo)", "jenis": "Kota", "provinsi": "Jawa Tengah", "lat": -7.5667, "lng": 110.8167, "aliases": ["surakarta", "solo", "kota solo", "laweyan", "jebres", "manahan"]},
    {"kode": "33.71", "nama": "Kota Magelang", "jenis": "Kota", "provinsi": "Jawa Tengah", "lat": -7.4833, "lng": 110.2167, "aliases": ["kota magelang", "magelang kota"]},
    {"kode": "33.73", "nama": "Kota Salatiga", "jenis": "Kota", "provinsi": "Jawa Tengah", "lat": -7.3306, "lng": 110.5083, "aliases": ["kota salatiga", "salatiga"]},
    {"kode": "33.75", "nama": "Kota Pekalongan", "jenis": "Kota", "provinsi": "Jawa Tengah", "lat": -6.8886, "lng": 109.6753, "aliases": ["kota pekalongan", "pekalongan"]},
    {"kode": "33.76", "nama": "Kota Tegal", "jenis": "Kota", "provinsi": "Jawa Tengah", "lat": -6.8667, "lng": 109.1333, "aliases": ["kota tegal", "tegal kota"]},
    {"kode": "33.02", "nama": "Kabupaten Banyumas (Purwokerto)", "jenis": "Kabupaten", "provinsi": "Jawa Tengah", "lat": -7.4500, "lng": 109.1667, "aliases": ["purwokerto", "kabupaten banyumas", "banyumas"]},
    {"kode": "33.01", "nama": "Kabupaten Cilacap", "jenis": "Kabupaten", "provinsi": "Jawa Tengah", "lat": -7.7167, "lng": 109.0167, "aliases": ["kabupaten cilacap", "cilacap"]},
    {"kode": "33.29", "nama": "Kabupaten Brebes", "jenis": "Kabupaten", "provinsi": "Jawa Tengah", "lat": -6.8667, "lng": 109.0333, "aliases": ["kabupaten brebes", "brebes"]},
    {"kode": "33.19", "nama": "Kabupaten Kudus", "jenis": "Kabupaten", "provinsi": "Jawa Tengah", "lat": -6.8048, "lng": 110.8406, "aliases": ["kabupaten kudus", "kudus"]},
    {"kode": "34.71", "nama": "Kota Yogyakarta", "jenis": "Kota", "provinsi": "DI Yogyakarta", "lat": -7.7956, "lng": 110.3695, "aliases": ["kota yogyakarta", "jogja", "yogyakarta kota", "malioboro", "kraton jogja"]},
    {"kode": "34.04", "nama": "Kabupaten Sleman", "jenis": "Kabupaten", "provinsi": "DI Yogyakarta", "lat": -7.7167, "lng": 110.3500, "aliases": ["kabupaten sleman", "sleman", "kaliurang", "depok sleman"]},
    {"kode": "34.02", "nama": "Kabupaten Bantul", "jenis": "Kabupaten", "provinsi": "DI Yogyakarta", "lat": -7.8833, "lng": 110.3333, "aliases": ["kabupaten bantul", "bantul", "parangtritis"]},

    # --- Jawa Timur ---
    {"kode": "35.78", "nama": "Kota Surabaya", "jenis": "Kota", "provinsi": "Jawa Timur", "lat": -7.2575, "lng": 112.7521, "aliases": ["kota surabaya", "surabaya", "gubeng", "wonokromo", "rungkut", "kenjeran", "tunjungan"]},
    {"kode": "35.15", "nama": "Kabupaten Sidoarjo", "jenis": "Kabupaten", "provinsi": "Jawa Timur", "lat": -7.4478, "lng": 112.7183, "aliases": ["kabupaten sidoarjo", "sidoarjo", "waru", "porong", "juanda"]},
    {"kode": "35.25", "nama": "Kabupaten Gresik", "jenis": "Kabupaten", "provinsi": "Jawa Timur", "lat": -7.1564, "lng": 112.6555, "aliases": ["kabupaten gresik", "gresik", "manyar"]},
    {"kode": "35.73", "nama": "Kota Malang", "jenis": "Kota", "provinsi": "Jawa Timur", "lat": -7.9797, "lng": 112.6304, "aliases": ["kota malang", "malang kota", "ijen", "suhat", "lowokwaru"]},
    {"kode": "35.07", "nama": "Kabupaten Malang", "jenis": "Kabupaten", "provinsi": "Jawa Timur", "lat": -8.1667, "lng": 112.6667, "aliases": ["kabupaten malang", "kepanjen", "singosari"]},
    {"kode": "35.79", "nama": "Kota Batu", "jenis": "Kota", "provinsi": "Jawa Timur", "lat": -7.8671, "lng": 112.5239, "aliases": ["kota batu", "batu malang"]},
    {"kode": "35.71", "nama": "Kota Kediri", "jenis": "Kota", "provinsi": "Jawa Timur", "lat": -7.8167, "lng": 112.0167, "aliases": ["kota kediri", "kediri kota"]},
    {"kode": "35.77", "nama": "Kota Madiun", "jenis": "Kota", "provinsi": "Jawa Timur", "lat": -7.6298, "lng": 111.5239, "aliases": ["kota madiun", "madiun"]},
    {"kode": "35.09", "nama": "Kabupaten Jember", "jenis": "Kabupaten", "provinsi": "Jawa Timur", "lat": -8.1724, "lng": 113.7007, "aliases": ["kabupaten jember", "jember"]},
    {"kode": "35.10", "nama": "Kabupaten Banyuwangi", "jenis": "Kabupaten", "provinsi": "Jawa Timur", "lat": -8.2192, "lng": 114.3691, "aliases": ["kabupaten banyuwangi", "banyuwangi", "ketapang"]},
]

# Alias backward compatibility
JABODETABEK_REGIONS = JAWA_REGIONS


def _detect_channel_info(penerbit: str, url: str) -> tuple[str, str]:
    """Mengidentifikasi tipe saluran ('berita' vs 'sosmed') dan nama platform/penerbit resmi."""
    url_low = (url or "").lower()
    pen_low = (penerbit or "").lower()

    # Saluran Media Sosial
    if "tiktok.com" in url_low or "tiktok" in pen_low:
        return "sosmed", "TikTok"
    if "x.com" in url_low or "twitter.com" in url_low or "twitter" in pen_low:
        return "sosmed", "X (Twitter)"
    if "threads.net" in url_low or "threads.com" in url_low or "threads" in pen_low:
        return "sosmed", "Threads"
    if "bsky.app" in url_low or "bluesky" in pen_low:
        return "sosmed", "Bluesky"
    if any(s in url_low for s in ("instagram.com", "facebook.com", "youtube.com")):
        return "sosmed", "Media Sosial"

    # Saluran Berita & Kanal Resmi Pemerintah
    if "detik.com" in url_low or "detikcom" in pen_low or "detik" in pen_low:
        return "berita", "Detikcom"
    if "antaranews.com" in url_low or "antara" in pen_low:
        return "berita", "ANTARA News"
    if "cnnindonesia.com" in url_low or "cnn indonesia" in pen_low:
        return "berita", "CNN Indonesia"
    if "dishub" in url_low or "dishub" in pen_low:
        return "berita", "Dishub DKI Jakarta"
    if "bmkg.go.id" in url_low or "bmkg" in pen_low:
        return "berita", "BMKG"
    if "kompas.com" in url_low or "kompas" in pen_low:
        return "berita", "Kompas"
    if "tempo.co" in url_low or "tempo" in pen_low:
        return "berita", "Tempo"

    return "berita", penerbit or "Media Berita"


def _categorize_issue_topic(title: str, body: str, raw_topic: str) -> str:
    """Mengelompokkan teks ke dalam Kategori Masalah Utama untuk Pill Filters."""
    text = f"{title} {body}".lower()

    if any(w in text for w in ("macet", "lalin", "lalu lintas", "kemacetan", "tol", "dishub", "tilang", "rekayasa lalu lintas", "contraflow", "busway")):
        return "Lalu Lintas & Macet"
    if any(w in text for w in ("banjir", "genangan", "rob", "hujan deras", "luapan", "kali", "tanggul", "bmkg", "cuaca ekstrem", "angin kencang")):
        return "Banjir & Cuaca"
    if any(w in text for w in ("tppo", "jambret", "begal", "tawuran", "pencurian", "polda", "polres", "polisi", "kriminal", "narkoba", "senpi", "curanmor")):
        return "Keamanan & Kriminalitas"
    if any(w in text for w in ("tarif", "samsat", "layanan", "disdukcapil", "pajak", "ktp", "pelayanan publik", "puskesmas", "pungli", "birokrasi")):
        return "Pelayanan Publik"
    if any(w in text for w in ("jalan rusak", "jembatan", "lubang", "aspal", "trotoar", "lampu jalan", "proyek galian", "pdam", "pipa bocor", "pln padam")):
        return "Infrastruktur & Jalan"
    if any(w in text for w in ("polusi", "udara", "sampah", "tpa", "limbah", "bau", "kesehatan", "dbd", "ispa", "lingkungan")):
        return "Kesehatan & Lingkungan"
    if any(w in text for w in ("bansos", "sembako", "demo", "unjuk rasa", "pedagang", "pasar", "penggusuran", "warga", "keluhan")):
        return "Sosial & Warga"

    return raw_topic or "Umum"


_REGION_PATTERNS: Dict[str, List[re.Pattern]] = {}


def _text_matches_region(text: str, region: Dict[str, Any]) -> bool:
    """Cocokkan teks dengan alias wilayah memakai batas kata agar kata pendek tidak salah cocok."""
    code = region["kode"]
    patterns = _REGION_PATTERNS.get(code)
    if patterns is None:
        patterns = [re.compile(r"\b" + re.escape(a.lower()) + r"\b") for a in region["aliases"]]
        _REGION_PATTERNS[code] = patterns
    if not any(p.search(text) for p in patterns):
        return False

    # Disambiguasi Kota vs Kabupaten yang berbagi nama dasar (mis. Bandung, Tangerang, Bekasi, Serang, Cirebon, Sukabumi)
    if code == "32.73" and ("kabupaten bandung" in text or "kab bandung" in text or "bandung barat" in text):
        return "kota bandung" in text or "bandung kota" in text or "pemkot bandung" in text
    if code == "36.71" and ("tangerang selatan" in text or "tangsel" in text or "kabupaten tangerang" in text or "kab tangerang" in text):
        return "kota tangerang" in text or "tangerang kota" in text or "pemkot tangerang" in text
    if code == "32.75" and ("kabupaten bekasi" in text or "kab bekasi" in text or "cikarang" in text):
        return "kota bekasi" in text or "bekasi kota" in text or "pemkot bekasi" in text
    if code == "36.73" and ("kabupaten serang" in text or "kab serang" in text or "anyer" in text):
        return "kota serang" in text or "serang kota" in text or "pemkot serang" in text
    if code == "32.74" and ("kabupaten cirebon" in text or "kab cirebon" in text):
        return "kota cirebon" in text or "cirebon kota" in text
    if code == "32.72" and ("kabupaten sukabumi" in text or "kab sukabumi" in text):
        return "kota sukabumi" in text or "sukabumi kota" in text
    return True


def get_indonesia_geo_overview(db: Session) -> Dict[str, Any]:
    """
    Returns Indonesia Archipelago geospatial overview with Pulau Jawa as the core focus.
    """
    now = datetime.utcnow()
    since_window = now - timedelta(days=7)

    # Ambil item 7 hari terakhir agar sebaran wilayah Jawa tetap kaya & akurat
    recent_items = (
        db.query(RawItem)
        .filter(RawItem.published_at >= since_window)
        .order_by(RawItem.published_at.desc())
        .all()
    )
    if len(recent_items) < 100:
        recent_items = db.query(RawItem).order_by(RawItem.published_at.desc()).limit(500).all()

    region_metrics: Dict[str, Dict[str, Any]] = {}
    for r in JAWA_REGIONS:
        region_metrics[r["kode"]] = {
            "kode": r["kode"],
            "nama": r["nama"],
            "jenis": r["jenis"],
            "provinsi": r["provinsi"],
            "lat": r["lat"],
            "lng": r["lng"],
            "mention_count": 0,
            "negative_count": 0,
            "sosmed_count": 0,
            "berita_count": 0,
            "topics": {},
            "categories": {},
            "threat_level": "rendah",
            "heat_intensity": 0.1,
            "top_issue_title": None,
        }

    for item in recent_items:
        # Filter out Bluesky (dinonaktifkan)
        if "bsky.app" in (item.url_kanonik or "").lower() or "bluesky" in (item.penerbit or "").lower():
            continue
        text = f"{item.judul} {item.isi or ''}".lower()
        analysis = item.analysis
        ch_type, _ = _detect_channel_info(item.penerbit, item.url_kanonik)

        for r in JAWA_REGIONS:
            code = r["kode"]
            matched = _text_matches_region(text, r)
            if matched:
                rm = region_metrics[code]
                rm["mention_count"] += 1
                if ch_type == "sosmed":
                    rm["sosmed_count"] += 1
                else:
                    rm["berita_count"] += 1

                if analysis:
                    if (analysis.sentimen or "").lower() in ("negatif", "negative"):
                        rm["negative_count"] += 1
                    topic = analysis.topik or "Umum"
                    rm["topics"][topic] = rm["topics"].get(topic, 0) + 1

                cat = _categorize_issue_topic(item.judul, item.isi or "", analysis.topik if analysis else "")
                rm["categories"][cat] = rm["categories"].get(cat, 0) + 1

    # Calculate threat level and heat intensity
    for rm in region_metrics.values():
        mentions = rm["mention_count"]
        negatives = rm["negative_count"]
        neg_pct = (negatives / mentions * 100) if mentions > 0 else 0

        if mentions >= 10 or (mentions >= 5 and neg_pct >= 40):
            rm["threat_level"] = "kritis"
            rm["heat_intensity"] = min(1.0, 0.7 + (mentions * 0.03))
        elif mentions >= 5 or (mentions >= 3 and neg_pct >= 30):
            rm["threat_level"] = "tinggi"
            rm["heat_intensity"] = min(0.7, 0.45 + (mentions * 0.04))
        elif mentions >= 1:
            rm["threat_level"] = "waspada"
            rm["heat_intensity"] = min(0.45, 0.25 + (mentions * 0.03))
        else:
            rm["threat_level"] = "rendah"
            rm["heat_intensity"] = 0.1

    # Match priority issues (scan all issues sorted by score so every region gets its top issue)
    recent_issues = db.query(Issue).order_by(Issue.skor.desc()).all()
    for iss in recent_issues:
        iss_text = f"{iss.judul} {iss.ringkasan or ''}".lower()
        for rm in region_metrics.values():
            if not rm["top_issue_title"]:
                r_obj = next((x for x in JAWA_REGIONS if x["kode"] == rm["kode"]), None)
                if r_obj and _text_matches_region(iss_text, r_obj):
                    rm["top_issue_title"] = iss.judul

    # Assemble provinces
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
            "status": "Fokus Utama (Pulau Jawa)" if is_focus else "Fase 2 - Belum Menjadi Fokus",
            "keterangan": "Wilayah pemantauan live media intelligence & sosmed Jawa." if is_focus else "Wilayah Nusantara tahap ekspansi berikutnya (tampil proporsional).",
        }
        provinces_payload.append(prov_data)

    return {
        "status": "success",
        "focus_area": "Pulau Jawa (DKI Jakarta, Jawa Barat, Banten, Jawa Tengah, DI Yogyakarta, Jawa Timur)",
        "provinces": provinces_payload,
        "jawa_regions": list(region_metrics.values()),
        "jabodetabek_regions": list(region_metrics.values()),  # Backward compatibility
        "total_provinces": len(provinces_payload),
        "total_active_regions": len(region_metrics),
        "generated_at": now.isoformat(),
    }


def get_region_detail_and_issues(db: Session, kode_wilayah: str) -> Dict[str, Any]:
    """
    Drill down into a specific regency/city on Java by Kemendagri code.
    Returns matched issues, real news articles, social media posts, trends, and category breakdown.
    """
    region_info = next((r for r in JAWA_REGIONS if r["kode"] == kode_wilayah), None)
    if not region_info:
        # Check if province
        prov_info = next((p for p in INDONESIA_PROVINCES if p["kode"] == kode_wilayah), None)
        if prov_info:
            return {
                "kode": prov_info["kode"],
                "nama": prov_info["nama"],
                "is_focus": prov_info["is_focus"],
                "status": "Fokus Utama (Pulau Jawa)" if prov_info["is_focus"] else "Fase 2 - Belum Menjadi Fokus",
                "pesan": "Wilayah aktif pemantauan." if prov_info["is_focus"] else "Wilayah ini belum masuk fase monitoring live Jawa.",
                "issues": [],
                "recent_articles": [],
                "media_items": [],
                "categories": {},
            }
        return {"error": f"Wilayah dengan kode {kode_wilayah} tidak ditemukan."}

    aliases = region_info["aliases"]

    # Find matching recent raw items (both news and social media)
    items = db.query(RawItem).order_by(RawItem.published_at.desc()).limit(1000).all()
    matched_items = []
    category_counts: Dict[str, int] = {
        "Semua Masalah": 0,
        "Lalu Lintas & Macet": 0,
        "Banjir & Cuaca": 0,
        "Keamanan & Kriminalitas": 0,
        "Pelayanan Publik": 0,
        "Infrastruktur & Jalan": 0,
        "Kesehatan & Lingkungan": 0,
        "Sosial & Warga": 0,
    }
    sentimen_counts = {"positif": 0, "netral": 0, "negatif": 0}
    total_sosmed = 0
    total_berita = 0

    for item in items:
        # Filter out Bluesky (dinonaktifkan)
        if "bsky.app" in (item.url_kanonik or "").lower() or "bluesky" in (item.penerbit or "").lower():
            continue

        text = f"{item.judul} {item.isi or ''}".lower()
        if _text_matches_region(text, region_info):
            analysis = item.analysis
            ch_type, platform_name = _detect_channel_info(item.penerbit, item.url_kanonik)
            if ch_type == "sosmed":
                total_sosmed += 1
            else:
                total_berita += 1

            sent = (analysis.sentimen if analysis else "netral").lower()
            if "neg" in sent:
                sentimen_counts["negatif"] += 1
            elif "pos" in sent:
                sentimen_counts["positif"] += 1
            else:
                sentimen_counts["netral"] += 1

            cat = _categorize_issue_topic(item.judul, item.isi or "", analysis.topik if analysis else "")
            category_counts["Semua Masalah"] += 1
            if cat in category_counts:
                category_counts[cat] += 1
            else:
                category_counts[cat] = 1

            # Format penulis & penerbit bersih agar logo dan teks tampil rapi
            display_penulis = item.penulis
            if not display_penulis or "google" in display_penulis.lower() or "site:" in display_penulis.lower():
                display_penulis = platform_name

            clean_penerbit = platform_name if ch_type == "sosmed" else (item.penerbit or platform_name)

            matched_items.append({
                "id": item.id,
                "judul": item.judul,
                "url": item.url_kanonik,
                "penerbit": clean_penerbit,
                "penulis": display_penulis,
                "channel_type": ch_type,  # 'berita' | 'sosmed'
                "platform": platform_name,
                "published_at": item.published_at.isoformat() if item.published_at else None,
                "sentimen": analysis.sentimen if analysis else "netral",
                "topik": analysis.topik if analysis else "Umum",
                "kategori_masalah": cat,
                "ringkasan": analysis.ringkasan if analysis else item.judul,
            })

    # Find matching issues
    all_issues = db.query(Issue).order_by(Issue.skor.desc()).all()
    matched_issues = []
    for iss in all_issues:
        iss_text = f"{iss.judul} {iss.ringkasan or ''}".lower()
        if _text_matches_region(iss_text, region_info):
            cat = _categorize_issue_topic(iss.judul, iss.ringkasan or "", iss.kategori or "")
            matched_issues.append({
                "id": iss.id,
                "judul": iss.judul,
                "status": iss.status,
                "kategori": iss.kategori,
                "kategori_masalah": cat,
                "tingkat_bahaya": iss.level.lower() if iss.level else "medium",
                "skor": iss.skor,
                "ringkasan": iss.ringkasan,
                "volume_24jam": iss.current_volume,
            })

    # Volume trend calculation
    total_mentions = len(matched_items)
    neg_pct = round((sentimen_counts["negatif"] / total_mentions * 100), 1) if total_mentions > 0 else 0.0
    trend_direction = "naik" if neg_pct >= 35 or total_mentions >= 8 else ("stabil" if total_mentions >= 2 else "kondusif")

    return {
        "kode": region_info["kode"],
        "nama": region_info["nama"],
        "jenis": region_info["jenis"],
        "provinsi": region_info["provinsi"],
        "lat": region_info["lat"],
        "lng": region_info["lng"],
        "is_focus": True,
        "total_articles": total_mentions,
        "total_berita": total_berita,
        "total_sosmed": total_sosmed,
        "total_issues": len(matched_issues),
        "trend": {
            "direction": trend_direction,
            "negatif_pct": neg_pct,
            "sentimen": sentimen_counts,
        },
        "category_counts": category_counts,
        "issues": matched_issues,
        "recent_articles": matched_items[:25],
        "media_items": matched_items[:30],
    }
