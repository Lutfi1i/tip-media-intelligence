import pytest

from backend.app.services.ai_analyzer import extract_locations
from backend.app.services.geo_hierarchy import (
    KABUPATEN_DATA,
    PROVINCES_DATA,
    classify_geographic_context,
    short_region_name,
)


def test_all_official_regencies_and_provinces_present():
    assert len(PROVINCES_DATA) == 38
    codes = [k["kode"] for k in KABUPATEN_DATA]
    assert len(codes) == 514 and len(set(codes)) == 514


def test_papua_codes_follow_kemendagri():
    prov = {p["kode"]: p["nama"] for p in PROVINCES_DATA}
    assert prov["91"] == "Papua" and prov["92"] == "Papua Barat"
    kab = {k["kode"]: k for k in KABUPATEN_DATA}
    assert kab["91.71"]["nama"] == "Kota Jayapura" and kab["91.71"]["provinsi_nama"] == "Papua"
    assert kab["92.02"]["nama"] == "Kabupaten Manokwari"


def test_short_region_name():
    assert short_region_name("Kabupaten Bogor") == "bogor"
    assert short_region_name("Kota Surakarta (Solo)") == "surakarta"
    assert short_region_name("Kota Administrasi Jakarta Selatan") == "jakarta selatan"


@pytest.mark.parametrize(
    "text, scope, relevant",
    [
        # Provinsi ikut mencocokkan kota di dalamnya, bukan hanya nama provinsinya.
        ("Antrean panjang di Margonda Depok pagi ini", "32", True),
        ("Kuliner malam di Medan ramai", "12", True),
        ("Kuliner malam di Medan ramai", "32", False),
        # Nama pendek ambigu hanya cocok dalam bentuk lengkap.
        ("Ambil batu di sungai untuk taman", "35.79", False),
        ("Wisata Kota Batu penuh saat libur", "35.79", True),
        ("Gempa terasa di Kabupaten Bone", "73.08", True),
        ("Tulang bone broth enak", "73.08", False),
    ],
)
def test_scope_matching(text, scope, relevant):
    assert classify_geographic_context(text, scope)[0] is relevant


@pytest.mark.parametrize(
    "text, expected",
    [
        ("Macet parah di Jalan Gatot Subroto Medan", "Kota Medan"),
        ("Festival budaya di Jayapura", "Kota Jayapura"),
        ("Batu akik dijual murah", None),
        ("Banjir di Kemang pagi ini", "Kemang"),  # entri kurasi lama tetap dipakai
    ],
)
def test_extract_locations_nationwide(text, expected):
    assert extract_locations(text)[0] == expected
