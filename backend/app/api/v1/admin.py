from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.deps import require_admin
from app.db.session import get_db
from app.models import ClassRoom, FacultyClassAssignment, User
from app.schemas.user import FacultyAssignmentUpdate, FacultyWithAssignments, UserOut
from app.services.audit import record_audit

router = APIRouter(prefix="/admin", tags=["Administration"])


@router.get("/faculty", response_model=list[FacultyWithAssignments])
def faculty_with_assignments(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    faculty = db.scalars(
        select(User)
        .where(User.role == "faculty")
        .order_by(User.full_name)
    ).all()
    assignments = db.execute(
        select(FacultyClassAssignment, ClassRoom)
        .join(ClassRoom, ClassRoom.id == FacultyClassAssignment.class_id)
        .order_by(ClassRoom.name)
    ).all()
    mapping: dict[int, list[ClassRoom]] = {}
    for assignment, class_ in assignments:
        mapping.setdefault(assignment.faculty_id, []).append(class_)
    result = []
    for user in faculty:
        classes = mapping.get(user.id, [])
        result.append(
            FacultyWithAssignments(
                **UserOut.model_validate(user).model_dump(),
                class_ids=[class_.id for class_ in classes],
                class_labels=[
                    f"{class_.name} · {class_.department} · Sem {class_.semester}"
                    for class_ in classes
                ],
            )
        )
    return result


@router.put("/faculty/{faculty_id}/classes", response_model=FacultyWithAssignments)
def set_faculty_classes(
    faculty_id: int,
    payload: FacultyAssignmentUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    faculty = db.get(User, faculty_id)
    if not faculty:
        raise HTTPException(status_code=404, detail="Faculty member not found")
    if faculty.role != "faculty":
        raise HTTPException(status_code=400, detail="Assignments can only be given to faculty accounts")
    class_ids = list(dict.fromkeys(payload.class_ids))
    classes = db.scalars(select(ClassRoom).where(ClassRoom.id.in_(class_ids))).all() if class_ids else []
    if len(classes) != len(class_ids):
        raise HTTPException(status_code=400, detail="One or more classes do not exist")
    existing = db.scalars(
        select(FacultyClassAssignment).where(
            FacultyClassAssignment.faculty_id == faculty_id
        )
    ).all()
    for assignment in existing:
        db.delete(assignment)
    db.flush()
    for class_ in classes:
        db.add(FacultyClassAssignment(faculty_id=faculty_id, class_id=class_.id))
    record_audit(
        db,
        admin,
        "faculty_assignment",
        faculty_id,
        "updated",
        new_value={"class_ids": class_ids},
    )
    db.commit()
    return FacultyWithAssignments(
        **UserOut.model_validate(faculty).model_dump(),
        class_ids=[class_.id for class_ in classes],
        class_labels=[
            f"{class_.name} · {class_.department} · Sem {class_.semester}"
            for class_ in classes
        ],
    )
