"""Penarikan langsung (real-time) postingan media sosial warga berdasarkan lokasi.

Berbeda dari `collector.py` yang menarik seluruh sumber terdaftar (termasuk RSS berita)
dengan jeda `frekuensi_menit`, modul ini fokus khusus ke platform media sosial
(`X (Twitter)`, `TikTok`, `Instagram`, `Threads`, `Bluesky`, `Reddit`) untuk lokasi
yang sedang difokuskan pengguna agar dapat diperbarui setiap beberapa detik.
"""

from __future__ import annotations

import logging
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import quote_plus

import feedparser
import httpx
from sqlalchemy.orm import Session

from backend.app.services.collector import (
    MAX_ITEM_AGE,
    USER_AGENT,
    _entry_author,
    _entry_body,
    _entry_engagement,
    _entry_origin,
    _parse_published,
    _strip_html,
)
from backend.app.services.geo_hierarchy import get_scope_expansion_keywords
from backend.app.services.ingestion import ingest_content_item
from backend.app.services.social_platform import SOCIAL_PLATFORMS, resolve_platform

logger = logging.getLogger("tip_live_social")

LIVE_FETCH_COOLDOWN_SECONDS = 8
HTTP_TIMEOUT = 8.0

_cooldown_lock = threading.Lock()
_last_fetch_by_key: Dict[str, Tuple[float, Dict[str, Any]]] = {}


def _clean_location_terms(scope_kode: str) -> Tuple[str, List[str]]:
    """Ambil nama kota/kabupaten bersih (tanpa awalan 'kota '/'kabupaten ') dan istilah pendukung."""
    if not scope_kode or scope_kode == "ID":
        return "Indonesia", ["indonesia"]

    exp = get_scope_expansion_keywords(scope_kode)
    terms: List[str] = []
    seen = set()

    for raw in exp.get("primary", []):
        cleaned = raw.strip()
        for prefix in ("kota ", "kabupaten ", "kab. ", "provinsi "):
            if cleaned.startswith(prefix):
                short = cleaned[len(prefix):].strip()
                if short and short not in seen:
                    seen.add(short)
                    terms.append(short)
        if cleaned and cleaned not in seen:
            seen.add(cleaned)
            terms.append(cleaned)

    for extra in exp.get("landmarks", [])[:2]:
        e = extra.strip()
        if e and e not in seen and len(e) >= 4:
            seen.add(e)
            terms.append(e)

    if not terms:
        terms = ["indonesia"]

    primary_display = terms[0].title()
    return primary_display, terms[:4]


def _build_gnews_social_url(site_expr: str, loc_terms: List[str], query_kw: Optional[str]) -> str:
    if len(loc_terms) == 1:
        loc_part = f'"{loc_terms[0]}"' if " " in loc_terms[0] else loc_terms[0]
    else:
        quoted = [f'"{t}"' if " " in t else t for t in loc_terms]
        loc_part = "(" + " OR ".join(quoted) + ")"
    kw_part = f" {query_kw.strip()}" if query_kw and query_kw.strip() else ""
    q_full = f"{site_expr} {loc_part}{kw_part} when:1d"
    return f"https://news.google.com/rss/search?q={quote_plus(q_full)}&hl=id&gl=ID&ceid=ID:id"


def _fetch_rss_entries(url: str, label: str) -> Tuple[str, List[Dict[str, Any]], Optional[str]]:
    try:
        resp = httpx.get(
            url,
            headers={"User-Agent": USER_AGENT, "Accept": "application/rss+xml, application/xml, text/xml"},
            timeout=HTTP_TIMEOUT,
            follow_redirects=True,
        )
        resp.raise_for_status()
        parsed = feedparser.parse(resp.text)
        entries = list(parsed.entries or [])[:15]
        return label, entries, None
    except Exception as exc:
        return label, [], f"{label}: {type(exc).__name__}"


