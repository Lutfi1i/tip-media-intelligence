from datetime import datetime
import json
import logging
from backend.app.database import SessionLocal, engine
from backend.app.schema_sync import ensure_schema
from backend.app.models import (
    MonitoringProfile, ProfileRule, Source, Issue, RawItem,
    Region, AuditLog
)
from backend.app.services.collector import collect_all
from backend.app.services.issue_clustering import cluster_and_sync_issues
from backend.app.services.social_platform import legacy_platform

logger = logging.getLogger("tip_seed")

# Daftar sumber data nyata resmi dan publik (teruji aktif merespons)
SUMBER_NYATA = [
    dict(nama="Portal Berita Nasional (Antara News)", jenis="rss",
         url="https://www.antaranews.com/rss/terkini", frekuensi_menit=10,
         rate_limit_per_min=30, kredibilitas=0.92, status_izin="aktif"),
    dict(nama="RSS Berita Megapolitan (Antara Metro)", jenis="rss",
         url="https://www.antaranews.com/rss/metro", frekuensi_menit=10,
         rate_limit_per_min=30, kredibilitas=0.90, status_izin="aktif"),
    dict(nama="RSS Berita Nasional (detikcom)", jenis="rss",
         url="https://news.detik.com/berita/rss", frekuensi_menit=15,
         rate_limit_per_min=20, kredibilitas=0.85, status_izin="aktif"),
    dict(nama="RSS Berita Nasional (CNN Indonesia)", jenis="rss",
         url="https://www.cnnindonesia.com/nasional/rss", frekuensi_menit=15,
         rate_limit_per_min=20, kredibilitas=0.87, status_izin="aktif"),
    dict(nama="Situs Resmi Dinas Perhubungan DKI Jakarta", jenis="situs_resmi",
         url="https://dishub.jakarta.go.id/feed", frekuensi_menit=15,
         rate_limit_per_min=20, kredibilitas=0.95, status_izin="aktif"),
    dict(nama="Data Resmi BMKG (Gempa Terkini)", jenis="situs_resmi",
         url="https://data.bmkg.go.id/DataMKG/TEWS/gempaterkini.json", frekuensi_menit=10,
         rate_limit_per_min=30, kredibilitas=0.98, status_izin="aktif"),
    dict(nama="X (Twitter) - Laporan Lapangan & Lalin (@TMCPoldaMetro)", jenis="media_sosial",
         url="https://syndication.twitter.com/srv/timeline-profile/screen-name/TMCPoldaMetro", frekuensi_menit=10,
         rate_limit_per_min=20, kredibilitas=0.92, status_izin="aktif"),
    dict(nama="X (Twitter) - Suara Warga & Breaking News (Jabodetabek)", jenis="media_sosial",
         url="https://news.google.com/rss/search?q=site:x.com+OR+site:twitter.com+jakarta+OR+bogor+OR+depok+OR+tangerang+OR+bekasi&hl=id&gl=ID&ceid=ID:id", frekuensi_menit=10,
         rate_limit_per_min=30, kredibilitas=0.86, status_izin="aktif"),
    dict(nama="TikTok - Laporan Video Warga (Banjir & Kejadian Viral)", jenis="media_sosial",
         url="https://news.google.com/rss/search?q=site:tiktok.com+jakarta+kejadian+OR+banjir+OR+macet&hl=id&gl=ID&ceid=ID:id", frekuensi_menit=10,
         rate_limit_per_min=30, kredibilitas=0.84, status_izin="aktif"),
    dict(nama="Threads - Percakapan Warganet & Keluhan Publik", jenis="media_sosial",
         url="https://news.google.com/rss/search?q=site:threads.com+OR+site:threads.net+jakarta+OR+bogor+OR+depok+OR+bekasi+OR+tangerang&hl=id&gl=ID&ceid=ID:id", frekuensi_menit=10,
         rate_limit_per_min=30, kredibilitas=0.82, status_izin="aktif"),
    dict(nama="YouTube - Video Warga & Liputan Jabodetabek", jenis="media_sosial",
         url="https://www.youtube.com/results?sp=EgIIAw%3D%3D&search_query=jakarta+terkini", frekuensi_menit=30,
         rate_limit_per_min=30, kredibilitas=0.80, status_izin="aktif"),
    dict(nama="Instagram - Akun Publik & Instansi Jabodetabek", jenis="media_sosial",
         url="https://news.google.com/rss/search?q=site:instagram.com+jakarta+OR+bogor+OR+depok+OR+bekasi+OR+tangerang&hl=id&gl=ID&ceid=ID:id", frekuensi_menit=20,
         rate_limit_per_min=30, kredibilitas=0.78, status_izin="aktif"),
    dict(nama="Reddit - r/indonesia (Postingan Terbaru)", jenis="media_sosial",
         url="https://www.reddit.com/r/indonesia/new/.rss", frekuensi_menit=20,
         rate_limit_per_min=10, kredibilitas=0.70, status_izin="aktif"),
    dict(nama="TikTok - Kuliner & Jajanan Jabodetabek", jenis="media_sosial",
         url="https://news.google.com/rss/search?hl=id&gl=ID&ceid=ID:id&q=site:tiktok.com+kuliner+OR+makanan+OR+jajanan+jakarta+OR+bogor+OR+depok+OR+bekasi+OR+tangerang", frekuensi_menit=20,
         rate_limit_per_min=30, kredibilitas=0.75, status_izin="aktif"),
    dict(nama="Instagram - Kuliner & Wisata Jabodetabek", jenis="media_sosial",
         url="https://news.google.com/rss/search?hl=id&gl=ID&ceid=ID:id&q=site:instagram.com+kuliner+OR+wisata+jakarta+OR+bogor+OR+depok+OR+bekasi+OR+tangerang", frekuensi_menit=20,
         rate_limit_per_min=30, kredibilitas=0.75, status_izin="aktif"),
    dict(nama="TikTok - Konten Viral Jabodetabek", jenis="media_sosial",
         url="https://news.google.com/rss/search?hl=id&gl=ID&ceid=ID:id&q=site:tiktok.com+viral+jakarta+OR+bekasi+OR+depok+OR+tangerang+OR+bogor", frekuensi_menit=15,
         rate_limit_per_min=30, kredibilitas=0.75, status_izin="aktif"),
    dict(nama="X (Twitter) - Keluhan Layanan Instansi (PLN, PDAM, Damkar, Transportasi)", jenis="media_sosial",
         url="https://news.google.com/rss/search?hl=id&gl=ID&ceid=ID:id&q=site:x.com+pln+OR+pdam+OR+damkar+OR+%22pam+jaya%22+OR+transjakarta+OR+krl", frekuensi_menit=15,
         rate_limit_per_min=30, kredibilitas=0.82, status_izin="aktif"),
    dict(nama="YouTube - Politik & Pemerintahan Daerah", jenis="media_sosial",
         url="https://www.youtube.com/results?sp=EgIIAw%3D%3D&search_query=gubernur+jakarta", frekuensi_menit=30,
         rate_limit_per_min=30, kredibilitas=0.78, status_izin="aktif"),
    dict(nama="RSS Berita Nasional (Republika)", jenis="rss",
         url="https://www.republika.co.id/rss/", frekuensi_menit=15,
         rate_limit_per_min=20, kredibilitas=0.85, status_izin="aktif"),
    dict(nama="RSS Berita Nasional (Liputan6)", jenis="rss",
         url="https://feed.liputan6.com/rss/news", frekuensi_menit=15,
         rate_limit_per_min=20, kredibilitas=0.84, status_izin="aktif"),
    dict(nama="RSS Berita Nasional (Okezone)", jenis="rss",
         url="https://sindikasi.okezone.com/index.php/rss/1/RSS2.0", frekuensi_menit=15,
         rate_limit_per_min=20, kredibilitas=0.80, status_izin="aktif"),
    dict(nama="RSS Berita Nasional (Kumparan)", jenis="rss",
         url="https://lapi.kumparan.com/v2.0/rss/", frekuensi_menit=15,
         rate_limit_per_min=20, kredibilitas=0.82, status_izin="aktif"),
    dict(nama="Berita Megapolitan (Kompas via Google News)", jenis="rss",
         url="https://news.google.com/rss/search?hl=id&gl=ID&ceid=ID:id&q=site:megapolitan.kompas.com", frekuensi_menit=15,
         rate_limit_per_min=30, kredibilitas=0.88, status_izin="aktif"),
    dict(nama="Data Resmi BMKG (Peringatan Dini Cuaca)", jenis="situs_resmi",
         url="https://www.bmkg.go.id/alerts/nowcast/id/rss.xml", frekuensi_menit=15,
         rate_limit_per_min=20, kredibilitas=0.98, status_izin="aktif"),
    dict(nama="YouTube - Kuliner & Wisata Jabodetabek", jenis="media_sosial",
         url="https://www.youtube.com/results?sp=EgIIAw%3D%3D&search_query=kuliner+jakarta", frekuensi_menit=30,
         rate_limit_per_min=10, kredibilitas=0.75, status_izin="aktif"),
    dict(nama="Telegram - Info BMKG", jenis="media_sosial",
         url="https://t.me/s/infobmkg", frekuensi_menit=15,
         rate_limit_per_min=10, kredibilitas=0.95, status_izin="aktif"),
    dict(nama="Telegram - Antara News", jenis="media_sosial",
         url="https://t.me/s/antaranewscom", frekuensi_menit=15,
         rate_limit_per_min=10, kredibilitas=0.88, status_izin="aktif"),
    dict(nama="Telegram - Kumparan", jenis="media_sosial",
         url="https://t.me/s/kumparancom", frekuensi_menit=15,
         rate_limit_per_min=10, kredibilitas=0.86, status_izin="aktif"),
    dict(nama="Telegram - Republika", jenis="media_sosial",
         url="https://t.me/s/republikaonline", frekuensi_menit=15,
         rate_limit_per_min=10, kredibilitas=0.85, status_izin="aktif"),
    dict(nama="GDELT - Berita Jakarta (Ratusan Media Indonesia)", jenis="rss",
         url="https://api.gdeltproject.org/api/v2/doc/doc?mode=artlist&format=json&sort=datedesc&timespan=1d&query=jakarta%20sourcecountry:ID&maxrecords=75", frekuensi_menit=30,
         rate_limit_per_min=6, kredibilitas=0.80, status_izin="aktif"),
    dict(nama="GDELT - Berita Bekasi, Depok, Bogor", jenis="rss",
         url="https://api.gdeltproject.org/api/v2/doc/doc?mode=artlist&format=json&sort=datedesc&timespan=1d&query=(bekasi%20OR%20depok%20OR%20bogor)%20sourcecountry:ID&maxrecords=50", frekuensi_menit=30,
         rate_limit_per_min=6, kredibilitas=0.80, status_izin="aktif"),
    dict(nama="GDELT - Berita Tangerang", jenis="rss",
         url="https://api.gdeltproject.org/api/v2/doc/doc?mode=artlist&format=json&sort=datedesc&timespan=1d&query=tangerang%20sourcecountry:ID&maxrecords=50", frekuensi_menit=30,
         rate_limit_per_min=6, kredibilitas=0.80, status_izin="aktif"),
    dict(nama="Berita Regional Jawa Barat (Google News)", jenis="rss",
         url="https://news.google.com/rss/search?q=bandung+OR+cimahi+OR+karawang+OR+cirebon+OR+sukabumi+OR+tasikmalaya+OR+garut&hl=id&gl=ID&ceid=ID:id", frekuensi_menit=20,
         rate_limit_per_min=30, kredibilitas=0.85, status_izin="aktif"),
    dict(nama="Berita Regional Banten (Google News)", jenis="rss",
         url="https://news.google.com/rss/search?q=serang+OR+cilegon+OR+lebak+OR+pandeglang+OR+tangerang&hl=id&gl=ID&ceid=ID:id", frekuensi_menit=20,
         rate_limit_per_min=30, kredibilitas=0.85, status_izin="aktif"),
    dict(nama="Berita Regional Jawa Tengah & DIY (Google News)", jenis="rss",
         url="https://news.google.com/rss/search?q=semarang+OR+solo+OR+surakarta+OR+yogyakarta+OR+sleman+OR+purwokerto+OR+tegal&hl=id&gl=ID&ceid=ID:id", frekuensi_menit=20,
         rate_limit_per_min=30, kredibilitas=0.85, status_izin="aktif"),
    dict(nama="Berita Regional Jawa Timur (Google News)", jenis="rss",
         url="https://news.google.com/rss/search?q=surabaya+OR+sidoarjo+OR+gresik+OR+malang+OR+kediri+OR+jember+OR+banyuwangi&hl=id&gl=ID&ceid=ID:id", frekuensi_menit=20,
         rate_limit_per_min=30, kredibilitas=0.85, status_izin="aktif"),
    dict(nama="Berita Kota Bogor, Depok & Bekasi (Google News)", jenis="rss",
         url="https://news.google.com/rss/search?q=%22kota+bogor%22+OR+%22pemkot+bogor%22+OR+depok+OR+bekasi+OR+cikarang&hl=id&gl=ID&ceid=ID:id", frekuensi_menit=20,
         rate_limit_per_min=30, kredibilitas=0.85, status_izin="aktif"),
    dict(nama="Bluesky Social (Percakapan Publik Isu Jabodetabek)", jenis="media_sosial",
         url="https://api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=jakarta&limit=25", frekuensi_menit=15,
         rate_limit_per_min=30, kredibilitas=0.82, status_izin="nonaktif"),
    dict(nama="Kanal Pengaduan Resmi Pemprov DKI", jenis="pengaduan",
         url="https://crm.jakarta.go.id/api/feeds", frekuensi_menit=5,
         rate_limit_per_min=60, kredibilitas=0.95, status_izin="belum_ada_akses"),
]

