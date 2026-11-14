"""Tambahkan RSS portal berita yang gratis dan diizinkan robots.txt.

Semua sumber di sini diuji pada 14 November 2026: feed terbaca dan robots.txt mengizinkan.
Yang ditolak saat diuji (Kompas RSS, Bisnis.com, Tribunnews: HTTP 403; Suara, Merdeka,
IDN Times: 404; Kontan, Medcom: feed rusak) sengaja tidak dimasukkan. Kanal Telegram publik
CNBC Indonesia, Kompas, Okezone, dan Katadata terbaca tetapi sudah tidak aktif (postingan terakhir
2023 sampai Agustus 2026), jadi juga tidak dimasukkan.

Konten dari sumber ini juga dicocokkan ke setiap keyword di menu Pantau Keyword.
Aman dijalankan berulang: URL yang sudah terdaftar dilewati.

Jalankan dari root proyek:
    backend/venv/bin/python -m backend.scripts.seed_free_news_sources [--dry-run]
    backend/venv/bin/python -m backend.scripts.seed_free_news_sources --hapus
"""
from __future__ import annotations

import argparse

from backend.app.database import SessionLocal
from backend.app.models import Source

PREFIX = "Sumber Gratis - "

# (nama, jenis, url, frekuensi menit)
SOURCES = [
    ("RSS Tempo Nasional", "rss", "https://rss.tempo.co/nasional", 20),
    ("RSS Tempo Bisnis", "rss", "https://rss.tempo.co/bisnis", 20),
    ("RSS CNBC Indonesia News", "rss", "https://www.cnbcindonesia.com/news/rss", 15),
    ("RSS CNBC Indonesia Market", "rss", "https://www.cnbcindonesia.com/market/rss", 20),
    ("RSS Sindonews Nasional", "rss", "https://nasional.sindonews.com/rss", 20),
    ("RSS Viva", "rss", "https://www.viva.co.id/get/all", 20),
    ("RSS JPNN", "rss", "https://www.jpnn.com/index.php?mib=rss", 20),
    ("RSS Okezone Ekonomi", "rss", "https://sindikasi.okezone.com/index.php/rss/11/RSS2.0", 20),
    ("RSS Antara Ekonomi", "rss", "https://www.antaranews.com/rss/ekonomi", 20),
    ("RSS Detik Finance", "rss", "https://finance.detik.com/rss", 15),
    ("RSS Liputan6 Bisnis", "rss", "https://feed.liputan6.com/rss/bisnis", 20),
    ("RSS Katadata", "rss", "https://katadata.co.id/rss", 30),
    ("RSS iNews", "rss", "https://www.inews.id/feed", 20),
    ("RSS Republika Ekonomi", "rss", "https://www.republika.co.id/rss/ekonomi", 30),
]


def seed(dry_run: bool) -> None:
    db = SessionLocal()
    existing = {u for (u,) in db.query(Source.url).all()}
    added = 0
    for nama, jenis, url, freq in SOURCES:
        if url in existing:
            continue
        added += 1
        if not dry_run:
            db.add(Source(
                nama=f"{PREFIX}{nama}",
                jenis=jenis,
                url=url,
                frekuensi_menit=freq,
                rate_limit_per_min=10,
                kredibilitas=0.8,
                status_izin="aktif",
            ))
    if not dry_run:
        db.commit()
    db.close()
    print(f"sumber {'akan ditambahkan' if dry_run else 'ditambahkan'}: {added} (sudah ada: {len(SOURCES) - added})")


def remove() -> None:
    db = SessionLocal()
    n = db.query(Source).filter(Source.nama.like(f"{PREFIX}%")).update({"status_izin": "nonaktif"}, synchronize_session=False)
    db.commit()
    db.close()
    # Dinonaktifkan, bukan dihapus: konten yang sudah terkumpul tetap merujuk ke sumber ini.
    print(f"sumber dinonaktifkan: {n}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--hapus", action="store_true", help="Nonaktifkan semua sumber dari skrip ini")
    args = parser.parse_args()
    remove() if args.hapus else seed(args.dry_run)
