from datetime import datetime
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from backend.app.models import Alert, Issue

def format_alert_message(issue: Issue, reviewer_catatan: str = "") -> str:
    """Format structured alert message for executives."""
    return (
        f"[ALERT {issue.level}] {issue.judul}\n"
        f"Wilayah: {issue.wilayah} | Skor Risiko: {issue.skor:.0f}/100\n"
        f"Ringkasan: {issue.ringkasan or 'Dalam pemantauan'}\n"
        f"Verifikasi: {reviewer_catatan or 'Fakta terverifikasi analis'}\n"
        f"Waktu Deteksi: {issue.first_seen.strftime('%H:%M WIB')}\n"
        f"Tindak lanjut: Menunggu konfirmasi PIC & pimpinan."
    )

def dispatch_executive_alert(
    db: Session,
    issue: Issue,
    channels: List[str] = None,
    reviewer_catatan: str = ""
) -> List[Alert]:
    """
    Dispatch verified High/Critical alerts across channels.
    Strict rule: Only executed post-verification.
    """
    if channels is None:
        channels = ["whatsapp", "telegram", "email"]

    alerts_created = []
    message = format_alert_message(issue, reviewer_catatan)

    recipients = {
        "whatsapp": "+6281234567890 (Pimpinan Siaga)",
        "telegram": "@tip_command_center_bot",
        "email": "pimpinan.krisis@instansi.go.id"
    }

    now = datetime.utcnow()
    for ch in channels:
        recipient = recipients.get(ch, "command-center@instansi.go.id")
        alert = Alert(
            issue_id=issue.id,
            level=issue.level,
            penerima=recipient,
            kanal=ch,
            konten_pesan=message,
            terkirim_at=now,
            status="terkirim"
        )
        db.add(alert)
        alerts_created.append(alert)

    db.commit()
    for a in alerts_created:
        db.refresh(a)

    return alerts_created
