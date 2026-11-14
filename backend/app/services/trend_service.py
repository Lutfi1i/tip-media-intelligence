"""Data untuk menu Tren Sosial (docs/rencana-trend-intelligence.md).

Semua fungsi menerima filter global yang sama: periode ("today", "7d", "30d"), kode lokasi
Kemendagri ("ID", "32", "32.71"), dan platform ("Semua" atau nama platform). Angka
engagement hanya dihitung dari konten yang datanya tersedia; platform tanpa metrik
dilaporkan terpisah, bukan dianggap nol.
"""

from __future__ import annotations

import re
from collections import Counter, defaultdict
from datetime import datetime, timedelta
from typing import Any, Callable, Dict, Iterable, List, Optional, Sequence, Tuple

from sqlalchemy.orm import Session

from backend.app.models import RawItem
from backend.app.services.geo_hierarchy import KABUPATEN_DATA, PROVINCES_DATA, match_regions
from backend.app.services.social_platform import NEWS
from backend.app.services.social_pulse_service import (
    MIN_SURGE_VOLUME,
    WIB,
    _build_trends,
    _filter_items_by_scope,
    _history_counts,
    _load_dataset,
    _region_lookup,
    _scope_display_name,
    _sentiment_pct,
    _timeline,
    rollup_city,
)
from backend.app.services.social_taxonomy import category_label
from backend.app.services.social_topics import SocialPost, engagement_summary, key_label, velocity

TREND_PERIODS = ("today", "7d", "30d")
RISING = ("LONJAKAN TINGGI", "MENINGKAT")
EARLY = ("LONJAKAN TINGGI", "MENINGKAT", "BARU")

# Bagian halaman Tren Wilayah: (id, judul, kategori, hanya sentimen tertentu).
REGION_SECTIONS: List[Tuple[str, str, set, Optional[str]]] = [
    ("kuliner", "Kuliner yang sedang populer", {"kuliner"}, None),
    ("tempat", "Tempat dan event yang ramai", {"wisata", "hiburan"}, None),
    ("keluhan", "Keluhan masyarakat", {"layanan", "air", "energi", "transportasi", "lingkungan", "infrastruktur", "kesehatan", "perumahan"}, "negatif"),
    ("komunitas", "Topik komunitas", {"agama", "olahraga", "pendidikan", "teknologi"}, None),
]


def _platform_arg(platform: Optional[str]) -> Optional[str]:
    return None if platform in (None, "", "Semua") else platform


def _dataset(db: Session, periode: str, lokasi: str, platform: Optional[str], category: Optional[str] = None):
    return _load_dataset(db, periode, lokasi or "ID", "context", None, _platform_arg(platform), category, None)


def _post_brief(p: SocialPost) -> Dict[str, Any]:
    return {
        "id": p.id,
        "judul": p.title,
        "url": p.url,
        "platform": p.platform,
        "penulis": p.author,
        "published_at": p.published_at.isoformat(),
        "sentimen": p.sentiment,
        "views": p.views,
        "interaksi": p.interactions,
    }


def _reach(p: SocialPost) -> Tuple[int, int, datetime]:
    return (p.interactions or 0, p.views or 0, p.published_at)


def _children(lokasi: str) -> List[Dict[str, str]]:
    """Wilayah satu tingkat di bawah lokasi: provinsi untuk Indonesia, kota/kab untuk provinsi."""
    if lokasi == "ID":
        return [{"kode": p["kode"], "nama": p["nama"]} for p in PROVINCES_DATA]
    if len(lokasi) == 2:
        return [{"kode": k["kode"], "nama": k["nama"]} for k in KABUPATEN_DATA if k["provinsi_kode"] == lokasi]
    return []


