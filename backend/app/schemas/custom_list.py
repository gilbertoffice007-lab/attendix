from __future__ import annotations

from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator

from app.schemas.common import Page

StatusColor = Literal["blue", "green", "red", "amber", "slate", "violet", "teal", "rose"]


class StatusOption(BaseModel):
    key: str = Field(min_length=1, max_length=40)
    label: str = Field(min_length=1, max_length=80)
    color: StatusColor = "slate"

    @field_validator("key")
    @classmethod
    def key_format(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Status key is required")
        if len(cleaned) > 40:
            raise ValueError("Status key is too long")
        return cleaned


class CustomListCreate(BaseModel):
    title: str = Field(min_length=2, max_length=180)
    class_id: int
    description: Optional[str] = Field(default=None, max_length=2000)
    status_options: list[StatusOption] = Field(min_length=2, max_length=20)
    due_date: Optional[date] = None
    visible_to_students: bool = False
    student_ids: list[int] = Field(default_factory=list)

    @model_validator(mode="after")
    def unique_keys(self) -> "CustomListCreate":
        keys = [option.key.lower() for option in self.status_options]
        if len(set(keys)) != len(keys):
            raise ValueError("Status keys must be unique")
        if len({option.label.lower() for option in self.status_options}) != len(
            self.status_options
        ):
            raise ValueError("Status labels must be unique")
        return self


class CustomListUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=2, max_length=180)
    description: Optional[str] = Field(default=None, max_length=2000)
    status_options: Optional[list[StatusOption]] = Field(default=None, min_length=2, max_length=20)
    due_date: Optional[date] = None
    visible_to_students: Optional[bool] = None

    @model_validator(mode="after")
    def unique_keys(self) -> "CustomListUpdate":
        if self.status_options is None:
            return self
        keys = [option.key.lower() for option in self.status_options]
        if len(set(keys)) != len(keys):
            raise ValueError("Status keys must be unique")
        if len({option.label.lower() for option in self.status_options}) != len(
            self.status_options
        ):
            raise ValueError("Status labels must be unique")
        return self


class EntryUpdate(BaseModel):
    status: str = Field(min_length=1, max_length=40)
    remarks: Optional[str] = Field(default=None, max_length=500)


class BulkStatusUpdate(BaseModel):
    entry_ids: list[int] = Field(default_factory=list)
    apply_to_all: bool = False
    status: str = Field(min_length=1, max_length=40)
    remarks: Optional[str] = Field(default=None, max_length=500)

    @model_validator(mode="after")
    def targets_present(self) -> "BulkStatusUpdate":
        if not self.apply_to_all and not self.entry_ids:
            raise ValueError("Select at least one entry or choose all entries")
        return self


class AddEntriesRequest(BaseModel):
    student_ids: list[int] = Field(min_length=1, max_length=500)


class ArchiveRequest(BaseModel):
    is_archived: bool


class EntryOut(BaseModel):
    id: int
    student_id: int
    roll_number: str
    student_name: str
    student_active: bool
    status: str
    remarks: Optional[str] = None
    updated_at: datetime
    updated_by_name: Optional[str] = None


class CustomListOut(BaseModel):
    id: int
    title: str
    description: Optional[str]
    class_id: int
    class_name: str
    department: str
    semester: int
    created_by: int
    creator_name: str
    status_options: list[StatusOption]
    due_date: Optional[date]
    is_archived: bool
    visible_to_students: bool
    entry_count: int
    created_at: datetime
    updated_at: datetime


class CustomListDetail(CustomListOut):
    entries: list[EntryOut]


class CustomListPage(Page[CustomListOut]):
    pass


class EntrySummary(BaseModel):
    total: int
    counts: dict[str, int]
    percentages: dict[str, float]


class StudentListOut(BaseModel):
    id: int
    title: str
    description: Optional[str]
    class_name: str
    due_date: Optional[date]
    status_options: list[StatusOption]
    my_status: str
    my_remarks: Optional[str] = None
    updated_at: datetime
    creator_name: str


class StudentListPage(Page[StudentListOut]):
    pass
