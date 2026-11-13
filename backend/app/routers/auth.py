from datetime import datetime
import json
from typing import List, Optional

import pyotp
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.app.config import settings
from backend.app.database import get_db
from backend.app.models import User
from backend.app.services.audit import record_audit
from backend.app.services.auth import (
    create_access_token,
    ensure_default_admin,
    exchange_keycloak_code,
    generate_mfa_secret,
    get_current_user,
    verify_mfa_code,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["Authentication & MFA"])


class LoginRequest(BaseModel):
    email: str
    password: str
    mfa_code: Optional[str] = None


class MfaVerifyRequest(BaseModel):
    code: str


@router.post("/login")
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    ensure_default_admin(db)
    user = db.query(User).filter(User.email == payload.email.strip().lower()).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Email atau kata sandi salah")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Akun dinonaktifkan")

    if user.mfa_enabled:
        if not payload.mfa_code:
            return {"mfa_required": True, "message": "Masukkan kode OTP 6 digit dari aplikasi authenticator"}
        if not verify_mfa_code(user.mfa_secret or "", payload.mfa_code):
            raise HTTPException(status_code=401, detail="Kode MFA tidak valid")

    user.last_login_at = datetime.utcnow()
    db.commit()

    token = create_access_token(user)
    record_audit(
        db,
        aktor=user.email,
        peran=user.role,
        aksi="LOGIN",
        objek=f"user:{user.id}",
        detail={"mfa": user.mfa_enabled},
        ip=request.client.host if request.client else "127.0.0.1",
    )
    return {
        "mfa_required": False,
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "nama": user.nama,
            "role": user.role,
            "wilayah_scope": json.loads(user.wilayah_scope_json or '["ID"]'),
            "mfa_enabled": user.mfa_enabled,
        },
    }


@router.get("/me")
def get_me(user: Optional[User] = Depends(get_current_user)):
    if user is None:
        return {
            "authenticated": False,
            "auth_required": settings.AUTH_REQUIRED,
            "keycloak_enabled": settings.KEYCLOAK_ENABLED,
            "user": None,
        }
    return {
        "authenticated": True,
        "auth_required": settings.AUTH_REQUIRED,
        "keycloak_enabled": settings.KEYCLOAK_ENABLED,
        "user": {
            "id": user.id,
            "email": user.email,
            "nama": user.nama,
            "role": user.role,
            "wilayah_scope": json.loads(user.wilayah_scope_json or '["ID"]'),
            "mfa_enabled": user.mfa_enabled,
        },
    }


@router.post("/mfa/setup")
def setup_mfa(user: Optional[User] = Depends(get_current_user), db: Session = Depends(get_db)):
    if user is None:
        raise HTTPException(status_code=401, detail="Login diperlukan untuk mengatur MFA")
    secret = generate_mfa_secret()
    user.mfa_secret = secret
    db.commit()
    uri = pyotp.TOTP(secret).provisioning_uri(name=user.email, issuer_name="TIP Media Intelligence")
    return {"secret": secret, "otpauth_uri": uri}


@router.post("/mfa/enable")
def enable_mfa(payload: MfaVerifyRequest, user: Optional[User] = Depends(get_current_user), db: Session = Depends(get_db)):
    if user is None or not user.mfa_secret:
        raise HTTPException(status_code=400, detail="Setup MFA terlebih dahulu")
    if not verify_mfa_code(user.mfa_secret, payload.code):
        raise HTTPException(status_code=400, detail="Kode OTP tidak cocok")
    user.mfa_enabled = True
    db.commit()
    record_audit(db, aktor=user.email, peran=user.role, aksi="ENABLE_MFA", objek=f"user:{user.id}")
    return {"status": "mfa_enabled"}


@router.get("/oidc/url")
def get_oidc_login_url(redirect_uri: str = "http://localhost:3001/login"):
    if not settings.KEYCLOAK_ENABLED:
        return {"enabled": False, "url": None}
    auth_url = (
        f"{settings.KEYCLOAK_SERVER_URL}/realms/{settings.KEYCLOAK_REALM}/protocol/openid-connect/auth"
        f"?client_id={settings.KEYCLOAK_CLIENT_ID}&response_type=code&scope=openid%20email%20profile&redirect_uri={redirect_uri}"
    )
    return {"enabled": True, "url": auth_url}


@router.post("/oidc/callback")
def oidc_callback(code: str, redirect_uri: str = "http://localhost:3001/login", db: Session = Depends(get_db)):
    info = exchange_keycloak_code(code, redirect_uri)
    if not info:
        raise HTTPException(status_code=401, detail="Gagal verifikasi OIDC Keycloak")
    email = (info.get("email") or "").lower()
    sub = info.get("sub")
    user = db.query(User).filter((User.keycloak_sub == sub) | (User.email == email)).first()
    if not user:
        user = User(
            email=email,
            nama=info.get("name") or email,
            hashed_password="",
            role="analis",
            wilayah_scope_json='["ID"]',
            keycloak_sub=sub,
            mfa_enabled=True,
            is_active=True,
        )
        db.add(user)
    else:
        user.keycloak_sub = sub
        user.last_login_at = datetime.utcnow()
    db.commit()
    db.refresh(user)
    return {"access_token": create_access_token(user), "token_type": "bearer"}
