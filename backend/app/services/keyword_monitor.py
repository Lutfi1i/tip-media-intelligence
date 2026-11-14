"""Pantau Keyword: sebutan, sentimen, dan analisis untuk keyword yang dipantau (mirip proyek Brand24).

Alur satu keyword:
1. Saat dibuat, keyword mendapat sumber sendiri (Bing News, pencarian YouTube, Bluesky, GDELT).
   Google News tidak dipakai karena robots.txt-nya melarang /rss/search.
2. Sumber ditarik sekali saat dibuat, lalu berkala oleh thread di `start_scheduler`.
3. Semua konten tersimpan (termasuk RSS berita dan Telegram yang sudah ada) dicocokkan ke
   kata kunci, hasilnya disimpan sebagai `KeywordMention`.
4. Sentimen awal diambil dari kamus kata, lalu dinilai ulang oleh AI terhadap keyword itu.
   Koreksi manual analis tidak pernah ditimpa.

X, TikTok, Instagram, dan Threads tidak punya sumber gratis yang diizinkan, jadi sebutan dari
platform itu hanya muncul bila sudah ada di data lama. UI menampilkan batasan ini apa adanya.
"""

from __future__ import annotations

import json
import logging
import re
import threading
import time
from collections import Counter, defaultdict, deque
from datetime import datetime, timedelta
from typing import Any, Callable, Deque, Dict, Iterable, List, Optional, Sequence, Set, Tuple
from urllib.parse import quote, quote_plus

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from backend.app.config import settings
from backend.app.database import SessionLocal
from backend.app.models import ItemAnalysis, KeywordMention, KeywordProject, RawItem, Source
from backend.app.services import trend_ai
from backend.app.services.collector import collect_source
from backend.app.services.social_platform import NEWS
from backend.app.services.social_topics import STOPWORDS, tokenize

logger = logging.getLogger("tip_keyword")

WIB = timedelta(hours=7)
MAX_TERMS = 5
MAX_TERM_LEN = 60
# Sumber per kata (YouTube, Bluesky) dibuat untuk beberapa kata pertama saja agar tarikan tidak berat.
MAX_TERMS_WITH_OWN_SOURCE = 3
BACKFILL_DAYS = 60
SOURCE_INTERVAL_MINUTES = 60
SENTIMENTS = ("positif", "netral", "negatif")
PERIODS = ("today", "7d", "30d")

AI_BATCH = 20
AI_MAX_ITEMS_PER_RUN = 200
AI_MAX_CALLS_PER_HOUR = 60

_running: Set[int] = set()
_running_lock = threading.Lock()
_ai_calls: Deque[float] = deque()
_ai_lock = threading.Lock()
_stop = threading.Event()
_thread: Optional[threading.Thread] = None


# ---------------------------------------------------------------------------
# Kata kunci dan pencocokan
# ---------------------------------------------------------------------------

def clean_terms(values: Iterable[str], limit: int = MAX_TERMS) -> List[str]:
    """Rapikan daftar kata: buang spasi ganda, kosong, dan duplikat (tanpa membedakan huruf besar)."""
    out: List[str] = []
    seen: Set[str] = set()
    for v in values or []:
        term = re.sub(r"\s+", " ", str(v or "")).strip().strip('"').strip()[:MAX_TERM_LEN]
        if term and term.lower() not in seen:
            seen.add(term.lower())
            out.append(term)
    return out[:limit]


def _term_pattern(term: str) -> re.Pattern:
    # Batas kata manual: "BUMN" cocok dengan "#BUMN" dan "BUMN-nya", tetapi tidak dengan "BUMNKU".
    return re.compile(rf"(?<![0-9A-Za-z]){re.escape(term)}(?![0-9A-Za-z])", re.IGNORECASE)


def build_matcher(terms: Sequence[str], excluded: Sequence[str] = ()) -> Callable[[str], bool]:
    include = [_term_pattern(t) for t in terms]
    exclude = [_term_pattern(t) for t in excluded]

    def match(text: str) -> bool:
        return any(p.search(text) for p in include) and not any(p.search(text) for p in exclude)

    return match


def project_terms(p: KeywordProject) -> Tuple[List[str], List[str]]:
    try:
        terms = clean_terms(json.loads(p.kata_kunci_json or "[]"))
    except ValueError:
        terms = []
    try:
        excluded = clean_terms(json.loads(p.kecualikan_json or "[]"), limit=20)
    except ValueError:
        excluded = []
    return terms or clean_terms([p.nama]), excluded


# ---------------------------------------------------------------------------
# Sumber per keyword
# ---------------------------------------------------------------------------

BING_NEWS = "https://www.bing.com/news/search?format=rss&mkt=id-ID&q="
BING_BY_DATE = "&qft=sortbydate%3d%221%22"
MAX_ISSUE_QUERIES = 4


