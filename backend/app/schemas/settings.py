from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class SettingsOut(BaseModel):
    attendance_threshold: int
    od_counts_as_attended: bool
    leave_counts_as_attended: bool
    updated_at: datetime


class SettingsUpdate(BaseModel):
    attendance_threshold: int = Field(ge=0, le=100)
    od_counts_as_attended: bool = True
    leave_counts_as_attended: bool = False
