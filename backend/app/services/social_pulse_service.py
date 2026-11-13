"""Analitik RADAR Social Pulse dengan cakupan geografis.

Semua angka dihitung dari RawItem + ItemAnalysis + Source yang tersimpan. Konten dianggap
media sosial bila kolom `platform` berisi salah satu SOCIAL_PLATFORMS (ditentukan dari domain
asli konten saat ingest). Bila sebuah angka tidak bisa dihitung (misalnya engagement tidak
disediakan sumber, atau baseline belum ada), nilainya dikembalikan sebagai null, bukan 0.
"""

from __future__ import annotations

import json
import math
import re
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Sequence, Tuple

from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.app.models import Issue, IssueItem, ItemAnalysis, MonitoringProfile, ProfileRule, RawItem, Source
from backend.app.services.geo_hierarchy import (
    KABUPATEN_DATA,
    KECAMATAN_DATA,
    KELURAHAN_DATA,
    PROVINCES_DATA,
    classify_geographic_context,
)
from backend.app.services.social_platform import SOCIAL_PLATFORMS, platform_from_url
from backend.app.services.social_notes import latest_notes
from backend.app.services.social_emotion import EMOTION_LABELS, classify_emotions, emotion_breakdown
from backend.app.services.social_taxonomy import (
    AGENCIES,
    CATEGORIES,
    UNCATEGORIZED,
    UNCATEGORIZED_LABEL,
    agency_label,
    category_label,
    classify,
)
from backend.app.services.social_topics import (
    SocialPost,
    account_analysis,
    cluster_posts,
    count_key_in,
    detect_coordination,
    engagement_summary,
    extract_keys,
    key_label,
    propagation,
    top_hashtags,
    top_phrases,
    velocity,
)

# Panjang jendela (jam), jumlah jendela riwayat untuk baseline, dan pembagian timeline.
WINDOW_HOURS = {"15m": 0.25, "1h": 1, "6h": 6, "24h": 24, "7d": 168, "30d": 720}
BASELINE_WINDOWS = {"15m": 24, "1h": 24, "6h": 28, "24h": 14, "7d": 4, "30d": 3}
TIMELINE_BUCKETS = {"15m": (15, 1), "1h": (12, 5), "6h": (12, 30), "24h": (24, 60), "7d": (28, 360), "30d": (30, 1440)}
PRESET_LABELS = {"15m": "15 menit terakhir", "1h": "1 jam terakhir", "6h": "6 jam terakhir", "24h": "24 jam terakhir", "7d": "7 hari terakhir", "30d": "30 hari terakhir"}

# Periode kustom: "custom:YYYY-MM-DD:YYYY-MM-DD" dalam tanggal WIB, tanggal akhir ikut dihitung.
WIB = timedelta(hours=7)
MAX_CUSTOM_DAYS = 92
BASELINE_SPAN = timedelta(days=28)


@dataclass(frozen=True)
class Period:
    key: str
    start: datetime  # UTC naif
    end: datetime  # UTC naif, eksklusif
    n_windows: int
    bucket_minutes: int
    label: str

    @property
    def span(self) -> timedelta:
        return self.end - self.start

    @property
    def n_buckets(self) -> int:
        return max(1, math.ceil(self.span / timedelta(minutes=self.bucket_minutes)))

    def as_dict(self) -> Dict[str, Any]:
        return {"key": self.key, "start": self.start.isoformat(), "end": self.end.isoformat(), "label": self.label}


def _auto_bucket_minutes(span: timedelta) -> int:
    if span <= timedelta(hours=2):
        return 5
    if span <= timedelta(hours=12):
        return 30
    if span <= timedelta(days=3):
        return 60
    if span <= timedelta(days=14):
        return 360
    return 1440


def custom_period_key(start: str, end: str) -> str:
    return f"custom:{start}:{end}"


def resolve_period(time_range: str, now: Optional[datetime] = None) -> Period:
    """Terjemahkan preset ("24h") atau "custom:2026-11-01:2026-11-10" menjadi Period. ValueError bila tidak valid."""
    now = now or datetime.utcnow()
    if time_range in WINDOW_HOURS:
        window = timedelta(hours=WINDOW_HOURS[time_range])
        n_buckets, minutes = TIMELINE_BUCKETS[time_range]
        return Period(time_range, now - window, now, BASELINE_WINDOWS[time_range], minutes, PRESET_LABELS[time_range])

    if not time_range.startswith("custom:"):
        raise ValueError(f"rentang waktu tidak dikenal: {time_range}")
    try:
        _, start_s, end_s = time_range.split(":")
        start_d = datetime.strptime(start_s, "%Y-%m-%d")
        end_d = datetime.strptime(end_s, "%Y-%m-%d")
    except ValueError:
        raise ValueError("format periode harus custom:YYYY-MM-DD:YYYY-MM-DD")
    if end_d < start_d:
        raise ValueError("tanggal akhir lebih awal dari tanggal mulai")
    if (end_d - start_d).days + 1 > MAX_CUSTOM_DAYS:
        raise ValueError(f"periode maksimal {MAX_CUSTOM_DAYS} hari")

    start = start_d - WIB  # 00:00 WIB
    end = min(end_d + timedelta(days=1) - WIB, now)  # akhir hari WIB, dipotong di waktu sekarang
    if end <= start:
        raise ValueError("periode berada di masa depan")
    span = end - start
    n_windows = max(2, min(14, int(BASELINE_SPAN / span)))
    label = start_s if start_s == end_s else f"{start_s} s.d. {end_s}"
    return Period(time_range, start, end, n_windows, _auto_bucket_minutes(span), label)

# Volume minimum agar sebuah topik bisa berstatus lonjakan. Di bawah ini statusnya SINYAL LEMAH.
MIN_SURGE_VOLUME = 3
UNCLUSTERED_KEY = "k:Lainnya"
RISING_STATUSES = ("LONJAKAN TINGGI", "MENINGKAT")

PLATFORM_CATALOG = [
    {"name": "X (Twitter)", "code": "x", "icon": "x"},
    {"name": "TikTok", "code": "tiktok", "icon": "tiktok"},
    {"name": "Threads", "code": "threads", "icon": "threads"},
    {"name": "YouTube", "code": "youtube", "icon": "youtube"},
    {"name": "Instagram", "code": "instagram", "icon": "instagram"},
    {"name": "Facebook", "code": "facebook", "icon": "facebook"},
    {"name": "Reddit", "code": "reddit", "icon": "reddit"},
    {"name": "Telegram", "code": "telegram", "icon": "telegram"},
]

