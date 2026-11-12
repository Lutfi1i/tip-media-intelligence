from datetime import datetime, timedelta

import pytest
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.database import Base
from backend.app.models import Issue, IssueItem, ItemAnalysis, MonitoringProfile, ProfileRule, RawItem, Source
from backend.app.schema_sync import ensure_schema
from backend.app.services.collector import _entry_author, _entry_engagement, _parse_datetime_text
from backend.app.services.social_escalation import escalate_social_surges
from backend.app.services.social_platform import NEWS, legacy_platform, platform_from_url, resolve_platform
from backend.app.services.social_pulse_service import (
    get_platform_metrics,
    get_social_correlations,
    get_social_pulse_overview,
    get_social_trends,
    get_social_watchlist,
    source_platforms,
)
from backend.app.services.social_topics import (
    SocialPost,
    account_analysis,
    cluster_posts,
    detect_coordination,
    extract_keys,
    velocity,
)


# ---------- platform ----------

def test_platform_from_origin_domain_not_feed_title():
    gn = "https://news.google.com/rss/articles/abc"
    assert resolve_platform(gn, "https://x.com") == "X (Twitter)"
    assert resolve_platform(gn, "https://www.tiktok.com") == "TikTok"
    assert resolve_platform(gn, "https://www.threads.com") == "Threads"
    # Artikel Kompas dari query "threads" tetap berita.
    assert resolve_platform(gn, "https://megapolitan.kompas.com") == NEWS
    assert platform_from_url("https://notx.com/a") is None


def test_legacy_platform_uses_google_news_title_suffix():
    gn = "https://news.google.com/rss/articles/abc"
    feed = '"threads.net" OR "Threads" jakarta - Google Berita'
    assert legacy_platform(feed, gn, "Banjir Jakarta dan Sekitar - Mongabay.co.id") == NEWS
    assert legacy_platform(feed, gn, "Postingan warga soal banjir") == "Threads"


def test_source_platforms_from_site_operator():
    src = Source(nama="s", jenis="media_sosial", url="https://news.google.com/rss/search?q=site:x.com+OR+site:twitter.com+jakarta")
    assert source_platforms(src) == ["X (Twitter)"]


# ---------- collector parsing ----------

def test_parse_twitter_and_iso_dates():
    assert _parse_datetime_text("Wed Nov 12 08:04:00 +0000 2026") == datetime(2026, 11, 12, 8, 4)
    assert _parse_datetime_text("2026-11-12T15:04:00+07:00") == datetime(2026, 11, 12, 8, 4)
    assert _parse_datetime_text("bukan tanggal") is None


def test_author_handle_from_title_and_engagement_from_media_rss():
    assert _entry_author({}, "Nita (@tehnit4) - Threads") == "@tehnit4"
    assert _entry_author({"author": "@asli"}, "Nita (@tehnit4)") == "@asli"
    eng = _entry_engagement({"media_statistics": {"views": "1200"}, "media_starrating": {"count": "45"}})
    assert eng == {"views": 1200, "likes": 45}
    assert _entry_engagement({"_eng": {"likes": None, "shares": 3}}) == {"shares": 3}


# ---------- topic analytics ----------

def _post(i, text, minutes_ago=10, author=None, **kw):
    p = SocialPost(
        id=i, text=text, title=text, platform=kw.pop("platform", "X (Twitter)"),
        published_at=datetime(2026, 11, 12, 12, 0) - timedelta(minutes=minutes_ago), author=author, **kw,
    )
    p.keys = extract_keys(text)
    return p


def test_extract_keys_hashtag_phrase_category():
    keys = extract_keys("Banjir lagi di Kemang #BanjirJakarta, pompa air mati total")
    assert "#banjirjakarta" in keys
    assert "p:pompa air" in keys
    assert "k:Bencana & Cuaca" in keys
    # Gabungan dua nama wilayah umum bukan topik.
    assert "p:jakarta bogor" not in extract_keys("Jakarta Bogor ramai lancar")


