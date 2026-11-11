from datetime import datetime, timedelta
import json
from backend.app.database import SessionLocal, Base, engine
from backend.app.models import (
    MonitoringProfile, ProfileRule, Source, Issue, RawItem,
    IssueItem, Review, Alert, Case, Region, Report, AuditLog
)
from backend.app.services.risk_scorer import compute_risk_score

def sync_issue_scores(db) -> int:
    """Samakan skor/level tersimpan dengan breakdown yang dihitung risk scorer.

    Seed lama menulis skor manual (mis. 78/HIGH) sementara alasan_skor_json
    berisi hasil hitung (mis. 90.8/CRITICAL) sehingga UI menampilkan dua
    kebenaran sekaligus. Breakdown selalu jadi acuan.
    """
    fixed = 0
    for issue in db.query(Issue).all():
        if not issue.alasan_skor_json:
            continue
        try:
            alasan = json.loads(issue.alasan_skor_json)
        except (TypeError, ValueError):
            continue
        skor = alasan.get("skor_akhir")
        level = alasan.get("level")
        if skor is None or not level:
            continue
        if abs(float(issue.skor or 0) - float(skor)) > 0.05 or issue.level != level:
            issue.skor = float(skor)
            issue.level = level
            fixed += 1
    if fixed:
        db.commit()
    return fixed


# Daftar sumber nyata (feed publik yang sudah diuji merespons). Dipakai saat seeding awal
# maupun untuk memperbaiki instalasi lama yang masih menyimpan URL mati.
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
    dict(nama="Kanal Pengaduan Resmi Pemprov DKI", jenis="pengaduan",
         url="https://crm.jakarta.go.id/api/feeds", frekuensi_menit=5,
         rate_limit_per_min=60, kredibilitas=0.95, status_izin="belum_ada_akses"),
]

# Sumber lama yang URL-nya sudah mati (404/403) atau duplikat dari sumber baru.
SUMBER_LEGACY = {
    "Portal Berita Nasional & Megapolitan",
    "RSS Berita Daerah Jabodetabek",
    "Situs Resmi BPBD & BMKG",
}