def _issue_query(term: str, issue: str) -> str:
    """Kueri Bing untuk satu isu: keyword utama wajib ada, ditambah kata isu selain keyword itu."""
    words = [w for w in re.findall(r"[0-9A-Za-z]+", issue) if w.lower() != term.lower()]
    return f'"{term}" ' + " ".join(words[:5])


def source_specs(nama: str, terms: Sequence[str], issues: Sequence[str] = ()) -> List[Dict[str, str]]:
    """Definisi sumber (nama, jenis, url) untuk satu keyword.

    Satu kueri Bing News hanya mengembalikan sekitar 12 berita, jadi keyword mendapat beberapa
    kueri: urut terbaru, urut relevansi, dan satu per isu teratas yang dilabeli AI. Uji 14 Nov
    2026 untuk "BUMN": satu kueri 12 berita, enam kueri 55 berita unik.
    """
    own = list(terms)[:MAX_TERMS_WITH_OWN_SOURCE]
    or_query = " OR ".join(f'"{t}"' for t in terms)
    specs = [
        {"nama": f"Keyword {nama}: Bing News", "jenis": "berita", "url": BING_NEWS + quote_plus(or_query) + BING_BY_DATE},
        {"nama": f"Keyword {nama}: Bing News relevan", "jenis": "berita", "url": BING_NEWS + quote_plus(or_query)},
    ]
    for issue in list(issues)[:MAX_ISSUE_QUERIES]:
        specs.append({
            "nama": f"Keyword {nama}: Bing News isu ({issue})"[:255],
            "jenis": "berita",
            "url": BING_NEWS + quote_plus(_issue_query(terms[0], issue)),
        })
    # GDELT menolak satu kata dalam tanda kutip ("phrase is too short"); kutip hanya frasa multi-kata.
    gdelt_terms = " OR ".join(f'"{t}"' if " " in t else t for t in terms)
    gdelt_query = f"({gdelt_terms})" if len(terms) > 1 else gdelt_terms
    specs.append({
        "nama": f"Keyword {nama}: GDELT",
        "jenis": "berita",
        "url": "https://api.gdeltproject.org/api/v2/doc/doc?mode=artlist&format=json&sort=datedesc&timespan=7d&maxrecords=75&query="
        + quote(f"{gdelt_query} sourcecountry:ID"),
    })
    for t in own:
        # sp=EgIIAw%3D%3D: filter YouTube "minggu ini", agar yang ditarik percakapan terbaru.
        specs.append({
            "nama": f"Keyword {nama}: YouTube ({t})",
            "jenis": "media_sosial",
            "url": "https://www.youtube.com/results?sp=EgIIAw%3D%3D&search_query=" + quote_plus(t),
        })
        specs.append({
            "nama": f"Keyword {nama}: Bluesky ({t})",
            "jenis": "media_sosial",
            "url": "https://api.bsky.app/xrpc/app.bsky.feed.searchPosts?limit=25&sort=latest&q=" + quote_plus(t),
        })
    return specs


def _top_issues(db: Session, project_id: int, days: int = 7, limit: int = MAX_ISSUE_QUERIES) -> List[str]:
    """Isu dengan sebutan terbanyak dalam beberapa hari terakhir, untuk kueri berita tambahan."""
    since = datetime.utcnow() - timedelta(days=days)
    rows = (
        db.query(KeywordMention.isu, func.count(KeywordMention.id))
        .join(RawItem, RawItem.id == KeywordMention.item_id)
        .filter(KeywordMention.project_id == project_id, KeywordMention.isu.isnot(None), RawItem.published_at >= since)
        .group_by(KeywordMention.isu)
        .having(func.count(KeywordMention.id) >= 2)
        .order_by(func.count(KeywordMention.id).desc(), KeywordMention.isu)
        .limit(limit)
        .all()
    )
    return [r[0] for r in rows]


def _sync_sources(db: Session, project: KeywordProject) -> None:
    terms, _ = project_terms(project)
    issues = _top_issues(db, project.id) if project.id else []
    wanted = {s["url"]: s for s in source_specs(project.nama, terms, issues)}
    current = db.query(Source).filter(Source.keyword_project_id == project.id).all()
    for src in current:
        if src.url not in wanted:
            _remove_source(db, src)
        else:
            src.nama = wanted.pop(src.url)["nama"]
            src.status_izin = "aktif" if project.aktif else "nonaktif"
    for spec in wanted.values():
        db.add(Source(
            nama=spec["nama"][:255],
            jenis=spec["jenis"],
            url=spec["url"],
            frekuensi_menit=SOURCE_INTERVAL_MINUTES,
            rate_limit_per_min=10,
            kredibilitas=0.7,
            status_izin="aktif" if project.aktif else "nonaktif",
            keyword_project_id=project.id,
        ))