def test_cluster_groups_shared_hashtag_and_drops_singletons_into_category():
    posts = [
        _post(1, "#TolJagorawi padat merayap arah Bogor"),
        _post(2, "Pagi ini #TolJagorawi lancar"),
        _post(3, "Info #toljagorawi ada kecelakaan"),
        _post(4, "Harga beras naik di pasar"),
    ]
    groups = dict(cluster_posts(posts))
    assert {p.id for p in groups["#toljagorawi"]} == {1, 2, 3}
    assert [p.id for p in groups["k:Ekonomi & Harga"]] == [4]


def test_velocity_statuses():
    assert velocity(2, [0, 0, 0], min_volume=3)["status"] == "SINYAL LEMAH"
    assert velocity(5, [], min_volume=3)["status"] == "BARU"
    assert velocity(12, [1, 2, 1, 2], min_volume=3)["status"] == "LONJAKAN TINGGI"
    assert velocity(6, [4, 4, 3, 5], min_volume=3)["status"] == "MENINGKAT"
    assert velocity(4, [4, 5, 4, 3], min_volume=3)["status"] == "STABIL"
    assert velocity(3, [8, 9, 8, 10], min_volume=3)["status"] == "MENURUN"
    v = velocity(5, [], min_volume=3)
    assert v["growth_pct"] is None and v["baseline_windows"] == 0


def test_account_concentration_and_coordination():
    text = "Warga Bekasi tolak kebijakan parkir baru karena tarif terlalu mahal dan tidak adil"
    posts = [
        _post(1, text, 5, "@a"), _post(2, text, 15, "@b"), _post(3, text + " !", 25, "@c"),
        _post(4, "Pendapat lain soal parkir Bekasi yang berbeda sama sekali isinya", 30, "@a"),
        _post(5, "Konten tanpa nama akun tentang parkir di Bekasi hari ini", 40, None),
    ]
    acc = account_analysis(posts)
    assert acc["unique_accounts"] == 3
    assert acc["author_coverage_pct"] == 80.0
    assert acc["top_accounts"][0]["handle"] == "@a" and acc["top_accounts"][0]["posts"] == 2
    coord = detect_coordination(posts)
    assert coord["flagged"] is True
    assert coord["clusters"][0]["distinct_accounts"] == 3

    # Teks kembar dari satu akun saja bukan indikasi koordinasi.
    solo = [_post(i, text, i * 5, "@a") for i in range(1, 4)]
    assert detect_coordination(solo)["flagged"] is False


# ---------- service on a real (sqlite) database ----------

@pytest.fixture()
def db():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(bind=engine)
    session = sessionmaker(bind=engine)()
    yield session
    session.close()


def _seed(db, now):
    src = Source(nama="X via Google News", jenis="media_sosial", kredibilitas=0.8,
                 url="https://news.google.com/rss/search?q=site:x.com+jakarta",
                 last_fetch_at=now, last_fetch_status="ok", last_success_at=now, last_fetch_count=20)
    news = Source(nama="Antara", jenis="rss", url="https://antaranews.com/rss")
    profile = MonitoringProfile(nama="Profil Uji", status="aktif")
    db.add_all([src, news, profile])
    db.flush()
    db.add(ProfileRule(profile_id=profile.id, keyword_json='["banjir"]', sinonim_json='["pompa mati"]',
                       pengecualian_json='["banjir diskon"]'))

    n = 0

    def add(text, published, platform="X (Twitter)", author=None, fetched=None, sentimen="negatif", likes=None):
        nonlocal n
        n += 1
        item = RawItem(source_id=src.id, url_kanonik=f"https://x.com/u/status/{n}", hash=f"h{n}", judul=text, isi=text,
                       penerbit="X", penulis=author, published_at=published, fetched_at=fetched or published,
                       platform=platform, eng_likes=likes)
        db.add(item)
        db.flush()
        db.add(ItemAnalysis(item_id=item.id, sentimen=sentimen, topik="Bencana & Cuaca", lokasi_kejadian="Bekasi"))
        return item

    # Pengumpulan berjalan sejak 3 hari lalu: ada baseline 1-2 konten/hari untuk #banjirbekasi.
    start = now - timedelta(days=3)
    add("Seed awal pengumpulan tanpa topik", start, fetched=start, sentimen="netral")
    for d in (1, 2):
        add(f"#BanjirBekasi genangan kecil hari ke {d}", now - timedelta(days=d, hours=3))
    # Lonjakan 24 jam terakhir: 8 konten, 4 akun.
    items = [add(f"#BanjirBekasi air setinggi lutut di Jatiasih laporan {i}", now - timedelta(hours=i + 1),
                 author=f"@warga{i % 4}", likes=10 * i) for i in range(8)]
    # Promo yang harus dikecualikan profil, dan artikel berita yang bukan medsos.
    add("Banjir diskon akhir tahun #BanjirBekasi", now - timedelta(hours=2), sentimen="positif")
    add("Berita banjir Bekasi", now - timedelta(hours=2), platform=NEWS)
    db.commit()
    return items


