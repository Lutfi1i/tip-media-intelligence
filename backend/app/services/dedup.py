import hashlib
import re
from typing import Set, Tuple

def normalize_text(text: str) -> str:
    """Normalize text by lowercasing and stripping excess whitespace."""
    text = text.lower()
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def compute_content_hash(title: str, body: str) -> str:
    """Compute deterministic SHA256 of normalized title + body."""
    combined = normalize_text(f"{title} {body}")
    return hashlib.sha256(combined.encode("utf-8")).hexdigest()


def compute_simhash(title: str, body: str) -> str:
    """Compute 64-bit SimHash hex string for fast near-duplicate detection (FR-07)."""
    tokens = re.findall(r"[a-z0-9]{2,}", normalize_text(f"{title} {body}"))
    if not tokens:
        return "0" * 16
    v = [0] * 64
    for tok in tokens:
        h = int(hashlib.md5(tok.encode("utf-8")).hexdigest()[:16], 16)
        for i in range(64):
            v[i] += 1 if (h >> i) & 1 else -1
    fingerprint = 0
    for i in range(64):
        if v[i] > 0:
            fingerprint |= (1 << i)
    return f"{fingerprint:016x}"


def simhash_distance(hex1: str, hex2: str) -> int:
    """Hamming distance between two 64-bit SimHash hex strings (<= 6 indicates near-duplicate)."""
    if not hex1 or not hex2:
        return 64
    try:
        x = int(hex1, 16) ^ int(hex2, 16)
        return x.bit_count()
    except ValueError:
        return 64


def get_shingles(text: str, k: int = 3) -> Set[str]:
    """Generate k-shingles (word n-grams) for similarity estimation."""
    words = normalize_text(text).split()
    if len(words) < k:
        return set(words)
    return set(" ".join(words[i:i+k]) for i in range(len(words) - k + 1))


def jaccard_similarity(set1: Set[str], set2: Set[str]) -> float:
    """Calculate Jaccard similarity between two sets of shingles."""
    if not set1 or not set2:
        return 0.0
    intersection = len(set1.intersection(set2))
    union = len(set1.union(set2))
    return float(intersection) / float(union) if union > 0 else 0.0


def is_near_duplicate(title1: str, body1: str, title2: str, body2: str, threshold: float = 0.65) -> Tuple[bool, float]:
    """
    Check if two documents are near-duplicates using Jaccard shingle similarity.
    Threshold default: 0.65 (65% overlap in 3-grams).
    """
    s1 = get_shingles(f"{title1} {body1}")
    s2 = get_shingles(f"{title2} {body2}")
    sim = jaccard_similarity(s1, s2)
    return sim >= threshold, sim
