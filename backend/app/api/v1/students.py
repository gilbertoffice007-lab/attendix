from __future__ import annotations

import csv
import io
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.core.deps import (
    accessible_class_ids,
    ensure_class_access,
    ensure_class_write,
    get_current_user,
    require_admin,
    require_staff,
)
from app.core.security import hash_password
from app.db.session import get_db
from app.models import AttendanceRecord, CustomListEntry, Student, User
from app.schemas.student import (
    StudentCreate,
    StudentImportResult,
    StudentOut,
    StudentPage,
    StudentUpdate,
)
from app.schemas.user import StudentAccountCreate, UserOut
from app.services.audit import record_audit
from app.services.presenters import student_out

router = APIRouter(prefix="/students", tags=["Students"])


def _student_query():
    return select(Student).options(
        joinedload(Student.class_), joinedload(Student.user_account)
    )


@router.get("", response_model=StudentPage)
def list_students(
    class_id: Optional[int] = Query(default=None),
    search: Optional[str] = Query(default=None),
    is_active: Optional[bool] = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=200),
    db: Session = Depends(get_db),
    user: User = Depends(require_staff),
):
    allowed = accessible_class_ids(db, user)
    if class_id is not None:
        ensure_class_access(db, user, class_id)
    stmt = _student_query()
    count_stmt = select(func.count(Student.id))
    filters = []
    if allowed is not None:
        filters.append(Student.class_id.in_(allowed or {-1}))
    if class_id is not None:
        filters.append(Student.class_id == class_id)
    if is_active is not None:
        filters.append(Student.is_active.is_(is_active))
    if search:
        pattern = f"%{search.strip()}%"
        filters.append(
            or_(Student.full_name.ilike(pattern), Student.roll_number.ilike(pattern))
        )
    for condition in filters:
        stmt = stmt.where(condition)
        count_stmt = count_stmt.where(condition)
    total = int(db.scalar(count_stmt) or 0)
    students = db.scalars(
        stmt.order_by(Student.class_id, Student.roll_number)
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return StudentPage(
        items=[StudentOut(**student_out(student)) for student in students],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/me", response_model=StudentOut)
def my_student_profile(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if user.role != "student" or not user.student_id:
        raise HTTPException(status_code=403, detail="This endpoint is for student accounts")
    student = db.scalars(_student_query().where(Student.id == user.student_id)).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found")
    return StudentOut(**student_out(student))


@router.post("", response_model=StudentOut, status_code=201)
def create_student(
    payload: StudentCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_staff),
):
    ensure_class_write(db, user, payload.class_id)
    roll_number = payload.roll_number.strip()
    duplicate = db.scalar(
        select(Student).where(
            Student.class_id == payload.class_id,
            func.lower(Student.roll_number) == roll_number.lower(),
        )
    )
    if duplicate:
        raise HTTPException(
            status_code=409,
            detail="A student with this roll number already exists in the class",
        )
    student = Student(
        roll_number=roll_number,
        full_name=payload.full_name.strip(),
        class_id=payload.class_id,
        is_active=payload.is_active,
    )
    db.add(student)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Duplicate roll number in this class")
    record_audit(
        db,
        user,
        "student",
        student.id,
        "created",
        new_value={"roll_number": roll_number, "full_name": student.full_name, "class_id": payload.class_id},
    )
    db.commit()
    student = db.scalars(_student_query().where(Student.id == student.id)).first()
    assert student is not None
    return StudentOut(**student_out(student))


@router.patch("/{student_id}", response_model=StudentOut)
def update_student(
    student_id: int,
    payload: StudentUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_staff),
):
    student = db.get(Student, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    ensure_class_write(db, user, student.class_id)
    updates = payload.model_dump(exclude_unset=True)
    previous = {
        "roll_number": student.roll_number,
        "full_name": student.full_name,
        "class_id": student.class_id,
        "is_active": student.is_active,
    }
    if updates.get("class_id") is not None and updates["class_id"] != student.class_id:
        ensure_class_write(db, user, updates["class_id"])
        record_count = int(
            db.scalar(
                select(func.count(AttendanceRecord.id)).where(
                    AttendanceRecord.student_id == student.id
                )
            )
            or 0
        )
        list_count = int(
            db.scalar(
                select(func.count(CustomListEntry.id)).where(
                    CustomListEntry.student_id == student.id
                )
            )
            or 0
        )
        if record_count or list_count:
            raise HTTPException(
                status_code=400,
                detail="Students with attendance or list history cannot be moved between classes. Deactivate the record and create a new student instead.",
            )
        student.class_id = updates["class_id"]
    if updates.get("roll_number") is not None:
        roll_number = updates["roll_number"].strip()
        duplicate = db.scalar(
            select(Student).where(
                Student.class_id == student.class_id,
                func.lower(Student.roll_number) == roll_number.lower(),
                Student.id != student.id,
            )
        )
        if duplicate:
            raise HTTPException(status_code=409, detail="Duplicate roll number in this class")
        student.roll_number = roll_number
    if updates.get("full_name") is not None:
        student.full_name = updates["full_name"].strip()
    if "is_active" in updates and updates["is_active"] is not None:
        student.is_active = updates["is_active"]
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Duplicate roll number in this class")
    record_audit(
        db,
        user,
        "student",
        student.id,
        "updated",
        previous_value=previous,
        new_value={
            "roll_number": student.roll_number,
            "full_name": student.full_name,
            "class_id": student.class_id,
            "is_active": student.is_active,
        },
    )
    db.commit()
    student = db.scalars(_student_query().where(Student.id == student.id)).first()
    assert student is not None
    return StudentOut(**student_out(student))


@router.post("/{student_id}/account", response_model=UserOut, status_code=201)
def create_student_account(
    student_id: int,
    payload: StudentAccountCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    student = db.get(Student, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    if not student.is_active:
        raise HTTPException(status_code=400, detail="Cannot create a login for an inactive student")
    existing = db.scalar(select(User).where(User.student_id == student_id))
    if existing:
        raise HTTPException(status_code=409, detail="This student already has a login account")
    email = payload.email.lower().strip()
    if db.scalar(select(User).where(func.lower(User.email) == email)):
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    account = User(
        full_name=(payload.full_name or student.full_name).strip(),
        email=email,
        password_hash=hash_password(payload.password),
        role="student",
        is_active=True,
        student_id=student.id,
    )
    db.add(account)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="A conflicting account already exists")
    record_audit(
        db,
        admin,
        "user",
        account.id,
        "student_account_created",
        new_value={"student_id": student.id, "email": email},
    )
    db.commit()
    db.refresh(account)
    return UserOut.model_validate(account)


@router.post("/import", response_model=StudentImportResult)
async def import_students(
    class_id: int = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_staff),
):
    ensure_class_write(db, user, class_id)
    raw = await file.read()
    if len(raw) > 1_000_000:
        raise HTTPException(status_code=400, detail="CSV file is too large (maximum 1 MB)")
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="CSV must be UTF-8 encoded")
    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        raise HTTPException(status_code=400, detail="CSV file is empty")
    field_map = {name.strip().lower(): name for name in reader.fieldnames if name}
    if "roll_number" not in field_map or "full_name" not in field_map:
        raise HTTPException(
            status_code=400,
            detail="CSV must contain roll_number and full_name columns",
        )
    created = 0
    skipped = 0
    errors: list[dict] = []
    seen: set[str] = set()
    row_number = 1
    for row in reader:
        row_number += 1
        if row_number > 2001:
            errors.append({"row": row_number, "message": "Import limit of 2000 rows reached"})
            break
        roll = (row.get(field_map["roll_number"]) or "").strip()
        name = (row.get(field_map["full_name"]) or "").strip()
        if not roll or not name:
            errors.append({"row": row_number, "message": "roll_number and full_name are required"})
            continue
        if roll.lower() in seen:
            errors.append({"row": row_number, "message": f"Duplicate roll number in file: {roll}"})
            skipped += 1
            continue
        seen.add(roll.lower())
        exists = db.scalar(
            select(Student).where(
                Student.class_id == class_id,
                func.lower(Student.roll_number) == roll.lower(),
            )
        )
        if exists:
            skipped += 1
            continue
        db.add(Student(roll_number=roll, full_name=name, class_id=class_id, is_active=True))
        created += 1
    if created:
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            raise HTTPException(status_code=409, detail="Import failed due to a duplicate roll number")
        record_audit(
            db,
            user,
            "class",
            class_id,
            "students_imported",
            new_value={"created": created, "skipped": skipped},
        )
        db.commit()
    return StudentImportResult(created=created, skipped=skipped, errors=errors)