def _remove_source(db: Session, src: Source) -> None:
    # Konten yang sudah ditarik tetap disimpan (bisa dipakai menu lain); hanya tautan ke sumbernya dilepas.
    db.query(RawItem).filter(RawItem.source_id == src.id).update({RawItem.source_id: None}, synchronize_session=False)
    db.delete(src)


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------

def create_project(db: Session, nama: str, terms: Sequence[str], excluded: Sequence[str]) -> KeywordProject:
    nama = re.sub(r"\s+", " ", nama or "").strip()[:120]
    terms = clean_terms(terms) or clean_terms([nama])
    if not nama:
        nama = terms[0] if terms else ""
    if not nama or not terms:
        raise ValueError("Isi keyword yang ingin dipantau")
    project = KeywordProject(
        nama=nama,
        kata_kunci_json=json.dumps(terms, ensure_ascii=False),
        kecualikan_json=json.dumps(clean_terms(excluded, limit=20), ensure_ascii=False),
        aktif=True,
        last_collect_status="menunggu",
    )
    db.add(project)
    db.flush()
    _sync_sources(db, project)
    db.commit()
    db.refresh(project)
    sync_mentions(db, project)
    return project


def update_project(
    db: Session,
    project: KeywordProject,
    nama: Optional[str] = None,
    terms: Optional[Sequence[str]] = None,
    excluded: Optional[Sequence[str]] = None,
    aktif: Optional[bool] = None,
) -> KeywordProject:
    if nama is not None and nama.strip():
        project.nama = re.sub(r"\s+", " ", nama).strip()[:120]
    if terms is not None:
        cleaned = clean_terms(terms)
        if not cleaned:
            raise ValueError("Minimal satu kata kunci")
        project.kata_kunci_json = json.dumps(cleaned, ensure_ascii=False)
    if excluded is not None:
        project.kecualikan_json = json.dumps(clean_terms(excluded, limit=20), ensure_ascii=False)
    if aktif is not None:
        project.aktif = aktif
    _sync_sources(db, project)
    db.commit()
    sync_mentions(db, project)
    return project


def delete_project(db: Session, project: KeywordProject) -> None:
    for src in db.query(Source).filter(Source.keyword_project_id == project.id).all():
        _remove_source(db, src)
    db.delete(project)
    db.commit()


# ---------------------------------------------------------------------------
# Sebutan dan sentimen
# ---------------------------------------------------------------------------

def _initial_sentiment(ana: Optional[ItemAnalysis]) -> str:
    s = (ana.sentimen if ana else "") or ""
    return s if s in SENTIMENTS else "netral"


def sync_mentions(db: Session, project: KeywordProject) -> int:
    """Cocokkan konten 60 hari terakhir ke keyword. Sebutan yang tidak lagi cocok (kata diubah) dihapus."""
    terms, excluded = project_terms(project)
    match = build_matcher(terms, excluded)
    since = datetime.utcnow() - timedelta(days=BACKFILL_DAYS)

    existing = {m.item_id: m for m in db.query(KeywordMention).filter(KeywordMention.project_id == project.id).all()}
    like = or_(*[cond for t in terms for cond in (RawItem.judul.ilike(f"%{t}%"), RawItem.isi.ilike(f"%{t}%"))])
    rows = (
        db.query(RawItem, ItemAnalysis)
        .outerjoin(ItemAnalysis, ItemAnalysis.item_id == RawItem.id)
        .filter(RawItem.published_at >= since, like)
        .all()
    )
    matched: Set[int] = set()
    added = 0
    for it, ana in rows:
        if not match(f"{it.judul} {it.isi}"):
            continue
        matched.add(it.id)
        if it.id not in existing:
            db.add(KeywordMention(project_id=project.id, item_id=it.id, sentimen=_initial_sentiment(ana), sentimen_sumber="kamus"))
            added += 1
    for item_id, m in existing.items():
        published = m.raw_item.published_at if m.raw_item else None
        # Sebutan lama di luar jendela 60 hari dibiarkan; yang di dalam jendela tetapi tidak cocok lagi dihapus.
        if item_id not in matched and published and published >= since:
            db.delete(m)
    db.commit()
    return added


def _reserve_ai_call() -> bool:
    now = time.time()
    with _ai_lock:
        while _ai_calls and now - _ai_calls[0] > 3600:
            _ai_calls.popleft()
        if len(_ai_calls) >= AI_MAX_CALLS_PER_HOUR:
            return False
        _ai_calls.append(now)
        return True


