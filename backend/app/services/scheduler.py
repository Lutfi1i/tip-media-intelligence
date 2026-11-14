"""Penarikan data berkala di latar belakang.

Tren dan baseline media sosial hanya bermakna bila data dikumpulkan terus-menerus.
Thread ini menjalankan siklus tarik -> kluster isu -> eskalasi lonjakan setiap
AUTO_COLLECT_MINUTES menit. Interval per sumber (`frekuensi_menit`) tetap dihormati
karena collect_all dipanggil dengan force=False.
"""

from __future__ import annotations

import logging
import threading
from typing import Optional

from backend.app.database import SessionLocal
from backend.app.services.collector import collect_all
from backend.app.services.issue_clustering import cluster_and_sync_issues
from backend.app.services.keyword_monitor import match_new_content
from backend.app.services.social_escalation import escalate_social_surges
from backend.app.services.social_alert_rules import evaluate_rules

logger = logging.getLogger("tip_scheduler")

_stop = threading.Event()
_thread: Optional[threading.Thread] = None


def run_cycle() -> None:
    db = SessionLocal()
    try:
        hasil = collect_all(db, force=False)
        cluster_and_sync_issues(db)
        keywords = match_new_content(db)
        if keywords["sebutan_baru"]:
            logger.info("Pantau Keyword: %d sebutan baru", keywords["sebutan_baru"])
        eskalasi = escalate_social_surges(db)
        alerts = evaluate_rules(db)
        if alerts["triggered"]:
            logger.info("Aturan alert medsos terpicu: %d", len(alerts["triggered"]))
        logger.info(
            "Siklus otomatis: %s baru, %s gagal, eskalasi %s baru / %s diperbarui",
            hasil["total_baru"], hasil["total_gagal"], len(eskalasi["created"]), len(eskalasi["updated"]),
        )
    except Exception:
        db.rollback()
        logger.exception("Siklus penarikan otomatis gagal")
    finally:
        db.close()


def _loop(interval_minutes: int) -> None:
    while not _stop.is_set():
        run_cycle()
        _stop.wait(interval_minutes * 60)


def start(interval_minutes: int) -> bool:
    """Mulai thread penarikan bila interval > 0 dan belum berjalan."""
    global _thread
    if interval_minutes <= 0 or (_thread and _thread.is_alive()):
        return False
    _stop.clear()
    _thread = threading.Thread(target=_loop, args=(interval_minutes,), name="tip-auto-collect", daemon=True)
    _thread.start()
    logger.info("Penarikan otomatis aktif setiap %d menit", interval_minutes)
    return True


def stop() -> None:
    _stop.set()
