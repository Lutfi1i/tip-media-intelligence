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
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

import feedparser
import httpx
from sqlalchemy.orm import Session

from backend.app.models import RawItem, Source
from backend.app.services.ingestion import can_fetch_source, ingest_content_item

USER_AGENT = "TIPMediaIntelligence/1.0 (media monitoring; kontak: operator@tip.local)"
HTTP_TIMEOUT = 25.0
MAX_ENTRIES_PER_SOURCE = 25

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


def _parse_published(entry: Any) -> Optional[datetime]:
    iso = entry.get("_published_iso") if hasattr(entry, "get") else None
    if iso:
        try:
            from datetime import timezone

            parsed_iso = datetime.fromisoformat(str(iso).replace("Z", "+00:00"))
            return parsed_iso.astimezone(timezone.utc).replace(tzinfo=None)
        except ValueError:
            pass
    for attr in ("published_parsed", "updated_parsed", "created_parsed"):
        parsed = getattr(entry, attr, None)
        if parsed:
            try:
                return datetime(*parsed[:6])
            except (TypeError, ValueError):
                continue
    return None


def _last_fetch_at(db: Session, source_id: int) -> Optional[datetime]:
    row = (
        db.query(RawItem.fetched_at)
        .filter(RawItem.source_id == source_id)
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


def fetch_source_entries(url: str, limit: int = MAX_ENTRIES_PER_SOURCE) -> Tuple[List[Any], Optional[str]]:
    """Ambil dan parse feed (RSS/Atom) atau API JSON resmi. Mengembalikan (entries, error_message)."""
    try:
        with httpx.Client(
            timeout=HTTP_TIMEOUT,
            follow_redirects=True,
            headers={"User-Agent": USER_AGENT, "Accept": "application/rss+xml, application/xml, text/xml, application/json, */*"},
        ) as client:
            response = client.get(url)
    except httpx.HTTPError as exc:
        return [], f"gagal koneksi: {type(exc).__name__}: {exc}"

    if response.status_code >= 400:
        return [], f"HTTP {response.status_code}"

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
    return entries, None


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
        "error": None,
    }

    if not can_fetch_source(source):
        result["error"] = f"status izin '{source.status_izin}': tidak boleh diambil"
        return result

    if not source.url:
        result["error"] = "URL sumber kosong"
        return result

    if not force:
        last = _last_fetch_at(db, source.id)
        if last and datetime.utcnow() - last < timedelta(minutes=source.frekuensi_menit):
            result["error"] = f"interval {source.frekuensi_menit} menit belum lewat"
            return result

    entries, error = fetch_source_entries(source.url)
    if error:
        result["status"] = "gagal"
        result["error"] = error
        return result

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

        try:
            outcome = ingest_content_item(
                db=db,
                source_id=source.id,
                url=link,
                title=title,
                body=body or title,
                penerbit=(entry.get("_feed_title") or source.nama)[:200],
                penulis=(entry.get("author") or None),
                published_at=published_at,
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
        "sumber": per_source,
    }