SENTIMENT_SYSTEM = (
    "Anda analis media Indonesia. Untuk setiap teks, tentukan dua hal.\n"
    "1. sentimen TERHADAP subjek yang diberikan, bukan suasana teks secara umum. positif: pujian, capaian, "
    "kabar baik, dukungan untuk subjek. negatif: kritik, keluhan, kasus hukum atau korupsi, kerugian, kegagalan, "
    "atau masalah yang melibatkan subjek. netral: informasi tanpa penilaian, atau subjek hanya disebut sambil lalu.\n"
    "2. isu: label isu spesifik yang dibahas, 2 sampai 5 kata, huruf awal kapital (contoh: \"Konsolidasi Danareksa\", "
    "\"Korupsi kredit bank BUMN\", \"Saham BUMN di bursa\"). Pakai ulang label dari daftar isu yang sudah ada bila "
    "membahas hal yang sama, supaya sebutan terkumpul. Jangan memakai label umum seperti \"Berita BUMN\".\n"
    "Jawab JSON: "
    '{"hasil":[{"id":<angka>,"sentimen":"positif|netral|negatif","isu":"<label>","alasan":"<maks 12 kata>"}]}. '
    "Alasan dalam bahasa Indonesia, tanpa tanda pisah panjang."
)


def _sentiment_prompt(subject: str, terms: Sequence[str], batch: Sequence[Tuple[int, RawItem]], known_issues: Sequence[str] = ()) -> str:
    lines = [f"Subjek: {subject} (kata yang dicari: {', '.join(terms)})"]
    if known_issues:
        lines.append("Isu yang sudah ada: " + "; ".join(known_issues))
    lines.append("")
    for mid, it in batch:
        body = (it.isi or "").replace("\n", " ")
        text = it.judul if not body or body in it.judul else f"{it.judul}. {body[:400]}"
        lines.append(f"id: {mid}\nteks: {text}\n")
    return "\n".join(lines)


def _known_issues(db: Session, project_id: int, limit: int = 40) -> List[str]:
    rows = (
        db.query(KeywordMention.isu, func.count(KeywordMention.id))
        .filter(KeywordMention.project_id == project_id, KeywordMention.isu.isnot(None))
        .group_by(KeywordMention.isu)
        .order_by(func.count(KeywordMention.id).desc())
        .limit(limit)
        .all()
    )
    return [r[0] for r in rows]


def score_pending(db: Session, project: KeywordProject, limit: int = AI_MAX_ITEMS_PER_RUN) -> Dict[str, Any]:
    """Nilai sentimen dan isu sebutan yang belum dinilai AI. Sentimen koreksi manual tidak diubah, isunya tetap diisi."""
    if not trend_ai.ai_configured():
        return {"dinilai": 0, "catatan": "AI belum dikonfigurasi, sentimen memakai kamus kata"}
    terms, _ = project_terms(project)
    pending = (
        db.query(KeywordMention, RawItem)
        .join(RawItem, RawItem.id == KeywordMention.item_id)
        .filter(
            KeywordMention.project_id == project.id,
            or_(KeywordMention.sentimen_sumber == "kamus", KeywordMention.isu.is_(None)),
        )
        .order_by(RawItem.published_at.desc())
        .limit(limit)
        .all()
    )
    scored = 0
    note = None
    for start in range(0, len(pending), AI_BATCH):
        chunk = pending[start:start + AI_BATCH]
        if not _reserve_ai_call():
            note = f"Batas {AI_MAX_CALLS_PER_HOUR} panggilan AI per jam tercapai, sisanya dinilai pada tarikan berikutnya"
            break
        try:
            parsed, _meta = trend_ai._chat_json(
                SENTIMENT_SYSTEM,
                _sentiment_prompt(project.nama, terms, [(m.id, it) for m, it in chunk], _known_issues(db, project.id)),
                max_tokens=60 * len(chunk) + 200,
                reserve=False,
            )
        except trend_ai.AiUnavailable as exc:
            note = str(exc)
            break
        by_id = {m.id: m for m, _ in chunk}
        for row in parsed.get("hasil") or []:
            try:
                m = by_id.get(int(row.get("id")))
            except (TypeError, ValueError):
                continue
            if not m:
                continue
            issue = trend_ai._clean_text(row.get("isu"))[:120]
            if issue:
                m.isu = issue
            label = str(row.get("sentimen") or "").strip().lower()
            if label not in SENTIMENTS or m.sentimen_sumber == "manual":
                continue
            m.sentimen = label
            m.sentimen_sumber = "ai"
            m.sentimen_alasan = trend_ai._clean_text(row.get("alasan"))[:300] or None
            scored += 1
        db.commit()
    return {"dinilai": scored, "catatan": note}


def set_manual_sentiment(db: Session, mention: KeywordMention, sentimen: str) -> KeywordMention:
    if sentimen not in SENTIMENTS:
        raise ValueError("sentimen harus positif, netral, atau negatif")
    mention.sentimen = sentimen
    mention.sentimen_sumber = "manual"
    mention.sentimen_alasan = None
    db.commit()
    return mention


# ---------------------------------------------------------------------------
# Penarikan data
# ---------------------------------------------------------------------------

def is_running(project_id: int) -> bool:
    with _running_lock:
        return project_id in _running