def test_trends_overview_watchlist_platforms(db):
    now = datetime.utcnow()
    _seed(db, now)

    trends = get_social_trends(db, time_range="24h")
    top = trends[0]
    assert top["topic"] == "#banjirbekasi"
    assert top["mention_count"] == 8  # promo dikecualikan, berita tidak dihitung
    assert top["velocity_status"] == "LONJAKAN TINGGI"
    assert top["velocity"]["baseline_windows"] >= 2
    assert sum(b["count"] for b in top["timeline"]) == 8
    assert top["accounts"]["unique_accounts"] == 4
    assert top["engagement"]["likes"] == sum(10 * i for i in range(8))
    assert len(top["post_ids"]) == 8

    ov = get_social_pulse_overview(db, time_range="24h")
    assert ov["total_mentions"] == 8
    assert ov["data_coverage"]["excluded_count"] == 1
    assert ov["platform_distribution"] == {"X (Twitter)": 8}

    wl = get_social_watchlist(db, time_range="24h", extra_terms=["jatiasih"])
    by_term = {t["term"]: t for t in wl["terms"]}
    assert by_term["banjir"]["mention_count"] == 8  # cocok lewat hashtag #BanjirBekasi
    assert by_term["jatiasih"]["mention_count"] == 8
    assert by_term["pompa mati"]["kind"] == "sinonim"

    plats = {p["name"]: p for p in get_platform_metrics(db, time_range="24h")}
    assert plats["X (Twitter)"]["health_state"] == "aktif"
    assert plats["X (Twitter)"]["mention_count"] == 8
    assert plats["Facebook"]["health_state"] == "tanpa_sumber"
    assert plats["Facebook"]["is_connected"] is False


def test_baseline_not_assumed_before_collection_started(db):
    now = datetime.utcnow()
    src = Source(nama="s", jenis="media_sosial", url="https://x.com/s")
    db.add(src)
    db.flush()
    # Konten lama terbit 5 hari lalu tetapi baru dikumpulkan hari ini: jendela lama tidak tercakup.
    for i in range(5):
        db.add(RawItem(source_id=src.id, url_kanonik=f"u{i}", hash=f"h{i}", judul="#topikbaru ramai", isi="#topikbaru ramai",
                       published_at=now - timedelta(hours=i + 1), fetched_at=now - timedelta(minutes=5), platform="X (Twitter)"))
    db.commit()
    top = get_social_trends(db, time_range="24h")[0]
    assert top["velocity_status"] == "BARU"
    assert top["growth_pct"] is None


def test_correlations_only_real_links(db):
    now = datetime.utcnow()
    items = _seed(db, now)
    assert get_social_correlations(db) == []
    issue = Issue(kode_referensi="T-1", judul="Banjir Bekasi", wilayah="Bekasi", status="otomatis")
    db.add(issue)
    db.flush()
    db.add(IssueItem(issue_id=issue.id, item_id=items[0].id))
    db.commit()
    corr = get_social_correlations(db)
    assert len(corr) == 1
    assert corr[0]["issue"]["kode_referensi"] == "T-1"
    assert corr[0]["linked_posts"] == 1


