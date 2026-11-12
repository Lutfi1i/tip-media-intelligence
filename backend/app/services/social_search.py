"""Pencarian dan arsip konten media sosial dengan filter, paginasi, dan ekspor CSV."""

from __future__ import annotations

import csv
import io
import re
from typing import Any, Dict, Iterator, List, Optional, Tuple

from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from backend.app.models import ItemAnalysis, RawItem
from backend.app.services.social_emotion import EMOTION_LABELS, classify_emotions
from backend.app.services.social_platform import SOCIAL_PLATFORMS
from backend.app.services.social_pulse_service import _filter_items_by_scope, resolve_period
from backend.app.services.social_taxonomy import agency_label, category_label, classify

MAX_EXPORT = 5000
SEARCH_SORTS = ("terbaru", "terlama", "jangkauan")
_TOKEN_RE = re.compile(r'"([^"]+)"|(\S+)')


def _tokens(q: Optional[str]) -> List[str]:
    """Kata kunci pencarian; frasa dalam tanda kutip dianggap satu kata."""
    out = []
    for phrase, word in _TOKEN_RE.findall(q or ""):
        t = (phrase or word).strip()
        if len(t) >= 2:
            out.append(t)
    return out[:8]


def _matches(
    db: Session,
    q: Optional[str],
    time_range: str,
    scope_kode: str,
    scope_mode: str,
    platform: Optional[str],
    category: Optional[str],
    agency: Optional[str],
    emotion: Optional[str],
    sentimen: Optional[str],
    author: Optional[str],
    sort: str,
) -> Tuple[Any, List[Dict[str, Any]]]:
    period = resolve_period(time_range)
    query = (
        db.query(RawItem, ItemAnalysis)
        .outerjoin(ItemAnalysis, ItemAnalysis.item_id == RawItem.id)
        .filter(RawItem.platform.in_(SOCIAL_PLATFORMS), RawItem.published_at >= period.start, RawItem.published_at < period.end)
    )
    for tok in _tokens(q):
        like = f"%{tok}%"
        query = query.filter(or_(RawItem.judul.ilike(like), RawItem.isi.ilike(like)))
    if platform and platform != "Semua":
        query = query.filter(RawItem.platform == platform)
    if sentimen:
        query = query.filter(ItemAnalysis.sentimen == sentimen)
    if author:
        a = author.strip().lstrip("@")
        query = query.filter(and_(RawItem.penulis.isnot(None), RawItem.penulis.ilike(f"%{a}%")))
    if sort == "terlama":
        query = query.order_by(RawItem.published_at.asc())
    else:
        query = query.order_by(RawItem.published_at.desc())
    rows = query.all()

    analysis = {it.id: ana for it, ana in rows}
    scoped = _filter_items_by_scope([it for it, _ in rows], scope_kode, scope_mode, None)

    results: List[Dict[str, Any]] = []
    for it, geo_label, geo_conf, _ in scoped:
        text = f"{it.judul} {it.isi}"
        cats, ags = classify(text)
        emos = classify_emotions(text)
        if category and category not in cats:
            continue
        if agency and agency not in ags:
            continue
        if emotion and emotion not in emos:
            continue
        ana = analysis.get(it.id)
        likes, shares, replies = it.eng_likes, it.eng_shares, it.eng_replies
        interactions = sum(v for v in (likes, shares, replies) if v is not None) if any(v is not None for v in (likes, shares, replies)) else None
        results.append({
            "id": it.id,
            "judul": it.judul,
            "isi": it.isi[:400] + ("..." if len(it.isi or "") > 400 else ""),
            "platform": it.platform,
            "penulis": it.penulis,
            "penerbit": it.penerbit,
            "url": it.url_kanonik,
            "published_at": it.published_at.isoformat(),
            "sentimen": (ana.sentimen if ana else "netral") or "netral",
            "lokasi": ana.lokasi_kejadian if ana else None,
            "kategori": [category_label(c) for c in cats if c != "lainnya"],
            "instansi": [agency_label(a) for a in ags],
            "emosi": [EMOTION_LABELS[e] for e in emos],
            "geo_context": geo_label,
            "engagement": {"likes": likes, "shares": shares, "replies": replies, "views": it.eng_views, "interactions": interactions},
        })
    if sort == "jangkauan":
        results.sort(key=lambda r: (-(r["engagement"]["views"] or 0), -(r["engagement"]["interactions"] or 0), r["published_at"]))
    return period, results


def search_social_content(
    db: Session,
    q: Optional[str] = None,
    time_range: str = "7d",
    scope_kode: str = "ID",
    scope_mode: str = "context",
    platform: Optional[str] = None,
    category: Optional[str] = None,
    agency: Optional[str] = None,
    emotion: Optional[str] = None,
    sentimen: Optional[str] = None,
    author: Optional[str] = None,
    sort: str = "terbaru",
    page: int = 1,
    page_size: int = 25,
) -> Dict[str, Any]:
    period, results = _matches(db, q, time_range, scope_kode, scope_mode, platform, category, agency, emotion, sentimen, author, sort)
    page = max(1, page)
    start = (page - 1) * page_size
    return {
        "period": period.as_dict(),
        "query": q or "",
        "total": len(results),
        "page": page,
        "page_size": page_size,
        "pages": max(1, -(-len(results) // page_size)),
        "items": results[start:start + page_size],
    }


def export_social_content_csv(db: Session, **filters: Any) -> Iterator[str]:
    """CSV (UTF-8 dengan BOM agar terbaca Excel) dari hasil pencarian, maksimal MAX_EXPORT baris."""
    _, results = _matches(db, **filters)
    buf = io.StringIO()
    writer = csv.writer(buf)
    buf.write("﻿")
    writer.writerow(["waktu_utc", "platform", "akun", "penerbit", "judul", "isi", "sentimen", "emosi", "kategori",
                     "instansi", "lokasi", "tayangan", "like", "repost", "balasan", "url"])
    for r in results[:MAX_EXPORT]:
        e = r["engagement"]
        writer.writerow([r["published_at"], r["platform"], r["penulis"] or "", r["penerbit"] or "", r["judul"], r["isi"],
                         r["sentimen"], " | ".join(r["emosi"]), " | ".join(r["kategori"]), " | ".join(r["instansi"]),
                         r["lokasi"] or "", e["views"] if e["views"] is not None else "", e["likes"] if e["likes"] is not None else "",
                         e["shares"] if e["shares"] is not None else "", e["replies"] if e["replies"] is not None else "", r["url"] or ""])
    yield buf.getvalue()
