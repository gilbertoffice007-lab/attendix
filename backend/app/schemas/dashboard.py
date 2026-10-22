from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel


class DashboardSession(BaseModel):
    id: int
    class_id: int
    class_name: str
    subject_name: str
    session_date: date
    session_number: int
    present: int
    absent: int
    od: int
    leave: int
    unmarked: int
    total: int
    is_finalized: bool


class DashboardList(BaseModel):
    id: int
    title: str
    class_name: str
    entry_count: int
    created_at: datetime
    creator_name: str


class TrendPoint(BaseModel):
    label: str
    date: date
    session_id: int
    percentage: float
    present: int
    total: int


class LowAttendanceStudent(BaseModel):
    student_id: int
    roll_number: str
    full_name: str
    class_name: str
    percentage: float
    absent: int
    eligible: int


class DashboardOut(BaseModel):
    role: str
    scope_label: str
    total_students: int
    total_classes: int
    total_subjects: int
    session_count: int
    finalized_session_count: int
    today_sessions: list[DashboardSession]
    present_today: int
    absent_today: int
    average_percentage: float
    threshold: int
    low_attendance_count: int
    low_attendance: list[LowAttendanceStudent]
    recent_lists: list[DashboardList]
    trend: list[TrendPoint]
    faculty_count: Optional[int] = None
    user_count: Optional[int] = None
    od_counts_as_attended: bool = True
    leave_counts_as_attended: bool = False
