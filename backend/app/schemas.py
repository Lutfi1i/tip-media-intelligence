from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class RuleConfig(BaseModel):
    wilayah: List[str] = []
    keyword: List[str] = []
    sinonim: List[str] = []
    pengecualian: List[str] = []
    kategori: List[str] = []
    ambang_multiplier: float = 3.0

class MonitoringProfileBase(BaseModel):
    nama: str
    unit: str = "Pusat Analisis Krisis"
    status: str = "aktif"

class MonitoringProfileCreate(MonitoringProfileBase):
    rule: RuleConfig

class MonitoringProfileOut(MonitoringProfileBase):
    id: int
    versi: int
    rule: RuleConfig
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class SourceCreate(BaseModel):
    nama: str
    jenis: str
    url: str
    frekuensi_menit: int = 15
    rate_limit_per_min: int = 30
    kredibilitas: float = 0.85
    status_izin: str = "aktif"

class SourceOut(SourceCreate):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

class RawItemOut(BaseModel):
    id: int
    source_id: Optional[int]
    url_kanonik: Optional[str]
    judul: str
    isi: str
    penerbit: str
    published_at: datetime
    fetched_at: datetime
    is_repost: bool = False

    class Config:
        from_attributes = True

class ItemAnalysisOut(BaseModel):
    sentimen: str
    sentimen_confidence: float
    topik: str
    topik_confidence: float
    lokasi_kejadian: Optional[str]
    lokasi_disebut: List[str] = []
    lokasi_confidence: float
    ringkasan: Optional[str]

class ReviewCreate(BaseModel):
    reviewer_id: str
    reviewer_nama: str
    keputusan: str  # "verifikasi", "koreksi", "tolak"
    koreksi_label: Dict[str, Any] = {}
    catatan: Optional[str] = None

class ReviewOut(BaseModel):
    id: int
    reviewer_id: str
    reviewer_nama: str
    keputusan: str
    koreksi_label: Dict[str, Any]
    catatan: Optional[str]
    waktu: datetime

    class Config:
        from_attributes = True

class AlertOut(BaseModel):
    id: int
    issue_id: int
    level: str
    penerima: str
    kanal: str
    konten_pesan: str
    terkirim_at: datetime
    diakui_at: Optional[datetime]
    status: str

    class Config:
        from_attributes = True

class CaseUpdate(BaseModel):
    pic_id: Optional[str] = None
    pic_nama: Optional[str] = None
    unit: Optional[str] = None
    status: Optional[str] = None  # "menunggu", "ditangani", "selesai"
    tenggat_hours: Optional[int] = None
    bukti_catatan: Optional[str] = None
    bukti_url: Optional[str] = None

class CaseOut(BaseModel):
    id: int
    issue_id: int
    pic_id: Optional[str]
    pic_nama: Optional[str]
    unit: str
    tenggat: datetime
    status: str
    bukti: List[Dict[str, Any]] = []
    riwayat: List[Dict[str, Any]] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class IssueOut(BaseModel):
    id: int
    kode_referensi: str
    judul: str
    wilayah: str
    kategori: str
    skor: float
    level: str
    status: str
    ringkasan: Optional[str]
    current_volume: int
    repost_count: int
    first_seen: datetime
    last_updated: datetime
    case: Optional[CaseOut] = None

    class Config:
        from_attributes = True

class IssueDetailOut(IssueOut):
    alasan_skor: Dict[str, Any]
    pihak_terlibat: List[str]
    hal_belum_diketahui: Optional[str]
    baseline_volume: float
    items: List[RawItemOut] = []
    reviews: List[ReviewOut] = []
    alerts: List[AlertOut] = []

class DashboardKPI(BaseModel):
    mention_unik: int
    mention_growth_pct: float
    isu_prioritas: int
    critical_count: int
    high_count: int
    wilayah_terdampak: int
    total_wilayah_terpantau: int
    menunggu_aksi: int
    lewat_tenggat: int

class TrendPoint(BaseModel):
    day: str
    volume: int
    negative_pct: float

class RegionSummary(BaseModel):
    kode_wilayah: str
    nama: str
    lat: float
    lng: float
    mention_count: int
    unique_content_count: int
    sentiment_negative_pct: float
    top_issue: Optional[str]
    confidence: float
    tier: str  # "<15", "15-29", "30-59", ">=60"

class DashboardSummaryOut(BaseModel):
    kpi: DashboardKPI
    trend_7d: List[TrendPoint]
    priority_issues: List[IssueOut]
    regions: List[RegionSummary]

class AuditLogOut(BaseModel):
    id: int
    aktor: str
    peran: str
    aksi: str
    objek: str
    detail: Dict[str, Any]
    ip: str
    waktu: datetime

    class Config:
        from_attributes = True

class ReportOut(BaseModel):
    id: int
    judul: str
    jenis: str
    periode: str
    file_url: Optional[str]
    dibuat_oleh: str
    created_at: datetime
    data_snapshot: Dict[str, Any] = {}

    class Config:
        from_attributes = True
