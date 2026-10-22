from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator


class ClassCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    department: str = Field(min_length=1, max_length=120)
    semester: int = Field(ge=1, le=12)
    academic_year: str = Field(min_length=4, max_length=20)

    @field_validator("academic_year")
    @classmethod
    def valid_year(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Academic year is required")
        return cleaned


class ClassUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    department: Optional[str] = Field(default=None, min_length=1, max_length=120)
    semester: Optional[int] = Field(default=None, ge=1, le=12)
    academic_year: Optional[str] = Field(default=None, min_length=4, max_length=20)


class ClassOut(BaseModel):
    id: int
    name: str
    department: str
    semester: int
    academic_year: str
    student_count: int = 0
    subject_count: int = 0
    created_at: datetime


class ClassBrief(BaseModel):
    id: int
    name: str
    department: str
    semester: int
    academic_year: str

    @property
    def label(self) -> str:
        return f"{self.name} · {self.department} · Sem {self.semester}"


class ClassWithFaculty(ClassOut):
    faculty_names: list[str] = []
