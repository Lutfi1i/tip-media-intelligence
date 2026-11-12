"""Catatan analis pada topik medsos: status penanganan dan riwayat catatan."""

from __future__ import annotations

from typing import Any, Dict, Iterable, List, Optional

from sqlalchemy.orm import Session

from backend.app.models import SocialTopicNote
from backend.app.services.audit import record_audit

NOTE_STATUSES: Dict[str, str] = {
    "dipantau": "Dipantau",
    "sudah_dicek": "Sudah dicek",
    "hoaks": "Hoaks / disinformasi",
    "ditangani": "Ditangani",
    "bukan_isu": "Bukan isu",
}


def note_payload(n: SocialTopicNote) -> Dict[str, Any]:
    return {
        "id": n.id,
        "topic_key": n.topic_key,
        "topic_label": n.topic_label,
        "status": n.status,
        "status_label": NOTE_STATUSES.get(n.status, n.status),
        "catatan": n.catatan,
        "aktor": n.aktor,
        "peran": n.peran,
        "created_at": n.created_at.isoformat(),
    }


def add_note(
    db: Session,
    topic_key: str,
    topic_label: str,
    status: str,
    aktor: str,
    catatan: Optional[str] = None,
    peran: str = "Analis",
) -> Dict[str, Any]:
    if status not in NOTE_STATUSES:
        raise ValueError(f"status harus salah satu dari: {', '.join(NOTE_STATUSES)}")
    aktor = (aktor or "").strip()
    if not aktor:
        raise ValueError("nama analis wajib diisi")
    note = SocialTopicNote(
        topic_key=topic_key.strip()[:255],
        topic_label=topic_label.strip()[:255] or topic_key,
        status=status,
        catatan=(catatan or "").strip()[:2000] or None,
        aktor=aktor[:120],
        peran=(peran or "Analis")[:50],
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    record_audit(
        db,
        aktor=note.aktor,
        peran=note.peran,
        aksi="CATATAN_TOPIK_MEDSOS",
        objek=f"social-topic:{note.topic_key}",
        detail={"status": note.status, "catatan": note.catatan},
    )
    return note_payload(note)


def list_notes(db: Session, topic_key: str, limit: int = 50) -> List[Dict[str, Any]]:
    rows = (
        db.query(SocialTopicNote)
        .filter(SocialTopicNote.topic_key == topic_key)
        .order_by(SocialTopicNote.created_at.desc(), SocialTopicNote.id.desc())
        .limit(limit)
        .all()
    )
    return [note_payload(n) for n in rows]


def latest_notes(db: Session, topic_keys: Iterable[str]) -> Dict[str, Dict[str, Any]]:
    """Catatan terbaru dan jumlah catatan per topic_key."""
    keys = list(set(topic_keys))
    if not keys:
        return {}
    result: Dict[str, Dict[str, Any]] = {}
    rows = (
        db.query(SocialTopicNote)
        .filter(SocialTopicNote.topic_key.in_(keys))
        .order_by(SocialTopicNote.created_at.desc(), SocialTopicNote.id.desc())
        .all()
    )
    for n in rows:
        if n.topic_key not in result:
            result[n.topic_key] = {**note_payload(n), "count": 0}
        result[n.topic_key]["count"] += 1
    return result
