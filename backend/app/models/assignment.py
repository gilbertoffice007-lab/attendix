from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, utcnow

if TYPE_CHECKING:
    from app.models.class_ import ClassRoom
    from app.models.user import User


class FacultyClassAssignment(Base):
    __tablename__ = "faculty_class_assignments"
    __table_args__ = (
        UniqueConstraint("faculty_id", "class_id", name="uq_faculty_class"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    faculty_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    class_id: Mapped[int] = mapped_column(
        ForeignKey("classes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )

    faculty: Mapped["User"] = relationship(foreign_keys=[faculty_id])
    class_: Mapped["ClassRoom"] = relationship(back_populates="assignments")
