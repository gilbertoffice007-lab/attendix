from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload, selectinload

from app.core.deps import (
    accessible_class_ids,
    ensure_class_access,
    get_current_user,
    get_policy,
    require_staff,
)
from app.db.session import get_db
from app.models import (
    AttendanceRecord,
    AttendanceSession,
    ClassRoom,
    Student,
    Subject,
    User,
)
from app.schemas.attendance import (
    AttendanceSummary,
    ClassReportRow,
    HistoryPage,
    HistoryRow,
    SessionCreate,
    SessionDetail,
    SessionFinalizeRequest,
    SessionListItem,
    SessionPage,
    SessionRecordsUpdate,
    StudentReport,
    StudentSummaryRow,
    SubjectReportRow,
)
from app.schemas.common import Message
from app.services.attendance import (
    apply_history_filters,
    build_class_summary,
    build_history_stmt,
    build_student_report,
    build_subject_report,
    history_rows,
    load_session,
    serialize_session_detail,
    session_base,
    session_roster,
)
from app.services.audit import record_audit
from app.services.exports import export_response

router = APIRouter(prefix="/attendance", tags=["Attendance"])

STATUS_LABEL = {
    "present": "Present",
    "absent": "Absent",
    "od": "On Duty",
    "leave": "Leave",
    "unmarked": "Unmarked",
}


def _load_session_or_404(db: Session, session_id: int) -> AttendanceSession:
    session = load_session(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Attendance session not found")
    return session


def _validate_dates(date_from: Optional[date], date_to: Optional[date]) -> None:
    if date_from and date_to and date_from > date_to:
        raise HTTPException(status_code=400, detail="Start date cannot be after end date")


def _scope_class_ids(db: Session, user: User, class_id: Optional[int] = None) -> set[int] | None:
    allowed = accessible_class_ids(db, user)
    if class_id is not None:
        ensure_class_access(db, user, class_id)
    return allowed


@router.post("/sessions", response_model=SessionDetail, status_code=201)
def create_session(
    payload: SessionCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_staff),
):
    ensure_class_access(db, user, payload.class_id)
    if user.role == "student":
        raise HTTPException(status_code=403, detail="Students cannot create sessions")
    subject = db.get(Subject, payload.subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    if subject.class_id != payload.class_id:
        raise HTTPException(status_code=400, detail="Subject does not belong to the selected class")
    if payload.session_date > date.today():
        raise HTTPException(status_code=400, detail="Attendance cannot be recorded for a future date")
    duplicate = db.scalar(
        select(AttendanceSession).where(
            AttendanceSession.class_id == payload.class_id,
            AttendanceSession.subject_id == payload.subject_id,
            AttendanceSession.session_date == payload.session_date,
            AttendanceSession.session_number == payload.session_number,
        )
    )
    if duplicate:
        raise HTTPException(
            status_code=409,
            detail="An attendance session already exists for this class, subject, date and session number",
        )
    session = AttendanceSession(
        class_id=payload.class_id,
        subject_id=payload.subject_id,
        session_date=payload.session_date,
        session_number=payload.session_number,
        notes=payload.notes,
        created_by=user.id,
    )
    db.add(session)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="An attendance session already exists for this class, subject, date and session number",
        )
    record_audit(
        db,
        user,
        "attendance_session",
        session.id,
        "created",
        new_value={
            "class_id": session.class_id,
            "subject_id": session.subject_id,
            "session_date": session.session_date.isoformat(),
            "session_number": session.session_number,
        },
    )
    db.commit()
    session = _load_session_or_404(db, session.id)
    return SessionDetail(**serialize_session_detail(db, session))