def _fetch_bluesky_entries(primary_term: str, query_kw: Optional[str]) -> Tuple[str, List[Dict[str, Any]], Optional[str]]:
    q = f"{primary_term} {query_kw.strip()}" if query_kw and query_kw.strip() else primary_term
    url = f"https://api.bsky.app/xrpc/app.bsky.feed.searchPosts?q={quote_plus(q)}&limit=20&sort=latest"
    try:
        resp = httpx.get(
            url,
            headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
            timeout=HTTP_TIMEOUT,
            follow_redirects=True,
        )
        resp.raise_for_status()
        data = resp.json()
        entries: List[Dict[str, Any]] = []
        for post in data.get("posts") or []:
            record = post.get("record") or {}
            author = post.get("author") or {}
            text = (record.get("text") or "").strip()
            uri = post.get("uri") or ""
            handle = author.get("handle") or ""
            rkey = uri.rsplit("/", 1)[-1] if "/" in uri else ""
            if not text or not handle or not rkey:
                continue
            entries.append({
                "title": text[:280],
                "link": f"https://bsky.app/profile/{handle}/post/{rkey}",
                "summary": text,
                "author": f"@{handle}",
                "_published_iso": record.get("createdAt"),
                "_feed_title": "Bluesky Social",
                "_eng": {
                    "likes": post.get("likeCount"),
                    "shares": post.get("repostCount"),
                    "replies": post.get("replyCount"),
                },
            })
        return "Bluesky", entries, None
    except Exception as exc:
        return "Bluesky", [], f"Bluesky: {type(exc).__name__}"


def _fetch_reddit_entries(primary_term: str, query_kw: Optional[str]) -> Tuple[str, List[Dict[str, Any]], Optional[str]]:
    q = f"{primary_term} {query_kw.strip()}" if query_kw and query_kw.strip() else primary_term
    url = f"https://www.reddit.com/r/indonesia/search.json?q={quote_plus(q)}&restrict_sr=1&sort=new&t=week&limit=15"
    try:
        resp = httpx.get(
            url,
            headers={"User-Agent": "TIPMediaIntelligence/1.0 (by /u/tip_monitor)", "Accept": "application/json"},
            timeout=HTTP_TIMEOUT,
            follow_redirects=True,
        )
        resp.raise_for_status()
        data = resp.json()
        children = ((data.get("data") or {}).get("children")) or []
        entries: List[Dict[str, Any]] = []
        for child in children:
            post = child.get("data") or {}
            title = (post.get("title") or "").strip()
            permalink = post.get("permalink") or ""
            if not title or not permalink:
                continue
            created = post.get("created_utc")
            iso = datetime.utcfromtimestamp(float(created)).isoformat() + "Z" if created else None
            author = post.get("author")
            entries.append({
                "title": title[:280],
                "link": f"https://www.reddit.com{permalink}",
                "summary": (post.get("selftext") or title)[:1500],
                "author": f"u/{author}" if author else None,
                "_published_iso": iso,
                "_feed_title": "Reddit r/indonesia",
                "_eng": {
                    "likes": post.get("ups"),
                    "replies": post.get("num_comments"),
                },
            })
        return "Reddit", entries, None
    except Exception as exc:
        return "Reddit", [], f"Reddit: {type(exc).__name__}"