# Keterbatasan nyata metode pengumpulan per platform, ditampilkan ke analis.
PLATFORM_NOTES = {
    "Threads": "Penemuan via Google News umumnya hanya memuat halaman profil akun, bukan isi postingan.",
    "Instagram": "Penemuan via Google News umumnya hanya memuat halaman profil atau keterangan singkat.",
    "TikTok": "Judul dan keterangan video tersedia; jumlah tayangan tidak disediakan Google News.",
    "YouTube": "Pencarian via yt-dlp memberi tayangan, like, komentar, dan pengikut kanal. Penemuan via Google News hanya memberi judul.",
    "X (Twitter)": "Syndication timeline menyediakan like, repost, dan balasan; penemuan via Google News tidak.",
    "Facebook": "Belum ada sumber terdaftar. Halaman publik memerlukan Meta Graph API.",
    "Reddit": "RSS subreddit publik: isi postingan dan nama akun tersedia, jumlah upvote tidak.",
    "Telegram": "Pratinjau kanal publik t.me/s: teks dan jumlah views tersedia. Grup privat tidak bisa dipantau.",
}

_SITE_RE = re.compile(r"site:([a-z0-9.\-]+)", re.IGNORECASE)


@dataclass
class _Dataset:
    now: datetime
    period: Period
    window_start: datetime
    window_end: datetime
    current: List[SocialPost]
    history: List[SocialPost]
    covered_windows: List[int]  # indeks jendela riwayat yang sudah tercakup data (0 = jendela tepat sebelumnya)
    coverage_since: Optional[datetime]
    geo_meta: Dict[int, Dict[str, Any]]
    issues_by_item: Dict[int, List[int]]
    total_collected: int
    excluded_count: int
    uncertain_count: int
    direct_count: int
    history_window_index: Dict[int, int] = field(default_factory=dict)


def _scope_display_name(scope_kode: str) -> str:
    if scope_kode == "ID":
        return "Seluruh Indonesia"
    for kel in KELURAHAN_DATA:
        if kel["kode"] == scope_kode:
            return f"Kelurahan {kel['nama']}, Kec. {kel['kecamatan_nama']}"
    for kec in KECAMATAN_DATA:
        if kec["kode"] == scope_kode:
            return f"Kecamatan {kec['nama']}, {kec['kabupaten_nama']}"
    for kab in KABUPATEN_DATA:
        if kab["kode"] == scope_kode:
            return f"{kab['nama']}, {kab['provinsi_nama']}"
    for prov in PROVINCES_DATA:
        if prov["kode"] == scope_kode:
            return f"Provinsi {prov['nama']}"
    return scope_kode


def _filter_items_by_scope(
    items: Sequence[RawItem],
    scope_kode: str = "ID",
    scope_mode: str = "context",
    multi_codes: Optional[List[str]] = None,
) -> List[Tuple[RawItem, str, str, float]]:
    """Saring item berdasarkan cakupan wilayah (FR-GEO-04). Mengembalikan (item, label konteks, tingkat keyakinan, skor)."""
    target_codes = [c.strip() for c in multi_codes if c.strip()] if multi_codes else [scope_kode]
    if not target_codes or target_codes == ["ID"]:
        return [(it, "Cakupan Nasional", "High", 0.95) for it in items]

    filtered: List[Tuple[RawItem, str, str, float]] = []
    for it in items:
        text = f"{it.judul} {it.isi}"
        for code in target_codes:
            is_relevant, ctx_label, conf_level, conf_score = classify_geographic_context(
                text=text, scope_kode=code, scope_mode=scope_mode
            )
            if is_relevant:
                filtered.append((it, ctx_label, conf_level, conf_score))
                break
    return filtered


def _active_rules(db: Session) -> List[ProfileRule]:
    """Aturan versi terbaru dari setiap profil berstatus aktif."""
    rules: List[ProfileRule] = []
    for profile in db.query(MonitoringProfile).filter(MonitoringProfile.status == "aktif").all():
        rule = (
            db.query(ProfileRule)
            .filter(ProfileRule.profile_id == profile.id)
            .order_by(ProfileRule.versi.desc(), ProfileRule.id.desc())
            .first()
        )
        if rule:
            rules.append(rule)
    return rules


def _json_list(raw: Optional[str]) -> List[str]:
    try:
        value = json.loads(raw or "[]")
    except (TypeError, ValueError):
        return []
    return [str(v).strip() for v in value if str(v).strip()] if isinstance(value, list) else []


def _exclusion_phrases(db: Session) -> List[str]:
    phrases: List[str] = []
    for rule in _active_rules(db):
        phrases.extend(p.lower() for p in _json_list(rule.pengecualian_json))
    return sorted(set(phrases))


def _social_coverage_since(db: Session) -> Optional[datetime]:
    """Sejak kapan pengumpulan medsos benar-benar berjalan.

    Memakai fetched_at, bukan published_at: feed bisa memuat beberapa postingan lama, tetapi
    jendela waktu sebelum pengumpulan dimulai tidak tercakup secara utuh dan tidak boleh
    dihitung sebagai jendela "nol konten" untuk baseline.
    """
    return db.query(func.min(RawItem.fetched_at)).filter(RawItem.platform.in_(SOCIAL_PLATFORMS)).scalar()


