"""Siapkan skema database sebelum tes yang memakai SessionLocal (mis. database SQLite baru di CI)."""

from backend.app.database import engine
from backend.app.schema_sync import ensure_schema


def pytest_sessionstart(session):
    ensure_schema(engine)
