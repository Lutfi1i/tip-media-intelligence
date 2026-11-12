"""Penyelarasan skema ringan tanpa alat migrasi.

`Base.metadata.create_all` hanya membuat tabel yang belum ada, tidak menambah kolom baru
ke tabel lama. Modul ini menambahkan kolom nullable dan indeks yang belum ada, sehingga
database lama (SQLite maupun PostgreSQL) tetap bisa dipakai setelah model bertambah kolom.
Kolom yang sudah ada tidak pernah diubah atau dihapus.
"""

from __future__ import annotations

import logging
from typing import List

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

from backend.app.database import Base
from backend.app import models  # noqa: F401  (mendaftarkan semua tabel ke Base.metadata)

logger = logging.getLogger("tip_schema")


def ensure_schema(engine: Engine) -> List[str]:
    """Buat tabel yang belum ada, lalu tambahkan kolom dan indeks yang belum ada. Mengembalikan daftar perubahan."""
    Base.metadata.create_all(bind=engine)
    inspector = inspect(engine)
    changes: List[str] = []

    with engine.begin() as conn:
        for table in Base.metadata.sorted_tables:
            if not inspector.has_table(table.name):
                continue
            existing_cols = {c["name"] for c in inspector.get_columns(table.name)}
            for col in table.columns:
                if col.name in existing_cols:
                    continue
                if not col.nullable and col.server_default is None:
                    # Kolom wajib tanpa default tidak bisa ditambahkan ke tabel berisi data.
                    logger.warning("Lewati kolom wajib %s.%s: perlu migrasi manual", table.name, col.name)
                    continue
                col_type = col.type.compile(dialect=engine.dialect)
                conn.execute(text(f'ALTER TABLE {table.name} ADD COLUMN {col.name} {col_type}'))
                changes.append(f"{table.name}.{col.name}")

            existing_idx = {i["name"] for i in inspector.get_indexes(table.name)}
            for idx in table.indexes:
                if idx.name in existing_idx:
                    continue
                cols = ", ".join(c.name for c in idx.columns)
                unique = "UNIQUE " if idx.unique else ""
                conn.execute(text(f"CREATE {unique}INDEX IF NOT EXISTS {idx.name} ON {table.name} ({cols})"))
                changes.append(f"index {idx.name}")

    if changes:
        logger.info("Skema diselaraskan: %s", ", ".join(changes))
    return changes