def _load_dataset(
    db: Session,
    time_range: str = "24h",
    scope_kode: str = "ID",
    scope_mode: str = "context",
    multi_codes: Optional[List[str]] = None,
    platform: Optional[str] = None,
    category: Optional[str] = None,
    agency: Optional[str] = None,
    period: Optional[Period] = None,
) -> _Dataset:
    """Muat konten medsos jendela aktif + riwayat baseline.

    Filter kategori/instansi diterapkan ke jendela aktif dan riwayat sekaligus, sehingga
    baseline sebuah topik dihitung dari himpunan konten yang sama.
    """
    now = datetime.utcnow()
    period = period or resolve_period(time_range, now)
    n_windows = period.n_windows
    window = period.span
    window_start, window_end = period.start, period.end
    history_start = window_start - window * n_windows

    rows: List[Tuple[RawItem, Optional[ItemAnalysis]]] = (
        db.query(RawItem, ItemAnalysis)
        .outerjoin(ItemAnalysis, ItemAnalysis.item_id == RawItem.id)
        .filter(
            RawItem.platform.in_(SOCIAL_PLATFORMS),
            RawItem.published_at >= history_start,
            RawItem.published_at < window_end,
        )
        .order_by(RawItem.published_at.desc())
        .all()
    )
    total_collected = sum(1 for it, _ in rows if it.published_at >= window_start)

    exclusions = _exclusion_phrases(db)
    kept: List[Tuple[RawItem, Optional[ItemAnalysis]]] = []
    excluded = 0
    for it, ana in rows:
        if platform and platform.lower() != "semua" and (it.platform or "").lower() != platform.lower():
            continue
        text_low = f"{it.judul} {it.isi}".lower()
        is_promo = bool(ana and ana.topik == "Komersial")
        if is_promo or any(ph in text_low for ph in exclusions):
            if it.published_at >= window_start:
                excluded += 1
            continue
        kept.append((it, ana))

    analysis_by_id = {it.id: ana for it, ana in kept}
    scoped = _filter_items_by_scope([it for it, _ in kept], scope_kode, scope_mode, multi_codes)

    geo_meta: Dict[int, Dict[str, Any]] = {}
    current: List[SocialPost] = []
    history: List[SocialPost] = []
    history_index: Dict[int, int] = {}
    uncertain = direct = 0
    for it, label, conf, score in scoped:
        ana = analysis_by_id.get(it.id)
        text = f"{it.judul} {it.isi}" if it.isi and it.isi not in it.judul else it.judul
        post = SocialPost(
            id=it.id,
            text=text,
            title=it.judul,
            platform=it.platform or "",
            published_at=it.published_at,
            author=it.penulis,
            sentiment=(ana.sentimen if ana else "netral") or "netral",
            topic=ana.topik if ana else None,
            location=ana.lokasi_kejadian if ana else None,
            url=it.url_kanonik,
            publisher=it.penerbit,
            likes=it.eng_likes,
            shares=it.eng_shares,
            replies=it.eng_replies,
            views=it.eng_views,
            followers=it.author_followers,
        )
        post.keys = extract_keys(text, post.topic)
        post.categories, post.agencies = classify(text)
        post.emotions = classify_emotions(text)
        if category and category not in post.categories:
            continue
        if agency and agency not in post.agencies:
            continue
        if it.published_at >= window_start:
            current.append(post)
            geo_meta[it.id] = {"label": label, "confidence": conf, "score": score}
            if conf in ("Low", "Unknown"):
                uncertain += 1
            if conf == "High":
                direct += 1
        else:
            idx = int((window_start - it.published_at) / window)
            if 0 <= idx < n_windows:
                history.append(post)
                history_index[it.id] = idx

    coverage_since = _social_coverage_since(db)
    covered = [
        i for i in range(n_windows)
        if coverage_since is not None and window_start - window * (i + 1) >= coverage_since - timedelta(minutes=1)
    ]

    ids = [p.id for p in current]
    issues_by_item: Dict[int, List[int]] = defaultdict(list)
    if ids:
        for link in db.query(IssueItem).filter(IssueItem.item_id.in_(ids)).all():
            issues_by_item[link.item_id].append(link.issue_id)

    return _Dataset(
        now=now,
        period=period,
        window_start=window_start,
        window_end=window_end,
        current=current,
        history=history,
        covered_windows=covered,
        coverage_since=coverage_since,
        geo_meta=geo_meta,
        issues_by_item=dict(issues_by_item),
        total_collected=total_collected,
        excluded_count=excluded,
        uncertain_count=uncertain,
        direct_count=direct,
        history_window_index=history_index,
    )


def _history_counts(ds: _Dataset, matcher) -> List[int]:
    """Jumlah konten cocok per jendela riwayat, hanya untuk jendela yang sudah tercakup data."""
    counts = Counter()
    for p in ds.history:
        if matcher(p):
            counts[ds.history_window_index[p.id]] += 1
    return [counts.get(i, 0) for i in ds.covered_windows]


def _timeline(ds: _Dataset, posts: Sequence[SocialPost], time_range: Optional[str] = None) -> List[Dict[str, Any]]:
    """Jumlah konten per interval dalam jendela aktif. Interval mengikuti panjang periode."""
    n_buckets = ds.period.n_buckets
    size = timedelta(minutes=ds.period.bucket_minutes)
    start = ds.window_end - size * n_buckets
    counts = [0] * n_buckets
    for p in posts:
        idx = int((p.published_at - start) / size)
        if 0 <= idx < n_buckets:
            counts[idx] += 1
    return [{"t": (start + size * i).isoformat(), "count": c} for i, c in enumerate(counts)]


def _sentiment_pct(posts: Sequence[SocialPost]) -> Dict[str, float]:
    counter = Counter(p.sentiment for p in posts)
    total = max(len(posts), 1)
    return {
        "positif": round(counter["positif"] / total * 100, 1),
        "netral": round((counter["netral"] + counter["tidak pasti"]) / total * 100, 1),
        "negatif": round(counter["negatif"] / total * 100, 1),
        "campuran": round(counter["campuran"] / total * 100, 1),
    }


def _mention_payload(ds: _Dataset, p: SocialPost) -> Dict[str, Any]:
    geo = ds.geo_meta.get(p.id, {})
    return {
        "id": p.id,
        "judul": p.title,
        "isi": p.text[:240] + ("..." if len(p.text) > 240 else ""),
        "penerbit": p.publisher,
        "penulis": p.author,  # null bila sumber tidak menyediakan nama akun
        "platform": p.platform,
        "url": p.url,
        "published_at": p.published_at.isoformat(),
        "sentimen": p.sentiment,
        "emosi": [EMOTION_LABELS[e] for e in p.emotions],
        "geo_context": geo.get("label"),
        "geo_confidence": geo.get("confidence"),
        "engagement": {
            "likes": p.likes,
            "shares": p.shares,
            "replies": p.replies,
            "views": p.views,
            "followers": p.followers,
        },
    }


def _rank_mentions(posts: Sequence[SocialPost]) -> List[SocialPost]:
    """Urutkan bukti: yang punya data engagement dulu, lalu interaksi, tayangan, dan waktu terbaru."""
    return sorted(
        posts,
        key=lambda p: (
            p.interactions is None and p.views is None,
            -(p.interactions or 0),
            -(p.views or 0),
            -p.published_at.timestamp(),
        ),
    )


def _dominant_issue(ds: _Dataset, posts: Sequence[SocialPost], issues: Dict[int, Issue]) -> Optional[Dict[str, Any]]:
    counter: Counter = Counter()
    for p in posts:
        for iid in ds.issues_by_item.get(p.id, []):
            counter[iid] += 1
    for iid, linked in counter.most_common():
        iss = issues.get(iid)
        if iss is None:
            continue
        return {
            "id": iss.id,
            "kode_referensi": iss.kode_referensi,
            "judul": iss.judul,
            "level": iss.level,
            "skor": iss.skor,
            "status": iss.status,
            "linked_posts": linked,
        }
    return None


