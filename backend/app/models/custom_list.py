from __future__ import annotations

from datetime import date, datetime
from typing import TYPE_CHECKING, Any, Optional

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, utcnow

if TYPE_CHECKING:
    from app.models.class_ import ClassRoom
    from app.models.student import Student
    from app.models.user import User


class CustomList(Base, TimestampMixin):
    __tablename__ = "custom_lists"
    __table_args__ = (
        CheckConstraint("jsonb_array_length(status_options) >= 2", name="min_status_options"),
        Index("ix_custom_lists_title_lower", "title"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(180), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    class_id: Mapped[int] = mapped_column(
        ForeignKey("classes.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    created_by: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    status_options: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, nullable=False)
    due_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    is_archived: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, index=True
    )
    visible_to_students: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )

    class_: Mapped["ClassRoom"] = relationship()
    creator: Mapped["User"] = relationship(foreign_keys=[created_by])
    entries: Mapped[list["CustomListEntry"]] = relationship(
        back_populates="custom_list", cascade="all, delete-orphan"
    )


class CustomListEntry(Base):
    __tablename__ = "custom_list_entries"
    __table_args__ = (
        UniqueConstraint("custom_list_id", "student_id", name="uq_custom_list_entry"),
        Index("ix_custom_list_entries_status", "custom_list_id", "status"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    custom_list_id: Mapped[int] = mapped_column(
        ForeignKey("custom_lists.id", ondelete="CASCADE"), nullable=False, index=True
    )
    student_id: Mapped[int] = mapped_column(
        ForeignKey("students.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(String(40), nullable=False)
    remarks: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    updated_by: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )

    custom_list: Mapped["CustomList"] = relationship(back_populates="entries")
    student: Mapped["Student"] = relationship(back_populates="custom_list_entries")
    editor: Mapped[Optional["User"]] = relationship(foreign_keys=[updated_by])
