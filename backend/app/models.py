from datetime import datetime
import json
from sqlalchemy import (
    Column, Integer, String, Float, Text, Boolean, DateTime, ForeignKey, Enum, Table
)
from sqlalchemy.orm import relationship
from backend.app.database import Base

class MonitoringProfile(Base):
    __tablename__ = "monitoring_profiles"

    id = Column(Integer, primary_key=True, index=True)
    nama = Column(String(255), nullable=False)
    unit = Column(String(255), default="Pusat Analisis Krisis")
    status = Column(String(50), default="aktif")  # aktif, nonaktif
    versi = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    rules = relationship("ProfileRule", back_populates="profile", cascade="all, delete-orphan")
    issues = relationship("Issue", back_populates="profile")

class ProfileRule(Base):
    __tablename__ = "profile_rules"

    id = Column(Integer, primary_key=True, index=True)
    profile_id = Column(Integer, ForeignKey("monitoring_profiles.id"), nullable=False)
    versi = Column(Integer, default=1)
    wilayah_json = Column(Text, default="[]")       # List of regions, e.g. ["Jakarta Selatan", "Kemang"]
    keyword_json = Column(Text, default="[]")       # ["banjir", "genangan", "drainase"]
    sinonim_json = Column(Text, default="[]")       # ["air naik", "tumpahan air"]
    pengecualian_json = Column(Text, default="[]")  # ["banjir diskon", "banjir order"]
    kategori_json = Column(Text, default="[]")     # ["Bencana", "Infrastruktur"]
    ambang_multiplier = Column(Float, default=3.0)  # Lonjakan >= 3x baseline -> HIGH
    created_at = Column(DateTime, default=datetime.utcnow)

    profile = relationship("MonitoringProfile", back_populates="rules")

class Source(Base):
    __tablename__ = "sources"

    id = Column(Integer, primary_key=True, index=True)
    nama = Column(String(255), nullable=False)
    jenis = Column(String(50), nullable=False)  # berita, rss, situs_resmi, pengaduan
    url = Column(String(512), nullable=False)
    frekuensi_menit = Column(Integer, default=15)
    rate_limit_per_min = Column(Integer, default=30)
    kredibilitas = Column(Float, default=0.85)  # 0.0 to 1.0
    status_izin = Column(String(50), default="aktif")  # aktif, ditinjau, dibatasi
    created_at = Column(DateTime, default=datetime.utcnow)
    # Hasil tarikan terakhir, dipakai untuk status kesehatan platform di Social Pulse.
    last_fetch_at = Column(DateTime, nullable=True)
    last_fetch_status = Column(String(20), nullable=True)  # ok, gagal, dilewati
    last_fetch_error = Column(String(512), nullable=True)
    last_fetch_count = Column(Integer, nullable=True)
    last_success_at = Column(DateTime, nullable=True)

    raw_items = relationship("RawItem", back_populates="source")

class RawItem(Base):
    __tablename__ = "raw_items"

    id = Column(Integer, primary_key=True, index=True)
    source_id = Column(Integer, ForeignKey("sources.id"), nullable=True)
    url_kanonik = Column(String(512), unique=True, index=True)
    hash = Column(String(64), index=True)
    judul = Column(String(512), nullable=False)
    isi = Column(Text, nullable=False)
    penerbit = Column(String(255), default="Media Online")
    penulis = Column(String(255), nullable=True)
    published_at = Column(DateTime, default=datetime.utcnow, index=True)
    fetched_at = Column(DateTime, default=datetime.utcnow)
    # Platform asal ditentukan dari domain asli konten, bukan dari nama feed.
    # Nilai: "X (Twitter)", "TikTok", "Threads", "YouTube", "Instagram", "Facebook", "Bluesky", atau "berita".
    platform = Column(String(50), nullable=True, index=True)
    # Engagement hanya terisi bila sumber menyediakannya; NULL berarti tidak diketahui, bukan nol.
    eng_likes = Column(Integer, nullable=True)
    eng_shares = Column(Integer, nullable=True)
    eng_replies = Column(Integer, nullable=True)
    eng_views = Column(Integer, nullable=True)
    author_followers = Column(Integer, nullable=True)

    source = relationship("Source", back_populates="raw_items")
    analysis = relationship("ItemAnalysis", back_populates="raw_item", uselist=False, cascade="all, delete-orphan")
    issue_links = relationship("IssueItem", back_populates="raw_item")

