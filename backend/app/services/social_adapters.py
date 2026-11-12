"""Adaptor sumber tambahan: pencarian YouTube (yt-dlp), kanal Telegram publik, dan GDELT.

Setiap adaptor mengembalikan entri berbentuk sama dengan entri feed lain di collector:
title, link, summary, author, _published_iso, _feed_title, dan _eng (engagement).
Parser dipisah dari pengambilan jaringan agar bisa diuji dengan contoh HTML/JSON lokal.
"""

from __future__ import annotations

import html as html_lib
import re
import threading
import time
from datetime import datetime, timezone
from typing import Any, Callable, Dict, Iterable, List, Optional, Set, Tuple
from urllib.parse import urlparse

import httpx

BROWSER_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
HTTP_TIMEOUT = 30.0

# Batas ekstraksi penuh video baru per tarikan (sekitar 1,5 detik per video).
YOUTUBE_MAX_FULL_EXTRACT = 8
YOUTUBE_SEARCH_LIMIT = 15

_TAG_RE = re.compile(r"<[^>]+>")
_WS_RE = re.compile(r"\s+")


def _clean(value: Optional[str], limit: int = 2000) -> str:
    if not value:
        return ""
    text = _TAG_RE.sub(" ", html_lib.unescape(value.replace("<br/>", "\n").replace("<br>", "\n")))
    return _WS_RE.sub(" ", text).strip()[:limit]


def _ts_to_iso(ts: Any) -> Optional[str]:
    try:
        return datetime.fromtimestamp(int(ts), tz=timezone.utc).isoformat()
    except (TypeError, ValueError, OSError):
        return None


def _int(value: Any) -> Optional[int]:
    try:
        n = int(value)
    except (TypeError, ValueError):
        return None
    return n if n >= 0 else None


# ---------------------------------------------------------------------------
# YouTube (yt-dlp)
# ---------------------------------------------------------------------------

def is_youtube_search(url: str) -> bool:
    u = urlparse(url)
    return (u.hostname or "").endswith("youtube.com") and u.path == "/results"


def youtube_video_entry(info: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Entri dari hasil ekstraksi penuh satu video yt-dlp."""
    vid = info.get("id")
    title = (info.get("title") or "").strip()
    if not vid or not title:
        return None
    channel = info.get("channel") or info.get("uploader") or "YouTube"
    handle = info.get("uploader_id")
    author = handle if isinstance(handle, str) and handle.startswith("@") else channel
    return {
        "title": title[:300],
        "link": f"https://www.youtube.com/watch?v={vid}",
        "summary": _clean(info.get("description"), 1500) or title,
        "author": author,
        "_published_iso": _ts_to_iso(info.get("timestamp") or info.get("release_timestamp")),
        "_feed_title": f"YouTube: {channel}",
        "_eng": {
            "views": _int(info.get("view_count")),
            "likes": _int(info.get("like_count")),
            "replies": _int(info.get("comment_count")),
            "followers": _int(info.get("channel_follower_count")),
        },
    }


def youtube_refresh_entry(flat: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Entri ringan dari hasil pencarian (tanpa ekstraksi penuh) untuk memperbarui jumlah tayangan video lama."""
    vid = flat.get("id")
    if not vid:
        return None
    title = (flat.get("title") or "").strip() or vid
    return {
        "title": title[:300],
        "link": f"https://www.youtube.com/watch?v={vid}",
        "summary": title,
        "author": flat.get("channel"),
        "_feed_title": f"YouTube: {flat.get('channel') or 'YouTube'}",
        "_eng": {"views": _int(flat.get("view_count"))},
        "_refresh_only": True,
    }


def fetch_youtube_search(
    url: str,
    known_urls: Optional[Callable[[Iterable[str]], Set[str]]] = None,
    limit: int = YOUTUBE_SEARCH_LIMIT,
) -> Tuple[List[Dict[str, Any]], Optional[str]]:
    """Cari video lewat URL hasil pencarian YouTube, ekstrak penuh hanya video yang belum tersimpan."""
    try:
        import yt_dlp  # type: ignore
    except ImportError:
        return [], "yt-dlp belum terpasang (pip install yt-dlp)"

    base = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "noplaylist": True,
        "ignoreerrors": True,
        "socket_timeout": 20,
    }
    try:
        with yt_dlp.YoutubeDL({**base, "extract_flat": "in_playlist", "playlistend": limit}) as ydl:
            result = ydl.extract_info(url, download=False)
    except Exception as exc:  # yt-dlp melempar berbagai jenis error
        return [], f"pencarian YouTube gagal: {type(exc).__name__}: {str(exc)[:200]}"

    flat = [e for e in (result or {}).get("entries") or [] if e and e.get("id")]
    if not flat:
        return [], "pencarian YouTube tidak mengembalikan video"

    links = [f"https://www.youtube.com/watch?v={e['id']}" for e in flat]
    stored = known_urls(links) if known_urls else set()

    entries: List[Dict[str, Any]] = []
    new_ids = [e for e in flat if f"https://www.youtube.com/watch?v={e['id']}" not in stored]
    with yt_dlp.YoutubeDL(base) as ydl:
        for e in new_ids[:YOUTUBE_MAX_FULL_EXTRACT]:
            try:
                info = ydl.extract_info(f"https://www.youtube.com/watch?v={e['id']}", download=False)
            except Exception:
                info = None
            entry = youtube_video_entry(info or {})
            if entry:
                entries.append(entry)
    for e in flat:
        if f"https://www.youtube.com/watch?v={e['id']}" in stored:
            refresh = youtube_refresh_entry(e)
            if refresh:
                entries.append(refresh)
    return entries, None