def _child_counts(lokasi: str, posts: Sequence[SocialPost]) -> List[Dict[str, Any]]:
    children = _children(lokasi)
    if not children:
        return []
    counts: Counter = Counter()
    negative: Counter = Counter()
    for p in posts:
        provs, kabs = match_regions(f"{p.title} {p.text}")
        codes = provs if lokasi == "ID" else {k for k in kabs if k.startswith(f"{lokasi}.")}
        for c in codes:
            counts[c] += 1
            negative[c] += int(p.sentiment == "negatif")
    rows = [{**c, "postingan": counts[c["kode"]], "negatif": negative[c["kode"]]} for c in children if counts[c["kode"]]]
    rows.sort(key=lambda r: (-r["postingan"], r["nama"]))
    return rows


MIN_KEY_SOURCES = 2


def _source_id(p: SocialPost) -> str:
    """Akun, atau penerbit bila akun tidak tersedia. Dipakai untuk menyaring frasa dari satu bot."""
    return (p.author or p.publisher or f"{p.platform}:{p.id}").strip().lower()


def _top_keys(posts: Iterable[SocialPost], limit: int, prefixes: Tuple[str, ...] = ("#", "p:")) -> List[Dict[str, Any]]:
    """Hashtag/frasa terbanyak yang dipakai minimal dua sumber berbeda.

    Kanal otomatis (mis. peringatan cuaca) mengulang template yang sama; frasa template itu
    bukan percakapan publik dan tidak boleh muncul sebagai kata yang sedang ramai.
    """
    counter: Counter = Counter()
    sources: Dict[str, set] = defaultdict(set)
    for p in posts:
        for k in p.keys:
            if k.startswith(prefixes):
                counter[k] += 1
                sources[k].add(_source_id(p))
    rows = [
        {"key": k, "label": key_label(k), "jumlah": n, "sumber": len(sources[k])}
        for k, n in counter.most_common()
        if len(sources[k]) >= MIN_KEY_SOURCES
    ]
    return rows[:limit]


def _activity(ds, posts: Sequence[SocialPost]) -> Dict[str, Any]:
    return {
        "postingan": len(posts),
        "akun_unik": len({p.author.strip().lower() for p in posts if p.author}),
        "sentimen_pct": _sentiment_pct(posts) if posts else {},
        "platform": dict(Counter(p.platform for p in posts).most_common()),
        "engagement": engagement_summary(posts),
        "timeline": _timeline(ds, posts),
    }


def _baseline(ds) -> Dict[str, Any]:
    return {"tersedia": len(ds.covered_windows), "target": ds.period.n_windows}


# ---------------------------------------------------------------------------
# 2. Tren Wilayah
# ---------------------------------------------------------------------------

def get_region_trends(db: Session, periode: str, lokasi: str, platform: Optional[str]) -> Dict[str, Any]:
    ds = _dataset(db, periode, lokasi, platform)
    posts = ds.current
    trends = _build_trends(db, ds, periode, "volume")

    sections = []
    for sid, title, cats, sentiment in REGION_SECTIONS:
        matched = [p for p in posts if cats & set(p.categories) and (sentiment is None or p.sentiment == sentiment)]
        sections.append({
            "id": sid,
            "judul": title,
            "postingan": len(matched),
            "kata_kunci": _top_keys(matched, 6),
            "contoh": [_post_brief(p) for p in sorted(matched, key=_reach, reverse=True)[:4]],
        })

    return {
        "periode": ds.period.as_dict(),
        "lokasi": {"kode": lokasi, "nama": _scope_display_name(lokasi)},
        "aktivitas": _activity(ds, posts),
        "baseline": _baseline(ds),
        "top_tren": [
            {
                "topic_key": t["topic_key"],
                "topik": t["topic"],
                "kategori": t["categories"][0]["label"] if t["categories"] else "Lainnya",
                "postingan": t["mention_count"],
                "status": t["velocity_status"],
                "pertumbuhan_pct": t["growth_pct"],
                "platform": t["platforms"][:4],
                "hashtag": t["hashtags"][:3],
            }
            for t in trends[:10]
        ],
        "bagian": sections,
        "berita": _region_news(db, ds, lokasi),
        "sub_wilayah": _child_counts(lokasi, posts),
    }


