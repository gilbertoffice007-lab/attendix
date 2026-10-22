"""Attendance calculations and session helpers.

Calculation policy (configurable in app_settings):
- Only FINALIZED sessions are eligible.
- A student's eligible count is the number of finalized attendance records for them.
- Attended = Present + (OD if enabled) + (Leave if enabled).
- Percentage = attended / eligible * 100; zero eligible means 0% (never a division error).
- Unmarked or unfinished sessions are never included in the denominator.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import date
from typing import Iterable, Optional

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.models import (
    AppSetting,
    AttendanceRecord,
    AttendanceSession,
    ClassRoom,
    Student,
    Subject,
    User,
)
from app.services.presenters import class_label, session_base, session_detail


def percentage(attended: int, eligible: int) -> float:
    if eligible <= 0:
        return 0.0
    return round(attended / eligible * 100, 2)


def attended_count(present: int, od: int, leave: int, policy: AppSetting) -> int:
    total = present
    if policy.od_counts_as_attended:
        total += od
    if policy.leave_counts_as_attended:
        total += leave
    return total


def load_session(db: Session, session_id: int) -> AttendanceSession | None:
    return db.scalars(
        select(AttendanceSession)
        .options(
            joinedload(AttendanceSession.class_),
            joinedload(AttendanceSession.subject),
            joinedload(AttendanceSession.creator),
            joinedload(AttendanceSession.finalizer),
            selectinload(AttendanceSession.records).joinedload(AttendanceRecord.student),
            selectinload(AttendanceSession.records).joinedload(AttendanceRecord.editor),
        )
        .where(AttendanceSession.id == session_id)
        .execution_options(populate_existing=True)
    ).first()


def session_roster(db: Session, session: AttendanceSession) -> list[Student]:
    return list(
        db.scalars(
            select(Student)
            .options(joinedload(Student.class_))
            .where(Student.class_id == session.class_id, Student.is_active.is_(True))
            .order_by(Student.roll_number)
        ).all()
    )


def serialize_session_detail(db: Session, session: AttendanceSession) -> dict:
    return session_detail(session, session_roster(db, session))


def _date_filters(
    stmt,
    date_from: Optional[date],
    date_to: Optional[date],
):
    if date_from:
        stmt = stmt.where(AttendanceSession.session_date >= date_from)
    if date_to:
        stmt = stmt.where(AttendanceSession.session_date <= date_to)
    return stmt


def _attendance_aggregate_rows(
    db: Session,
    class_id: int,
    policy: AppSetting,
    subject_id: Optional[int] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
) -> dict[int, dict[str, int]]:
    stmt = (
        select(
            AttendanceRecord.student_id,
            func.count(AttendanceRecord.id).label("eligible"),
            func.sum(
                case((AttendanceRecord.status == "present", 1), else_=0)
            ).label("present"),
            func.sum(case((AttendanceRecord.status == "absent", 1), else_=0)).label(
                "absent"
            ),
            func.sum(case((AttendanceRecord.status == "od", 1), else_=0)).label("od"),
            func.sum(case((AttendanceRecord.status == "leave", 1), else_=0)).label(
                "leave"
            ),
        )
        .join(AttendanceSession, AttendanceSession.id == AttendanceRecord.session_id)
        .where(
            AttendanceSession.class_id == class_id,
            AttendanceSession.is_finalized.is_(True),
        )
    )
    if subject_id is not None:
        stmt = stmt.where(AttendanceSession.subject_id == subject_id)
    stmt = _date_filters(stmt, date_from, date_to)
    stmt = stmt.group_by(AttendanceRecord.student_id)
    rows = db.execute(stmt).all()
    return {
        row.student_id: {
            "eligible": int(row.eligible or 0),
            "present": int(row.present or 0),
            "absent": int(row.absent or 0),
            "od": int(row.od or 0),
            "leave": int(row.leave or 0),
        }
        for row in rows
    }


def _finalized_session_count(
    db: Session,
    class_id: int,
    subject_id: Optional[int] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
) -> int:
    stmt = select(func.count(AttendanceSession.id)).where(
        AttendanceSession.class_id == class_id,
        AttendanceSession.is_finalized.is_(True),
    )
    if subject_id is not None:
        stmt = stmt.where(AttendanceSession.subject_id == subject_id)
    stmt = _date_filters(stmt, date_from, date_to)
    return int(db.scalar(stmt) or 0)


def build_class_summary(
    db: Session,
    class_: ClassRoom,
    policy: AppSetting,
    subject: Optional[Subject] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
) -> dict:
    students = list(
        db.scalars(
            select(Student)
            .where(Student.class_id == class_.id, Student.is_active.is_(True))
            .order_by(Student.roll_number)
        ).all()
    )
    aggregates = _attendance_aggregate_rows(
        db,
        class_.id,
        policy,
        subject_id=subject.id if subject else None,
        date_from=date_from,
        date_to=date_to,
    )
    rows: list[dict] = []
    percentages: list[float] = []
    low_count = 0
    for student in students:
        data = aggregates.get(
            student.id,
            {"eligible": 0, "present": 0, "absent": 0, "od": 0, "leave": 0},
        )
        attended = attended_count(
            data["present"], data["od"], data["leave"], policy
        )
        pct = percentage(attended, data["eligible"])
        below = data["eligible"] > 0 and pct < policy.attendance_threshold
        if data["eligible"] > 0:
            percentages.append(pct)
        if below:
            low_count += 1
        rows.append(
            {
                "student_id": student.id,
                "roll_number": student.roll_number,
                "full_name": student.full_name,
                "class_id": class_.id,
                "class_name": class_label(class_),
                "present": data["present"],
                "absent": data["absent"],
                "od": data["od"],
                "leave": data["leave"],
                "attended": attended,
                "eligible": data["eligible"],
                "absences": data["absent"],
                "percentage": pct,
                "below_threshold": below,
            }
        )
    average = round(sum(percentages) / len(percentages), 2) if percentages else 0.0
    return {
        "class_id": class_.id,
        "class_name": class_label(class_),
        "subject_id": subject.id if subject else None,
        "subject_name": subject.name if subject else None,
        "date_from": date_from,
        "date_to": date_to,
        "threshold": policy.attendance_threshold,
        "od_counts_as_attended": policy.od_counts_as_attended,
        "leave_counts_as_attended": policy.leave_counts_as_attended,
        "total_students": len(students),
        "finalized_sessions": _finalized_session_count(
            db, class_.id, subject.id if subject else None, date_from, date_to
        ),
        "average_percentage": average,
        "low_attendance_count": low_count,
        "students": rows,
    }


def build_student_report(
    db: Session, student: Student, policy: AppSetting
) -> dict:
    class_ = student.class_
    all_rows = _attendance_aggregate_rows(db, student.class_id, policy)
    overall = all_rows.get(
        student.id, {"eligible": 0, "present": 0, "absent": 0, "od": 0, "leave": 0}
    )
    attended = attended_count(
        overall["present"], overall["od"], overall["leave"], policy
    )
    pct = percentage(attended, overall["eligible"])

    subjects = list(
        db.scalars(
            select(Subject)
            .where(Subject.class_id == student.class_id)
            .order_by(Subject.name)
        ).all()
    )
    subject_rows = []
    for subject in subjects:
        data = _attendance_aggregate_rows(
            db, student.class_id, policy, subject_id=subject.id
        ).get(
            student.id,
            {"eligible": 0, "present": 0, "absent": 0, "od": 0, "leave": 0},
        )
        subject_attended = attended_count(
            data["present"], data["od"], data["leave"], policy
        )
        subject_rows.append(
            {
                "subject_id": subject.id,
                "subject_name": subject.name,
                "subject_code": subject.subject_code,
                "attended": subject_attended,
                "eligible": data["eligible"],
                "percentage": percentage(subject_attended, data["eligible"]),
            }
        )

    history_rows = db.execute(
        select(
            AttendanceSession.id,
            AttendanceSession.session_date,
            AttendanceSession.session_number,
            AttendanceSession.is_finalized,
            Subject.id,
            Subject.name,
            ClassRoom.name,
            Student.id,
            Student.roll_number,
            Student.full_name,
            AttendanceRecord.status,
            AttendanceRecord.remarks,
        )
        .join(AttendanceRecord, AttendanceRecord.session_id == AttendanceSession.id)
        .join(Subject, Subject.id == AttendanceSession.subject_id)
        .join(ClassRoom, ClassRoom.id == AttendanceSession.class_id)
        .join(Student, Student.id == AttendanceRecord.student_id)
        .where(AttendanceRecord.student_id == student.id)
        .order_by(
            AttendanceSession.session_date.desc(),
            AttendanceSession.session_number.desc(),
            AttendanceSession.id.desc(),
        )
        .limit(200)
    ).all()
    history = [
        {
            "session_id": row[0],
            "session_date": row[1],
            "session_number": row[2],
            "is_finalized": row[3],
            "subject_id": row[4],
            "subject_name": row[5],
            "class_name": row[6],
            "status": row[10],
            "remarks": row[11],
        }
        for row in history_rows
    ]
    return {
        "student_id": student.id,
        "roll_number": student.roll_number,
        "full_name": student.full_name,
        "class_id": student.class_id,
        "class_name": class_label(class_),
        "threshold": policy.attendance_threshold,
        "attended": attended,
        "eligible": overall["eligible"],
        "absences": overall["absent"],
        "present": overall["present"],
        "od": overall["od"],
        "leave": overall["leave"],
        "percentage": pct,
        "below_threshold": overall["eligible"] > 0
        and pct < policy.attendance_threshold,
        "subjects": subject_rows,
        "history": history,
    }


def build_history_stmt(filters: dict):
    stmt = (
        select(
            AttendanceSession.id.label("session_id"),
            AttendanceSession.session_date,
            AttendanceSession.session_number,
            AttendanceSession.is_finalized,
            Subject.id.label("subject_id"),
            Subject.name.label("subject_name"),
            ClassRoom.id.label("class_id"),
            ClassRoom.name.label("class_name"),
            Student.id.label("student_id"),
            Student.roll_number,
            Student.full_name.label("student_name"),
            AttendanceRecord.status,
            AttendanceRecord.remarks,
        )
        .join(AttendanceRecord, AttendanceRecord.session_id == AttendanceSession.id)
        .join(Subject, Subject.id == AttendanceSession.subject_id)
        .join(ClassRoom, ClassRoom.id == AttendanceSession.class_id)
        .join(Student, Student.id == AttendanceRecord.student_id)
    )
    return apply_history_filters(stmt, filters)


def apply_history_filters(stmt, filters: dict):
    if filters.get("class_ids") is not None:
        stmt = stmt.where(AttendanceSession.class_id.in_(filters["class_ids"]))
    if filters.get("class_id"):
        stmt = stmt.where(AttendanceSession.class_id == filters["class_id"])
    if filters.get("subject_id"):
        stmt = stmt.where(AttendanceSession.subject_id == filters["subject_id"])
    if filters.get("student_id"):
        stmt = stmt.where(AttendanceRecord.student_id == filters["student_id"])
    if filters.get("status"):
        stmt = stmt.where(AttendanceRecord.status == filters["status"])
    if filters.get("date_from"):
        stmt = stmt.where(AttendanceSession.session_date >= filters["date_from"])
    if filters.get("date_to"):
        stmt = stmt.where(AttendanceSession.session_date <= filters["date_to"])
    if filters.get("finalized_only"):
        stmt = stmt.where(AttendanceSession.is_finalized.is_(True))
    search = (filters.get("search") or "").strip()
    if search:
        pattern = f"%{search}%"
        stmt = stmt.where(
            Student.full_name.ilike(pattern) | Student.roll_number.ilike(pattern)
        )
    return stmt


def history_rows(db: Session, stmt) -> list[dict]:
    rows = db.execute(
        stmt.order_by(
            AttendanceSession.session_date.desc(),
            AttendanceSession.session_number.desc(),
            Student.roll_number.asc(),
        )
    ).all()
    return [
        {
            "session_id": row[0],
            "session_date": row[1],
            "session_number": row[2],
            "is_finalized": row[3],
            "subject_id": row[4],
            "subject_name": row[5],
            "class_id": row[6],
            "class_name": row[7],
            "student_id": row[8],
            "roll_number": row[9],
            "student_name": row[10],
            "status": row[11],
            "remarks": row[12],
        }
        for row in rows
    ]


def build_subject_report(
    db: Session,
    classes: list[ClassRoom],
    policy: AppSetting,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
) -> list[dict]:
    class_ids = [class_.id for class_ in classes]
    if not class_ids:
        return []
    subjects = list(
        db.scalars(
            select(Subject)
            .options(joinedload(Subject.class_))
            .where(Subject.class_id.in_(class_ids))
            .order_by(ClassRoom.name, Subject.name)
            .join(ClassRoom, ClassRoom.id == Subject.class_id)
        ).all()
    )
    subject_ids = [subject.id for subject in subjects]
    if not subject_ids:
        return []
    stmt = (
        select(
            AttendanceSession.subject_id,
            AttendanceRecord.student_id,
            func.count(AttendanceRecord.id),
            func.sum(case((AttendanceRecord.status == "present", 1), else_=0)),
            func.sum(case((AttendanceRecord.status == "absent", 1), else_=0)),
            func.sum(case((AttendanceRecord.status == "od", 1), else_=0)),
            func.sum(case((AttendanceRecord.status == "leave", 1), else_=0)),
        )
        .join(AttendanceRecord, AttendanceRecord.session_id == AttendanceSession.id)
        .where(
            AttendanceSession.subject_id.in_(subject_ids),
            AttendanceSession.is_finalized.is_(True),
        )
    )
    stmt = _date_filters(stmt, date_from, date_to).group_by(
        AttendanceSession.subject_id, AttendanceRecord.student_id
    )
    raw = db.execute(stmt).all()

    stats: dict[int, dict] = defaultdict(
        lambda: {
            "present": 0,
            "absent": 0,
            "od": 0,
            "leave": 0,
            "student_percentages": [],
            "sessions": set(),
        }
    )
    for row in raw:
        subject_id = row[0]
        present = int(row[3] or 0)
        absent = int(row[4] or 0)
        od = int(row[5] or 0)
        leave = int(row[6] or 0)
        eligible = int(row[2] or 0)
        attended = attended_count(present, od, leave, policy)
        entry = stats[subject_id]
        entry["present"] += present
        entry["absent"] += absent
        entry["od"] += od
        entry["leave"] += leave
        if eligible:
            entry["student_percentages"].append(percentage(attended, eligible))
    sessions_by_subject = dict(
        db.execute(
            select(
                AttendanceSession.subject_id, func.count(AttendanceSession.id)
            )
            .where(
                AttendanceSession.subject_id.in_(subject_ids),
                AttendanceSession.is_finalized.is_(True),
                *(
                    [AttendanceSession.session_date >= date_from]
                    if date_from
                    else []
                ),
                *(
                    [AttendanceSession.session_date <= date_to]
                    if date_to
                    else []
                ),
            )
            .group_by(AttendanceSession.subject_id)
        ).all()
    )
    results = []
    for subject in subjects:
        entry = stats.get(subject.id)
        if not entry:
            continue
        percentages_list = entry["student_percentages"]
        results.append(
            {
                "subject_id": subject.id,
                "subject_name": subject.name,
                "subject_code": subject.subject_code,
                "class_id": subject.class_id,
                "class_name": class_label(subject.class_),
                "finalized_sessions": int(sessions_by_subject.get(subject.id, 0)),
                "present": entry["present"],
                "absent": entry["absent"],
                "od": entry["od"],
                "leave": entry["leave"],
                "average_percentage": (
                    round(sum(percentages_list) / len(percentages_list), 2)
                    if percentages_list
                    else 0.0
                ),
            }
        )
    return results


def recent_trend(
    db: Session,
    class_ids: Iterable[int],
    policy: AppSetting,
    subject_id: Optional[int] = None,
    limit: int = 10,
) -> list[dict]:
    class_ids = list(class_ids)
    if not class_ids:
        return []
    stmt = (
        select(AttendanceSession)
        .options(selectinload(AttendanceSession.records))
        .where(
            AttendanceSession.class_id.in_(class_ids),
            AttendanceSession.is_finalized.is_(True),
        )
    )
    if subject_id is not None:
        stmt = stmt.where(AttendanceSession.subject_id == subject_id)
    sessions = list(
        db.scalars(
            stmt
            .order_by(
                AttendanceSession.session_date.desc(),
                AttendanceSession.session_number.desc(),
                AttendanceSession.id.desc(),
            )
            .limit(limit)
        ).all()
    )
    trend = []
    for session in reversed(sessions):
        records = session.records
        total = len(records)
        present = sum(1 for r in records if r.status == "present")
        od = sum(1 for r in records if r.status == "od")
        leave = sum(1 for r in records if r.status == "leave")
        attended = attended_count(present, od, leave, policy)
        trend.append(
            {
                "label": f"{session.session_date.strftime('%d %b')} · P{session.session_number}",
                "date": session.session_date,
                "session_id": session.id,
                "percentage": percentage(attended, total),
                "present": attended,
                "total": total,
            }
        )
    return trend


def summary_from_session(session: AttendanceSession) -> dict:
    return session_base(session)
