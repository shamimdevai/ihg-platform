"""DeliveryRider — a rider profile for a staff member holding the Rider role.

staff_id is loosely coupled to iam.staff_user.id (no hard FK, cross-domain rule
— mirrors hotel.models.housekeeping_task.HousekeepingTask.assigned_to_staff_id
and restaurant.models.waiter_assignment.WaiterAssignment.staff_id). A DB-level
UNIQUE constraint on staff_id enforces at most one rider profile per staff
account, even though the reference itself is not a real FK.
"""
import uuid
from typing import Optional

from sqlalchemy import Boolean, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base_model import Base, SoftDeleteMixin, TimestampMixin, UUIDPKMixin


class DeliveryRider(Base, UUIDPKMixin, TimestampMixin, SoftDeleteMixin):
    """A single rider's delivery-specific profile."""

    __tablename__ = "delivery_riders"

    # Loosely coupled to iam.staff_user.id — no FK, cross-domain rule.
    staff_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, unique=True, index=True
    )
    # "bike" | "motorcycle" | "car" | "on_foot" — free-form, matching the
    # codebase's established no-enum convention for status-like fields.
    vehicle_type: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    license_plate: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    # "available" | "busy" | "offline" — maintained mostly as a side effect of
    # rider_service.assign_rider_to_order() / delivery_tracking_service's
    # pickup-delivered transitions, not a dedicated self-service permission
    # this phase (see rider_service.py's module docstring).
    status: Mapped[str] = mapped_column(String(20), default="offline", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)