def _build_trends(db: Session, ds: _Dataset, time_range: str, sort: str = "laju") -> List[Dict[str, Any]]:
    groups = [(k, posts) for k, posts in cluster_posts(ds.current) if k != UNCLUSTERED_KEY]
    issue_ids = {iid for ids in ds.issues_by_item.values() for iid in ids}
    issues = {i.id: i for i in db.query(Issue).filter(Issue.id.in_(issue_ids)).all()} if issue_ids else {}

    trends: List[Dict[str, Any]] = []
    for key, posts in groups:
        hist = _history_counts(ds, lambda p, k=key: k in p.keys)
        vel = velocity(len(posts), hist, MIN_SURGE_VOLUME)
        platforms = [name for name, _ in Counter(p.platform for p in posts).most_common()]
        timeline = _timeline(ds, posts, time_range)
        peak = max(timeline, key=lambda b: b["count"]) if timeline else None
        n_buckets = len(timeline) or 1
        hashtags = top_hashtags(posts)
        locations = [loc for loc, _ in Counter(p.location for p in posts if p.location).most_common(3)]
        cat_counts = Counter(c for p in posts for c in p.categories if c != UNCATEGORIZED)
        ag_counts = Counter(a for p in posts for a in p.agencies)

        trends.append({
            "topic_key": key,
            "topic": key_label(key),
            "topic_type": {"#": "hashtag", "p": "frasa", "k": "kategori"}.get(key[0], "lainnya"),
            "hashtags": hashtags,
            "related_phrases": top_phrases(posts, exclude=key),
            "mention_count": len(posts),
            "growth_pct": vel["growth_pct"],
            "velocity_score": vel["score"],
            "velocity_status": vel["status"],
            "velocity": vel,
            "platforms": platforms,
            "sentiment_pct": _sentiment_pct(posts),
            "locations": locations,
            "categories": [{"id": c, "label": category_label(c), "count": n} for c, n in cat_counts.most_common(3)],
            "agencies": [{"id": a, "label": agency_label(a), "count": n} for a, n in ag_counts.most_common(4)],
            "emotions": emotion_breakdown((p.emotions for p in posts), len(posts))[:3],
            "correlated_issue": _dominant_issue(ds, posts, issues),
            "first_detected": min(p.published_at for p in posts).isoformat(),
            "last_seen": max(p.published_at for p in posts).isoformat(),
            "timeline": timeline,
            "baseline_per_bucket": round(vel["baseline_mean"] / n_buckets, 3) if vel["baseline_windows"] else None,
            "peak_at": peak["t"] if peak and peak["count"] > 0 else None,
            "engagement": engagement_summary(posts),
            "accounts": account_analysis(posts),
            "coordination": detect_coordination(posts),
            "propagation": propagation(posts),
            "sample_mentions": [_mention_payload(ds, p) for p in _rank_mentions(posts)[:6]],
            "post_ids": [p.id for p in posts],
        })

    notes = latest_notes(db, (t["topic_key"] for t in trends))
    for t in trends:
        t["analyst_note"] = notes.get(t["topic_key"])
    _sort_trends(trends, sort)
    return trends


SORT_OPTIONS = ("laju", "terbaru", "volume", "negatif")


def _sort_trends(trends: List[Dict[str, Any]], sort: str = "laju") -> None:
    """Urutkan di tempat dan beri nomor peringkat. laju = skor laju, terbaru = konten terakhir paling baru."""
    if sort == "terbaru":
        trends.sort(key=lambda t: (t["last_seen"], t["mention_count"]), reverse=True)
    elif sort == "volume":
        trends.sort(key=lambda t: (-t["mention_count"], -t["velocity_score"], t["topic"]))
    elif sort == "negatif":
        trends.sort(key=lambda t: (-t["sentiment_pct"]["negatif"] * t["mention_count"], -t["mention_count"], t["topic"]))
    else:
        trends.sort(key=lambda t: (-t["velocity_score"], -t["mention_count"], t["topic"]))
    for i, t in enumerate(trends, start=1):
        t["rank"] = i


def get_social_trends(
    db: Session,
    platform: Optional[str] = None,
    time_range: str = "24h",
    scope_kode: str = "ID",
    scope_mode: str = "context",
    multi_codes: Optional[List[str]] = None,
    limit: int = 15,
    category: Optional[str] = None,
    agency: Optional[str] = None,
    sort: str = "laju",
) -> List[Dict[str, Any]]:
    """Topik tren media sosial terfilter wilayah, kategori, dan instansi."""
    ds = _load_dataset(db, time_range, scope_kode, scope_mode, multi_codes, platform, category, agency)
    return _build_trends(db, ds, time_range, sort)[:limit]


def get_social_pulse_overview(
    db: Session,
    time_range: str = "24h",
    scope_kode: str = "ID",
    scope_mode: str = "context",
    multi_codes: Optional[List[str]] = None,
    category: Optional[str] = None,
    agency: Optional[str] = None,
) -> Dict[str, Any]:
    """KPI agregat media sosial untuk cakupan wilayah aktif (FR-GEO-04)."""
    ds = _load_dataset(db, time_range, scope_kode, scope_mode, multi_codes, None, category, agency)
    trends = _build_trends(db, ds, time_range)
    posts = ds.current

    prev_covered = 0 in ds.covered_windows
    prev_mentions = sum(1 for p in ds.history if ds.history_window_index[p.id] == 0) if prev_covered else None
    growth = (
        round((len(posts) - prev_mentions) / prev_mentions * 100, 1)
        if prev_mentions else None
    )

    sentiment_counts = {"positif": 0, "netral": 0, "negatif": 0, "campuran": 0, "tidak pasti": 0}
    for p in posts:
        sentiment_counts[p.sentiment if p.sentiment in sentiment_counts else "netral"] += 1

    platform_counts = Counter(p.platform for p in posts)
    clustered = [t for t in trends if t["mention_count"] >= 2]
    accounts = account_analysis(posts)

    return {
        "time_range": time_range,
        "period": ds.period.as_dict(),
        "scope_kode": scope_kode,
        "scope_name": _scope_display_name(scope_kode),
        "scope_mode": scope_mode,
        "total_mentions": len(posts),
        "previous_mentions": prev_mentions,
        "mention_growth_pct": growth,
        "trending_topics_count": len(clustered),
        "emerging_trends_count": sum(1 for t in trends if t["velocity_status"] in RISING_STATUSES),
        "surging_trends_count": sum(1 for t in trends if t["velocity_status"] == "LONJAKAN TINGGI"),
        "new_trends_count": sum(1 for t in trends if t["velocity_status"] == "BARU"),
        "coordination_flags": sum(1 for t in trends if t["coordination"]["flagged"]),
        "negative_ratio_pct": round(sentiment_counts["negatif"] / max(len(posts), 1) * 100, 1),
        "sentiment_breakdown": sentiment_counts,
        "emotion_breakdown": emotion_breakdown((p.emotions for p in posts), len(posts)),
        "active_platforms_count": len(platform_counts),
        "platform_distribution": dict(platform_counts),
        "unique_accounts": accounts["unique_accounts"],
        "author_coverage_pct": accounts["author_coverage_pct"],
        "engagement": engagement_summary(posts),
        "timeline": _timeline(ds, posts, time_range),
        "baseline": {
            "windows_available": len(ds.covered_windows),
            "windows_target": ds.period.n_windows,
            "coverage_since": ds.coverage_since.isoformat() if ds.coverage_since else None,
            "min_surge_volume": MIN_SURGE_VOLUME,
        },
        "data_coverage": {
            "total_collected": ds.total_collected,
            "relevant_to_scope": len(posts),
            "uncertain_count": ds.uncertain_count,
            "direct_count": ds.direct_count,
            "excluded_count": ds.excluded_count,
            "unclustered_count": next((len(g) for k, g in cluster_posts(posts) if k == UNCLUSTERED_KEY), 0),
        },
        "last_updated": ds.now.isoformat(),
    }


_HASHTAG_TEXT_RE = re.compile(r"#([a-z0-9_]+)")


