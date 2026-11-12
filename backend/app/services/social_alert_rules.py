"""Aturan alert kustom untuk media sosial.

Analis menulis aturan seperti "instansi PLN, konten negatif >= 5 dalam 1 jam" atau
"kata 'banjir' di Kota Bekasi naik >= 3x baseline dalam 6 jam". Setiap kali data ditarik,
aturan aktif dievaluasi; aturan yang terpenuhi mencatat satu kejadian dan tidak memicu
lagi sampai masa jeda (cooldown) lewat.
"""

from __future__ import annotations

import json
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from backend.app.models import SocialAlertEvent, SocialAlertRule
from backend.app.services.audit import record_audit
from backend.app.services.social_pulse_service import (
    MIN_SURGE_VOLUME,
    _history_counts,
    _load_dataset,
    _mention_payload,
    _rank_mentions,
    _scope_display_name,
    _term_matcher,
)
from backend.app.services.social_taxonomy import AGENCY_BY_ID, CATEGORY_BY_ID, agency_label, category_label
from backend.app.services.social_topics import velocity

METRICS = {
    "volume": "jumlah konten",
    "negatif": "jumlah konten negatif",
    "lonjakan": "rasio terhadap baseline",
}
WINDOWS = ("1h", "6h", "24h")
WINDOW_LABEL = {"1h": "1 jam", "6h": "6 jam", "24h": "24 jam"}


def validate_rule(data: Dict[str, Any]) -> Dict[str, Any]:
    """Normalisasi dan validasi isi aturan. ValueError dengan pesan yang bisa ditampilkan ke pengguna."""
    nama = (data.get("nama") or "").strip()
    if not nama:
        raise ValueError("nama aturan wajib diisi")
    metric = data.get("metric")
    if metric not in METRICS:
        raise ValueError(f"metrik harus salah satu dari: {', '.join(METRICS)}")
    window = data.get("window") or "1h"
    if window not in WINDOWS:
        raise ValueError("jendela harus 1h, 6h, atau 24h")
    try:
        threshold = float(data.get("threshold"))
    except (TypeError, ValueError):
        raise ValueError("ambang harus berupa angka")
    if threshold <= 0:
        raise ValueError("ambang harus lebih dari 0")
    if metric == "lonjakan" and threshold < 1:
        raise ValueError("ambang lonjakan adalah rasio, minimal 1 (mis. 3 = tiga kali baseline)")
    category = data.get("category") or None
    if category and category not in CATEGORY_BY_ID:
        raise ValueError("kategori tidak dikenal")
    agency = data.get("agency") or None
    if agency and agency not in AGENCY_BY_ID:
        raise ValueError("instansi tidak dikenal")
    term = (data.get("term") or "").strip() or None
    if term and len(term) < 2:
        raise ValueError("kata kunci minimal 2 huruf")
    cooldown = int(data.get("cooldown_menit") or 60)
    if not 5 <= cooldown <= 7 * 24 * 60:
        raise ValueError("jeda antar-alert antara 5 menit dan 7 hari")
    return {
        "nama": nama[:150],
        "aktif": bool(data.get("aktif", True)),
        "term": term[:150] if term else None,
        "category": category,
        "agency": agency,
        "platform": (data.get("platform") or None) if data.get("platform") != "Semua" else None,
        "scope_kode": (data.get("scope_kode") or "ID").strip() or "ID",
        "metric": metric,
        "threshold": threshold,
        "window": window,
        "cooldown_menit": cooldown,
        "dibuat_oleh": ((data.get("dibuat_oleh") or "Analis").strip() or "Analis")[:120],
    }


def describe_rule(r: SocialAlertRule) -> str:
    parts = []
    if r.term:
        parts.append(f'kata "{r.term}"')
    if r.category:
        parts.append(f"kategori {category_label(r.category)}")
    if r.agency:
        parts.append(f"instansi {agency_label(r.agency)}")
    if r.platform:
        parts.append(f"di {r.platform}")
    if r.scope_kode and r.scope_kode != "ID":
        parts.append(_scope_display_name(r.scope_kode))
    target = ", ".join(parts) if parts else "semua konten medsos"
    if r.metric == "lonjakan":
        cond = f"naik >= {r.threshold:g}x baseline"
    else:
        cond = f"{METRICS[r.metric]} >= {r.threshold:g}"
    return f"{target}: {cond} dalam {WINDOW_LABEL.get(r.window, r.window)}"


