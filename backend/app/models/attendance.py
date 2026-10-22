from __future__ import annotations

from datetime import date, datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, utcnow

if TYPE_CHECKING:
    from app.models.class_ import ClassRoom
    from app.models.student import Student
    from app.models.subject import Subject
    from app.models.user import User


class AttendanceSession(Base, TimestampMixin):
    __tablename__ = "attendance_sessions"
    __table_args__ = (
        UniqueConstraint(
            "class_id",
            "subject_id",
            "session_date",
            "session_number",
            name="uq_attendance_sessions_identity",
        ),
        CheckConstraint("session_number >= 1", name="session_number_positive"),
        Index("ix_attendance_sessions_date", "session_date"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    class_id: Mapped[int] = mapped_column(
        ForeignKey("classes.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    subject_id: Mapped[int] = mapped_column(
        ForeignKey("subjects.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    session_date: Mapped[date] = mapped_column(Date, nullable=False)
    session_number: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_by: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    is_finalized: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, index=True
    )
    finalized_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    finalized_by: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    subject: Mapped["Subject"] = relationship(back_populates="sessions")
    class_: Mapped["ClassRoom"] = relationship()
    creator: Mapped["User"] = relationship(foreign_keys=[created_by])
    finalizer: Mapped[Optional["User"]] = relationship(foreign_keys=[finalized_by])
    records: Mapped[list["AttendanceRecord"]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )


class AttendanceRecord(Base):
    __tablename__ = "attendance_records"
    __table_args__ = (
        UniqueConstraint("session_id", "student_id", name="uq_attendance_record"),
        CheckConstraint(
            "status IN ('present', 'absent', 'od', 'leave')", name="status_allowed"
        ),
        Index("ix_attendance_records_student", "student_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[int] = mapped_column(
        ForeignKey("attendance_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    student_id: Mapped[int] = mapped_column(
        ForeignKey("students.id", ondelete="RESTRICT"), nullable=False
    )
    status: Mapped[str] = mapped_column(String(10), nullable=False)
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

    session: Mapped["AttendanceSession"] = relationship(back_populates="records")
    student: Mapped["Student"] = relationship(back_populates="attendance_records")
    editor: Mapped[Optional["User"]] = relationship(foreign_keys=[updated_by])