def _region_news(db: Session, ds, lokasi: str, limit: int = 6) -> List[Dict[str, Any]]:
    items = (
        db.query(RawItem)
        .filter(RawItem.platform == NEWS, RawItem.published_at >= ds.period.start, RawItem.published_at < ds.period.end)
        .order_by(RawItem.published_at.desc())
        .limit(400)
        .all()
    )
    if lokasi and lokasi != "ID":
        # Saring cepat dengan indeks wilayah sebelum klasifikasi konteks yang lebih mahal.
        want = lokasi
        items = [
            it for it in items
            if (lambda pk: want in pk[0] or want in pk[1])(match_regions(f"{it.judul} {it.isi or ''}"))
        ]
    scoped = [it for it, *_ in _filter_items_by_scope(items, lokasi or "ID", "context")]
    return [
        {"id": it.id, "judul": it.judul, "url": it.url_kanonik, "penerbit": it.penerbit, "published_at": it.published_at.isoformat()}
        for it in scoped[:limit]
    ]


# ---------------------------------------------------------------------------
# 3. Live Social Monitoring
# ---------------------------------------------------------------------------

def get_live_stats(db: Session, periode: str, lokasi: str, platform: Optional[str]) -> Dict[str, Any]:
    ds = _dataset(db, periode, lokasi, platform)
    posts = ds.current
    lookup = _region_lookup()
    locations = Counter(c for c in (rollup_city(p.location, lookup) for p in posts) if c)
    trends = _build_trends(db, ds, periode, "laju")
    top = trends[0] if trends else None
    highlight = None
    if top:
        where = top["locations"][0] if top["locations"] else None
        highlight = {
            "topik": top["topic"],
            "postingan": top["mention_count"],
            "lokasi": where,
            "sentimen_negatif_pct": top["sentiment_pct"].get("negatif", 0),
        }
    return {
        "periode": ds.period.as_dict(),
        "aktivitas": _activity(ds, posts),
        "sentimen": dict(Counter(p.sentiment for p in posts)),
        "kata_teratas": _top_keys(posts, 24),
        "lokasi_teratas": [{"nama": n.replace(" (tingkat provinsi)", ""), "postingan": c} for n, c in locations.most_common(8)],
        "lokasi_terdeteksi": sum(locations.values()),
        "sorotan": highlight,
    }


# ---------------------------------------------------------------------------
# 5. Hashtag & Keyword
# ---------------------------------------------------------------------------

def _key_rows(ds, prefix: str, limit: int) -> List[Dict[str, Any]]:
    counts: Counter = Counter(k for p in ds.current for k in p.keys if k.startswith(prefix))
    authors: Dict[str, set] = defaultdict(set)
    sources: Dict[str, set] = defaultdict(set)
    platforms: Dict[str, Counter] = defaultdict(Counter)
    for p in ds.current:
        for k in p.keys:
            if k.startswith(prefix):
                if p.author:
                    authors[k].add(p.author.strip().lower())
                sources[k].add(_source_id(p))
                platforms[k][p.platform] += 1
    rows = []
    # Kata dari banyak sumber didahulukan; kata dari satu sumber tetap ditampilkan (wilayah kecil
    # sering hanya punya itu) tetapi ditandai agar tidak dibaca sebagai tren yang menyebar.
    ranked = sorted(counts.items(), key=lambda kv: (len(sources[kv[0]]) < MIN_KEY_SOURCES, -kv[1], kv[0]))
    for k, n in ranked[:limit]:
        vel = velocity(n, _history_counts(ds, lambda p, k=k: k in p.keys), MIN_SURGE_VOLUME)
        rows.append({
            "key": k,
            "label": key_label(k),
            "jumlah": n,
            "akun": len(authors[k]),
            "sumber": len(sources[k]),
            "platform": [name for name, _ in platforms[k].most_common(3)],
            "status": vel["status"],
            "pertumbuhan_pct": vel["growth_pct"],
            "skor_laju": vel["score"],
        })
    return rows