# Master Data Wilayah Kemendagri (DKI Jakarta & Bodetabek)
REGIONS_MASTER = [
    dict(kode_wilayah="31.71", nama="Jakarta Pusat", tingkat="kota", lat=-6.1865, lng=106.8341),
    dict(kode_wilayah="31.72", nama="Jakarta Utara", tingkat="kota", lat=-6.1384, lng=106.8640),
    dict(kode_wilayah="31.73", nama="Jakarta Barat", tingkat="kota", lat=-6.1683, lng=106.7588),
    dict(kode_wilayah="31.74", nama="Jakarta Selatan", tingkat="kota", lat=-6.2615, lng=106.8106),
    dict(kode_wilayah="31.75", nama="Jakarta Timur", tingkat="kota", lat=-6.2250, lng=106.9004),
    dict(kode_wilayah="31.01", nama="Kepulauan Seribu", tingkat="kabupaten", lat=-5.5878, lng=106.5529),
    dict(kode_wilayah="32.71", nama="Bogor", tingkat="kota", lat=-6.5971, lng=106.8060),
    dict(kode_wilayah="32.75", nama="Bekasi", tingkat="kota", lat=-6.2383, lng=106.9756),
    dict(kode_wilayah="32.76", nama="Depok", tingkat="kota", lat=-6.4025, lng=106.7942),
    dict(kode_wilayah="36.71", nama="Tangerang", tingkat="kota", lat=-6.1783, lng=106.6319),
    dict(kode_wilayah="36.74", nama="Tangerang Selatan", tingkat="kota", lat=-6.2886, lng=106.7179),
]


