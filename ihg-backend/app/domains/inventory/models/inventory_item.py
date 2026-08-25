"""InventoryItem — the catalog definition of a stocked item (not its current quantity;
see stock.py for that). Shared across hotel, restaurant, and delivery via
inventory_service.adjust_stock() as the single source of truth for stock levels.
"""
import uuid
from typing import Optional

from sqlalchemy import Boolean, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base_model import Base, SoftDeleteMixin, TimestampMixin, UUIDPKMixin


class InventoryItem(Base, UUIDPKMixin, TimestampMixin, SoftDeleteMixin):
    """A single trackable inventory item (ingredient, supply, amenity, etc.)."""

    __tablename__ = "inventory_items"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    sku: Mapped[Optional[str]] = mapped_column(String(50), unique=True, nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    unit: Mapped[str] = mapped_column(String(20), nullable=False)  # e.g. "kg", "pcs", "liter"
    category: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    # Low-stock alert fires when quantity_on_hand <= reorder_threshold. NULL means
    # alerting is intentionally disabled for this item (not every item needs it).
    reorder_threshold: Mapped[Optional[float]] = mapped_column(Numeric(12, 3), nullable=True)
    default_supplier_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("suppliers.id"), nullable=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)