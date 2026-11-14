from datetime import datetime, timedelta

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.database import Base
from backend.app.models import RawItem, Source
from backend.app.services.social_pulse_service import _load_dataset, previous_period, resolve_period

# 14 Nov 2026 07:00 UTC = 14:00 WIB.
NOW = datetime(2026, 11, 14, 7, 0)
TODAY_START_UTC = datetime(2026, 11, 13, 17, 0)  # 14 Nov 00:00 WIB


def test_today_starts_at_wib_midnight_and_compares_same_hours():
    p = resolve_period("today", now=NOW)
    assert p.start == TODAY_START_UTC and p.end == NOW
    assert p.step == timedelta(days=1) and p.n_windows == 7

    prev = previous_period(p)
    # Kemarin 00:00-14:00 WIB, bukan 14 jam tepat sebelum tengah malam.
    assert prev.start == TODAY_START_UTC - timedelta(days=1)
    assert prev.end == NOW - timedelta(days=1)


def test_today_just_after_midnight_has_nonzero_span():
    p = resolve_period("today", now=TODAY_START_UTC)
    assert p.span == timedelta(minutes=1)


def test_presets_keep_consecutive_windows():
    p = resolve_period("24h", now=NOW)
    assert p.step == p.span == timedelta(hours=24)
    assert previous_period(p).end == p.start


@pytest.fixture()
def db():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(bind=engine)
    session = sessionmaker(bind=engine)()
    yield session
    session.close()


def test_today_baseline_only_uses_same_hours_on_previous_days(db):
    src = Source(nama="X", jenis="media_sosial", url="https://x.com")
    db.add(src)
    db.flush()

    def add(n, published_utc):
        db.add(RawItem(source_id=src.id, url_kanonik=f"https://x.com/u/status/{n}", hash=f"h{n}",
                       judul=f"konten {n}", isi="", penerbit="X", published_at=published_utc,
                       fetched_at=datetime(2026, 11, 1), platform="X (Twitter)"))

    add(1, datetime(2026, 11, 14, 2, 0))   # hari ini 09:00 WIB -> periode aktif
    add(2, datetime(2026, 11, 13, 2, 0))   # kemarin 09:00 WIB -> baseline hari ke-1
    add(3, datetime(2026, 11, 13, 13, 0))  # kemarin 20:00 WIB -> di luar jam pembanding
    add(4, datetime(2026, 11, 11, 2, 0))   # 3 hari lalu 09:00 WIB -> baseline hari ke-3
    db.commit()

    ds = _load_dataset(db, period=resolve_period("today", now=NOW))
    assert [p.id for p in ds.current] == [1]
    assert sorted(ds.history_window_index.items()) == [(2, 0), (4, 2)]
