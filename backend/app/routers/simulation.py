from datetime import datetime, timedelta
import json
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models import (
    MonitoringProfile, ProfileRule, Source, RawItem, ItemAnalysis,
    Issue, IssueItem, Review, Alert, Case, Region
)
from backend.app.services.risk_scorer import compute_risk_score
from backend.app.services.notification import dispatch_executive_alert
from backend.app.services.audit import record_audit

router = APIRouter(prefix="/simulation", tags=["Scenario Simulator"])

@router.post("/trigger-flood-scenario")
def trigger_flood_scenario(db: Session = Depends(get_db)):
    """
    Execute end-to-end simulation of the Jakarta Selatan flood case study
    from PRD Slides 14-16.
    """
    # 1. Ensure Profile exists
    profile = db.query(MonitoringProfile).filter(
        MonitoringProfile.nama == "Kesiapsiagaan Banjir - Jakarta Selatan"
    ).first()
    if not profile:
        profile = MonitoringProfile(
            nama="Kesiapsiagaan Banjir - Jakarta Selatan",
            unit="Dinas Sumber Daya Air & BPBD",
            status="aktif",
            versi=3
        )
        db.add(profile)
        db.commit()
        db.refresh(profile)

    # 2. Check if issue already exists
    ref_code = "2611-0042"
    existing_issue = db.query(Issue).filter(Issue.kode_referensi == ref_code).first()
    if existing_issue:
        return {
            "status": "already_exists",
            "message": "Skenario Banjir Jakarta Selatan 2611-0042 sudah terpasang.",
            "issue_id": existing_issue.id
        }

    # 3. Create simulated raw sources
    sources = db.query(Source).all()
    src_media = sources[0] if sources else None
    src_pengaduan = sources[1] if len(sources) > 1 else None

    # Compute risk score for 8x spike in Kemang
    risk_data = compute_risk_score(
        relevance_score=95.0,        # Kemang & Pejaten match keywords
        growth_ratio=8.0,            # 85 items vs baseline 10 -> 8.5x
        impact_severity=75.0,        # Public roads submerged 30-50 cm
        channel_spread_count=12,     # 12 unique reports
        source_credibility=0.88,     # Verified online news + official complaints
        sentiment_urgency=82.0       # Negative 82%
    )

    now = datetime.utcnow()
    issue = Issue(
        profile_id=profile.id,
        kode_referensi=ref_code,
        judul="Genangan 30-50 cm di Kemang & Pejaten",
        wilayah="Jakarta Selatan",
        kategori="Bencana",
        skor=78.0,
        level="HIGH",
        alasan_skor_json=json.dumps(risk_data),
        status="terverifikasi",
        ringkasan="Laporan genangan di dua titik (Kemang & Pejaten). Sebagian konten menyebut pompa tidak berfungsi.",
        pihak_terlibat_json=json.dumps(["Dinas Sumber Daya Air", "BPBD DKI Jakarta", "Warga Setempat"]),
        hal_belum_diketahui="Kondisi pompa stasioner Kemang dan estimasi waktu surut air.",
        baseline_volume=10.0,
        current_volume=85,
        repost_count=73, # 12 unique from 85 contents
        first_seen=now - timedelta(hours=3, minutes=20),
        last_updated=now - timedelta(minutes=15)
    )
    db.add(issue)
    db.commit()
    db.refresh(issue)

    # 4. Attach 3 representative raw items (Media online, Kanal pengaduan, Warga)
    item1 = RawItem(
        source_id=src_media.id if src_media else None,
        url_kanonik="https://megapolitan.kompas.com/read/2026/11/11/genangan-kemang-pejaten",
        hash="hash_kemang_01",
        judul="Hujan Deras Pagi Ini, Ruas Jalan Kemang Raya Tergenang 40 Cm",
        isi="Genangan setinggi 30-50 cm terpantau di Jalan Kemang Raya dan Pejaten Barat. Pengendara diimbau mencari jalur alternatif karena sejumlah kendaraan mogok.",
        penerbit="Kompas Megapolitan",
        published_at=now - timedelta(hours=3, minutes=10)
    )
    item2 = RawItem(
        source_id=src_pengaduan.id if src_pengaduan else None,
        url_kanonik="https://crm.jakarta.go.id/laporan/2026/11/11/aduan-pompa-kemang",
        hash="hash_kemang_02",
        judul="Aduan Warga: Pompa Air Dekat Jembatan Kemang Tidak Beroperasi",
        isi="Laporan kanal pengaduan resmi: Air luapan kali naik ke badan jalan karena mesin pompa stasioner tidak menyala sejak subuh.",
        penerbit="Kanal Pengaduan Resmi Pemprov",
        published_at=now - timedelta(hours=3, minutes=5)
    )
    item3 = RawItem(
        source_id=src_media.id if src_media else None,
        url_kanonik="https://jakarta.tribunnews.com/2026/11/11/pejaten-banjir-lalin-lumpuh",
        hash="hash_kemang_03",
        judul="Lalu Lintas Pejaten Macet Total Imbas Genangan Air Naik",
        isi="Arus lalu lintas dari Pejaten menuju Mampang Prapatan tersendat akibat genangan air setinggi 35 cm. Petugas Dinas SDA mulai bergerak ke lokasi.",
        penerbit="Tribun Jakarta",
        published_at=now - timedelta(hours=3, minutes=2)
    )
    db.add_all([item1, item2, item3])
    db.commit()
    db.refresh(item1)
    db.refresh(item2)
    db.refresh(item3)

    db.add_all([
        IssueItem(issue_id=issue.id, item_id=item1.id, is_repost=False),
        IssueItem(issue_id=issue.id, item_id=item2.id, is_repost=False),
        IssueItem(issue_id=issue.id, item_id=item3.id, is_repost=False),
    ])

    # 5. Add Analyst Review
    review = Review(
        issue_id=issue.id,
        reviewer_id="analis_01",
        reviewer_nama="Analis Piket Krisis (Budi Santoso)",
        keputusan="verifikasi",
        koreksi_label_json=json.dumps({"sentimen": "negatif", "lokasi": "Kemang & Pejaten"}),
        catatan="Foto dicek bukan arsip lama. Dinas SDA mengonfirmasi pompa stasioner Kemang mengalami kendala teknis dan unit pompa bergerak sedang dikerahkan.",
        waktu=now - timedelta(hours=2, minutes=45)
    )
    db.add(review)

    # 6. Dispatch Notifications
    dispatch_executive_alert(
        db,
        issue,
        reviewer_catatan="Terverifikasi: Pompa Kemang rusak, mobilisasi pompa bergerak darurat."
    )

    # 7. Create Case
    c = Case(
        issue_id=issue.id,
        pic_id="pic_dinas_sda",
        pic_nama="Ir. Hendra (Dinas SDA)",
        unit="Dinas Sumber Daya Air",
        tenggat=now + timedelta(hours=1, minutes=25),
        status="ditangani",
        bukti_json=json.dumps([
            {
                "waktu": (now - timedelta(hours=2, minutes=10)).isoformat(),
                "catatan": "Unit pompa mobile 250 L/detik tiba di Kemang Raya dan mulai penyedotan.",
                "url": "https://sim.sda.jakarta.go.id/doc/foto-penanganan-kemang.jpg",
                "oleh": "Tim Reaksi Cepat SDA"
            }
        ]),
        riwayat_json=json.dumps([
            {
                "waktu": (now - timedelta(hours=2, minutes=40)).isoformat(),
                "status_sebelum": "menunggu",
                "status_baru": "ditangani",
                "catatan": "Kasus diakui PIC Dinas SDA. Target surut dalam 2 jam."
            }
        ])
    )
    db.add(c)

    # Update Region table
    reg_jaksel = db.query(Region).filter(Region.kode_wilayah == "31.74").first()
    if reg_jaksel:
        reg_jaksel.mention_count = 85
        reg_jaksel.unique_content_count = 12
        reg_jaksel.sentiment_negative_pct = 72.0
        reg_jaksel.top_issue = "Genangan Kemang & Pejaten"
        reg_jaksel.confidence = 0.71

    db.commit()

    record_audit(
        db,
        aktor="Skenario Simulator",
        peran="System",
        aksi="TRIGGER_SKENARIO_BANJIR_JAKSEL",
        objek=f"issue:{ref_code}",
        detail={"skor": 78, "level": "HIGH", "status": "terverifikasi"}
    )

    return {
        "status": "success",
        "message": "Skenario Banjir Kemang & Pejaten (Slide 14-16) berhasil dibuat.",
        "issue_id": issue.id,
        "kode_referensi": ref_code
    }