@router.get("/sessions", response_model=SessionPage)
def list_sessions(
    class_id: Optional[int] = Query(default=None),
    subject_id: Optional[int] = Query(default=None),
    date_from: Optional[date] = Query(default=None),
    date_to: Optional[date] = Query(default=None),
    finalized: Optional[bool] = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    user: User = Depends(require_staff),
):
    _validate_dates(date_from, date_to)
    allowed = _scope_class_ids(db, user, class_id)
    base_filters = []
    if allowed is not None:
        base_filters.append(AttendanceSession.class_id.in_(allowed or {-1}))
    if class_id is not None:
        base_filters.append(AttendanceSession.class_id == class_id)
    if subject_id is not None:
        base_filters.append(AttendanceSession.subject_id == subject_id)
    if date_from:
        base_filters.append(AttendanceSession.session_date >= date_from)
    if date_to:
        base_filters.append(AttendanceSession.session_date <= date_to)
    if finalized is not None:
        base_filters.append(AttendanceSession.is_finalized.is_(finalized))
    count_stmt = select(func.count(AttendanceSession.id))
    for condition in base_filters:
        count_stmt = count_stmt.where(condition)
    total = int(db.scalar(count_stmt) or 0)
    stmt = (
        select(AttendanceSession)
        .options(
            joinedload(AttendanceSession.class_),
            joinedload(AttendanceSession.subject),
            joinedload(AttendanceSession.creator),
            selectinload(AttendanceSession.records),
        )
        .order_by(
            AttendanceSession.session_date.desc(),
            AttendanceSession.session_number.desc(),
            AttendanceSession.id.desc(),
        )
    )
    for condition in base_filters:
        stmt = stmt.where(condition)
    sessions = db.scalars(
        stmt.offset((page - 1) * page_size).limit(page_size)
    ).all()
    return SessionPage(
        items=[SessionListItem(**session_base(session)) for session in sessions],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/sessions/{session_id}", response_model=SessionDetail)
def get_session(
    session_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_staff),
):
    session = _load_session_or_404(db, session_id)
    ensure_class_access(db, user, session.class_id)
    return SessionDetail(**serialize_session_detail(db, session))


@router.put("/sessions/{session_id}/records", response_model=SessionDetail)
def update_records(
    session_id: int,
    payload: SessionRecordsUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_staff),
):
    session = _load_session_or_404(db, session_id)
    ensure_class_access(db, user, session.class_id)
    if session.is_finalized:
        raise HTTPException(
            status_code=409,
            detail="This session is finalized and locked. An administrator must unlock it before editing.",
        )
    student_ids = [record.student_id for record in payload.records]
    if len(set(student_ids)) != len(student_ids):
        raise HTTPException(status_code=400, detail="Duplicate students in the attendance payload")
    students = db.scalars(select(Student).where(Student.id.in_(student_ids))).all()
    student_map = {student.id: student for student in students}
    missing = [sid for sid in student_ids if sid not in student_map]
    if missing:
        raise HTTPException(status_code=400, detail="One or more students do not exist")
    for student in students:
        if student.class_id != session.class_id:
            raise HTTPException(
                status_code=400,
                detail=f"Student {student.roll_number} does not belong to this class",
            )
    existing = {
        record.student_id: record
        for record in db.scalars(
            select(AttendanceRecord).where(AttendanceRecord.session_id == session.id)
        ).all()
    }
    for item in payload.records:
        student = student_map[item.student_id]
        record = existing.get(item.student_id)
        if record is None and not student.is_active:
            raise HTTPException(
                status_code=400,
                detail=f"Inactive student {student.roll_number} cannot be added to a new attendance save",
            )
        if record is None:
            record = AttendanceRecord(
                session_id=session.id,
                student_id=item.student_id,
                status=item.status,
                remarks=item.remarks,
                updated_by=user.id,
            )
            db.add(record)
            db.flush()
            record_audit(
                db,
                user,
                "attendance_record",
                record.id,
                "marked",
                new_value={
                    "session_id": session.id,
                    "student_id": student.id,
                    "status": item.status,
                    "remarks": item.remarks,
                },
            )
        else:
            if record.status != item.status or (record.remarks or "") != (item.remarks or ""):
                record_audit(
                    db,
                    user,
                    "attendance_record",
                    record.id,
                    "corrected",
                    previous_value={"status": record.status, "remarks": record.remarks},
                    new_value={
                        "session_id": session.id,
                        "student_id": student.id,
                        "status": item.status,
                        "remarks": item.remarks,
                    },
                )
                record.status = item.status
                record.remarks = item.remarks
                record.updated_by = user.id
    record_audit(
        db,
        user,
        "attendance_session",
        session.id,
        "attendance_saved",
        new_value={"saved_records": len(payload.records)},
    )
    db.commit()
    session = _load_session_or_404(db, session.id)
    return SessionDetail(**serialize_session_detail(db, session))


