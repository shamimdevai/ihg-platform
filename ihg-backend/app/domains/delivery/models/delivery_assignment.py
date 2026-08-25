"""DeliveryAssignment — a single rider-to-order assignment. Only one
assignment may be `is_active=True` per order at a time (enforced in
rider_service), mirroring
restaurant.models.waiter_assignment.WaiterAssignment's one-active-per-target
precedent.
"""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base_model import Base, SoftDeleteMixin, TimestampMixin, UUIDPKMixin


class DeliveryAssignment(Base, UUIDPKMixin, TimestampMixin, SoftDeleteMixin):
    """A single rider-to-order delivery assignment."""

    __tablename__ = "delivery_assignments"

    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("delivery_orders.id"), nullable=False, index=True
    )
    rider_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("delivery_riders.id"), nullable=False, index=True
    )
    # "assigned" | "picked_up" | "delivered" | "cancelled"
    status: Mapped[str] = mapped_column(String(20), default="assigned", nullable=False)
    assigned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    picked_up_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    delivered_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    cancelled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    # Loosely coupled to iam.staff_user.id — no FK, matching Booking.booked_by_staff_id.
    assigned_by_staff_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)