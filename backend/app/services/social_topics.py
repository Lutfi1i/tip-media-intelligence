"""Ekstraksi topik, analisis akun, dan deteksi amplifikasi untuk konten media sosial.

Semua fungsi di sini murni (tanpa akses database) agar mudah diuji. Masukan berupa
`SocialPost`, ringkasan satu RawItem beserta hasil analisisnya.
"""

from __future__ import annotations

import math
import re
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, Iterable, List, Optional, Sequence, Set, Tuple

from backend.app.services.dedup import get_shingles, jaccard_similarity
from backend.app.services.social_taxonomy import UNCATEGORIZED, classify
from backend.app.services.social_taxonomy import category_label as taxonomy_label


@dataclass
class SocialPost:
    id: int
    text: str
    title: str
    platform: str
    published_at: datetime
    author: Optional[str] = None
    sentiment: str = "netral"
    topic: Optional[str] = None
    location: Optional[str] = None
    url: Optional[str] = None
    publisher: Optional[str] = None
    likes: Optional[int] = None
    shares: Optional[int] = None
    replies: Optional[int] = None
    views: Optional[int] = None
    followers: Optional[int] = None
    keys: Set[str] = field(default_factory=set)
    categories: List[str] = field(default_factory=list)
    agencies: List[str] = field(default_factory=list)
    emotions: List[str] = field(default_factory=list)

    @property
    def interactions(self) -> Optional[int]:
        parts = [v for v in (self.likes, self.shares, self.replies) if v is not None]
        return sum(parts) if parts else None


# Kata fungsi bahasa Indonesia, kata umum media sosial, dan kata yang muncul di hampir
# semua konten karena menjadi bagian query pengumpulan.
STOPWORDS = set(
    """
    yang dan di ke dari untuk dengan pada ini itu adalah akan juga tidak sudah belum masih
    atau karena oleh dalam sebagai bisa ada telah saat agar dapat lebih para sangat hanya
    kami kita mereka saya aku kamu anda dia ia nya pun lah kah tak gak nggak enggak udah
    aja saja banget sih dong deh kok jadi buat bikin sama lagi baru mau ingin harus perlu
    namun tapi serta hingga sampai sejak antara setelah sebelum ketika bila jika kalau maka
    secara terhadap tentang seperti sebuah seorang beberapa banyak semua setiap tiap salah
    satu dua tiga hari ini kemarin besok pagi siang sore malam tadi nanti kini sedang
    tahun bulan minggu jam wib wita wit pukul tanggal
    the and for with from that this are was you your our not but all can has have
    via cek klik link bio selengkapnya baca simak video foto berita terkini terbaru update
    threads instagram tiktok youtube twitter facebook bluesky post posts postingan reels
    on com www http https net
    jangan lupa subscribe like share komen comment lonceng notifikasi aktifkan follow ikuti
    dukung channel kanal tonton nonton saksikan streaming breaking news official
    januari februari maret april mei juni juli agustus september oktober november desember
    sumber dok foto
    """.split()
)
# Nama bulan dan "sumber"/"dok"/"foto": pola tanggal dan kredit berita ("12 November. Sumber: ...")
# bukan topik percakapan.
# Kelompok terakhir: ajakan baku di deskripsi YouTube/siaran ("jangan lupa subscribe dan
# aktifkan lonceng notifikasi", "breaking news"). Tanpa ini frasanya terbaca sebagai tren.

# Nama wilayah yang menjadi bagian query pengumpulan: tidak membedakan topik bila berdiri sendiri.
GENERIC_PLACES = {"jakarta", "bogor", "depok", "tangerang", "bekasi", "indonesia", "jabodetabek", "dki"}

_URL_RE = re.compile(r"https?://\S+|www\.\S+")
_HASHTAG_RE = re.compile(r"#([A-Za-z0-9_]{3,40})")
_MENTION_RE = re.compile(r"@[A-Za-z0-9_.]+")
_WORD_RE = re.compile(r"[a-z][a-z0-9]{2,}")

MIN_TOPIC_SUPPORT = 2  # sebuah kunci baru dianggap topik bila muncul di >= 2 konten berbeda


def normalize_hashtag(tag: str) -> str:
    return "#" + tag.lower().strip("#")


def tokenize(text: str) -> List[str]:
    """Token kata bermakna (huruf kecil), tanpa URL, mention, hashtag, dan stopword."""
    cleaned = _URL_RE.sub(" ", text or "")
    cleaned = _MENTION_RE.sub(" ", cleaned)
    cleaned = _HASHTAG_RE.sub(" ", cleaned)
    words = _WORD_RE.findall(cleaned.lower())
    return [w for w in words if w not in STOPWORDS and not w.isdigit()]


