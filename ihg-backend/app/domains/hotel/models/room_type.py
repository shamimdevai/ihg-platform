"""RoomType — a category of room within a hotel (e.g. "Deluxe King"), carrying the
base nightly rate used to snapshot Booking.rate_per_night at booking time.
"""
import uuid
from typing import Optional

from sqlalchemy import ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base_model import Base, SoftDeleteMixin, TimestampMixin, UUIDPKMixin


class RoomType(Base, UUIDPKMixin, TimestampMixin, SoftDeleteMixin):
    """A category of room within a single hotel."""

    __tablename__ = "room_types"

    hotel_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hotels.id"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    base_rate: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    capacity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    # Free-form/CSV text — no dedicated amenities table yet, not required by scope.
    amenities: Mapped[Optional[str]] = mapped_column(Text, nullable=True)