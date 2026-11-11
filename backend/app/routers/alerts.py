from datetime import datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models import Alert
from backend.app.schemas import AlertOut
from backend.app.services.audit import record_audit

router = APIRouter(prefix="/alerts", tags=["Alerts"])

@router.get("", response_model=List[AlertOut])
def list_alerts(db: Session = Depends(get_db)):
    return db.query(Alert).order_by(Alert.terkirim_at.desc()).all()

@router.post("/{alert_id}/acknowledge", response_model=AlertOut)
def acknowledge_alert(alert_id: int, user_nama: str = "Pimpinan Siaga", db: Session = Depends(get_db)):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert tidak ditemukan")

    alert.diakui_at = datetime.utcnow()
    alert.status = "diakui"
    db.commit()
    db.refresh(alert)

    record_audit(
        db,
        aktor=user_nama,
        peran="Pimpinan",
        aksi="ACKNOWLEDGE_ALERT",
        objek=f"alert:{alert.id}",
        detail={"issue_id": alert.issue_id, "kanal": alert.kanal}
    )

    return alert
