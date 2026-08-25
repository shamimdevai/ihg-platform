"""HousekeepingTask — a cleaning/maintenance/inspection task against a room,
optionally tied to the booking whose checkout triggered it.
"""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base_model import Base, SoftDeleteMixin, TimestampMixin, UUIDPKMixin


class HousekeepingTask(Base, UUIDPKMixin, TimestampMixin, SoftDeleteMixin):
    """A single housekeeping task. Status: pending -> in_progress -> completed, or
    -> cancelled.
    """

    __tablename__ = "housekeeping_tasks"

    room_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("rooms.id"), nullable=False, index=True
    )
    booking_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("bookings.id"), nullable=True, index=True
    )
    # "cleaning" | "maintenance" | "inspection" — free-form
    task_type: Mapped[str] = mapped_column(String(30), nullable=False, default="cleaning")
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # Loosely coupled to iam.staff_user.id — no FK, matching Booking.booked_by_staff_id.
    assigned_to_staff_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)