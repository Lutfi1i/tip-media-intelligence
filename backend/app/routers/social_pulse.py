"""Router untuk endpoint RADAR Social Pulse API.
Menyediakan metrik agregat, tren topik, status platform, korelasi isu,
serta kapabilitas Geographic Scope Intelligence (FR-GEO-01 s/d FR-GEO-09).
"""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.services.social_pulse_service import (
    get_social_pulse_overview,
    get_social_trends,
    get_platform_metrics,
    get_social_correlations,
    get_social_geographic_comparison,
)
from backend.app.services.geo_hierarchy import (
    search_geographic_scope,
    PROVINCES_DATA,
    KABUPATEN_DATA,
    KECAMATAN_DATA,
    KELURAHAN_DATA,
)

router = APIRouter(prefix="/social-pulse", tags=["Social Pulse"])

@router.get("/geo/hierarchy")
def get_geographic_hierarchy() -> Dict[str, Any]:
    """Mengembalikan hierarki administratif Indonesia (Provinsi, Kab/Kota, Kecamatan, Kelurahan)."""
    return {
        "provinces": PROVINCES_DATA,
        "kabupaten": KABUPATEN_DATA,
        "kecamatan": KECAMATAN_DATA,
        "kelurahan": KELURAHAN_DATA,
    }


@router.get("/geo/search")
def search_geo_locations(
    q: str = Query("", description="Kata kunci pencarian wilayah (contoh: Cibinong, Bogor, Bandung)"),
    limit: int = Query(15, ge=1, le=50),
) -> List[Dict[str, Any]]:
    """Autocomplete pencarian wilayah administratif berdasar nama atau kode Kemendagri."""
    return search_geographic_scope(query=q, limit=limit)


@router.get("/overview")
def read_social_pulse_overview(
    time_range: str = Query("24h", description="Rentang waktu: 1h, 6h, 24h, 7d"),
    scope_kode: str = Query("ID", description="Kode wilayah Kemendagri (contoh: 32.01.01 untuk Cibinong, ID untuk Nasional)"),
    scope_mode: str = Query("context", description="Mode filter: context (Wilayah+Konteks), strict (Lokasi Ketat), regional (Konteks Regional)"),
    multi_codes: Optional[str] = Query(None, description="Kode multi-wilayah dipisah koma (contoh: 32.01.01,32.01.02)"),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Mengembalikan KPI global media sosial dan distribusi platform terfilter cakupan geografis."""
    codes_list = [c.strip() for c in multi_codes.split(",")] if multi_codes else None
    return get_social_pulse_overview(
        db,
        time_range=time_range,
        scope_kode=scope_kode,
        scope_mode=scope_mode,
        multi_codes=codes_list,
    )


@router.get("/trends")
def read_social_trends(
    platform: Optional[str] = Query(None, description="Filter platform: Threads, X (Twitter), TikTok, YouTube, atau Semua"),
    time_range: str = Query("24h", description="Rentang waktu: 1h, 6h, 24h, 7d"),
    scope_kode: str = Query("ID", description="Kode wilayah Kemendagri (contoh: 32.01.01)"),
    scope_mode: str = Query("context", description="Mode filter: context, strict, regional"),
    multi_codes: Optional[str] = Query(None, description="Kode multi-wilayah dipisah koma"),
    limit: int = Query(15, ge=1, le=50, description="Jumlah tren maksimum yang dikembalikan"),
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    """Daftar topik percakapan tren warganet terfilter wilayah dengan skor velocity, sentimen, dan korelasi isu."""
    codes_list = [c.strip() for c in multi_codes.split(",")] if multi_codes else None
    return get_social_trends(
        db,
        platform=platform,
        time_range=time_range,
        scope_kode=scope_kode,
        scope_mode=scope_mode,
        multi_codes=codes_list,
        limit=limit,
    )


@router.get("/platforms")
def read_platform_metrics(
    scope_kode: str = Query("ID", description="Kode wilayah Kemendagri"),
    scope_mode: str = Query("context", description="Mode filter: context, strict, regional"),
    multi_codes: Optional[str] = Query(None, description="Kode multi-wilayah dipisah koma"),
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    """Metrik per platform media sosial, status konektivitas, volume mention, dan sentimen terfilter wilayah."""
    codes_list = [c.strip() for c in multi_codes.split(",")] if multi_codes else None
    return get_platform_metrics(
        db,
        scope_kode=scope_kode,
        scope_mode=scope_mode,
        multi_codes=codes_list,
    )


@router.get("/correlations")
def read_social_correlations(
    scope_kode: str = Query("ID", description="Kode wilayah Kemendagri"),
    scope_mode: str = Query("context", description="Mode filter: context, strict, regional"),
    multi_codes: Optional[str] = Query(None, description="Kode multi-wilayah dipisah koma"),
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    """Daftar topik media sosial yang terhubung dengan tiket isu aktif RADAR pada wilayah terpilih."""
    codes_list = [c.strip() for c in multi_codes.split(",")] if multi_codes else None
    return get_social_correlations(
        db,
        scope_kode=scope_kode,
        scope_mode=scope_mode,
        multi_codes=codes_list,
    )


@router.get("/comparison")
def read_geographic_comparison(
    codes: str = Query("32.01.01,32.01.02,32.01.03", description="Daftar kode wilayah dipisah koma (contoh: Cibinong, Bojonggede, Citeureup)"),
    time_range: str = Query("24h", description="Rentang waktu: 1h, 6h, 24h, 7d"),
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    """Membandingkan indikator intelijen sosial antarwilayah (FR-GEO-06)."""
    codes_list = [c.strip() for c in codes.split(",") if c.strip()]
    return get_social_geographic_comparison(db, scope_codes=codes_list, time_range=time_range)