def fetch_live_social_for_location(
    db: Session,
    scope_kode: str = "ID",
    platform: Optional[str] = None,
    q: Optional[str] = None,
    force: bool = False,
) -> Dict[str, Any]:
    """Tarik postingan media sosial warga secara langsung untuk lokasi tertentu."""
    norm_scope = (scope_kode or "ID").strip()
    norm_plat = (platform or "").strip()
    norm_q = (q or "").strip()
    cache_key = f"{norm_scope}|{norm_plat}|{norm_q.lower()}"

    now_ts = time.monotonic()
    if not force:
        with _cooldown_lock:
            cached = _last_fetch_by_key.get(cache_key)
            if cached and (now_ts - cached[0]) < LIVE_FETCH_COOLDOWN_SECONDS:
                return {**cached[1], "cached": True}

    primary_display, loc_terms = _clean_location_terms(norm_scope)

    tasks: List[Tuple[str, Any]] = []
    want_all = not norm_plat or norm_plat == "Semua"

    if want_all or norm_plat == "X (Twitter)":
        url = _build_gnews_social_url("(site:x.com OR site:twitter.com)", loc_terms, norm_q)
        tasks.append(("X (Twitter)", lambda u=url: _fetch_rss_entries(u, "X (Twitter)")))
    if want_all or norm_plat == "TikTok":
        url = _build_gnews_social_url("site:tiktok.com", loc_terms, norm_q)
        tasks.append(("TikTok", lambda u=url: _fetch_rss_entries(u, "TikTok")))
    if want_all or norm_plat == "Threads":
        url = _build_gnews_social_url("(site:threads.com OR site:threads.net)", loc_terms, norm_q)
        tasks.append(("Threads", lambda u=url: _fetch_rss_entries(u, "Threads")))
    if want_all or norm_plat == "Instagram":
        url = _build_gnews_social_url("site:instagram.com", loc_terms, norm_q)
        tasks.append(("Instagram", lambda u=url: _fetch_rss_entries(u, "Instagram")))
    if want_all or norm_plat == "Bluesky":
        tasks.append(("Bluesky", lambda: _fetch_bluesky_entries(loc_terms[0], norm_q)))
    if want_all or norm_plat == "Reddit":
        tasks.append(("Reddit", lambda: _fetch_reddit_entries(loc_terms[0], norm_q)))

    raw_batches: List[Tuple[str, List[Dict[str, Any]], Optional[str]]] = []
    if tasks:
        with ThreadPoolExecutor(max_workers=min(6, len(tasks))) as pool:
            futures = [pool.submit(fn) for _, fn in tasks]
            for fut in as_completed(futures):
                raw_batches.append(fut.result())

    total_read = 0
    total_new = 0
    total_dup = 0
    errors: List[str] = []
    queried_platforms = [name for name, _ in tasks]

    for label, entries, err in raw_batches:
        if err:
            errors.append(err)
            continue
        total_read += len(entries)
        for entry in entries:
            title = _strip_html(entry.get("title"), 300)
            link = entry.get("link") or ""
            if not title or not link:
                continue
            body = _entry_body(entry)
            published_at = _parse_published(entry) or datetime.utcnow()
            if published_at > datetime.utcnow() + timedelta(hours=6):
                published_at = datetime.utcnow()
            if published_at < datetime.utcnow() - MAX_ITEM_AGE:
                continue

            origin_href, origin_name = _entry_origin(entry)
            resolved_plat = resolve_platform(link, origin_href)
            if resolved_plat not in SOCIAL_PLATFORMS:
                # Pastikan hanya konten media sosial yang masuk dari jalur live medsos
                if label in SOCIAL_PLATFORMS:
                    resolved_plat = label
                else:
                    continue

            penerbit = origin_name or entry.get("_feed_title") or resolved_plat
            try:
                outcome = ingest_content_item(
                    db=db,
                    source_id=None,
                    url=link,
                    title=title,
                    body=body or title,
                    penerbit=str(penerbit)[:200],
                    penulis=_entry_author(entry, title),
                    published_at=published_at,
                    platform=resolved_plat,
                    engagement=_entry_engagement(entry),
                )
            except Exception as exc:
                db.rollback()
                logger.warning("Gagal ingest live sosmed (%s): %s", label, exc)
                continue

            status = outcome.get("status")
            if status == "ingested":
                total_new += 1
            elif status == "duplicate_exact":
                total_dup += 1

    summary: Dict[str, Any] = {
        "scope_kode": norm_scope,
        "location_query": primary_display,
        "fetched_at": datetime.utcnow().isoformat() + "Z",
        "cached": False,
        "cooldown_seconds": LIVE_FETCH_COOLDOWN_SECONDS,
        "dibaca": total_read,
        "baru": total_new,
        "duplikat": total_dup,
        "platforms": queried_platforms,
        "errors": errors,
    }
    with _cooldown_lock:
        _last_fetch_by_key[cache_key] = (time.monotonic(), summary)
    return summary
