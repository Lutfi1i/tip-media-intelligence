"""Endpoint menu Tren Sosial. Semua memakai filter global periode, lokasi, dan platform."""

from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.services import trend_ai, trend_service
from backend.app.services.geo_hierarchy import KABUPATEN_DATA, PROVINCES_DATA
from backend.app.services.trend_report_export import build_pdf, build_xlsx

router = APIRouter(prefix="/tren", tags=["Tren Sosial"])

_VALID_LOKASI = {"ID"} | {p["kode"] for p in PROVINCES_DATA} | {k["kode"] for k in KABUPATEN_DATA}


class TrendFilter(BaseModel):
    periode: str = "today"
    lokasi: str = "ID"
    platform: str = "Semua"


def trend_filter(
    periode: str = Query("today", description="today (sejak 00.00 WIB), 7d, atau 30d"),
    lokasi: str = Query("ID", description="Kode wilayah Kemendagri: ID, provinsi (32), atau kota/kabupaten (32.71)"),
    platform: str = Query("Semua", description="Semua, TikTok, Instagram, YouTube, Threads, X (Twitter)"),
) -> TrendFilter:
    if periode not in trend_service.TREND_PERIODS:
        raise HTTPException(status_code=422, detail="periode harus today, 7d, atau 30d")
    if lokasi not in _VALID_LOKASI:
        raise HTTPException(status_code=422, detail=f"Kode lokasi tidak dikenal: {lokasi}")
    return TrendFilter(periode=periode, lokasi=lokasi, platform=platform or "Semua")


@router.get("/wilayah")
def region_trends(f: TrendFilter = Depends(trend_filter), db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Top 10 tren lokal, bagian per kategori, berita, dan aktivitas per wilayah anak."""
    return trend_service.get_region_trends(db, f.periode, f.lokasi, f.platform)


@router.get("/live")
def live_stats(f: TrendFilter = Depends(trend_filter), db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Statistik percakapan: jumlah, interaksi, sentimen, kata teratas, platform, lokasi."""
    return trend_service.get_live_stats(db, f.periode, f.lokasi, f.platform)


@router.get("/hashtag")
def hashtag_keywords(f: TrendFilter = Depends(trend_filter), db: Session = Depends(get_db)) -> Dict[str, Any]:
    return trend_service.get_hashtag_keywords(db, f.periode, f.lokasi, f.platform)


@router.get("/hashtag/riwayat")
def hashtag_history(
    keys: str = Query(..., max_length=400, description="Maksimal 5, dipisah koma: #tag, p:frasa, atau kata bebas"),
    f: TrendFilter = Depends(trend_filter),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Jumlah konten per hari selama 30 hari untuk membandingkan beberapa hashtag/keyword."""
    items = [k.strip() for k in keys.split(",") if k.strip()][:5]
    if not items:
        raise HTTPException(status_code=422, detail="Isi minimal satu hashtag atau keyword")
    return trend_service.get_key_history(db, items, f.lokasi, f.platform)


@router.get("/viral")
def viral_content(
    f: TrendFilter = Depends(trend_filter),
    kategori: Optional[str] = Query(None),
    urut: str = Query("interaksi", description="interaksi, views, atau laju"),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    if urut not in trend_service.VIRAL_SORTS:
        raise HTTPException(status_code=422, detail="urut harus interaksi, views, atau laju")
    return trend_service.get_viral_content(db, f.periode, f.lokasi, f.platform, kategori, urut)


@router.get("/akun")
def accounts(
    f: TrendFilter = Depends(trend_filter),
    urut: str = Query("views", description="followers, views, engagement, postingan, atau pertumbuhan"),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    if urut not in trend_service.ACCOUNT_SORTS:
        raise HTTPException(status_code=422, detail="urut tidak dikenal")
    return trend_service.get_accounts(db, f.periode, f.lokasi, f.platform, urut)


@router.get("/laporan")
def report(f: TrendFilter = Depends(trend_filter), db: Session = Depends(get_db)) -> Dict[str, Any]:
    return trend_service.get_report_data(db, f.periode, f.lokasi, f.platform)


def _filename(f: TrendFilter, ext: str) -> str:
    return f"laporan-tren-{f.lokasi.replace('.', '')}-{f.periode}.{ext}"


@router.get("/laporan/excel")
def report_excel(f: TrendFilter = Depends(trend_filter), db: Session = Depends(get_db)) -> Response:
    data = trend_service.get_report_data(db, f.periode, f.lokasi, f.platform)
    return Response(
        content=build_xlsx(data),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{_filename(f, "xlsx")}"'},
    )


@router.get("/laporan/pdf")
def report_pdf(f: TrendFilter = Depends(trend_filter), db: Session = Depends(get_db)) -> Response:
    data = trend_service.get_report_data(db, f.periode, f.lokasi, f.platform)
    return Response(
        content=build_pdf(data),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{_filename(f, "pdf")}"'},
    )


class TopicAnalysisRequest(BaseModel):
    topic_key: str = Field(..., max_length=255)
    refresh: bool = False


@router.post("/ai/topik")
def ai_topic(body: TopicAnalysisRequest, f: TrendFilter = Depends(trend_filter), db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Analisis AI satu tren. Deteksi dan prediksi berbasis aturan selalu ada; bagian AI bila terkonfigurasi."""
    try:
        return trend_ai.analyze_topic(db, body.topic_key, f.periode, f.lokasi, f.platform, refresh=body.refresh)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


class SummaryRequest(BaseModel):
    refresh: bool = False


@router.post("/ai/ringkasan")
def ai_summary(body: SummaryRequest, f: TrendFilter = Depends(trend_filter), db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Ringkasan otomatis semua tren teratas dan rekomendasi topik konten."""
    return trend_ai.summarize_trends(db, f.periode, f.lokasi, f.platform, refresh=body.refresh)


@router.get("/ai/status")
def ai_status() -> Dict[str, Any]:
    return {"tersedia": trend_ai.ai_configured(), "batas_per_jam": trend_ai.MAX_CALLS_PER_HOUR}
