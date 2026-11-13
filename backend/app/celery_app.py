"""Konfigurasi Celery Worker & Celery Beat (pengganti thread scheduler.py di produksi)."""

from celery import Celery
from celery.schedules import crontab

from backend.app.config import settings

celery_app = Celery(
    "tip_media_intelligence",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=["backend.app.tasks"],
)

celery_app.conf.update(
    timezone="Asia/Jakarta",
    enable_utc=True,
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    worker_prefetch_multiplier=1,
    beat_schedule={
        "collect-sources-every-10m": {
            "task": "backend.app.tasks.task_collect_sources",
            "schedule": 600.0,
        },
        "social-trends-every-1m": {
            "task": "backend.app.tasks.task_social_trend_aggregation",
            "schedule": 60.0,
        },
        "check-sla-escalate-every-5m": {
            "task": "backend.app.tasks.task_check_sla_and_escalate",
            "schedule": 300.0,
        },
        "daily-pdf-report-0700": {
            "task": "backend.app.tasks.task_generate_scheduled_reports",
            "schedule": crontab(hour=7, minute=0),
            "args": ("harian",),
        },
        "weekly-pdf-report-mon-0700": {
            "task": "backend.app.tasks.task_generate_scheduled_reports",
            "schedule": crontab(hour=7, minute=5, day_of_week=1),
            "args": ("mingguan",),
        },
        "retention-cleanup-0200": {
            "task": "backend.app.tasks.task_retention_cleanup",
            "schedule": crontab(hour=2, minute=0),
        },
    },
)
