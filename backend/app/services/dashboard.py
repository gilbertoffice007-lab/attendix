"""Role-aware dashboard aggregation built from live database records."""

from __future__ import annotations

from datetime import date
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.core.deps import accessible_class_ids
from app.models import (
    AppSetting,
    AttendanceRecord,
    AttendanceSession,
    ClassRoom,
    CustomList,
    Student,
    Subject,
    User,
)
from app.services.attendance import (
    build_class_summary,
    percentage,
    recent_trend,
    session_base,
)
from app.services.presenters import class_label


def build_dashboard(
    db: Session,
    user: User,
    policy: AppSetting,
    class_id: Optional[int] = None,
    subject_id: Optional[int] = None,
    on_date: Optional[date] = None,
) -> dict:
    on_date = on_date or date.today()
    allowed = accessible_class_ids(db, user)
    stmt = select(ClassRoom)
    if allowed is not None:
        stmt = stmt.where(ClassRoom.id.in_(allowed or {-1}))
    if class_id is not None:
        stmt = stmt.where(ClassRoom.id == class_id)
    classes = list(db.scalars(stmt.order_by(ClassRoom.name)).all())
    class_ids = [class_.id for class_ in classes]

    subject = None
    if subject_id is not None and class_ids:
        subject = db.get(Subject, subject_id)
        if subject and subject.class_id not in class_ids:
            subject = None
    summaries = []
    if class_ids:
        for class_ in classes:
            summaries.append(
                build_class_summary(
                    db, class_, policy, subject, date_from=None, date_to=None
                )
            )

    student_rows = [row for summary in summaries for row in summary["students"]]
    total_students = sum(summary["total_students"] for summary in summaries)
    eligible_rows = [row for row in student_rows if row["eligible"] > 0]
    average_percentage = (
        round(
            sum(row["percentage"] for row in eligible_rows) / len(eligible_rows), 2
        )
        if eligible_rows
        else 0.0
    )
    low_rows = sorted(
        [row for row in student_rows if row["below_threshold"]],
        key=lambda row: row["percentage"],
    )
    low_attendance = [
        {
            "student_id": row["student_id"],
            "roll_number": row["roll_number"],
            "full_name": row["full_name"],
            "class_name": row["class_name"],
            "percentage": row["percentage"],
            "absent": row["absences"],
            "eligible": row["eligible"],
        }
        for row in low_rows[:12]
    ]

    session_filters = [AttendanceSession.class_id.in_(class_ids or {-1})]
    if subject_id is not None:
        session_filters.append(AttendanceSession.subject_id == subject_id)
    session_count = int(
        db.scalar(select(func.count(AttendanceSession.id)).where(*session_filters)) or 0
    )
    finalized_session_count = int(
        db.scalar(
            select(func.count(AttendanceSession.id)).where(
                *session_filters, AttendanceSession.is_finalized.is_(True)
            )
        )
        or 0
    )
    total_subjects = int(
        db.scalar(
            select(func.count(Subject.id)).where(
                Subject.class_id.in_(class_ids or {-1}),
                *([Subject.id == subject_id] if subject_id is not None else []),
            )
        )
        or 0
    )

    active_by_class = {
        summary["class_id"]: summary["total_students"] for summary in summaries
    }
    today_stmt = (
        select(AttendanceSession)
        .options(
            joinedload(AttendanceSession.class_),
            joinedload(AttendanceSession.subject),
            joinedload(AttendanceSession.creator),
            selectinload(AttendanceSession.records),
        )
        .where(
            AttendanceSession.class_id.in_(class_ids or {-1}),
            AttendanceSession.session_date == on_date,
        )
        .order_by(AttendanceSession.session_number, AttendanceSession.id)
    )
    if subject_id is not None:
        today_stmt = today_stmt.where(AttendanceSession.subject_id == subject_id)
    today_sessions_orm = db.scalars(today_stmt).all()
    today_sessions = []
    present_today = 0
    absent_today = 0
    for session in today_sessions_orm:
        base = session_base(session)
        counts = base["counts"]
        roster_size = active_by_class.get(session.class_id, 0)
        unmarked = max(roster_size - counts["total"], 0)
        today_sessions.append(
            {
                "id": session.id,
                "class_id": session.class_id,
                "class_name": class_label(session.class_),
                "subject_name": session.subject.name,
                "session_date": session.session_date,
                "session_number": session.session_number,
                "present": counts["present"],
                "absent": counts["absent"],
                "od": counts["od"],
                "leave": counts["leave"],
                "unmarked": unmarked,
                "total": roster_size,
                "is_finalized": session.is_finalized,
            }
        )
        present_today += counts["present"]
        absent_today += counts["absent"]

    recent_lists = []
    if class_ids:
        list_items = db.scalars(
            select(CustomList)
            .options(
                joinedload(CustomList.class_),
                joinedload(CustomList.creator),
                selectinload(CustomList.entries),
            )
            .where(
                CustomList.class_id.in_(class_ids),
                CustomList.is_archived.is_(False),
            )
            .order_by(CustomList.updated_at.desc())
            .limit(5)
        ).all()
        recent_lists = [
            {
                "id": item.id,
                "title": item.title,
                "class_name": class_label(item.class_),
                "entry_count": len(item.entries),
                "created_at": item.created_at,
                "creator_name": item.creator.full_name if item.creator else "Unknown",
            }
            for item in list_items
        ]

    trend = recent_trend(db, class_ids, policy, subject_id=subject_id, limit=10)

    scope_label = "All classes"
    if class_id is not None and classes:
        scope_label = class_label(classes[0])
    elif user.role == "faculty":
        scope_label = "My assigned classes"

    admin_faculty_count = None
    admin_user_count = None
    if user.role == "admin":
        admin_faculty_count = int(
            db.scalar(
                select(func.count(User.id)).where(
                    User.role == "faculty", User.is_active.is_(True)
                )
            )
            or 0
        )
        admin_user_count = int(db.scalar(select(func.count(User.id))) or 0)

    return {
        "role": user.role,
        "scope_label": scope_label,
        "total_students": total_students,
        "total_classes": len(classes),
        "total_subjects": total_subjects,
        "session_count": session_count,
        "finalized_session_count": finalized_session_count,
        "today_sessions": today_sessions,
        "present_today": present_today,
        "absent_today": absent_today,
        "average_percentage": average_percentage,
        "threshold": policy.attendance_threshold,
        "low_attendance_count": len(low_rows),
        "low_attendance": low_attendance,
        "recent_lists": recent_lists,
        "trend": trend,
        "faculty_count": admin_faculty_count,
        "user_count": admin_user_count,
        "od_counts_as_attended": policy.od_counts_as_attended,
        "leave_counts_as_attended": policy.leave_counts_as_attended,
    }