class ItemAnalysis(Base):
    __tablename__ = "item_analyses"

    id = Column(Integer, primary_key=True, index=True)
    item_id = Column(Integer, ForeignKey("raw_items.id"), nullable=False, unique=True)
    sentimen = Column(String(50), default="netral")  # positif, netral, negatif, campuran, tidak pasti
    sentimen_confidence = Column(Float, default=0.80)
    topik = Column(String(100), default="Umum")
    topik_confidence = Column(Float, default=0.80)
    lokasi_kejadian = Column(String(255), nullable=True)
    lokasi_disebut_json = Column(Text, default="[]")
    lokasi_confidence = Column(Float, default=0.75)
    ringkasan = Column(Text, nullable=True)
    embedding_vector_json = Column(Text, nullable=True)
    model_version = Column(String(50), default="leksikon-id-gazetir-v2")
    created_at = Column(DateTime, default=datetime.utcnow)

    raw_item = relationship("RawItem", back_populates="analysis")

class Issue(Base):
    __tablename__ = "issues"

    id = Column(Integer, primary_key=True, index=True)
    profile_id = Column(Integer, ForeignKey("monitoring_profiles.id"), nullable=True)
    kode_referensi = Column(String(50), unique=True, index=True)  # e.g. "2611-0042"
    judul = Column(String(512), nullable=False)
    wilayah = Column(String(255), nullable=False)  # e.g. "Jakarta Selatan"
    kategori = Column(String(100), default="Bencana")
    skor = Column(Float, default=50.0)             # 0 to 100
    level = Column(String(20), default="MEDIUM")   # CRITICAL, HIGH, MEDIUM, LOW
    alasan_skor_json = Column(Text, default="{}")  # Breakdown of 6 factors
    status = Column(String(50), default="otomatis") # otomatis, terverifikasi, dikoreksi, ditolak, selesai
    ringkasan = Column(Text, nullable=True)
    pihak_terlibat_json = Column(Text, default="[]")
    hal_belum_diketahui = Column(Text, nullable=True)
    baseline_volume = Column(Float, default=10.0)
    current_volume = Column(Integer, default=1)
    repost_count = Column(Integer, default=0)
    first_seen = Column(DateTime, default=datetime.utcnow)
    last_updated = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    # Terisi bila isu dieskalasi dari lonjakan topik media sosial, agar lonjakan berikutnya memperbarui isu yang sama.
    social_topic_key = Column(String(255), nullable=True, index=True)

    profile = relationship("MonitoringProfile", back_populates="issues")
    items = relationship("IssueItem", back_populates="issue", cascade="all, delete-orphan")
    reviews = relationship("Review", back_populates="issue", cascade="all, delete-orphan")
    alerts = relationship("Alert", back_populates="issue", cascade="all, delete-orphan")
    case = relationship("Case", back_populates="issue", uselist=False, cascade="all, delete-orphan")

class IssueItem(Base):
    __tablename__ = "issue_items"

    id = Column(Integer, primary_key=True, index=True)
    issue_id = Column(Integer, ForeignKey("issues.id"), nullable=False)
    item_id = Column(Integer, ForeignKey("raw_items.id"), nullable=False)
    is_repost = Column(Boolean, default=False)

    issue = relationship("Issue", back_populates="items")
    raw_item = relationship("RawItem", back_populates="issue_links")