def get_hashtag_keywords(db: Session, periode: str, lokasi: str, platform: Optional[str]) -> Dict[str, Any]:
    ds = _dataset(db, periode, lokasi, platform)
    hashtags = _key_rows(ds, "#", 30)
    keywords = _key_rows(ds, "p:", 30)
    rising = sorted(
        [r for r in hashtags + keywords if r["status"] in EARLY and r["sumber"] >= MIN_KEY_SOURCES],
        key=lambda r: (-r["skor_laju"], -r["jumlah"]),
    )[:12]

    lokal: List[Dict[str, Any]] = []
    if lokasi and lokasi != "ID" and ds.current:
        # Keyword lokal: porsinya di lokasi ini jauh lebih besar daripada porsinya secara nasional.
        national = _dataset(db, periode, "ID", platform)
        nat_counts: Counter = Counter(k for p in national.current for k in p.keys if k.startswith(("#", "p:")))
        n_local, n_nat = len(ds.current), max(1, len(national.current))
        for r in hashtags + keywords:
            nat = max(nat_counts.get(r["key"], 0), r["jumlah"])
            share_local = r["jumlah"] / n_local
            share_nat = nat / n_nat
            # Porsi lokal: berapa persen kemunculan nasional berasal dari lokasi ini.
            if r["jumlah"] >= 2 and share_local / share_nat >= 2:
                lokal.append({**r, "porsi_lokal_pct": round(r["jumlah"] / nat * 100)})
        lokal.sort(key=lambda r: (r["sumber"] < MIN_KEY_SOURCES, -r["porsi_lokal_pct"], -r["jumlah"]))
        lokal = lokal[:12]

    return {
        "periode": ds.period.as_dict(),
        "postingan": len(ds.current),
        "baseline": _baseline(ds),
        "hashtag": hashtags,
        "keyword": keywords,
        "mulai_naik": rising,
        "lokal": lokal,
    }


def _key_matcher(key: str) -> Callable[[SocialPost], bool]:
    """'#tag' dan 'p:frasa' dicocokkan ke kunci topik; teks bebas dicocokkan ke isi konten."""
    if key.startswith(("#", "p:", "k:")):
        return lambda p: key in p.keys
    needle = key.lower().strip()
    pattern = re.compile(rf"(?<![a-z0-9]){re.escape(needle)}(?![a-z0-9])")
    return lambda p: bool(pattern.search(f"{p.title} {p.text}".lower()))


def get_key_history(db: Session, keys: List[str], lokasi: str, platform: Optional[str], days: int = 30) -> Dict[str, Any]:
    """Jumlah konten per hari (WIB) untuk beberapa hashtag/keyword, untuk grafik perbandingan."""
    ds = _dataset(db, "30d", lokasi, platform)
    today = (datetime.utcnow() + WIB).date()
    dates = [today - timedelta(days=days - 1 - i) for i in range(days)]
    series = []
    for key in keys[:5]:
        match = _key_matcher(key)
        per_day: Counter = Counter((p.published_at + WIB).date() for p in ds.current if match(p))
        series.append({
            "key": key,
            "label": key_label(key) if key.startswith(("#", "p:", "k:")) else key,
            "total": sum(per_day.values()),
            "harian": [per_day.get(d, 0) for d in dates],
        })
    return {"tanggal": [d.isoformat() for d in dates], "seri": series}


# ---------------------------------------------------------------------------
# 4. Konten Viral
# ---------------------------------------------------------------------------

_MEDIA_RULES: List[Tuple[re.Pattern, str]] = [
    (re.compile(r"youtube\.com/shorts/|tiktok\.com/.+/video/|instagram\.com/reels?/"), "Video pendek"),
    (re.compile(r"youtube\.com/watch|youtu\.be/"), "Video"),
    (re.compile(r"instagram\.com/p/"), "Foto"),
]


def media_type(url: Optional[str], platform: str) -> str:
    for pattern, label in _MEDIA_RULES:
        if url and pattern.search(url):
            return label
    if platform == "TikTok":
        return "Video pendek"
    if platform == "YouTube":
        return "Video"
    return "Postingan"


