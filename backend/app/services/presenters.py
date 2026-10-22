"""Small serialization helpers shared by API routes."""

from __future__ import annotations

from typing import Any, Optional

from app.models import (
    AttendanceRecord,
    AttendanceSession,
    ClassRoom,
    CustomList,
    Student,
    Subject,
    User,
)


def class_label(class_: ClassRoom) -> str:
    return f"{class_.name} · {class_.department} · Sem {class_.semester}"


def student_out(student: Student) -> dict[str, Any]:
    account = student.user_account
    return {
        "id": student.id,
        "roll_number": student.roll_number,
        "full_name": student.full_name,
        "class_id": student.class_id,
        "class_name": student.class_.name if student.class_ else "",
        "department": student.class_.department if student.class_ else "",
        "semester": student.class_.semester if student.class_ else 0,
        "academic_year": student.class_.academic_year if student.class_ else "",
        "is_active": student.is_active,
        "has_account": account is not None,
        "account_email": account.email if account else None,
        "created_at": student.created_at,
    }


def current_user_out(user: User) -> dict[str, Any]:
    student_profile = None
    if user.student is not None:
        student = user.student
        class_ = student.class_
        student_profile = {
            "id": student.id,
            "roll_number": student.roll_number,
            "full_name": student.full_name,
            "class_id": student.class_id,
            "class_name": class_.name if class_ else "",
            "department": class_.department if class_ else "",
            "semester": class_.semester if class_ else 0,
            "academic_year": class_.academic_year if class_ else "",
            "is_active": student.is_active,
        }
    return {
        "id": user.id,
        "full_name": user.full_name,
        "email": user.email,
        "role": user.role,
        "is_active": user.is_active,
        "created_at": user.created_at,
        "student": student_profile,
    }


def session_counts(records: list[AttendanceRecord]) -> dict[str, int]:
    counts = {"total": len(records), "present": 0, "absent": 0, "od": 0, "leave": 0, "unmarked": 0}
    for record in records:
        counts[record.status] = counts.get(record.status, 0) + 1
    return counts


def session_base(session: AttendanceSession) -> dict[str, Any]:
    records = list(session.records)
    return {
        "id": session.id,
        "class_id": session.class_id,
        "class_name": class_label(session.class_),
        "subject_id": session.subject_id,
        "subject_name": session.subject.name,
        "subject_code": session.subject.subject_code,
        "session_date": session.session_date,
        "session_number": session.session_number,
        "is_finalized": session.is_finalized,
        "counts": session_counts(records),
        "created_by_name": session.creator.full_name if session.creator else "Unknown",
        "created_at": session.created_at,
    }


def session_detail(
    session: AttendanceSession, roster: list[Student]
) -> dict[str, Any]:
    data = session_base(session)
    records = {record.student_id: record for record in session.records}
    entries: list[dict[str, Any]] = []
    seen: set[int] = set()
    for student in sorted(roster, key=lambda item: item.roll_number.lower()):
        seen.add(student.id)
        record = records.get(student.id)
        entries.append(_entry_dict(student, record))
    for student_id, record in records.items():
        if student_id not in seen:
            entries.append(_entry_dict(record.student, record))
    data.update(
        {
            "notes": session.notes,
            "finalized_at": session.finalized_at,
            "finalized_by_name": (
                session.finalizer.full_name if session.finalizer else None
            ),
            "entries": entries,
        }
    )
    return data


def _entry_dict(
    student: Student, record: Optional[AttendanceRecord]
) -> dict[str, Any]:
    return {
        "student_id": student.id,
        "roll_number": student.roll_number,
        "student_name": student.full_name,
        "is_active": student.is_active,
        "record_id": record.id if record else None,
        "status": record.status if record else None,
        "remarks": record.remarks if record else None,
        "updated_at": record.updated_at if record else None,
        "updated_by_name": (
            record.editor.full_name if record and record.editor else None
        ),
    }


def custom_list_out(item: CustomList) -> dict[str, Any]:
    return {
        "id": item.id,
        "title": item.title,
        "description": item.description,
        "class_id": item.class_id,
        "class_name": class_label(item.class_),
        "department": item.class_.department,
        "semester": item.class_.semester,
        "created_by": item.created_by,
        "creator_name": item.creator.full_name if item.creator else "Unknown",
        "status_options": item.status_options,
        "due_date": item.due_date,
        "is_archived": item.is_archived,
        "visible_to_students": item.visible_to_students,
        "entry_count": len(item.entries),
        "created_at": item.created_at,
        "updated_at": item.updated_at,
    }


def entry_out(entry: Any) -> dict[str, Any]:
    return {
        "id": entry.id,
        "student_id": entry.student_id,
        "roll_number": entry.student.roll_number,
        "student_name": entry.student.full_name,
        "student_active": entry.student.is_active,
        "status": entry.status,
        "remarks": entry.remarks,
        "updated_at": entry.updated_at,
        "updated_by_name": entry.editor.full_name if entry.editor else None,
    }
