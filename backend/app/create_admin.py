"""Create the first administrator account.

Usage:
    python -m app.create_admin --email admin@example.com --name "Campus Admin"

The password is requested interactively and never written to the shell history.
Run ``python -m app.check_db`` first to confirm the database connection.
"""

from __future__ import annotations

import argparse
import getpass
import sys

from pydantic import EmailStr, TypeAdapter, ValidationError
from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models import User
from app.services.audit import record_audit


def _valid_password(password: str) -> str | None:
    if len(password) < 8:
        return "Password must be at least 8 characters long."
    if not any(character.isalpha() for character in password):
        return "Password must contain at least one letter."
    if not any(character.isdigit() for character in password):
        return "Password must contain at least one number."
    return None


def _read_password() -> str:
    password = getpass.getpass("Password: ")
    problem = _valid_password(password)
    if problem:
        raise SystemExit(problem)
    confirmation = getpass.getpass("Confirm password: ")
    if password != confirmation:
        raise SystemExit("Passwords do not match.")
    return password


def main() -> int:
    parser = argparse.ArgumentParser(description="Create the first Attendix administrator.")
    parser.add_argument("--email", required=True, help="Administrator email address")
    parser.add_argument("--name", required=True, help="Administrator full name")
    parser.add_argument("--password", help=argparse.SUPPRESS)
    args = parser.parse_args()

    try:
        email = str(TypeAdapter(EmailStr).validate_python(args.email.strip())).lower()
    except ValidationError:
        print("Enter a valid email address.", file=sys.stderr)
        return 2

    full_name = args.name.strip()
    if len(full_name) < 2:
        print("Enter the administrator's full name.", file=sys.stderr)
        return 2

    password = args.password or _read_password()
    problem = _valid_password(password)
    if problem:
        print(problem, file=sys.stderr)
        return 2

    try:
        with SessionLocal() as db:
            existing = db.scalar(
                select(User).where(func.lower(User.email) == email)
            )
            if existing:
                print(
                    f"An account with {email} already exists. "
                    "Use the Users page to manage it.",
                    file=sys.stderr,
                )
                return 1

            admin = User(
                full_name=full_name,
                email=email,
                password_hash=hash_password(password),
                role="admin",
                is_active=True,
            )
            db.add(admin)
            db.flush()
            record_audit(
                db,
                admin,
                "user",
                admin.id,
                "bootstrap_admin",
                new_value={"email": email, "role": "admin"},
            )
            db.commit()
    except SQLAlchemyError as error:
        print(f"Database error: {error}", file=sys.stderr)
        print(
            "Check DATABASE_URL and run `python -m app.check_db`.",
            file=sys.stderr,
        )
        return 1

    print(f"Administrator created: {email}")
    print("Store the password securely and change it after the first sign-in.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
