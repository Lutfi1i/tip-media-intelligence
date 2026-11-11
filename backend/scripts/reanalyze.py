"""Hitung ulang analisis AI untuk seluruh konten tersimpan.

Dipakai setelah gazetir/leksikon diperbarui, atau untuk memastikan label pada database
benar-benar keluaran mesin analisis (bukan nilai bawaan).

Jalankan dari root proyek:
    backend/venv/Scripts/python.exe -m backend.scripts.reanalyze
"""
from __future__ import annotations

import json

from backend.app.database import SessionLocal
from backend.app.models import ItemAnalysis, RawItem
from backend.app.services.ai_analyzer import analyze_sentiment, analyze_topic, extract_locations
from backend.app.services.ingestion import MODEL_VERSION


def main() -> None:
    db = SessionLocal()
    total = 0
    dibuat = 0
    diperbarui = 0

    for item in db.query(RawItem).all():
        total += 1
        teks = f"{item.judul} {item.isi or ''}"
        sentimen, sentimen_conf = analyze_sentiment(teks)
        topik, topik_conf = analyze_topic(teks)
        lokasi_prim, lokasi_disebut, lokasi_conf = extract_locations(teks)

        analysis = db.query(ItemAnalysis).filter(ItemAnalysis.item_id == item.id).first()
        if analysis is None:
            analysis = ItemAnalysis(item_id=item.id)
            db.add(analysis)
            dibuat += 1
        else:
            diperbarui += 1

        analysis.sentimen = sentimen
        analysis.sentimen_confidence = sentimen_conf
        analysis.topik = topik
        analysis.topik_confidence = topik_conf
        analysis.lokasi_kejadian = lokasi_prim
        analysis.lokasi_disebut_json = json.dumps(lokasi_disebut, ensure_ascii=False)
        analysis.lokasi_confidence = lokasi_conf
        analysis.ringkasan = (
            f"{item.judul}. Dilaporkan {item.penerbit} terkait {topik.lower()}"
            f" di {lokasi_prim or 'Jabodetabek'}."
        )
        analysis.model_version = MODEL_VERSION

        if total % 200 == 0:
            db.commit()

    db.commit()
    print(f"konten diproses: {total} | analisis baru: {dibuat} | diperbarui: {diperbarui}")
    db.close()


if __name__ == "__main__":
    main()
