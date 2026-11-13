from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List, Dict, Any
import json

from backend.app.database import get_db
from backend.app.models import AuditLog, Review
from backend.app.schemas import AuditLogOut

router = APIRouter(prefix="/audit", tags=["Audit Trail & AI Evaluation"])

@router.get("/logs", response_model=List[AuditLogOut])
def get_audit_logs(limit: int = 50, db: Session = Depends(get_db)):
    logs = db.query(AuditLog).order_by(AuditLog.waktu.desc()).limit(limit).all()
    results = []
    for l in logs:
        results.append(AuditLogOut(
            id=l.id,
            aktor=l.aktor,
            peran=l.peran,
            aksi=l.aksi,
            objek=l.objek,
            detail=json.loads(l.detail_json or "{}"),
            ip=l.ip,
            waktu=l.waktu
        ))
    return results

@router.get("/ai-evaluation")
def get_ai_evaluation(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """FR-24: Rekap akurasi AI nyata dari koreksi analis (precision per label)."""
    reviews = db.query(Review).all()
    total_reviews = len(reviews)
    if total_reviews == 0:
        return {
            "total_reviews": 0,
            "verified_count": 0,
            "corrected_count": 0,
            "rejected_count": 0,
            "sentiment_precision": None,
            "topic_precision": None,
            "location_precision": None,
            "overall_accuracy": None,
            "status": "Belum ada data verifikasi/koreksi analis.",
        }

    verified_count = sum(1 for r in reviews if r.keputusan == "verifikasi")
    corrected_reviews = [r for r in reviews if r.keputusan == "koreksi"]
    rejected_count = sum(1 for r in reviews if r.keputusan == "tolak")

    sent_err = 0
    topic_err = 0
    loc_err = 0
    for r in corrected_reviews:
        try:
            corr = json.loads(r.koreksi_label_json or "{}")
        except Exception:
            corr = {}
        if corr.get("sentimen"):
            sent_err += 1
        if corr.get("kategori") or corr.get("topik"):
            topic_err += 1
        if corr.get("wilayah") or corr.get("lokasi"):
            loc_err += 1

    denom = max(1, verified_count + len(corrected_reviews))
    sent_prec = round(max(0.0, (denom - sent_err) / denom), 3)
    topic_prec = round(max(0.0, (denom - topic_err) / denom), 3)
    loc_prec = round(max(0.0, (denom - loc_err) / denom), 3)
    overall = round((sent_prec + topic_prec + loc_prec) / 3, 3)

    return {
        "total_reviews": total_reviews,
        "verified_count": verified_count,
        "corrected_count": len(corrected_reviews),
        "rejected_count": rejected_count,
        "sentiment_precision": sent_prec,
        "topic_precision": topic_prec,
        "location_precision": loc_prec,
        "overall_accuracy": overall,
        "status": (
            "Target NFR-12 (>= 80% presisi) terpenuhi."
            if overall >= 0.80
            else "Presisi di bawah 80%, perlu penyesuaian aturan atau model."
        ),
    }
