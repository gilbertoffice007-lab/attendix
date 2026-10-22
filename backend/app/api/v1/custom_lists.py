from __future__ import annotations

from collections import Counter
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload, selectinload

from app.core.deps import (
    accessible_class_ids,
    ensure_class_access,
    ensure_class_write,
    get_current_user,
    require_authenticated,
    require_staff,
)
from app.db.session import get_db
from app.models import CustomList, CustomListEntry, Student, User
from app.schemas.common import Message
from app.schemas.custom_list import (
    AddEntriesRequest,
    ArchiveRequest,
    BulkStatusUpdate,
    CustomListCreate,
    CustomListDetail,
    CustomListOut,
    CustomListPage,
    CustomListUpdate,
    EntryOut,
    EntrySummary,
    EntryUpdate,
    StudentListOut,
    StudentListPage,
)
from app.services.audit import record_audit
from app.services.custom_lists import (
    active_class_students,
    export_rows,
    get_entry,
    is_status_valid,
    label_for,
    list_detail,
    list_summary,
    load_list,
    status_labels,
    student_list_out,
)
from app.services.exports import export_response

router = APIRouter(prefix="/custom-lists", tags=["Custom Student Lists"])


def _get_list(db: Session, list_id: int) -> CustomList:
    item = load_list(db, list_id)
    if not item:
        raise HTTPException(status_code=404, detail="Custom list not found")
    return item


def _staff_list_access(db: Session, user: User, item: CustomList) -> None:
    ensure_class_access(db, user, item.class_id)
    if item.is_archived:
        raise HTTPException(
            status_code=409,
            detail="This list is archived. Unarchive it before making changes.",
        )


def _ensure_student_entry(item: CustomList, student_id: int) -> CustomListEntry | None:
    return next((entry for entry in item.entries if entry.student_id == student_id), None)


