"""Router untuk endpoint RADAR Social Pulse API.
Menyediakan metrik agregat, tren topik, status platform, korelasi isu,
serta kapabilitas Geographic Scope Intelligence (FR-GEO-01 s/d FR-GEO-09).
"""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
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
    get_social_brief,
    get_period_comparison,
    get_region_category_heatmap,
    SORT_OPTIONS,
    custom_period_key,
    resolve_period,
)
from backend.app.services.social_taxonomy import catalog as social_catalog
from backend.app.services.social_notes import NOTE_STATUSES, add_note, list_notes
from backend.app.services.social_accounts import add_account, get_account_activity, remove_account
from backend.app.services.social_search import SEARCH_SORTS, export_social_content_csv, search_social_content
from backend.app.services.social_alert_rules import (
    METRICS as ALERT_METRICS,
    WINDOWS as ALERT_WINDOWS,
    evaluate_rules,
    event_payload,
    measure_rule,
    rule_payload,
    validate_rule,
)
from backend.app.services.audit import record_audit
from backend.app.models import SocialAlertEvent, SocialAlertRule
from backend.app.services.social_escalation import escalate_social_surges
from backend.app.services.geo_hierarchy import (
    search_geographic_scope,
    PROVINCES_DATA,
    KABUPATEN_DATA,
    KECAMATAN_DATA,
    KELURAHAN_DATA,
)

router = APIRouter(prefix="/social-pulse", tags=["Social Pulse"])


def period_param(
    time_range: str = Query("24h", description="Preset: 1h, 6h, 24h, 7d, 30d. Diabaikan bila start diisi."),
    start: Optional[str] = Query(None, description="Tanggal mulai WIB (YYYY-MM-DD) untuk periode kustom"),
    end: Optional[str] = Query(None, description="Tanggal akhir WIB (YYYY-MM-DD), ikut dihitung. Default = start"),
) -> str:
    """Satukan preset atau rentang tanggal kustom menjadi kunci periode yang dipahami service."""
    key = custom_period_key(start, end or start) if start else time_range
    try:
        resolve_period(key)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    return key

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
    time_range: str = Depends(period_param),
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
    time_range: str = Depends(period_param),
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
    time_range: str = Depends(period_param),
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
    time_range: str = Depends(period_param),
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


class TopicNoteIn(BaseModel):
    topic_key: str = Field(..., min_length=1, max_length=255)
    topic_label: str = Field("", max_length=255)
    status: str
    catatan: Optional[str] = Field(None, max_length=2000)
    aktor: str = Field(..., min_length=1, max_length=120)
    peran: str = Field("Analis", max_length=50)


