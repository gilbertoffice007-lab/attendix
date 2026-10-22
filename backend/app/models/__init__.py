"""ORM models. Importing this package registers every table on Base.metadata."""

from app.models.assignment import FacultyClassAssignment
from app.models.attendance import AttendanceRecord, AttendanceSession
from app.models.audit import AuditLog
from app.models.class_ import ClassRoom
from app.models.custom_list import CustomList, CustomListEntry
from app.models.enums import ATTENDANCE_STATUSES, USER_ROLES
from app.models.setting import AppSetting
from app.models.student import Student
from app.models.subject import Subject
from app.models.user import User

__all__ = [
    "ATTENDANCE_STATUSES",
    "USER_ROLES",
    "AppSetting",
    "AttendanceRecord",
    "AttendanceSession",
    "AuditLog",
    "ClassRoom",
    "CustomList",
    "CustomListEntry",
    "FacultyClassAssignment",
    "Student",
    "Subject",
    "User",
]