def _term_matcher(term: str):
    """Cocokkan kata utuh, atau kata di dalam hashtag ("banjir" cocok dengan #BanjirBekasi)."""
    low = term.lower()
    word = re.compile(r"(?<![a-z0-9])" + re.escape(low) + r"(?![a-z0-9])")
    compact = re.sub(r"[^a-z0-9]", "", low)

    def match(post: SocialPost) -> bool:
        text = post.text.lower()
        if word.search(text):
            return True
        return bool(compact) and any(compact in tag.replace("_", "") for tag in _HASHTAG_TEXT_RE.findall(text))

    return match


def get_social_watchlist(
    db: Session,
    time_range: str = "24h",
    scope_kode: str = "ID",
    scope_mode: str = "context",
    multi_codes: Optional[List[str]] = None,
    extra_terms: Optional[List[str]] = None,
    category: Optional[str] = None,
    agency: Optional[str] = None,
) -> Dict[str, Any]:
    """Pantauan kata kunci profil (kata kunci + sinonim) dan kata kunci tambahan di media sosial."""
    terms: Dict[str, Dict[str, Any]] = {}
    for rule in _active_rules(db):
        profile = db.get(MonitoringProfile, rule.profile_id)
        for kind, raw in (("kata kunci", rule.keyword_json), ("sinonim", rule.sinonim_json)):
            for term in _json_list(raw):
                terms.setdefault(term.lower(), {"term": term, "kind": kind, "profiles": set()})["profiles"].add(profile.nama if profile else "-")
    for term in extra_terms or []:
        term = term.strip()
        if len(term) >= 2:
            terms.setdefault(term.lower(), {"term": term, "kind": "tambahan", "profiles": set()})

    ds = _load_dataset(db, time_range, scope_kode, scope_mode, multi_codes, None, category, agency)
    results: List[Dict[str, Any]] = []
    for meta in terms.values():
        matcher = _term_matcher(meta["term"])
        matched = [p for p in ds.current if matcher(p)]
        hist = _history_counts(ds, matcher)
        vel = velocity(len(matched), hist, MIN_SURGE_VOLUME)
        results.append({
            "term": meta["term"],
            "kind": meta["kind"],
            "profiles": sorted(meta["profiles"]),
            "mention_count": len(matched),
            "velocity_status": vel["status"] if matched or hist else "TIDAK ADA",
            "velocity_score": vel["score"],
            "growth_pct": vel["growth_pct"],
            "velocity": vel,
            "sentiment_pct": _sentiment_pct(matched),
            "platforms": [n for n, _ in Counter(p.platform for p in matched).most_common()],
            "timeline": _timeline(ds, matched, time_range),
            "engagement": engagement_summary(matched),
            "top_mentions": [_mention_payload(ds, p) for p in _rank_mentions(matched)[:3]],
        })

    results.sort(key=lambda r: (-r["velocity_score"], -r["mention_count"], r["term"]))
    return {
        "time_range": time_range,
        "scope_kode": scope_kode,
        "scope_name": _scope_display_name(scope_kode),
        "total_terms": len(results),
        "active_terms": sum(1 for r in results if r["mention_count"] > 0),
        "rising_terms": sum(1 for r in results if r["velocity_status"] in RISING_STATUSES),
        "terms": results,
    }


def source_platforms(source: Source) -> List[str]:
    """Platform yang ditargetkan sebuah sumber: dari domain URL atau dari operator `site:` di query."""
    plats: List[str] = []
    direct = platform_from_url(source.url)
    if direct:
        plats.append(direct)
    for site in _SITE_RE.findall(source.url or ""):
        plat = platform_from_url(f"https://{site}")
        if plat and plat not in plats:
            plats.append(plat)
    return plats


def _source_method(source: Source) -> str:
    url = (source.url or "").lower()
    if "news.google.com" in url:
        return "Penemuan via Google News (site:)"
    if "syndication.twitter.com" in url:
        return "Syndication timeline publik"
    if "bsky.app" in url:
        return "API publik AT Protocol"
    if "reddit.com" in url:
        return "RSS subreddit publik"
    if "youtube.com/results" in url:
        return "Pencarian YouTube (yt-dlp)"
    if "t.me/s/" in url:
        return "Pratinjau kanal publik Telegram"
    if "gdeltproject.org" in url:
        return "GDELT DOC API"
    return "Feed publik"


def _source_health(source: Source, now: datetime) -> Dict[str, Any]:
    """Status sumber dari hasil tarikan terakhir yang tercatat, bukan dari konfigurasi."""
    if source.status_izin != "aktif":
        state = "nonaktif"
    elif source.last_fetch_at is None:
        state = "belum_ditarik"
    elif source.last_fetch_status == "gagal":
        state = "gagal"
    elif not source.last_fetch_count:
        state = "kosong"
    elif source.last_success_at and now - source.last_success_at > timedelta(minutes=max(source.frekuensi_menit, 5) * 3):
        state = "terlambat"
    else:
        state = "aktif"
    return {
        "id": source.id,
        "nama": source.nama,
        "method": _source_method(source),
        "state": state,
        "status_izin": source.status_izin,
        "last_fetch_at": source.last_fetch_at.isoformat() if source.last_fetch_at else None,
        "last_success_at": source.last_success_at.isoformat() if source.last_success_at else None,
        "last_fetch_count": source.last_fetch_count,
        "last_error": source.last_fetch_error,
        "frekuensi_menit": source.frekuensi_menit,
    }


_STATE_RANK = {"aktif": 0, "terlambat": 1, "kosong": 2, "gagal": 3, "belum_ditarik": 4, "nonaktif": 5}
_STATE_LABEL = {
    "aktif": "Aktif",
    "terlambat": "Terlambat",
    "kosong": "Tanpa Konten Terkini",
    "gagal": "Gagal",
    "belum_ditarik": "Belum Ditarik",
    "nonaktif": "Nonaktif",
    "tanpa_sumber": "Belum Ada Sumber",
}


def get_platform_metrics(
    db: Session,
    scope_kode: str = "ID",
    scope_mode: str = "context",
    multi_codes: Optional[List[str]] = None,
    time_range: str = "7d",
) -> List[Dict[str, Any]]:
    """Kesehatan konektor per platform (dari hasil tarikan nyata) dan metrik percakapan terfilter wilayah."""
    now = datetime.utcnow()
    sources_by_platform: Dict[str, List[Source]] = defaultdict(list)
    for src in db.query(Source).all():
        for plat in source_platforms(src):
            sources_by_platform[plat].append(src)

    ds = _load_dataset(db, time_range, scope_kode, scope_mode, multi_codes)
    posts_by_platform: Dict[str, List[SocialPost]] = defaultdict(list)
    for p in ds.current:
        posts_by_platform[p.platform].append(p)

    results: List[Dict[str, Any]] = []
    for meta in PLATFORM_CATALOG:
        name = meta["name"]
        health = [_source_health(s, now) for s in sources_by_platform.get(name, [])]
        if health:
            best = min(health, key=lambda h: _STATE_RANK[h["state"]])["state"]
        else:
            best = "tanpa_sumber"
        posts = posts_by_platform.get(name, [])
        sentiment = Counter(p.sentiment for p in posts)
        vol = len(posts)
        last_success = max((h["last_success_at"] for h in health if h["last_success_at"]), default=None)
        results.append({
            **meta,
            "type": ", ".join(sorted({h["method"] for h in health})) or "Belum ada sumber",
            "official_status": _STATE_LABEL[best],
            "health_state": best,
            "is_connected": best == "aktif",
            "sources": health,
            "note": PLATFORM_NOTES.get(name),
            "time_range": time_range,
            "mention_count": vol,
            "negative_sentiment_pct": round(sentiment["negatif"] / vol * 100, 1) if vol else 0.0,
            "positive_sentiment_pct": round(sentiment["positif"] / vol * 100, 1) if vol else 0.0,
            "last_data_at": max(p.published_at for p in posts).isoformat() if posts else None,
            "last_success_at": last_success,
            "engagement": engagement_summary(posts),
            "author_coverage_pct": account_analysis(posts)["author_coverage_pct"] if posts else 0.0,
        })
    return results


