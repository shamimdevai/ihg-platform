"""Stock — the current on-hand quantity for a single InventoryItem. One-to-one with
InventoryItem; the audit trail of how it got there lives in StockTransaction.
"""
import uuid

from sqlalchemy import ForeignKey, Numeric
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base_model import Base, SoftDeleteMixin, TimestampMixin, UUIDPKMixin


class Stock(Base, UUIDPKMixin, TimestampMixin, SoftDeleteMixin):
    """Current on-hand quantity for one inventory item. Mutated only via
    inventory_service.adjust_stock() — never edited directly by a repository caller,
    so every change is guaranteed to produce a matching StockTransaction row.
    """

    __tablename__ = "stock"

    inventory_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inventory_items.id"), nullable=False, unique=True
    )
    quantity_on_hand: Mapped[float] = mapped_column(Numeric(12, 3), default=0, nullable=False)