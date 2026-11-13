"""Hashtag yang sering dipakai bersama oleh akun yang berbeda.

Pasangan diukur dengan dua angka: jumlah akun yang memakai keduanya dalam satu konten, dan
keterikatan (Jaccard: konten bersama dibagi konten yang memuat salah satunya).

Banyak kanal menempelkan daftar tag yang sama di setiap unggahan (#bmkg #gempa dari satu akun
BMKG, tag nama program dari kanal berita). Pasangan seperti itu bukan tanda isu menyebar, jadi
pasangan baru dihitung bila dipakai minimal dua akun bernama. Konten tanpa nama akun tidak
menambah jumlah akun.
"""

from __future__ import annotations

from collections import Counter, defaultdict
from itertools import combinations
from typing import Any, Dict, List, Optional, Sequence, Set, Tuple

from sqlalchemy.orm import Session

from backend.app.services.social_pulse_service import _load_dataset
from backend.app.services.social_topics import SocialPost

MIN_PAIR_ACCOUNTS = 2
# Keterikatan minimum agar dua hashtag dianggap satu kelompok isu.
GROUP_MIN_JACCARD = 0.5


def _tags(post: SocialPost) -> Set[str]:
    return {k for k in post.keys if k.startswith("#")}


def hashtag_pairs(posts: Sequence[SocialPost], min_accounts: int = MIN_PAIR_ACCOUNTS) -> List[Dict[str, Any]]:
    tag_posts: Counter = Counter()
    pair_posts: Counter = Counter()
    pair_accounts: Dict[Tuple[str, str], Set[str]] = defaultdict(set)
    for p in posts:
        tags = sorted(_tags(p))
        tag_posts.update(tags)
        for pair in combinations(tags, 2):
            pair_posts[pair] += 1
            if p.author:
                pair_accounts[pair].add(p.author.strip().lower())

    pairs = []
    for (a, b), n in pair_posts.items():
        accounts = len(pair_accounts[(a, b)])
        if accounts < min_accounts:
            continue
        pairs.append({
            "a": a,
            "b": b,
            "posts": n,
            "accounts": accounts,
            "jaccard": round(n / (tag_posts[a] + tag_posts[b] - n), 2),
        })
    pairs.sort(key=lambda r: (-r["accounts"], -r["posts"], -r["jaccard"], r["a"], r["b"]))
    return pairs


def hashtag_groups(
    posts: Sequence[SocialPost],
    pairs: Sequence[Dict[str, Any]],
    min_jaccard: float = GROUP_MIN_JACCARD,
) -> List[Dict[str, Any]]:
    """Gabungkan hashtag yang terikat kuat menjadi kelompok yang kemungkinan membahas satu isu."""
    parent: Dict[str, str] = {}

    def find(x: str) -> str:
        parent.setdefault(x, x)
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    for r in pairs:
        if r["jaccard"] >= min_jaccard:
            parent[find(r["a"])] = find(r["b"])

    members: Dict[str, Set[str]] = defaultdict(set)
    for tag in list(parent):
        members[find(tag)].add(tag)

    groups = []
    for tags in members.values():
        group_posts = [p for p in posts if _tags(p) & tags]
        tag_counts = Counter(t for p in group_posts for t in _tags(p) & tags)
        groups.append({
            "tags": [t for t, _ in sorted(tag_counts.items(), key=lambda kv: (-kv[1], kv[0]))],
            "posts": len(group_posts),
            "accounts": len({p.author.strip().lower() for p in group_posts if p.author}),
            "platforms": [name for name, _ in Counter(p.platform for p in group_posts).most_common()],
        })
    groups.sort(key=lambda g: (-g["accounts"], -g["posts"], g["tags"][0]))
    return groups


def get_hashtag_cooccurrence(
    db: Session,
    time_range: str = "24h",
    scope_kode: str = "ID",
    scope_mode: str = "context",
    multi_codes: Optional[List[str]] = None,
    platform: Optional[str] = None,
    category: Optional[str] = None,
    agency: Optional[str] = None,
    limit: int = 20,
) -> Dict[str, Any]:
    ds = _load_dataset(db, time_range, scope_kode, scope_mode, multi_codes, platform, category, agency)
    posts = ds.current
    pairs = hashtag_pairs(posts)
    return {
        "time_range": time_range,
        "total_posts": len(posts),
        "posts_with_hashtag": sum(1 for p in posts if _tags(p)),
        "groups": hashtag_groups(posts, pairs),
        "pairs": pairs[:limit],
    }
