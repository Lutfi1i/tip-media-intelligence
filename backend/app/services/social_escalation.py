"""Eskalasi lonjakan topik media sosial ke alur isu RADAR.

Topik berstatus LONJAKAN TINGGI dijadikan (atau memperbarui) sebuah Issue berstatus
"otomatis", sehingga masuk antrean verifikasi analis seperti isu dari berita. Alert ke
pimpinan tetap hanya dikirim setelah analis memverifikasi (FR-15/FR-16).

Aturan agar tidak membanjiri analis:
- Satu topik (social_topic_key) hanya punya satu isu aktif; lonjakan berikutnya memperbarui isu itu.
- Topik yang isunya ditolak analis tidak dieskalasi ulang selama REJECT_COOLDOWN.
- Bila konten topik sudah tertaut ke isu aktif dari berita, isu itu yang diperbarui.
"""

from __future__ import annotations

import json
from collections import Counter
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from backend.app.models import Issue, IssueItem, ItemAnalysis, MonitoringProfile, RawItem, Source
from backend.app.services.audit import record_audit
from backend.app.services.risk_scorer import compute_risk_score
from backend.app.services.social_pulse_service import get_social_trends

ESCALATE_STATUSES = ("LONJAKAN TINGGI",)
CLOSED_STATUSES = ("selesai", "ditolak")
REJECT_COOLDOWN = timedelta(hours=24)


def _next_reference(db: Session) -> str:
    prefix = datetime.utcnow().strftime("%y%m")
    n = db.query(Issue).count() + 1
    while db.query(Issue).filter(Issue.kode_referensi == f"{prefix}-{n:04d}").first():
        n += 1
    return f"{prefix}-{n:04d}"


def _risk_for_trend(db: Session, trend: Dict[str, Any], post_ids: List[int]) -> Dict[str, Any]:
    vel = trend["velocity"]
    neg = trend["sentiment_pct"]["negatif"]
    accounts = trend["accounts"]["unique_accounts"]
    spread = max(accounts, len(trend["platforms"])) if accounts else trend["mention_count"]

    creds = [
        c for (c,) in db.query(Source.kredibilitas)
        .join(RawItem, RawItem.source_id == Source.id)
        .filter(RawItem.id.in_(post_ids))
        .all()
        if c is not None
    ]
    credibility = sum(creds) / len(creds) if creds else 0.75

    return compute_risk_score(
        relevance_score=75.0 if trend["locations"] else 55.0,
        growth_ratio=float(vel["ratio"]),
        impact_severity=min(100.0, 30.0 + neg * 0.7),
        channel_spread_count=spread,
        source_credibility=credibility,
        sentiment_urgency=neg,
    )


def _summary(trend: Dict[str, Any]) -> str:
    vel = trend["velocity"]
    base = (
        f"rata-rata {vel['baseline_mean']} per jendela pada {vel['baseline_windows']} jendela sebelumnya"
        if vel["baseline_windows"] else "baseline belum tersedia"
    )
    accounts = trend["accounts"]
    acc_txt = (
        f"{accounts['unique_accounts']} akun teridentifikasi"
        if accounts["unique_accounts"] else "nama akun tidak tersedia dari sumber"
    )
    samples = "; ".join(m["judul"][:120] for m in trend["sample_mentions"][:3])
    coord = " Terdapat indikasi teks kembar dari banyak akun dalam waktu berdekatan." if trend["coordination"]["flagged"] else ""
    return (
        f"Lonjakan percakapan media sosial tentang \"{trend['topic']}\": {trend['mention_count']} konten "
        f"({base}, rasio {vel['ratio']}x, z-score {vel['z_score']}). Platform: {', '.join(trend['platforms'])}. "
        f"{acc_txt}. Sentimen negatif {trend['sentiment_pct']['negatif']}%.{coord} Contoh: {samples}"
    )


def _link_posts(db: Session, issue: Issue, post_ids: List[int]) -> int:
    existing = {iid for (iid,) in db.query(IssueItem.item_id).filter(IssueItem.issue_id == issue.id).all()}
    added = 0
    for pid in post_ids:
        if pid not in existing:
            db.add(IssueItem(issue_id=issue.id, item_id=pid, is_repost=False))
            added += 1
    return added


