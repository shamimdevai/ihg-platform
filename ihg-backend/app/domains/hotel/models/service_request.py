"""ServiceRequest — an in-room service request (food, cleaning, amenities,
maintenance) tied to an active booking/room.
"""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base_model import Base, SoftDeleteMixin, TimestampMixin, UUIDPKMixin


class ServiceRequest(Base, UUIDPKMixin, TimestampMixin, SoftDeleteMixin):
    """A single in-room service request. Status: pending -> in_progress ->
    completed, or -> cancelled.
    """

    __tablename__ = "service_requests"

    booking_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("bookings.id"), nullable=False, index=True
    )
    room_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("rooms.id"), nullable=False, index=True
    )
    # "food" | "cleaning" | "amenities" | "maintenance" — free-form
    request_type: Mapped[str] = mapped_column(String(30), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False)
    # Loosely coupled to iam.staff_user.id — no FK, matching Booking's precedent.
    assigned_to_staff_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)