@router.get("/notes")
def read_topic_notes(topic_key: str = Query(..., min_length=1), db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Riwayat catatan analis untuk satu topik, terbaru dulu, beserta daftar status yang tersedia."""
    return {"statuses": NOTE_STATUSES, "notes": list_notes(db, topic_key)}


@router.post("/notes")
def create_topic_note(payload: TopicNoteIn, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Tambah catatan/status pada topik medsos. Tercatat juga di audit trail."""
    try:
        return add_note(db, payload.topic_key, payload.topic_label, payload.status, payload.aktor, payload.catatan, payload.peran)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


@router.get("/compare")
def read_period_comparison(
    time_range: str = Depends(period_param),
    compare_start: Optional[str] = Query(None, description="Tanggal mulai pembanding (WIB). Kosong = periode sebelumnya"),
    compare_end: Optional[str] = Query(None, description="Tanggal akhir pembanding (WIB), ikut dihitung"),
    scope_kode: str = Query("ID", description="Kode wilayah Kemendagri"),
    scope_mode: str = Query("context", description="Mode filter: context, strict, regional"),
    multi_codes: Optional[str] = Query(None, description="Kode multi-wilayah dipisah koma"),
    platform: Optional[str] = Query(None, description="Filter platform"),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Bandingkan periode aktif dengan periode pembanding: volume, kategori, instansi, topik, emosi, platform."""
    compare_key = None
    if compare_start:
        compare_key = custom_period_key(compare_start, compare_end or compare_start)
        try:
            resolve_period(compare_key)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=f"periode pembanding: {exc}")
    codes_list = [c.strip() for c in multi_codes.split(",")] if multi_codes else None
    return get_period_comparison(db, time_range, compare_key, scope_kode, scope_mode, codes_list, platform)


class AlertRuleIn(BaseModel):
    nama: str = Field(..., max_length=150)
    aktif: bool = True
    term: Optional[str] = Field(None, max_length=150)
    category: Optional[str] = None
    agency: Optional[str] = None
    platform: Optional[str] = None
    scope_kode: str = "ID"
    metric: str
    threshold: float
    window: str = "1h"
    cooldown_menit: int = 60
    dibuat_oleh: str = Field("Analis", max_length=120)


def _get_rule(db: Session, rule_id: int) -> SocialAlertRule:
    rule = db.get(SocialAlertRule, rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="aturan tidak ditemukan")
    return rule


@router.get("/alert-rules")
def list_alert_rules(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Daftar aturan alert beserta pilihan metrik dan jendela."""
    rules = db.query(SocialAlertRule).order_by(SocialAlertRule.created_at.desc()).all()
    return {"metrics": ALERT_METRICS, "windows": list(ALERT_WINDOWS), "rules": [rule_payload(r) for r in rules]}


@router.post("/alert-rules")
def create_alert_rule(payload: AlertRuleIn, db: Session = Depends(get_db)) -> Dict[str, Any]:
    try:
        data = validate_rule(payload.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    rule = SocialAlertRule(**data)
    db.add(rule)
    db.commit()
    db.refresh(rule)
    record_audit(db, aktor=rule.dibuat_oleh, peran="Analis", aksi="BUAT_ATURAN_ALERT_MEDSOS",
                 objek=f"social-alert-rule:{rule.id}", detail=rule_payload(rule))
    return rule_payload(rule)


@router.put("/alert-rules/{rule_id}")
def update_alert_rule(rule_id: int, payload: AlertRuleIn, db: Session = Depends(get_db)) -> Dict[str, Any]:
    rule = _get_rule(db, rule_id)
    try:
        data = validate_rule(payload.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    for k, v in data.items():
        setattr(rule, k, v)
    db.commit()
    record_audit(db, aktor=data["dibuat_oleh"], peran="Analis", aksi="UBAH_ATURAN_ALERT_MEDSOS",
                 objek=f"social-alert-rule:{rule.id}", detail=rule_payload(rule))
    return rule_payload(rule)


@router.delete("/alert-rules/{rule_id}")
def delete_alert_rule(rule_id: int, db: Session = Depends(get_db)) -> Dict[str, Any]:
    rule = _get_rule(db, rule_id)
    snapshot = rule_payload(rule)
    db.query(SocialAlertEvent).filter(SocialAlertEvent.rule_id == rule.id).delete()
    db.delete(rule)
    db.commit()
    record_audit(db, aktor="Analis", peran="Analis", aksi="HAPUS_ATURAN_ALERT_MEDSOS",
                 objek=f"social-alert-rule:{rule_id}", detail=snapshot)
    return {"deleted": rule_id}


@router.post("/alert-rules/{rule_id}/test")
def test_alert_rule(rule_id: int, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Hitung nilai aturan saat ini tanpa mencatat kejadian, untuk mengecek ambang."""
    rule = _get_rule(db, rule_id)
    m = measure_rule(db, rule)
    return {
        "value": m["value"],
        "threshold": rule.threshold,
        "would_trigger": m["value"] >= rule.threshold,
        "volume": m["volume"],
        "negatif": m["negatif"],
        "baseline_ready": m["baseline_ready"],
    }


@router.post("/alert-rules/evaluate")
def run_alert_rules(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Evaluasi semua aturan aktif sekarang (juga berjalan otomatis setelah tarik data)."""
    return evaluate_rules(db)


@router.get("/alert-events")
def list_alert_events(
    status: Optional[str] = Query(None, description="baru atau dilihat"),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    q = db.query(SocialAlertEvent)
    if status:
        q = q.filter(SocialAlertEvent.status == status)
    events = q.order_by(SocialAlertEvent.triggered_at.desc(), SocialAlertEvent.id.desc()).limit(limit).all()
    unread = db.query(SocialAlertEvent).filter(SocialAlertEvent.status == "baru").count()
    return {"unread": unread, "events": [event_payload(e) for e in events]}


class AckIn(BaseModel):
    aktor: str = Field("Analis", max_length=120)


@router.post("/alert-events/{event_id}/ack")
def ack_alert_event(event_id: int, payload: AckIn, db: Session = Depends(get_db)) -> Dict[str, Any]:
    event = db.get(SocialAlertEvent, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="kejadian alert tidak ditemukan")
    event.status = "dilihat"
    event.dilihat_oleh = (payload.aktor or "Analis").strip()[:120] or "Analis"
    db.commit()
    record_audit(db, aktor=event.dilihat_oleh, peran="Analis", aksi="LIHAT_ALERT_MEDSOS",
                 objek=f"social-alert-event:{event.id}")
    return event_payload(event)


@router.get("/heatmap")
def read_region_category_heatmap(
    time_range: str = Depends(period_param),
    scope_kode: str = Query("ID", description="Kode wilayah Kemendagri"),
    scope_mode: str = Query("context", description="Mode filter: context, strict, regional"),
    multi_codes: Optional[str] = Query(None, description="Kode multi-wilayah dipisah koma"),
    platform: Optional[str] = Query(None, description="Filter platform"),
    agency: Optional[str] = Query(None, description="Filter instansi"),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Matriks kota/kabupaten x kategori untuk melihat kategori yang ramai di setiap wilayah."""
    codes_list = [c.strip() for c in multi_codes.split(",")] if multi_codes else None
    return get_region_category_heatmap(db, time_range, scope_kode, scope_mode, codes_list, platform, agency)


class WatchedAccountIn(BaseModel):
    handle: str = Field(..., max_length=200)
    label: Optional[str] = Field(None, max_length=150)
    kelompok: str = "lainnya"
    catatan: Optional[str] = Field(None, max_length=1000)
    dibuat_oleh: str = Field("Analis", max_length=120)


@router.get("/watched-accounts")
def read_watched_accounts(
    time_range: str = Depends(period_param),
    scope_kode: str = Query("ID", description="Kode wilayah Kemendagri"),
    scope_mode: str = Query("context", description="Mode filter: context, strict, regional"),
    multi_codes: Optional[str] = Query(None, description="Kode multi-wilayah dipisah koma"),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Aktivitas akun pantauan pada periode aktif, plus saran akun aktif yang belum dipantau."""
    codes_list = [c.strip() for c in multi_codes.split(",")] if multi_codes else None
    return get_account_activity(db, time_range, scope_kode, scope_mode, codes_list)


@router.post("/watched-accounts")
def create_watched_account(payload: WatchedAccountIn, db: Session = Depends(get_db)) -> Dict[str, Any]:
    try:
        return add_account(db, payload.handle, payload.label, payload.kelompok, payload.catatan, payload.dibuat_oleh)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


@router.delete("/watched-accounts/{account_id}")
def delete_watched_account(account_id: int, db: Session = Depends(get_db)) -> Dict[str, Any]:
    if not remove_account(db, account_id):
        raise HTTPException(status_code=404, detail="akun pantauan tidak ditemukan")
    return {"deleted": account_id}


def _search_filters(
    q: Optional[str] = Query(None, max_length=200, description='Kata kunci; frasa dalam tanda kutip, mis. "jalan rusak"'),
    time_range: str = Depends(period_param),
    scope_kode: str = Query("ID"),
    scope_mode: str = Query("context"),
    platform: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    agency: Optional[str] = Query(None),
    emotion: Optional[str] = Query(None),
    sentimen: Optional[str] = Query(None),
    author: Optional[str] = Query(None, max_length=120),
    sort: str = Query("terbaru", description="terbaru, terlama, jangkauan"),
) -> Dict[str, Any]:
    return {
        "q": q, "time_range": time_range, "scope_kode": scope_kode, "scope_mode": scope_mode, "platform": platform,
        "category": category, "agency": agency, "emotion": emotion, "sentimen": sentimen, "author": author,
        "sort": sort if sort in SEARCH_SORTS else "terbaru",
    }


@router.get("/search")
def search_content(
    filters: Dict[str, Any] = Depends(_search_filters),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=5, le=100),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Cari konten medsos tersimpan dengan filter teks, periode, platform, kategori, instansi, emosi, sentimen, dan akun."""
    return search_social_content(db, page=page, page_size=page_size, **filters)


@router.get("/search/export")
def export_search(filters: Dict[str, Any] = Depends(_search_filters), db: Session = Depends(get_db)) -> StreamingResponse:
    """Unduh hasil pencarian sebagai CSV (maksimal 5.000 baris)."""
    return StreamingResponse(
        export_social_content_csv(db, **filters),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="social-pulse-konten.csv"'},
    )


@router.get("/brief")
def read_social_brief(
    time_range: str = Depends(period_param),
    scope_kode: str = Query("ID", description="Kode wilayah Kemendagri"),
    scope_mode: str = Query("context", description="Mode filter: context, strict, regional"),
    multi_codes: Optional[str] = Query(None, description="Kode multi-wilayah dipisah koma"),
    category: Optional[str] = Query(None, description="Filter kategori"),
    agency: Optional[str] = Query(None, description="Filter instansi"),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Ringkasan situasi beberapa kalimat untuk pimpinan, dihitung dari data periode dan filter aktif."""
    codes_list = [c.strip() for c in multi_codes.split(",")] if multi_codes else None
    return get_social_brief(db, time_range, scope_kode, scope_mode, codes_list, category, agency)


@router.get("/taxonomy")
def read_social_taxonomy() -> Dict[str, Any]:
    """Daftar kategori dan instansi yang dikenali beserta id-nya untuk filter."""
    return social_catalog()


@router.get("/facets")
def read_social_facets(
    time_range: str = Depends(period_param),
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
    time_range: str = Depends(period_param),
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
    time_range: str = Depends(period_param),
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    """Membandingkan indikator intelijen sosial antarwilayah (FR-GEO-06)."""
    codes_list = [c.strip() for c in codes.split(",") if c.strip()]
    return get_social_geographic_comparison(db, scope_codes=codes_list, time_range=time_range)