@router.get("/me", response_model=StudentListPage)
def my_lists(
    search: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    user: User = Depends(require_authenticated),
):
    if user.role != "student" or not user.student_id:
        raise HTTPException(status_code=403, detail="This endpoint is for student accounts")
    student = db.get(Student, user.student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found")
    stmt = (
        select(CustomList)
        .join(CustomListEntry, CustomListEntry.custom_list_id == CustomList.id)
        .options(
            joinedload(CustomList.class_),
            joinedload(CustomList.creator),
            selectinload(CustomList.entries).joinedload(CustomListEntry.student),
            selectinload(CustomList.entries).joinedload(CustomListEntry.editor),
        )
        .where(
            CustomListEntry.student_id == student.id,
            CustomList.visible_to_students.is_(True),
            CustomList.is_archived.is_(False),
        )
    )
    count_stmt = (
        select(func.count(CustomList.id))
        .join(CustomListEntry, CustomListEntry.custom_list_id == CustomList.id)
        .where(
            CustomListEntry.student_id == student.id,
            CustomList.visible_to_students.is_(True),
            CustomList.is_archived.is_(False),
        )
    )
    if search:
        pattern = f"%{search.strip()}%"
        stmt = stmt.where(CustomList.title.ilike(pattern))
        count_stmt = count_stmt.where(CustomList.title.ilike(pattern))
    total = int(db.scalar(count_stmt) or 0)
    items = db.scalars(
        stmt.order_by(CustomList.updated_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    payload = []
    for item in items:
        entry = _ensure_student_entry(item, student.id)
        if entry:
            payload.append(StudentListOut(**student_list_out(item, entry)))
    return StudentListPage(items=payload, total=total, page=page, page_size=page_size)


@router.post("", response_model=CustomListDetail, status_code=201)
def create_list(
    payload: CustomListCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_staff),
):
    ensure_class_write(db, user, payload.class_id)
    options = [option.model_dump() for option in payload.status_options]
    item = CustomList(
        title=payload.title.strip(),
        description=(payload.description or "").strip() or None,
        class_id=payload.class_id,
        created_by=user.id,
        status_options=options,
        due_date=payload.due_date,
        visible_to_students=payload.visible_to_students,
    )
    db.add(item)
    db.flush()
    if payload.student_ids:
        students = db.scalars(
            select(Student).where(
                Student.id.in_(payload.student_ids),
                Student.class_id == payload.class_id,
                Student.is_active.is_(True),
            )
        ).all()
        found = {student.id for student in students}
        missing = [sid for sid in payload.student_ids if sid not in found]
        if missing:
            raise HTTPException(
                status_code=400,
                detail="One or more selected students are not active members of this class",
            )
        initial_status = options[0]["key"]
        for student in students:
            db.add(
                CustomListEntry(
                    custom_list_id=item.id,
                    student_id=student.id,
                    status=initial_status,
                    updated_by=user.id,
                )
            )
    record_audit(
        db,
        user,
        "custom_list",
        item.id,
        "created",
        new_value={
            "title": item.title,
            "class_id": item.class_id,
            "status_options": [option["key"] for option in options],
            "selected_students": len(payload.student_ids),
        },
    )
    db.commit()
    item = _get_list(db, item.id)
    return CustomListDetail(**list_detail(item))


@router.get("", response_model=CustomListPage)
def list_custom_lists(
    search: Optional[str] = Query(default=None),
    class_id: Optional[int] = Query(default=None),
    archived: bool = Query(default=False),
    date_from: Optional[date] = Query(default=None),
    date_to: Optional[date] = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    user: User = Depends(require_staff),
):
    allowed = accessible_class_ids(db, user)
    if class_id is not None:
        ensure_class_access(db, user, class_id)
    if date_from and date_to and date_from > date_to:
        raise HTTPException(status_code=400, detail="Start date cannot be after end date")
    filters = [CustomList.is_archived.is_(archived)]
    if allowed is not None:
        filters.append(CustomList.class_id.in_(allowed or {-1}))
    if class_id is not None:
        filters.append(CustomList.class_id == class_id)
    if search:
        pattern = f"%{search.strip()}%"
        filters.append(
            or_(CustomList.title.ilike(pattern), CustomList.description.ilike(pattern))
        )
    if date_from:
        filters.append(func.date(CustomList.created_at) >= date_from)
    if date_to:
        filters.append(func.date(CustomList.created_at) <= date_to)
    stmt = (
        select(CustomList)
        .options(
            joinedload(CustomList.class_),
            joinedload(CustomList.creator),
            selectinload(CustomList.entries),
        )
        .order_by(CustomList.updated_at.desc())
    )
    count_stmt = select(func.count(CustomList.id))
    for condition in filters:
        stmt = stmt.where(condition)
        count_stmt = count_stmt.where(condition)
    total = int(db.scalar(count_stmt) or 0)
    items = db.scalars(
        stmt.offset((page - 1) * page_size).limit(page_size)
    ).all()
    return CustomListPage(
        items=[
            CustomListOut(
                **{
                    **{
                        "id": item.id,
                        "title": item.title,
                        "description": item.description,
                        "class_id": item.class_id,
                        "class_name": f"{item.class_.name} · {item.class_.department} · Sem {item.class_.semester}",
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
                }
            )
            for item in items
        ],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{list_id}", response_model=CustomListDetail)
def get_custom_list(
    list_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_authenticated),
):
    item = _get_list(db, list_id)
    if user.role == "student":
        if not user.student_id:
            raise HTTPException(status_code=403, detail="Student profile is not linked")
        entry = _ensure_student_entry(item, user.student_id)
        if not item.visible_to_students or not entry:
            raise HTTPException(status_code=403, detail="You cannot view this list")
        data = list_detail(item)
        data["entries"] = [
            entry_out
            for entry_out in [next(row for row in data["entries"] if row["student_id"] == user.student_id)]
        ]
        return CustomListDetail(**data)
    ensure_class_access(db, user, item.class_id)
    return CustomListDetail(**list_detail(item))


@router.patch("/{list_id}", response_model=CustomListDetail)
def update_custom_list(
    list_id: int,
    payload: CustomListUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_staff),
):
    item = _get_list(db, list_id)
    ensure_class_write(db, user, item.class_id)
    updates = payload.model_fields_set
    previous = {
        "title": item.title,
        "description": item.description,
        "status_options": item.status_options,
        "due_date": item.due_date.isoformat() if item.due_date else None,
        "visible_to_students": item.visible_to_students,
    }
    if "title" in updates and payload.title is not None:
        item.title = payload.title.strip()
    if "description" in updates:
        item.description = (payload.description or "").strip() or None
    if "due_date" in updates:
        item.due_date = payload.due_date
    if "visible_to_students" in updates and payload.visible_to_students is not None:
        item.visible_to_students = payload.visible_to_students
    if "status_options" in updates and payload.status_options is not None:
        new_options = [option.model_dump() for option in payload.status_options]
        valid_keys = {option["key"] for option in new_options}
        invalid = [
            entry.student.full_name
            for entry in item.entries
            if entry.status not in valid_keys
        ]
        if invalid:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Status options cannot be removed while entries still use them. "
                    f"Affected students: {', '.join(invalid[:5])}"
                ),
            )
        item.status_options = new_options
    record_audit(
        db,
        user,
        "custom_list",
        item.id,
        "updated",
        previous_value=previous,
        new_value={
            "title": item.title,
            "description": item.description,
            "status_options": item.status_options,
            "due_date": item.due_date.isoformat() if item.due_date else None,
            "visible_to_students": item.visible_to_students,
        },
    )
    db.commit()
    item = _get_list(db, item.id)
    return CustomListDetail(**list_detail(item))


