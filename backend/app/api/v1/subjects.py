from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.core.deps import (
    accessible_class_ids,
    ensure_class_access,
    ensure_class_write,
    get_current_user,
    require_staff,
)
from app.db.session import get_db
from app.models import ClassRoom, Subject, User
from app.schemas.subject import SubjectCreate, SubjectOut, SubjectUpdate
from app.services.audit import record_audit
from app.services.presenters import class_label

router = APIRouter(prefix="/subjects", tags=["Subjects"])


def _subject_out(db: Session, subject: Subject) -> SubjectOut:
    session_count = int(
        db.scalar(
            select(func.count(Subject.id))
            .join(Subject.sessions)
            .where(Subject.id == subject.id)
        )
        or 0
    )
    faculty = db.get(User, subject.faculty_id) if subject.faculty_id else None
    class_ = subject.class_ or db.get(ClassRoom, subject.class_id)
    return SubjectOut(
        id=subject.id,
        name=subject.name,
        subject_code=subject.subject_code,
        class_id=subject.class_id,
        class_name=class_label(class_) if class_ else "",
        faculty_id=subject.faculty_id,
        faculty_name=faculty.full_name if faculty else None,
        session_count=session_count,
    )


@router.get("", response_model=list[SubjectOut])
def list_subjects(
    class_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    allowed = accessible_class_ids(db, user)
    if class_id is not None:
        ensure_class_access(db, user, class_id)
    stmt = select(Subject).options(joinedload(Subject.class_))
    if class_id is not None:
        stmt = stmt.where(Subject.class_id == class_id)
    elif allowed is not None:
        stmt = stmt.where(Subject.class_id.in_(allowed or {-1}))
    subjects = db.scalars(stmt.order_by(Subject.name)).all()
    return [_subject_out(db, subject) for subject in subjects]


@router.post("", response_model=SubjectOut, status_code=201)
def create_subject(
    payload: SubjectCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_staff),
):
    ensure_class_write(db, user, payload.class_id)
    faculty_id = payload.faculty_id
    if user.role == "faculty" and faculty_id is None:
        faculty_id = user.id
    if faculty_id is not None:
        faculty = db.get(User, faculty_id)
        if not faculty or faculty.role != "faculty":
            raise HTTPException(status_code=400, detail="Selected faculty account is invalid")
    subject = Subject(
        name=payload.name.strip(),
        subject_code=payload.subject_code.strip(),
        class_id=payload.class_id,
        faculty_id=faculty_id,
    )
    db.add(subject)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409, detail="This subject code already exists for the class"
        )
    record_audit(
        db,
        user,
        "subject",
        subject.id,
        "created",
        new_value={"name": subject.name, "code": subject.subject_code, "class_id": subject.class_id},
    )
    db.commit()
    db.refresh(subject)
    subject.class_ = db.get(ClassRoom, subject.class_id)
    return _subject_out(db, subject)


@router.patch("/{subject_id}", response_model=SubjectOut)
def update_subject(
    subject_id: int,
    payload: SubjectUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_staff),
):
    subject = db.get(Subject, subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    ensure_class_write(db, user, subject.class_id)
    updates = payload.model_dump(exclude_unset=True)
    previous = {"name": subject.name, "code": subject.subject_code, "faculty_id": subject.faculty_id}
    if updates.get("name") is not None:
        subject.name = updates["name"].strip()
    if updates.get("subject_code") is not None:
        subject.subject_code = updates["subject_code"].strip()
    if "faculty_id" in updates:
        faculty_id = updates["faculty_id"]
        if faculty_id is not None:
            faculty = db.get(User, faculty_id)
            if not faculty or faculty.role != "faculty":
                raise HTTPException(status_code=400, detail="Selected faculty account is invalid")
        subject.faculty_id = faculty_id
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="This subject code already exists for the class")
    record_audit(
        db,
        user,
        "subject",
        subject.id,
        "updated",
        previous_value=previous,
        new_value={"name": subject.name, "code": subject.subject_code, "faculty_id": subject.faculty_id},
    )
    db.commit()
    db.refresh(subject)
    subject.class_ = db.get(ClassRoom, subject.class_id)
    return _subject_out(db, subject)


@router.delete("/{subject_id}")
def delete_subject(
    subject_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_staff),
):
    subject = db.get(Subject, subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    ensure_class_write(db, user, subject.class_id)
    session_count = int(
        db.scalar(
            select(func.count(Subject.id))
            .join(Subject.sessions)
            .where(Subject.id == subject_id)
        )
        or 0
    )
    if session_count:
        raise HTTPException(
            status_code=409,
            detail="This subject has attendance sessions and cannot be deleted",
        )
    record_audit(db, user, "subject", subject.id, "deleted", previous_value={"name": subject.name})
    db.delete(subject)
    db.commit()
    return {"message": "Subject deleted"}
