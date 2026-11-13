"""OpenSearch full-text search adapter dengan fallback SQL query (FR-21)."""

from __future__ import annotations

import logging
from typing import Any, Dict, List

from sqlalchemy.orm import Session

from backend.app.config import settings
from backend.app.models import Issue, RawItem

logger = logging.getLogger("tip_search")


def _os_client():
    if not settings.OPENSEARCH_ENABLED:
        return None
    try:
        from opensearchpy import OpenSearch

        return OpenSearch(hosts=[settings.OPENSEARCH_URL], timeout=5)
    except Exception as exc:
        logger.warning("OpenSearch client gagal dibuat: %s", exc)
        return None


def index_issue(issue: Issue) -> bool:
    client = _os_client()
    if client is None:
        return False
    try:
        client.index(
            index="tip_issues",
            id=str(issue.id),
            body={
                "id": issue.id,
                "kode_referensi": issue.kode_referensi,
                "judul": issue.judul,
                "wilayah": issue.wilayah,
                "kategori": issue.kategori,
                "level": issue.level,
                "skor": issue.skor,
                "ringkasan": issue.ringkasan or "",
                "status": issue.status,
                "first_seen": issue.first_seen.isoformat() if issue.first_seen else None,
            },
        )
        return True
    except Exception as exc:
        logger.warning("Gagal indeks issue ke OpenSearch: %s", exc)
        return False


def fulltext_search_issues(db: Session, query: str, limit: int = 20) -> Dict[str, Any]:
    q = (query or "").strip()
    if not q:
        return {"engine": "sql", "items": []}

    client = _os_client()
    if client is not None:
        try:
            resp = client.search(
                index="tip_issues",
                body={
                    "size": limit,
                    "query": {
                        "multi_match": {
                            "query": q,
                            "fields": ["judul^3", "ringkasan^2", "wilayah", "kategori"],
                        }
                    },
                },
            )
            hits = [h["_source"] for h in resp.get("hits", {}).get("hits", [])]
            return {"engine": "opensearch", "items": hits}
        except Exception as exc:
            logger.warning("Query OpenSearch gagal (%s), fallback ke SQL", exc)

    like_pattern = f"%{q}%"
    rows: List[Issue] = (
        db.query(Issue)
        .filter(
            (Issue.judul.ilike(like_pattern))
            | (Issue.ringkasan.ilike(like_pattern))
            | (Issue.wilayah.ilike(like_pattern))
            | (Issue.kategori.ilike(like_pattern))
        )
        .order_by(Issue.skor.desc())
        .limit(limit)
        .all()
    )
    return {
        "engine": "sql",
        "items": [
            {
                "id": r.id,
                "kode_referensi": r.kode_referensi,
                "judul": r.judul,
                "wilayah": r.wilayah,
                "kategori": r.kategori,
                "level": r.level,
                "skor": r.skor,
                "status": r.status,
            }
            for r in rows
        ],
    }
