"""Kolektor data nyata (bukan simulasi).

Menarik feed publik dari sumber yang terdaftar (`Source.url`) lalu meneruskannya ke
`ingest_content_item()` untuk dedup + klasifikasi AI + penyimpanan.

Semua angka yang dikembalikan berasal dari eksekusi nyata: jumlah entri yang benar-benar
dibaca dari feed, jumlah yang lolos dedup, dan error jaringan apa adanya.
"""

from __future__ import annotations

import html
import json
import re
import time
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from typing import Any, Callable, Dict, Iterable, List, Optional, Set, Tuple
from urllib.parse import parse_qs, urlparse
from urllib.robotparser import RobotFileParser

import feedparser
import httpx
from sqlalchemy.orm import Session

from backend.app.models import RawItem, Source
from backend.app.services.ingestion import can_fetch_source, ingest_content_item
from backend.app.services.social_platform import resolve_platform
from backend.app.services.social_adapters import (
    fetch_gdelt,
    fetch_telegram_channel,
    fetch_youtube_search,
    is_gdelt,
    is_telegram_channel,
    is_youtube_search,
)

USER_AGENT = "TIPMediaIntelligence/1.0 (media monitoring; kontak: operator@tip.local)"
HTTP_TIMEOUT = 25.0
MAX_ENTRIES_PER_SOURCE = 25
MAX_ITEM_AGE = timedelta(days=60)

_ROBOTS_CACHE: Dict[str, Tuple[float, Optional[RobotFileParser]]] = {}


def is_allowed_by_robots(url: str) -> bool:
    """Patuhi robots.txt per domain dengan cache 24 jam (FR-05)."""
    parsed = urlparse(url)
    if not parsed.scheme or not parsed.netloc:
        return True
    base = f"{parsed.scheme}://{parsed.netloc}"
    now = time.time()
    cached = _ROBOTS_CACHE.get(base)
    if cached and (now - cached[0]) < 86400:
        rp = cached[1]
        return True if rp is None else rp.can_fetch(USER_AGENT, url)

    rp = RobotFileParser()
    try:
        resp = httpx.get(f"{base}/robots.txt", timeout=5.0, headers={"User-Agent": USER_AGENT})
        if resp.status_code == 200:
            rp.parse(resp.text.splitlines())
            _ROBOTS_CACHE[base] = (now, rp)
            return rp.can_fetch(USER_AGENT, url)
    except Exception:
        pass
    _ROBOTS_CACHE[base] = (now, None)
    return True

_HANDLE_RE = re.compile(r"\(@([A-Za-z0-9_.]{2,40})\)")
_TAG_RE = re.compile(r"<[^>]+>")
_WS_RE = re.compile(r"\s+")


def _strip_html(value: Optional[str], limit: int = 1200) -> str:
    if not value:
        return ""
    text = _TAG_RE.sub(" ", html.unescape(value))
    text = _WS_RE.sub(" ", text).strip()
    return text[:limit]


def _entry_body(entry: Any) -> str:
    """Ambil isi entri dari berbagai bentuk feed (summary/description/content)."""
    content = entry.get("content")
    if content:
        try:
            first = content[0]
            value = first.get("value") if hasattr(first, "get") else None
            if value:
                return _strip_html(value, limit=2000)
        except (IndexError, TypeError, AttributeError):
            pass
    return _strip_html(entry.get("summary") or entry.get("description"), limit=2000)


def _parse_datetime_text(value: str) -> Optional[datetime]:
    """ISO 8601 (Bluesky, BMKG) atau format Twitter "Wed Nov 12 08:04:00 +0000 2026". Hasil dalam UTC naif."""
    value = value.strip()
    candidates = []
    try:
        candidates.append(datetime.fromisoformat(value.replace("Z", "+00:00")))
    except ValueError:
        pass
    if not candidates:
        try:
            candidates.append(datetime.strptime(value, "%a %b %d %H:%M:%S %z %Y"))
        except ValueError:
            pass
    if not candidates:
        try:
            candidates.append(parsedate_to_datetime(value))
        except (TypeError, ValueError):
            pass
    if not candidates:
        return None
    dt = candidates[0]
    if dt.tzinfo is not None:
        dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


