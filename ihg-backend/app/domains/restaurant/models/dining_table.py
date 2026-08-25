"""DiningTable — a physical, seatable table belonging to a restaurant."""
import uuid

from sqlalchemy import Boolean, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base_model import Base, SoftDeleteMixin, TimestampMixin, UUIDPKMixin


class DiningTable(Base, UUIDPKMixin, TimestampMixin, SoftDeleteMixin):
    """A single physical dining table. Status is free-form (no enum), mirroring
    hotel.models.room.Room.status.
    """

    __tablename__ = "dining_tables"
    __table_args__ = (UniqueConstraint("restaurant_id", "table_number", name="uq_table_restaurant_number"),)

    restaurant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("restaurants.id"), nullable=False, index=True
    )
    table_number: Mapped[str] = mapped_column(String(20), nullable=False)
    capacity: Mapped[int] = mapped_column(Integer, nullable=False, default=2)
    # "available" | "reserved" | "occupied" | "cleaning"
    status: Mapped[str] = mapped_column(String(20), default="available", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)