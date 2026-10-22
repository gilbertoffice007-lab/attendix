"""Authentication / authorization dependencies and access checks."""

from __future__ import annotations

from collections.abc import Callable

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import ACCESS_TOKEN_COOKIE, decode_access_token
from app.db.session import get_db
from app.models import AppSetting, ClassRoom, FacultyClassAssignment, Student, User


def get_current_user(
    request: Request, db: Session = Depends(get_db)
) -> User:
    token = request.cookies.get(ACCESS_TOKEN_COOKIE)
    if not token:
        header = request.headers.get("Authorization", "")
        if header.lower().startswith("bearer "):
            token = header[7:].strip()
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired or invalid. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        user_id = int(payload["sub"])
    except (KeyError, TypeError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid authentication token")
    user = db.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account is unavailable. Contact an administrator.",
        )
    return user


def require_roles(*roles: str) -> Callable[[User], User]:
    def dependency(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to perform this action",
            )
        return user

    return dependency


require_admin = require_roles("admin")
require_staff = require_roles("admin", "faculty")
require_authenticated = require_roles("admin", "faculty", "student")


def accessible_class_ids(db: Session, user: User) -> set[int] | None:
    """Return None for unrestricted admins, otherwise the allowed class ids."""
    if user.role == "admin":
        return None
    if user.role == "faculty":
        rows = db.scalars(
            select(FacultyClassAssignment.class_id).where(
                FacultyClassAssignment.faculty_id == user.id
            )
        ).all()
        return set(rows)
    if user.role == "student" and user.student_id:
        student = db.get(Student, user.student_id)
        return {student.class_id} if student else set()
    return set()


def ensure_class_access(db: Session, user: User, class_id: int) -> None:
    if not db.get(ClassRoom, class_id):
        raise HTTPException(status_code=404, detail="Class not found")
    if user.role == "admin":
        return
    allowed = accessible_class_ids(db, user)
    if allowed is not None and class_id not in allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this class",
        )


def ensure_class_write(db: Session, user: User, class_id: int) -> None:
    ensure_class_access(db, user, class_id)
    if user.role == "student":
        raise HTTPException(status_code=403, detail="Students cannot modify class data")


def get_policy(db: Session) -> AppSetting:
    policy = db.get(AppSetting, 1)
    if policy is None:
        policy = AppSetting(
            id=1,
            attendance_threshold=settings.default_attendance_threshold,
            od_counts_as_attended=True,
            leave_counts_as_attended=False,
        )
        db.add(policy)
        db.commit()
        db.refresh(policy)
    return policy
