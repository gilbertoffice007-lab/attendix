from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.schemas.common import Page


class StudentCreate(BaseModel):
    roll_number: str = Field(min_length=1, max_length=50)
    full_name: str = Field(min_length=1, max_length=160)
    class_id: int
    is_active: bool = True


class StudentUpdate(BaseModel):
    roll_number: Optional[str] = Field(default=None, min_length=1, max_length=50)
    full_name: Optional[str] = Field(default=None, min_length=1, max_length=160)
    class_id: Optional[int] = None
    is_active: Optional[bool] = None


class StudentOut(BaseModel):
    id: int
    roll_number: str
    full_name: str
    class_id: int
    class_name: str
    department: str
    semester: int
    academic_year: str
    is_active: bool
    has_account: bool = False
    account_email: Optional[str] = None
    created_at: datetime


class StudentBrief(BaseModel):
    id: int
    roll_number: str
    full_name: str
    class_id: int
    is_active: bool


class StudentPage(Page[StudentOut]):
    pass


class StudentImportError(BaseModel):
    row: int
    message: str


class StudentImportResult(BaseModel):
    created: int
    skipped: int
    errors: list[StudentImportError] = []
