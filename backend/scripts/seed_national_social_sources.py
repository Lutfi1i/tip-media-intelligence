"""Tambahkan satu sumber media sosial (via Google News) untuk setiap provinsi di luar DKI Jakarta.

Setiap sumber mencari postingan TikTok, Instagram, X, Threads, dan YouTube yang menyebut nama
provinsi atau ibu kotanya. Platform tiap item ditentukan dari domain aslinya, jadi satu sumber
bisa menghasilkan beberapa platform. Aman dijalankan berulang: sumber yang sudah ada dilewati.

Jalankan dari root proyek:
    backend/venv/bin/python -m backend.scripts.seed_national_social_sources [--dry-run]
    backend/venv/bin/python -m backend.scripts.seed_national_social_sources --hapus
"""
from __future__ import annotations

import argparse
from urllib.parse import quote_plus

from backend.app.database import SessionLocal
from backend.app.models import Source
from backend.app.services.geo_hierarchy import PROVINCES_DATA

PREFIX = "Medsos Provinsi - "
SITES = "(site:tiktok.com OR site:instagram.com OR site:x.com OR site:threads.net OR site:youtube.com)"

# Ibu kota provinsi (pusat percakapan terbesar di luar nama provinsinya).
CAPITALS = {
    "11": "Banda Aceh", "12": "Medan", "13": "Padang", "14": "Pekanbaru", "15": "Jambi", "16": "Palembang",
    "17": "Bengkulu", "18": "Bandar Lampung", "19": "Pangkal Pinang", "21": "Tanjung Pinang", "32": "Bandung",
    "33": "Semarang", "34": "Yogyakarta", "35": "Surabaya", "36": "Serang", "51": "Denpasar", "52": "Mataram",
    "53": "Kupang", "61": "Pontianak", "62": "Palangka Raya", "63": "Banjarbaru", "64": "Samarinda",
    "65": "Tanjung Selor", "71": "Manado", "72": "Palu", "73": "Makassar", "74": "Kendari", "75": "Gorontalo",
    "76": "Mamuju", "81": "Ambon", "82": "Sofifi", "91": "Jayapura", "92": "Manokwari", "93": "Merauke",
    "94": "Nabire", "95": "Wamena", "96": "Sorong",
}


def build_url(provinsi: str, capital: str) -> str:
    terms = f'"{provinsi}"' if provinsi == capital else f'("{provinsi}" OR "{capital}")'
    return f"https://news.google.com/rss/search?hl=id&gl=ID&ceid=ID:id&q={quote_plus(f'{SITES} {terms}')}"


def seed(dry_run: bool) -> None:
    db = SessionLocal()
    existing = {s.nama for s in db.query(Source).filter(Source.nama.like(f"{PREFIX}%")).all()}
    added = 0
    for prov in PROVINCES_DATA:
        capital = CAPITALS.get(prov["kode"])
        if not capital:
            continue  # DKI Jakarta sudah punya banyak sumber khusus
        nama = f"{PREFIX}{prov['nama']}"
        if nama in existing:
            continue
        added += 1
        if not dry_run:
            db.add(Source(
                nama=nama,
                jenis="media_sosial",
                url=build_url(prov["nama"], capital),
                frekuensi_menit=60,
                rate_limit_per_min=30,
                kredibilitas=0.7,
                status_izin="aktif",
            ))
    if not dry_run:
        db.commit()
    db.close()
    print(f"sumber provinsi {'akan ditambahkan' if dry_run else 'ditambahkan'}: {added} (sudah ada: {len(existing)})")


def remove() -> None:
    db = SessionLocal()
    n = db.query(Source).filter(Source.nama.like(f"{PREFIX}%")).update({"status_izin": "nonaktif"}, synchronize_session=False)
    db.commit()
    db.close()
    # Dinonaktifkan, bukan dihapus: konten yang sudah terkumpul tetap merujuk ke sumber ini.
    print(f"sumber provinsi dinonaktifkan: {n}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--hapus", action="store_true", help="Nonaktifkan semua sumber provinsi")
    args = parser.parse_args()
    remove() if args.hapus else seed(args.dry_run)
