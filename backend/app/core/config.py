"""Application configuration loaded from environment variables."""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import make_url


class Settings(BaseSettings):
    app_name: str = "Cloud-Based Attendance Management System"
    app_env: Literal["development", "production", "test"] = "development"
    api_v1_prefix: str = "/api/v1"

    database_url: str = (
        "postgresql+psycopg://attendance:attendance@localhost:5432/attendance"
    )
    db_sslmode: str | None = None
    db_pool_size: int = 5
    db_max_overflow: int = 10

    jwt_secret_key: str = "dev-only-change-me-please-use-a-long-random-secret"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 480

    cors_origins: str = "http://localhost:5173"
    cookie_secure: bool = False
    cookie_samesite: Literal["lax", "strict", "none"] = "lax"
    cookie_domain: str | None = None

    allow_public_registration: bool = True
    default_attendance_threshold: int = 75
    log_level: str = "INFO"

    model_config = SettingsConfigDict(
        env_file=(".env",), env_file_encoding="utf-8", extra="ignore"
    )

    @field_validator("database_url")
    @classmethod
    def normalize_database_url(cls, value: str) -> str:
        """Render/Heroku style URLs need the psycopg3 SQLAlchemy dialect."""
        if value.startswith("postgres://"):
            return value.replace("postgres://", "postgresql+psycopg://", 1)
        if value.startswith("postgresql://"):
            return value.replace("postgresql://", "postgresql+psycopg://", 1)
        return value

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @property
    def database_host(self) -> str:
        try:
            return make_url(self.database_url).host or ""
        except Exception:
            return ""

    @property
    def is_neon(self) -> bool:
        return self.database_host.endswith(".neon.tech")

    @property
    def is_local_database(self) -> bool:
        return self.database_host in {"localhost", "127.0.0.1", "::1", ""}

    @property
    def resolved_db_sslmode(self) -> str | None:
        if self.db_sslmode:
            return self.db_sslmode
        try:
            if "sslmode" in make_url(self.database_url).query:
                return None
        except Exception:
            pass
        if not self.is_local_database:
            return "require"
        return None

    @property
    def db_connect_args(self) -> dict[str, object]:
        connect_args: dict[str, object] = {}
        if self.resolved_db_sslmode:
            connect_args["sslmode"] = self.resolved_db_sslmode
        if self.is_neon:
            # Neon's pooled endpoint (PgBouncer) does not support server-side
            # prepared statements, so leave preparation to libpq.
            connect_args["prepare_threshold"] = None
        return connect_args


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
