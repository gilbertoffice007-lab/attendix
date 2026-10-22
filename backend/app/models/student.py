from __future__ import annotations

from typing import TYPE_CHECKING, Optional

from sqlalchemy import Boolean, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.attendance import AttendanceRecord
    from app.models.class_ import ClassRoom
    from app.models.custom_list import CustomListEntry
    from app.models.user import User


class Student(Base, TimestampMixin):
    __tablename__ = "students"
    __table_args__ = (
        UniqueConstraint("class_id", "roll_number", name="uq_students_class_roll"),
        Index("ix_students_name_lower", "full_name"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    roll_number: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    full_name: Mapped[str] = mapped_column(String(160), nullable=False)
    class_id: Mapped[int] = mapped_column(
        ForeignKey("classes.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, index=True)

    class_: Mapped["ClassRoom"] = relationship(back_populates="students")
    user_account: Mapped[Optional["User"]] = relationship(
        back_populates="student", foreign_keys="User.student_id", uselist=False
    )
    attendance_records: Mapped[list["AttendanceRecord"]] = relationship(
        back_populates="student"
    )
    custom_list_entries: Mapped[list["CustomListEntry"]] = relationship(
        back_populates="student"
    )
