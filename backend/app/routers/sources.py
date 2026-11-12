from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from backend.app.database import get_db
from backend.app.models import Source
from backend.app.schemas import SourceCreate, SourceOut
from backend.app.services.audit import record_audit
from backend.app.services.collector import collect_all
from backend.app.services.issue_clustering import cluster_and_sync_issues
from backend.app.services.social_escalation import escalate_social_surges
from backend.app.services.social_alert_rules import evaluate_rules

router = APIRouter(prefix="/sources", tags=["Sources Registry"])

@router.get("", response_model=List[SourceOut])
def list_sources(db: Session = Depends(get_db)):
    return db.query(Source).all()


@router.post("/poll")
def poll_sources(force: bool = True, db: Session = Depends(get_db)):
    """Tarik data nyata dari semua sumber berizin aktif (RSS/Atom/API resmi) dan kluster isu otomatis.

    `force=true` mengabaikan jeda frekuensi; default true agar tombol UI selalu memberi hasil.
    """
    hasil = collect_all(db, force=force)
    clustering = cluster_and_sync_issues(db)
    hasil["clustering"] = clustering
    hasil["eskalasi_medsos"] = escalate_social_surges(db)
    hasil["alert_medsos"] = evaluate_rules(db)
    record_audit(
        db,
        aktor="sistem",
        peran="Sistem",
        aksi="TARIK_DATA_SUMBER",
        objek="sources:poll",
        detail={
            "dibaca": hasil["total_dibaca"],
            "baru": hasil["total_baru"],
            "duplikat": hasil["total_duplikat"],
            "gagal": hasil["total_gagal"],
            "clustering": clustering,
        },
    )
    return hasil

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
