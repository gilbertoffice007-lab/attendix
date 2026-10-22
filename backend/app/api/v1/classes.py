from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.core.deps import (
    accessible_class_ids,
    ensure_class_access,
    get_current_user,
    require_admin,
    require_staff,
)
from app.db.session import get_db
from app.models import ClassRoom, FacultyClassAssignment, Student, Subject, User
from app.schemas.class_ import ClassCreate, ClassOut, ClassUpdate
from app.schemas.student import StudentOut
from app.services.audit import record_audit
from app.services.presenters import class_label, student_out

router = APIRouter(prefix="/classes", tags=["Classes"])


def _class_out(db: Session, class_: ClassRoom) -> ClassOut:
    student_count = int(
        db.scalar(
            select(func.count(Student.id)).where(
                Student.class_id == class_.id, Student.is_active.is_(True)
            )
        )
        or 0
    )
    subject_count = int(
        db.scalar(select(func.count(Subject.id)).where(Subject.class_id == class_.id)) or 0
    )
    return ClassOut(
        id=class_.id,
        name=class_.name,
        department=class_.department,
        semester=class_.semester,
        academic_year=class_.academic_year,
        student_count=student_count,
        subject_count=subject_count,
        created_at=class_.created_at,
    )


@router.get("", response_model=list[ClassOut])
def list_classes(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    allowed = accessible_class_ids(db, user)
    stmt = select(ClassRoom)
    if allowed is not None:
        stmt = stmt.where(ClassRoom.id.in_(allowed or {-1}))
    classes = db.scalars(stmt.order_by(ClassRoom.department, ClassRoom.semester, ClassRoom.name)).all()
    return [_class_out(db, class_) for class_ in classes]


@router.post("", response_model=ClassOut, status_code=201)
def create_class(
    payload: ClassCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    class_ = ClassRoom(
        name=payload.name.strip(),
        department=payload.department.strip(),
        semester=payload.semester,
        academic_year=payload.academic_year.strip(),
    )
    db.add(class_)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="A class with the same name, department, semester and academic year already exists",
        )
    record_audit(
        db,
        admin,
        "class",
        class_.id,
        "created",
        new_value={"name": class_.name, "department": class_.department},
    )
    db.commit()
    db.refresh(class_)
    return _class_out(db, class_)


@router.get("/{class_id}", response_model=ClassOut)
def get_class(
    class_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    class_ = db.get(ClassRoom, class_id)
    if not class_:
        raise HTTPException(status_code=404, detail="Class not found")
    ensure_class_access(db, user, class_id)
    return _class_out(db, class_)


@router.patch("/{class_id}", response_model=ClassOut)
def update_class(
    class_id: int,
    payload: ClassUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    class_ = db.get(ClassRoom, class_id)
    if not class_:
        raise HTTPException(status_code=404, detail="Class not found")
    previous = {
        "name": class_.name,
        "department": class_.department,
        "semester": class_.semester,
        "academic_year": class_.academic_year,
    }
    updates = payload.model_dump(exclude_unset=True)
    for field in ("name", "department", "academic_year"):
        if field in updates and updates[field] is not None:
            setattr(class_, field, updates[field].strip())
    if updates.get("semester") is not None:
        class_.semester = updates["semester"]
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Another class already uses these details")
    record_audit(
        db,
        admin,
        "class",
        class_.id,
        "updated",
        previous_value=previous,
        new_value={
            "name": class_.name,
            "department": class_.department,
            "semester": class_.semester,
            "academic_year": class_.academic_year,
        },
    )
    db.commit()
    db.refresh(class_)
    return _class_out(db, class_)


@router.get("/{class_id}/students", response_model=list[StudentOut])
def class_students(
    class_id: int,
    search: Optional[str] = Query(default=None),
    include_inactive: bool = Query(default=False),
    db: Session = Depends(get_db),
    user: User = Depends(require_staff),
):
    ensure_class_access(db, user, class_id)
    stmt = (
        select(Student)
        .options(joinedload(Student.class_), joinedload(Student.user_account))
        .where(Student.class_id == class_id)
    )
    if not include_inactive:
        stmt = stmt.where(Student.is_active.is_(True))
    if search:
        pattern = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(Student.full_name.ilike(pattern), Student.roll_number.ilike(pattern))
        )
    students = db.scalars(stmt.order_by(Student.roll_number)).all()
    return [StudentOut(**student_out(student)) for student in students]


@router.get("/{class_id}/subjects")
def class_subjects(
    class_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    ensure_class_access(db, user, class_id)
    subjects = db.scalars(
        select(Subject).where(Subject.class_id == class_id).order_by(Subject.name)
    ).all()
    session_counts = dict(
        db.execute(
            select(Subject.id, func.count(Subject.id))
            .join(Subject.sessions)
            .where(Subject.class_id == class_id)
            .group_by(Subject.id)
        ).all()
    )
    faculty = {
        user.id: user.full_name
        for user in db.scalars(select(User).where(User.role == "faculty")).all()
    }
    return [
        {
            "id": subject.id,
            "name": subject.name,
            "subject_code": subject.subject_code,
            "class_id": subject.class_id,
            "class_name": class_label(db.get(ClassRoom, class_id)),
            "faculty_id": subject.faculty_id,
            "faculty_name": faculty.get(subject.faculty_id) if subject.faculty_id else None,
            "session_count": int(session_counts.get(subject.id, 0)),
        }
        for subject in subjects
    ]


@router.get("/{class_id}/faculty")
def class_faculty(
    class_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    if not db.get(ClassRoom, class_id):
        raise HTTPException(status_code=404, detail="Class not found")
    rows = db.execute(
        select(User)
        .join(FacultyClassAssignment, FacultyClassAssignment.faculty_id == User.id)
        .where(FacultyClassAssignment.class_id == class_id)
        .order_by(User.full_name)
    ).scalars().all()
    return [
        {"id": row.id, "full_name": row.full_name, "email": row.email, "is_active": row.is_active}
        for row in rows
    ]