def run_collection(project_id: int, force: bool = True) -> Dict[str, Any]:
    """Tarik semua sumber keyword, cocokkan sebutan, lalu nilai sentimennya. Satu proses per keyword."""
    with _running_lock:
        if project_id in _running:
            return {"status": "berjalan"}
        _running.add(project_id)
    db = SessionLocal()
    try:
        project = db.get(KeywordProject, project_id)
        if not project:
            return {"status": "tidak ditemukan"}
        project.last_collect_status = "berjalan"
        # Selaraskan dulu agar perubahan definisi sumber (mis. format kueri) berlaku untuk keyword lama.
        _sync_sources(db, project)
        db.commit()

        sources = db.query(Source).filter(Source.keyword_project_id == project_id).order_by(Source.id).all()
        errors: List[str] = []
        new_items = 0
        for src in sources:
            res = collect_source(db, src, force=force)
            new_items += res.get("baru", 0)
            if res.get("status") == "gagal":
                errors.append(f"{src.nama.split(': ', 1)[-1]}: {res.get('error')}")
            if "gdeltproject" in src.url:
                time.sleep(5)  # GDELT membatasi 1 permintaan per 5 detik

        added = sync_mentions(db, project)
        ai = score_pending(db, project)
        project.last_collected_at = datetime.utcnow()
        project.last_collect_new = added
        project.last_collect_status = "gagal" if sources and len(errors) == len(sources) else "ok"
        project.last_collect_error = "; ".join(errors)[:500] or None
        db.commit()
        return {"status": project.last_collect_status, "konten_baru": new_items, "sebutan_baru": added, "ai": ai, "galat": errors}
    except Exception as exc:
        db.rollback()
        logger.exception("Tarikan keyword %s gagal", project_id)
        project = db.get(KeywordProject, project_id)
        if project:
            project.last_collect_status = "gagal"
            project.last_collect_error = f"{type(exc).__name__}: {exc}"[:500]
            db.commit()
        return {"status": "gagal", "galat": [str(exc)]}
    finally:
        db.close()
        with _running_lock:
            _running.discard(project_id)


def match_new_content(db: Session) -> Dict[str, int]:
    """Cocokkan konten yang baru masuk dari semua sumber ke setiap keyword aktif, lalu nilai sentimennya.

    Dipanggil siklus penarikan global, supaya sebutan dari RSS dan Telegram umum muncul tanpa
    menunggu tarikan keyword berikutnya. Keyword yang sedang ditarik dilewati.
    """
    added = scored = 0
    for (pid,) in db.query(KeywordProject.id).filter(KeywordProject.aktif.is_(True)).all():
        with _running_lock:
            if pid in _running:
                continue
            _running.add(pid)
        try:
            project = db.get(KeywordProject, pid)
            added += sync_mentions(db, project)
            scored += score_pending(db, project)["dinilai"]
        except Exception:
            db.rollback()
            logger.exception("Pencocokan keyword %s gagal", pid)
        finally:
            with _running_lock:
                _running.discard(pid)
    return {"sebutan_baru": added, "dinilai_ai": scored}


def start_collection(project_id: int, force: bool = True) -> bool:
    """Jalankan tarikan di latar belakang. False bila keyword itu sedang ditarik."""
    if is_running(project_id):
        return False
    threading.Thread(target=run_collection, args=(project_id, force), name=f"tip-keyword-{project_id}", daemon=True).start()
    return True


def _due_projects(interval_minutes: int) -> List[int]:
    db = SessionLocal()
    try:
        cutoff = datetime.utcnow() - timedelta(minutes=interval_minutes)
        rows = (
            db.query(KeywordProject.id)
            .filter(KeywordProject.aktif.is_(True))
            .filter(or_(KeywordProject.last_collected_at.is_(None), KeywordProject.last_collected_at < cutoff))
            .all()
        )
        return [r[0] for r in rows]
    finally:
        db.close()


def _loop(interval_minutes: int) -> None:
    while not _stop.wait(60):
        try:
            for pid in _due_projects(interval_minutes):
                if _stop.is_set():
                    break
                run_collection(pid, force=False)
        except Exception:
            logger.exception("Siklus keyword gagal")


def reset_interrupted() -> int:
    """Tandai tarikan yang terputus saat server berhenti, supaya tidak tampil "berjalan" selamanya."""
    db = SessionLocal()
    try:
        n = (
            db.query(KeywordProject)
            .filter(KeywordProject.last_collect_status == "berjalan")
            .update(
                {
                    KeywordProject.last_collect_status: "gagal",
                    KeywordProject.last_collect_error: "Tarikan terputus karena server dimulai ulang; diulang pada jadwal berikutnya",
                },
                synchronize_session=False,
            )
        )
        db.commit()
        return n
    finally:
        db.close()


