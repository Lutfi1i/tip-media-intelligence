from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.database import Base, get_db
from backend.app.models import RawItem, Source
from backend.app.services import trend_ai, trend_service as ts
from backend.app.services.trend_report_export import _pdf_text, build_pdf, build_xlsx


@pytest.fixture()
def db():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(bind=engine)
    session = sessionmaker(bind=engine)()
    yield session
    session.close()


def _seed(db):
    now = datetime.utcnow()
    src = Source(nama="Uji", jenis="media_sosial", url="https://example.com")
    db.add(src)
    db.flush()
    n = 0

    def add(text, platform="YouTube", author=None, hours_ago=2, url=None, views=None, likes=None, replies=None, followers=None):
        nonlocal n
        n += 1
        db.add(RawItem(
            source_id=src.id, url_kanonik=url or f"https://example.com/{n}", hash=f"h{n}", judul=text, isi="",
            penerbit=author or "Penerbit", penulis=author, published_at=now - timedelta(hours=hours_ago),
            fetched_at=now - timedelta(days=3), platform=platform,
            eng_views=views, eng_likes=likes, eng_replies=replies, author_followers=followers,
        ))

    # Percakapan kuliner Bogor dari tiga akun berbeda.
    add("Kuliner baru di Kota Bogor #kulinerbogor enak", "TikTok", "@a", url="https://www.tiktok.com/@a/video/1")
    add("Antre panjang kuliner Kota Bogor #kulinerbogor", "Instagram", "@b", url="https://www.instagram.com/reel/xyz")
    add("Review kuliner Kota Bogor #kulinerbogor murah", "YouTube", "@c", url="https://www.youtube.com/watch?v=1",
        views=10000, likes=500, replies=50, followers=2000, hours_ago=10)
    # Akun yang sama teramati dua kali: followers naik.
    add("Vlog jalan jalan Kota Bandung kuliner", "YouTube", "@c", url="https://youtube.com/shorts/2",
        views=4000, likes=100, replies=10, followers=2300, hours_ago=1)
    # Bot cuaca: frasa template dari satu sumber.
    for i in range(3):
        add(f"Peringatan dini cuaca stabil berubah wilayah Medan {i}", "Telegram", None, views=100)
    db.commit()
    return now


def test_media_type_from_url():
    assert ts.media_type("https://youtube.com/shorts/abc", "YouTube") == "Video pendek"
    assert ts.media_type("https://www.instagram.com/p/abc/", "Instagram") == "Foto"
    assert ts.media_type("https://x.com/a/status/1", "X (Twitter)") == "Postingan"


def test_viral_only_ranks_posts_with_metrics(db):
    _seed(db)
    out = ts.get_viral_content(db, "7d", "ID", "Semua")
    platforms = {c["platform"] for c in out["konten"]}
    assert platforms <= {"YouTube", "Telegram"}
    # Konten tanpa metrik dilaporkan terpisah, tidak dianggap nol.
    assert out["tanpa_metrik"] == {"TikTok": 1, "Instagram": 1}
    assert out["konten"][0]["interaksi"] == 550


def test_account_growth_and_engagement(db):
    _seed(db)
    rows = {r["akun"]: r for r in ts.get_accounts(db, "7d", "ID", "Semua")["akun"]}
    c = rows["@c"]
    assert c["followers"] == 2300 and c["pertumbuhan_followers"] == 300
    assert c["total_views"] == 14000 and c["engagement_rate_pct"] == round(660 / 14000 * 100, 2)
    # Akun tanpa metrik tetap tercatat, dengan nilai None (bukan 0).
    assert rows["@a"]["followers"] is None and rows["@a"]["total_views"] is None


def test_live_keywords_skip_single_source_templates(db):
    _seed(db)
    labels = [k["label"] for k in ts.get_live_stats(db, "7d", "ID", "Semua")["kata_teratas"]]
    assert "#kulinerbogor" in labels
    assert not any("Stabil" in label for label in labels)


def test_region_children_and_sections(db):
    _seed(db)
    out = ts.get_region_trends(db, "7d", "32", "Semua")
    subs = {r["nama"]: r["postingan"] for r in out["sub_wilayah"]}
    assert subs.get("Kota Bogor") == 3 and subs.get("Kota Bandung") == 1
    kuliner = next(b for b in out["bagian"] if b["id"] == "kuliner")
    assert kuliner["postingan"] >= 3


def test_key_history_counts_per_day(db):
    _seed(db)
    out = ts.get_key_history(db, ["#kulinerbogor", "bandung"], "ID", "Semua")
    assert len(out["tanggal"]) == 30
    totals = {s["key"]: s["total"] for s in out["seri"]}
    assert totals == {"#kulinerbogor": 3, "bandung": 1}


def test_report_exports(db):
    _seed(db)
    data = ts.get_report_data(db, "7d", "32", "Semua")
    assert build_xlsx(data)[:2] == b"PK"
    assert build_pdf(data)[:4] == b"%PDF"


def test_pdf_text_strips_non_latin1():
    assert _pdf_text("Kuliner 🔥 enak — murah") == "Kuliner enak - murah"


def test_ai_rules_without_key(db):
    _seed(db)
    trends = ts._build_trends(db, ts._dataset(db, "7d", "ID", "Semua"), "7d")
    out = trend_ai.analyze_topic(db, trends[0]["topic_key"], "7d", "ID", "Semua")
    assert out["ai"] is None and "belum dikonfigurasi" in out["ai_error"]
    assert out["prediksi"]["catatan"].startswith("Perkiraan")
    assert out["sumber"]


def test_ai_output_is_normalized():
    raw = {
        "ringkasan": "Ramai — banyak dibahas",
        "potensi_konten": {"tingkat": "TINGGI", "alasan": "x"},
        "hashtag": ["kuliner bogor", "#viral"],
        "ide_konten": [{"judul": "A", "platform": "bukan list"}],
        "brief_video": {"durasi_detik": "30"},
    }
    out = trend_ai._normalize_topic_ai(raw)
    assert out["ringkasan"] == "Ramai, banyak dibahas"
    assert out["potensi_konten"]["tingkat"] == "tinggi"
    assert out["hashtag"] == ["#kulinerbogor", "#viral"]
    assert out["ide_konten"][0]["platform"] == []
    assert out["brief_video"]["durasi_detik"] is None


def test_router_validates_filters(db):
    from backend.app.main import app

    app.dependency_overrides[get_db] = lambda: db
    try:
        client = TestClient(app)
        assert client.get("/api/v1/tren/live?periode=1y").status_code == 422
        assert client.get("/api/v1/tren/live?lokasi=99.99").status_code == 422
        assert client.get("/api/v1/tren/live?periode=today&lokasi=32.71").status_code == 200
        assert client.post("/api/v1/tren/ai/topik?periode=7d", json={"topic_key": "#tidakada"}).status_code == 404
    finally:
        app.dependency_overrides.pop(get_db, None)
