"""Hitung ulang HANYA kolom lokasi pada analisis konten, setelah gazetir diperbarui.

Berbeda dengan reanalyze.py, sentimen, topik, dan label triase (mis. "Komersial") tidak
disentuh. Nilai lama disimpan dulu ke file JSON agar bisa dikembalikan.

Jalankan dari root proyek:
    backend/venv/bin/python -m backend.scripts.relocate --backup /path/cadangan.json [--dry-run]
    backend/venv/bin/python -m backend.scripts.relocate --restore /path/cadangan.json
"""
from __future__ import annotations

import argparse
import json
from collections import Counter

from backend.app.database import SessionLocal
from backend.app.models import ItemAnalysis, RawItem
from backend.app.services.ai_analyzer import extract_locations

FIELDS = ("lokasi_kejadian", "lokasi_disebut_json", "lokasi_confidence")


def relocate(backup_path: str, dry_run: bool) -> None:
    db = SessionLocal()
    rows = db.query(ItemAnalysis, RawItem).join(RawItem, RawItem.id == ItemAnalysis.item_id).all()
    backup = [{"item_id": a.item_id, **{f: getattr(a, f) for f in FIELDS}} for a, _ in rows]
    with open(backup_path, "w", encoding="utf-8") as fh:
        json.dump(backup, fh, ensure_ascii=False)

    changed = 0
    newly_located = 0
    examples: Counter = Counter()
    for analysis, item in rows:
        lokasi, disebut, conf = extract_locations(f"{item.judul} {item.isi or ''}")
        if lokasi == analysis.lokasi_kejadian:
            continue
        changed += 1
        if analysis.lokasi_kejadian is None and lokasi is not None:
            newly_located += 1
            examples[lokasi] += 1
        if not dry_run:
            analysis.lokasi_kejadian = lokasi
            analysis.lokasi_disebut_json = json.dumps(disebut, ensure_ascii=False)
            analysis.lokasi_confidence = conf
    if not dry_run:
        db.commit()
    db.close()
    mode = "SIMULASI, tidak ada yang disimpan" if dry_run else "tersimpan"
    print(f"analisis: {len(rows)} | lokasi berubah: {changed} | baru terpetakan: {newly_located} ({mode})")
    print("lokasi baru terbanyak:", examples.most_common(10))
    print(f"cadangan nilai lama: {backup_path}")


def restore(backup_path: str) -> None:
    with open(backup_path, encoding="utf-8") as fh:
        backup = {row["item_id"]: row for row in json.load(fh)}
    db = SessionLocal()
    restored = 0
    for analysis in db.query(ItemAnalysis).filter(ItemAnalysis.item_id.in_(list(backup))).all():
        for f in FIELDS:
            setattr(analysis, f, backup[analysis.item_id][f])
        restored += 1
    db.commit()
    db.close()
    print(f"dikembalikan: {restored} analisis")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--backup", help="File JSON tujuan cadangan, lalu hitung ulang lokasi")
    group.add_argument("--restore", help="Kembalikan lokasi dari file cadangan")
    parser.add_argument("--dry-run", action="store_true", help="Hanya tampilkan perubahan")
    args = parser.parse_args()
    if args.restore:
        restore(args.restore)
    else:
        relocate(args.backup, args.dry_run)