def escalate_social_surges(
    db: Session,
    time_range: str = "6h",
    actor: str = "sistem",
) -> Dict[str, Any]:
    """Jadikan topik LONJAKAN TINGGI sebagai isu untuk diverifikasi analis. Mengembalikan ringkasan tindakan."""
    trends = get_social_trends(db, time_range=time_range, limit=50)
    now = datetime.utcnow()
    profile = db.query(MonitoringProfile).filter(MonitoringProfile.status == "aktif").first()
    created: List[str] = []
    updated: List[str] = []
    skipped: List[Dict[str, str]] = []

    for trend in trends:
        if trend["velocity_status"] not in ESCALATE_STATUSES:
            continue
        key = trend["topic_key"]
        post_ids: List[int] = trend["post_ids"]

        rejected = (
            db.query(Issue)
            .filter(Issue.social_topic_key == key, Issue.status == "ditolak", Issue.last_updated >= now - REJECT_COOLDOWN)
            .first()
        )
        if rejected:
            skipped.append({"topic": trend["topic"], "reason": f"ditolak analis pada isu {rejected.kode_referensi}"})
            continue

        issue: Optional[Issue] = (
            db.query(Issue)
            .filter(Issue.social_topic_key == key, Issue.status.notin_(CLOSED_STATUSES))
            .order_by(Issue.last_updated.desc())
            .first()
        )
        if issue is None and trend["correlated_issue"]:
            candidate = db.get(Issue, trend["correlated_issue"]["id"])
            if candidate and candidate.status not in CLOSED_STATUSES and not candidate.social_topic_key:
                issue = candidate

        risk = _risk_for_trend(db, trend, post_ids)
        vel = trend["velocity"]

        if issue is None:
            analyses = db.query(ItemAnalysis).filter(ItemAnalysis.item_id.in_(post_ids)).all()
            kategori = Counter(a.topik for a in analyses if a.topik and a.topik != "Umum").most_common(1)
            issue = Issue(
                profile_id=profile.id if profile else None,
                kode_referensi=_next_reference(db),
                judul=f"Lonjakan percakapan medsos: {trend['topic']}"[:180],
                wilayah=trend["locations"][0] if trend["locations"] else "Jabodetabek",
                kategori=kategori[0][0] if kategori else "Sosial & Warga",
                skor=risk["skor_akhir"],
                level=risk["level"],
                alasan_skor_json=json.dumps(risk),
                status="otomatis",
                ringkasan=_summary(trend),
                pihak_terlibat_json=json.dumps([a["handle"] for a in trend["accounts"]["top_accounts"]]),
                hal_belum_diketahui=(
                    "Kebenaran isi postingan belum diverifikasi. Belum diketahui apakah ada laporan resmi "
                    "atau liputan media yang mengonfirmasi."
                ),
                baseline_volume=float(vel["baseline_mean"]),
                current_volume=trend["mention_count"],
                repost_count=sum(c["posts"] for c in trend["coordination"]["clusters"]),
                first_seen=datetime.fromisoformat(trend["first_detected"]),
                last_updated=now,
                social_topic_key=key,
            )
            db.add(issue)
            db.flush()
            _link_posts(db, issue, post_ids)
            created.append(issue.kode_referensi)
        else:
            _link_posts(db, issue, post_ids)
            issue.social_topic_key = issue.social_topic_key or key
            issue.current_volume = max(issue.current_volume or 0, trend["mention_count"])
            issue.baseline_volume = float(vel["baseline_mean"])
            # Skor hanya dinaikkan otomatis; penurunan dibiarkan pada keputusan analis.
            if risk["skor_akhir"] > (issue.skor or 0):
                issue.skor = risk["skor_akhir"]
                issue.level = risk["level"]
                issue.alasan_skor_json = json.dumps(risk)
            issue.last_updated = now
            updated.append(issue.kode_referensi)

    db.commit()
    result = {
        "time_range": time_range,
        "evaluated_topics": len(trends),
        "created": created,
        "updated": updated,
        "skipped": skipped,
    }
    if created or updated:
        record_audit(
            db,
            aktor=actor,
            peran="Sistem" if actor == "sistem" else "Analis",
            aksi="ESKALASI_LONJAKAN_MEDSOS",
            objek="social-pulse:escalate",
            detail=result,
        )
    return result