def test_escalation_creates_once_then_updates_and_respects_rejection(db):
    now = datetime.utcnow()
    _seed(db, now)
    first = escalate_social_surges(db, time_range="24h")
    assert len(first["created"]) == 1
    issue = db.query(Issue).filter(Issue.social_topic_key == "#banjirbekasi").one()
    assert issue.status == "otomatis"
    assert db.query(IssueItem).filter(IssueItem.issue_id == issue.id).count() == 8

    second = escalate_social_surges(db, time_range="24h")
    assert second["created"] == [] and second["updated"] == [issue.kode_referensi]
    assert db.query(IssueItem).filter(IssueItem.issue_id == issue.id).count() == 8

    issue.status = "ditolak"
    db.commit()
    third = escalate_social_surges(db, time_range="24h")
    assert third["created"] == [] and third["skipped"]


def test_ensure_schema_adds_missing_columns():
    engine = create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})
    with engine.begin() as conn:
        conn.execute(text("CREATE TABLE sources (id INTEGER PRIMARY KEY, nama VARCHAR(255) NOT NULL, jenis VARCHAR(50) NOT NULL, url VARCHAR(512) NOT NULL)"))
    changes = ensure_schema(engine)
    cols = {c["name"] for c in inspect(engine).get_columns("sources")}
    assert {"last_fetch_at", "last_fetch_status", "last_fetch_count"} <= cols
    assert "sources.last_fetch_status" in changes
    assert ensure_schema(engine) == []


# ---------- kategori & instansi ----------

from backend.app.services.social_taxonomy import classify  # noqa: E402
from backend.app.services.social_pulse_service import get_agency_board, get_social_facets  # noqa: E402


@pytest.mark.parametrize(
    "text, cat, agency",
    [
        ("Listrik padam 5 jam di Cibubur, PLN belum respon #PLNPadam", "energi", "pln"),
        ("Kebakaran rumah, 6 unit damkar dikerahkan", "kebakaran", "damkar"),
        ("Rekomendasi kuliner seblak enak di Depok", "kuliner", None),
        ("Air mati 2 hari, PAM Jaya diam saja", "air", "pam"),
        ("KRL gangguan, penumpang menumpuk di stasiun Manggarai", "transportasi", "kai"),
        ("Gubernur tinjau proyek flyover", "politik", "pemprov"),
    ],
)
def test_classify_category_and_agency(text, cat, agency):
    cats, ags = classify(text)
    assert cat in cats
    if agency:
        assert agency in ags


def test_classify_avoids_ambiguous_words():
    cats, _ = classify("Bus kecelakaan makan korban di tol, api berhasil dipadamkan")
    assert "kuliner" not in cats and "energi" not in cats
    cats, _ = classify("Pura-pura jadi petugas, pelaku penipuan ditangkap")
    assert "agama" not in cats
    assert classify("Halo semuanya")[0] == ["lainnya"]


def _seed_mixed(db, now):
    src = Source(nama="s", jenis="media_sosial", url="https://x.com/s")
    db.add(src)
    db.flush()
    rows = [
        ("Listrik padam lagi, PLN kapan nyala? #PLNPadam", "negatif", 1),
        ("PLN Depok padam sejak subuh", "negatif", 2),
        ("Petugas PLN sigap perbaiki gardu", "positif", 3),
        ("Kebakaran gudang, damkar Bekasi kerahkan 8 unit", "negatif", 4),
        ("Seblak viral di Bogor, antre panjang kuliner baru", "positif", 5),
        ("Rekomendasi kuliner bakso di Tangerang", "netral", 6),
    ]
    for i, (text, sent, h) in enumerate(rows):
        it = RawItem(source_id=src.id, url_kanonik=f"m{i}", hash=f"m{i}", judul=text, isi=text, penulis=f"@u{i}",
                     published_at=now - timedelta(hours=h), fetched_at=now - timedelta(days=3), platform="X (Twitter)")
        db.add(it)
        db.flush()
        db.add(ItemAnalysis(item_id=it.id, sentimen=sent, topik="Umum"))
    db.commit()


