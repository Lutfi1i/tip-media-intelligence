from __future__ import annotations

import logging
import smtplib
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from typing import Dict, List, Optional

import httpx
from sqlalchemy.orm import Session

from backend.app.config import settings
from backend.app.models import Alert, Case, Issue

logger = logging.getLogger("tip_notification")

WIB = timezone(timedelta(hours=7))


def is_quiet_hours(now_wib: Optional[datetime] = None) -> bool:
    """Cek apakah saat ini berada di jam tenang (mis. 22:00 - 06:00 WIB) (FR-17)."""
    dt = now_wib or datetime.now(WIB)
    hour = dt.hour
    start = settings.QUIET_HOURS_START
    end = settings.QUIET_HOURS_END
    if start == end:
        return False
    if start > end:
        return hour >= start or hour < end
    return start <= hour < end


def format_alert_message(issue: Issue, reviewer_catatan: str = "") -> str:
    """Format structured alert message for executives."""
    return (
        f"[ALERT {issue.level}] {issue.judul}\n"
        f"Wilayah: {issue.wilayah} | Skor Risiko: {issue.skor:.0f}/100\n"
        f"Ringkasan: {issue.ringkasan or 'Dalam pemantauan'}\n"
        f"Verifikasi: {reviewer_catatan or 'Fakta terverifikasi analis'}\n"
        f"Waktu Deteksi: {issue.first_seen.strftime('%H:%M WIB') if issue.first_seen else '-'}\n"
        f"Tindak lanjut: Menunggu konfirmasi PIC & pimpinan."
    )


def _send_telegram(message: str, chat_id: Optional[str] = None) -> tuple[bool, str]:
    token = settings.TELEGRAM_BOT_TOKEN
    target = chat_id or settings.TELEGRAM_DEFAULT_CHAT_ID
    if not token or not target:
        return False, "simulasi (TELEGRAM_BOT_TOKEN belum dikonfigurasi)"
    try:
        resp = httpx.post(
            f"https://api.telegram.org/bot{token}/sendMessage",
            json={"chat_id": target, "text": message},
            timeout=10.0,
        )
        if resp.status_code == 200:
            return True, "terkirim"
        return False, f"gagal HTTP {resp.status_code}"
    except Exception as exc:
        logger.warning("Telegram dispatch error: %s", exc)
        return False, f"gagal ({exc})"


def _send_email(subject: str, message: str, to_addr: Optional[str] = None) -> tuple[bool, str]:
    target = to_addr or settings.EMAIL_DEFAULT_TO
    if not settings.SMTP_HOST or not target:
        return False, "simulasi (SMTP_HOST belum dikonfigurasi)"
    try:
        msg = EmailMessage()
        msg["Subject"] = subject
        msg["From"] = settings.SMTP_FROM
        msg["To"] = target
        msg.set_content(message)
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
            if settings.SMTP_USER and settings.SMTP_PASSWORD:
                server.starttls()
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)
        return True, "terkirim"
    except Exception as exc:
        logger.warning("Email dispatch error: %s", exc)
        return False, f"gagal ({exc})"


def _send_whatsapp(message: str, phone: Optional[str] = None) -> tuple[bool, str]:
    target = phone or settings.WA_DEFAULT_TO
    if not settings.WA_BSP_URL or not settings.WA_BSP_TOKEN or not target:
        return False, "simulasi (WA_BSP_URL belum dikonfigurasi)"
    try:
        resp = httpx.post(
            settings.WA_BSP_URL,
            headers={"Authorization": f"Bearer {settings.WA_BSP_TOKEN}"},
            json={"to": target, "type": "text", "text": {"body": message}},
            timeout=10.0,
        )
        if 200 <= resp.status_code < 300:
            return True, "terkirim"
        return False, f"gagal HTTP {resp.status_code}"
    except Exception as exc:
        logger.warning("WhatsApp dispatch error: %s", exc)
        return False, f"gagal ({exc})"


def dispatch_executive_alert(
    db: Session,
    issue: Issue,
    channels: List[str] = None,
    reviewer_catatan: str = "",
    respect_quiet_hours: bool = True,
) -> List[Alert]:
    """
    Dispatch verified High/Critical alerts across real channels (FR-16)
    while respecting Quiet Hours for non-CRITICAL alerts (FR-17).
    """
    if channels is None:
        channels = ["whatsapp", "telegram", "email"]

    alerts_created = []
    message = format_alert_message(issue, reviewer_catatan)
    quiet = respect_quiet_hours and is_quiet_hours() and (issue.level or "").upper() != "CRITICAL"

    recipients = {
        "whatsapp": settings.WA_DEFAULT_TO or "+6281234567890 (Pimpinan Siaga)",
        "telegram": settings.TELEGRAM_DEFAULT_CHAT_ID or "@tip_command_center_bot",
        "email": settings.EMAIL_DEFAULT_TO or "pimpinan.krisis@instansi.go.id",
    }

    now = datetime.utcnow()
    for ch in channels:
        recipient = recipients.get(ch, "command-center@instansi.go.id")
        if quiet:
            status_val = "tertunda_jam_tenang"
        else:
            if ch == "telegram":
                ok, info = _send_telegram(message, settings.TELEGRAM_DEFAULT_CHAT_ID or None)
            elif ch == "email":
                ok, info = _send_email(f"[TIP ALERT {issue.level}] {issue.judul}", message, settings.EMAIL_DEFAULT_TO or None)
            elif ch == "whatsapp":
                ok, info = _send_whatsapp(message, settings.WA_DEFAULT_TO or None)
            else:
                ok, info = False, "kanal_tidak_dikenal"
            status_val = "terkirim" if ok else ("simulasi" if info.startswith("simulasi") else "gagal")

        alert = Alert(
            issue_id=issue.id,
            level=issue.level,
            penerima=recipient,
            kanal=ch,
            konten_pesan=message,
            terkirim_at=now,
            status=status_val,
        )
        db.add(alert)
        alerts_created.append(alert)

    db.commit()
    for a in alerts_created:
        db.refresh(a)

    return alerts_created


def escalate_overdue_cases(db: Session) -> List[int]:
    """Cek kasus yang melewati tenggat SLA dan kirim eskalasi ke pimpinan (FR-17)."""
    now = datetime.utcnow()
    overdue = (
        db.query(Case)
        .filter(Case.status.in_(["menunggu", "ditangani"]), Case.tenggat < now)
        .all()
    )
    escalated_ids: List[int] = []
    for case in overdue:
        issue = db.query(Issue).filter(Issue.id == case.issue_id).first()
        if not issue:
            continue
        existing = (
            db.query(Alert)
            .filter(
                Alert.issue_id == issue.id,
                Alert.konten_pesan.contains("[ESKALASI SLA]"),
                Alert.terkirim_at >= now - timedelta(hours=2),
            )
            .first()
        )
        if existing:
            continue
        escalate_msg = f"[ESKALASI SLA] Kasus #{case.id} ({case.unit}) melewati tenggat {case.tenggat.strftime('%d/%m %H:%M')} UTC."
        _send_telegram(escalate_msg)
        _send_email(f"[ESKALASI SLA] {issue.judul}", escalate_msg)
        db.add(
            Alert(
                issue_id=issue.id,
                level="CRITICAL",
                penerima=settings.EMAIL_DEFAULT_TO or "pimpinan.krisis@instansi.go.id",
                kanal="email",
                konten_pesan=escalate_msg,
                terkirim_at=now,
                status="terkirim" if settings.SMTP_HOST else "simulasi",
            )
        )
        escalated_ids.append(case.id)
    if escalated_ids:
        db.commit()
    return escalated_ids