def sinkronkan_sumber(db) -> int:
    """Selaraskan registri sumber dengan feed nyata."""
    perubahan = 0
    by_nama = {s.nama: s for s in db.query(Source).all()}
    for definisi in SUMBER_NYATA:
        current = by_nama.get(definisi["nama"])
        if current is None:
            db.add(Source(**definisi))
            perubahan += 1
            continue
        for field, value in definisi.items():
            if getattr(current, field) != value:
                setattr(current, field, value)
                perubahan += 1

    if perubahan:
        db.commit()
    return perubahan


def backfill_platforms(db) -> int:
    """Isi kolom platform yang masih NULL memakai tebakan dari URL, judul, dan penerbit."""
    rows = db.query(RawItem).filter(RawItem.platform.is_(None)).all()
    for row in rows:
        row.platform = legacy_platform(row.penerbit, row.url_kanonik, row.judul)
    if rows:
        db.commit()
        logger.info("Platform diisi untuk %d konten lama", len(rows))
    return len(rows)


def seed_database():
    """Inisialisasi basis data TIP Media Intelligence dengan 100% data nyata.
    
    Tidak ada skenario atau data rekaan:
    - Master wilayah diinisialisasi dari standar Kemendagri.
    - Sumber data dikonfigurasi ke feed berita nyata & portal resmi.
    - Koleksi pertama dijalankan langsung dari feed publik aktif.
    - Isu dan statistik wilayah dikelompokkan dan dihitung dari artikel nyata.
    """
    ensure_schema(engine)
    db = SessionLocal()

    # 1. Inisialisasi Wilayah bila belum ada
    if not db.query(Region).first():
        for reg in REGIONS_MASTER:
            db.add(Region(
                kode_wilayah=reg["kode_wilayah"],
                nama=reg["nama"],
                tingkat=reg["tingkat"],
                lat=reg["lat"],
                lng=reg["lng"],
                mention_count=0,
                unique_content_count=0,
                sentiment_negative_pct=0.0,
                top_issue=None,
                confidence=0.85
            ))
        db.commit()

    # 2. Inisialisasi Sumber Berita Nyata
    sinkronkan_sumber(db)

    # 3. Inisialisasi Profil Monitoring Bencana & Layanan Publik
    if not db.query(MonitoringProfile).first():
        profile = MonitoringProfile(
            nama="Pemantauan Isu Publik & Layanan Jabodetabek",
            unit="Pusat Komando & Penanganan Krisis Daerah",
            status="aktif",
            versi=1
        )
        db.add(profile)
        db.commit()
        db.refresh(profile)

        rule = ProfileRule(
            profile_id=profile.id,
            versi=1,
            wilayah_json=json.dumps([r["nama"] for r in REGIONS_MASTER]),
            keyword_json=json.dumps([
                "banjir", "genangan", "macet", "jalan rusak", "layanan",
                "antrean", "cuaca", "gempa", "kebakaran", "transportasi",
                "sampah", "listrik", "air", "pangan"
            ]),
            sinonim_json=json.dumps([
                "luapan kali", "pompa mati", "jalan tergenang", "kemacetan panjang",
                "gangguan server", "pemadaman"
            ]),
            pengecualian_json=json.dumps(["banjir diskon", "banjir order", "banjir bonus"]),
            kategori_json=json.dumps(["Bencana", "Infrastruktur", "Pelayanan Publik", "Lingkungan", "Sosial"]),
            ambang_multiplier=3.0
        )
        db.add(rule)
        db.commit()

    # 3b. Lengkapi kolom platform untuk baris lama yang dibuat sebelum kolom itu ada.
    backfill_platforms(db)

    # 4. Tarik data nyata pertama kali jika belum ada RawItem
    total_raw = db.query(RawItem).count()
    if total_raw == 0:
        logger.info("Menarik data nyata perdana dari feed berita resmi...")
        collect_all(db, force=True)
        cluster_and_sync_issues(db)

    # 5. Catat audit inisialisasi sistem
    if not db.query(AuditLog).first():
        db.add(AuditLog(
            aktor="sistem",
            peran="Sistem",
            aksi="INISIALISASI_SISTEM_DATA_NYATA",
            objek="system:init",
            detail_json=json.dumps({
                "mode": "100% data nyata",
                "wilayah_terdaftar": len(REGIONS_MASTER),
                "sumber_terdaftar": len(SUMBER_NYATA)
            }),
            ip="127.0.0.1",
            waktu=datetime.utcnow()
        ))
        db.commit()

    db.close()


if __name__ == "__main__":
    seed_database()
    print("Database berhasil diinisialisasi dengan data nyata.")