def test_filters_facets_and_agency_board(db):
    now = datetime.utcnow()
    _seed_mixed(db, now)

    kuliner = get_social_pulse_overview(db, time_range="24h", category="kuliner")
    assert kuliner["total_mentions"] == 2
    pln = get_social_pulse_overview(db, time_range="24h", agency="pln")
    assert pln["total_mentions"] == 3

    trends = get_social_trends(db, time_range="24h", agency="pln")
    assert all(any(a["id"] == "pln" for a in t["agencies"]) for t in trends)

    facets = get_social_facets(db, time_range="24h")
    cats = {c["id"]: c["count"] for c in facets["categories"]}
    ags = {a["id"]: a for a in facets["agencies"]}
    assert cats["kuliner"] == 2 and cats["energi"] == 3
    assert ags["pln"]["count"] == 3 and ags["pln"]["negative"] == 2
    # Faset silang: dengan filter instansi PLN, kuliner jadi 0.
    assert {c["id"]: c["count"] for c in get_social_facets(db, time_range="24h", agency="pln")["categories"]}["kuliner"] == 0

    board = get_agency_board(db, time_range="24h")
    first = board["agencies"][0]
    assert first["id"] == "pln" and first["negative_count"] == 2
    assert first["share_of_voice_pct"] == 75.0  # 3 dari 4 sebutan instansi
    assert len(first["top_negative"]) == 2


def test_sort_terbaru(db):
    now = datetime.utcnow()
    _seed_mixed(db, now)
    trends = get_social_trends(db, time_range="24h", sort="terbaru")
    seen = [t["last_seen"] for t in trends]
    assert seen == sorted(seen, reverse=True)


# ---------- adaptor YouTube / Telegram / GDELT (tanpa jaringan) ----------

from backend.app.services.social_adapters import (  # noqa: E402
    is_gdelt,
    is_telegram_channel,
    is_youtube_search,
    parse_count,
    parse_gdelt,
    parse_telegram_channel,
    youtube_refresh_entry,
    youtube_video_entry,
)

TG_PAGE = """
<meta property="og:title" content="Kompas.com">
<div class="tgme_widget_message_wrap js-widget_message_wrap"><div class="tgme_widget_message text_not_supported_wrap js-widget_message" data-post="kompascom/100" data-view="x">
<div class="tgme_widget_message_text js-message_text" dir="auto">Banjir di Kemang &amp; Pejaten<br/>Pompa air mati</div>
<span class="tgme_widget_message_views">1.2K</span><time datetime="2026-11-12T07:00:00+00:00" class="time">14:00</time>
</div></div>
<div class="tgme_widget_message_wrap js-widget_message_wrap"><div class="tgme_widget_message js-widget_message" data-post="kompascom/101" data-view="y">
<div class="tgme_widget_message_photo_wrap"></div><span class="tgme_widget_message_views">50</span>
</div></div>
<div class="tgme_widget_message_wrap js-widget_message_wrap"><div class="tgme_widget_message js-widget_message" data-post="kompascom/102" data-view="z">
<div class="tgme_widget_message_text js-message_text">PLN padam di Depok</div><span class="tgme_widget_message_views">987</span>
<time datetime="2026-11-12T08:00:00+00:00"></time></div></div>
"""


def test_url_dispatch():
    assert is_youtube_search("https://www.youtube.com/results?sp=EgIIAw%3D%3D&search_query=jakarta")
    assert not is_youtube_search("https://www.youtube.com/watch?v=abc")
    assert is_telegram_channel("https://t.me/s/kompascom")
    assert not is_telegram_channel("https://t.me/kompascom")
    assert is_gdelt("https://api.gdeltproject.org/api/v2/doc/doc?query=x")


