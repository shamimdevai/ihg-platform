"""MenuItem — a single sellable dish/drink within a menu category.

inventory_item_id is loosely coupled to inventory.inventory_items.id (no hard
FK — inventory is a peer domain, per the platform's reference_type/reference_id
convention; see hotel.models.invoice.Invoice's payment_id docstring for the
precedent). When set, placing an order for this item consumes
`inventory_qty_per_unit` units of that inventory item per quantity ordered, via
inventory.services.inventory_service.adjust_stock() — see
dine_in_order_service.py. Left NULL for items with no stock tracking (e.g. a
made-to-order dish with no single trackable ingredient in this phase's scope).
"""
import uuid
from typing import Optional

from datetime import datetime
from sqlalchemy import Boolean, DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base_model import Base, SoftDeleteMixin, TimestampMixin, UUIDPKMixin


class MenuItem(Base, UUIDPKMixin, TimestampMixin, SoftDeleteMixin):
    """A single menu item."""

    __tablename__ = "menu_items"

    restaurant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("restaurants.id"), nullable=False, index=True
    )
    category_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("menu_categories.id"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    image_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    is_available: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Loosely coupled to inventory.inventory_items.id — no FK, cross-domain rule.
    inventory_item_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    inventory_qty_per_unit: Mapped[Optional[float]] = mapped_column(Numeric(10, 3), nullable=True)

    # Discount fields. discount_type/discount_value must be set TOGETHER
    # (enforced in menu_service._validate_discount_fields, not at the DB
    # level) — "percentage" (0-100) or "fixed_amount" (a currency amount
    # less than price). discount_starts_at/discount_ends_at are optional
    # scheduling bounds; a discount with neither set runs indefinitely
    # once configured. See services/discount_utils.py for how these
    # combine into an actual charged price.
    discount_type: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    discount_value: Mapped[Optional[float]] = mapped_column(Numeric(12, 2), nullable=True)
    discount_starts_at: Mapped[Optional["datetime"]] = mapped_column(DateTime(timezone=True), nullable=True)
    discount_ends_at: Mapped[Optional["datetime"]] = mapped_column(DateTime(timezone=True), nullable=True)