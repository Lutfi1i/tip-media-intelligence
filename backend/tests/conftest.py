"""Siapkan skema database sebelum tes yang memakai SessionLocal (mis. database SQLite baru di CI)."""

import pytest

from backend.app.config import settings
from backend.app.database import engine
from backend.app.schema_sync import ensure_schema


def pytest_sessionstart(session):
    ensure_schema(engine)


@pytest.fixture(autouse=True)
def _no_paid_ai(monkeypatch):
    """Tes tidak boleh memanggil API AI berbayar walaupun .env lokal berisi kunci."""
    monkeypatch.setattr(settings, "AI_API_KEY", "")
