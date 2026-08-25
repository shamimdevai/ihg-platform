"""StockAlert — a low-stock alert triggered when an item's quantity drops to or below
its reorder_threshold. One alert stays "open" until explicitly resolved by staff;
adjust_stock() will not create a second open alert for the same item while one exists.
"""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base_model import Base, SoftDeleteMixin, TimestampMixin, UUIDPKMixin


class StockAlert(Base, UUIDPKMixin, TimestampMixin, SoftDeleteMixin):
    """A single low-stock alert for one inventory item."""

    __tablename__ = "stock_alerts"

    inventory_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inventory_items.id"), nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(String(20), default="open", nullable=False)  # "open" | "resolved"
    threshold_at_trigger: Mapped[float] = mapped_column(Numeric(12, 3), nullable=False)
    quantity_at_trigger: Mapped[float] = mapped_column(Numeric(12, 3), nullable=False)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    # No hard FK — same no-cross-domain-FK convention as StockTransaction.performed_by_staff_id.
    resolved_by_staff_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    resolution_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)