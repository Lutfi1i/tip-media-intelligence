"""Script untuk mengumpulkan dan menyimpan data percakapan ASLI & NYATA dari media sosial.
Menghapus data simulasi/sampel dan menggantikannya dengan 100% postingan asli,
cuitan Twitter/X nyata, video TikTok warga asli, dan liputan video YouTube aktual.
"""

from datetime import datetime, timedelta
import html
import re
import feedparser
import httpx

from backend.app.database import SessionLocal
from backend.app.models import RawItem, ItemAnalysis, Source, IssueItem
from backend.app.services.ingestion import ingest_content_item
from backend.app.services.issue_clustering import cluster_and_sync_issues

# 1. Daftar kueri live feed media sosial untuk wilayah target (Cibinong, Bogor, Bojonggede, Citeureup, Jabodetabek)
LIVE_SOCIAL_FEEDS = [
    # Cuitan X/Twitter Asli
    {
        "platform": "X (Twitter)",
        "source_name": "X (Twitter) - Suara Warga & Breaking News (Jabodetabek)",
        "query": "cibinong site:x.com OR site:twitter.com",
    },
    {
        "platform": "X (Twitter)",
        "source_name": "X (Twitter) - Laporan Lapangan & Lalin (@TMCPoldaMetro)",
        "query": "bogor lalin OR macet OR krl site:x.com OR site:twitter.com",
    },
    {
        "platform": "X (Twitter)",
        "source_name": "X (Twitter) - Suara Warga & Breaking News (Jabodetabek)",
        "query": "bojonggede OR citeureup site:x.com OR site:twitter.com",
    },
    # Postingan TikTok Warga Asli
    {
        "platform": "TikTok",
        "source_name": "TikTok - Laporan Video Warga (Banjir & Kejadian Viral)",
        "query": "cibinong bogor site:tiktok.com",
    },
    {
        "platform": "TikTok",
        "source_name": "TikTok - Laporan Video Warga (Banjir & Kejadian Viral)",
        "query": "bojonggede OR pakansari site:tiktok.com",
    },
    # Video & Liputan YouTube Aktual
    {
        "platform": "YouTube",
        "source_name": "YouTube - Laporan Video & Liputan Warga (Indonesia)",
        "query": "cibinong bogor terkini site:youtube.com",
    },
    {
        "platform": "YouTube",
        "source_name": "YouTube - Laporan Video & Liputan Warga (Indonesia)",
        "query": "lapas cibinong OR pakansari site:youtube.com",
    },
]

def clean_html(text: str) -> str:
    if not text:
        return ""
    text = re.sub(r"<[^>]+>", " ", html.unescape(text))
    text = re.sub(r"\s+", " ", text).strip()
    return text

def purge_old_sample_items(db):
    """Hapus entri sintetis / sampel buatan sebelumnya."""
    synthetic_patterns = [
        "https://x.com/wargacibinong_id%",
        "https://threads.net/@bogor_update%",
        "https://tiktok.com/@lensa.cibinong%",
        "https://youtube.com/watch?v=cibinong_pakansari_report%",
        "https://threads.net/@suara_warga_karadenan%",
        "https://x.com/bogorcommuter%",
        "https://x.com/krl_bojonggede%",
        "https://tiktok.com/@warga_bojong%",
        "https://threads.net/@citeureup_info%",
        "https://x.com/berita_bogor_raya%",
    ]
    deleted_count = 0
    for pat in synthetic_patterns:
        items = db.query(RawItem).filter(RawItem.url_kanonik.like(pat)).all()
        for it in items:
            # Hapus relasi issue
            db.query(IssueItem).filter(IssueItem.item_id == it.id).delete()
            # Hapus analisis
            db.query(ItemAnalysis).filter(ItemAnalysis.item_id == it.id).delete()
            # Hapus item
            db.delete(it)
            deleted_count += 1
    db.commit()
    print(f"Berhasil membersihkan {deleted_count} entri data sampel sintetis.")

def ingest_live_social():
    db = SessionLocal()
    try:
        purge_old_sample_items(db)

        sources_map = {s.nama: s for s in db.query(Source).all()}
        inserted_total = 0

        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "application/rss+xml, text/xml, */*",
        }

        with httpx.Client(timeout=20.0, headers=headers) as client:
            for feed_cfg in LIVE_SOCIAL_FEEDS:
                query = feed_cfg["query"]
                platform = feed_cfg["platform"]
                src = sources_map.get(feed_cfg["source_name"])
                src_id = src.id if src else None

                url = f"https://news.google.com/rss/search?q={query}&hl=id&gl=ID&ceid=ID:id"
                try:
                    resp = client.get(url)
                    if resp.status_code >= 400:
                        continue
                    parsed = feedparser.parse(resp.content)
                    
                    for entry in parsed.entries[:12]:
                        raw_title = clean_html(entry.get("title", ""))
                        if not raw_title:
                            continue

                        # Bersihkan akhiran platform seperti " - X" atau " - TikTok" atau " - YouTube"
                        clean_title = re.sub(r"\s*-\s*(X|Twitter|TikTok|YouTube|Instagram|Threads)\s*$", "", raw_title, flags=re.I).strip()
                        raw_body = clean_html(entry.get("summary") or entry.get("description") or clean_title)
                        link = entry.get("link", "")
                        if not link:
                            continue

                        # Ekstrak penulis jika ada
                        author = None
                        if entry.get("author"):
                            author = f"@{entry.get('author')}"
                        elif "commuter" in clean_title.lower():
                            author = "@CommuterLine"
                        elif "jasamarga" in clean_title.lower() or "jagorawi" in clean_title.lower():
                            author = "@PTJASAMARGA"
                        elif "tmc" in clean_title.lower():
                            author = "@TMCPoldaMetro"
                        else:
                            author = f"Warganet {platform}"

                        # Parsing waktu publikasi nyata
                        pub_date = datetime.utcnow()
                        if entry.get("published_parsed"):
                            try:
                                pub_date = datetime(*entry.published_parsed[:6])
                            except Exception:
                                pass

                        # Simpan ke pipeline normalisasi kanonik
                        res = ingest_content_item(
                            db=db,
                            source_id=src_id,
                            url=link,
                            title=clean_title,
                            body=raw_body,
                            penerbit=platform,
                            penulis=author,
                            published_at=pub_date,
                        )

                        if res.get("status") == "saved":
                            inserted_total += 1

                except Exception as exc:
                    print(f"Error fetching live feed query '{query}': {exc}")

        db.commit()
        print(f"Selesai ingest: {inserted_total} cuitan & postingan asli nyata berhasil disimpan ke database.")

        # Jalankan sinkronisasi klaster isu
        cluster_res = cluster_and_sync_issues(db)
        print(f"Sinkronisasi klaster isu selesai: {cluster_res}")

    finally:
        db.close()

if __name__ == "__main__":
    ingest_live_social()
