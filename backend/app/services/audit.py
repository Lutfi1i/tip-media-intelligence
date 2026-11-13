from datetime import datetime
import json
from typing import Any, Dict, Optional
from sqlalchemy import text
from sqlalchemy.engine import Engine
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


def ensure_audit_append_only(engine: Engine) -> None:
    """Pasang trigger PostgreSQL agar tabel audit_logs bersifat append-only (FR-23)."""
    if engine.dialect.name != "postgresql":
        return
    ddl = """
    CREATE OR REPLACE FUNCTION prevent_audit_modification()
    RETURNS trigger AS $$
    BEGIN
        RAISE EXCEPTION 'audit_logs bersifat append-only dan tidak dapat diubah atau dihapus';
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trg_audit_no_update ON audit_logs;
    CREATE TRIGGER trg_audit_no_update
        BEFORE UPDATE OR DELETE ON audit_logs
        FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();
    """
    with engine.begin() as conn:
        conn.execute(text(ddl))
