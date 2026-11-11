from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from backend.app.database import get_db
from backend.app.models import Source
from backend.app.schemas import SourceCreate, SourceOut
from backend.app.services.audit import record_audit

router = APIRouter(prefix="/sources", tags=["Sources Registry"])

@router.get("", response_model=List[SourceOut])
def list_sources(db: Session = Depends(get_db)):
    return db.query(Source).all()

@router.post("", response_model=SourceOut)
def register_source(payload: SourceCreate, db: Session = Depends(get_db)):
    source = Source(
        nama=payload.nama,
        jenis=payload.jenis,
        url=payload.url,
        frekuensi_menit=payload.frekuensi_menit,
        rate_limit_per_min=payload.rate_limit_per_min,
        kredibilitas=payload.kredibilitas,
        status_izin=payload.status_izin
    )
    db.add(source)
    db.commit()
    db.refresh(source)

    record_audit(
        db,
        aktor="admin",
        peran="Admin",
        aksi="REGISTRASI_SUMBER",
        objek=f"source:{source.id}",
        detail={"nama": source.nama, "url": source.url, "izin": source.status_izin}
    )
    return source

@router.put("/{source_id}", response_model=SourceOut)
def update_source(source_id: int, payload: SourceCreate, db: Session = Depends(get_db)):
    source = db.query(Source).filter(Source.id == source_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Sumber data tidak ditemukan")

    source.nama = payload.nama
    source.jenis = payload.jenis
    source.url = payload.url
    source.frekuensi_menit = payload.frekuensi_menit
    source.rate_limit_per_min = payload.rate_limit_per_min
    source.kredibilitas = payload.kredibilitas
    source.status_izin = payload.status_izin

    db.commit()
    db.refresh(source)
    return source