def category_label(text: str) -> Optional[str]:
    """Label kategori utama dari taksonomi medsos (sama dengan label filter kategori)."""
    cats, _ = classify(text)
    return taxonomy_label(cats[0]) if cats and cats[0] != UNCATEGORIZED else None


_REGION_PHRASES: Optional[Set[str]] = None


def _region_phrases() -> Set[str]:
    """Nama provinsi dan kota/kabupaten dua kata, huruf kecil (dimuat sekali)."""
    global _REGION_PHRASES
    if _REGION_PHRASES is None:
        from backend.app.services.geo_hierarchy import KABUPATEN_DATA, PROVINCES_DATA, short_region_name

        names = [p["nama"].lower() for p in PROVINCES_DATA] + [short_region_name(k["nama"]) for k in KABUPATEN_DATA]
        _REGION_PHRASES = {n for n in names if len(n.split()) == 2}
    return _REGION_PHRASES


def extract_keys(text: str, analysis_topic: Optional[str] = None) -> Set[str]:
    """Kunci kandidat topik untuk satu konten.

    - `#tag`        hashtag yang dinormalisasi
    - `p:kata kata` frasa dua kata berurutan (tanpa stopword), bukan gabungan dua nama wilayah umum
    - `k:Label`     kategori utama dari taksonomi medsos (social_taxonomy)

    `analysis_topic` tidak lagi dipakai sebagai kunci agar label kategori topik sama
    dengan label filter kategori; parameter dipertahankan untuk kompatibilitas pemanggil.
    """
    keys: Set[str] = set()
    for tag in _HASHTAG_RE.findall(text or ""):
        keys.add(normalize_hashtag(tag))

    tokens = tokenize(text)
    region_phrases = _region_phrases()
    for a, b in zip(tokens, tokens[1:]):
        if a == b or (a in GENERIC_PLACES and b in GENERIC_PLACES):
            continue
        phrase = f"{a} {b}"
        # Nama wilayah ("jawa barat", "jakarta selatan") bukan topik; lokasi ditangani filter wilayah.
        if phrase in region_phrases:
            continue
        keys.add(f"p:{phrase}")

    label = category_label(text)
    if label:
        keys.add(f"k:{label}")
    return keys


def key_label(key: str) -> str:
    if key.startswith("#"):
        return key
    if key.startswith("p:"):
        return key[2:].title()
    if key.startswith("k:"):
        return key[2:]
    return key


_KEY_PRIORITY = {"#": 3, "p": 2, "k": 1}


def _priority(key: str) -> int:
    return _KEY_PRIORITY.get(key[0], 0)


def cluster_posts(posts: Sequence[SocialPost]) -> List[Tuple[str, List[SocialPost]]]:
    """Kelompokkan konten ke topik secara greedy.

    Kunci diurutkan berdasarkan jumlah konten pendukung, lalu jenis (hashtag > frasa >
    kategori). Setiap konten masuk ke kunci pertama yang dimilikinya. Konten tanpa kunci
    yang didukung >= MIN_TOPIC_SUPPORT konten masuk ke kategori atau "Lainnya".
    """
    support: Counter = Counter()
    for p in posts:
        for k in p.keys:
            support[k] += 1

    ranked = sorted(
        (k for k, n in support.items() if n >= MIN_TOPIC_SUPPORT),
        key=lambda k: (-support[k], -_priority(k), k),
    )

    groups: Dict[str, List[SocialPost]] = defaultdict(list)
    assigned: Set[int] = set()
    for key in ranked:
        for p in posts:
            if p.id in assigned or key not in p.keys:
                continue
            groups[key].append(p)
            assigned.add(p.id)

    for p in posts:
        if p.id in assigned:
            continue
        cat = next((k for k in sorted(p.keys) if k.startswith("k:")), None)
        groups[cat or "k:Lainnya"].append(p)
        assigned.add(p.id)

    # Kunci yang hanya kebagian satu konten setelah greedy digabung ke kategorinya,
    # agar daftar tren tidak penuh topik satu-konten yang tumpang tindih.
    merged: Dict[str, List[SocialPost]] = defaultdict(list)
    for key, items in groups.items():
        if len(items) == 1 and not key.startswith("k:"):
            cat = next((k for k in sorted(items[0].keys) if k.startswith("k:")), "k:Lainnya")
            merged[cat].extend(items)
        else:
            merged[key].extend(items)

    return sorted(merged.items(), key=lambda kv: (-len(kv[1]), kv[0]))


def count_key_in(posts: Iterable[SocialPost], key: str) -> int:
    return sum(1 for p in posts if key in p.keys)


