"""Worker X API v2 Filtered Stream (pay-per-use / legal real-time, FR-25)."""

from __future__ import annotations

import json
import logging
import time
from datetime import datetime

import httpx

from backend.app.config import settings
from backend.app.database import SessionLocal
from backend.app.services.realtime_social import ingest_licensed_social_post

logger = logging.getLogger("tip_x_stream")


def ensure_stream_rules(bearer_token: str, rule_value: str) -> None:
    headers = {"Authorization": f"Bearer {bearer_token}"}
    with httpx.Client(timeout=15.0) as client:
        existing = client.get("https://api.twitter.com/2/tweets/search/stream/rules", headers=headers)
        if existing.status_code == 200:
            data = existing.json().get("data") or []
            if any(r.get("value") == rule_value for r in data):
                return
        client.post(
            "https://api.twitter.com/2/tweets/search/stream/rules",
            headers=headers,
            json={"add": [{"value": rule_value, "tag": "tip-id-realtime"}]},
        )


def run_x_filtered_stream() -> None:
    token = settings.X_BEARER_TOKEN
    if not token:
        logger.warning("X_BEARER_TOKEN belum diisi; X Filtered Stream tidak dijalankan.")
        return

    ensure_stream_rules(token, settings.X_STREAM_RULES)
    url = "https://api.twitter.com/2/tweets/search/stream?tweet.fields=created_at,public_metrics,author_id&expansions=author_id&user.fields=username,public_metrics"
    headers = {"Authorization": f"Bearer {token}"}

    while True:
        try:
            with httpx.stream("GET", url, headers=headers, timeout=90.0) as resp:
                for line in resp.iter_lines():
                    if not line:
                        continue
                    payload = json.loads(line)
                    tweet = payload.get("data") or {}
                    users = {u["id"]: u for u in (payload.get("includes", {}).get("users") or [])}
                    author = users.get(tweet.get("author_id"), {})
                    username = author.get("username", "x_user")
                    metrics = tweet.get("public_metrics") or {}
                    db = SessionLocal()
                    try:
                        ingest_licensed_social_post(
                            db,
                            platform="X (Twitter)",
                            url=f"https://x.com/{username}/status/{tweet.get('id')}",
                            title=(tweet.get("text") or "")[:140],
                            body=tweet.get("text") or "",
                            author=f"@{username}",
                            published_at=datetime.utcnow(),
                            engagement={
                                "likes": metrics.get("like_count"),
                                "shares": metrics.get("retweet_count"),
                                "replies": metrics.get("reply_count"),
                                "followers": (author.get("public_metrics") or {}).get("followers_count"),
                            },
                        )
                    finally:
                        db.close()
        except Exception as exc:
            logger.warning("Koneksi X Filtered Stream terputus (%s), reconnect dalam 5 detik", exc)
            time.sleep(5)


if __name__ == "__main__":
    run_x_filtered_stream()
