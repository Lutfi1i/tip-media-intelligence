from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from typing import List
import json

from backend.app.database import get_db
from backend.app.models import Report
from backend.app.schemas import ReportOut
from backend.app.services.report_generator import generate_report_document
from backend.app.services.audit import record_audit

router = APIRouter(prefix="/reports", tags=["Executive Reports"])

@router.get("", response_model=List[ReportOut])
def list_reports(db: Session = Depends(get_db)):
    reports = db.query(Report).order_by(Report.created_at.desc()).all()
    results = []
    for r in reports:
        results.append(ReportOut(
            id=r.id,
            judul=r.judul,
            jenis=r.jenis,
            periode=r.periode,
            file_url=r.file_url,
            dibuat_oleh=r.dibuat_oleh,
            created_at=r.created_at,
            data_snapshot=json.loads(r.data_snapshot_json or "{}")
        ))
    return results

@router.post("/generate", response_model=ReportOut)
def create_report(
    jenis: str = "mingguan",
    periode: str = "9-15 November 2026",
    db: Session = Depends(get_db)
):
    report = generate_report_document(db, jenis=jenis, periode=periode)

    record_audit(
        db,
        aktor="Sistem Otomatis",
        peran="Admin",
        aksi="GENERATE_LAPORAN_EKSEKUTIF",
        objek=f"report:{report.id}",
        detail={"jenis": jenis, "periode": periode}
    )

    return ReportOut(
        id=report.id,
        judul=report.judul,
        jenis=report.jenis,
        periode=report.periode,
        file_url=report.file_url,
        dibuat_oleh=report.dibuat_oleh,
        created_at=report.created_at,
        data_snapshot=json.loads(report.data_snapshot_json or "{}")
    )

@router.get("/{report_id}/view")
def view_report_html(report_id: int, db: Session = Depends(get_db)):
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Laporan tidak ditemukan")

    data = json.loads(report.data_snapshot_json or "{}")
    html_content = data.get("rendered_html")
    if not html_content:
        raise HTTPException(status_code=404, detail="Isi laporan HTML tidak tersedia")

    return Response(content=html_content, media_type="text/html")
