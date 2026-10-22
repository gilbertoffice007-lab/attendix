from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, utcnow


class AppSetting(Base):
    __tablename__ = "app_settings"
    __table_args__ = (
        CheckConstraint("id = 1", name="singleton"),
        CheckConstraint(
            "attendance_threshold BETWEEN 0 AND 100", name="threshold_range"
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    attendance_threshold: Mapped[int] = mapped_column(
        Integer, nullable=False, default=75
    )
    od_counts_as_attended: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True
    )
    leave_counts_as_attended: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    updated_by: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )
