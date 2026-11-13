"""Migrasi data satu kali dari SQLite (tip_media.db) ke PostgreSQL (DATABASE_URL)."""

from __future__ import annotations

import os
from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import sessionmaker

from backend.app.database import Base
from backend.app import models  # noqa: F401


def migrate(sqlite_url: str = "sqlite:///./tip_media.db", pg_url: str = "") -> None:
    target_url = pg_url or os.getenv("DATABASE_URL", "")
    if not target_url.startswith("postgresql"):
        raise SystemExit("Set DATABASE_URL ke PostgreSQL terlebih dahulu.")

    src_engine = create_engine(sqlite_url, connect_args={"check_same_thread": False})
    dst_engine = create_engine(target_url)

    Base.metadata.create_all(bind=dst_engine)
    SrcSession = sessionmaker(bind=src_engine)
    DstSession = sessionmaker(bind=dst_engine)

    src_insp = inspect(src_engine)
    with SrcSession() as src, DstSession() as dst:
        for table in Base.metadata.sorted_tables:
            if not src_insp.has_table(table.name):
                continue
            rows = src.execute(table.select()).mappings().all()
            if not rows:
                continue
            dst.execute(table.delete())
            dst.execute(table.insert(), [dict(r) for r in rows])
            print(f"Migrated {len(rows)} rows -> {table.name}")
        dst.commit()


if __name__ == "__main__":
    migrate()
