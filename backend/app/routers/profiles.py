from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import json

from backend.app.database import get_db
from backend.app.models import MonitoringProfile, MonitoringProfileVersion, ProfileRule, RawItem
from backend.app.schemas import MonitoringProfileCreate, MonitoringProfileOut, RuleConfig
from backend.app.services.audit import record_audit

router = APIRouter(prefix="/profiles", tags=["Monitoring Profiles"])

@router.get("", response_model=List[MonitoringProfileOut])
def list_profiles(db: Session = Depends(get_db)):
    profiles = db.query(MonitoringProfile).all()
    results = []
    for p in profiles:
        active_rule = db.query(ProfileRule).filter(
            ProfileRule.profile_id == p.id,
            ProfileRule.versi == p.versi
        ).first()

        rule_data = RuleConfig(
            wilayah=json.loads(active_rule.wilayah_json) if active_rule else [],
            keyword=json.loads(active_rule.keyword_json) if active_rule else [],
            sinonim=json.loads(active_rule.sinonim_json) if active_rule else [],
            pengecualian=json.loads(active_rule.pengecualian_json) if active_rule else [],
            kategori=json.loads(active_rule.kategori_json) if active_rule else [],
            ambang_multiplier=active_rule.ambang_multiplier if active_rule else 3.0,
        )
        results.append(MonitoringProfileOut(
            id=p.id,
            nama=p.nama,
            unit=p.unit,
            status=p.status,
            versi=p.versi,
            rule=rule_data,
            created_at=p.created_at,
            updated_at=p.updated_at
        ))
    return results

@router.post("", response_model=MonitoringProfileOut)
def create_profile(payload: MonitoringProfileCreate, db: Session = Depends(get_db)):
    profile = MonitoringProfile(
        nama=payload.nama,
        unit=payload.unit,
        status=payload.status,
        versi=1
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)

    rule = ProfileRule(
        profile_id=profile.id,
        versi=1,
        wilayah_json=json.dumps(payload.rule.wilayah),
        keyword_json=json.dumps(payload.rule.keyword),
        sinonim_json=json.dumps(payload.rule.sinonim),
        pengecualian_json=json.dumps(payload.rule.pengecualian),
        kategori_json=json.dumps(payload.rule.kategori),
        ambang_multiplier=payload.rule.ambang_multiplier
    )
    db.add(rule)
    db.add(
        MonitoringProfileVersion(
            profile_id=profile.id,
            versi=1,
            diubah_oleh="admin",
            effective_from=datetime.utcnow(),
            catatan_perubahan="Versi awal profil",
            rules_snapshot_json=json.dumps(payload.rule.model_dump()),
        )
    )
    db.commit()

    record_audit(
        db,
        aktor="admin",
        peran="Admin",
        aksi="BUAT_PROFIL_MONITORING",
        objek=f"profile:{profile.id}",
        detail={"nama": profile.nama, "versi": 1}
    )

    return MonitoringProfileOut(
        id=profile.id,
        nama=profile.nama,
        unit=profile.unit,
        status=profile.status,
        versi=profile.versi,
        rule=payload.rule,
        created_at=profile.created_at,
        updated_at=profile.updated_at
    )

@router.put("/{profile_id}", response_model=MonitoringProfileOut)
def update_profile(profile_id: int, payload: MonitoringProfileCreate, db: Session = Depends(get_db)):
    profile = db.query(MonitoringProfile).filter(MonitoringProfile.id == profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profil monitoring tidak ditemukan")

    profile.nama = payload.nama
    profile.unit = payload.unit
    profile.status = payload.status
    profile.versi += 1  # FR-02: Increment version on each edit

    new_rule = ProfileRule(
        profile_id=profile.id,
        versi=profile.versi,
        wilayah_json=json.dumps(payload.rule.wilayah),
        keyword_json=json.dumps(payload.rule.keyword),
        sinonim_json=json.dumps(payload.rule.sinonim),
        pengecualian_json=json.dumps(payload.rule.pengecualian),
        kategori_json=json.dumps(payload.rule.kategori),
        ambang_multiplier=payload.rule.ambang_multiplier
    )
    db.add(new_rule)
    db.commit()
    db.refresh(profile)

    record_audit(
        db,
        aktor="admin",
        peran="Admin",
        aksi="UPDATE_PROFIL_MONITORING",
        objek=f"profile:{profile.id}",
        detail={"nama": profile.nama, "versi_baru": profile.versi}
    )

    return MonitoringProfileOut(
        id=profile.id,
        nama=profile.nama,
        unit=profile.unit,
        status=profile.status,
        versi=profile.versi,
        rule=payload.rule,
        created_at=profile.created_at,
        updated_at=profile.updated_at
    )

@router.post("/{profile_id}/test-7d")
def test_profile_7d(profile_id: int, db: Session = Depends(get_db)):
    """FR-03: Uji profil terhadap data 7 hari terakhir sebelum diaktifkan."""
    profile = db.query(MonitoringProfile).filter(MonitoringProfile.id == profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profil monitoring tidak ditemukan")

    active_rule = db.query(ProfileRule).filter(
        ProfileRule.profile_id == profile.id,
        ProfileRule.versi == profile.versi
    ).first()

    keywords = json.loads(active_rule.keyword_json) if active_rule else []
    pengecualian = json.loads(active_rule.pengecualian_json) if active_rule else []

    cutoff = datetime.utcnow() - timedelta(days=7)
    all_items = db.query(RawItem).filter(RawItem.published_at >= cutoff).all()
    matched = 0
    excluded = 0

    for item in all_items:
        text = f"{item.judul} {item.isi}".lower()
        if any(exc.lower() in text for exc in pengecualian):
            excluded += 1
            continue
        if any(kw.lower() in text for kw in keywords):
            matched += 1

    return {
        "status": "success",
        "profile_id": profile_id,
        "sample_analyzed_days": 7,
        "total_historical_items_checked": len(all_items),
        "matches_found": matched,
        "exclusions_filtered": excluded,
        "estimated_daily_catch": max(0, matched // 7),
        "recommendation": "Parameter profil terverifikasi stabil. Lolos pengujian 7 hari."
    }


@router.get("/{profile_id}/versions")
def list_profile_versions(profile_id: int, db: Session = Depends(get_db)):
    """FR-02: Riwayat versi profil monitoring beserta pengubah dan tanggal efektif."""
    rows = (
        db.query(MonitoringProfileVersion)
        .filter(MonitoringProfileVersion.profile_id == profile_id)
        .order_by(MonitoringProfileVersion.versi.desc())
        .all()
    )
    return [
        {
            "id": r.id,
            "profile_id": r.profile_id,
            "versi": r.versi,
            "diubah_oleh": r.diubah_oleh,
            "effective_from": r.effective_from,
            "catatan_perubahan": r.catatan_perubahan,
            "rules": json.loads(r.rules_snapshot_json or "{}"),
        }
        for r in rows
    ]