def sinkronkan_sumber(db) -> int:
    """Selaraskan registri sumber dengan feed nyata. Mengembalikan jumlah perubahan.

    - Sumber legacy (URL mati / duplikat) ditandai 'digabung' agar tidak diambil lagi.
    - Sumber pada SUMBER_NYATA dibuat bila belum ada, atau diselaraskan bila sudah ada.
    """
    perubahan = 0

    for sumber in db.query(Source).all():
        if sumber.nama in SUMBER_LEGACY and sumber.status_izin != "digabung":
            sumber.status_izin = "digabung"
            perubahan += 1

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
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    # Check if already seeded
    if db.query(Region).first():
        sync_issue_scores(db)
        sinkronkan_sumber(db)
        db.close()
        return

    now = datetime.utcnow()

    # 1. Seed Regions (DKI Jakarta & Bodetabek)
    regions_data = [
        Region(
            kode_wilayah="31.74", nama="Jakarta Selatan", tingkat="kota",
            lat=-6.2615, lng=106.8106, mention_count=85, unique_content_count=12,
            sentiment_negative_pct=72.0, top_issue="Banjir Kemang & Pejaten", confidence=0.71
        ),
        Region(
            kode_wilayah="31.75", nama="Jakarta Timur", tingkat="kota",
            lat=-6.2250, lng=106.9004, mention_count=31, unique_content_count=8,
            sentiment_negative_pct=45.0, top_issue="Antrean layanan Jaktim", confidence=0.82
        ),
        Region(
            kode_wilayah="31.73", nama="Jakarta Barat", tingkat="kota",
            lat=-6.1683, lng=106.7588, mention_count=24, unique_content_count=6,
            sentiment_negative_pct=38.0, top_issue="Lalu lintas Jakbar", confidence=0.79
        ),
        Region(
            kode_wilayah="31.72", nama="Jakarta Utara", tingkat="kota",
            lat=-6.1384, lng=106.8640, mention_count=18, unique_content_count=5,
            sentiment_negative_pct=25.0, top_issue="Lampu jalan Jakut", confidence=0.88
        ),
        Region(
            kode_wilayah="31.71", nama="Jakarta Pusat", tingkat="kota",
            lat=-6.1865, lng=106.8341, mention_count=14, unique_content_count=4,
            sentiment_negative_pct=30.0, top_issue="Parkir liar Senen", confidence=0.84
        ),
        Region(
            kode_wilayah="32.75", nama="Bekasi", tingkat="kota",
            lat=-6.2383, lng=106.9756, mention_count=11, unique_content_count=3,
            sentiment_negative_pct=20.0, top_issue="Perbaikan jalan Kalimalang", confidence=0.75
        ),
        Region(
            kode_wilayah="32.71", nama="Bogor", tingkat="kota",
            lat=-6.5971, lng=106.8060, mention_count=12, unique_content_count=3,
            sentiment_negative_pct=28.0, top_issue="Kondisi Bendung Katulampa", confidence=0.80
        ),
        Region(
            kode_wilayah="32.76", nama="Depok", tingkat="kota",
            lat=-6.4025, lng=106.7942, mention_count=9, unique_content_count=2,
            sentiment_negative_pct=22.0, top_issue="Drainase Margonda", confidence=0.78
        ),
    ]
    db.add_all(regions_data)
    db.commit()

    # 2. Seed Sources — hanya feed publik yang benar-benar merespons (diuji 2026-11-11).
    sources_data = [
        Source(
            nama="Portal Berita Nasional (Antara News)", jenis="rss",
            url="https://www.antaranews.com/rss/terkini", frekuensi_menit=10,
            rate_limit_per_min=30, kredibilitas=0.92, status_izin="aktif"
        ),
        Source(
            nama="RSS Berita Megapolitan (Antara Metro)", jenis="rss",
            url="https://www.antaranews.com/rss/metro", frekuensi_menit=10,
            rate_limit_per_min=30, kredibilitas=0.90, status_izin="aktif"
        ),
        Source(
            nama="RSS Berita Nasional (detikcom)", jenis="rss",
            url="https://news.detik.com/berita/rss", frekuensi_menit=15,
            rate_limit_per_min=20, kredibilitas=0.85, status_izin="aktif"
        ),
        Source(
            nama="RSS Berita Nasional (CNN Indonesia)", jenis="rss",
            url="https://www.cnnindonesia.com/nasional/rss", frekuensi_menit=15,
            rate_limit_per_min=20, kredibilitas=0.87, status_izin="aktif"
        ),
        Source(
            nama="Situs Resmi Dinas Perhubungan DKI Jakarta", jenis="situs_resmi",
            url="https://dishub.jakarta.go.id/feed", frekuensi_menit=15,
            rate_limit_per_min=20, kredibilitas=0.95, status_izin="aktif"
        ),
        Source(
            nama="Data Resmi BMKG (Gempa Terkini)", jenis="situs_resmi",
            url="https://data.bmkg.go.id/DataMKG/TEWS/gempaterkini.json", frekuensi_menit=10,
            rate_limit_per_min=30, kredibilitas=0.98, status_izin="aktif"
        ),
        Source(
            nama="Kanal Pengaduan Resmi Pemprov DKI", jenis="pengaduan",
            url="https://crm.jakarta.go.id/api/feeds", frekuensi_menit=5,
            rate_limit_per_min=60, kredibilitas=0.95, status_izin="belum_ada_akses"
        ),
    ]
    db.add_all(sources_data)
    db.commit()

    # 3. Seed Monitoring Profile
    profile = MonitoringProfile(
        nama="Kesiapsiagaan Banjir - Jakarta Selatan",
        unit="Dinas Sumber Daya Air & BPBD",
        status="aktif",
        versi=3
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)

    rule = ProfileRule(
        profile_id=profile.id,
        versi=3,
        wilayah_json=json.dumps(["Jakarta Selatan", "Kebayoran Baru", "Pasar Minggu"]),
        keyword_json=json.dumps(["banjir", "genangan", "drainase", "air naik"]),
        sinonim_json=json.dumps(["luapan kali", "pompa mati", "jalan tergenang"]),
        pengecualian_json=json.dumps(["banjir diskon", "banjir order"]),
        kategori_json=json.dumps(["Bencana", "Infrastruktur"]),
        ambang_multiplier=3.0
    )
    db.add(rule)
    db.commit()

    # 4. Seed 5 Main Issues from Mockup
    # Issue 1: Banjir Kemang & Pejaten (Slide 11 & 12)
    risk1 = compute_risk_score(95.0, 8.0, 75.0, 12, 0.88, 82.0)
    issue1 = Issue(
        profile_id=profile.id,
        kode_referensi="2611-0042",
        judul="Genangan 30-50 cm di Kemang & Pejaten",
        wilayah="Jakarta Selatan",
        kategori="Bencana",
        skor=risk1["skor_akhir"],
        level=risk1["level"],
        alasan_skor_json=json.dumps(risk1),
        status="terverifikasi",
        ringkasan="Laporan genangan di dua titik (Kemang & Pejaten); sebagian konten menyebut pompa tidak berfungsi.",
        pihak_terlibat_json=json.dumps(["Dinas Sumber Daya Air", "BPBD", "Pengguna Jalan"]),
        hal_belum_diketahui="Kondisi pompa cadangan mobile dan waktu perbaikan pompa utama.",
        baseline_volume=10.0,
        current_volume=85,
        repost_count=73,
        first_seen=now - timedelta(hours=3, minutes=20),
        last_updated=now - timedelta(minutes=15)
    )

    # Issue 2: Antrean layanan Jaktim
    risk2 = compute_risk_score(75.0, 3.5, 65.0, 8, 0.90, 70.0)
    issue2 = Issue(
        profile_id=profile.id,
        kode_referensi="2611-0043",
        judul="Antrean Layanan Kependudukan Membludak di Jaktim",
        wilayah="Jakarta Timur",
        kategori="Pelayanan Publik",
        skor=risk2["skor_akhir"],
        level=risk2["level"],
        alasan_skor_json=json.dumps(risk2),
        status="terverifikasi",
        ringkasan="Gangguan server pencetakan identitas menyebabkan antrean warga sejak pukul 07.00 WIB.",
        pihak_terlibat_json=json.dumps(["Dukcapil Jakarta Timur", "Warga Pemohon"]),
        hal_belum_diketahui="Estimasi pemulihan sinkronisasi server pusat.",
        baseline_volume=8.0,
        current_volume=31,
        repost_count=23,
        first_seen=now - timedelta(hours=2),
        last_updated=now - timedelta(minutes=30)
    )

    # Issue 3: Lalu lintas Jakbar
    risk3 = compute_risk_score(55.0, 2.0, 45.0, 6, 0.85, 48.0)
    issue3 = Issue(
        profile_id=profile.id,
        kode_referensi="2611-0044",
        judul="Kepadatan Arus Lalu Lintas Simpang Tomang Jakbar",
        wilayah="Jakarta Barat",
        kategori="Infrastruktur",
        skor=risk3["skor_akhir"],
        level=risk3["level"],
        alasan_skor_json=json.dumps(risk3),
        status="terverifikasi",
        ringkasan="Kepadatan akibat perbaikan median jalan tol dalam kota.",
        pihak_terlibat_json=json.dumps(["Dinas Perhubungan", "Pengendara"]),
        hal_belum_diketahui="Jadwal penyelesaian pengaspalan ulang.",
        baseline_volume=12.0,
        current_volume=24,
        repost_count=18,
        first_seen=now - timedelta(hours=4),
        last_updated=now - timedelta(hours=1)
    )

    # Issue 4: Drainase Depok
    risk4 = compute_risk_score(35.0, 1.2, 30.0, 3, 0.80, 35.0)
    issue4 = Issue(
        profile_id=profile.id,
        kode_referensi="2611-0045",
        judul="Penyumbatan Saluran Drainase Jalan Margonda Depok",
        wilayah="Depok",
        kategori="Infrastruktur",
        skor=risk4["skor_akhir"],
        level=risk4["level"],
        alasan_skor_json=json.dumps(risk4),
        status="kandidat",
        ringkasan="Sampah menyumbat gorong-gorong pasca hujan rintik semalam.",
        pihak_terlibat_json=json.dumps(["Dinas PUPR Depok"]),
        hal_belum_diketahui="Jadwal pengangkutan tim kebersihan.",
        baseline_volume=7.0,
        current_volume=9,
        repost_count=7,
        first_seen=now - timedelta(hours=5),
        last_updated=now - timedelta(hours=2)
    )

    # Issue 5: Lampu jalan Jakut (Completed)
    risk5 = compute_risk_score(40.0, 1.5, 35.0, 4, 0.85, 30.0)
    issue5 = Issue(
        profile_id=profile.id,
        kode_referensi="2611-0040",
        judul="PJU Padam di Akses Pelabuhan Tanjung Priok Jakut",
        wilayah="Jakarta Utara",
        kategori="Infrastruktur",
        skor=risk5["skor_akhir"],
        level=risk5["level"],
        alasan_skor_json=json.dumps(risk5),
        status="selesai",
        ringkasan="Lampu penerangan jalan umum padam sepanjang 300 meter.",
        pihak_terlibat_json=json.dumps(["Dinas Bina Marga Jakut"]),
        hal_belum_diketahui="Nihil",
        baseline_volume=10.0,
        current_volume=18,
        repost_count=13,
        first_seen=now - timedelta(days=1),
        last_updated=now - timedelta(hours=6)
    )

    db.add_all([issue1, issue2, issue3, issue4, issue5])
    db.commit()
    db.refresh(issue1)
    db.refresh(issue2)
    db.refresh(issue3)
    db.refresh(issue4)
    db.refresh(issue5)

    # Attach raw items for Issue 1
    src = db.query(Source).first()
    item_kemang1 = RawItem(
        source_id=src.id if src else None,
        url_kanonik="https://megapolitan.kompas.com/read/2026/11/11/kemang-pejaten-banjir",
        hash="hash_01",
        judul="Genangan 30-50 cm Terjang Kemang & Pejaten Pagi Ini",
        isi="Hujan dengan intensitas tinggi memicu genangan di kawasan Kemang Raya dan Pejaten Barat setinggi 30 hingga 50 cm. Sejumlah kendaraan mogok.",
        penerbit="Media Online Nasional",
        published_at=now - timedelta(hours=3, minutes=10)
    )
    item_kemang2 = RawItem(
        source_id=src.id if src else None,
        url_kanonik="https://crm.jakarta.go.id/aduan/20261111-0012",
        hash="hash_02",
        judul="Laporan Warga: Pompa Air Kemang Mogok",
        isi="Warga melaporkan pompa stasioner tidak menyala maksimal sehingga air lambat surut.",
        penerbit="Kanal Pengaduan Resmi",
        published_at=now - timedelta(hours=3, minutes=5)
    )
    db.add_all([item_kemang1, item_kemang2])
    db.commit()
    db.refresh(item_kemang1)
    db.refresh(item_kemang2)

    db.add_all([
        IssueItem(issue_id=issue1.id, item_id=item_kemang1.id, is_repost=False),
        IssueItem(issue_id=issue1.id, item_id=item_kemang2.id, is_repost=False),
    ])

    # 5. Reviews for Issue 1
    rev1 = Review(
        issue_id=issue1.id,
        reviewer_id="analis_01",
        reviewer_nama="Analis Piket (Budi Santoso)",
        keputusan="verifikasi",
        koreksi_label_json=json.dumps({"sentimen": "negatif", "lokasi": "Kemang & Pejaten"}),
        catatan="Foto dicek bukan arsip lama. Dinas SDA mengonfirmasi pompa Kemang mengalami gangguan teknis.",
        waktu=now - timedelta(hours=2, minutes=45)
    )
    db.add(rev1)

    # 6. Alerts for Issue 1
    alt1 = Alert(
        issue_id=issue1.id,
        level="HIGH",
        penerima="+628****7890 (Pimpinan Siaga)",
        kanal="whatsapp",
        konten_pesan=(
            "[ALERT HIGH] Banjir Jakarta Selatan\n"
            "Genangan 30-50 cm di Kemang & Pejaten.\n"
            "Terverifikasi: pompa Kemang rusak.\n"
            "PIC: Dinas SDA | Tenggat: 2 jam"
        ),
        terkirim_at=now - timedelta(hours=2, minutes=30),
        diakui_at=now - timedelta(hours=2, minutes=20),
        status="diakui"
    )
    alt2 = Alert(
        issue_id=issue1.id,
        level="HIGH",
        penerima="@tip_command_center_bot",
        kanal="telegram",
        konten_pesan="[ALERT HIGH] Genangan 30-50 cm di Kemang & Pejaten terverifikasi.",
        terkirim_at=now - timedelta(hours=2, minutes=30),
        status="terkirim"
    )
    db.add_all([alt1, alt2])

    # 7. Seed Cases matching Slide 12:
    # Menunggu (2):
    # - Antrean layanan Jaktim (HIGH, belum ada PIC)
    # - Drainase Depok (LOW, dipantau)
    case_wait1 = Case(
        issue_id=issue2.id,
        pic_id=None,
        pic_nama=None,
        unit="Dinas Dukcapil Jaktim",
        tenggat=now + timedelta(hours=3),
        status="menunggu",
        bukti_json="[]",
        riwayat_json=json.dumps([{
            "waktu": (now - timedelta(hours=2)).isoformat(),
            "status_baru": "menunggu",
            "catatan": "Kasus terdaftar di antrean pantau, menunggu penugasan PIC."
        }])
    )
    case_wait2 = Case(
        issue_id=issue4.id,
        pic_id="pic_pupr_depok",
        pic_nama="Satgas Drainase Margonda",
        unit="Dinas PUPR Depok",
        tenggat=now + timedelta(hours=8),
        status="menunggu",
        bukti_json="[]",
        riwayat_json=json.dumps([{
            "waktu": (now - timedelta(hours=5)).isoformat(),
            "status_baru": "menunggu",
            "catatan": "Status dipantau berkala."
        }])
    )

    # Ditangani (2):
    # - Banjir Kemang & Pejaten (PIC Dinas SDA, sisa 1j 25m)
    # - Lalu lintas Jakbar (PIC Dishub, info publik)
    case_prog1 = Case(
        issue_id=issue1.id,
        pic_id="pic_dinas_sda",
        pic_nama="Dinas Sumber Daya Air",
        unit="Dinas SDA",
        tenggat=now + timedelta(hours=1, minutes=25),
        status="ditangani",
        bukti_json=json.dumps([{
            "waktu": (now - timedelta(hours=2)).isoformat(),
            "catatan": "Pompa mobile 250 L/dtk dikerahkan ke lokasi.",
            "url": "https://example.com/bukti-pompa-mobile.jpg",
            "oleh": "Tim Reaksi Cepat SDA"
        }]),
        riwayat_json=json.dumps([
            {
                "waktu": (now - timedelta(hours=2, minutes=30)).isoformat(),
                "status_sebelum": "menunggu",
                "status_baru": "ditangani",
                "catatan": "Pimpinan menyetujui rekomendasi, tugas diserahkan ke Dinas SDA."
            }
        ])
    )
    case_prog2 = Case(
        issue_id=issue3.id,
        pic_id="pic_dishub",
        pic_nama="Petugas TMC Dishub",
        unit="Dinas Perhubungan",
        tenggat=now + timedelta(hours=4),
        status="ditangani",
        bukti_json=json.dumps([{
            "waktu": (now - timedelta(hours=1)).isoformat(),
            "catatan": "Informasi rekayasa lalu lintas telah disiarkan melalui kanal resmi.",
            "url": "https://example.com/pengalihan-arus.jpg",
            "oleh": "PIC Dishub"
        }]),
        riwayat_json=json.dumps([
            {
                "waktu": (now - timedelta(hours=3)).isoformat(),
                "status_sebelum": "menunggu",
                "status_baru": "ditangani",
                "catatan": "Koordinasi penempatan personel pengatur lalin di Tomang."
            }
        ])
    )

    # Selesai (1):
    # - Lampu jalan Jakut (Bukti perbaikan terlampir)
    case_done1 = Case(
        issue_id=issue5.id,
        pic_id="pic_bina_marga",
        pic_nama="Dinas Bina Marga Jakut",
        unit="Dinas Bina Marga",
        tenggat=now - timedelta(hours=2),
        status="selesai",
        bukti_json=json.dumps([{
            "waktu": (now - timedelta(hours=6)).isoformat(),
            "catatan": "Penggantian modul trafo selesai, 12 titik PJU menyala normal.",
            "url": "https://example.com/bukti-lampu-pju.jpg",
            "oleh": "Regu Lapangan Jakut"
        }]),
        riwayat_json=json.dumps([
            {
                "waktu": (now - timedelta(hours=6)).isoformat(),
                "status_sebelum": "ditangani",
                "status_baru": "selesai",
                "catatan": "Perbaikan tuntas terverifikasi foto dokumentasi."
            }
        ])
    )

    db.add_all([case_wait1, case_wait2, case_prog1, case_prog2, case_done1])
    db.commit()

    # 8. Seed Initial Report
    report1 = Report(
        judul="Laporan Mingguan Intelijen Media & Respon Krisis",
        jenis="mingguan",
        periode="9-15 November 2026",
        file_url="/reports/laporan_mingguan_20261115.html",
        data_snapshot_json=json.dumps({
            "kpi": {
                "mention_unik": 1284,
                "isu_prioritas": 18,
                "wilayah_terdampak": 7,
                "kasus_selesai": 6
            }
        }),
        dibuat_oleh="Sistem Analitik TIP MI"
    )
    db.add(report1)

    # 9. Seed Audit Logs
    audit1 = AuditLog(
        aktor="Analis Piket (Budi Santoso)",
        peran="Analis",
        aksi="VERIFIKASI_ANALIS_VERIFIKASI",
        objek="issue:2611-0042",
        detail_json=json.dumps({"keputusan": "verifikasi", "catatan": "Fakta pompa rusak valid"}),
        ip="10.12.0.4",
        waktu=now - timedelta(hours=2, minutes=45)
    )
    audit2 = AuditLog(
        aktor="Pimpinan Siaga",
        peran="Pimpinan",
        aksi="ESKALASI_KASUS_DISPATCH",
        objek="case:1",
        detail_json=json.dumps({"pic": "Dinas SDA", "tenggat_jam": 2}),
        ip="10.12.0.1",
        waktu=now - timedelta(hours=2, minutes=30)
    )
    db.add_all([audit1, audit2])

    db.commit()
    sync_issue_scores(db)
    db.close()

if __name__ == "__main__":
    seed_database()
    print("Database seeded successfully with PRD mockup data.")
