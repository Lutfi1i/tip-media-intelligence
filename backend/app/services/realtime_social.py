"""Real-time Social Pulse hub: Redis Pub/Sub + in-process SSE broadcast + legal ingestion (FR-25)."""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime
from typing import Any, AsyncGenerator, Dict, List, Optional, Set

from sqlalchemy.orm import Session

from backend.app.config import settings
from backend.app.services.ingestion import ingest_content_item

logger = logging.getLogger("tip_realtime_social")

_CHANNEL = "tip:social_pulse:live"
_LOCAL_SUBSCRIBERS: Set[asyncio.Queue] = set()


def publish_live_event(payload: Dict[str, Any]) -> None:
    """Publish postingan baru ke Redis Pub/Sub dan subscriber SSE lokal."""
    encoded = json.dumps(payload, default=str)
    try:
        import redis

        r = redis.from_url(settings.REDIS_URL, socket_connect_timeout=1)
        r.publish(_CHANNEL, encoded)
    except Exception:
        pass

    for q in list(_LOCAL_SUBSCRIBERS):
        try:
            q.put_nowait(encoded)
        except Exception:
            pass


async def subscribe_sse_events() -> AsyncGenerator[str, None]:
    """Stream Server-Sent Events (SSE) ke frontend."""
    q: asyncio.Queue = asyncio.Queue(maxsize=100)
    _LOCAL_SUBSCRIBERS.add(q)
    try:
        yield f"event: connected\ndata: {json.dumps({'status': 'connected', 'ts': datetime.utcnow().isoformat()})}\n\n"
        while True:
            try:
                data = await asyncio.wait_for(q.get(), timeout=20.0)
                yield f"event: post\ndata: {data}\n\n"
            except asyncio.TimeoutError:
                yield f": heartbeat {datetime.utcnow().isoformat()}\n\n"
    finally:
        _LOCAL_SUBSCRIBERS.discard(q)


def ingest_licensed_social_post(
    db: Session,
    *,
    platform: str,
    url: str,
    title: str,
    body: str,
    author: Optional[str] = None,
    published_at: Optional[datetime] = None,
    engagement: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Ingest postingan dari X Filtered Stream atau webhook vendor berlisensi lalu push ke SSE."""
    res = ingest_content_item(
        db=db,
        source_id=None,
        url=url,
        title=title,
        body=body,
        penerbit=f"{platform} Official Stream",
        penulis=author,
        published_at=published_at or datetime.utcnow(),
        platform=platform,
        engagement=engagement,
    )
    if res.get("status") == "ingested":
        publish_live_event(
            {
                "item_id": res.get("item_id"),
                "platform": platform,
                "judul": title,
                "penulis": author,
                "url": url,
                "published_at": (published_at or datetime.utcnow()).isoformat(),
            }
        )
    return res
