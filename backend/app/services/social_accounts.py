"""Akun pantauan: aktivitas akun tertentu dan sebutan @akun di media sosial."""

from __future__ import annotations

import re
from collections import Counter
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from backend.app.models import SocialWatchedAccount
from backend.app.services.audit import record_audit
from backend.app.services.social_pulse_service import (
    _load_dataset,
    _mention_payload,
    _rank_mentions,
    _sentiment_pct,
    _timeline,
)
from backend.app.services.social_topics import account_analysis

GROUPS = {
    "pejabat": "Pejabat",
    "instansi": "Instansi",
    "media": "Media",
    "warga": "Warga berpengaruh",
    "lainnya": "Lainnya",
}

_HANDLE_RE = re.compile(r"^[a-z0-9_.]{2,60}$")


def normalize_handle(value: Optional[str]) -> str:
    """'@CNNIndonesia ' -> 'cnnindonesia'. Juga menerima URL profil x.com/tiktok/instagram/threads."""
    v = (value or "").strip().lower()
    v = re.sub(r"^https?://(?:www\.)?[^/]+/", "", v)
    v = v.lstrip("@").split("/")[0].split("?")[0]
    return v


def account_payload(a: SocialWatchedAccount) -> Dict[str, Any]:
    return {
        "id": a.id,
        "handle": a.handle,
        "label": a.label,
        "kelompok": a.kelompok,
        "kelompok_label": GROUPS.get(a.kelompok, a.kelompok),
        "catatan": a.catatan,
        "dibuat_oleh": a.dibuat_oleh,
        "created_at": a.created_at.isoformat() if a.created_at else None,
    }


def add_account(db: Session, handle: str, label: Optional[str], kelompok: str, catatan: Optional[str], dibuat_oleh: str) -> Dict[str, Any]:
    h = normalize_handle(handle)
    if not _HANDLE_RE.match(h):
        raise ValueError("handle tidak valid; gunakan nama akun seperti @namaakun (huruf, angka, titik, garis bawah)")
    if kelompok not in GROUPS:
        raise ValueError(f"kelompok harus salah satu dari: {', '.join(GROUPS)}")
    if db.query(SocialWatchedAccount).filter(SocialWatchedAccount.handle == h).first():
        raise ValueError(f"@{h} sudah dipantau")
    acc = SocialWatchedAccount(
        handle=h,
        label=(label or "").strip()[:150] or None,
        kelompok=kelompok,
        catatan=(catatan or "").strip()[:1000] or None,
        dibuat_oleh=(dibuat_oleh or "Analis").strip()[:120] or "Analis",
    )
    db.add(acc)
    db.commit()
    db.refresh(acc)
    record_audit(db, aktor=acc.dibuat_oleh, peran="Analis", aksi="TAMBAH_AKUN_PANTAUAN",
                 objek=f"social-account:{acc.handle}", detail=account_payload(acc))
    return account_payload(acc)


def remove_account(db: Session, account_id: int, aktor: str = "Analis") -> bool:
    acc = db.get(SocialWatchedAccount, account_id)
    if not acc:
        return False
    snapshot = account_payload(acc)
    db.delete(acc)
    db.commit()
    record_audit(db, aktor=aktor, peran="Analis", aksi="HAPUS_AKUN_PANTAUAN", objek=f"social-account:{snapshot['handle']}", detail=snapshot)
    return True


def get_account_activity(
    db: Session,
    time_range: str = "24h",
    scope_kode: str = "ID",
    scope_mode: str = "context",
    multi_codes: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Untuk setiap akun pantauan: postingan oleh akun, postingan yang menyebut @akun, dan nada sebutan."""
    ds = _load_dataset(db, time_range, scope_kode, scope_mode, multi_codes)
    accounts = db.query(SocialWatchedAccount).order_by(SocialWatchedAccount.created_at.desc()).all()
    watched = {a.handle for a in accounts}

    rows = []
    for a in accounts:
        mention_re = re.compile(r"(?<![a-z0-9_.])@" + re.escape(a.handle) + r"(?![a-z0-9_])")
        own = [p for p in ds.current if normalize_handle(p.author) == a.handle]
        mentions = [p for p in ds.current if normalize_handle(p.author) != a.handle and mention_re.search(p.text.lower())]
        rows.append({
            **account_payload(a),
            "posts": len(own),
            "mentions": len(mentions),
            "mention_sentiment": _sentiment_pct(mentions) if mentions else None,
            "platforms": [n for n, _ in Counter(p.platform for p in own + mentions).most_common()],
            "last_post_at": max((p.published_at for p in own), default=None),
            "timeline": _timeline(ds, own + mentions),
            "latest_posts": [_mention_payload(ds, p) for p in sorted(own, key=lambda p: p.published_at, reverse=True)[:3]],
            "top_mentions": [_mention_payload(ds, p) for p in _rank_mentions(mentions)[:3]],
        })
    for r in rows:
        r["last_post_at"] = r["last_post_at"].isoformat() if r["last_post_at"] else None

    suggestions = [
        {**s, "handle_norm": normalize_handle(s["handle"])}
        for s in account_analysis(ds.current, limit=15)["top_accounts"]
        if normalize_handle(s["handle"]) not in watched and _HANDLE_RE.match(normalize_handle(s["handle"]))
    ][:8]

    return {"period": ds.period.as_dict(), "groups": GROUPS, "accounts": rows, "suggestions": suggestions}