def _parse_published(entry: Any) -> Optional[datetime]:
    iso = entry.get("_published_iso") if hasattr(entry, "get") else None
    if iso:
        parsed = _parse_datetime_text(str(iso))
        if parsed:
            return parsed
    for attr in ("published_parsed", "updated_parsed", "created_parsed"):
        parsed = getattr(entry, attr, None)
        if parsed:
            try:
                return datetime(*parsed[:6])
            except (TypeError, ValueError):
                continue
    return None


def _to_int(value: Any) -> Optional[int]:
    """Angka engagement dari API bisa berupa int, string, atau tidak ada. Selain angka valid dikembalikan None."""
    if value is None or isinstance(value, bool):
        return None
    try:
        number = int(str(value).replace(",", "").strip())
    except (TypeError, ValueError):
        return None
    return number if number >= 0 else None


def _entry_engagement(entry: Any) -> Dict[str, Optional[int]]:
    """Engagement dari adapter (`_eng`) atau dari ekstensi Media RSS (YouTube: views dan jumlah rating)."""
    eng = dict(entry.get("_eng") or {}) if hasattr(entry, "get") else {}
    stats = entry.get("media_statistics") if hasattr(entry, "get") else None
    if isinstance(stats, dict) and eng.get("views") is None:
        eng["views"] = _to_int(stats.get("views"))
    rating = entry.get("media_starrating") if hasattr(entry, "get") else None
    if isinstance(rating, dict) and eng.get("likes") is None:
        eng["likes"] = _to_int(rating.get("count"))
    return {k: v for k, v in eng.items() if v is not None}


def _entry_origin(entry: Any) -> Tuple[Optional[str], Optional[str]]:
    """Domain dan nama media asli. Google News menaruhnya di elemen <source href=... >Nama</source>."""
    src = entry.get("source") if hasattr(entry, "get") else None
    if isinstance(src, dict):
        return src.get("href"), src.get("title")
    return entry.get("_origin_href") if hasattr(entry, "get") else None, None


def _entry_author(entry: Any, title: str) -> Optional[str]:
    """Penulis dari sumber, atau handle "(@nama)" di judul (pola halaman Threads/Instagram di Google News)."""
    author = entry.get("author") if hasattr(entry, "get") else None
    if author:
        return str(author)[:200]
    m = _HANDLE_RE.search(title or "")
    return f"@{m.group(1)}" if m else None


def _last_fetch_at(db: Session, source: Source) -> Optional[datetime]:
    if source.last_fetch_at:
        return source.last_fetch_at
    row = (
        db.query(RawItem.fetched_at)
        .filter(RawItem.source_id == source.id)
        .order_by(RawItem.fetched_at.desc())
        .first()
    )
    return row[0] if row else None


def _entries_from_bmkg(payload: Any, limit: int) -> List[Dict[str, Any]]:
    """Adapter untuk API resmi BMKG (gempaterkini.json / gempadirasakan.json)."""
    gempa = []
    if isinstance(payload, dict):
        info = payload.get("Infogempa", {})
        gempa = info.get("gempa", []) if isinstance(info, dict) else []
    if isinstance(gempa, dict):
        gempa = [gempa]

    entries: List[Dict[str, Any]] = []
    for g in gempa[:limit]:
        if not isinstance(g, dict):
            continue
        magnitudo = g.get("Magnitude", "?")
        wilayah = g.get("Wilayah", "tidak diketahui")
        entries.append(
            {
                "title": f"Gempa M{magnitudo}: {wilayah}",
                "link": g.get("Shakemap")
                or f"https://www.bmkg.go.id/gempabumi/gempabumi-terkini.bmkg#{g.get('DateTime', '')}",
                "summary": (
                    f"BMKG mencatat gempa {g.get('Tanggal', '')} pukul {g.get('Jam', '')} "
                    f"dengan magnitudo {magnitudo}, kedalaman {g.get('Kedalaman', '?')}, "
                    f"pusat di {wilayah}. {g.get('Potensi', '')} "
                    f"Dirasakan: {g.get('Dirasakan', 'tidak dilaporkan')}."
                ).strip(),
                "author": "BMKG",
                "_published_iso": g.get("DateTime"),
                "_feed_title": "BMKG: Gempa Bumi Terkini (data resmi)",
            }
        )
    return entries


