from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.deps import require_admin
from app.core.security import hash_password
from app.db.session import get_db
from app.models import Student, User
from app.schemas.common import Message
from app.schemas.user import PasswordReset, UserCreate, UserOut, UserPage, UserUpdate
from app.services.audit import record_audit

router = APIRouter(prefix="/users", tags=["Users (Admin)"])


def _ensure_email_available(db: Session, email: str, exclude_id: int | None = None) -> None:
    stmt = select(User).where(func.lower(User.email) == email.lower())
    if exclude_id:
        stmt = stmt.where(User.id != exclude_id)
    if db.scalar(stmt):
        raise HTTPException(status_code=409, detail="An account with this email already exists")


def _active_admin_count(db: Session) -> int:
    return int(
        db.scalar(
            select(func.count(User.id)).where(
                User.role == "admin", User.is_active.is_(True)
            )
        )
        or 0
    )


@router.get("", response_model=UserPage)
def list_users(
    role: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    is_active: Optional[bool] = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    stmt = select(User)
    count_stmt = select(func.count(User.id))
    filters = []
    if role:
        filters.append(User.role == role)
    if is_active is not None:
        filters.append(User.is_active.is_(is_active))
    if search:
        pattern = f"%{search.strip()}%"
        filters.append(or_(User.full_name.ilike(pattern), User.email.ilike(pattern)))
    for condition in filters:
        stmt = stmt.where(condition)
        count_stmt = count_stmt.where(condition)
    total = int(db.scalar(count_stmt) or 0)
    rows = db.scalars(
        stmt.order_by(User.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return UserPage(items=[UserOut.model_validate(row) for row in rows], total=total, page=page, page_size=page_size)


@router.post("", response_model=UserOut, status_code=201)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    email = payload.email.lower().strip()
    _ensure_email_available(db, email)
    if payload.role == "student":
        if not payload.student_id:
            raise HTTPException(status_code=400, detail="Select a student to link this account to")
        student = db.get(Student, payload.student_id)
        if not student:
            raise HTTPException(status_code=404, detail="Student not found")
        existing_link = db.scalar(select(User).where(User.student_id == student.id))
        if existing_link:
            raise HTTPException(status_code=409, detail="This student already has a login account")
    else:
        payload.student_id = None
    user = User(
        full_name=payload.full_name.strip(),
        email=email,
        password_hash=hash_password(payload.password),
        role=payload.role,
        is_active=True,
        student_id=payload.student_id,
    )
    db.add(user)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="A conflicting account already exists")
    record_audit(db, admin, "user", user.id, "created", new_value={"email": email, "role": payload.role})
    db.commit()
    db.refresh(user)
    return UserOut.model_validate(user)


@router.patch("/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    updates = payload.model_dump(exclude_unset=True)
    if user.id == admin.id and ("is_active" in updates or "role" in updates):
        if updates.get("is_active") is False:
            raise HTTPException(status_code=400, detail="You cannot deactivate your own account")
        if updates.get("role") and updates["role"] != "admin":
            raise HTTPException(status_code=400, detail="You cannot change your own role")
    previous = {"role": user.role, "is_active": user.is_active, "email": user.email}
    if "email" in updates and updates["email"]:
        email = updates["email"].lower().strip()
        _ensure_email_available(db, email, exclude_id=user.id)
        user.email = email
    if "full_name" in updates and updates["full_name"]:
        user.full_name = updates["full_name"].strip()
    if "is_active" in updates and updates["is_active"] is not None:
        if user.role == "admin" and updates["is_active"] is False and _active_admin_count(db) <= 1:
            raise HTTPException(status_code=400, detail="At least one active administrator is required")
        user.is_active = updates["is_active"]
    if "role" in updates and updates["role"] and updates["role"] != user.role:
        if user.role == "admin" and updates["role"] != "admin" and _active_admin_count(db) <= 1:
            raise HTTPException(status_code=400, detail="At least one active administrator is required")
        user.role = updates["role"]
        if user.role != "student":
            user.student_id = None
    if "student_id" in updates:
        if user.role != "student":
            if updates["student_id"] is not None:
                raise HTTPException(status_code=400, detail="Only student accounts can link a student record")
            user.student_id = None
        elif updates["student_id"] is None:
            user.student_id = None
        else:
            student = db.get(Student, updates["student_id"])
            if not student:
                raise HTTPException(status_code=404, detail="Student not found")
            conflict = db.scalar(
                select(User).where(
                    User.student_id == student.id, User.id != user.id
                )
            )
            if conflict:
                raise HTTPException(status_code=409, detail="This student is already linked to another account")
            user.student_id = student.id
    record_audit(
        db,
        admin,
        "user",
        user.id,
        "updated",
        previous_value=previous,
        new_value={"role": user.role, "is_active": user.is_active, "email": user.email},
    )
    db.commit()
    db.refresh(user)
    return UserOut.model_validate(user)


@router.post("/{user_id}/reset-password", response_model=Message)
def reset_password(
    user_id: int,
    payload: PasswordReset,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.password_hash = hash_password(payload.new_password)
    record_audit(db, admin, "user", user.id, "password_reset")
    db.commit()
    return Message(message="Password reset successfully")