def test_parse_telegram_channel_newest_first_and_skips_media_only():
    entries = parse_telegram_channel(TG_PAGE)
    assert [e["link"] for e in entries] == ["https://t.me/kompascom/102", "https://t.me/kompascom/100"]
    first, second = entries
    assert first["_eng"]["views"] == 987 and second["_eng"]["views"] == 1200
    assert second["summary"] == "Banjir di Kemang & Pejaten Pompa air mati"
    assert second["author"] == "@kompascom" and second["_feed_title"] == "Telegram: Kompas.com"
    assert resolve_platform(first["link"]) == "Telegram"


def test_parse_count():
    assert parse_count("987") == 987 and parse_count("1.2K") == 1200 and parse_count("3,4M") == 3_400_000
    assert parse_count("") is None and parse_count("abc") is None


def test_parse_gdelt():
    payload = {"articles": [
        {"url": "https://www.jpnn.com/news/a", "title": "Banjir Bekasi meluas", "seendate": "20261112T070000Z", "domain": "jpnn.com"},
        {"url": "", "title": "tanpa url"},
    ]}
    entries = parse_gdelt(payload)
    assert len(entries) == 1
    assert entries[0]["_feed_title"] == "jpnn.com"
    assert entries[0]["_published_iso"].startswith("2026-11-12T07:00:00")
    assert resolve_platform(entries[0]["link"]) == NEWS
    assert parse_gdelt("bukan dict") == []


def test_youtube_entries():
    info = {"id": "abc", "title": "Banjir Jakarta", "channel": "CNN Indonesia", "uploader_id": "@CNNIndonesia",
            "description": "Liputan banjir", "timestamp": 1773037816, "view_count": 14461, "like_count": 82,
            "comment_count": 44, "channel_follower_count": 12000000}
    e = youtube_video_entry(info)
    assert e["link"] == "https://www.youtube.com/watch?v=abc" and e["author"] == "@CNNIndonesia"
    assert e["_eng"] == {"views": 14461, "likes": 82, "replies": 44, "followers": 12000000}
    assert resolve_platform(e["link"]) == "YouTube"
    assert youtube_video_entry({"id": "x"}) is None
    r = youtube_refresh_entry({"id": "abc", "title": "Banjir Jakarta", "view_count": 20000})
    assert r["_eng"] == {"views": 20000} and r["_refresh_only"]


def test_refetch_updates_engagement(db):
    from backend.app.services.ingestion import ingest_content_item
    first = ingest_content_item(db, None, "https://www.youtube.com/watch?v=abc", "Banjir", "Liputan banjir",
                                platform="YouTube", engagement={"views": 100, "likes": 5})
    again = ingest_content_item(db, None, "https://www.youtube.com/watch?v=abc", "Banjir", "Banjir",
                                platform="YouTube", engagement={"views": 250})
    assert again["status"] == "duplicate_exact" and again["item_id"] == first["item_id"]
    item = db.get(RawItem, first["item_id"])
    assert item.eng_views == 250 and item.eng_likes == 5  # nilai yang tidak dikirim ulang tetap


def test_engagement_summary_views_only_is_not_zero_interactions():
    from backend.app.services.social_topics import engagement_summary
    posts = [_post(1, "info cuaca", views=100, platform="Telegram"), _post(2, "info cuaca lagi", views=50, platform="Telegram")]
    summary = engagement_summary(posts)
    assert summary["views"] == 150
    assert summary["interactions"] is None and summary["likes"] is None


# ---------- periode tanggal & ringkasan ----------

from backend.app.services.social_pulse_service import get_social_brief, resolve_period  # noqa: E402


def test_resolve_period_presets_and_custom_wib():
    now = datetime(2026, 11, 12, 10, 0)  # 17:00 WIB
    p = resolve_period("30d", now)
    assert p.span == timedelta(days=30) and p.n_buckets == 30 and p.n_windows == 3

    c = resolve_period("custom:2026-11-01:2026-11-03", now)
    assert c.start == datetime(2026, 10, 31, 17, 0)  # 1 Nov 00:00 WIB
    assert c.end == datetime(2026, 11, 3, 17, 0)  # akhir 3 Nov WIB, tanggal akhir ikut dihitung
    assert c.bucket_minutes == 60 and c.n_buckets == 72
    assert c.label == "2026-11-01 s.d. 2026-11-03"

    today = resolve_period("custom:2026-11-12:2026-11-12", now)
    assert today.end == now  # dipotong di waktu sekarang