def _entries_from_bluesky(payload: Any, limit: int) -> List[Dict[str, Any]]:
    """Adapter untuk postingan publik Bluesky (AT Protocol via XRPC public API)."""
    posts = payload.get("posts", []) if isinstance(payload, dict) else []
    entries: List[Dict[str, Any]] = []
    for p in posts[:limit]:
        if not isinstance(p, dict):
            continue
        record = p.get("record", {})
        author = p.get("author", {})
        text = record.get("text", "").strip()
        if not text:
            continue
        handle = author.get("handle") or "bluesky"
        uri = p.get("uri", "")
        rkey = uri.split("/")[-1] if uri else ""
        link = f"https://bsky.app/profile/{handle}/post/{rkey}" if rkey else uri
        title = text[:140] + ("..." if len(text) > 140 else "")
        created_at = record.get("createdAt")
        entries.append(
            {
                "title": title,
                "link": link,
                "summary": text,
                "author": f"@{handle}",
                "_published_iso": created_at,
                "_feed_title": "Bluesky (AT Protocol)",
                "_eng": {
                    "likes": _to_int(p.get("likeCount")),
                    "shares": _to_int(p.get("repostCount")),
                    "replies": _to_int(p.get("replyCount")),
                    "followers": _to_int(author.get("followersCount")),
                },
            }
        )
    return entries


def _entries_from_twitter_syndication(url: str, limit: int = MAX_ENTRIES_PER_SOURCE) -> Tuple[List[Dict[str, Any]], Optional[str]]:
    """Tarik timeline resmi X/Twitter tanpa API key via Syndication endpoint."""
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    }
    try:
        with httpx.Client(timeout=HTTP_TIMEOUT, follow_redirects=True, headers=headers) as client:
            resp = client.get(url)
        if resp.status_code >= 400:
            return [], f"Twitter Syndication HTTP {resp.status_code}"

        match = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', resp.text, re.DOTALL)
        if not match:
            return [], "Tidak dapat mengekstrak timeline Twitter dari payload HTML"

        data = json.loads(match.group(1))
        timeline = data.get("props", {}).get("pageProps", {}).get("timeline", {})
        raw_entries = timeline.get("entries", [])

        entries: List[Dict[str, Any]] = []
        for e in raw_entries[:limit]:
            tweet = e.get("content", {}).get("tweet", {})
            if not tweet:
                continue
            text = tweet.get("text", "").strip()
            if not text:
                continue
            user_obj = tweet.get("user", {}) or {}
            user = user_obj.get("screen_name", "twitter")
            tweet_id = tweet.get("id_str", "")
            created_at = tweet.get("created_at")
            entries.append({
                "title": text[:140] + ("..." if len(text) > 140 else ""),
                "link": f"https://x.com/{user}/status/{tweet_id}" if tweet_id else f"https://x.com/{user}",
                "summary": text,
                "author": f"@{user}",
                "_published_iso": created_at,
                "_feed_title": f"X / Twitter (@{user})",
                "_eng": {
                    "likes": _to_int(tweet.get("favorite_count")),
                    "shares": _to_int(tweet.get("retweet_count")),
                    "replies": _to_int(tweet.get("reply_count")),
                    "views": _to_int((tweet.get("ext_views") or {}).get("count")),
                    "followers": _to_int(user_obj.get("followers_count")),
                },
            })
        return entries, None
    except Exception as exc:
        return [], f"Gagal parsing Twitter syndication: {exc}"


