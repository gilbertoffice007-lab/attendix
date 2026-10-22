from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.schemas.class_ import ClassBrief


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)
    portal: Optional[Literal["student", "faculty"]] = None


class SetupStatus(BaseModel):
    setup_required: bool
    registration_enabled: bool


class StudentRegistrationOptions(BaseModel):
    enabled: bool
    classes: list[ClassBrief]


class RegisterRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=160)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)

    @field_validator("password")
    @classmethod
    def password_complexity(cls, value: str) -> str:
        if not any(c.isalpha() for c in value) or not any(c.isdigit() for c in value):
            raise ValueError("Password must contain at least one letter and one number")
        return value


class StudentRegisterRequest(RegisterRequest):
    class_id: int = Field(gt=0)
    roll_number: str = Field(min_length=1, max_length=50)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def password_complexity(cls, value: str) -> str:
        if not any(c.isalpha() for c in value) or not any(c.isdigit() for c in value):
            raise ValueError("Password must contain at least one letter and one number")
        return value


class StudentProfile(BaseModel):
    id: int
    roll_number: str
    full_name: str
    class_id: int
    class_name: str
    department: str
    semester: int
    academic_year: str
    is_active: bool


class CurrentUser(BaseModel):
    id: int
    full_name: str
    email: EmailStr
    role: Literal["admin", "faculty", "student"]
    is_active: bool
    created_at: datetime
    student: Optional[StudentProfile] = None
