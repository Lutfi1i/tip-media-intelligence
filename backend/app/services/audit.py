from datetime import datetime
import json
from typing import Any, Dict, Optional
from sqlalchemy.orm import Session
from backend.app.models import AuditLog

def record_audit(
    db: Session,
    aktor: str,
    peran: str,
    aksi: str,
    objek: str,
    detail: Optional[Dict[str, Any]] = None,
    ip: str = "127.0.0.1",
) -> AuditLog:
    """Record an immutable audit log entry."""
    entry = AuditLog(
        aktor=aktor,
        peran=peran,
        aksi=aksi,
        objek=objek,
        detail_json=json.dumps(detail or {}),
        ip=ip,
        waktu=datetime.utcnow(),
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry
