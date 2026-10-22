from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel

from app.schemas.common import Page


class AuditLogOut(BaseModel):
    id: int
    actor_user_id: Optional[int]
    actor_name: Optional[str]
    entity_type: str
    entity_id: int
    action: str
    previous_value: Optional[dict[str, Any]]
    new_value: Optional[dict[str, Any]]
    created_at: datetime


class AuditLogPage(Page[AuditLogOut]):
    pass