@pytest.mark.parametrize(
    "key, msg",
    [
        ("custom:2026-11-05:2026-11-01", "lebih awal"),
        ("custom:2026-01-01:2026-11-01", "maksimal"),
        ("custom:2026-12-01:2026-12-02", "masa depan"),
        ("custom:kemarin:hari-ini", "format"),
        ("90m", "tidak dikenal"),
    ],
)
def test_resolve_period_rejects_invalid(key, msg):
    with pytest.raises(ValueError, match=msg):
        resolve_period(key, datetime(2026, 11, 12, 10, 0))


def test_custom_period_filters_window_and_uses_previous_windows_as_baseline(db):
    now = datetime.utcnow()
    src = Source(nama="s", jenis="media_sosial", url="https://x.com/s")
    db.add(src)
    db.flush()
    day = (now + timedelta(hours=7)).date() - timedelta(days=3)  # tanggal WIB 3 hari lalu
    day_start_utc = datetime(day.year, day.month, day.day) - timedelta(hours=7)
    rows = [
        (day_start_utc + timedelta(hours=2), "#banjirbekasi di dalam periode"),
        (day_start_utc + timedelta(hours=5), "#banjirbekasi di dalam periode juga"),
        (day_start_utc + timedelta(hours=30), "#banjirbekasi sesudah periode"),
        (day_start_utc - timedelta(hours=10), "#banjirbekasi sehari sebelumnya"),
    ]
    for i, (ts, text) in enumerate(rows):
        db.add(RawItem(source_id=src.id, url_kanonik=f"p{i}", hash=f"p{i}", judul=text, isi=text, published_at=ts,
                       fetched_at=day_start_utc - timedelta(days=10), platform="X (Twitter)"))
    db.commit()

    key = f"custom:{day.isoformat()}:{day.isoformat()}"
    ov = get_social_pulse_overview(db, time_range=key)
    assert ov["total_mentions"] == 2
    assert ov["previous_mentions"] == 1
    assert ov["period"]["key"] == key
    assert len(ov["timeline"]) == 24  # interval 1 jam untuk periode 1 hari


def test_brief_summarizes_volume_agencies_and_caveats(db):
    now = datetime.utcnow()
    _seed_mixed(db, now)
    brief = get_social_brief(db, time_range="24h")
    kinds = [p["kind"] for p in brief["points"]]
    assert kinds[0] == "volume" and "6 konten" in brief["points"][0]["text"]
    assert "instansi" in kinds
    assert "PLN (2 konten negatif)" in next(p["text"] for p in brief["points"] if p["kind"] == "instansi")
    empty = get_social_brief(db, time_range="24h", category="olahraga")
    assert "Belum ada" in empty["points"][0]["text"]


# ---------- emosi ----------

from backend.app.services.social_emotion import classify_emotions, emotion_breakdown  # noqa: E402


@pytest.mark.parametrize(
    "text, emo",
    [
        ("PLN gak becus, sudah 5 jam padam, warga geram", "marah"),
        ("Gempa terasa kuat, warga panik dan takut masuk rumah", "takut"),
        ("Turut berduka, korban jiwa banjir bertambah", "sedih"),
        ("Sudah lapor 3 kali tapi belum ada respon, kecewa", "kecewa"),
        ("Terima kasih damkar, cepat tanggap sekali", "senang"),
        ("Heboh! Warga kaget ada buaya di kali", "terkejut"),
    ],
)
def test_classify_emotions(text, emo):
    assert emo in classify_emotions(text)


def test_emotions_none_and_breakdown():
    assert classify_emotions("Rapat koordinasi dinas berlangsung sesuai agenda") == []
    br = emotion_breakdown([["marah", "kecewa"], ["marah"], []], 3)
    assert br[0] == {"id": "marah", "label": "Marah", "count": 2, "pct": 66.7}


