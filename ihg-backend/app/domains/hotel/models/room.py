"""Room — a physical, bookable room belonging to a hotel and room type."""
import uuid
from typing import Optional

from sqlalchemy import Boolean, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base_model import Base, SoftDeleteMixin, TimestampMixin, UUIDPKMixin


class Room(Base, UUIDPKMixin, TimestampMixin, SoftDeleteMixin):
    """A single physical room. Status is free-form (no enum) so new operational
    states can be introduced without a migration — mirrors Payment.status.
    """

    __tablename__ = "rooms"
    __table_args__ = (UniqueConstraint("hotel_id", "room_number", name="uq_room_hotel_number"),)

    hotel_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hotels.id"), nullable=False, index=True
    )
    room_type_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("room_types.id"), nullable=False, index=True
    )
    room_number: Mapped[str] = mapped_column(String(20), nullable=False)
    floor: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    # "available" | "occupied" | "cleaning" | "maintenance"
    status: Mapped[str] = mapped_column(String(20), default="available", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)