"""Shared enum-like value sets stored as validated strings in PostgreSQL."""

USER_ROLES: tuple[str, ...] = ("admin", "faculty", "student")
ATTENDANCE_STATUSES: tuple[str, ...] = ("present", "absent", "od", "leave")

ATTENDANCE_STATUS_LABELS = {
    "present": "Present",
    "absent": "Absent",
    "od": "On Duty",
    "leave": "Leave",
    "unmarked": "Unmarked",
}