def test_overview_and_trends_include_emotions(db):
    now = datetime.utcnow()
    _seed_mixed(db, now)
    ov = get_social_pulse_overview(db, time_range="24h")
    assert isinstance(ov["emotion_breakdown"], list)
    t = get_social_trends(db, time_range="24h")[0]
    assert "emotions" in t and "emosi" in t["sample_mentions"][0]


# ---------- catatan analis ----------

from backend.app.models import AuditLog  # noqa: E402
from backend.app.services.social_notes import add_note, list_notes  # noqa: E402


def test_topic_notes_history_latest_status_and_audit(db):
    now = datetime.utcnow()
    _seed(db, now)
    add_note(db, "#banjirbekasi", "#banjirbekasi", "dipantau", "Rina", "Pantau tiap jam")
    add_note(db, "#banjirbekasi", "#banjirbekasi", "ditangani", "Budi", "Dinas SDA sudah turun")
    notes = list_notes(db, "#banjirbekasi")
    assert [n["status"] for n in notes] == ["ditangani", "dipantau"]
    trend = next(t for t in get_social_trends(db, time_range="24h") if t["topic_key"] == "#banjirbekasi")
    assert trend["analyst_note"]["status"] == "ditangani" and trend["analyst_note"]["count"] == 2
    assert db.query(AuditLog).filter(AuditLog.aksi == "CATATAN_TOPIK_MEDSOS").count() == 2

    with pytest.raises(ValueError):
        add_note(db, "#x", "#x", "tidak_ada", "Rina")
    with pytest.raises(ValueError):
        add_note(db, "#x", "#x", "dipantau", "  ")


# ---------- bandingkan periode ----------

from backend.app.services.social_pulse_service import get_period_comparison, previous_period  # noqa: E402


def test_previous_period_same_length():
    p = resolve_period("7d", datetime(2026, 11, 12, 10, 0))
    prev = previous_period(p)
    assert prev.end == p.start and prev.span == p.span


def test_period_comparison_deltas(db):
    now = datetime.utcnow()
    src = Source(nama="s", jenis="media_sosial", url="https://x.com/s")
    db.add(src)
    db.flush()
    rows = [  # (jam lalu, teks, sentimen)
        (2, "PLN padam di Depok #plnpadam warga geram", "negatif"),
        (3, "PLN padam lagi #plnpadam", "negatif"),
        (5, "Kuliner seblak viral di Bogor", "positif"),
        (30, "PLN padam semalam #plnpadam", "negatif"),
        (31, "Macet parah di tol Jagorawi", "negatif"),
        (33, "Macet lagi di tol Jagorawi pagi ini", "negatif"),
    ]
    for i, (h, text, sent) in enumerate(rows):
        it = RawItem(source_id=src.id, url_kanonik=f"c{i}", hash=f"c{i}", judul=text, isi=text, penulis=f"@u{i}",
                     published_at=now - timedelta(hours=h), fetched_at=now - timedelta(days=5), platform="X (Twitter)")
        db.add(it)
        db.flush()
        db.add(ItemAnalysis(item_id=it.id, sentimen=sent, topik="Umum"))
    db.commit()

    cmp = get_period_comparison(db, time_range="24h")
    assert cmp["summary_a"]["mentions"] == 3 and cmp["summary_b"]["mentions"] == 3
    cats = {c["id"]: c for c in cmp["categories"]}
    assert cats["energi"]["a"] == 2 and cats["energi"]["b"] == 1 and cats["energi"]["change_pct"] == 100.0
    assert cats["transportasi"]["a"] == 0 and cats["transportasi"]["b"] == 2
    pln = next(r for r in cmp["agencies"] if r["id"] == "pln")
    assert (pln["a"], pln["b"], pln["negative_a"]) == (2, 1, 2)
    topics = {t["id"]: t for t in cmp["topics"]}
    assert topics["#plnpadam"]["status"] == "naik"
    assert any(t["status"] == "hilang" for t in cmp["topics"])
    assert cmp["note"] is None
