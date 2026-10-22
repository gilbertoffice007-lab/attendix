from __future__ import annotations

from typing import Any, Optional

from sqlalchemy.orm import Session

from app.models import AuditLog, User


def record_audit(
    db: Session,
    actor: Optional[User],
    entity_type: str,
    entity_id: int,
    action: str,
    previous_value: Optional[dict[str, Any]] = None,
    new_value: Optional[dict[str, Any]] = None,
) -> AuditLog:
    entry = AuditLog(
        actor_user_id=actor.id if actor else None,
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
        previous_value=previous_value,
        new_value=new_value,
    )
    db.add(entry)
    return entry
