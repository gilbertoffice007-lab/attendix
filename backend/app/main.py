from __future__ import annotations

import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from starlette.middleware.base import BaseHTTPMiddleware

from app import __version__
from app.api.v1.router import api_router
from app.core.config import settings
from app.core.logging import configure_logging
from app.core.security import ACCESS_TOKEN_COOKIE, CSRF_COOKIE, CSRF_HEADER
from app.db.session import SessionLocal

configure_logging()
logger = logging.getLogger("attendance")


@asynccontextmanager
async def lifespan(_: FastAPI):
    validate_production_config()
    yield


app = FastAPI(
    title=settings.app_name,
    lifespan=lifespan,
    version=__version__,
    description=(
        "Versioned REST API for the Cloud-Based Attendance Management System. "
        "Roles: Admin, Faculty and Student. Authentication uses a short-lived "
        "HttpOnly JWT cookie plus a CSRF double-submit token for state-changing requests."
    ),
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition", "X-CSRF-Token"],
)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response


class CSRFMiddleware(BaseHTTPMiddleware):
    """Double-submit CSRF check for cookie-authenticated unsafe requests."""

    EXEMPT_PATHS = {
        "/api/v1/auth/login",
        "/api/v1/auth/register",
        "/api/v1/auth/register/student",
        "/api/v1/auth/setup",
    }
    SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}

    async def dispatch(self, request: Request, call_next):
        if (
            request.method not in self.SAFE_METHODS
            and request.url.path not in self.EXEMPT_PATHS
            and request.cookies.get(ACCESS_TOKEN_COOKIE)
        ):
            cookie_token = request.cookies.get(CSRF_COOKIE)
            header_token = request.headers.get(CSRF_HEADER)
            if not cookie_token or not header_token or cookie_token != header_token:
                return JSONResponse(
                    status_code=status.HTTP_403_FORBIDDEN,
                    content={"detail": "CSRF verification failed. Refresh and try again."},
                )
        return await call_next(request)


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        started = time.perf_counter()
        response = await call_next(request)
        duration_ms = (time.perf_counter() - started) * 1000
        if request.url.path not in ("/health",):
            logger.info(
                "%s %s -> %s (%.1fms)",
                request.method,
                request.url.path,
                response.status_code,
                duration_ms,
            )
        return response


app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(CSRFMiddleware)
app.add_middleware(RequestLoggingMiddleware)

app.include_router(api_router, prefix=settings.api_v1_prefix)


@app.get("/health", tags=["Health"])
def health():
    try:
        with SessionLocal() as db:
            db.execute(text("SELECT 1"))
        return {
            "status": "ok",
            "database": "ok",
            "environment": settings.app_env,
            "version": __version__,
        }
    except Exception:
        logger.exception("Health check database failure")
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "status": "degraded",
                "database": "unavailable",
                "environment": settings.app_env,
                "version": __version__,
            },
        )


@app.get("/", include_in_schema=False)
def root():
    return {
        "name": settings.app_name,
        "version": __version__,
        "docs": "/docs",
        "health": "/health",
        "api": settings.api_v1_prefix,
    }


def validate_production_config() -> None:
    if settings.is_production:
        if settings.jwt_secret_key.startswith("dev-only"):
            raise RuntimeError("JWT_SECRET_KEY must be changed in production")
        if settings.cookie_samesite == "none" and not settings.cookie_secure:
            raise RuntimeError("COOKIE_SECURE must be true when COOKIE_SAMESITE=none")
    logger.info(
        "Starting %s v%s in %s mode", settings.app_name, __version__, settings.app_env
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "An unexpected server error occurred. Please try again."},
    )
