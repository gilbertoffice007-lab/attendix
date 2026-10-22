from __future__ import annotations

from typing import TYPE_CHECKING, Optional

from sqlalchemy import Boolean, CheckConstraint, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.audit import AuditLog
    from app.models.student import Student


class User(Base, TimestampMixin):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("role IN ('admin', 'faculty', 'student')", name="role_allowed"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    full_name: Mapped[str] = mapped_column(String(160), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="faculty", index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    student_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("students.id", ondelete="SET NULL"), unique=True, nullable=True
    )

    student: Mapped[Optional["Student"]] = relationship(
        back_populates="user_account", foreign_keys=[student_id]
    )
    audit_logs: Mapped[list["AuditLog"]] = relationship(back_populates="actor")