@router.patch("/sessions/{session_id}/finalize", response_model=SessionDetail)
def finalize_session(
    session_id: int,
    payload: SessionFinalizeRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_staff),
):
    session = _load_session_or_404(db, session_id)
    ensure_class_access(db, user, session.class_id)
    if payload.is_finalized:
        if session.is_finalized:
            return SessionDetail(**serialize_session_detail(db, session))
        records = {record.student_id: record for record in session.records}
        active_students = db.scalars(
            select(Student).where(
                Student.class_id == session.class_id, Student.is_active.is_(True)
            )
        ).all()
        missing = [student for student in active_students if student.id not in records]
        if missing:
            names = ", ".join(
                f"{student.roll_number} {student.full_name}" for student in missing[:5]
            )
            more = f" and {len(missing) - 5} more" if len(missing) > 5 else ""
            raise HTTPException(
                status_code=400,
                detail=f"All active students must be marked before finalizing. Missing: {names}{more}",
            )
        session.is_finalized = True
        session.finalized_at = datetime.now(timezone.utc)
        session.finalized_by = user.id
        record_audit(
            db,
            user,
            "attendance_session",
            session.id,
            "finalized",
            new_value={"finalized_by": user.id},
        )
    else:
        if user.role != "admin":
            raise HTTPException(
                status_code=403,
                detail="Only administrators can unlock a finalized session",
            )
        if not session.is_finalized:
            return SessionDetail(**serialize_session_detail(db, session))
        session.is_finalized = False
        session.finalized_at = None
        session.finalized_by = None
        record_audit(
            db,
            user,
            "attendance_session",
            session.id,
            "unlocked",
            new_value={"unlocked_by": user.id},
        )
    db.commit()
    session = _load_session_or_404(db, session.id)
    return SessionDetail(**serialize_session_detail(db, session))


