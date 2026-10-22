"""Password hashing, JWT and cookie helpers."""

from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError
from fastapi import Response

from app.core.config import settings

ACCESS_TOKEN_COOKIE = "attendance_access_token"
CSRF_COOKIE = "attendance_csrf_token"
CSRF_HEADER = "x-csrf-token"

_hasher = PasswordHasher()


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except (VerifyMismatchError, InvalidHashError):
        return False
    except Exception:
        return False


def create_access_token(user_id: int) -> str:
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "iat": now,
        "exp": now + timedelta(minutes=settings.access_token_expire_minutes),
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict[str, Any] | None:
    try:
        payload = jwt.decode(
            token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm]
        )
        if not payload.get("sub"):
            return None
        return payload
    except jwt.PyJWTError:
        return None


def generate_csrf_token() -> str:
    return secrets.token_urlsafe(32)


def set_csrf_cookie(response: Response, csrf_token: str) -> None:
    response.set_cookie(
        key=CSRF_COOKIE,
        value=csrf_token,
        httponly=False,
        max_age=settings.access_token_expire_minutes * 60,
        path="/",
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        domain=settings.cookie_domain or None,
    )


def set_auth_cookies(response: Response, token: str, csrf_token: str) -> None:
    max_age = settings.access_token_expire_minutes * 60
    common = {
        "max_age": max_age,
        "path": "/",
        "secure": settings.cookie_secure,
        "samesite": settings.cookie_samesite,
        "domain": settings.cookie_domain or None,
    }
    response.set_cookie(
        key=ACCESS_TOKEN_COOKIE, value=token, httponly=True, **common
    )
    set_csrf_cookie(response, csrf_token)


def clear_auth_cookies(response: Response) -> None:
    for key in (ACCESS_TOKEN_COOKIE, CSRF_COOKIE):
        response.delete_cookie(
            key=key,
            path="/",
            secure=settings.cookie_secure,
            samesite=settings.cookie_samesite,
            domain=settings.cookie_domain or None,
        )
