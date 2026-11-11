from datetime import datetime
import json
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from backend.app.models import Source, RawItem, ItemAnalysis, MonitoringProfile, Issue, IssueItem
from backend.app.services.dedup import compute_content_hash, is_near_duplicate
from backend.app.services.ai_analyzer import analyze_sentiment, analyze_topic, extract_locations

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
    published_at: Optional[datetime] = None
) -> Dict[str, Any]:
    """
    Ingest a single content piece:
    - Deduplication: exact hash & near duplicate check
    - AI classification: sentiment, topic, location
    - Save raw_item and item_analysis
    """
    if published_at is None:
        published_at = datetime.utcnow()

    content_hash = compute_content_hash(title, body)

    # 1. Exact hash duplicate check
    existing = db.query(RawItem).filter(RawItem.hash == content_hash).first()
    if existing:
        return {
            "status": "duplicate_exact",
            "item_id": existing.id,
            "message": "Konten sama persis sudah tersimpan"
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
    raw_item = RawItem(
        source_id=source_id,
        url_kanonik=url,
        hash=content_hash,
        judul=title,
        isi=body,
        penerbit=penerbit,
        penulis=penulis,
        published_at=published_at,
        fetched_at=datetime.utcnow()
    )
    db.add(raw_item)
    db.commit()
    db.refresh(raw_item)

    # 4. AI Analysis
    sentimen, sentimen_conf = analyze_sentiment(f"{title} {body}")
    topik, topik_conf = analyze_topic(f"{title} {body}")
    lokasi_prim, lokasi_disebut, lokasi_conf = extract_locations(f"{title} {body}")

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
        model_version="indobert-multilingual-e5-v1"
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
        "lokasi": lokasi_prim
    }