def get_social_correlations(
    db: Session,
    scope_kode: str = "ID",
    scope_mode: str = "context",
    multi_codes: Optional[List[str]] = None,
) -> List[Dict[str, Any]]:
    """Topik media sosial 7 hari terakhir yang kontennya benar-benar tertaut ke isu RADAR."""
    trends = get_social_trends(
        db, time_range="7d", scope_kode=scope_kode, scope_mode=scope_mode, multi_codes=multi_codes, limit=50
    )
    return [
        {
            "social_topic": t["topic"],
            "topic_key": t["topic_key"],
            "hashtags": t["hashtags"],
            "mention_count": t["mention_count"],
            "linked_posts": t["correlated_issue"]["linked_posts"],
            "velocity_score": t["velocity_score"],
            "velocity_status": t["velocity_status"],
            "platforms": t["platforms"],
            "issue": t["correlated_issue"],
            "first_detected": t["first_detected"],
        }
        for t in trends
        if t["correlated_issue"]
    ]


def get_social_geographic_comparison(
    db: Session,
    scope_codes: List[str],
    time_range: str = "24h",
) -> List[Dict[str, Any]]:
    """Membandingkan indikator intelijen sosial antarwilayah (FR-GEO-06)."""
    comparison: List[Dict[str, Any]] = []
    for code in (c.strip() for c in scope_codes):
        if not code:
            continue
        ds = _load_dataset(db, time_range, code, "context")
        trends = _build_trends(db, ds, time_range)
        posts = ds.current
        prev = sum(1 for p in ds.history if ds.history_window_index[p.id] == 0) if 0 in ds.covered_windows else None
        neg = sum(1 for p in posts if p.sentiment == "negatif")
        comparison.append({
            "scope_kode": code,
            "region_name": _scope_display_name(code),
            "total_mentions": len(posts),
            "growth_pct": round((len(posts) - prev) / prev * 100, 1) if prev else None,
            "trending_topics_count": sum(1 for t in trends if t["mention_count"] >= 2),
            "emerging_trends_count": sum(1 for t in trends if t["velocity_status"] in RISING_STATUSES),
            "negative_sentiment_pct": round(neg / len(posts) * 100, 1) if posts else 0.0,
            "top_topic": trends[0]["topic"] if trends else None,
        })
    return comparison


def get_social_facets(
    db: Session,
    time_range: str = "24h",
    scope_kode: str = "ID",
    scope_mode: str = "context",
    multi_codes: Optional[List[str]] = None,
    platform: Optional[str] = None,
    category: Optional[str] = None,
    agency: Optional[str] = None,
) -> Dict[str, Any]:
    """Jumlah konten per kategori dan per instansi untuk pill filter.

    Faset silang: jumlah kategori dihitung dengan filter instansi aktif (tanpa filter
    kategori), dan sebaliknya, sehingga angka di setiap pill sama dengan hasil bila diklik.
    """
    ds_cat = _load_dataset(db, time_range, scope_kode, scope_mode, multi_codes, platform, None, agency)
    ds_ag = _load_dataset(db, time_range, scope_kode, scope_mode, multi_codes, platform, category, None)
    cat_counts = Counter(c for p in ds_cat.current for c in p.categories)
    ag_counts = Counter(a for p in ds_ag.current for a in p.agencies)
    neg_by_agency = Counter(a for p in ds_ag.current if p.sentiment == "negatif" for a in p.agencies)

    categories = [{"id": c.id, "label": c.label, "count": cat_counts.get(c.id, 0)} for c in CATEGORIES]
    categories.append({"id": UNCATEGORIZED, "label": UNCATEGORIZED_LABEL, "count": cat_counts.get(UNCATEGORIZED, 0)})
    agencies = [
        {"id": a.id, "label": a.label, "group": a.group, "count": ag_counts.get(a.id, 0), "negative": neg_by_agency.get(a.id, 0)}
        for a in AGENCIES
    ]
    return {
        "time_range": time_range,
        "total": len(ds_cat.current),
        "categories": categories,
        "agencies": agencies,
    }


def get_agency_board(
    db: Session,
    time_range: str = "24h",
    scope_kode: str = "ID",
    scope_mode: str = "context",
    multi_codes: Optional[List[str]] = None,
    category: Optional[str] = None,
) -> Dict[str, Any]:
    """Papan instansi: seberapa sering tiap instansi disebut, lajunya, dan nada percakapannya."""
    ds = _load_dataset(db, time_range, scope_kode, scope_mode, multi_codes, None, category, None)
    by_agency: Dict[str, List[SocialPost]] = defaultdict(list)
    for p in ds.current:
        for a in p.agencies:
            by_agency[a].append(p)
    total_mentions = sum(len(v) for v in by_agency.values())

    rows: List[Dict[str, Any]] = []
    for ag in AGENCIES:
        posts = by_agency.get(ag.id, [])
        hist = _history_counts(ds, lambda p, aid=ag.id: aid in p.agencies)
        if not posts and not any(hist):
            continue
        vel = velocity(len(posts), hist, MIN_SURGE_VOLUME)
        sentiment = _sentiment_pct(posts)
        negatives = [p for p in posts if p.sentiment == "negatif"]
        topics = [key_label(k) for k, g in cluster_posts(posts) if k != UNCLUSTERED_KEY][:3]
        cat_counts = Counter(c for p in posts for c in p.categories if c != UNCATEGORIZED)
        rows.append({
            "id": ag.id,
            "label": ag.label,
            "group": ag.group,
            "mention_count": len(posts),
            "share_of_voice_pct": round(len(posts) / total_mentions * 100, 1) if total_mentions else 0.0,
            "negative_count": len(negatives),
            "sentiment_pct": sentiment,
            "velocity_status": vel["status"] if posts else "TIDAK ADA",
            "velocity_score": vel["score"],
            "growth_pct": vel["growth_pct"],
            "velocity": vel,
            "timeline": _timeline(ds, posts, time_range),
            "platforms": [n for n, _ in Counter(p.platform for p in posts).most_common()],
            "top_topics": topics,
            "categories": [{"id": c, "label": category_label(c), "count": n} for c, n in cat_counts.most_common(3)],
            "emotions": emotion_breakdown((p.emotions for p in posts), len(posts))[:3],
            "top_negative": [_mention_payload(ds, p) for p in _rank_mentions(negatives)[:3]],
            "latest": [_mention_payload(ds, p) for p in sorted(posts, key=lambda p: p.published_at, reverse=True)[:3]],
            "engagement": engagement_summary(posts),
        })

    rows.sort(key=lambda r: (-r["negative_count"], -r["velocity_score"], -r["mention_count"], r["label"]))
    return {
        "time_range": time_range,
        "scope_kode": scope_kode,
        "scope_name": _scope_display_name(scope_kode),
        "total_posts": len(ds.current),
        "posts_mentioning_agency": sum(1 for p in ds.current if p.agencies),
        "agencies": rows,
    }


