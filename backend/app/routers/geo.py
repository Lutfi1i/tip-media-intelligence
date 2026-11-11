"""
Geographic Master API Router.
Provides Indonesia archipelago boundaries/overview and Jabodetabek regional drill-down.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Any

from backend.app.database import get_db
from backend.app.services.geo_service import (
    get_indonesia_geo_overview,
    get_region_detail_and_issues,
)

router = APIRouter(prefix="/geo", tags=["Geospatial & Wilayah"])


@router.get("/indonesia", response_model=Dict[str, Any])
def get_indonesia_map_data(db: Session = Depends(get_db)):
    """
    Get full Indonesian archipelago overview:
    - 38 Provinces (non-pilot provinces flagged is_focus=False to be styled in tactical gray)
    - 11 Jabodetabek Kabupaten/Kota with live mention heatmaps and threat levels.
    """
    return get_indonesia_geo_overview(db)


@router.get("/region/{kode_wilayah}", response_model=Dict[str, Any])
def get_region_drilldown(kode_wilayah: str, db: Session = Depends(get_db)):
    """
    Drill down into a specific Kabupaten / Kota or Provinsi by Kemendagri code.
    Returns matched priority issues and real news articles for that territory.
    """
    res = get_region_detail_and_issues(db, kode_wilayah)
    if "error" in res:
        raise HTTPException(status_code=404, detail=res["error"])
    return res
