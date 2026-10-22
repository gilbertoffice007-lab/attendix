from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.assignment import FacultyClassAssignment
    from app.models.student import Student
    from app.models.subject import Subject


class ClassRoom(Base, TimestampMixin):
    __tablename__ = "classes"
    __table_args__ = (
        UniqueConstraint(
            "name", "department", "semester", "academic_year", name="uq_classes_identity"
        ),
        CheckConstraint("semester BETWEEN 1 AND 12", name="semester_range"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    department: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    semester: Mapped[int] = mapped_column(Integer, nullable=False)
    academic_year: Mapped[str] = mapped_column(String(20), nullable=False)

    students: Mapped[list["Student"]] = relationship(back_populates="class_")
    subjects: Mapped[list["Subject"]] = relationship(back_populates="class_")
    assignments: Mapped[list["FacultyClassAssignment"]] = relationship(
        back_populates="class_", cascade="all, delete-orphan"
    )

    @property
    def display_name(self) -> str:
        return f"{self.name} · {self.department} · Sem {self.semester}"