def top_hashtags(posts: Sequence[SocialPost], limit: int = 3) -> List[str]:
    counter: Counter = Counter()
    for p in posts:
        for tag in _HASHTAG_RE.findall(p.text):
            counter[normalize_hashtag(tag)] += 1
    return [t for t, _ in counter.most_common(limit)]


def top_phrases(posts: Sequence[SocialPost], exclude: Optional[str] = None, limit: int = 3) -> List[str]:
    counter: Counter = Counter()
    for p in posts:
        for k in p.keys:
            if k.startswith("p:") and k != exclude:
                counter[k] += 1
    return [key_label(k) for k, n in counter.most_common(limit) if n >= MIN_TOPIC_SUPPORT]


def account_analysis(posts: Sequence[SocialPost], limit: int = 5) -> Dict[str, object]:
    """Akun paling aktif dan tingkat konsentrasi percakapan pada sedikit akun."""
    with_author = [p for p in posts if p.author]
    per_author: Dict[str, Dict[str, object]] = {}
    for p in with_author:
        handle = p.author.strip()
        row = per_author.setdefault(
            handle.lower(),
            {"handle": handle, "posts": 0, "platforms": set(), "followers": None, "interactions": 0, "has_interactions": False},
        )
        row["posts"] = int(row["posts"]) + 1
        row["platforms"].add(p.platform)
        if p.followers is not None:
            row["followers"] = max(int(row["followers"] or 0), p.followers)
        if p.interactions is not None:
            row["interactions"] = int(row["interactions"]) + p.interactions
            row["has_interactions"] = True

    ranked = sorted(per_author.values(), key=lambda r: (-int(r["posts"]), -int(r["interactions"])))
    top = [
        {
            "handle": r["handle"],
            "posts": r["posts"],
            "platforms": sorted(r["platforms"]),
            "followers": r["followers"],
            "interactions": r["interactions"] if r["has_interactions"] else None,
        }
        for r in ranked[:limit]
    ]

    n_known = len(with_author)
    concentration = round(int(ranked[0]["posts"]) / n_known * 100, 1) if ranked else None
    # Indeks Herfindahl-Hirschman (0-10000): makin tinggi, makin terpusat pada sedikit akun.
    hhi = round(sum((int(r["posts"]) / n_known * 100) ** 2 for r in ranked)) if ranked else None

    return {
        "unique_accounts": len(per_author),
        "author_coverage_pct": round(n_known / len(posts) * 100, 1) if posts else 0.0,
        "top_accounts": top,
        "top_account_share_pct": concentration,
        "concentration_hhi": hhi,
    }


COORDINATION_SIMILARITY = 0.8
COORDINATION_MIN_ACCOUNTS = 3
COORDINATION_WINDOW_MINUTES = 120


def detect_coordination(posts: Sequence[SocialPost]) -> Dict[str, object]:
    """Cari kelompok teks hampir identik (Jaccard 3-gram >= 0.8) dari banyak akun dalam waktu berdekatan.

    Tanda ini hanya indikasi untuk diperiksa analis: teks kembar juga bisa berasal dari
    siaran resmi yang dikutip ulang. Konten tanpa nama akun tidak dihitung sebagai akun berbeda.
    """
    candidates = [p for p in posts if len(tokenize(p.text)) >= 5]
    shingles = {p.id: get_shingles(p.text) for p in candidates}
    parent = {p.id: p.id for p in candidates}

    def find(x: int) -> int:
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    for i, a in enumerate(candidates):
        for b in candidates[i + 1:]:
            if jaccard_similarity(shingles[a.id], shingles[b.id]) >= COORDINATION_SIMILARITY:
                parent[find(a.id)] = find(b.id)

    clusters: Dict[int, List[SocialPost]] = defaultdict(list)
    for p in candidates:
        clusters[find(p.id)].append(p)

    found = []
    for members in clusters.values():
        if len(members) < 2:
            continue
        accounts = {m.author.lower() for m in members if m.author}
        times = sorted(m.published_at for m in members)
        span_min = round((times[-1] - times[0]).total_seconds() / 60)
        flagged = len(accounts) >= COORDINATION_MIN_ACCOUNTS and span_min <= COORDINATION_WINDOW_MINUTES
        found.append(
            {
                "posts": len(members),
                "distinct_accounts": len(accounts),
                "span_minutes": span_min,
                "flagged": flagged,
                "sample_text": members[0].text[:200],
                "accounts": sorted({m.author for m in members if m.author})[:8],
            }
        )

    found.sort(key=lambda c: (not c["flagged"], -c["posts"]))
    duplicated_posts = sum(c["posts"] for c in found)
    return {
        "flagged": any(c["flagged"] for c in found),
        "duplicate_share_pct": round(duplicated_posts / len(posts) * 100, 1) if posts else 0.0,
        "clusters": found[:5],
    }


