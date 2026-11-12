"""Router untuk endpoint RADAR Social Pulse API.
Menyediakan metrik agregat, tren topik, status platform, korelasi isu,
serta kapabilitas Geographic Scope Intelligence (FR-GEO-01 s/d FR-GEO-09).
"""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.services.social_pulse_service import (
    get_social_pulse_overview,
    get_social_trends,
    get_platform_metrics,
    get_social_correlations,
    get_social_geographic_comparison,
    get_social_watchlist,
    get_social_facets,
    get_agency_board,
    SORT_OPTIONS,
)
from backend.app.services.social_taxonomy import catalog as social_catalog
from backend.app.services.social_escalation import escalate_social_surges
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
    category: Optional[str] = Query(None, description="Filter kategori (id dari /social-pulse/taxonomy), mis. kuliner, politik"),
    agency: Optional[str] = Query(None, description="Filter instansi (id dari /social-pulse/taxonomy), mis. pln, damkar"),
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
        category=category,
        agency=agency,
    )


@router.get("/trends")
def read_social_trends(
    platform: Optional[str] = Query(None, description="Filter platform: Threads, X (Twitter), TikTok, YouTube, atau Semua"),
    time_range: str = Query("24h", description="Rentang waktu: 1h, 6h, 24h, 7d"),
    scope_kode: str = Query("ID", description="Kode wilayah Kemendagri (contoh: 32.01.01)"),
    scope_mode: str = Query("context", description="Mode filter: context, strict, regional"),
    multi_codes: Optional[str] = Query(None, description="Kode multi-wilayah dipisah koma"),
    limit: int = Query(15, ge=1, le=50, description="Jumlah tren maksimum yang dikembalikan"),
    category: Optional[str] = Query(None, description="Filter kategori (id dari /social-pulse/taxonomy), mis. kuliner, politik"),
    agency: Optional[str] = Query(None, description="Filter instansi (id dari /social-pulse/taxonomy), mis. pln, damkar"),
    sort: str = Query("laju", description="Urutan: laju, terbaru, volume, negatif"),
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
        category=category,
        agency=agency,
        sort=sort if sort in SORT_OPTIONS else "laju",
    )


@router.get("/platforms")
def read_platform_metrics(
    time_range: str = Query("7d", description="Rentang waktu metrik volume: 1h, 6h, 24h, 7d"),
    scope_kode: str = Query("ID", description="Kode wilayah Kemendagri"),
    scope_mode: str = Query("context", description="Mode filter: context, strict, regional"),
    multi_codes: Optional[str] = Query(None, description="Kode multi-wilayah dipisah koma"),
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    """Kesehatan konektor per platform (dari hasil tarikan terakhir) serta volume dan sentimen terfilter wilayah."""
    codes_list = [c.strip() for c in multi_codes.split(",")] if multi_codes else None
    return get_platform_metrics(
        db,
        scope_kode=scope_kode,
        scope_mode=scope_mode,
        multi_codes=codes_list,
        time_range=time_range,
    )


@router.get("/watchlist")
def read_social_watchlist(
    time_range: str = Query("24h", description="Rentang waktu: 1h, 6h, 24h, 7d"),
    scope_kode: str = Query("ID", description="Kode wilayah Kemendagri"),
    scope_mode: str = Query("context", description="Mode filter: context, strict, regional"),
    multi_codes: Optional[str] = Query(None, description="Kode multi-wilayah dipisah koma"),
    terms: Optional[str] = Query(None, description="Kata kunci tambahan dipisah koma, di luar kata kunci profil"),
    category: Optional[str] = Query(None, description="Filter kategori (id dari /social-pulse/taxonomy), mis. kuliner, politik"),
    agency: Optional[str] = Query(None, description="Filter instansi (id dari /social-pulse/taxonomy), mis. pln, damkar"),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Volume, laju, dan sentimen kata kunci profil pemantauan (kata kunci + sinonim) di media sosial."""
    codes_list = [c.strip() for c in multi_codes.split(",")] if multi_codes else None
    extra = [t.strip() for t in terms.split(",") if t.strip()] if terms else None
    return get_social_watchlist(
        db,
        time_range=time_range,
        scope_kode=scope_kode,
        scope_mode=scope_mode,
        multi_codes=codes_list,
        extra_terms=extra,
        category=category,
        agency=agency,
    )


@router.get("/taxonomy")
def read_social_taxonomy() -> Dict[str, Any]:
    """Daftar kategori dan instansi yang dikenali beserta id-nya untuk filter."""
    return social_catalog()


@router.get("/facets")
def read_social_facets(
    time_range: str = Query("24h", description="Rentang waktu: 1h, 6h, 24h, 7d"),
    scope_kode: str = Query("ID", description="Kode wilayah Kemendagri"),
    scope_mode: str = Query("context", description="Mode filter: context, strict, regional"),
    multi_codes: Optional[str] = Query(None, description="Kode multi-wilayah dipisah koma"),
    platform: Optional[str] = Query(None, description="Filter platform"),
    category: Optional[str] = Query(None, description="Filter kategori (id dari /social-pulse/taxonomy), mis. kuliner, politik"),
    agency: Optional[str] = Query(None, description="Filter instansi (id dari /social-pulse/taxonomy), mis. pln, damkar"),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Jumlah konten per kategori dan per instansi (faset silang) untuk pill filter."""
    codes_list = [c.strip() for c in multi_codes.split(",")] if multi_codes else None
    return get_social_facets(db, time_range, scope_kode, scope_mode, codes_list, platform, category, agency)


@router.get("/agencies")
def read_agency_board(
    time_range: str = Query("24h", description="Rentang waktu: 1h, 6h, 24h, 7d"),
    scope_kode: str = Query("ID", description="Kode wilayah Kemendagri"),
    scope_mode: str = Query("context", description="Mode filter: context, strict, regional"),
    multi_codes: Optional[str] = Query(None, description="Kode multi-wilayah dipisah koma"),
    category: Optional[str] = Query(None, description="Filter kategori"),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Papan instansi: volume sebutan, share of voice, laju, dan keluhan per instansi."""
    codes_list = [c.strip() for c in multi_codes.split(",")] if multi_codes else None
    return get_agency_board(db, time_range, scope_kode, scope_mode, codes_list, category)


@router.post("/escalate")
def run_social_escalation(
    time_range: str = Query("6h", description="Jendela deteksi lonjakan: 1h, 6h, 24h"),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Jadikan topik berstatus LONJAKAN TINGGI sebagai isu otomatis untuk diverifikasi analis."""
    if time_range not in ("1h", "6h", "24h"):
        raise HTTPException(status_code=422, detail="time_range eskalasi harus 1h, 6h, atau 24h")
    return escalate_social_surges(db, time_range=time_range, actor="analis")


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