@router.post("/{list_id}/entries")
def add_entries(
    list_id: int,
    payload: AddEntriesRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_staff),
):
    item = _get_list(db, list_id)
    _staff_list_access(db, user, item)
    unique_ids = list(dict.fromkeys(payload.student_ids))
    students = db.scalars(
        select(Student).where(
            Student.id.in_(unique_ids),
            Student.class_id == item.class_id,
            Student.is_active.is_(True),
        )
    ).all()
    found = {student.id for student in students}
    missing = [sid for sid in unique_ids if sid not in found]
    if missing:
        raise HTTPException(
            status_code=400,
            detail="Some selected students are not active in this class",
        )
    existing_ids = {entry.student_id for entry in item.entries}
    to_add = [student for student in students if student.id not in existing_ids]
    initial_status = item.status_options[0]["key"]
    for student in to_add:
        db.add(
            CustomListEntry(
                custom_list_id=item.id,
                student_id=student.id,
                status=initial_status,
                updated_by=user.id,
            )
        )
    added = len(to_add)
    skipped = len(unique_ids) - added
    record_audit(
        db,
        user,
        "custom_list",
        item.id,
        "entries_added",
        new_value={"added": added, "skipped": skipped},
    )
    db.commit()
    item = _get_list(db, item.id)
    return {"added": added, "skipped": skipped, "list": list_detail(item)}


@router.patch("/{list_id}/entries/bulk", response_model=EntrySummary)
def bulk_update_entries(
    list_id: int,
    payload: BulkStatusUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_staff),
):
    item = _get_list(db, list_id)
    _staff_list_access(db, user, item)
    if not is_status_valid(item, payload.status):
        raise HTTPException(status_code=400, detail="Invalid status for this list")
    if payload.apply_to_all:
        targets = list(item.entries)
    else:
        target_ids = set(payload.entry_ids)
        targets = [entry for entry in item.entries if entry.id in target_ids]
        if len(targets) != len(target_ids):
            raise HTTPException(
                status_code=400, detail="One or more selected entries do not belong to this list"
            )
    if not targets:
        raise HTTPException(status_code=400, detail="No entries selected")
    previous_counts = Counter(entry.status for entry in targets)
    for entry in targets:
        entry.status = payload.status
        if "remarks" in payload.model_fields_set:
            entry.remarks = payload.remarks
        entry.updated_by = user.id
    record_audit(
        db,
        user,
        "custom_list",
        item.id,
        "bulk_status_updated",
        previous_value={"counts": dict(previous_counts)},
        new_value={"status": payload.status, "entries": len(targets)},
    )
    db.commit()
    item = _get_list(db, item.id)
    return EntrySummary(**list_summary(item))


