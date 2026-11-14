"""Endpoint menu Pantau Keyword: daftar keyword, ringkasan sebutan dan sentimen, daftar sebutan."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models import KeywordMention, KeywordProject
from backend.app.services import keyword_monitor as km

router = APIRouter(prefix="/keyword", tags=["Pantau Keyword"])


class ProjectCreate(BaseModel):
    nama: str = Field(..., max_length=120)
    kata_kunci: List[str] = Field(default_factory=list, max_length=km.MAX_TERMS)
    kecualikan: List[str] = Field(default_factory=list, max_length=20)


class ProjectUpdate(BaseModel):
    nama: Optional[str] = Field(None, max_length=120)
    kata_kunci: Optional[List[str]] = Field(None, max_length=km.MAX_TERMS)
    kecualikan: Optional[List[str]] = Field(None, max_length=20)
    aktif: Optional[bool] = None


class SentimentUpdate(BaseModel):
    sentimen: str


def _project(db: Session, project_id: int) -> KeywordProject:
    p = db.get(KeywordProject, project_id)
    if not p:
        raise HTTPException(status_code=404, detail="Keyword tidak ditemukan")
    return p


def _periode(periode: str = Query("7d", description="today, 7d, atau 30d")) -> str:
    if periode not in km.PERIODS:
        raise HTTPException(status_code=422, detail="periode harus today, 7d, atau 30d")
    return periode


@router.get("")
def list_projects(db: Session = Depends(get_db)) -> Dict[str, Any]:
    return {"proyek": km.list_projects(db), "maks_kata": km.MAX_TERMS}


@router.post("", status_code=201)
def create_project(body: ProjectCreate, db: Session = Depends(get_db)) -> Dict[str, Any]:
    try:
        p = km.create_project(db, body.nama, body.kata_kunci, body.kecualikan)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    km.start_collection(p.id)
    return km.project_brief(db, p)


@router.patch("/{project_id}")
def update_project(project_id: int, body: ProjectUpdate, db: Session = Depends(get_db)) -> Dict[str, Any]:
    p = _project(db, project_id)
    terms_changed = body.kata_kunci is not None
    try:
        km.update_project(db, p, body.nama, body.kata_kunci, body.kecualikan, body.aktif)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    if terms_changed and p.aktif:
        km.start_collection(p.id)
    return km.project_brief(db, p)


@router.delete("/{project_id}", status_code=204)
def delete_project(project_id: int, db: Session = Depends(get_db)) -> None:
    if km.is_running(project_id):
        raise HTTPException(status_code=409, detail="Keyword sedang ditarik, coba lagi setelah selesai")
    km.delete_project(db, _project(db, project_id))


@router.post("/{project_id}/tarik", status_code=202)
def collect_now(project_id: int, db: Session = Depends(get_db)) -> Dict[str, Any]:
    p = _project(db, project_id)
    started = km.start_collection(p.id)
    return {"dimulai": started, "proyek": km.project_brief(db, p)}


@router.get("/{project_id}")
def dashboard(
    project_id: int,
    periode: str = Depends(_periode),
    platform: str = Query("Semua"),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    return km.get_dashboard(db, _project(db, project_id), periode, platform)


@router.get("/{project_id}/sebutan")
def mentions(
    project_id: int,
    periode: str = Depends(_periode),
    platform: str = Query("Semua"),
    sentimen: Optional[str] = Query(None, description="positif, netral, atau negatif"),
    urut: str = Query("terbaru", description="terbaru atau populer"),
    isu: Optional[str] = Query(None, max_length=120),
    halaman: int = Query(1, ge=1, le=500),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    if urut not in km.MENTION_SORTS:
        raise HTTPException(status_code=422, detail="urut harus terbaru atau populer")
    if sentimen and sentimen not in km.SENTIMENTS:
        raise HTTPException(status_code=422, detail="sentimen harus positif, netral, atau negatif")
    return km.list_mentions(db, _project(db, project_id), periode, platform, sentimen, urut, isu, halaman)


@router.patch("/{project_id}/sebutan/{mention_id}")
def correct_sentiment(project_id: int, mention_id: int, body: SentimentUpdate, db: Session = Depends(get_db)) -> Dict[str, Any]:
    m = db.get(KeywordMention, mention_id)
    if not m or m.project_id != project_id:
        raise HTTPException(status_code=404, detail="Sebutan tidak ditemukan")
    try:
        km.set_manual_sentiment(db, m, body.sentimen)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    return {"id": m.id, "sentimen": m.sentimen, "sentimen_sumber": m.sentimen_sumber}
