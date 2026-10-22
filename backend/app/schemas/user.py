from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.schemas.common import Page

Role = Literal["admin", "faculty", "student"]


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    email: EmailStr
    role: Role
    is_active: bool
    student_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime


class UserCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=160)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    role: Role = "faculty"
    student_id: Optional[int] = None

    @field_validator("password")
    @classmethod
    def password_complexity(cls, value: str) -> str:
        if not any(c.isalpha() for c in value) or not any(c.isdigit() for c in value):
            raise ValueError("Password must contain at least one letter and one number")
        return value

    @field_validator("role")
    @classmethod
    def role_is_valid(cls, value: str) -> str:
        if value not in ("admin", "faculty", "student"):
            raise ValueError("Invalid role")
        return value


class UserUpdate(BaseModel):
    full_name: Optional[str] = Field(default=None, min_length=2, max_length=160)
    email: Optional[EmailStr] = None
    role: Optional[Role] = None
    is_active: Optional[bool] = None
    student_id: Optional[int] = None


class PasswordReset(BaseModel):
    new_password: str = Field(min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def password_complexity(cls, value: str) -> str:
        if not any(c.isalpha() for c in value) or not any(c.isdigit() for c in value):
            raise ValueError("Password must contain at least one letter and one number")
        return value


class StudentAccountCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: Optional[str] = Field(default=None, max_length=160)

    @field_validator("password")
    @classmethod
    def password_complexity(cls, value: str) -> str:
        if not any(c.isalpha() for c in value) or not any(c.isdigit() for c in value):
            raise ValueError("Password must contain at least one letter and one number")
        return value


class UserPage(Page[UserOut]):
    pass


class FacultyAssignmentUpdate(BaseModel):
    class_ids: list[int] = Field(default_factory=list)


class FacultyWithAssignments(UserOut):
    class_ids: list[int] = Field(default_factory=list)
    class_labels: list[str] = Field(default_factory=list)
