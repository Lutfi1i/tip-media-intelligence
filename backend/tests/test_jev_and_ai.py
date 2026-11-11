import pytest
from backend.app.services.jev_triage import evaluate_binary_triage
from backend.app.services.geo_service import (
    INDONESIA_PROVINCES,
    JABODETABEK_REGIONS,
    get_indonesia_geo_overview,
    get_region_detail_and_issues,
)
from backend.app.database import SessionLocal


def test_jev_binary_triage_commercial_noise():
    # Flood promo discount should be identified as noise
    title = "Banjir diskon 50% di Mall Grand Indonesia akhir pekan ini"
    body = "Promo besar-besaran untuk menyambut liburan akhir tahun."
    res = evaluate_binary_triage(title, body, publisher="Detik Finance")
    assert res.is_noise_or_promo is True
    assert res.is_incident_jabodetabek is False
    assert res.requires_analyst_dispatch is False


def test_jev_binary_triage_real_incident():
    # Actual flood in Kemang should be identified as real incident requiring dispatch
    title = "Banjir 80 cm rendam kawasan Kemang Jakarta Selatan, jalan terputus"
    body = "Genangan air meluap dari Kali Krukut, puluhan motor mogok dan warga mengungsi."
    res = evaluate_binary_triage(title, body, publisher="Antara News")
    assert res.is_incident_jabodetabek is True
    assert res.is_noise_or_promo is False
    assert res.confidence >= 0.70


def test_geo_master_provinces():
    assert len(INDONESIA_PROVINCES) == 38
    dki = next((p for p in INDONESIA_PROVINCES if p["kode"] == "31"), None)
    assert dki is not None
    assert dki["is_focus"] is True

    aceh = next((p for p in INDONESIA_PROVINCES if p["kode"] == "11"), None)
    assert aceh is not None
    assert aceh["is_focus"] is False


def test_geo_jabodetabek_regions():
    assert len(JABODETABEK_REGIONS) == 14
    jaksel = next((r for r in JABODETABEK_REGIONS if r["kode"] == "31.74"), None)
    assert jaksel is not None
    assert "kemang" in jaksel["aliases"]


def test_geo_overview_db_query():
    db = SessionLocal()
    try:
        overview = get_indonesia_geo_overview(db)
        assert overview["status"] == "success"
        assert len(overview["provinces"]) == 38
        assert len(overview["jabodetabek_regions"]) == 14

        # Test drill-down
        detail = get_region_detail_and_issues(db, "31.74")
        assert detail["nama"] == "Jakarta Selatan"
        assert "issues" in detail
        assert "recent_articles" in detail
    finally:
        db.close()


@pytest.mark.anyio
async def test_ai_engine_incident_fallback():
    from backend.app.services.ai_engine import analyze_incident_with_ai, generate_executive_brief_with_ai

    res = await analyze_incident_with_ai(
        title="Banjir melanda kawasan Cilandak Timur Jakarta Selatan",
        body="Hujan deras menyebabkan luapan air setinggi 60 cm merendam pemukiman warga.",
        publisher="Antara News"
    )
    assert res["sentimen"] in ("negatif", "campuran")
    assert res["topik"] in ("Bencana", "Infrastruktur")
    assert res["lokasi_kejadian"] is not None

    brief = await generate_executive_brief_with_ai(
        issue_title="Banjir Cilandak Timur",
        items=[{"judul": "Banjir 60 cm di Cilandak", "konten": "Petugas SDA dikerahkan dengan pompa mobile.", "penerbit": "Detik"}]
    )
    assert len(brief["pihak_terlibat"]) > 0
    assert brief["estimasi_sla_jam"] > 0
