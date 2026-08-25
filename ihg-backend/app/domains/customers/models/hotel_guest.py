"""HotelGuest — a hotel stay identity. Can exist with NO account or password
(PROJECT_STATE.md Part A) — created by reception staff at check-in, not self-registered.
Optionally linked to a Customer account later if the guest also wants restaurant/
delivery self-service (e.g. ordering room service through the app).
"""
import uuid
from typing import Optional

from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base_model import Base, SoftDeleteMixin, TimestampMixin, UUIDPKMixin


class HotelGuest(Base, UUIDPKMixin, TimestampMixin, SoftDeleteMixin):
    """A hotel guest identity, staff-created, login-optional."""

    __tablename__ = "hotel_guests"

    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    identification_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    nationality: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    is_vip: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Optional login link to a Customer account. Same-domain FK (customers domain owns
    # both tables) so a real constraint is safe here — unlike cross-domain references.
    customer_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("customers.id"), nullable=True
    )

    # Intentionally NO ForeignKey to iam.staff_users — cross-domain FK avoided, same
    # loose-coupling pattern as settings.system_setting.updated_by_staff_id.
    created_by_staff_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)