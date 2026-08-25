"""WaiterAssignment — tracks which staff member (waiter) is currently
responsible for a dining table, for a given shift/period.
"""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base_model import Base, SoftDeleteMixin, TimestampMixin, UUIDPKMixin


class WaiterAssignment(Base, UUIDPKMixin, TimestampMixin, SoftDeleteMixin):
    """A single waiter-to-table assignment. Only one assignment may be
    `is_active=True` per table at a time (enforced in waiter_service).
    """

    __tablename__ = "waiter_assignments"

    table_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("dining_tables.id"), nullable=False, index=True
    )
    # Loosely coupled to iam.staff_user.id — no FK, matching Booking.booked_by_staff_id.
    staff_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    assigned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    unassigned_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)