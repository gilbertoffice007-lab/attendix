from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_policy, require_staff
from app.db.session import get_db
from app.models import User
from app.schemas.settings import SettingsOut, SettingsUpdate
from app.services.audit import record_audit

router = APIRouter(prefix="/settings", tags=["Settings"])


@router.get("", response_model=SettingsOut)
def get_settings(
    db: Session = Depends(get_db),
    user: User = Depends(require_staff),
):
    policy = get_policy(db)
    return SettingsOut(
        attendance_threshold=policy.attendance_threshold,
        od_counts_as_attended=policy.od_counts_as_attended,
        leave_counts_as_attended=policy.leave_counts_as_attended,
        updated_at=policy.updated_at,
    )


@router.patch("", response_model=SettingsOut)
def update_settings(
    payload: SettingsUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_staff),
):
    policy = get_policy(db)
    previous = {
        "attendance_threshold": policy.attendance_threshold,
        "od_counts_as_attended": policy.od_counts_as_attended,
        "leave_counts_as_attended": policy.leave_counts_as_attended,
    }
    policy.attendance_threshold = payload.attendance_threshold
    policy.od_counts_as_attended = payload.od_counts_as_attended
    policy.leave_counts_as_attended = payload.leave_counts_as_attended
    policy.updated_by = user.id
    record_audit(
        db,
        user,
        "settings",
        1,
        "updated",
        previous_value=previous,
        new_value=payload.model_dump(),
    )
    db.commit()
    db.refresh(policy)
    return SettingsOut(
        attendance_threshold=policy.attendance_threshold,
        od_counts_as_attended=policy.od_counts_as_attended,
        leave_counts_as_attended=policy.leave_counts_as_attended,
        updated_at=policy.updated_at,
    )
