from datetime import datetime, timedelta
import json
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models import Issue, IssueItem, RawItem, Review, Case, Alert
from backend.app.schemas import (
    IssueOut, IssueDetailOut, RawItemOut, ItemAnalysisOut, ReviewCreate, ReviewOut, AlertOut, CaseOut
)
from backend.app.services.audit import record_audit
from backend.app.services.notification import dispatch_executive_alert
from backend.app.services.search_engine import fulltext_search_issues

router = APIRouter(prefix="/issues", tags=["Issues & Alerts"])


@router.get("/search/fulltext")
def search_issues_fulltext(q: str = Query(..., min_length=1), limit: int = 20, db: Session = Depends(get_db)):
    """FR-21: Pencarian full-text isu via OpenSearch dengan fallback SQL."""
    return fulltext_search_issues(db, q, limit=limit)

@router.get("", response_model=List[IssueOut])
def list_issues(
    status: Optional[str] = Query(None),
    level: Optional[str] = Query(None),
    wilayah: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(Issue)
    if status:
        query = query.filter(Issue.status == status)
    if level:
        query = query.filter(Issue.level == level)
    if wilayah:
        query = query.filter(Issue.wilayah.ilike(f"%{wilayah}%"))
    if q:
        query = query.filter(
            (Issue.judul.ilike(f"%{q}%")) | (Issue.ringkasan.ilike(f"%{q}%"))
        )
    return query.order_by(Issue.skor.desc(), Issue.last_updated.desc()).all()

@router.get("/{issue_id}", response_model=IssueDetailOut)
def get_issue_detail(issue_id: int, db: Session = Depends(get_db)):
    issue = db.query(Issue).filter(Issue.id == issue_id).first()
    if not issue:
        raise HTTPException(status_code=404, detail="Isu tidak ditemukan")

    raw_items_out = []
    for link in issue.items:
        item = link.raw_item
        source = item.source
        analysis = item.analysis
        analysis_out = None
        if analysis is not None:
            try:
                lokasi_disebut = json.loads(analysis.lokasi_disebut_json or "[]")
            except (TypeError, ValueError):
                lokasi_disebut = []
            analysis_out = ItemAnalysisOut(
                sentimen=analysis.sentimen,
                sentimen_confidence=analysis.sentimen_confidence,
                topik=analysis.topik,
                topik_confidence=analysis.topik_confidence,
                lokasi_kejadian=analysis.lokasi_kejadian,
                lokasi_disebut=lokasi_disebut,
                lokasi_confidence=analysis.lokasi_confidence,
                ringkasan=analysis.ringkasan,
            )
        raw_items_out.append(RawItemOut(
            id=item.id,
            source_id=item.source_id,
            url_kanonik=item.url_kanonik,
            judul=item.judul,
            isi=item.isi,
            penerbit=item.penerbit,
            published_at=item.published_at,
            fetched_at=item.fetched_at,
            is_repost=link.is_repost,
            sumber_kredibilitas=source.kredibilitas if source else None,
            sumber_nama=source.nama if source else None,
            analysis=analysis_out,
        ))

    reviews_out = []
    for r in issue.reviews:
        reviews_out.append(ReviewOut(
            id=r.id,
            reviewer_id=r.reviewer_id,
            reviewer_nama=r.reviewer_nama,
            keputusan=r.keputusan,
            koreksi_label=json.loads(r.koreksi_label_json or "{}"),
            catatan=r.catatan,
            waktu=r.waktu
        ))

    alerts_out = []
    for a in issue.alerts:
        alerts_out.append(AlertOut(
            id=a.id,
            issue_id=a.issue_id,
            level=a.level,
            penerima=a.penerima,
            kanal=a.kanal,
            konten_pesan=a.konten_pesan,
            terkirim_at=a.terkirim_at,
            diakui_at=a.diakui_at,
            status=a.status
        ))

    case_out = None
    if issue.case:
        c = issue.case
        case_out = CaseOut(
            id=c.id,
            issue_id=c.issue_id,
            pic_id=c.pic_id,
            pic_nama=c.pic_nama,
            unit=c.unit,
            tenggat=c.tenggat,
            status=c.status,
            bukti=json.loads(c.bukti_json or "[]"),
            riwayat=json.loads(c.riwayat_json or "[]"),
            created_at=c.created_at,
            updated_at=c.updated_at
        )

    return IssueDetailOut(
        id=issue.id,
        kode_referensi=issue.kode_referensi,
        judul=issue.judul,
        wilayah=issue.wilayah,
        kategori=issue.kategori,
        skor=issue.skor,
        level=issue.level,
        status=issue.status,
        ringkasan=issue.ringkasan,
        current_volume=issue.current_volume,
        repost_count=issue.repost_count,
        first_seen=issue.first_seen,
        last_updated=issue.last_updated,
        alasan_skor=json.loads(issue.alasan_skor_json or "{}"),
        pihak_terlibat=json.loads(issue.pihak_terlibat_json or "[]"),
        hal_belum_diketahui=issue.hal_belum_diketahui,
        baseline_volume=issue.baseline_volume,
        items=raw_items_out,
        reviews=reviews_out,
        alerts=alerts_out,
        case=case_out
    )

@router.post("/{issue_id}/review", response_model=IssueDetailOut)
def review_issue(issue_id: int, payload: ReviewCreate, db: Session = Depends(get_db)):
    """
    Human-in-the-loop analyst verification:
    - Verifikasi: Konfirmasi fakta & lokasi -> kirim alert jika High/Critical, buka tiket kasus
    - Koreksi: Perbaiki sentimen, lokasi, atau kategori label AI
    - Tolak: Tolak isu (false alarm, hoax, arsip lama)
    """
    issue = db.query(Issue).filter(Issue.id == issue_id).first()
    if not issue:
        raise HTTPException(status_code=404, detail="Isu tidak ditemukan")

    keputusan = payload.keputusan.lower()
    if keputusan not in ("verifikasi", "koreksi", "tolak"):
        raise HTTPException(status_code=400, detail="Keputusan harus verifikasi, koreksi, atau tolak")

    # Record review entry
    review = Review(
        issue_id=issue.id,
        reviewer_id=payload.reviewer_id,
        reviewer_nama=payload.reviewer_nama,
        keputusan=keputusan,
        koreksi_label_json=json.dumps(payload.koreksi_label),
        catatan=payload.catatan,
        waktu=datetime.utcnow()
    )
    db.add(review)

    # Update Issue status
    if keputusan == "verifikasi":
        issue.status = "terverifikasi"
        # If High or Critical, dispatch executive notification
        if issue.level in ("CRITICAL", "HIGH"):
            dispatch_executive_alert(db, issue, reviewer_catatan=payload.catatan or "Terverifikasi analis.")
            
        # Ensure Case exists
        if not issue.case:
            tenggat = datetime.utcnow() + timedelta(hours=2)
            c = Case(
                issue_id=issue.id,
                unit="Dinas Sumber Daya Air",
                tenggat=tenggat,
                status="menunggu",
                bukti_json="[]",
                riwayat_json=json.dumps([{
                    "waktu": datetime.utcnow().isoformat(),
                    "status": "menunggu",
                    "catatan": f"Kasus otomatis dibentuk setelah verifikasi analis: {payload.catatan or ''}"
                }])
            )
            db.add(c)

    elif keputusan == "koreksi":
        issue.status = "dikoreksi"
        # Apply label corrections if provided
        if "wilayah" in payload.koreksi_label:
            issue.wilayah = payload.koreksi_label["wilayah"]
        if "kategori" in payload.koreksi_label:
            issue.kategori = payload.koreksi_label["kategori"]
        if "level" in payload.koreksi_label:
            issue.level = payload.koreksi_label["level"]

    elif keputusan == "tolak":
        issue.status = "ditolak"

    issue.last_updated = datetime.utcnow()
    db.commit()

    record_audit(
        db,
        aktor=payload.reviewer_nama,
        peran="Analis",
        aksi=f"VERIFIKASI_ANALIS_{keputusan.upper()}",
        objek=f"issue:{issue.kode_referensi}",
        detail={"keputusan": keputusan, "catatan": payload.catatan}
    )

    return get_issue_detail(issue_id, db)
