from datetime import datetime
import json
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from backend.app.models import Source, RawItem, ItemAnalysis, MonitoringProfile, Issue, IssueItem
from backend.app.services.dedup import compute_content_hash, is_near_duplicate
from backend.app.services.ai_analyzer import analyze_sentiment, analyze_topic, extract_locations
from backend.app.services.jev_triage import evaluate_binary_triage
from backend.app.services.social_platform import legacy_platform

# Versi nyata mesin analisis (leksikon + aturan gazetir + jev triage), bukan model transformer.
MODEL_VERSION = "leksikon-id-gazetir-v2-jev"

_ENG_FIELDS = {
    "likes": "eng_likes",
    "shares": "eng_shares",
    "replies": "eng_replies",
    "views": "eng_views",
    "followers": "author_followers",
}


def _refresh_engagement(item: RawItem, engagement: Dict[str, Optional[int]]) -> bool:
    """Perbarui angka engagement item yang ditarik ulang. Nilai NULL dari sumber tidak menimpa angka lama."""
    changed = False
    for key, column in _ENG_FIELDS.items():
        value = engagement.get(key)
        if value is not None and getattr(item, column) != value:
            setattr(item, column, value)
            changed = True
    return changed


def can_fetch_source(source: Source) -> bool:
    """Check if source is legally permitted and active."""
    return source.status_izin == "aktif"

def ingest_content_item(
    db: Session,
    source_id: Optional[int],
    url: str,
    title: str,
    body: str,
    penerbit: str = "Media Online",
    penulis: Optional[str] = None,
    published_at: Optional[datetime] = None,
    platform: Optional[str] = None,
    engagement: Optional[Dict[str, Optional[int]]] = None,
) -> Dict[str, Any]:
    """
    Ingest a single content piece:
    - Deduplication: exact hash & near duplicate check
    - AI classification: sentiment, topic, location
    - Save raw_item and item_analysis

    `platform` adalah platform asal (lihat social_platform.resolve_platform). Bila kosong,
    ditebak dari URL dan penerbit. `engagement` berisi likes/shares/replies/views/followers
    bila sumber menyediakannya; kunci yang tidak ada disimpan sebagai NULL.
    """
    if published_at is None:
        published_at = datetime.utcnow()

    content_hash = compute_content_hash(title, body)

    # 1. Exact hash duplicate check
    existing = db.query(RawItem).filter(RawItem.hash == content_hash).first()
    if existing:
        if engagement and url and existing.url_kanonik == url and _refresh_engagement(existing, engagement):
            db.commit()
        return {
            "status": "duplicate_exact",
            "item_id": existing.id,
            "message": "Konten sama persis sudah tersimpan"
        }

    # 1b. URL duplicate check: kolom url_kanonik unik, jadi cek sebelum insert.
    if url:
        existing_url = db.query(RawItem).filter(RawItem.url_kanonik == url).first()
        if existing_url:
            if engagement and _refresh_engagement(existing_url, engagement):
                db.commit()
            return {
                "status": "duplicate_exact",
                "item_id": existing_url.id,
                "message": "URL ini sudah tersimpan",
            }

    # 2. Near-duplicate check with recent items
    recent_items = db.query(RawItem).order_by(RawItem.id.desc()).limit(50).all()
    is_repost = False
    for r in recent_items:
        is_dup, sim = is_near_duplicate(title, body, r.judul, r.isi, threshold=0.70)
        if is_dup:
            is_repost = True
            break

    # 3. Create RawItem
    eng = engagement or {}
    raw_item = RawItem(
        source_id=source_id,
        url_kanonik=url,
        hash=content_hash,
        judul=title,
        isi=body,
        penerbit=penerbit,
        penulis=penulis,
        published_at=published_at,
        fetched_at=datetime.utcnow(),
        platform=platform or legacy_platform(penerbit, url, title),
        eng_likes=eng.get("likes"),
        eng_shares=eng.get("shares"),
        eng_replies=eng.get("replies"),
        eng_views=eng.get("views"),
        author_followers=eng.get("followers"),
    )
    db.add(raw_item)
    db.commit()
    db.refresh(raw_item)

    # 3.5. JEV Fast-Binary Triage Gatekeeper
    triage = evaluate_binary_triage(title, body, publisher=penerbit)

    # 4. AI Analysis
    sentimen, sentimen_conf = analyze_sentiment(f"{title} {body}")
    topik, topik_conf = analyze_topic(f"{title} {body}")
    lokasi_prim, lokasi_disebut, lokasi_conf = extract_locations(f"{title} {body}")

    # If flagged as commercial promo noise by Jev with high confidence, classify appropriately
    if triage.is_noise_or_promo and triage.confidence >= 0.85:
        topik = "Komersial"
        sentimen = "netral"

    analysis = ItemAnalysis(
        item_id=raw_item.id,
        sentimen=sentimen,
        sentimen_confidence=sentimen_conf,
        topik=topik,
        topik_confidence=topik_conf,
        lokasi_kejadian=lokasi_prim,
        lokasi_disebut_json=json.dumps(lokasi_disebut),
        lokasi_confidence=lokasi_conf,
        ringkasan=f"{title}. Dilaporkan oleh {penerbit} terkait {topik.lower()} di wilayah {lokasi_prim or 'Jabodetabek'}.",
        model_version=MODEL_VERSION
    )
    db.add(analysis)
    db.commit()
    db.refresh(analysis)

    return {
        "status": "ingested",
        "item_id": raw_item.id,
        "is_repost": is_repost,
        "sentimen": sentimen,
        "topik": topik,
        "lokasi": lokasi_prim,
        "triage_incident": triage.is_incident_jabodetabek,
        "triage_dispatch": triage.requires_analyst_dispatch,
    }
