from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class SubjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    subject_code: str = Field(min_length=1, max_length=40)
    class_id: int
    faculty_id: Optional[int] = None


class SubjectUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=160)
    subject_code: Optional[str] = Field(default=None, min_length=1, max_length=40)
    faculty_id: Optional[int] = None


class SubjectOut(BaseModel):
    id: int
    name: str
    subject_code: str
    class_id: int
    class_name: str
    faculty_id: Optional[int] = None
    faculty_name: Optional[str] = None
    session_count: int = 0