def fetch_source_entries(
    url: str,
    limit: int = MAX_ENTRIES_PER_SOURCE,
    known_urls: Optional[Callable[[Iterable[str]], Set[str]]] = None,
) -> Tuple[List[Any], Optional[str]]:
    """Ambil dan parse feed (RSS/Atom) atau API JSON resmi/Bluesky/Twitter. Mengembalikan (entries, error_message).

    `known_urls` dipakai adaptor YouTube agar video yang sudah tersimpan tidak diekstrak penuh ulang.
    """
    if is_youtube_search(url):
        return fetch_youtube_search(url, known_urls)
    if is_telegram_channel(url):
        return fetch_telegram_channel(url, limit)
    if is_gdelt(url):
        return fetch_gdelt(url)

    # Jalur Twitter Syndication
    if "syndication.twitter.com" in url.lower():
        return _entries_from_twitter_syndication(url, limit)

    if not is_allowed_by_robots(url):
        return [], "diblokir oleh robots.txt"

    response = None
    last_err = None
    for attempt in range(3):
        try:
            with httpx.Client(
                timeout=HTTP_TIMEOUT,
                follow_redirects=True,
                headers={"User-Agent": USER_AGENT, "Accept": "application/rss+xml, application/xml, text/xml, application/json, */*"},
            ) as client:
                response = client.get(url)
            if response.status_code < 500:
                break
            last_err = f"HTTP {response.status_code}"
        except httpx.HTTPError as exc:
            last_err = f"gagal koneksi: {type(exc).__name__}: {exc}"
        if attempt < 2:
            time.sleep(0.5 * (2 ** attempt))

    if response is None:
        return [], last_err or "gagal koneksi"

    if response.status_code >= 400:
        return [], f"HTTP {response.status_code}"

    # Jalur Media Sosial Bluesky (AT Protocol).
    if "api.bsky.app" in url.lower() or "bsky.app" in url.lower():
        try:
            payload = response.json()
        except ValueError:
            return [], "respons Bluesky bukan JSON valid"
        entries = _entries_from_bluesky(payload, limit)
        if not entries:
            return [], "tidak ada postingan Bluesky relevan"
        return entries, None

    # Jalur JSON resmi (mis. data.bmkg.go.id).
    if ".json" in url.lower() or "application/json" in response.headers.get("content-type", ""):
        try:
            payload = response.json()
        except ValueError:
            return [], "respons bukan JSON valid"
        entries = _entries_from_bmkg(payload, limit)
        if not entries:
            return [], "JSON tidak memuat entri yang dikenali"
        return entries, None

    parsed = feedparser.parse(response.content)
    if parsed.bozo and not parsed.entries:
        return [], f"feed tidak valid: {parsed.get('bozo_exception', 'unknown')}"

    entries = list(parsed.entries)[:limit]
    if not entries:
        return [], "feed kosong (0 entri)"

    # Simpan nama kanal untuk dipakai sebagai penerbit bila entri tidak punya source.
    feed_title = _strip_html(parsed.feed.get("title"), 200) if parsed.feed else ""
    for entry in entries:
        entry["_feed_title"] = feed_title
        _unwrap_bing_news(entry)
    return entries, None


_ON_MSN_RE = re.compile(r"\s+on MSN$", re.IGNORECASE)


def _unwrap_bing_news(entry: Any) -> None:
    """Bing News RSS membungkus tautan artikel dalam pengalih apiclick.aspx yang berubah tiap tarikan.

    Tautan asli diambil dari parameter `url`, supaya deduplikasi per URL bekerja dan
    nama media asli (elemen <News:Source>) dipakai sebagai penerbit.
    """
    link = entry.get("link") or ""
    if "bing.com/news/apiclick" not in link.lower():
        return
    real = parse_qs(urlparse(link).query).get("url", [None])[0]
    if real:
        entry["link"] = real
    name = _ON_MSN_RE.sub("", str(entry.get("news_source") or "")).strip()
    entry["source"] = {"href": real or link, "title": name or None}


