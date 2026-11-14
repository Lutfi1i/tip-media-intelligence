from datetime import datetime, timedelta

import pytest

from backend.app.services.report_generator import report_window_start

NOW = datetime(2026, 11, 14, 12, 0, 0)


@pytest.mark.parametrize(
    "jenis, expected",
    [
        ("harian", NOW - timedelta(hours=24)),
        ("mingguan", NOW - timedelta(days=7)),
        ("bulanan", NOW - timedelta(days=30)),
        ("insidental", None),
        # Jenis tak dikenal mengikuti default endpoint (mingguan), bukan "semua data".
        ("tidak-dikenal", NOW - timedelta(days=7)),
    ],
)
def test_report_window_start(jenis, expected):
    assert report_window_start(jenis, now=NOW) == expected


@pytest.fixture
def client_auth_required(monkeypatch):
    from fastapi.testclient import TestClient
    from backend.app.config import settings
    from backend.app.database import get_db
    from backend.app.main import app

    monkeypatch.setattr(settings, "AUTH_REQUIRED", True)
    # Permintaan harus ditolak sebelum menyentuh database.
    app.dependency_overrides[get_db] = lambda: None
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.pop(get_db, None)


def test_evidence_download_requires_login(client_auth_required):
    res = client_auth_required.get("/api/v1/cases/1/evidence/1/download")
    assert res.status_code == 401


def test_evidence_upload_requires_login(client_auth_required):
    res = client_auth_required.post(
        "/api/v1/cases/1/evidence",
        files={"file": ("bukti.txt", b"isi", "text/plain")},
    )
    assert res.status_code == 401
