import json
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session
from datetime import datetime, timedelta

from backend.app.database import get_db
from backend.app.models import Issue, Case, Region, RawItem, Source, ItemAnalysis
from backend.app.services.ai_analyzer import GAZETTEER_REGIONS
from backend.app.schemas import (
    DashboardSummaryOut, DashboardKPI, TrendPoint, RegionSummary, IssueOut
)

router = APIRouter(prefix="/dashboard", tags=["Executive Dashboard"])

WIB_OFFSET = timedelta(hours=7)
HARI_SINGKAT = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"]
NAMA_HARI = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"]

# Peta nama baku gazetir -> kota induk (untuk menggulung mention ke wilayah kota).
KOTA_INDUK = {data["nama"]: data.get("parent") for data in GAZETTEER_REGIONS.values()}


def _kota_dari_lokasi(nama_lokasi: Optional[str]) -> Optional[str]:
    """Naikkan satu nama lokasi gazetir ke kota/provinsi induknya."""
    if not nama_lokasi:
        return None
    induk = KOTA_INDUK.get(nama_lokasi)
    if induk in (None, "Indonesia"):
        return KOTA_INDUK.get(induk) if induk else None
    return induk


def _tier(count: int) -> str:
    if count >= 60:
        return ">=60"
    if count >= 30:
        return "30-59"
    if count >= 15:
        return "15-29"
    return "<15"


def _agregasi_wilayah(db: Session, regions: List[Region], now_utc: datetime):
    """Gulung analisis konten 24 jam terakhir ke wilayah kota.

    Mengembalikan dict {nama_kota: {konten, negatif, topik}}.
    """
    hasil: Dict[str, dict] = {}
    items = (
        db.query(RawItem)
        .filter(RawItem.published_at >= now_utc - timedelta(hours=24))
        .all()
    )
    nama_wilayah = {r.nama for r in regions}
    for item in items:
        analysis = item.analysis
        if analysis is None:
            continue
        kandidat = [analysis.lokasi_kejadian]
        try:
            kandidat += json.loads(analysis.lokasi_disebut_json or "[]")
        except (ValueError, TypeError):
            pass
        kota_terkait = set()
        for nama_lokasi in kandidat:
            kota = _kota_dari_lokasi(nama_lokasi)
            if kota in nama_wilayah:
                kota_terkait.add(kota)
        for kota in kota_terkait:
            slot = hasil.setdefault(kota, {"konten": 0, "negatif": 0, "topik": {}})
            slot["konten"] += 1
            if (analysis.sentimen or "").lower() == "negatif":
                slot["negatif"] += 1
            slot["topik"][analysis.topik] = slot["topik"].get(analysis.topik, 0) + 1
    return hasil