def rule_payload(r: SocialAlertRule) -> Dict[str, Any]:
    return {
        "id": r.id,
        "nama": r.nama,
        "aktif": r.aktif,
        "term": r.term,
        "category": r.category,
        "agency": r.agency,
        "platform": r.platform,
        "scope_kode": r.scope_kode,
        "metric": r.metric,
        "threshold": r.threshold,
        "window": r.window,
        "cooldown_menit": r.cooldown_menit,
        "dibuat_oleh": r.dibuat_oleh,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "last_triggered_at": r.last_triggered_at.isoformat() if r.last_triggered_at else None,
        "deskripsi": describe_rule(r),
    }


def event_payload(e: SocialAlertEvent) -> Dict[str, Any]:
    return {
        "id": e.id,
        "rule_id": e.rule_id,
        "rule_nama": e.rule_nama,
        "triggered_at": e.triggered_at.isoformat(),
        "metric": e.metric,
        "value": e.value,
        "threshold": e.threshold,
        "window": e.window,
        "ringkasan": e.ringkasan,
        "samples": json.loads(e.sample_json or "[]"),
        "status": e.status,
        "dilihat_oleh": e.dilihat_oleh,
    }


def measure_rule(db: Session, rule: SocialAlertRule) -> Dict[str, Any]:
    """Hitung nilai metrik aturan saat ini tanpa mencatat apa pun."""
    ds = _load_dataset(
        db, rule.window, rule.scope_kode or "ID", "context", None, rule.platform, rule.category, rule.agency
    )
    matcher = _term_matcher(rule.term) if rule.term else (lambda p: True)
    posts = [p for p in ds.current if matcher(p)]
    negatives = [p for p in posts if p.sentiment == "negatif"]
    result: Dict[str, Any] = {"volume": len(posts), "negatif": len(negatives), "posts": posts, "ds": ds}
    if rule.metric == "lonjakan":
        vel = velocity(len(posts), _history_counts(ds, matcher), MIN_SURGE_VOLUME)
        result["velocity"] = vel
        # Tanpa baseline atau di bawah volume minimum, lonjakan tidak dinilai.
        ok = vel["baseline_windows"] > 0 and len(posts) >= MIN_SURGE_VOLUME
        result["value"] = vel["ratio"] if ok else 0.0
        result["baseline_ready"] = vel["baseline_windows"] > 0
    else:
        result["value"] = float(result[rule.metric])
        result["baseline_ready"] = True
    return result


def evaluate_rules(db: Session, now: Optional[datetime] = None, rule_ids: Optional[List[int]] = None) -> Dict[str, Any]:
    """Evaluasi aturan aktif; catat kejadian untuk aturan yang terpenuhi dan tidak sedang jeda."""
    now = now or datetime.utcnow()
    q = db.query(SocialAlertRule).filter(SocialAlertRule.aktif.is_(True))
    if rule_ids:
        q = q.filter(SocialAlertRule.id.in_(rule_ids))
    triggered: List[Dict[str, Any]] = []
    checked = 0
    for rule in q.all():
        if rule.last_triggered_at and now - rule.last_triggered_at < timedelta(minutes=rule.cooldown_menit or 60):
            continue
        checked += 1
        m = measure_rule(db, rule)
        if m["value"] < rule.threshold:
            continue
        posts = m["posts"]
        sample_posts = _rank_mentions([p for p in posts if p.sentiment == "negatif"] if rule.metric == "negatif" else posts)[:3]
        if rule.metric == "lonjakan":
            v = m["velocity"]
            nilai = f"{len(posts)} konten, {v['ratio']}x baseline (rata-rata {v['baseline_mean']})"
        else:
            nilai = f"{int(m['value'])} {METRICS[rule.metric]}"
        event = SocialAlertEvent(
            rule_id=rule.id,
            rule_nama=rule.nama,
            triggered_at=now,
            metric=rule.metric,
            value=m["value"],
            threshold=rule.threshold,
            window=rule.window,
            ringkasan=f"{rule.nama}: {nilai} dalam {WINDOW_LABEL.get(rule.window, rule.window)} ({describe_rule(rule)}).",
            sample_json=json.dumps([_mention_payload(m["ds"], p) for p in sample_posts]),
        )
        db.add(event)
        rule.last_triggered_at = now
        db.commit()
        db.refresh(event)
        record_audit(db, aktor="sistem", peran="Sistem", aksi="ALERT_MEDSOS_TERPICU",
                     objek=f"social-alert-rule:{rule.id}", detail={"event_id": event.id, "nilai": m["value"]})
        triggered.append(event_payload(event))
    return {"checked": checked, "triggered": triggered}