VIRAL_SORTS = ("interaksi", "views", "laju")


def get_viral_content(
    db: Session,
    periode: str,
    lokasi: str,
    platform: Optional[str],
    kategori: Optional[str] = None,
    sort: str = "interaksi",
    limit: int = 30,
) -> Dict[str, Any]:
    ds = _dataset(db, periode, lokasi, platform, kategori)
    now = datetime.utcnow()
    with_metrics, without = [], Counter()
    for p in ds.current:
        if p.interactions is None and p.views is None:
            without[p.platform] += 1
            continue
        hours = max(1.0, (now - p.published_at).total_seconds() / 3600)
        with_metrics.append({
            **_post_brief(p),
            "isi": p.text[:220] + ("..." if len(p.text) > 220 else ""),
            "jenis": media_type(p.url, p.platform),
            "likes": p.likes,
            "komentar": p.replies,
            "shares": p.shares,
            "followers": p.followers,
            "kategori": [category_label(c) for c in p.categories if c != "lainnya"][:2],
            # Laju = interaksi (atau views bila interaksi tidak ada) per jam sejak diunggah.
            "laju_per_jam": round((p.interactions if p.interactions is not None else p.views or 0) / hours, 1),
        })
    key = {
        "views": lambda r: (r["views"] or 0, r["interaksi"] or 0),
        "laju": lambda r: (r["laju_per_jam"], r["interaksi"] or 0),
    }.get(sort, lambda r: (r["interaksi"] or 0, r["views"] or 0))
    with_metrics.sort(key=key, reverse=True)
    return {
        "periode": ds.period.as_dict(),
        "total_postingan": len(ds.current),
        "dengan_metrik": len(with_metrics),
        "tanpa_metrik": dict(without.most_common()),
        "konten": with_metrics[:limit],
    }


# ---------------------------------------------------------------------------
# 6. Influencer & Akun Populer
# ---------------------------------------------------------------------------

ACCOUNT_SORTS = ("followers", "views", "engagement", "postingan", "pertumbuhan")


def get_accounts(db: Session, periode: str, lokasi: str, platform: Optional[str], sort: str = "views", limit: int = 40) -> Dict[str, Any]:
    ds = _dataset(db, periode, lokasi, platform)
    lookup = _region_lookup()
    groups: Dict[str, List[SocialPost]] = defaultdict(list)
    for p in ds.current:
        if p.author:
            groups[p.author.strip().lower()].append(p)

    rows = []
    for posts in groups.values():
        posts.sort(key=lambda p: p.published_at)
        views = [p.views for p in posts if p.views is not None]
        inter = [p.interactions for p in posts if p.interactions is not None]
        foll = [(p.published_at, p.followers) for p in posts if p.followers is not None]
        views_total = sum(views) if views else None
        inter_total = sum(inter) if inter else None
        followers = foll[-1][1] if foll else None
        # Pertumbuhan followers hanya bila akun teramati minimal dua kali dengan angka berbeda waktu.
        growth = foll[-1][1] - foll[0][1] if len(foll) >= 2 and foll[-1][0] > foll[0][0] else None
        if inter_total is not None and views_total:
            er = round(inter_total / views_total * 100, 2)
        elif inter_total is not None and followers:
            er = round(inter_total / len(inter) / followers * 100, 2)
        else:
            er = None
        cats = Counter(c for p in posts for c in p.categories if c != "lainnya")
        locs = Counter(c for c in (rollup_city(p.location, lookup) for p in posts) if c)
        rows.append({
            "akun": posts[-1].author.strip(),
            "platform": [n for n, _ in Counter(p.platform for p in posts).most_common()],
            "postingan": len(posts),
            "followers": followers,
            "pertumbuhan_followers": growth,
            "total_views": views_total,
            "rata_views": round(views_total / len(views)) if views else None,
            "total_interaksi": inter_total,
            "engagement_rate_pct": er,
            "kategori": [category_label(c) for c, _ in cats.most_common(2)],
            "wilayah": locs.most_common(1)[0][0].replace(" (tingkat provinsi)", "") if locs else None,
            "contoh_url": posts[-1].url,
        })

    sort_key = {
        "followers": lambda r: r["followers"] or -1,
        "engagement": lambda r: r["engagement_rate_pct"] if r["engagement_rate_pct"] is not None else -1,
        "postingan": lambda r: r["postingan"],
        "pertumbuhan": lambda r: r["pertumbuhan_followers"] if r["pertumbuhan_followers"] is not None else -1,
    }.get(sort, lambda r: r["total_views"] or -1)
    rows.sort(key=lambda r: (sort_key(r), r["postingan"]), reverse=True)

    per_platform: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for r in sorted(rows, key=lambda r: (r["total_views"] or 0, r["total_interaksi"] or 0, r["postingan"]), reverse=True):
        main = r["platform"][0]
        if len(per_platform[main]) < 3:
            per_platform[main].append(r)

    return {
        "periode": ds.period.as_dict(),
        "total_postingan": len(ds.current),
        "postingan_dengan_akun": sum(len(v) for v in groups.values()),
        "akun_dengan_metrik": sum(1 for r in rows if r["followers"] is not None or r["total_views"] is not None),
        "akun": rows[:limit],
        "teratas_per_platform": dict(per_platform),
    }