@router.get("/reports/summary", response_model=AttendanceSummary)
def attendance_summary(
    class_id: int = Query(...),
    subject_id: Optional[int] = Query(default=None),
    date_from: Optional[date] = Query(default=None),
    date_to: Optional[date] = Query(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(require_staff),
):
    _validate_dates(date_from, date_to)
    ensure_class_access(db, user, class_id)
    class_ = db.get(ClassRoom, class_id)
    if not class_:
        raise HTTPException(status_code=404, detail="Class not found")
    subject = None
    if subject_id is not None:
        subject = db.get(Subject, subject_id)
        if not subject:
            raise HTTPException(status_code=404, detail="Subject not found")
        if subject.class_id != class_id:
            raise HTTPException(status_code=400, detail="Subject does not belong to this class")
    policy = get_policy(db)
    data = build_class_summary(db, class_, policy, subject, date_from, date_to)
    return AttendanceSummary(**data)


@router.get("/reports/student/me", response_model=StudentReport)
def my_student_report(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if user.role != "student" or not user.student_id:
        raise HTTPException(status_code=403, detail="This endpoint is for student accounts")
    student = db.scalars(
        select(Student)
        .options(joinedload(Student.class_))
        .where(Student.id == user.student_id)
    ).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found")
    policy = get_policy(db)
    return StudentReport(**build_student_report(db, student, policy))


@router.get("/reports/student/{student_id}", response_model=StudentReport)
def student_report(
    student_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    student = db.scalars(
        select(Student)
        .options(joinedload(Student.class_))
        .where(Student.id == student_id)
    ).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    if user.role == "student":
        if user.student_id != student.id:
            raise HTTPException(status_code=403, detail="You can only view your own attendance")
    else:
        ensure_class_access(db, user, student.class_id)
    policy = get_policy(db)
    return StudentReport(**build_student_report(db, student, policy))


@router.get("/reports/history", response_model=HistoryPage)
def attendance_history(
    class_id: Optional[int] = Query(default=None),
    subject_id: Optional[int] = Query(default=None),
    student_id: Optional[int] = Query(default=None),
    status: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    date_from: Optional[date] = Query(default=None),
    date_to: Optional[date] = Query(default=None),
    finalized_only: bool = Query(default=False),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=200),
    db: Session = Depends(get_db),
    user: User = Depends(require_staff),
):
    _validate_dates(date_from, date_to)
    if status and status not in ("present", "absent", "od", "leave"):
        raise HTTPException(status_code=400, detail="Invalid attendance status filter")
    allowed = _scope_class_ids(db, user, class_id)
    filters = {
        "class_ids": allowed,
        "class_id": class_id,
        "subject_id": subject_id,
        "student_id": student_id,
        "status": status,
        "search": search,
        "date_from": date_from,
        "date_to": date_to,
        "finalized_only": finalized_only,
    }
    stmt = build_history_stmt(filters)
    count_stmt = (
        select(func.count(AttendanceRecord.id))
        .join(AttendanceSession, AttendanceSession.id == AttendanceRecord.session_id)
        .join(Student, Student.id == AttendanceRecord.student_id)
    )
    count_stmt = apply_history_filters(count_stmt, filters)
    total = int(db.scalar(count_stmt) or 0)
    stmt = stmt.offset((page - 1) * page_size).limit(page_size)
    rows = [HistoryRow(**row) for row in history_rows(db, stmt)]
    return HistoryPage(items=rows, total=total, page=page, page_size=page_size)


@router.get("/reports/subject", response_model=list[SubjectReportRow])
def subject_report(
    class_id: Optional[int] = Query(default=None),
    date_from: Optional[date] = Query(default=None),
    date_to: Optional[date] = Query(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(require_staff),
):
    _validate_dates(date_from, date_to)
    allowed = _scope_class_ids(db, user, class_id)
    stmt = select(ClassRoom).options(joinedload(ClassRoom.subjects))
    if class_id is not None:
        stmt = stmt.where(ClassRoom.id == class_id)
    elif allowed is not None:
        stmt = stmt.where(ClassRoom.id.in_(allowed or {-1}))
    classes = list(db.scalars(stmt.order_by(ClassRoom.name)).all())
    policy = get_policy(db)
    rows = build_subject_report(db, classes, policy, date_from, date_to)
    return [SubjectReportRow(**row) for row in rows]


@router.get("/reports/class", response_model=list[ClassReportRow])
def class_report(
    date_from: Optional[date] = Query(default=None),
    date_to: Optional[date] = Query(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(require_staff),
):
    _validate_dates(date_from, date_to)
    allowed = accessible_class_ids(db, user)
    stmt = select(ClassRoom)
    if allowed is not None:
        stmt = stmt.where(ClassRoom.id.in_(allowed or {-1}))
    classes = db.scalars(stmt.order_by(ClassRoom.department, ClassRoom.name)).all()
    policy = get_policy(db)
    rows = []
    for class_ in classes:
        summary = build_class_summary(db, class_, policy, None, date_from, date_to)
        rows.append(
            ClassReportRow(
                class_id=class_.id,
                class_name=class_.name,
                department=class_.department,
                semester=class_.semester,
                academic_year=class_.academic_year,
                student_count=summary["total_students"],
                finalized_sessions=summary["finalized_sessions"],
                average_percentage=summary["average_percentage"],
                below_threshold_count=summary["low_attendance_count"],
            )
        )
    return rows


@router.get("/sessions/{session_id}/export")
def export_session(
    session_id: int,
    format: str = Query(default="csv"),
    db: Session = Depends(get_db),
    user: User = Depends(require_staff),
):
    if format.lower() not in ("csv", "xlsx"):
        raise HTTPException(status_code=400, detail="Format must be csv or xlsx")
    session = _load_session_or_404(db, session_id)
    ensure_class_access(db, user, session.class_id)
    detail = serialize_session_detail(db, session)
    rows = [
        {
            "roll_number": entry["roll_number"],
            "student_name": entry["student_name"],
            "status": STATUS_LABEL.get(entry["status"] or "unmarked", "Unmarked"),
            "remarks": entry["remarks"] or "",
            "last_updated": entry["updated_at"],
            "updated_by": entry["updated_by_name"] or "",
        }
        for entry in detail["entries"]
    ]
    counts = detail["counts"]
    summary = [
        f"Class: {session.class_.name} · {session.class_.department} · Semester {session.class_.semester}",
        f"Subject: {session.subject.name} ({session.subject.subject_code})",
        f"Date: {session.session_date.isoformat()} · Session {session.session_number}",
        f"Status: {'Finalized' if session.is_finalized else 'Draft'}",
        f"Present: {counts['present']} · Absent: {counts['absent']} · OD: {counts['od']} · Leave: {counts['leave']} · Unmarked: {counts['unmarked']}",
    ]
    filename_stem = (
        f"attendance_{session.class_.name}_{session.session_date.isoformat()}"
        f"_session{session.session_number}"
    )
    return export_response(
        rows,
        [
            ("Roll Number", "roll_number"),
            ("Student Name", "student_name"),
            ("Status", "status"),
            ("Remarks", "remarks"),
            ("Last Updated", "last_updated"),
            ("Updated By", "updated_by"),
        ],
        filename_stem,
        format,
        title=f"{session.subject.name} Attendance Register",
        summary=summary,
    )


@router.get("/reports/export")
def export_report(
    report: str = Query(default="students"),
    format: str = Query(default="csv"),
    class_id: Optional[int] = Query(default=None),
    subject_id: Optional[int] = Query(default=None),
    student_id: Optional[int] = Query(default=None),
    status: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    date_from: Optional[date] = Query(default=None),
    date_to: Optional[date] = Query(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if format.lower() not in ("csv", "xlsx"):
        raise HTTPException(status_code=400, detail="Format must be csv or xlsx")
    if report not in ("history", "students", "subject", "class", "student"):
        raise HTTPException(status_code=400, detail="Unknown report type")
    _validate_dates(date_from, date_to)
    if user.role == "student":
        if report != "student":
            raise HTTPException(status_code=403, detail="Students can only export their own attendance")
        student_id = user.student_id
    if report == "student":
        if not student_id:
            raise HTTPException(status_code=400, detail="Select a student")
        student = db.scalars(
            select(Student)
            .options(joinedload(Student.class_))
            .where(Student.id == student_id)
        ).first()
        if not student:
            raise HTTPException(status_code=404, detail="Student not found")
        if user.role != "student":
            ensure_class_access(db, user, student.class_id)
        policy = get_policy(db)
        data = build_student_report(db, student, policy)
        rows = [
            {
                "subject": row["subject_name"],
                "code": row["subject_code"],
                "attended": row["attended"],
                "eligible": row["eligible"],
                "percentage": row["percentage"],
            }
            for row in data["subjects"]
        ]
        summary = [
            f"Student: {student.full_name} ({student.roll_number})",
            f"Class: {student.class_.name} · Semester {student.class_.semester}",
            f"Overall: {data['attended']}/{data['eligible']} attended · {data['percentage']}%",
            f"Absences: {data['absences']} · Threshold: {data['threshold']}%",
        ]
        return export_response(
            rows,
            [
                ("Subject", "subject"),
                ("Code", "code"),
                ("Attended", "attended"),
                ("Eligible", "eligible"),
                ("Percentage", "percentage"),
            ],
            f"attendance_{student.roll_number}_{date.today().isoformat()}",
            format,
            title="Student Attendance Summary",
            summary=summary,
        )

    if user.role == "student":
        raise HTTPException(status_code=403, detail="Not permitted")
    allowed = accessible_class_ids(db, user)
    if class_id is not None:
        ensure_class_access(db, user, class_id)

    if report == "history":
        filters = {
            "class_ids": allowed,
            "class_id": class_id,
            "subject_id": subject_id,
            "student_id": student_id,
            "status": status,
            "search": search,
            "date_from": date_from,
            "date_to": date_to,
            "finalized_only": False,
        }
        if status and status not in ("present", "absent", "od", "leave"):
            raise HTTPException(status_code=400, detail="Invalid status filter")
        stmt = build_history_stmt(filters).limit(20000)
        data = history_rows(db, stmt)
        rows = [
            {
                "date": row["session_date"],
                "class_name": row["class_name"],
                "subject": row["subject_name"],
                "session": row["session_number"],
                "roll_number": row["roll_number"],
                "student_name": row["student_name"],
                "status": STATUS_LABEL.get(row["status"], row["status"]),
                "remarks": row["remarks"] or "",
                "finalized": "Yes" if row["is_finalized"] else "No",
            }
            for row in data
        ]
        summary = [f"Records: {len(rows)}", f"Export date: {date.today().isoformat()}"]
        if date_from or date_to:
            summary.append(
                f"Date range: {date_from.isoformat() if date_from else 'start'} to {date_to.isoformat() if date_to else 'today'}"
            )
        return export_response(
            rows,
            [
                ("Date", "date"),
                ("Class", "class_name"),
                ("Subject", "subject"),
                ("Session", "session"),
                ("Roll Number", "roll_number"),
                ("Student Name", "student_name"),
                ("Status", "status"),
                ("Remarks", "remarks"),
                ("Finalized", "finalized"),
            ],
            f"attendance_history_{date.today().isoformat()}",
            format,
            title="Attendance History",
            summary=summary,
        )

    if report in ("students", "subject"):
        if class_id is None:
            raise HTTPException(status_code=400, detail="Select a class for this report")
        class_ = db.get(ClassRoom, class_id)
        if not class_:
            raise HTTPException(status_code=404, detail="Class not found")
        subject = None
        if subject_id is not None:
            subject = db.get(Subject, subject_id)
            if not subject or subject.class_id != class_id:
                raise HTTPException(status_code=400, detail="Subject does not belong to this class")
        policy = get_policy(db)
        if report == "students":
            data = build_class_summary(db, class_, policy, subject, date_from, date_to)
            rows = [
                {
                    "roll_number": row["roll_number"],
                    "student_name": row["full_name"],
                    "attended": row["attended"],
                    "eligible": row["eligible"],
                    "absent": row["absences"],
                    "od": row["od"],
                    "leave": row["leave"],
                    "percentage": row["percentage"],
                    "below": "Yes" if row["below_threshold"] else "No",
                }
                for row in data["students"]
            ]
            summary = [
                f"Class: {class_.name} · {class_.department} · Semester {class_.semester}",
                f"Subject: {subject.name if subject else 'All subjects'}",
                f"Finalized sessions: {data['finalized_sessions']} · Threshold: {data['threshold']}%",
                f"Average attendance: {data['average_percentage']}% · Below threshold: {data['low_attendance_count']}",
                f"Export date: {date.today().isoformat()}",
            ]
            return export_response(
                rows,
                [
                    ("Roll Number", "roll_number"),
                    ("Student Name", "student_name"),
                    ("Attended", "attended"),
                    ("Eligible", "eligible"),
                    ("Absences", "absent"),
                    ("OD", "od"),
                    ("Leave", "leave"),
                    ("Percentage", "percentage"),
                    ("Below Threshold", "below"),
                ],
                f"attendance_{class_.name}_{date.today().isoformat()}",
                format,
                title="Student-wise Attendance Summary",
                summary=summary,
            )
        data = build_subject_report(db, [class_], policy, date_from, date_to)
        rows = [
            {
                "subject": row["subject_name"],
                "code": row["subject_code"],
                "sessions": row["finalized_sessions"],
                "present": row["present"],
                "absent": row["absent"],
                "od": row["od"],
                "leave": row["leave"],
                "average": row["average_percentage"],
            }
            for row in data
        ]
        summary = [
            f"Class: {class_.name} · {class_.department} · Semester {class_.semester}",
            f"Export date: {date.today().isoformat()}",
        ]
        return export_response(
            rows,
            [
                ("Subject", "subject"),
                ("Code", "code"),
                ("Finalized Sessions", "sessions"),
                ("Present", "present"),
                ("Absent", "absent"),
                ("OD", "od"),
                ("Leave", "leave"),
                ("Average Percentage", "average"),
            ],
            f"attendance_subjects_{class_.name}_{date.today().isoformat()}",
            format,
            title="Subject-wise Attendance Report",
            summary=summary,
        )

    stmt = select(ClassRoom)
    if allowed is not None:
        stmt = stmt.where(ClassRoom.id.in_(allowed or {-1}))
    classes = db.scalars(stmt.order_by(ClassRoom.department, ClassRoom.name)).all()
    policy = get_policy(db)
    rows = []
    for class_ in classes:
        data = build_class_summary(db, class_, policy, None, date_from, date_to)
        rows.append(
            {
                "class_name": class_.name,
                "department": class_.department,
                "semester": class_.semester,
                "academic_year": class_.academic_year,
                "students": data["total_students"],
                "sessions": data["finalized_sessions"],
                "average": data["average_percentage"],
                "below": data["low_attendance_count"],
            }
        )
    return export_response(
        rows,
        [
            ("Class", "class_name"),
            ("Department", "department"),
            ("Semester", "semester"),
            ("Academic Year", "academic_year"),
            ("Students", "students"),
            ("Finalized Sessions", "sessions"),
            ("Average Percentage", "average"),
            ("Below Threshold", "below"),
        ],
        f"attendance_classes_{date.today().isoformat()}",
        format,
        title="Class-wise Attendance Report",
        summary=[f"Classes: {len(rows)}", f"Export date: {date.today().isoformat()}"],
    )