def start_scheduler(interval_minutes: int) -> bool:
    global _thread
    reset_interrupted()
    if interval_minutes <= 0 or (_thread and _thread.is_alive()):
        return False
    _stop.clear()
    _thread = threading.Thread(target=_loop, args=(interval_minutes,), name="tip-keyword-scheduler", daemon=True)
    _thread.start()
    logger.info("Tarikan keyword pantauan aktif setiap %d menit", interval_minutes)
    return True


def stop_scheduler() -> None:
    _stop.set()


# ---------------------------------------------------------------------------
# Analisis
# ---------------------------------------------------------------------------

class _Row:
    """Sebutan + konten dalam bentuk ringan untuk perhitungan."""

    __slots__ = ("mid", "item", "isu", "sentimen", "sumber", "alasan")

    def __init__(self, m: KeywordMention, it: RawItem, ana: Optional[ItemAnalysis]):
        self.mid = m.id
        self.item = it
        self.isu = m.isu
        self.sentimen = m.sentimen if m.sentimen in SENTIMENTS else "netral"
        self.sumber = m.sentimen_sumber
        self.alasan = m.sentimen_alasan

    @property
    def platform(self) -> str:
        return self.item.platform or NEWS

    @property
    def interactions(self) -> Optional[int]:
        vals = [v for v in (self.item.eng_likes, self.item.eng_shares, self.item.eng_replies) if v is not None]
        return sum(vals) if vals else None

    @property
    def author_label(self) -> str:
        it = self.item
        if self.platform == NEWS:
            return (it.penerbit or "Media tidak diketahui").strip()
        return (it.penulis or it.penerbit or "Akun tidak diketahui").strip()


def period_bounds(periode: str, now: Optional[datetime] = None) -> Tuple[datetime, datetime, datetime]:
    """(awal periode sebelumnya, awal periode, akhir) dalam UTC naif. 'today' dimulai 00.00 WIB."""
    now = now or datetime.utcnow()
    if periode == "today":
        local = now + WIB
        start = datetime(local.year, local.month, local.day) - WIB
        span = now - start
        return start - span, start, now
    days = 30 if periode == "30d" else 7
    start = now - timedelta(days=days)
    return start - timedelta(days=days), start, now


def _load_rows(db: Session, project_id: int, since: datetime, until: datetime, platform: Optional[str]) -> List[_Row]:
    q = (
        db.query(KeywordMention, RawItem, ItemAnalysis)
        .join(RawItem, RawItem.id == KeywordMention.item_id)
        .outerjoin(ItemAnalysis, ItemAnalysis.item_id == RawItem.id)
        .filter(KeywordMention.project_id == project_id, RawItem.published_at >= since, RawItem.published_at < until)
    )
    if platform and platform != "Semua":
        q = q.filter(RawItem.platform == platform) if platform != NEWS else q.filter(or_(RawItem.platform == NEWS, RawItem.platform.is_(None)))
    return [_Row(m, it, ana) for m, it, ana in q.order_by(RawItem.published_at.desc()).all()]


def _sent_counts(rows: Iterable[_Row]) -> Dict[str, int]:
    c = Counter(r.sentimen for r in rows)
    return {s: c.get(s, 0) for s in SENTIMENTS}


def _change_pct(cur: int, prev: int) -> Optional[float]:
    if prev == 0:
        return None
    return round((cur - prev) / prev * 100, 1)


def _sum_known(values: Iterable[Optional[int]]) -> Tuple[Optional[int], int]:
    known = [v for v in values if v is not None]
    return (sum(known) if known else None), len(known)


