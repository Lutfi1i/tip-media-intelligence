"""Label emosi berbasis kamus kata untuk konten media sosial berbahasa Indonesia.

Sentimen hanya membedakan positif/negatif. Emosi membantu menentukan respons: warga yang
marah pada layanan butuh klarifikasi, warga yang takut saat bencana butuh informasi
keselamatan. Satu konten bisa membawa lebih dari satu emosi. Kamus sengaja dibuat
eksplisit agar mudah diaudit dan ditambah; tanpa kecocokan, konten tidak diberi label.
"""

from __future__ import annotations

import re
from collections import Counter
from typing import Dict, Iterable, List, Sequence, Tuple

EMOTIONS: Tuple[Tuple[str, str, Tuple[str, ...]], ...] = (
    ("marah", "Marah", (
        "marah", "kesal", "geram", "muak", "jengkel", "sebel", "ngamuk", "murka", "kecam", "mengecam",
        "tidak becus", "ga becus", "gak becus", "nggak becus", "kurang ajar", "brengsek", "bangsat", "goblok",
        "tolol", "sialan", "keterlaluan", "minta tanggung jawab", "usut tuntas", "protes keras", "emosi warga",
    )),
    ("takut", "Takut", (
        "takut", "khawatir", "cemas", "was-was", "waswas", "ngeri", "panik", "mencekam", "trauma", "resah",
        "seram", "bahaya", "berbahaya", "waspada", "terancam", "mengungsi",
    )),
    ("sedih", "Sedih", (
        "sedih", "duka", "berduka", "belasungkawa", "innalillahi", "prihatin", "pilu", "menangis", "nangis",
        "meninggal dunia", "korban jiwa", "tewas", "kehilangan", "turut berduka",
    )),
    ("kecewa", "Kecewa", (
        "kecewa", "mengecewakan", "menyesal", "nyesel", "percuma", "tidak sesuai", "ga sesuai", "gak sesuai",
        "pelayanan buruk", "lelet", "lambat banget", "tidak ada respon", "belum ada respon", "gak ada respon",
        "dicuekin", "diabaikan", "omong kosong", "janji doang", "tidak ditanggapi",
    )),
    ("senang", "Senang", (
        "senang", "bahagia", "gembira", "puas", "mantap", "keren", "terima kasih", "makasih", "apresiasi",
        "bangga", "salut", "alhamdulillah", "recommended", "rekomended", "lezat", "enak banget", "seru",
        "sukses", "berhasil", "cepat tanggap", "sigap",
    )),
    ("terkejut", "Terkejut", (
        "kaget", "terkejut", "heboh", "gempar", "mengejutkan", "tak disangka", "nggak nyangka", "gak nyangka",
        "astaga", "astagfirullah", "astaghfirullah", "wow", "geger",
    )),
)

EMOTION_LABELS: Dict[str, str] = {eid: label for eid, label, _ in EMOTIONS}

_MATCHERS = [
    (eid, re.compile(r"(?<![a-z0-9])(?:" + "|".join(re.escape(k) for k in sorted(kws, key=len, reverse=True)) + r")(?![a-z0-9])"))
    for eid, _, kws in EMOTIONS
]


def classify_emotions(text: str) -> List[str]:
    """Id emosi yang terdeteksi, diurutkan dari kecocokan terbanyak. Kosong bila tidak ada."""
    low = (text or "").lower()
    scores = [(eid, len(rx.findall(low))) for eid, rx in _MATCHERS]
    return [eid for eid, n in sorted(scores, key=lambda x: -x[1]) if n > 0]


def emotion_breakdown(emotion_lists: Iterable[Sequence[str]], total: int) -> List[Dict[str, object]]:
    """Jumlah dan persentase konten per emosi (satu konten dihitung sekali per emosi)."""
    counter: Counter = Counter()
    for emos in emotion_lists:
        counter.update(set(emos))
    return [
        {"id": eid, "label": EMOTION_LABELS[eid], "count": n, "pct": round(n / total * 100, 1) if total else 0.0}
        for eid, n in counter.most_common()
    ]
