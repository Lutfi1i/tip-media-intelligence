"""Master Administrative Hierarchy & Geographic Query Expansion Service.

Menerapkan hierarki administrasi resmi Kemendagri:
Indonesia -> Provinsi -> Kabupaten/Kota -> Kecamatan -> Kelurahan/Desa.
Mendukung pencarian hierarkis, ekspansi query entitas lokal, dan deteksi konteks geografis
untuk modul RADAR Social Pulse.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Tuple

# Master data provinsi Indonesia (38 Provinsi Kemendagri)
PROVINCES_DATA = [
    {"kode": "11", "nama": "Aceh", "pulau": "Sumatera"},
    {"kode": "12", "nama": "Sumatera Utara", "pulau": "Sumatera"},
    {"kode": "13", "nama": "Sumatera Barat", "pulau": "Sumatera"},
    {"kode": "14", "nama": "Riau", "pulau": "Sumatera"},
    {"kode": "15", "nama": "Jambi", "pulau": "Sumatera"},
    {"kode": "16", "nama": "Sumatera Selatan", "pulau": "Sumatera"},
    {"kode": "17", "nama": "Bengkulu", "pulau": "Sumatera"},
    {"kode": "18", "nama": "Lampung", "pulau": "Sumatera"},
    {"kode": "19", "nama": "Kepulauan Bangka Belitung", "pulau": "Sumatera"},
    {"kode": "21", "nama": "Kepulauan Riau", "pulau": "Sumatera"},
    {"kode": "31", "nama": "DKI Jakarta", "pulau": "Jawa"},
    {"kode": "32", "nama": "Jawa Barat", "pulau": "Jawa"},
    {"kode": "33", "nama": "Jawa Tengah", "pulau": "Jawa"},
    {"kode": "34", "nama": "DI Yogyakarta", "pulau": "Jawa"},
    {"kode": "35", "nama": "Jawa Timur", "pulau": "Jawa"},
    {"kode": "36", "nama": "Banten", "pulau": "Jawa"},
    {"kode": "51", "nama": "Bali", "pulau": "Bali & Nusa Tenggara"},
    {"kode": "52", "nama": "Nusa Tenggara Barat", "pulau": "Bali & Nusa Tenggara"},
    {"kode": "53", "nama": "Nusa Tenggara Timur", "pulau": "Bali & Nusa Tenggara"},
    {"kode": "61", "nama": "Kalimantan Barat", "pulau": "Kalimantan"},
    {"kode": "62", "nama": "Kalimantan Tengah", "pulau": "Kalimantan"},
    {"kode": "63", "nama": "Kalimantan Selatan", "pulau": "Kalimantan"},
    {"kode": "64", "nama": "Kalimantan Timur", "pulau": "Kalimantan"},
    {"kode": "65", "nama": "Kalimantan Utara", "pulau": "Kalimantan"},
    {"kode": "71", "nama": "Sulawesi Utara", "pulau": "Sulawesi"},
    {"kode": "72", "nama": "Sulawesi Tengah", "pulau": "Sulawesi"},
    {"kode": "73", "nama": "Sulawesi Selatan", "pulau": "Sulawesi"},
    {"kode": "74", "nama": "Sulawesi Tenggara", "pulau": "Sulawesi"},
    {"kode": "75", "nama": "Gorontalo", "pulau": "Sulawesi"},
    {"kode": "76", "nama": "Sulawesi Barat", "pulau": "Sulawesi"},
    {"kode": "81", "nama": "Maluku", "pulau": "Maluku"},
    {"kode": "82", "nama": "Maluku Utara", "pulau": "Maluku"},
    {"kode": "91", "nama": "Papua Barat", "pulau": "Papua"},
    {"kode": "92", "nama": "Papua", "pulau": "Papua"},
    {"kode": "93", "nama": "Papua Selatan", "pulau": "Papua"},
    {"kode": "94", "nama": "Papua Tengah", "pulau": "Papua"},
    {"kode": "95", "nama": "Papua Pegunungan", "pulau": "Papua"},
    {"kode": "96", "nama": "Papua Barat Daya", "pulau": "Papua"},
]

# Master Kabupaten / Kota (Fokus Jawa & Bodetabek)
KABUPATEN_DATA = [
    # Jawa Barat (32)
    {"kode": "32.01", "nama": "Kabupaten Bogor", "provinsi_kode": "32", "provinsi_nama": "Jawa Barat", "tipe": "Kabupaten"},
    {"kode": "32.71", "nama": "Kota Bogor", "provinsi_kode": "32", "provinsi_nama": "Jawa Barat", "tipe": "Kota"},
    {"kode": "32.76", "nama": "Kota Depok", "provinsi_kode": "32", "provinsi_nama": "Jawa Barat", "tipe": "Kota"},
    {"kode": "32.75", "nama": "Kota Bekasi", "provinsi_kode": "32", "provinsi_nama": "Jawa Barat", "tipe": "Kota"},
    {"kode": "32.16", "nama": "Kabupaten Bekasi", "provinsi_kode": "32", "provinsi_nama": "Jawa Barat", "tipe": "Kabupaten"},
    {"kode": "32.73", "nama": "Kota Bandung", "provinsi_kode": "32", "provinsi_nama": "Jawa Barat", "tipe": "Kota"},
    {"kode": "32.04", "nama": "Kabupaten Bandung", "provinsi_kode": "32", "provinsi_nama": "Jawa Barat", "tipe": "Kabupaten"},
    {"kode": "32.17", "nama": "Kabupaten Bandung Barat", "provinsi_kode": "32", "provinsi_nama": "Jawa Barat", "tipe": "Kabupaten"},
    {"kode": "32.77", "nama": "Kota Cimahi", "provinsi_kode": "32", "provinsi_nama": "Jawa Barat", "tipe": "Kota"},
    {"kode": "32.15", "nama": "Kabupaten Karawang", "provinsi_kode": "32", "provinsi_nama": "Jawa Barat", "tipe": "Kabupaten"},
    {"kode": "32.14", "nama": "Kabupaten Purwakarta", "provinsi_kode": "32", "provinsi_nama": "Jawa Barat", "tipe": "Kabupaten"},
    {"kode": "32.13", "nama": "Kabupaten Subang", "provinsi_kode": "32", "provinsi_nama": "Jawa Barat", "tipe": "Kabupaten"},
    {"kode": "32.72", "nama": "Kota Sukabumi", "provinsi_kode": "32", "provinsi_nama": "Jawa Barat", "tipe": "Kota"},
    {"kode": "32.02", "nama": "Kabupaten Sukabumi", "provinsi_kode": "32", "provinsi_nama": "Jawa Barat", "tipe": "Kabupaten"},
    {"kode": "32.03", "nama": "Kabupaten Cianjur", "provinsi_kode": "32", "provinsi_nama": "Jawa Barat", "tipe": "Kabupaten"},
    {"kode": "32.74", "nama": "Kota Cirebon", "provinsi_kode": "32", "provinsi_nama": "Jawa Barat", "tipe": "Kota"},
    {"kode": "32.09", "nama": "Kabupaten Cirebon", "provinsi_kode": "32", "provinsi_nama": "Jawa Barat", "tipe": "Kabupaten"},
    {"kode": "32.05", "nama": "Kabupaten Garut", "provinsi_kode": "32", "provinsi_nama": "Jawa Barat", "tipe": "Kabupaten"},
    {"kode": "32.78", "nama": "Kota Tasikmalaya", "provinsi_kode": "32", "provinsi_nama": "Jawa Barat", "tipe": "Kota"},

    # DKI Jakarta (31)
    {"kode": "31.71", "nama": "Jakarta Pusat", "provinsi_kode": "31", "provinsi_nama": "DKI Jakarta", "tipe": "Kota Administrasi"},
    {"kode": "31.72", "nama": "Jakarta Utara", "provinsi_kode": "31", "provinsi_nama": "DKI Jakarta", "tipe": "Kota Administrasi"},
    {"kode": "31.73", "nama": "Jakarta Barat", "provinsi_kode": "31", "provinsi_nama": "DKI Jakarta", "tipe": "Kota Administrasi"},
    {"kode": "31.74", "nama": "Jakarta Selatan", "provinsi_kode": "31", "provinsi_nama": "DKI Jakarta", "tipe": "Kota Administrasi"},
    {"kode": "31.75", "nama": "Jakarta Timur", "provinsi_kode": "31", "provinsi_nama": "DKI Jakarta", "tipe": "Kota Administrasi"},
    {"kode": "31.01", "nama": "Kepulauan Seribu", "provinsi_kode": "31", "provinsi_nama": "DKI Jakarta", "tipe": "Kabupaten Administrasi"},

    # Banten (36)
    {"kode": "36.71", "nama": "Kota Tangerang", "provinsi_kode": "36", "provinsi_nama": "Banten", "tipe": "Kota"},
    {"kode": "36.74", "nama": "Kota Tangerang Selatan", "provinsi_kode": "36", "provinsi_nama": "Banten", "tipe": "Kota"},
    {"kode": "36.03", "nama": "Kabupaten Tangerang", "provinsi_kode": "36", "provinsi_nama": "Banten", "tipe": "Kabupaten"},
    {"kode": "36.73", "nama": "Kota Serang", "provinsi_kode": "36", "provinsi_nama": "Banten", "tipe": "Kota"},
    {"kode": "36.04", "nama": "Kabupaten Serang", "provinsi_kode": "36", "provinsi_nama": "Banten", "tipe": "Kabupaten"},
    {"kode": "36.72", "nama": "Kota Cilegon", "provinsi_kode": "36", "provinsi_nama": "Banten", "tipe": "Kota"},

    # Jawa Tengah & DIY (33 & 34)
    {"kode": "33.74", "nama": "Kota Semarang", "provinsi_kode": "33", "provinsi_nama": "Jawa Tengah", "tipe": "Kota"},
    {"kode": "33.72", "nama": "Kota Surakarta (Solo)", "provinsi_kode": "33", "provinsi_nama": "Jawa Tengah", "tipe": "Kota"},
    {"kode": "34.71", "nama": "Kota Yogyakarta", "provinsi_kode": "34", "provinsi_nama": "DI Yogyakarta", "tipe": "Kota"},
    {"kode": "34.04", "nama": "Kabupaten Sleman", "provinsi_kode": "34", "provinsi_nama": "DI Yogyakarta", "tipe": "Kabupaten"},

    # Jawa Timur (35)
    {"kode": "35.78", "nama": "Kota Surabaya", "provinsi_kode": "35", "provinsi_nama": "Jawa Timur", "tipe": "Kota"},
    {"kode": "35.73", "nama": "Kota Malang", "provinsi_kode": "35", "provinsi_nama": "Jawa Timur", "tipe": "Kota"},
    {"kode": "35.15", "nama": "Kabupaten Sidoarjo", "provinsi_kode": "35", "provinsi_nama": "Jawa Timur", "tipe": "Kabupaten"},
    {"kode": "35.25", "nama": "Kabupaten Gresik", "provinsi_kode": "35", "provinsi_nama": "Jawa Timur", "tipe": "Kabupaten"},
    {"kode": "35.71", "nama": "Kota Kediri", "provinsi_kode": "35", "provinsi_nama": "Jawa Timur", "tipe": "Kota"},
    {"kode": "35.09", "nama": "Kabupaten Jember", "provinsi_kode": "35", "provinsi_nama": "Jawa Timur", "tipe": "Kabupaten"},
    {"kode": "35.10", "nama": "Kabupaten Banyuwangi", "provinsi_kode": "35", "provinsi_nama": "Jawa Timur", "tipe": "Kabupaten"},

    # Sumatera (11, 12, 13, 14, 15, 16, 17, 18, 21)
    {"kode": "12.71", "nama": "Kota Medan", "provinsi_kode": "12", "provinsi_nama": "Sumatera Utara", "tipe": "Kota"},
    {"kode": "12.07", "nama": "Kabupaten Deli Serdang", "provinsi_kode": "12", "provinsi_nama": "Sumatera Utara", "tipe": "Kabupaten"},
    {"kode": "13.71", "nama": "Kota Padang", "provinsi_kode": "13", "provinsi_nama": "Sumatera Barat", "tipe": "Kota"},
    {"kode": "14.71", "nama": "Kota Pekanbaru", "provinsi_kode": "14", "provinsi_nama": "Riau", "tipe": "Kota"},
    {"kode": "21.71", "nama": "Kota Batam", "provinsi_kode": "21", "provinsi_nama": "Kepulauan Riau", "tipe": "Kota"},
    {"kode": "16.71", "nama": "Kota Palembang", "provinsi_kode": "16", "provinsi_nama": "Sumatera Selatan", "tipe": "Kota"},
    {"kode": "18.71", "nama": "Kota Bandar Lampung", "provinsi_kode": "18", "provinsi_nama": "Lampung", "tipe": "Kota"},
    {"kode": "11.71", "nama": "Kota Banda Aceh", "provinsi_kode": "11", "provinsi_nama": "Aceh", "tipe": "Kota"},

    # Bali & Nusa Tenggara (51, 52, 53)
    {"kode": "51.71", "nama": "Kota Denpasar", "provinsi_kode": "51", "provinsi_nama": "Bali", "tipe": "Kota"},
    {"kode": "51.03", "nama": "Kabupaten Badung", "provinsi_kode": "51", "provinsi_nama": "Bali", "tipe": "Kabupaten"},
    {"kode": "52.71", "nama": "Kota Mataram", "provinsi_kode": "52", "provinsi_nama": "Nusa Tenggara Barat", "tipe": "Kota"},
    {"kode": "53.71", "nama": "Kota Kupang", "provinsi_kode": "53", "provinsi_nama": "Nusa Tenggara Timur", "tipe": "Kota"},

    # Kalimantan (61, 62, 63, 64, 65)
    {"kode": "61.71", "nama": "Kota Pontianak", "provinsi_kode": "61", "provinsi_nama": "Kalimantan Barat", "tipe": "Kota"},
    {"kode": "63.71", "nama": "Kota Banjarmasin", "provinsi_kode": "63", "provinsi_nama": "Kalimantan Selatan", "tipe": "Kota"},
    {"kode": "64.71", "nama": "Kota Balikpapan", "provinsi_kode": "64", "provinsi_nama": "Kalimantan Timur", "tipe": "Kota"},
    {"kode": "64.72", "nama": "Kota Samarinda", "provinsi_kode": "64", "provinsi_nama": "Kalimantan Timur", "tipe": "Kota"},
    {"kode": "64.09", "nama": "Kabupaten Penajam Paser Utara (IKN)", "provinsi_kode": "64", "provinsi_nama": "Kalimantan Timur", "tipe": "Kabupaten"},

    # Sulawesi (71, 72, 73, 74, 75, 76)
    {"kode": "73.71", "nama": "Kota Makassar", "provinsi_kode": "73", "provinsi_nama": "Sulawesi Selatan", "tipe": "Kota"},
    {"kode": "73.06", "nama": "Kabupaten Gowa", "provinsi_kode": "73", "provinsi_nama": "Sulawesi Selatan", "tipe": "Kabupaten"},
    {"kode": "71.71", "nama": "Kota Manado", "provinsi_kode": "71", "provinsi_nama": "Sulawesi Utara", "tipe": "Kota"},
    {"kode": "72.71", "nama": "Kota Palu", "provinsi_kode": "72", "provinsi_nama": "Sulawesi Tengah", "tipe": "Kota"},
    {"kode": "74.71", "nama": "Kota Kendari", "provinsi_kode": "74", "provinsi_nama": "Sulawesi Tenggara", "tipe": "Kota"},

    # Maluku & Papua (81, 82, 91, 92)
    {"kode": "81.71", "nama": "Kota Ambon", "provinsi_kode": "81", "provinsi_nama": "Maluku", "tipe": "Kota"},
    {"kode": "92.71", "nama": "Kota Jayapura", "provinsi_kode": "92", "provinsi_nama": "Papua", "tipe": "Kota"},
    {"kode": "96.71", "nama": "Kota Sorong", "provinsi_kode": "96", "provinsi_nama": "Papua Barat Daya", "tipe": "Kota"},
    {"kode": "94.04", "nama": "Kabupaten Mimika (Timika)", "provinsi_kode": "94", "provinsi_nama": "Papua Tengah", "tipe": "Kabupaten"},
]

# Master Kecamatan (Kecamatan Kunci Kabupaten Bogor & sekitarnya)
KECAMATAN_DATA = [
    # Kabupaten Bogor (32.01)
    {"kode": "32.01.01", "nama": "Cibinong", "kabupaten_kode": "32.01", "kabupaten_nama": "Kabupaten Bogor", "provinsi_kode": "32", "provinsi_nama": "Jawa Barat"},
    {"kode": "32.01.02", "nama": "Bojonggede", "kabupaten_kode": "32.01", "kabupaten_nama": "Kabupaten Bogor", "provinsi_kode": "32", "provinsi_nama": "Jawa Barat"},
    {"kode": "32.01.03", "nama": "Citeureup", "kabupaten_kode": "32.01", "kabupaten_nama": "Kabupaten Bogor", "provinsi_kode": "32", "provinsi_nama": "Jawa Barat"},
    {"kode": "32.01.04", "nama": "Sukaraja", "kabupaten_kode": "32.01", "kabupaten_nama": "Kabupaten Bogor", "provinsi_kode": "32", "provinsi_nama": "Jawa Barat"},
    {"kode": "32.01.05", "nama": "Gunung Putri", "kabupaten_kode": "32.01", "kabupaten_nama": "Kabupaten Bogor", "provinsi_kode": "32", "provinsi_nama": "Jawa Barat"},
    {"kode": "32.01.06", "nama": "Cileungsi", "kabupaten_kode": "32.01", "kabupaten_nama": "Kabupaten Bogor", "provinsi_kode": "32", "provinsi_nama": "Jawa Barat"},
    {"kode": "32.01.07", "nama": "Ciawi", "kabupaten_kode": "32.01", "kabupaten_nama": "Kabupaten Bogor", "provinsi_kode": "32", "provinsi_nama": "Jawa Barat"},
    {"kode": "32.01.08", "nama": "Megamendung (Puncak)", "kabupaten_kode": "32.01", "kabupaten_nama": "Kabupaten Bogor", "provinsi_kode": "32", "provinsi_nama": "Jawa Barat"},
    {"kode": "32.01.09", "nama": "Parung", "kabupaten_kode": "32.01", "kabupaten_nama": "Kabupaten Bogor", "provinsi_kode": "32", "provinsi_nama": "Jawa Barat"},
    {"kode": "32.01.10", "nama": "Babakan Madang (Sentul)", "kabupaten_kode": "32.01", "kabupaten_nama": "Kabupaten Bogor", "provinsi_kode": "32", "provinsi_nama": "Jawa Barat"},

    # Kota Bogor (32.71)
    {"kode": "32.71.01", "nama": "Bogor Tengah", "kabupaten_kode": "32.71", "kabupaten_nama": "Kota Bogor", "provinsi_kode": "32", "provinsi_nama": "Jawa Barat"},
    {"kode": "32.71.02", "nama": "Bogor Selatan", "kabupaten_kode": "32.71", "kabupaten_nama": "Kota Bogor", "provinsi_kode": "32", "provinsi_nama": "Jawa Barat"},
    {"kode": "32.71.03", "nama": "Bogor Timur", "kabupaten_kode": "32.71", "kabupaten_nama": "Kota Bogor", "provinsi_kode": "32", "provinsi_nama": "Jawa Barat"},
    {"kode": "32.71.04", "nama": "Bogor Utara", "kabupaten_kode": "32.71", "kabupaten_nama": "Kota Bogor", "provinsi_kode": "32", "provinsi_nama": "Jawa Barat"},
    {"kode": "32.71.05", "nama": "Bogor Barat", "kabupaten_kode": "32.71", "kabupaten_nama": "Kota Bogor", "provinsi_kode": "32", "provinsi_nama": "Jawa Barat"},

    # Kota Depok (32.76)
    {"kode": "32.76.01", "nama": "Pancoran Mas", "kabupaten_kode": "32.76", "kabupaten_nama": "Kota Depok", "provinsi_kode": "32", "provinsi_nama": "Jawa Barat"},
    {"kode": "32.76.02", "nama": "Cimanggis", "kabupaten_kode": "32.76", "kabupaten_nama": "Kota Depok", "provinsi_kode": "32", "provinsi_nama": "Jawa Barat"},
    {"kode": "32.76.03", "nama": "Sukmajaya", "kabupaten_kode": "32.76", "kabupaten_nama": "Kota Depok", "provinsi_kode": "32", "provinsi_nama": "Jawa Barat"},
    {"kode": "32.76.04", "nama": "Beji (Margonda)", "kabupaten_kode": "32.76", "kabupaten_nama": "Kota Depok", "provinsi_kode": "32", "provinsi_nama": "Jawa Barat"},
    {"kode": "32.76.05", "nama": "Cinere", "kabupaten_kode": "32.76", "kabupaten_nama": "Kota Depok", "provinsi_kode": "32", "provinsi_nama": "Jawa Barat"},

    # Jakarta Selatan (31.74)
    {"kode": "31.74.01", "nama": "Kebayoran Baru", "kabupaten_kode": "31.74", "kabupaten_nama": "Jakarta Selatan", "provinsi_kode": "31", "provinsi_nama": "DKI Jakarta"},
    {"kode": "31.74.02", "nama": "Tebet", "kabupaten_kode": "31.74", "kabupaten_nama": "Jakarta Selatan", "provinsi_kode": "31", "provinsi_nama": "DKI Jakarta"},
    {"kode": "31.74.03", "nama": "Cilandak", "kabupaten_kode": "31.74", "kabupaten_nama": "Jakarta Selatan", "provinsi_kode": "31", "provinsi_nama": "DKI Jakarta"},
    {"kode": "31.74.04", "nama": "Pasar Minggu", "kabupaten_kode": "31.74", "kabupaten_nama": "Jakarta Selatan", "provinsi_kode": "31", "provinsi_nama": "DKI Jakarta"},
]

# Master Kelurahan untuk Kecamatan Cibinong (32.01.01) sesuai PRD Seksi 3
KELURAHAN_DATA = [
    {"kode": "32.01.01.1001", "nama": "Cibinong", "kecamatan_kode": "32.01.01", "kecamatan_nama": "Cibinong", "kabupaten_nama": "Kabupaten Bogor", "provinsi_nama": "Jawa Barat"},
    {"kode": "32.01.01.1002", "nama": "Cirimekar", "kecamatan_kode": "32.01.01", "kecamatan_nama": "Cibinong", "kabupaten_nama": "Kabupaten Bogor", "provinsi_nama": "Jawa Barat"},
    {"kode": "32.01.01.1003", "nama": "Ciriung", "kecamatan_kode": "32.01.01", "kecamatan_nama": "Cibinong", "kabupaten_nama": "Kabupaten Bogor", "provinsi_nama": "Jawa Barat"},
    {"kode": "32.01.01.1004", "nama": "Harapan Jaya", "kecamatan_kode": "32.01.01", "kecamatan_nama": "Cibinong", "kabupaten_nama": "Kabupaten Bogor", "provinsi_nama": "Jawa Barat"},
    {"kode": "32.01.01.1005", "nama": "Karadenan", "kecamatan_kode": "32.01.01", "kecamatan_nama": "Cibinong", "kabupaten_nama": "Kabupaten Bogor", "provinsi_nama": "Jawa Barat"},
    {"kode": "32.01.01.1006", "nama": "Nanggewer", "kecamatan_kode": "32.01.01", "kecamatan_nama": "Cibinong", "kabupaten_nama": "Kabupaten Bogor", "provinsi_nama": "Jawa Barat"},
    {"kode": "32.01.01.1007", "nama": "Nanggewer Mekar", "kecamatan_kode": "32.01.01", "kecamatan_nama": "Cibinong", "kabupaten_nama": "Kabupaten Bogor", "provinsi_nama": "Jawa Barat"},
    {"kode": "32.01.01.1008", "nama": "Pabuaran", "kecamatan_kode": "32.01.01", "kecamatan_nama": "Cibinong", "kabupaten_nama": "Kabupaten Bogor", "provinsi_nama": "Jawa Barat"},
    {"kode": "32.01.01.1009", "nama": "Pabuaran Mekar", "kecamatan_kode": "32.01.01", "kecamatan_nama": "Cibinong", "kabupaten_nama": "Kabupaten Bogor", "provinsi_nama": "Jawa Barat"},
    {"kode": "32.01.01.1010", "nama": "Pondok Rajeg", "kecamatan_kode": "32.01.01", "kecamatan_nama": "Cibinong", "kabupaten_nama": "Kabupaten Bogor", "provinsi_nama": "Jawa Barat"},
    {"kode": "32.01.01.1011", "nama": "Sukahati", "kecamatan_kode": "32.01.01", "kecamatan_nama": "Cibinong", "kabupaten_nama": "Kabupaten Bogor", "provinsi_nama": "Jawa Barat"},
]

# Entitas lokal & Landmark spesifik untuk Geographic Query Expansion (Seksi 5.1)
LOCAL_LANDMARKS_AND_KEYWORDS = {
    # Kecamatan Cibinong (32.01.01)
    "32.01.01": {
        "primary": ["cibinong", "kecamatan cibinong"],
        "kelurahan": ["cirimekar", "ciriung", "harapan jaya", "karadenan", "nanggewer", "pabuaran", "pondok rajeg", "sukahati"],
        "landmarks": [
            "stadion pakansari", "pakansari", "jalan raya bogor", "jl raya bogor", "pemda bogor",
            "kantor bupati bogor", "rsud cibinong", "pasar cibinong", "stasiun cibinong",
            "danau dora", "cibinong city mall", "ccm", "setu cikaret", "cikaret", "ciracas cibinong"
        ],
        "regional_parent": "kabupaten bogor",
        "regional_code": "32.01",
    },
    # Kecamatan Bojonggede (32.01.02)
    "32.01.02": {
        "primary": ["bojonggede", "bojong gede"],
        "kelurahan": ["rawa panjang", "kedung waringin", "waringin jaya", "bojong baru"],
        "landmarks": ["stasiun bojonggede", "jalan raya bojonggede", "pasar bojonggede"],
        "regional_parent": "kabupaten bogor",
        "regional_code": "32.01",
    },
    # Kecamatan Citeureup (32.01.03)
    "32.01.03": {
        "primary": ["citeureup", "kecamatan citeureup"],
        "kelurahan": ["karang asem", "puspasari", "sanja", "gunung sari"],
        "landmarks": ["tol citeureup", "pasar citeureup", "kawasan industri citeureup"],
        "regional_parent": "kabupaten bogor",
        "regional_code": "32.01",
    },
    # Kabupaten Bogor (32.01)
    "32.01": {
        "primary": ["kabupaten bogor", "kab bogor", "bogor"],
        "kelurahan": ["cibinong", "bojonggede", "citeureup", "sukaraja", "cileungsi", "gunung putri", "parung", "ciawi", "puncak"],
        "landmarks": ["puncak", "gadog", "sentul", "sentul city", "pakansari", "jalan raya bogor", "bukit pelangi"],
        "regional_parent": "jawa barat",
        "regional_code": "32",
    },
}


def search_geographic_scope(query: str, limit: int = 15) -> List[Dict[str, Any]]:
    """Pencarian autocomplete hierarki administratif dengan prioritas tinggi pada Kabupaten & Kota."""
    q = (query or "").strip().lower()
    if not q:
        # Default fokus rekomendasi Kabupaten/Kota strategis + Nasional
        return [
            {"kode": "ID", "nama": "Seluruh Indonesia", "tingkat": "nasional", "konteks": "Nasional"},
            {"kode": "32.01", "nama": "Kabupaten Bogor", "tingkat": "kabupaten", "konteks": "Jawa Barat"},
            {"kode": "32.71", "nama": "Kota Bogor", "tingkat": "kabupaten", "konteks": "Jawa Barat"},
            {"kode": "32.76", "nama": "Kota Depok", "tingkat": "kabupaten", "konteks": "Jawa Barat"},
            {"kode": "32.75", "nama": "Kota Bekasi", "tingkat": "kabupaten", "konteks": "Jawa Barat"},
            {"kode": "32.73", "nama": "Kota Bandung", "tingkat": "kabupaten", "konteks": "Jawa Barat"},
            {"kode": "31.74", "nama": "Jakarta Selatan", "tingkat": "kabupaten", "konteks": "DKI Jakarta"},
            {"kode": "35.78", "nama": "Kota Surabaya", "tingkat": "kabupaten", "konteks": "Jawa Timur"},
            {"kode": "12.71", "nama": "Kota Medan", "tingkat": "kabupaten", "konteks": "Sumatera Utara"},
            {"kode": "32.01.01", "nama": "Kecamatan Cibinong", "tingkat": "kecamatan", "konteks": "Kabupaten Bogor, Jawa Barat"},
        ]

    kab_results: List[Dict[str, Any]] = []
    kec_results: List[Dict[str, Any]] = []
    kel_results: List[Dict[str, Any]] = []
    prov_results: List[Dict[str, Any]] = []

    # 1. Cek Kabupaten / Kota (Prioritas Utama untuk Fokus Isu)
    for kab in KABUPATEN_DATA:
        if q in kab["nama"].lower() or q in kab["kode"].lower():
            kab_results.append({
                "kode": kab["kode"],
                "nama": kab["nama"],
                "tingkat": "kabupaten",
                "konteks": f"{kab['tipe']} &bull; {kab['provinsi_nama']}",
            })

    # 2. Cek Kecamatan
    for kec in KECAMATAN_DATA:
        if q in kec["nama"].lower() or q in kec["kode"].lower():
            kec_results.append({
                "kode": kec["kode"],
                "nama": f"Kecamatan {kec['nama']}",
                "tingkat": "kecamatan",
                "konteks": f"{kec['kabupaten_nama']}, {kec['provinsi_nama']}",
            })

    # 3. Cek Kelurahan
    for kel in KELURAHAN_DATA:
        if q in kel["nama"].lower() or q in kel["kode"].lower():
            kel_results.append({
                "kode": kel["kode"],
                "nama": f"Kelurahan {kel['nama']}",
                "tingkat": "kelurahan",
                "konteks": f"Kec. {kel['kecamatan_nama']}, {kel['kabupaten_nama']}, {kel['provinsi_nama']}",
            })

    # 4. Cek Provinsi
    for prov in PROVINCES_DATA:
        if q in prov["nama"].lower() or q in prov["kode"].lower():
            prov_results.append({
                "kode": prov["kode"],
                "nama": f"Provinsi {prov['nama']}",
                "tingkat": "provinsi",
                "konteks": f"Pulau {prov['pulau']}",
            })

    # Urutkan: Kabupaten/Kota dahulu, lalu Kecamatan, Kelurahan, Provinsi
    combined = kab_results + kec_results + kel_results + prov_results
    return combined[:limit]


def get_scope_expansion_keywords(scope_kode: str) -> Dict[str, Any]:
    """Mengembalikan daftar keyword, entitas lokal, dan konteks regional untuk cakupan wilayah."""
    if scope_kode in LOCAL_LANDMARKS_AND_KEYWORDS:
        info = LOCAL_LANDMARKS_AND_KEYWORDS[scope_kode]
        return {
            "scope_kode": scope_kode,
            "primary": info["primary"],
            "sub_entities": info.get("kelurahan", []),
            "landmarks": info.get("landmarks", []),
            "regional_parent": info.get("regional_parent", ""),
            "regional_code": info.get("regional_code", ""),
        }

    # Jika memilih Kelurahan
    for kel in KELURAHAN_DATA:
        if kel["kode"] == scope_kode:
            return {
                "scope_kode": scope_kode,
                "primary": [kel["nama"].lower(), f"kelurahan {kel['nama'].lower()}"],
                "sub_entities": [],
                "landmarks": [f"kantor kelurahan {kel['nama'].lower()}"],
                "regional_parent": kel["kecamatan_nama"].lower(),
                "regional_code": kel["kecamatan_kode"],
            }

    # Jika memilih Kecamatan lain
    for kec in KECAMATAN_DATA:
        if kec["kode"] == scope_kode:
            return {
                "scope_kode": scope_kode,
                "primary": [kec["nama"].lower(), f"kecamatan {kec['nama'].lower()}"],
                "sub_entities": [],
                "landmarks": [],
                "regional_parent": kec["kabupaten_nama"].lower(),
                "regional_code": kec["kabupaten_kode"],
            }

    # Jika memilih Kabupaten/Kota
    for kab in KABUPATEN_DATA:
        if kab["kode"] == scope_kode:
            return {
                "scope_kode": scope_kode,
                "primary": [kab["nama"].lower(), re.sub(r"^(kota|kabupaten)\s+", "", kab["nama"].lower())],
                "sub_entities": [],
                "landmarks": [],
                "regional_parent": kab["provinsi_nama"].lower(),
                "regional_code": kab["provinsi_kode"],
            }

    # Jika memilih Provinsi
    for prov in PROVINCES_DATA:
        if prov["kode"] == scope_kode:
            return {
                "scope_kode": scope_kode,
                "primary": [prov["nama"].lower()],
                "sub_entities": [],
                "landmarks": [],
                "regional_parent": "indonesia",
                "regional_code": "ID",
            }

    # Default nasional
    return {
        "scope_kode": "ID",
        "primary": ["indonesia", "nasional"],
        "sub_entities": [],
        "landmarks": [],
        "regional_parent": "",
        "regional_code": "",
    }


def classify_geographic_context(
    text: str,
    scope_kode: str,
    scope_mode: str = "context",
) -> Tuple[bool, str, str, float]:
    """
    Mengklasifikasikan relevansi geografis sebuah konten (FR-GEO-07 & FR-GEO-08).
    
    Mengembalikan (is_relevant, context_label, confidence_level, confidence_score):
    - is_relevant: bool (apakah lolos filter cakupan ini)
    - context_label: "Direct Location Evidence" | "Explicit Location Mention" | "Regional Context" | "Location Uncertain" | "Unrelated"
    - confidence_level: "High" | "Medium" | "Low" | "Unknown"
    - confidence_score: float (0.0 to 1.0)
    """
    if scope_kode == "ID" or not scope_kode:
        # Seluruh Indonesia lolos secara nasional
        return True, "Cakupan Nasional", "High", 0.95

    t_lower = text.lower()
    exp = get_scope_expansion_keywords(scope_kode)

    # 1. Cek kecocokan primer (Direct / Explicit)
    has_primary = any(pk in t_lower for pk in exp["primary"])
    # 2. Cek kecocokan kelurahan / sub-entitas
    has_sub = any(se in t_lower for se in exp["sub_entities"])
    # 3. Cek landmark lokal
    has_landmark = any(lm in t_lower for lm in exp["landmarks"])
    # 4. Cek parent regional
    parent_kw = exp.get("regional_parent", "")
    has_parent = (parent_kw in t_lower) if parent_kw else False

    # A. Strict Location Mode (FR-GEO-03A)
    if scope_mode == "strict":
        if has_primary and (has_sub or has_landmark):
            return True, "Direct Location Evidence", "High", 0.95
        elif has_primary:
            return True, "Explicit Location Mention", "High", 0.88
        else:
            return False, "Unrelated (Strict)", "Unknown", 0.10

    # B. Location + Context Mode (FR-GEO-03B, Default)
    if has_primary and (has_sub or has_landmark):
        return True, "Direct Location Evidence", "High", 0.95
    elif has_primary:
        return True, "Explicit Location Mention", "Medium", 0.82
    elif has_sub or has_landmark:
        return True, "Explicit Location Mention", "Medium", 0.78
    
    # C. Regional Context Mode (FR-GEO-03C)
    if scope_mode == "regional":
        if has_parent:
            return True, f"{parent_kw.title()} (Konteks Regional)", "Low", 0.65

    # Jika menyebut parent regional dalam mode normal, tandai sebagai Regional Context tetapi tolak jika strict
    if has_parent:
        return False, f"{parent_kw.title()} (Konteks Regional)", "Low", 0.55

    return False, "Unrelated", "Unknown", 0.05
