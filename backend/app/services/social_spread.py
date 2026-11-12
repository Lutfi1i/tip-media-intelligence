"""Jejak penyebaran isu: di mana sebuah topik atau kata kunci pertama muncul dan kanal mana yang menyusul.

Mencakup konten medsos dan berita, sehingga terlihat apakah isu lahir di medsos lalu
diliput media, atau sebaliknya. Waktu yang dipakai adalah waktu terbit konten; untuk sumber
penemuan (Google News, GDELT) waktu ini bisa sedikit berbeda dari waktu posting asli.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import timedelta
from typing import Any, Dict, List, Optional

from sqlalchemy import or_
from sqlalchemy.orm import Session

from backend.app.models import ItemAnalysis, RawItem
from backend.app.services.social_platform import NEWS, is_social
from backend.app.services.social_pulse_service import Period, _filter_items_by_scope, resolve_period
from backend.app.services.social_search import _tokens
from backend.app.services.social_topics import extract_keys, key_label

MAX_ITEMS = 3000


def _channel(it: RawItem) -> str:
    if is_social(it.platform):
        return it.platform
    return f"Berita · {(it.penerbit or 'media')[:60]}"


def _item(it: RawItem, ana: Optional[ItemAnalysis]) -> Dict[str, Any]:
    return {
        "id": it.id,
        "judul": it.judul,
        "channel": _channel(it),
        "group": "medsos" if is_social(it.platform) else "berita",
        "platform": it.platform,
        "penulis": it.penulis,
        "penerbit": it.penerbit,
        "url": it.url_kanonik,
        "published_at": it.published_at.isoformat(),
        "sentimen": (ana.sentimen if ana else "netral") or "netral",
    }


def _buckets(period: Period, times: List[Any]) -> List[Dict[str, Any]]:
    size = timedelta(minutes=period.bucket_minutes)
    n = period.n_buckets
    start = period.end - size * n
    counts = [0] * n
    for t in times:
        idx = int((t - start) / size)
        if 0 <= idx < n:
            counts[idx] += 1
    return [{"t": (start + size * i).isoformat(), "count": c} for i, c in enumerate(counts)]


def get_spread_trace(
    db: Session,
    time_range: str = "7d",
    topic_key: Optional[str] = None,
    q: Optional[str] = None,
    scope_kode: str = "ID",
    scope_mode: str = "context",
) -> Dict[str, Any]:
    if not topic_key and not (q or "").strip():
        raise ValueError("isi topic_key atau q")
    period = resolve_period(time_range)
    query = (
        db.query(RawItem, ItemAnalysis)
        .outerjoin(ItemAnalysis, ItemAnalysis.item_id == RawItem.id)
        .filter(RawItem.published_at >= period.start, RawItem.published_at < period.end)
    )
    tokens = _tokens(q) if q else []
    for tok in tokens:
        query = query.filter(or_(RawItem.judul.ilike(f"%{tok}%"), RawItem.isi.ilike(f"%{tok}%")))
    rows = query.order_by(RawItem.published_at.asc()).limit(20000).all()

    analysis = {it.id: ana for it, ana in rows}
    scoped = [it for it, *_ in _filter_items_by_scope([it for it, _ in rows], scope_kode, scope_mode, None)]
    if topic_key:
        scoped = [it for it in scoped if topic_key in extract_keys(f"{it.judul} {it.isi}")]
    items = sorted(scoped, key=lambda it: it.published_at)[:MAX_ITEMS]

    label = key_label(topic_key) if topic_key else " ".join(tokens)
    base = {"period": period.as_dict(), "topic_key": topic_key, "query": q or "", "label": label}
    if not items:
        return {**base, "total": 0, "social_count": 0, "news_count": 0, "first": None, "first_social": None,
                "first_news": None, "origin": None, "lag_minutes": None, "channels": [],
                "timeline": {"medsos": _buckets(period, []), "berita": _buckets(period, [])}, "early_items": []}

    social = [it for it in items if is_social(it.platform)]
    news = [it for it in items if not is_social(it.platform)]
    first_social = social[0] if social else None
    first_news = news[0] if news else None

    channels: Dict[str, Dict[str, Any]] = {}
    authors: Dict[str, set] = defaultdict(set)
    for it in items:
        ch = _channel(it)
        row = channels.setdefault(ch, {
            "channel": ch,
            "group": "medsos" if is_social(it.platform) else "berita",
            "platform": it.platform if is_social(it.platform) else NEWS,
            "first_at": it.published_at,
            "first_title": it.judul,
            "first_url": it.url_kanonik,
            "count": 0,
        })
        row["count"] += 1
        if it.penulis:
            authors[ch].add(it.penulis.lower())
    t0 = items[0].published_at
    channel_rows = []
    for ch, row in sorted(channels.items(), key=lambda kv: kv[1]["first_at"]):
        channel_rows.append({
            **row,
            "first_at": row["first_at"].isoformat(),
            "minutes_after_first": round((row["first_at"] - t0).total_seconds() / 60),
            "accounts": len(authors[ch]),
        })

    lag = None
    origin = "medsos" if is_social(items[0].platform) else "berita"
    if first_social and first_news:
        lag = round((first_news.published_at - first_social.published_at).total_seconds() / 60)

    return {
        **base,
        "total": len(items),
        "social_count": len(social),
        "news_count": len(news),
        "first": _item(items[0], analysis.get(items[0].id)),
        "first_social": _item(first_social, analysis.get(first_social.id)) if first_social else None,
        "first_news": _item(first_news, analysis.get(first_news.id)) if first_news else None,
        "origin": origin,
        # Positif: berita muncul setelah medsos. Negatif: medsos menyusul berita.
        "lag_minutes": lag,
        "channels": channel_rows[:25],
        "timeline": {
            "medsos": _buckets(period, [it.published_at for it in social]),
            "berita": _buckets(period, [it.published_at for it in news]),
        },
        "early_items": [_item(it, analysis.get(it.id)) for it in items[:12]],
    }
