import json
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models import User
from backend.app.services.audit import record_audit
from backend.app.services.auth import VALID_ROLES, hash_password, require_roles

router = APIRouter(prefix="/users", tags=["User & RBAC Management"])


class UserCreate(BaseModel):
    email: str
    nama: str
    password: str
    role: str = "analis"
    wilayah_scope: List[str] = ["ID"]


class UserUpdate(BaseModel):
    nama: Optional[str] = None
    role: Optional[str] = None
    wilayah_scope: Optional[List[str]] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None


def _serialize_user(u: User) -> dict:
    return {
        "id": u.id,
        "email": u.email,
        "nama": u.nama,
        "role": u.role,
        "wilayah_scope": json.loads(u.wilayah_scope_json or '["ID"]'),
        "mfa_enabled": u.mfa_enabled,
        "is_active": u.is_active,
        "created_at": u.created_at,
        "last_login_at": u.last_login_at,
    }


@router.get("")
def list_users(
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(require_roles(["admin"])),
):
    users = db.query(User).order_by(User.created_at.desc()).all()
    return [_serialize_user(u) for u in users]


@router.post("")
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(require_roles(["admin"])),
):
    if payload.role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Peran harus salah satu dari: {', '.join(VALID_ROLES)}")
    email = payload.email.strip().lower()
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=409, detail="Email sudah terdaftar")

    user = User(
        email=email,
        nama=payload.nama.strip(),
        hashed_password=hash_password(payload.password),
        role=payload.role,
        wilayah_scope_json=json.dumps(payload.wilayah_scope or ["ID"]),
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    record_audit(
        db,
        aktor=current_user.email if current_user else "Admin",
        peran="admin",
        aksi="CREATE_USER",
        objek=f"user:{user.id}",
        detail={"email": user.email, "role": user.role, "scope": payload.wilayah_scope},
    )
    return _serialize_user(user)


@router.patch("/{user_id}")
def update_user(
    user_id: int,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(require_roles(["admin"])),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Pengguna tidak ditemukan")
    if payload.role is not None:
        if payload.role not in VALID_ROLES:
            raise HTTPException(status_code=400, detail=f"Peran tidak valid: {payload.role}")
        user.role = payload.role
    if payload.nama is not None:
        user.nama = payload.nama.strip()
    if payload.wilayah_scope is not None:
        user.wilayah_scope_json = json.dumps(payload.wilayah_scope)
    if payload.is_active is not None:
        user.is_active = payload.is_active
    if payload.password:
        user.hashed_password = hash_password(payload.password)

    db.commit()
    db.refresh(user)
    record_audit(
        db,
        aktor=current_user.email if current_user else "Admin",
        peran="admin",
        aksi="UPDATE_USER",
        objek=f"user:{user.id}",
        detail={"role": user.role, "is_active": user.is_active},
    )
    return _serialize_user(user)
