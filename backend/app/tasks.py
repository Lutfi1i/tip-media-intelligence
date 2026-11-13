"""Celery tasks: pengumpulan berkala, agregasi tren 1-menit, eskalasi SLA, PDF otomatis, retensi."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta

from backend.app.celery_app import celery_app
from backend.app.config import settings
from backend.app.database import SessionLocal
from backend.app.models import RawItem
from backend.app.services.auth import mask_account_pii
from backend.app.services.collector import collect_all
from backend.app.services.issue_clustering import cluster_and_sync_issues
from backend.app.services.notification import escalate_overdue_cases
from backend.app.services.report_generator import generate_report_document
from backend.app.services.social_alert_rules import evaluate_rules
from backend.app.services.social_escalation import escalate_social_surges
from backend.app.services.social_topics import get_trending_topics

logger = logging.getLogger("tip_tasks")


@celery_app.task(name="backend.app.tasks.task_collect_sources")
def task_collect_sources() -> dict:
    db = SessionLocal()
    try:
        res = collect_all(db, force=False)
        cluster_and_sync_issues(db)
        return {"total_baru": res.get("total_baru", 0), "total_gagal": res.get("total_gagal", 0)}
    finally:
        db.close()


@celery_app.task(name="backend.app.tasks.task_social_trend_aggregation")
def task_social_trend_aggregation() -> dict:
    """Hitung tren medsos di worker setiap 1 menit + evaluasi alert & eskalasi."""
    db = SessionLocal()
    try:
        topics = get_trending_topics(db, time_range="1h", limit=15)
        esc = escalate_social_surges(db)
        alerts = evaluate_rules(db)
        return {
            "topics_count": len(topics),
            "escalated_new": len(esc.get("created", [])),
            "alerts_triggered": len(alerts.get("triggered", [])),
        }
    finally:
        db.close()


@celery_app.task(name="backend.app.tasks.task_check_sla_and_escalate")
def task_check_sla_and_escalate() -> dict:
    db = SessionLocal()
    try:
        escalated = escalate_overdue_cases(db)
        return {"escalated_cases": escalated}
    finally:
        db.close()


@celery_app.task(name="backend.app.tasks.task_generate_scheduled_reports")
def task_generate_scheduled_reports(jenis: str = "harian") -> dict:
    db = SessionLocal()
    try:
        now = datetime.utcnow()
        periode = now.strftime("%d %B %Y") if jenis == "harian" else f"Minggu {now.strftime('%W, %Y')}"
        report = generate_report_document(db, jenis=jenis, periode=periode)
        return {"report_id": report.id, "file_url": report.file_url}
    finally:
        db.close()


@celery_app.task(name="backend.app.tasks.task_retention_cleanup")
def task_retention_cleanup() -> dict:
    """Jalankan kebijakan retensi & anonimisasi penulis non-publik (NFR-10, NFR-11)."""
    db = SessionLocal()
    try:
        cutoff = datetime.utcnow() - timedelta(days=settings.RETENTION_DAYS)
        old_items = db.query(RawItem).filter(RawItem.published_at < cutoff).all()
        masked = 0
        for item in old_items:
            if item.penulis and "*" not in item.penulis:
                item.penulis = mask_account_pii(item.penulis)
                masked += 1
        if masked:
            db.commit()
        return {"masked_items": masked, "cutoff": cutoff.isoformat()}
    finally:
        db.close()