# ---------------------------------------------------------------------------
# Telegram (pratinjau kanal publik t.me/s/<kanal>)
# ---------------------------------------------------------------------------

def is_telegram_channel(url: str) -> bool:
    u = urlparse(url)
    return (u.hostname or "") in ("t.me", "telegram.me") and u.path.startswith("/s/")


_TG_MSG_RE = re.compile(r'<div class="tgme_widget_message [^"]*"[^>]*data-post="([^"]+)"(.*?)(?=<div class="tgme_widget_message_wrap|\Z)', re.S)
_TG_TEXT_RE = re.compile(r'<div class="tgme_widget_message_text[^"]*"[^>]*>(.*?)</div>', re.S)
_TG_VIEWS_RE = re.compile(r'<span class="tgme_widget_message_views">([^<]+)</span>')
_TG_TIME_RE = re.compile(r'<time[^>]*datetime="([^"]+)"')
_TG_TITLE_RE = re.compile(r'<meta property="og:title" content="([^"]*)"')


def parse_count(text: Optional[str]) -> Optional[int]:
    """Angka ringkas Telegram: "987", "1.2K", "3,4M"."""
    if not text:
        return None
    t = text.strip().upper().replace(",", ".")
    mult = 1
    if t.endswith("K"):
        mult, t = 1_000, t[:-1]
    elif t.endswith("M"):
        mult, t = 1_000_000, t[:-1]
    try:
        return int(round(float(t) * mult))
    except ValueError:
        return None


def parse_telegram_channel(page: str, limit: int = 25) -> List[Dict[str, Any]]:
    title_m = _TG_TITLE_RE.search(page)
    channel_title = html_lib.unescape(title_m.group(1)) if title_m else "Telegram"
    entries: List[Dict[str, Any]] = []
    for post, body in _TG_MSG_RE.findall(page):
        text_m = _TG_TEXT_RE.search(body)
        text = _clean(text_m.group(1)) if text_m else ""
        if not text:
            continue  # postingan tanpa teks (hanya foto/video) tidak bisa dianalisis
        views_m = _TG_VIEWS_RE.search(body)
        time_m = _TG_TIME_RE.search(body)
        channel = post.split("/")[0]
        entries.append({
            "title": text[:140] + ("..." if len(text) > 140 else ""),
            "link": f"https://t.me/{post}",
            "summary": text,
            "author": f"@{channel}",
            "_published_iso": time_m.group(1) if time_m else None,
            "_feed_title": f"Telegram: {channel_title}",
            "_eng": {"views": parse_count(views_m.group(1)) if views_m else None},
        })
    # Halaman pratinjau mengurutkan dari lama ke baru; ambil yang terbaru.
    return list(reversed(entries))[:limit]


