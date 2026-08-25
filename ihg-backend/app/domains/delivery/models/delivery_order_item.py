"""DeliveryOrderItem — a single line item on a delivery order. `item_name`/
`unit_price` are snapshots of the restaurant's menu item at order time
(mirrors restaurant.models.dine_in_order_item.DineInOrderItem's snapshot
precedent) — never re-read from the menu item after creation, so a later
menu price change doesn't retroactively alter past orders.
"""
import uuid
from typing import Optional

from sqlalchemy import ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base_model import Base, SoftDeleteMixin, TimestampMixin, UUIDPKMixin


class DeliveryOrderItem(Base, UUIDPKMixin, TimestampMixin, SoftDeleteMixin):
    """A single delivery order line item."""

    __tablename__ = "delivery_order_items"

    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("delivery_orders.id"), nullable=False, index=True
    )
    # Loosely coupled to restaurant.menu_items.id — no FK, cross-domain rule.
    menu_item_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    item_name: Mapped[str] = mapped_column(String(150), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    unit_price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    line_total: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    special_instructions: Mapped[Optional[str]] = mapped_column(Text, nullable=True)