def _fmt_int(n: Optional[int]) -> str:
    return "-" if n is None else f"{n:,}".replace(",", ".")


def get_social_brief(
    db: Session,
    time_range: str = "24h",
    scope_kode: str = "ID",
    scope_mode: str = "context",
    multi_codes: Optional[List[str]] = None,
    category: Optional[str] = None,
    agency: Optional[str] = None,
) -> Dict[str, Any]:
    """Ringkasan situasi dalam beberapa kalimat, disusun dari angka yang sama dengan dashboard (tanpa LLM)."""
    ds = _load_dataset(db, time_range, scope_kode, scope_mode, multi_codes, None, category, agency)
    trends = _build_trends(db, ds, time_range)
    posts = ds.current
    scope_name = _scope_display_name(scope_kode)
    points: List[Dict[str, Any]] = []

    filters = [category_label(category) if category else None, agency_label(agency) if agency else None]
    filter_txt = f" (filter: {', '.join(f for f in filters if f)})" if any(filters) else ""
    title = f"Ringkasan Social Pulse {scope_name}, {ds.period.label}{filter_txt}"

    if not posts:
        points.append({"kind": "volume", "text": "Belum ada percakapan medsos yang tercatat untuk periode dan filter ini."})
        return {"title": title, "period": ds.period.as_dict(), "points": points, "generated_at": ds.now.isoformat()}

    neg = sum(1 for p in posts if p.sentiment == "negatif")
    prev = sum(1 for p in ds.history if ds.history_window_index[p.id] == 0) if 0 in ds.covered_windows else None
    growth = f", {'naik' if len(posts) >= prev else 'turun'} dari {prev} pada periode sebelumnya" if prev else ""
    platforms = Counter(p.platform for p in posts).most_common(3)
    emotions = emotion_breakdown((p.emotions for p in posts), len(posts))[:2]
    emo_txt = (" Emosi yang menonjol: " + ", ".join(f"{e['label'].lower()} ({e['pct']:.0f}%)" for e in emotions) + ".") if emotions else ""
    points.append({
        "kind": "volume",
        "text": (
            f"{_fmt_int(len(posts))} konten medsos{growth}. "
            f"{round(neg / len(posts) * 100)}% bernada negatif.{emo_txt} "
            f"Kanal terbanyak: {', '.join(f'{n} ({c})' for n, c in platforms)}."
        ),
    })

    rising = [t for t in trends if t["velocity_status"] in ("LONJAKAN TINGGI", "MENINGKAT")][:3]
    if rising:
        parts = [f"{t['topic']} ({t['mention_count']} konten, {t['velocity']['ratio']}x baseline)" for t in rising]
        points.append({"kind": "lonjakan", "text": "Topik yang naik: " + "; ".join(parts) + "."})
    elif trends:
        top = sorted(trends, key=lambda t: -t["mention_count"])[:3]
        note = " Belum ada pembanding periode sebelumnya, jadi laju belum bisa dinilai." if not ds.covered_windows else ""
        points.append({
            "kind": "topik",
            "text": "Topik terbanyak: " + "; ".join(f"{t['topic']} ({t['mention_count']} konten)" for t in top) + "." + note,
        })

    ag_neg = Counter(a for p in posts if p.sentiment == "negatif" for a in p.agencies)
    if ag_neg:
        parts = [f"{agency_label(a)} ({n} konten negatif)" for a, n in ag_neg.most_common(3)]
        points.append({"kind": "instansi", "text": "Instansi yang paling banyak dikeluhkan: " + "; ".join(parts) + "."})

    reach = [p for p in posts if (p.views or 0) > 0 or (p.interactions or 0) > 0]
    if reach:
        best = max(reach, key=lambda p: ((p.views or 0), (p.interactions or 0)))
        metric = f"{_fmt_int(best.views)} tayangan" if best.views else f"{_fmt_int(best.interactions)} interaksi"
        points.append({
            "kind": "jangkauan",
            "text": f"Jangkauan tertinggi: \"{best.title[:120]}\" oleh {best.author or best.platform} ({metric}).",
            "url": best.url,
        })

    flagged = [t for t in trends if t["coordination"]["flagged"]]
    if flagged:
        points.append({
            "kind": "koordinasi",
            "text": f"Teks kembar dari banyak akun terdeteksi pada {len(flagged)} topik ({', '.join(t['topic'] for t in flagged[:3])}). Perlu dicek sumbernya.",
        })

    if len(ds.covered_windows) < ds.period.n_windows:
        points.append({
            "kind": "catatan",
            "text": f"Catatan: baseline baru {len(ds.covered_windows)} dari {ds.period.n_windows} periode pembanding, penilaian laju belum penuh.",
        })

    return {"title": title, "period": ds.period.as_dict(), "points": points, "generated_at": ds.now.isoformat()}



def previous_period(p: Period) -> Period:
    """Periode tepat sebelum p dengan panjang sama (pembanding default)."""
    return Period(
        key=f"sebelum:{p.key}",
        start=p.start - p.span,
        end=p.start,
        n_windows=p.n_windows,
        bucket_minutes=p.bucket_minutes,
        label=f"periode sebelumnya ({(p.start - p.span + WIB).strftime('%Y-%m-%d %H:%M')} s.d. {(p.start + WIB).strftime('%Y-%m-%d %H:%M')} WIB)",
    )


def _delta_row(row_id: str, label: str, a: int, b: int, **extra: Any) -> Dict[str, Any]:
    return {
        "id": row_id,
        "label": label,
        "a": a,
        "b": b,
        "delta": a - b,
        "change_pct": round((a - b) / b * 100, 1) if b else None,
        **extra,
    }