def _timeline(rows: Sequence[_Row], periode: str, start: datetime, end: datetime) -> List[Dict[str, Any]]:
    hourly = periode == "today"
    if hourly:
        first = (start + WIB).replace(minute=0, second=0, microsecond=0)
        buckets = [first + timedelta(hours=i) for i in range(int((end - start).total_seconds() // 3600) + 1)]
        key = lambda d: (d + WIB).replace(minute=0, second=0, microsecond=0)  # noqa: E731
    else:
        first_day = (start + WIB).date()
        n = ((end + WIB).date() - first_day).days + 1
        buckets = [datetime.combine(first_day + timedelta(days=i), datetime.min.time()) for i in range(n)]
        key = lambda d: datetime.combine((d + WIB).date(), datetime.min.time())  # noqa: E731
    counts: Dict[datetime, Counter] = defaultdict(Counter)
    for r in rows:
        counts[key(r.item.published_at)][r.sentimen] += 1
    out = []
    for b in buckets:
        c = counts.get(b, Counter())
        out.append({"t": b.isoformat(), **{s: c.get(s, 0) for s in SENTIMENTS}, "total": sum(c.values())})
    return out


def _grouped(rows: Sequence[_Row], keyfn: Callable[[_Row], Optional[str]], limit: int) -> List[Dict[str, Any]]:
    groups: Dict[str, List[_Row]] = defaultdict(list)
    for r in rows:
        k = keyfn(r)
        if k:
            groups[k].append(r)
    ranked = sorted(groups.items(), key=lambda kv: (-len(kv[1]), kv[0]))[:limit]
    return [{"nama": k, "sebutan": len(v), **_sent_counts(v)} for k, v in ranked]


# Kata umum berita yang lolos stopword percakapan medsos, tetapi tidak menjelaskan konteks.
CONTEXT_STOPWORDS = {
    "atas", "bagi", "masuk", "cukup", "empat", "lima", "tiga", "jasa",
    "kata", "sebut", "menjadi", "melalui", "terkait", "antara", "hingga", "sejak", "kembali", "akan", "telah",
    "masih", "lebih", "banyak", "baru", "mana", "begini", "ternyata", "resmi", "pihak", "secara", "sebagai",
    "terhadap", "dalam", "dengan", "untuk", "yang", "pada", "dari", "oleh", "ini", "itu", "ada", "jadi",
    "shorts", "viral", "video", "berita", "terkini", "news", "live", "full",
}

_HASHTAG = re.compile(r"(?<![\w#])#([A-Za-z][A-Za-z0-9_]{2,40})")


def _context_words(rows: Sequence[_Row], terms: Sequence[str], limit: int = 40) -> List[Dict[str, Any]]:
    """Kata yang paling sering muncul bersama keyword, dengan sentimen dominannya (awan kata Brand24)."""
    banned = {w for t in terms for w in tokenize(t)} | {t.lower() for t in terms}
    counts: Counter = Counter()
    by_sent: Dict[str, Counter] = defaultdict(Counter)
    for r in rows:
        text = r.item.judul if not r.item.isi else f"{r.item.judul} {(r.item.isi or '')[:300]}"
        for w in set(tokenize(text)):
            if w in banned or w in STOPWORDS or w in CONTEXT_STOPWORDS or len(w) < 4:
                continue
            counts[w] += 1
            by_sent[w][r.sentimen] += 1
    out = []
    for w, n in counts.most_common(limit):
        if n < 2:
            break
        s = by_sent[w]
        dominant = "netral"
        if s["positif"] > s["negatif"] and s["positif"] >= n * 0.4:
            dominant = "positif"
        elif s["negatif"] > s["positif"] and s["negatif"] >= n * 0.4:
            dominant = "negatif"
        out.append({"kata": w, "jumlah": n, "sentimen": dominant})
    return out


def mention_brief(r: _Row) -> Dict[str, Any]:
    it = r.item
    body = (it.isi or "").strip()
    return {
        "id": r.mid,
        "item_id": it.id,
        "judul": it.judul,
        "cuplikan": "" if not body or body in it.judul else body[:280],
        "url": it.url_kanonik,
        "platform": r.platform,
        "sumber": r.author_label,
        "published_at": it.published_at.isoformat(),
        "sentimen": r.sentimen,
        "sentimen_sumber": r.sumber,
        "sentimen_alasan": r.alasan,
        "isu": r.isu,
        "views": it.eng_views,
        "interaksi": r.interactions,
    }


def _visible_status(project: KeywordProject) -> Optional[str]:
    if is_running(project.id):
        return "berjalan"
    # "berjalan" di database tanpa proses aktif berarti tarikan terputus (mis. server dimulai ulang).
    return "gagal" if project.last_collect_status == "berjalan" else project.last_collect_status


def project_brief(db: Session, project: KeywordProject) -> Dict[str, Any]:
    terms, excluded = project_terms(project)
    return {
        "id": project.id,
        "nama": project.nama,
        "kata_kunci": terms,
        "kecualikan": excluded,
        "aktif": bool(project.aktif),
        "dibuat": project.created_at.isoformat() if project.created_at else None,
        "terakhir_ditarik": project.last_collected_at.isoformat() if project.last_collected_at else None,
        "status_tarik": _visible_status(project),
        "galat_tarik": project.last_collect_error,
        "sebutan_baru_terakhir": project.last_collect_new,
    }


def list_projects(db: Session) -> List[Dict[str, Any]]:
    projects = db.query(KeywordProject).order_by(KeywordProject.created_at.asc()).all()
    since = datetime.utcnow() - timedelta(days=7)
    counts: Dict[int, Counter] = defaultdict(Counter)
    rows = (
        db.query(KeywordMention.project_id, KeywordMention.sentimen, func.count(KeywordMention.id))
        .join(RawItem, RawItem.id == KeywordMention.item_id)
        .filter(RawItem.published_at >= since)
        .group_by(KeywordMention.project_id, KeywordMention.sentimen)
        .all()
    )
    for pid, sent, n in rows:
        counts[pid][sent if sent in SENTIMENTS else "netral"] += n
    out = []
    for p in projects:
        c = counts.get(p.id, Counter())
        out.append({**project_brief(db, p), "sebutan_7h": sum(c.values()), **{f"{s}_7h": c.get(s, 0) for s in SENTIMENTS}})
    return out


def _source_status(db: Session, project_id: int) -> List[Dict[str, Any]]:
    out = []
    for s in db.query(Source).filter(Source.keyword_project_id == project_id).order_by(Source.id).all():
        out.append({
            "nama": s.nama.split(": ", 1)[-1],
            "status": s.last_fetch_status,
            "galat": s.last_fetch_error,
            "terakhir_berhasil": s.last_success_at.isoformat() if s.last_success_at else None,
        })
    return out


def get_dashboard(db: Session, project: KeywordProject, periode: str, platform: Optional[str]) -> Dict[str, Any]:
    prev_start, start, end = period_bounds(periode)
    terms, _ = project_terms(project)
    all_rows = _load_rows(db, project.id, prev_start, end, platform)
    cur = [r for r in all_rows if r.item.published_at >= start]
    prev = [r for r in all_rows if r.item.published_at < start]

    sent_cur, sent_prev = _sent_counts(cur), _sent_counts(prev)
    comparison_complete = bool(project.created_at and project.created_at <= prev_start)
    reach, reach_n = _sum_known(r.item.eng_views for r in cur)
    inter, inter_n = _sum_known(r.interactions for r in cur)
    ai_n = sum(1 for r in cur if r.sumber == "ai")
    manual_n = sum(1 for r in cur if r.sumber == "manual")

    def top(rows: Sequence[_Row], keyfn: Callable[[_Row], Any], n: int) -> List[Dict[str, Any]]:
        return [mention_brief(r) for r in sorted(rows, key=keyfn, reverse=True)[:n]]

    with_metric = [r for r in cur if r.interactions is not None or r.item.eng_views is not None]
    hashtags: Counter = Counter()
    for r in cur:
        hashtags.update({f"#{h.lower()}" for h in _HASHTAG.findall(f"{r.item.judul} {r.item.isi or ''}")})

    return {
        "proyek": project_brief(db, project),
        "periode": {"key": periode, "mulai": start.isoformat(), "akhir": end.isoformat(), "mulai_sebelumnya": prev_start.isoformat()},
        "ringkasan": {
            "sebutan": len(cur),
            "sebutan_sebelumnya": len(prev),
            "perubahan_pct": _change_pct(len(cur), len(prev)) if comparison_complete else None,
            # Keyword baru belum dipantau sepanjang periode pembanding, jadi kenaikan persen akan menyesatkan.
            "pembanding_lengkap": comparison_complete,
            "sentimen": sent_cur,
            "sentimen_sebelumnya": sent_prev,
            "jangkauan_views": reach,
            "jangkauan_cakupan": reach_n,
            "interaksi": inter,
            "interaksi_cakupan": inter_n,
            "sumber_unik": len({r.author_label.lower() for r in cur}),
            "dinilai_ai": ai_n,
            "dikoreksi_manual": manual_n,
        },
        "timeline": _timeline(cur, periode, start, end),
        "platform": _grouped(cur, lambda r: r.platform, 12),
        "sumber_teratas": _grouped(cur, lambda r: r.author_label, 10),
        "isu": _grouped(cur, lambda r: r.isu, 12),
        "isu_belum_dilabeli": sum(1 for r in cur if not r.isu),
        "kata_konteks": _context_words(cur, terms),
        "hashtag": [{"tag": t, "jumlah": n} for t, n in hashtags.most_common(12)],
        "populer": top(with_metric, lambda r: ((r.interactions or 0), (r.item.eng_views or 0)), 5),
        "negatif_terbaru": [mention_brief(r) for r in cur if r.sentimen == "negatif"][:5],
        "sumber_data": _source_status(db, project.id),
        "ai_tersedia": trend_ai.ai_configured(),
    }


MENTION_SORTS = ("terbaru", "populer")


def list_mentions(
    db: Session,
    project: KeywordProject,
    periode: str,
    platform: Optional[str],
    sentimen: Optional[str],
    urut: str = "terbaru",
    isu: Optional[str] = None,
    halaman: int = 1,
    per_halaman: int = 20,
) -> Dict[str, Any]:
    _, start, end = period_bounds(periode)
    rows = _load_rows(db, project.id, start, end, platform)
    if isu:
        rows = [r for r in rows if r.isu == isu]
    counts = _sent_counts(rows)
    if sentimen in SENTIMENTS:
        rows = [r for r in rows if r.sentimen == sentimen]
    if urut == "populer":
        rows.sort(key=lambda r: ((r.interactions or -1), (r.item.eng_views or -1), r.item.published_at), reverse=True)
    halaman = max(1, halaman)
    chunk = rows[(halaman - 1) * per_halaman: halaman * per_halaman]
    return {
        "total": len(rows),
        "per_sentimen": counts,
        "halaman": halaman,
        "per_halaman": per_halaman,
        "sebutan": [mention_brief(r) for r in chunk],
    }
