"""KitchenTicket — the kitchen-facing view of a dine-in order: one ticket per
order, created automatically when the order is placed.
"""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base_model import Base, SoftDeleteMixin, TimestampMixin, UUIDPKMixin


class KitchenTicket(Base, UUIDPKMixin, TimestampMixin, SoftDeleteMixin):
    """A single kitchen ticket, 1:1 with its DineInOrder. Status machine:
    pending -> preparing -> ready -> served, or -> cancelled. Kept in sync with
    (but structurally separate from) DineInOrder.status by kitchen_service, so
    the kitchen's own view of "what's next" never depends on the table/
    reservation tables the Kitchen role has no permission to read.
    """

    __tablename__ = "kitchen_tickets"

    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("dine_in_orders.id"), nullable=False, unique=True, index=True
    )
    # "pending" | "preparing" | "ready" | "served" | "cancelled"
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    ready_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    served_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)