def collect_source(db: Session, source: Source, force: bool = False) -> Dict[str, Any]:
    """Tarik satu sumber. Menghormati `frekuensi_menit` kecuali force=True."""
    result: Dict[str, Any] = {
        "source_id": source.id,
        "nama": source.nama,
        "url": source.url,
        "status": "dilewati",
        "dibaca": 0,
        "baru": 0,
        "duplikat": 0,
        "repost": 0,
        "terlalu_lama": 0,
        "error": None,
    }

    if not can_fetch_source(source):
        result["error"] = f"status izin '{source.status_izin}': tidak boleh diambil"
        return result

    if not source.url:
        result["error"] = "URL sumber kosong"
        return result

    if not force:
        last = _last_fetch_at(db, source)
        if last and datetime.utcnow() - last < timedelta(minutes=source.frekuensi_menit):
            result["error"] = f"interval {source.frekuensi_menit} menit belum lewat"
            return result

    def known_urls(urls: Iterable[str]) -> Set[str]:
        urls = list(urls)
        if not urls:
            return set()
        return {u for (u,) in db.query(RawItem.url_kanonik).filter(RawItem.url_kanonik.in_(urls)).all()}

    entries, error = fetch_source_entries(source.url, known_urls=known_urls)
    now = datetime.utcnow()
    source.last_fetch_at = now
    source.last_fetch_count = len(entries)
    if error:
        source.last_fetch_status = "gagal"
        source.last_fetch_error = error[:500]
        db.commit()
        result["status"] = "gagal"
        result["error"] = error
        return result
    source.last_fetch_status = "ok"
    source.last_fetch_error = None
    source.last_success_at = now
    db.commit()

    result["dibaca"] = len(entries)
    for entry in entries:
        title = _strip_html(entry.get("title"), 300)
        link = entry.get("link") or ""
        body = _entry_body(entry)
        if not title:
            continue

        published_at = _parse_published(entry)
        if published_at is None:
            published_at = datetime.utcnow()
        if published_at > datetime.utcnow() + timedelta(hours=6):
            published_at = datetime.utcnow()
        if published_at < datetime.utcnow() - MAX_ITEM_AGE:
            # Mis. syndication X mengembalikan tweet populer bertahun-tahun lalu: bukan percakapan terkini.
            result["terlalu_lama"] += 1
            continue

        origin_href, origin_name = _entry_origin(entry)
        penerbit = origin_name or entry.get("_feed_title") or source.nama
        try:
            outcome = ingest_content_item(
                db=db,
                source_id=source.id,
                url=link,
                title=title,
                body=body or title,
                penerbit=penerbit[:200],
                penulis=_entry_author(entry, title),
                published_at=published_at,
                platform=resolve_platform(link, origin_href),
                engagement=_entry_engagement(entry),
            )
        except Exception as exc:  # satu entri gagal tidak boleh menghentikan seluruh sumber
            db.rollback()
            result.setdefault("status_lain", []).append(f"error: {type(exc).__name__}")
            continue

        status = outcome.get("status")
        if status == "ingested":
            result["baru"] += 1
            if outcome.get("is_repost"):
                result["repost"] += 1
        elif status == "duplicate_exact":
            result["duplikat"] += 1
        else:
            # status tak dikenal tetap dilaporkan apa adanya, tidak disembunyikan
            result.setdefault("status_lain", []).append(status)

    # Jumlah entri yang benar-benar terkini (bukan konten lama yang dilewati).
    source.last_fetch_count = result["dibaca"] - result["terlalu_lama"]
    db.commit()
    result["status"] = "ok"
    return result


def collect_all(db: Session, force: bool = False) -> Dict[str, Any]:
    sources = db.query(Source).order_by(Source.id).all()
    per_source = [collect_source(db, src, force=force) for src in sources]
    return {
        "dijalankan_at": datetime.utcnow().isoformat(),
        "jumlah_sumber": len(per_source),
        "total_dibaca": sum(s["dibaca"] for s in per_source),
        "total_baru": sum(s["baru"] for s in per_source),
        "total_duplikat": sum(s["duplikat"] for s in per_source),
        "total_gagal": sum(1 for s in per_source if s["status"] == "gagal"),
        "sumber": per_source,
    }