# ---------------------------------------------------------------------------
# 8. Laporan & Insight
# ---------------------------------------------------------------------------

def get_report_data(db: Session, periode: str, lokasi: str, platform: Optional[str]) -> Dict[str, Any]:
    ds = _dataset(db, periode, lokasi, platform)
    posts = ds.current
    trends = _build_trends(db, ds, periode, "volume")

    by_platform: Dict[str, List[SocialPost]] = defaultdict(list)
    for p in posts:
        by_platform[p.platform].append(p)
    platform_rows = []
    for name, ps in sorted(by_platform.items(), key=lambda kv: -len(kv[1])):
        eng = engagement_summary(ps)
        platform_rows.append({
            "platform": name,
            "postingan": len(ps),
            "akun": len({p.author.strip().lower() for p in ps if p.author}),
            "interaksi": eng.get("interactions"),
            "views": eng.get("views"),
            "negatif_pct": _sentiment_pct(ps).get("negatif", 0),
        })

    days = {"today": 1, "7d": 7, "30d": 30}.get(periode, 7)
    today = (datetime.utcnow() + WIB).date()
    dates = [today - timedelta(days=days - 1 - i) for i in range(days)]
    per_day: Counter = Counter((p.published_at + WIB).date() for p in posts)

    return {
        "periode": ds.period.as_dict(),
        "lokasi": {"kode": lokasi, "nama": _scope_display_name(lokasi)},
        "platform_filter": platform or "Semua",
        "ringkasan": {
            "postingan": len(posts),
            "akun_unik": len({p.author.strip().lower() for p in posts if p.author}),
            "tren": len(trends),
            "tren_naik": sum(1 for t in trends if t["velocity_status"] in RISING),
            "sentimen_pct": _sentiment_pct(posts) if posts else {},
            "engagement": engagement_summary(posts),
        },
        "baseline": _baseline(ds),
        "topik": [
            {
                "topik": t["topic"],
                "kategori": t["categories"][0]["label"] if t["categories"] else "Lainnya",
                "postingan": t["mention_count"],
                "status": t["velocity_status"],
                "pertumbuhan_pct": t["growth_pct"],
                "negatif_pct": t["sentiment_pct"].get("negatif", 0),
                "hashtag": t["hashtags"][:3],
            }
            for t in trends[:15]
        ],
        "platform": platform_rows,
        "wilayah": _child_counts(lokasi, posts),
        "harian": [{"tanggal": d.isoformat(), "postingan": per_day.get(d, 0)} for d in dates],
        "hashtag": _top_keys(posts, 15, ("#",)),
        "keyword": _top_keys(posts, 15, ("p:",)),
    }
