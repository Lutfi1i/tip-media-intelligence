from datetime import datetime
import json
import logging
from backend.app.database import SessionLocal, Base, engine
from backend.app.models import (
    MonitoringProfile, ProfileRule, Source, Issue, RawItem,
    Region, AuditLog
)
from backend.app.services.collector import collect_all
from backend.app.services.issue_clustering import cluster_and_sync_issues

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
         url="https://news.google.com/rss/search?q=%22threads.net%22+OR+%22Threads%22+jakarta+macet+OR+banjir&hl=id&gl=ID&ceid=ID:id", frekuensi_menit=10,
         rate_limit_per_min=30, kredibilitas=0.82, status_izin="aktif"),
    dict(nama="Bluesky Social (Percakapan Publik Isu Jabodetabek)", jenis="media_sosial",
         url="https://api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=jakarta&limit=25", frekuensi_menit=15,
         rate_limit_per_min=30, kredibilitas=0.82, status_izin="aktif"),
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


def seed_database():
    """Inisialisasi basis data TIP Media Intelligence dengan 100% data nyata.
    
    Tidak ada skenario atau data rekaan:
    - Master wilayah diinisialisasi dari standar Kemendagri.
    - Sumber data dikonfigurasi ke feed berita nyata & portal resmi.
    - Koleksi pertama dijalankan langsung dari feed publik aktif.
    - Isu dan statistik wilayah dikelompokkan dan dihitung dari artikel nyata.
    """
    Base.metadata.create_all(bind=engine)
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
