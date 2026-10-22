from __future__ import annotations

from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.deps import (
    ensure_class_access,
    get_current_user,
    get_policy,
    require_staff,
)
from app.db.session import get_db
from app.models import Subject, User
from app.schemas.dashboard import DashboardOut
from app.services.dashboard import build_dashboard

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("", response_model=DashboardOut)
def dashboard(
    class_id: Optional[int] = Query(default=None),
    subject_id: Optional[int] = Query(default=None),
    date_filter: Optional[date] = Query(default=None, alias="date"),
    db: Session = Depends(get_db),
    user: User = Depends(require_staff),
):
    if class_id is not None:
        ensure_class_access(db, user, class_id)
    if subject_id is not None:
        subject = db.get(Subject, subject_id)
        if not subject:
            raise HTTPException(status_code=404, detail="Subject not found")
        if class_id is not None and subject.class_id != class_id:
            raise HTTPException(status_code=400, detail="Subject does not belong to this class")
    policy = get_policy(db)
    return DashboardOut(
        **build_dashboard(
            db, user, policy, class_id=class_id, subject_id=subject_id, on_date=date_filter
        )
    )
