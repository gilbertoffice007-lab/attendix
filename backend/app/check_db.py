"""Verify the configured PostgreSQL connection and schema state.

Usage:
    python -m app.check_db

The command never prints the database password or the full connection URL.
"""

from __future__ import annotations

import sys

from sqlalchemy import inspect, text
from sqlalchemy.engine import make_url

from app.core.config import settings
from app.db.session import engine


def main() -> int:
    url = make_url(settings.database_url)
    print(f"Host:      {settings.database_host or '(unknown)'}")
    print(f"Database:  {url.database or '(unknown)'}")
    print(f"Provider:  {'Neon' if settings.is_neon else settings.database_url.split(':', 1)[0]}")
    ssl_mode = url.query.get("sslmode") or settings.resolved_db_sslmode or "prefer"
    print(f"SSL mode:  {ssl_mode}")

    try:
        with engine.connect() as connection:
            version = connection.scalar(text("SELECT version()")) or ""
            database = connection.scalar(text("SELECT current_database()")) or ""
            print(f"Connected: yes ({database})")
            print(f"Server:    {str(version).split(',')[0]}")

        tables = set(inspect(engine).get_table_names())
        if not tables:
            print("Schema:    empty - run `alembic upgrade head`")
            return 1

        expected = {
            "alembic_version",
            "users",
            "students",
            "classes",
            "subjects",
            "attendance_sessions",
            "attendance_records",
            "custom_lists",
            "custom_list_entries",
            "audit_logs",
            "app_settings",
            "faculty_class_assignments",
        }
        missing = sorted(expected - tables)
        if missing:
            print(f"Schema:    incomplete - missing {', '.join(missing)}")
            print("Run `alembic upgrade head`.")
            return 1

        revision = None
        with engine.connect() as connection:
            if "alembic_version" in tables:
                revision = connection.scalar(text("SELECT version_num FROM alembic_version"))

        print(f"Schema:    ready ({len(tables)} tables)")
        print(f"Migration: {revision or 'not recorded'}")
        admin_count = None
        with engine.connect() as connection:
            admin_count = connection.scalar(
                text("SELECT count(*) FROM users WHERE role = 'admin' AND is_active")
            )
        print(f"Admins:    {admin_count}")
        if not admin_count:
            print("Next:      python -m app.create_admin --email you@example.com --name \"Your Name\"")
        return 0
    except Exception as error:
        print(f"Connection failed: {error}", file=sys.stderr)
        print(
            "Check DATABASE_URL, sslmode=require and that your IP is allowed by Neon.",
            file=sys.stderr,
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
