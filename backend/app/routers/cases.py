from datetime import datetime, timedelta
import json
from typing import List, Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models import Case, CaseEvidence, Issue, User
from backend.app.schemas import CaseOut, CaseUpdate
from backend.app.services.audit import record_audit
from backend.app.services.auth import get_current_user
from backend.app.services.storage import get_object, put_object

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


@router.post("/{case_id}/evidence")
async def upload_case_evidence(
    case_id: int,
    file: UploadFile = File(...),
    uploaded_by: str = Form("PIC Petugas"),
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user),
):
    """FR-18: Unggah lampiran bukti tindak lanjut kasus ke MinIO/S3 atau storage lokal.

    Bila AUTH_REQUIRED aktif, get_current_user menolak permintaan tanpa token.
    Nama pengunggah diambil dari akun yang login, bukan dari isian form.
    """
    if user is not None:
        uploaded_by = user.nama
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Kasus tidak ditemukan")

    raw_bytes = await file.read()
    safe_name = (file.filename or "bukti.bin").replace("/", "_").replace("\\", "_")
    s3_key = f"cases/{case_id}/{datetime.utcnow().strftime('%Y%m%d%H%M%S')}_{safe_name}"
    put_object(s3_key, raw_bytes, content_type=file.content_type or "application/octet-stream")

    ev = CaseEvidence(
        case_id=case_id,
        filename=safe_name,
        s3_key=s3_key,
        content_type=file.content_type or "application/octet-stream",
        size_bytes=len(raw_bytes),
        uploaded_by=uploaded_by,
    )
    db.add(ev)
    db.commit()
    db.refresh(ev)

    bukti = json.loads(case.bukti_json or "[]")
    bukti.append({
        "evidence_id": ev.id,
        "waktu": ev.created_at.isoformat(),
        "catatan": f"Lampiran: {safe_name}",
        "url": f"/api/v1/cases/{case_id}/evidence/{ev.id}/download",
        "oleh": uploaded_by,
    })
    case.bukti_json = json.dumps(bukti)
    db.commit()

    record_audit(db, aktor=uploaded_by, peran="PIC", aksi="UPLOAD_BUKTI_KASUS", objek=f"case:{case_id}", detail={"filename": safe_name})
    return {"id": ev.id, "filename": safe_name, "download_url": f"/api/v1/cases/{case_id}/evidence/{ev.id}/download"}


@router.get("/{case_id}/evidence/{evidence_id}/download")
def download_case_evidence(
    case_id: int,
    evidence_id: int,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user),
):
    ev = db.query(CaseEvidence).filter(CaseEvidence.id == evidence_id, CaseEvidence.case_id == case_id).first()
    if not ev:
        raise HTTPException(status_code=404, detail="Lampiran bukti tidak ditemukan")
    data = get_object(ev.s3_key)
    if data is None:
        raise HTTPException(status_code=404, detail="File bukti tidak ditemukan di storage")
    return Response(
        content=data,
        media_type=ev.content_type or "application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{ev.filename}"'},
    )
