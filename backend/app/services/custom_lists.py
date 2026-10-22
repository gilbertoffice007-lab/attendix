"""Custom student list business logic."""

from __future__ import annotations

from collections import Counter
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.models import ClassRoom, CustomList, CustomListEntry, Student
from app.services.presenters import custom_list_out, entry_out


def load_list(db: Session, list_id: int) -> CustomList | None:
    return db.scalars(
        select(CustomList)
        .options(
            joinedload(CustomList.class_),
            joinedload(CustomList.creator),
            selectinload(CustomList.entries).joinedload(CustomListEntry.student),
            selectinload(CustomList.entries).joinedload(CustomListEntry.editor),
        )
        .where(CustomList.id == list_id)
        .execution_options(populate_existing=True)
    ).first()


def status_keys(item: CustomList) -> list[str]:
    return [option["key"] for option in item.status_options]


def status_labels(item: CustomList) -> dict[str, str]:
    return {option["key"]: option["label"] for option in item.status_options}


def list_summary(item: CustomList) -> dict[str, Any]:
    keys = status_keys(item)
    counts = Counter(entry.status for entry in item.entries)
    total = len(item.entries)
    return {
        "total": total,
        "counts": {key: int(counts.get(key, 0)) for key in keys},
        "percentages": {
            key: (round(counts.get(key, 0) / total * 100, 2) if total else 0.0)
            for key in keys
        },
    }


def list_detail(item: CustomList) -> dict[str, Any]:
    data = custom_list_out(item)
    data["entries"] = [
        entry_out(entry)
        for entry in sorted(item.entries, key=lambda entry: entry.student.roll_number.lower())
    ]
    return data


def student_list_out(item: CustomList, entry: CustomListEntry) -> dict[str, Any]:
    return {
        "id": item.id,
        "title": item.title,
        "description": item.description,
        "class_name": item.class_.name if item.class_ else "",
        "due_date": item.due_date,
        "status_options": item.status_options,
        "my_status": entry.status,
        "my_remarks": entry.remarks,
        "updated_at": entry.updated_at,
        "creator_name": item.creator.full_name if item.creator else "Unknown",
    }


def is_status_valid(item: CustomList, status: str) -> bool:
    return status in status_keys(item)


def label_for(item: CustomList, status: str) -> str:
    return status_labels(item).get(status, status)


def export_rows(
    item: CustomList,
    entries: list[CustomListEntry],
) -> list[dict[str, Any]]:
    labels = status_labels(item)
    return [
        {
            "roll_number": entry.student.roll_number,
            "student_name": entry.student.full_name,
            "status": labels.get(entry.status, entry.status),
            "remarks": entry.remarks or "",
            "last_updated": entry.updated_at,
            "updated_by": entry.editor.full_name if entry.editor else "",
            "list_title": item.title,
            "class_name": item.class_.name if item.class_ else "",
        }
        for entry in sorted(entries, key=lambda entry: entry.student.roll_number.lower())
    ]


def get_entry(
    db: Session, list_id: int, entry_id: int
) -> CustomListEntry | None:
    return db.scalars(
        select(CustomListEntry)
        .options(
            joinedload(CustomListEntry.student),
            joinedload(CustomListEntry.editor),
        )
        .where(
            CustomListEntry.id == entry_id,
            CustomListEntry.custom_list_id == list_id,
        )
    ).first()


def active_class_students(db: Session, class_id: int) -> list[Student]:
    return list(
        db.scalars(
            select(Student)
            .where(Student.class_id == class_id, Student.is_active.is_(True))
            .order_by(Student.roll_number)
        ).all()
    )


def list_counts_query(db: Session, list_id: int) -> int:
    return int(
        db.scalar(
            select(func.count(CustomListEntry.id)).where(
                CustomListEntry.custom_list_id == list_id
            )
        )
        or 0
    )