@router.get("/summary", response_model=DashboardSummaryOut)
def get_dashboard_summary(db: Session = Depends(get_db)):
    now_utc = datetime.utcnow()
    issues = db.query(Issue).all()
    regions = db.query(Region).all()
    cases = db.query(Case).all()

    # --- Provenance: apa yang benar-benar ada di database ---
    konten_terkumpul = db.query(RawItem).count()
    konten_terklasifikasi = db.query(ItemAnalysis).count()
    sumber_aktif = db.query(Source).filter(Source.status_izin == "aktif").count()
    terakhir_koleksi = db.query(func.max(RawItem.fetched_at)).scalar()
    data_mode = "live" if (konten_terkumpul > 0 and konten_terklasifikasi > 0) else "seed"

    # --- Volume nyata: 24 jam terakhir vs 24 jam sebelumnya ---
    window_now_start = now_utc - timedelta(hours=24)
    window_prev_start = now_utc - timedelta(hours=48)
    vol_now = (
        db.query(RawItem).filter(RawItem.published_at >= window_now_start).count()
    )
    vol_prev = (
        db.query(RawItem)
        .filter(
            RawItem.published_at >= window_prev_start,
            RawItem.published_at < window_now_start,
        )
        .count()
    )
    # Tren hanya ditampilkan bila periode pembanding punya cukup data (>= 5 konten).
    # Tanpa itu persentase meledak (mis. 2050%) dan menyesatkan pembaca.
    mention_growth_pct: Optional[float] = None
    if vol_prev >= 5 and vol_now > 0:
        mention_growth_pct = round(((vol_now - vol_prev) / vol_prev) * 100, 1)

    # --- Agregasi wilayah dari konten nyata ---
    live = _agregasi_wilayah(db, regions, now_utc)
    region_summaries: List[RegionSummary] = []
    for r in regions:
        slot = live.get(r.nama)
        if slot and slot["konten"] > 0:
            topik_dominan = max(slot["topik"].items(), key=lambda kv: kv[1])[0]
            region_summaries.append(
                RegionSummary(
                    kode_wilayah=r.kode_wilayah,
                    nama=r.nama,
                    lat=r.lat,
                    lng=r.lng,
                    mention_count=slot["konten"],
                    unique_content_count=slot["konten"],
                    sentiment_negative_pct=round((slot["negatif"] / slot["konten"]) * 100, 1),
                    top_issue=None,
                    confidence=round(min(0.5 + slot["konten"] * 0.05, 0.95), 2),
                    tier=_tier(slot["konten"]),
                    sumber="live",
                    topik_dominan=topik_dominan,
                    konten_terkait=slot["konten"],
                )
            )
        else:
            region_summaries.append(
                RegionSummary(
                    kode_wilayah=r.kode_wilayah,
                    nama=r.nama,
                    lat=r.lat,
                    lng=r.lng,
                    mention_count=r.mention_count,
                    unique_content_count=r.unique_content_count,
                    sentiment_negative_pct=r.sentiment_negative_pct,
                    top_issue=r.top_issue,
                    confidence=r.confidence,
                    tier=_tier(r.mention_count),
                    sumber="agregat",
                    konten_terkait=0,
                )
            )

    # --- KPI (semua angka dihitung, tidak ada nilai tetap) ---
    critical_count = len([i for i in issues if i.level == "CRITICAL"])
    high_count = len([i for i in issues if i.level == "HIGH"])
    menunggu_aksi = len([c for c in cases if c.status in ("menunggu", "ditangani")])
    lewat_tenggat = len([c for c in cases if c.status != "selesai" and c.tenggat < now_utc])

    kpi = DashboardKPI(
        mention_unik=vol_now,
        mention_growth_pct=mention_growth_pct,
        isu_prioritas=critical_count + high_count,
        critical_count=critical_count,
        high_count=high_count,
        wilayah_terdampak=len([rs for rs in region_summaries if rs.sumber == "live"]),
        total_wilayah_terpantau=len(region_summaries),
        menunggu_aksi=menunggu_aksi,
        lewat_tenggat=lewat_tenggat,
    )

    # --- Tren 7 hari dari konten nyata (tanggal WIB) ---
    wib_now = now_utc + WIB_OFFSET
    today_wib = wib_now.date()
    days = [today_wib - timedelta(days=offset) for offset in range(6, -1, -1)]

    trend_7d: List[TrendPoint] = []
    for day in days:
        start_utc = datetime.combine(day, datetime.min.time()) - WIB_OFFSET
        end_utc = start_utc + timedelta(days=1)
        items = (
            db.query(RawItem)
            .filter(RawItem.published_at >= start_utc, RawItem.published_at < end_utc)
            .all()
        )
        analyzed = 0
        negative = 0
        for item in items:
            analysis = item.analysis
            if analysis is None:
                continue
            analyzed += 1
            if (analysis.sentimen or "").lower() in ("negatif", "negative"):
                negative += 1

        weekday = day.weekday()
        trend_7d.append(
            TrendPoint(
                day=HARI_SINGKAT[weekday],
                label=NAMA_HARI[weekday],
                volume=len(items),
                negative_pct=round((negative / analyzed) * 100, 1) if analyzed else None,
            )
        )

    priority_issues = db.query(Issue).order_by(Issue.skor.desc()).limit(6).all()

    return DashboardSummaryOut(
        kpi=kpi,
        trend_7d=trend_7d,
        priority_issues=priority_issues,
        regions=region_summaries,
        data_mode=data_mode,
        sumber_aktif=sumber_aktif,
        konten_terkumpul=konten_terkumpul,
        konten_terklasifikasi=konten_terklasifikasi,
        konten_24jam=vol_now,
        terakhir_koleksi=terakhir_koleksi,
        generated_at=now_utc,
    )