def get_period_comparison(
    db: Session,
    time_range: str = "7d",
    compare_range: Optional[str] = None,
    scope_kode: str = "ID",
    scope_mode: str = "context",
    multi_codes: Optional[List[str]] = None,
    platform: Optional[str] = None,
) -> Dict[str, Any]:
    """Bandingkan periode aktif (A) dengan periode pembanding (B, default = periode sebelumnya)."""
    period_a = resolve_period(time_range)
    period_b = resolve_period(compare_range) if compare_range else previous_period(period_a)
    ds_a = _load_dataset(db, time_range, scope_kode, scope_mode, multi_codes, platform, period=period_a)
    ds_b = _load_dataset(db, time_range, scope_kode, scope_mode, multi_codes, platform, period=period_b)
    a, b = ds_a.current, ds_b.current

    def summary(posts: Sequence[SocialPost]) -> Dict[str, Any]:
        n = len(posts)
        return {
            "mentions": n,
            "negative_pct": round(sum(1 for p in posts if p.sentiment == "negatif") / n * 100, 1) if n else 0.0,
            "accounts": account_analysis(posts)["unique_accounts"],
            "views": engagement_summary(posts)["views"],
        }

    cat_a = Counter(c for p in a for c in p.categories)
    cat_b = Counter(c for p in b for c in p.categories)
    categories = [
        _delta_row(c.id, c.label, cat_a.get(c.id, 0), cat_b.get(c.id, 0))
        for c in CATEGORIES
        if cat_a.get(c.id) or cat_b.get(c.id)
    ]

    ag_a = Counter(x for p in a for x in p.agencies)
    ag_b = Counter(x for p in b for x in p.agencies)
    neg_a = Counter(x for p in a if p.sentiment == "negatif" for x in p.agencies)
    neg_b = Counter(x for p in b if p.sentiment == "negatif" for x in p.agencies)
    agencies = [
        _delta_row(ag.id, ag.label, ag_a.get(ag.id, 0), ag_b.get(ag.id, 0),
                   negative_a=neg_a.get(ag.id, 0), negative_b=neg_b.get(ag.id, 0))
        for ag in AGENCIES
        if ag_a.get(ag.id) or ag_b.get(ag.id)
    ]

    # Topik: kunci dari pengelompokan masing-masing periode, lalu dihitung keanggotaannya di kedua periode.
    keys = {k for k, g in cluster_posts(a) if k != UNCLUSTERED_KEY and len(g) >= 2}
    keys |= {k for k, g in cluster_posts(b) if k != UNCLUSTERED_KEY and len(g) >= 2}
    topics = []
    for k in keys:
        ca, cb = count_key_in(a, k), count_key_in(b, k)
        status = "baru" if cb == 0 else "hilang" if ca == 0 else "naik" if ca > cb else "turun" if ca < cb else "tetap"
        topics.append(_delta_row(k, key_label(k), ca, cb, status=status))

    emo_a = {e["id"]: e for e in emotion_breakdown((p.emotions for p in a), len(a))}
    emo_b = {e["id"]: e for e in emotion_breakdown((p.emotions for p in b), len(b))}
    emotions = [
        {"id": eid, "label": EMOTION_LABELS[eid],
         "a_pct": emo_a.get(eid, {}).get("pct", 0.0), "b_pct": emo_b.get(eid, {}).get("pct", 0.0)}
        for eid in EMOTION_LABELS
        if eid in emo_a or eid in emo_b
    ]

    plat_a = Counter(p.platform for p in a)
    plat_b = Counter(p.platform for p in b)
    platforms = [_delta_row(n, n, plat_a.get(n, 0), plat_b.get(n, 0)) for n in sorted(set(plat_a) | set(plat_b))]

    by_delta = lambda r: (-abs(r["delta"]), -r["a"], r["label"])  # noqa: E731
    return {
        "scope_kode": scope_kode,
        "scope_name": _scope_display_name(scope_kode),
        "period_a": period_a.as_dict(),
        "period_b": period_b.as_dict(),
        "summary_a": summary(a),
        "summary_b": summary(b),
        "categories": sorted(categories, key=by_delta),
        "agencies": sorted(agencies, key=by_delta),
        "topics": sorted(topics, key=by_delta)[:30],
        "emotions": emotions,
        "platforms": sorted(platforms, key=by_delta),
        "note": None if ds_b.coverage_since and period_b.start >= ds_b.coverage_since else
            "Pengumpulan data dimulai di tengah atau setelah periode pembanding, jadi angka pembanding bisa lebih rendah dari kenyataan.",
    }


def _region_lookup() -> Dict[str, Dict[str, str]]:
    from backend.app.services.ai_analyzer import GAZETTEER_REGIONS

    by_name: Dict[str, Dict[str, str]] = {}
    for key, data in GAZETTEER_REGIONS.items():
        by_name.setdefault(key.lower(), data)
        by_name.setdefault(data["nama"].lower(), data)
    return by_name


def rollup_city(location: Optional[str], lookup: Optional[Dict[str, Dict[str, str]]] = None) -> Optional[str]:
    """Naikkan lokasi (kelurahan/kecamatan/kawasan) ke kota/kabupaten lewat rantai parent gazetir.

    Lokasi tingkat provinsi menjadi "<provinsi> (tingkat provinsi)". None bila tidak dikenali.
    """
    if not location:
        return None
    lookup = lookup or _region_lookup()
    node = lookup.get(location.lower())
    for _ in range(6):
        if node is None:
            return None
        if node["tingkat"] in ("kota", "kabupaten"):
            return node["nama"]
        if node["tingkat"] == "provinsi":
            return f"{node['nama']} (tingkat provinsi)"
        node = lookup.get(node["parent"].lower())
    return None


def get_region_category_heatmap(
    db: Session,
    time_range: str = "24h",
    scope_kode: str = "ID",
    scope_mode: str = "context",
    multi_codes: Optional[List[str]] = None,
    platform: Optional[str] = None,
    agency: Optional[str] = None,
) -> Dict[str, Any]:
    """Matriks kota/kabupaten x kategori: jumlah konten dan konten negatif per sel."""
    ds = _load_dataset(db, time_range, scope_kode, scope_mode, multi_codes, platform, None, agency)
    lookup = _region_lookup()
    cells: Dict[str, Dict[str, Dict[str, int]]] = defaultdict(lambda: defaultdict(lambda: {"count": 0, "negative": 0}))
    region_totals: Counter = Counter()
    region_neg: Counter = Counter()
    unlocated = 0
    for p in ds.current:
        region = rollup_city(p.location, lookup)
        if region is None:
            unlocated += 1
            continue
        region_totals[region] += 1
        neg = p.sentiment == "negatif"
        region_neg[region] += int(neg)
        for c in p.categories:
            cell = cells[region][c]
            cell["count"] += 1
            cell["negative"] += int(neg)

    col_totals: Counter = Counter()
    for region_cells in cells.values():
        for c, v in region_cells.items():
            col_totals[c] += v["count"]
    columns = [{"id": c, "label": category_label(c), "total": n} for c, n in col_totals.most_common()]
    rows = [
        {
            "region": r,
            "total": n,
            "negative": region_neg[r],
            "cells": {c: dict(v) for c, v in cells[r].items()},
        }
        for r, n in region_totals.most_common()
    ]
    return {
        "period": ds.period.as_dict(),
        "total": len(ds.current),
        "located": len(ds.current) - unlocated,
        "unlocated": unlocated,
        "max_cell": max((v["count"] for rc in cells.values() for v in rc.values()), default=0),
        "columns": columns,
        "rows": rows,
    }