@router.patch("/{list_id}/entries/{entry_id}", response_model=EntryOut)
def update_entry(
    list_id: int,
    entry_id: int,
    payload: EntryUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_staff),
):
    item = _get_list(db, list_id)
    _staff_list_access(db, user, item)
    entry = get_entry(db, list_id, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="List entry not found")
    if not is_status_valid(item, payload.status):
        raise HTTPException(status_code=400, detail="Invalid status for this list")
    previous = {"status": entry.status, "remarks": entry.remarks}
    entry.status = payload.status
    entry.remarks = payload.remarks
    entry.updated_by = user.id
    record_audit(
        db,
        user,
        "custom_list_entry",
        entry.id,
        "updated",
        previous_value=previous,
        new_value={"status": entry.status, "remarks": entry.remarks},
    )
    db.commit()
    entry = get_entry(db, list_id, entry_id)
    assert entry is not None
    return EntryOut(
        id=entry.id,
        student_id=entry.student_id,
        roll_number=entry.student.roll_number,
        student_name=entry.student.full_name,
        student_active=entry.student.is_active,
        status=entry.status,
        remarks=entry.remarks,
        updated_at=entry.updated_at,
        updated_by_name=entry.editor.full_name if entry.editor else None,
    )


@router.get("/{list_id}/summary", response_model=EntrySummary)
def custom_list_summary(
    list_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_staff),
):
    item = _get_list(db, list_id)
    ensure_class_access(db, user, item.class_id)
    return EntrySummary(**list_summary(item))


@router.patch("/{list_id}/archive", response_model=CustomListDetail)
def archive_list(
    list_id: int,
    payload: ArchiveRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_staff),
):
    item = _get_list(db, list_id)
    ensure_class_write(db, user, item.class_id)
    item.is_archived = payload.is_archived
    record_audit(
        db,
        user,
        "custom_list",
        item.id,
        "archived" if payload.is_archived else "unarchived",
    )
    db.commit()
    item = _get_list(db, item.id)
    return CustomListDetail(**list_detail(item))


@router.get("/{list_id}/export")
def export_custom_list(
    list_id: int,
    format: str = Query(default="csv"),
    status: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(require_staff),
):
    if format.lower() not in ("csv", "xlsx"):
        raise HTTPException(status_code=400, detail="Format must be csv or xlsx")
    item = _get_list(db, list_id)
    ensure_class_access(db, user, item.class_id)
    if status and not is_status_valid(item, status):
        raise HTTPException(status_code=400, detail="Invalid status filter")
    entries = list(item.entries)
    if status:
        entries = [entry for entry in entries if entry.status == status]
    if search:
        pattern = search.strip().lower()
        entries = [
            entry
            for entry in entries
            if pattern in entry.student.full_name.lower()
            or pattern in entry.student.roll_number.lower()
        ]
    rows = export_rows(item, entries)
    summary_data = list_summary(item)
    labels = status_labels(item)
    summary = [
        f"List: {item.title}",
        f"Class: {item.class_.name} · {item.class_.department} · Semester {item.class_.semester}",
        f"Creator: {item.creator.full_name if item.creator else 'Unknown'}",
        f"Export date: {date.today().isoformat()}",
        f"Rows exported: {len(rows)}",
    ]
    if summary_data["total"]:
        summary.append(
            " · ".join(
                f"{labels.get(key, key)}: {count}"
                for key, count in summary_data["counts"].items()
            )
        )
        summary.append(
            " · ".join(
                f"{labels.get(key, key)}: {value}%"
                for key, value in summary_data["percentages"].items()
            )
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
            ("List", "list_title"),
            ("Class", "class_name"),
        ],
        f"{item.title}_{item.class_.name}",
        format,
        title=item.title,
        summary=summary,
    )
