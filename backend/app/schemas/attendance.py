from __future__ import annotations

from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field

from app.schemas.common import Page

AttendanceStatus = Literal["present", "absent", "od", "leave"]


class SessionCreate(BaseModel):
    class_id: int
    subject_id: int
    session_date: date
    session_number: int = Field(default=1, ge=1, le=20)
    notes: Optional[str] = Field(default=None, max_length=1000)


class AttendanceRecordInput(BaseModel):
    student_id: int
    status: AttendanceStatus
    remarks: Optional[str] = Field(default=None, max_length=500)


class SessionRecordsUpdate(BaseModel):
    records: list[AttendanceRecordInput] = Field(min_length=1, max_length=500)


class SessionFinalizeRequest(BaseModel):
    is_finalized: bool


class SessionCounts(BaseModel):
    total: int = 0
    present: int = 0
    absent: int = 0
    od: int = 0
    leave: int = 0
    unmarked: int = 0


class SessionEntry(BaseModel):
    student_id: int
    roll_number: str
    student_name: str
    is_active: bool
    record_id: Optional[int] = None
    status: Optional[AttendanceStatus] = None
    remarks: Optional[str] = None
    updated_at: Optional[datetime] = None
    updated_by_name: Optional[str] = None


class SessionListItem(BaseModel):
    id: int
    class_id: int
    class_name: str
    subject_id: int
    subject_name: str
    subject_code: str
    session_date: date
    session_number: int
    is_finalized: bool
    counts: SessionCounts
    created_by_name: str
    created_at: datetime


class SessionDetail(SessionListItem):
    notes: Optional[str] = None
    finalized_at: Optional[datetime] = None
    finalized_by_name: Optional[str] = None
    entries: list[SessionEntry] = []


class SessionPage(Page[SessionListItem]):
    pass


class StudentSummaryRow(BaseModel):
    student_id: int
    roll_number: str
    full_name: str
    class_id: int
    class_name: str
    present: int
    absent: int
    od: int
    leave: int
    attended: int
    eligible: int
    absences: int
    percentage: float
    below_threshold: bool


class AttendanceSummary(BaseModel):
    class_id: int
    class_name: str
    subject_id: Optional[int] = None
    subject_name: Optional[str] = None
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    threshold: int
    od_counts_as_attended: bool
    leave_counts_as_attended: bool
    total_students: int
    finalized_sessions: int
    average_percentage: float
    low_attendance_count: int
    students: list[StudentSummaryRow]


class StudentSubjectRow(BaseModel):
    subject_id: int
    subject_name: str
    subject_code: str
    attended: int
    eligible: int
    percentage: float


class StudentHistoryRow(BaseModel):
    session_id: int
    session_date: date
    session_number: int
    subject_id: int
    subject_name: str
    class_name: str
    status: AttendanceStatus
    remarks: Optional[str] = None


class StudentReport(BaseModel):
    student_id: int
    roll_number: str
    full_name: str
    class_id: int
    class_name: str
    threshold: int
    attended: int
    eligible: int
    absences: int
    present: int
    od: int
    leave: int
    percentage: float
    below_threshold: bool
    subjects: list[StudentSubjectRow]
    history: list[StudentHistoryRow]


class HistoryRow(BaseModel):
    session_id: int
    session_date: date
    session_number: int
    subject_id: int
    subject_name: str
    class_id: int
    class_name: str
    student_id: int
    roll_number: str
    student_name: str
    status: AttendanceStatus
    remarks: Optional[str] = None
    is_finalized: bool


class HistoryPage(Page[HistoryRow]):
    pass


class SubjectReportRow(BaseModel):
    subject_id: int
    subject_name: str
    subject_code: str
    class_id: int
    class_name: str
    finalized_sessions: int
    present: int
    absent: int
    od: int
    leave: int
    average_percentage: float


class ClassReportRow(BaseModel):
    class_id: int
    class_name: str
    department: str
    semester: int
    academic_year: str
    student_count: int
    finalized_sessions: int
    average_percentage: float
    below_threshold_count: int