class Review(Base):
    __tablename__ = "reviews"

    id = Column(Integer, primary_key=True, index=True)
    issue_id = Column(Integer, ForeignKey("issues.id"), nullable=False)
    reviewer_id = Column(String(100), nullable=False)
    reviewer_nama = Column(String(255), nullable=False)
    keputusan = Column(String(50), nullable=False)  # verifikasi, koreksi, tolak
    koreksi_label_json = Column(Text, default="{}")
    catatan = Column(Text, nullable=True)
    waktu = Column(DateTime, default=datetime.utcnow)

    issue = relationship("Issue", back_populates="reviews")

class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    issue_id = Column(Integer, ForeignKey("issues.id"), nullable=False)
    level = Column(String(20), nullable=False)  # CRITICAL, HIGH
    penerima = Column(String(255), nullable=False)
    kanal = Column(String(50), nullable=False)  # email, telegram, whatsapp
    konten_pesan = Column(Text, nullable=False)
    terkirim_at = Column(DateTime, default=datetime.utcnow)
    diakui_at = Column(DateTime, nullable=True)
    status = Column(String(50), default="terkirim") # terkirim, diakui, gagal

    issue = relationship("Issue", back_populates="alerts")

class Case(Base):
    __tablename__ = "cases"

    id = Column(Integer, primary_key=True, index=True)
    issue_id = Column(Integer, ForeignKey("issues.id"), nullable=False, unique=True)
    pic_id = Column(String(100), nullable=True)
    pic_nama = Column(String(255), nullable=True)
    unit = Column(String(255), default="Dinas SDA")
    tenggat = Column(DateTime, nullable=False)
    status = Column(String(50), default="menunggu")  # menunggu, ditangani, selesai
    bukti_json = Column(Text, default="[]")         # array of evidence objects
    riwayat_json = Column(Text, default="[]")       # timeline of status changes
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    issue = relationship("Issue", back_populates="case")

class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, index=True)
    judul = Column(String(255), nullable=False)
    jenis = Column(String(50), nullable=False)  # harian, mingguan, insidental
    periode = Column(String(100), nullable=False)
    file_url = Column(String(512), nullable=True)
    data_snapshot_json = Column(Text, default="{}")
    dibuat_oleh = Column(String(255), default="Sistem Otomatis")
    created_at = Column(DateTime, default=datetime.utcnow)

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    aktor = Column(String(100), nullable=False)
    peran = Column(String(50), default="analis")
    aksi = Column(String(100), nullable=False)  # e.g. VERIFIKASI_ISU, DISPATCH_ALERT, ESKALASI_KASUS
    objek = Column(String(100), nullable=False)  # issue:2611-0042
    detail_json = Column(Text, default="{}")
    ip = Column(String(50), default="127.0.0.1")
    waktu = Column(DateTime, default=datetime.utcnow)

class Region(Base):
    __tablename__ = "regions"

    kode_wilayah = Column(String(50), primary_key=True)
    nama = Column(String(255), nullable=False)
    tingkat = Column(String(50), default="kota")  # provinsi, kota, kecamatan
    parent_kode = Column(String(50), nullable=True)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    mention_count = Column(Integer, default=0)
    unique_content_count = Column(Integer, default=0)
    sentiment_negative_pct = Column(Float, default=0.0)
    top_issue = Column(String(255), nullable=True)
    confidence = Column(Float, default=0.85)


class SocialTopicNote(Base):
    """Catatan dan status analis untuk sebuah topik medsos (riwayat lengkap, status terbaru = catatan terakhir)."""
    __tablename__ = "social_topic_notes"

    id = Column(Integer, primary_key=True, index=True)
    topic_key = Column(String(255), nullable=False, index=True)
    topic_label = Column(String(255), nullable=False)
    status = Column(String(30), nullable=False)  # dipantau, sudah_dicek, hoaks, ditangani, bukan_isu
    catatan = Column(Text, nullable=True)
    aktor = Column(String(120), nullable=False)
    peran = Column(String(50), default="Analis")
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
