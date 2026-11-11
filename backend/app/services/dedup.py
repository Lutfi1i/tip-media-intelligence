import hashlib
import re
from typing import Set, Tuple, List

def normalize_text(text: str) -> str:
    """Normalize text by lowercasing and stripping non-alphanumeric chars."""
    text = text.lower()
    text = re.sub(r"\s+", " ", text)
    return text.strip()

def compute_content_hash(title: str, body: str) -> str:
    """Compute deterministic SHA256 of normalized title + body."""
    combined = normalize_text(f"{title} {body}")
    return hashlib.sha256(combined.encode("utf-8")).hexdigest()

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