def engagement_summary(posts: Sequence[SocialPost]) -> Dict[str, object]:
    """Jumlah interaksi dari konten yang datanya tersedia. `coverage` menyatakan berapa konten yang punya data."""
    with_data = [p for p in posts if p.interactions is not None or p.views is not None]

    def total(attr: str) -> Optional[int]:
        # Null bila tidak ada satu pun konten yang punya angka ini (mis. Telegram hanya punya views).
        known = [getattr(p, attr) for p in with_data if getattr(p, attr) is not None]
        return sum(known) if known else None

    likes, shares, replies = total("likes"), total("shares"), total("replies")
    parts = [v for v in (likes, shares, replies) if v is not None]
    return {
        "posts_with_data": len(with_data),
        "coverage_pct": round(len(with_data) / len(posts) * 100, 1) if posts else 0.0,
        "likes": likes,
        "shares": shares,
        "replies": replies,
        "views": total("views"),
        "interactions": sum(parts) if parts else None,
    }


def propagation(posts: Sequence[SocialPost]) -> Dict[str, object]:
    """Urutan platform menurut konten pertama yang memuat topik ini.

    Waktu memakai `published_at` yang dicatat sumber. Konten yang terlambat dikumpulkan
    tidak mengubah urutan, tetapi platform tanpa sumber aktif tidak akan pernah muncul,
    jadi platform pertama di sini adalah yang pertama terpantau, belum tentu asal sebenarnya.
    """
    by_platform: Dict[str, List[SocialPost]] = {}
    for p in posts:
        by_platform.setdefault(p.platform, []).append(p)

    firsts = sorted(
        ((name, min(group, key=lambda p: (p.published_at, p.id)), len(group)) for name, group in by_platform.items()),
        key=lambda row: (row[1].published_at, row[1].id),
    )
    if not firsts:
        return {"origin": None, "span_minutes": None, "steps": []}

    origin_at = firsts[0][1].published_at
    steps = [
        {
            "platform": name,
            "first_at": first.published_at.isoformat(),
            "lag_minutes": round((first.published_at - origin_at).total_seconds() / 60),
            "posts": count,
            "first_author": first.author,
            "first_url": first.url,
        }
        for name, first, count in firsts
    ]
    return {
        "origin": steps[0]["platform"],
        "span_minutes": steps[-1]["lag_minutes"],
        "steps": steps,
    }


def velocity(current: int, history: Sequence[int], min_volume: int, multiplier: float = 3.0) -> Dict[str, object]:
    """Status laju sebuah topik dibanding riwayat jendela waktu yang sama panjang.

    `history` hanya berisi jendela yang sudah tercakup data (bukan nol karena sistem belum
    mengumpulkan). Bila kosong, baseline belum ada dan status menjadi BARU.
    """
    n = len(history)
    if n:
        mean = sum(history) / n
        var = sum((x - mean) ** 2 for x in history) / (n - 1) if n > 1 else 0.0
        std = math.sqrt(var)
    else:
        mean, std = 0.0, 0.0

    # Batas bawah agar topik yang sebelumnya nol tidak menghasilkan rasio tak hingga.
    mean_floor = max(mean, 0.5)
    std_floor = max(std, 1.0)
    ratio = round(current / mean_floor, 2)
    z = round((current - mean) / std_floor, 2)
    growth_pct = round((current - mean) / mean * 100, 1) if mean > 0 else None

    if current < min_volume:
        status = "SINYAL LEMAH"
    elif n == 0:
        status = "BARU"
    elif ratio >= multiplier or z >= 3.0:
        status = "LONJAKAN TINGGI"
    elif ratio >= 1.5 or z >= 1.5:
        status = "MENINGKAT"
    elif ratio < 0.7:
        status = "MENURUN"
    else:
        status = "STABIL"

    # Skor 0-100: z-score dan rasio memberi bobot terbesar, volume absolut membatasi topik kecil.
    raw = 35 * math.tanh(max(z, 0) / 3) + 35 * math.tanh(max(ratio - 1, 0) / 3) + 30 * math.tanh(current / 15)
    score = round(min(raw, 99.5), 1)

    return {
        "status": status,
        "score": score,
        "growth_pct": growth_pct,
        "ratio": ratio,
        "z_score": z,
        "baseline_mean": round(mean, 2),
        "baseline_std": round(std, 2),
        "baseline_windows": n,
    }
