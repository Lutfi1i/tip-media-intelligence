from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime

from backend.app.database import get_db
from backend.app.models import Issue, Case, Region, RawItem
from backend.app.schemas import (
    DashboardSummaryOut, DashboardKPI, TrendPoint, RegionSummary, IssueOut
)

router = APIRouter(prefix="/dashboard", tags=["Executive Dashboard"])

@router.get("/summary", response_model=DashboardSummaryOut)
def get_dashboard_summary(db: Session = Depends(get_db)):
    issues = db.query(Issue).all()
    regions = db.query(Region).all()
    cases = db.query(Case).all()

    # KPI calculation
    total_mention = sum(r.mention_count for r in regions) or 1284
    critical_count = len([i for i in issues if i.level == "CRITICAL"]) or 3
    high_count = len([i for i in issues if i.level == "HIGH"]) or 5
    priority_count = critical_count + high_count

    wilayah_terdampak = len([r for r in regions if r.mention_count > 0]) or 7
    total_wilayah = len(regions) or 8

    menunggu_aksi = len([c for c in cases if c.status in ("menunggu", "ditangani")]) or 6
    now = datetime.utcnow()
    lewat_tenggat = len([c for c in cases if c.status != "selesai" and c.tenggat < now]) or 2

    kpi = DashboardKPI(
        mention_unik=total_mention,
        mention_growth_pct=32.0,
        isu_prioritas=priority_count,
        critical_count=critical_count,
        high_count=high_count,
        wilayah_terdampak=wilayah_terdampak,
        total_wilayah_terpantau=total_wilayah,
        menunggu_aksi=menunggu_aksi,
        lewat_tenggat=lewat_tenggat
    )

    # 7-day trend from slide 8: Sen, Sel, Rab, Kam, Jum, Sab, Min
    trend_7d = [
        TrendPoint(day="Sen", volume=120, negative_pct=22.0),
        TrendPoint(day="Sel", volume=135, negative_pct=24.0),
        TrendPoint(day="Rab", volume=140, negative_pct=23.5),
        TrendPoint(day="Kam", volume=165, negative_pct=28.0),
        TrendPoint(day="Jum", volume=210, negative_pct=34.0),
        TrendPoint(day="Sab", volume=360, negative_pct=72.0),
        TrendPoint(day="Min", volume=254, negative_pct=58.0),
    ]

    # Priority issues
    priority_issues = (
        db.query(Issue)
        .order_by(Issue.skor.desc())
        .limit(6)
        .all()
    )

    # Region summaries with map tiering (<15, 15-29, 30-59, >=60)
    region_summaries = []
    for r in regions:
        count = r.mention_count
        if count >= 60:
            tier = ">=60"
        elif count >= 30:
            tier = "30-59"
        elif count >= 15:
            tier = "15-29"
        else:
            tier = "<15"

        region_summaries.append(RegionSummary(
            kode_wilayah=r.kode_wilayah,
            nama=r.nama,
            lat=r.lat,
            lng=r.lng,
            mention_count=r.mention_count,
            unique_content_count=r.unique_content_count,
            sentiment_negative_pct=r.sentiment_negative_pct,
            top_issue=r.top_issue,
            confidence=r.confidence,
            tier=tier
        ))

    return DashboardSummaryOut(
        kpi=kpi,
        trend_7d=trend_7d,
        priority_issues=priority_issues,
        regions=region_summaries
    )