def fetch_telegram_channel(url: str, limit: int = 25) -> Tuple[List[Dict[str, Any]], Optional[str]]:
    try:
        with httpx.Client(timeout=HTTP_TIMEOUT, follow_redirects=True, headers={"User-Agent": BROWSER_UA}) as client:
            resp = client.get(url)
    except httpx.HTTPError as exc:
        return [], f"gagal koneksi Telegram: {type(exc).__name__}"
    if resp.status_code >= 400:
        return [], f"Telegram HTTP {resp.status_code}"
    entries = parse_telegram_channel(resp.text, limit)
    if not entries:
        return [], "kanal Telegram tidak publik atau tidak ada postingan teks"
    return entries, None


# ---------------------------------------------------------------------------
# GDELT DOC 2.0 API
# ---------------------------------------------------------------------------

def is_gdelt(url: str) -> bool:
    return (urlparse(url).hostname or "") == "api.gdeltproject.org"


def _gdelt_date(value: Optional[str]) -> Optional[str]:
    # "20261112T070000Z" -> ISO 8601
    if not value or len(value) < 15:
        return None
    try:
        return datetime.strptime(value, "%Y%m%dT%H%M%SZ").replace(tzinfo=timezone.utc).isoformat()
    except ValueError:
        return None


def parse_gdelt(payload: Any, limit: int = 75) -> List[Dict[str, Any]]:
    articles = payload.get("articles", []) if isinstance(payload, dict) else []
    entries: List[Dict[str, Any]] = []
    for a in articles[:limit]:
        title = _clean(a.get("title"), 300)
        link = a.get("url")
        if not title or not link:
            continue
        domain = a.get("domain") or urlparse(link).hostname or "GDELT"
        entries.append({
            "title": title,
            "link": link,
            # GDELT artlist tidak menyertakan isi artikel; judul dipakai sebagai isi.
            "summary": title,
            "author": None,
            "_published_iso": _gdelt_date(a.get("seendate")),
            "_feed_title": domain,
        })
    return entries


# GDELT menolak lebih dari 1 permintaan per 5 detik, dan query OR dengan 4 kata atau lebih
# ditolak sebagai "query besar". Sumber GDELT karena itu dipecah menjadi query kecil,
# dan setiap permintaan diberi jeda minimal dari permintaan sebelumnya.
GDELT_MIN_INTERVAL_S = 6.0
_gdelt_lock = threading.Lock()
_gdelt_last_call = 0.0


GDELT_RETRY_WAIT_S = 12.0


def _gdelt_get(url: str) -> httpx.Response:
    global _gdelt_last_call
    with _gdelt_lock:
        wait = GDELT_MIN_INTERVAL_S - (time.monotonic() - _gdelt_last_call)
        if wait > 0:
            time.sleep(wait)
        try:
            with httpx.Client(timeout=60.0, headers={"User-Agent": BROWSER_UA}) as client:
                return client.get(url)
        finally:
            _gdelt_last_call = time.monotonic()


def fetch_gdelt(url: str, limit: int = 75) -> Tuple[List[Dict[str, Any]], Optional[str]]:
    try:
        resp = _gdelt_get(url)
        if resp.status_code == 429:
            # Pembatasan GDELT tidak selalu konsisten; satu kali coba ulang setelah jeda.
            time.sleep(GDELT_RETRY_WAIT_S)
            resp = _gdelt_get(url)
    except httpx.HTTPError as exc:
        return [], f"gagal koneksi GDELT: {type(exc).__name__}"
    if resp.status_code == 429:
        return [], "GDELT membatasi permintaan (maks 1 per 5 detik), dicoba lagi pada tarikan berikutnya"
    if resp.status_code >= 400:
        return [], f"GDELT HTTP {resp.status_code}"
    try:
        payload = resp.json()
    except ValueError:
        # GDELT mengembalikan teks biasa untuk query tidak valid atau pembatasan.
        return [], f"respons GDELT bukan JSON: {resp.text[:120]}"
    entries = parse_gdelt(payload, limit)
    if not entries:
        return [], "GDELT tidak mengembalikan artikel untuk query ini"
    return entries, None
