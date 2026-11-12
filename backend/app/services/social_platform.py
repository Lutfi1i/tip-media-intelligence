"""Penentuan platform asal konten.

Platform diambil dari domain asli konten. Untuk entri Google News, domain asli ada di
`source.href` (misalnya https://x.com atau https://megapolitan.kompas.com), sedangkan link
entri selalu news.google.com. Nama feed tidak dipakai karena berisi query pencarian
(misalnya "site:x.com ... threads") yang bisa memberi label platform yang salah.
"""

from __future__ import annotations

import re
from typing import Optional
from urllib.parse import urlparse

NEWS = "berita"

SOCIAL_PLATFORMS = ["X (Twitter)", "TikTok", "Threads", "YouTube", "Instagram", "Facebook", "Reddit", "Telegram", "Bluesky"]

_DOMAIN_MAP = [
    (("x.com", "twitter.com", "syndication.twitter.com"), "X (Twitter)"),
    (("tiktok.com",), "TikTok"),
    (("threads.net", "threads.com"), "Threads"),
    (("youtube.com", "youtu.be"), "YouTube"),
    (("instagram.com",), "Instagram"),
    (("facebook.com", "fb.com", "fb.watch"), "Facebook"),
    (("bsky.app", "bsky.social"), "Bluesky"),
    (("reddit.com", "redd.it"), "Reddit"),
    (("t.me", "telegram.me"), "Telegram"),
]

# Judul entri Google News untuk artikel berita berakhiran " - Nama Media".
_GN_SUFFIX_RE = re.compile(r"\s-\s([^-]{2,60})$")
_SOCIAL_SUFFIXES = {"x", "twitter", "tiktok", "threads", "youtube", "instagram", "facebook", "bluesky", "reddit", "telegram"}


def platform_from_url(url: Optional[str]) -> Optional[str]:
    """Kembalikan nama platform sosial bila domain URL dikenali, None bila bukan domain sosial."""
    if not url:
        return None
    try:
        host = (urlparse(url).hostname or "").lower()
    except ValueError:
        return None
    if not host:
        return None
    for domains, name in _DOMAIN_MAP:
        if any(host == d or host.endswith("." + d) for d in domains):
            return name
    return None


def resolve_platform(link: Optional[str], origin_href: Optional[str] = None) -> str:
    """Platform untuk konten baru. `origin_href` adalah domain asli bila link berupa pengalih (Google News).

    Bila tidak ada domain sosial yang dikenali, konten dianggap berita, walaupun datang
    dari sumber berlabel media sosial. Platform tidak ditebak dari nama sumber.
    """
    for candidate in (origin_href, link):
        plat = platform_from_url(candidate)
        if plat:
            return plat
    return NEWS


def legacy_platform(penerbit: Optional[str], url: Optional[str], judul: Optional[str] = None) -> str:
    """Tebakan untuk baris lama yang belum punya kolom platform.

    Urutan: domain URL, lalu akhiran judul Google News, lalu nama penerbit.
    Akhiran " - Kompas.com" pada judul Google News menandakan artikel berita.
    """
    plat = platform_from_url(url)
    if plat:
        return plat
    u = (url or "").lower()
    if "news.google.com" in u and judul:
        m = _GN_SUFFIX_RE.search(judul.strip())
        if m and m.group(1).strip().lower() not in _SOCIAL_SUFFIXES:
            return NEWS
    p = (penerbit or "").lower()
    if "threads" in p:
        return "Threads"
    if "twitter" in p or "x.com" in p or p.startswith("x "):
        return "X (Twitter)"
    if "tiktok" in p:
        return "TikTok"
    if "youtube" in p:
        return "YouTube"
    if "instagram" in p:
        return "Instagram"
    if "facebook" in p:
        return "Facebook"
    if "bluesky" in p:
        return "Bluesky"
    if "reddit" in p:
        return "Reddit"
    if "telegram" in p:
        return "Telegram"
    return NEWS


def is_social(platform: Optional[str]) -> bool:
    return bool(platform) and platform in SOCIAL_PLATFORMS
