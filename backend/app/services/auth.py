"""Autentikasi, MFA TOTP, RBAC, dan pembatasan wilayah (FR-22, NFR-07, NFR-08)."""

from __future__ import annotations

import hashlib
import hmac
import json
import os
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

import httpx
import pyotp
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from backend.app.config import settings
from backend.app.database import get_db
from backend.app.models import User

security_scheme = HTTPBearer(auto_error=False)

VALID_ROLES = ("admin", "analis", "verifikator", "eksekutif")


def hash_password(password: str) -> str:
    salt = os.urandom(16).hex()
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 120_000).hex()
    return f"pbkdf2_sha256${salt}${dk}"


def verify_password(password: str, stored_hash: str) -> bool:
    if not stored_hash or "$" not in stored_hash:
        return False
    parts = stored_hash.split("$")
    if len(parts) != 3 or parts[0] != "pbkdf2_sha256":
        return False
    _, salt, expected = parts
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 120_000).hex()
    return hmac.compare_digest(dk, expected)


def create_access_token(user: User, expires_minutes: Optional[int] = None) -> str:
    expire = datetime.utcnow() + timedelta(minutes=expires_minutes or settings.JWT_EXPIRE_MINUTES)
    scope = json.loads(user.wilayah_scope_json or '["ID"]')
    payload = {
        "sub": str(user.id),
        "email": user.email,
        "nama": user.nama,
        "role": user.role,
        "wilayah_scope": scope,
        "exp": expire,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> Dict[str, Any]:
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])


def generate_mfa_secret() -> str:
    return pyotp.random_base32()


def verify_mfa_code(secret: str, code: str) -> bool:
    if not secret or not code:
        return False
    return pyotp.TOTP(secret).verify(code.strip(), valid_window=1)


def exchange_keycloak_code(code: str, redirect_uri: str) -> Optional[Dict[str, Any]]:
    """Tukar authorization code Keycloak OIDC menjadi profil user."""
    if not settings.KEYCLOAK_ENABLED:
        return None
    token_url = f"{settings.KEYCLOAK_SERVER_URL}/realms/{settings.KEYCLOAK_REALM}/protocol/openid-connect/token"
    userinfo_url = f"{settings.KEYCLOAK_SERVER_URL}/realms/{settings.KEYCLOAK_REALM}/protocol/openid-connect/userinfo"
    with httpx.Client(timeout=10.0) as client:
        resp = client.post(
            token_url,
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": redirect_uri,
                "client_id": settings.KEYCLOAK_CLIENT_ID,
                "client_secret": settings.KEYCLOAK_CLIENT_SECRET,
            },
        )
        if resp.status_code != 200:
            return None
        access_token = resp.json().get("access_token")
        info = client.get(userinfo_url, headers={"Authorization": f"Bearer {access_token}"})
        if info.status_code != 200:
            return None
        return info.json()


def mask_account_pii(value: Optional[str]) -> Optional[str]:
    """Samarkan akun/identitas pelapor non-publik (NFR-11)."""
    if not value:
        return value
    s = value.strip()
    if len(s) <= 3:
        return "***"
    prefix = "@" if s.startswith("@") else ""
    core = s[1:] if prefix else s
    if len(core) <= 3:
        return f"{prefix}{core[0]}**"
    return f"{prefix}{core[:2]}{'*' * min(6, len(core) - 3)}{core[-1]}"


def ensure_default_admin(db: Session) -> User:
    """Pastikan ada akun admin bawaan untuk bootstrap pertama kali."""
    admin = db.query(User).filter(User.email == "admin@tip-media.local").first()
    if not admin:
        admin = User(
            email="admin@tip-media.local",
            nama="Administrator TIP",
            hashed_password=hash_password("AdminTIP2026!"),
            role="admin",
            wilayah_scope_json='["ID"]',
            mfa_enabled=False,
            is_active=True,
        )
        db.add(admin)
        db.commit()
        db.refresh(admin)
    return admin


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
    db: Session = Depends(get_db),
) -> Optional[User]:
    if credentials and credentials.credentials:
        try:
            payload = decode_token(credentials.credentials)
            user_id = int(payload.get("sub", 0))
            user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
            if user:
                return user
        except (JWTError, ValueError):
            if settings.AUTH_REQUIRED:
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token tidak valid atau kedaluwarsa")

    if settings.AUTH_REQUIRED:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Autentikasi diperlukan")
    return None


def require_roles(allowed_roles: List[str]):
    def _dep(user: Optional[User] = Depends(get_current_user)) -> Optional[User]:
        if user is None:
            if settings.AUTH_REQUIRED:
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Autentikasi diperlukan")
            return None
        if user.role not in allowed_roles and user.role != "admin":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"Peran '{user.role}' tidak memiliki akses")
        return user
    return _dep


def resolve_user_scope(requested_scope: str, user: Optional[User]) -> str:
    """Batasi scope wilayah sesuai cakupan RBAC user (NFR-07)."""
    if user is None or user.role == "admin":
        return requested_scope
    scopes = json.loads(user.wilayah_scope_json or '["ID"]')
    if "ID" in scopes:
        return requested_scope
    if requested_scope == "ID" or not any(
        requested_scope == s or requested_scope.startswith(f"{s}.") for s in scopes
    ):
        return scopes[0]
    return requested_scope
