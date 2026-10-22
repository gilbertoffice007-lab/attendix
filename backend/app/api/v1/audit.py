from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.core.deps import require_admin
from app.db.session import get_db
from app.models import AuditLog, User
from app.schemas.audit import AuditLogOut, AuditLogPage

router = APIRouter(prefix="/audit-logs", tags=["Audit"])


@router.get("", response_model=AuditLogPage)
def list_audit_logs(
    entity_type: Optional[str] = Query(default=None),
    entity_id: Optional[int] = Query(default=None),
    action: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    stmt = select(AuditLog).options(joinedload(AuditLog.actor))
    count_stmt = select(func.count(AuditLog.id))
    filters = []
    if entity_type:
        filters.append(AuditLog.entity_type == entity_type)
    if entity_id is not None:
        filters.append(AuditLog.entity_id == entity_id)
    if action:
        filters.append(AuditLog.action == action)
    if search:
        pattern = f"%{search.strip()}%"
        filters.append(
            or_(
                AuditLog.entity_type.ilike(pattern),
                AuditLog.action.ilike(pattern),
                User.full_name.ilike(pattern),
            )
        )
        stmt = stmt.join(User, User.id == AuditLog.actor_user_id, isouter=True)
        count_stmt = count_stmt.join(User, User.id == AuditLog.actor_user_id, isouter=True)
    for condition in filters:
        stmt = stmt.where(condition)
        count_stmt = count_stmt.where(condition)
    total = int(db.scalar(count_stmt) or 0)
    rows = db.scalars(
        stmt.order_by(AuditLog.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    items = [
        AuditLogOut(
            id=row.id,
            actor_user_id=row.actor_user_id,
            actor_name=row.actor.full_name if row.actor else None,
            entity_type=row.entity_type,
            entity_id=row.entity_id,
            action=row.action,
            previous_value=row.previous_value,
            new_value=row.new_value,
            created_at=row.created_at,
        )
        for row in rows
    ]
    return AuditLogPage(items=items, total=total, page=page, page_size=page_size)
