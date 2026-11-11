from datetime import datetime, timedelta
import json
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models import Case, Issue
from backend.app.schemas import CaseOut, CaseUpdate
from backend.app.services.audit import record_audit

router = APIRouter(prefix="/cases", tags=["Case Management"])

@router.get("", response_model=List[CaseOut])
def list_cases(status: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(Case)
    if status:
        query = query.filter(Case.status == status)
    cases = query.order_by(Case.tenggat.asc()).all()
    results = []
    for c in cases:
        results.append(CaseOut(
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
        ))
    return results

@router.put("/{case_id}", response_model=CaseOut)
def update_case(case_id: int, payload: CaseUpdate, db: Session = Depends(get_db)):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Kasus tidak ditemukan")

    riwayat = json.loads(case.riwayat_json or "[]")
    bukti = json.loads(case.bukti_json or "[]")

    changed = False
    if payload.pic_id:
        case.pic_id = payload.pic_id
        case.pic_nama = payload.pic_nama or payload.pic_id
        changed = True

    if payload.unit:
        case.unit = payload.unit
        changed = True

    if payload.tenggat_hours:
        case.tenggat = datetime.utcnow() + timedelta(hours=payload.tenggat_hours)
        changed = True

    if payload.status and payload.status != case.status:
        old_status = case.status
        case.status = payload.status
        changed = True
        riwayat.append({
            "waktu": datetime.utcnow().isoformat(),
            "status_sebelum": old_status,
            "status_baru": payload.status,
            "catatan": payload.bukti_catatan or f"Perubahan status menjadi {payload.status}"
        })

    if payload.bukti_catatan or payload.bukti_url:
        bukti.append({
            "waktu": datetime.utcnow().isoformat(),
            "catatan": payload.bukti_catatan,
            "url": payload.bukti_url,
            "oleh": case.pic_nama or "PIC Petugas"
        })

    case.riwayat_json = json.dumps(riwayat)
    case.bukti_json = json.dumps(bukti)
    case.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(case)

    # If case completed, update linked issue status to "selesai"
    if case.status == "selesai":
        issue = db.query(Issue).filter(Issue.id == case.issue_id).first()
        if issue:
            issue.status = "selesai"
            db.commit()

    record_audit(
        db,
        aktor=case.pic_nama or "Supervisor",
        peran="Supervisor/PIC",
        aksi="UPDATE_KASUS",
        objek=f"case:{case.id}",
        detail={"status": case.status, "pic": case.pic_nama}
    )

    return CaseOut(
        id=case.id,
        issue_id=case.issue_id,
        pic_id=case.pic_id,
        pic_nama=case.pic_nama,
        unit=case.unit,
        tenggat=case.tenggat,
        status=case.status,
        bukti=bukti,
        riwayat=riwayat,
        created_at=case.created_at,
        updated_at=case.updated_at
    )
