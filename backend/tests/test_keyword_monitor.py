"""Tes logika Pantau Keyword yang tidak butuh jaringan, database, atau AI."""

from datetime import datetime
from types import SimpleNamespace
from urllib.parse import unquote

from backend.app.services import keyword_monitor as km
from backend.app.services.collector import _entry_origin, _unwrap_bing_news


def test_clean_terms_dedup_and_trim():
    assert km.clean_terms(["  BUMN ", "bumn", '"Danantara"', "", "a  b"]) == ["BUMN", "Danantara", "a b"]
    assert len(km.clean_terms([f"k{i}" for i in range(10)])) == km.MAX_TERMS


def test_matcher_word_boundary_and_exclusion():
    match = km.build_matcher(["BUMN"], ["lowongan"])
    assert match("Saham BUMN naik")
    assert match("#BUMN hari ini")
    assert match("kinerja BUMN-nya membaik")
    assert not match("aplikasi BUMNKU")
    assert not match("Lowongan kerja BUMN 2026")


def test_matcher_multiword_any_term():
    match = km.build_matcher(["Bank Indonesia", "BI"])
    assert match("kebijakan bank indonesia")
    assert match("BI menahan suku bunga")
    assert not match("bisnis daring")


def test_source_specs_gdelt_quotes_only_phrases():
    specs = {s["nama"]: s["url"] for s in km.source_specs("BUMN", ["BUMN"])}
    gdelt = unquote(specs["Keyword BUMN: GDELT"])
    assert 'query=BUMN sourcecountry:ID' in gdelt
    multi = {s["nama"]: s["url"] for s in km.source_specs("BI", ["BI", "Bank Indonesia"])}
    assert unquote(multi["Keyword BI: GDELT"]).endswith('query=(BI OR "Bank Indonesia") sourcecountry:ID')
    assert "mkt=id-ID" in specs["Keyword BUMN: Bing News"]
    assert "Keyword BUMN: YouTube (BUMN)" in specs
    assert "Keyword BUMN: Bluesky (BUMN)" in specs


def test_source_specs_limits_per_term_sources():
    specs = km.source_specs("X", ["a1", "b2", "c3", "d4", "e5"])
    youtube = [s for s in specs if "YouTube" in s["nama"]]
    assert len(youtube) == km.MAX_TERMS_WITH_OWN_SOURCE


def test_unwrap_bing_news_link():
    entry = {
        "link": "http://www.bing.com/news/apiclick.aspx?ref=FexRss&aid=&tid=abc&url=https%3a%2f%2fwww.msn.com%2fid-id%2fberita%2fx%2far-1&c=1",
        "news_source": "KONTAN Nasional on MSN",
    }
    _unwrap_bing_news(entry)
    assert entry["link"] == "https://www.msn.com/id-id/berita/x/ar-1"
    assert _entry_origin(entry) == ("https://www.msn.com/id-id/berita/x/ar-1", "KONTAN Nasional")


def test_unwrap_leaves_other_links():
    entry = {"link": "https://www.antaranews.com/berita/1"}
    _unwrap_bing_news(entry)
    assert entry == {"link": "https://www.antaranews.com/berita/1"}


def test_period_bounds_today_starts_midnight_wib():
    now = datetime(2026, 11, 14, 10, 0)  # 17.00 WIB
    prev, start, end = km.period_bounds("today", now)
    assert start == datetime(2026, 11, 13, 17, 0)  # 00.00 WIB
    assert end == now
    assert start - prev == end - start


def test_period_bounds_7d():
    now = datetime(2026, 11, 14, 10, 0)
    prev, start, end = km.period_bounds("7d", now)
    assert (end - start).days == 7 and (start - prev).days == 7


def _row(published, sentimen):
    return SimpleNamespace(item=SimpleNamespace(published_at=published), sentimen=sentimen)


def test_timeline_daily_buckets_in_wib():
    start, end = datetime(2026, 11, 12, 17, 0), datetime(2026, 11, 14, 10, 0)
    rows = [
        _row(datetime(2026, 11, 12, 18, 0), "positif"),  # 13 Nov 01.00 WIB
        _row(datetime(2026, 11, 13, 16, 59), "negatif"),  # 13 Nov 23.59 WIB
        _row(datetime(2026, 11, 13, 17, 0), "netral"),  # 14 Nov 00.00 WIB
    ]
    tl = km._timeline(rows, "7d", start, end)
    by_day = {p["t"][:10]: p for p in tl}
    assert by_day["2026-11-13"]["positif"] == 1 and by_day["2026-11-13"]["negatif"] == 1
    assert by_day["2026-11-14"]["netral"] == 1 and by_day["2026-11-14"]["total"] == 1


def test_context_words_skip_keyword_and_mark_sentiment():
    def r(title, s):
        return SimpleNamespace(item=SimpleNamespace(judul=title, isi=""), sentimen=s)

    rows = [r("Korupsi kredit BUMN", "negatif"), r("Kasus korupsi BUMN lagi", "negatif"), r("Laba BUMN naik", "positif")]
    words = {w["kata"]: w for w in km._context_words(rows, ["BUMN"])}
    assert "bumn" not in words
    assert words["korupsi"]["jumlah"] == 2 and words["korupsi"]["sentimen"] == "negatif"


def test_source_specs_bing_variants_and_issue_queries():
    specs = {s["nama"]: unquote(s["url"]).replace("+", " ") for s in km.source_specs("BUMN", ["BUMN"], ["Korupsi Kredit Bank BUMN"])}
    assert "sortbydate" in specs["Keyword BUMN: Bing News"]
    assert "sortbydate" not in specs["Keyword BUMN: Bing News relevan"]
    issue = specs["Keyword BUMN: Bing News isu (Korupsi Kredit Bank BUMN)"]
    assert issue.endswith('q="BUMN" Korupsi Kredit Bank')


def test_source_specs_caps_issue_queries():
    specs = km.source_specs("X", ["x"], [f"isu {i}" for i in range(10)])
    assert len([s for s in specs if "Bing News isu" in s["nama"]]) == km.MAX_ISSUE_QUERIES
