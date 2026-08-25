"""InvoiceItem — a single line item on an invoice (room charge, service request
charge, manual adjustment, etc.).
"""
import uuid

from sqlalchemy import ForeignKey, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base_model import Base, SoftDeleteMixin, TimestampMixin, UUIDPKMixin


class InvoiceItem(Base, UUIDPKMixin, TimestampMixin, SoftDeleteMixin):
    """A single invoice line item."""

    __tablename__ = "invoice_items"

    invoice_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("invoices.id"), nullable=False, index=True
    )
    description: Mapped[str] = mapped_column(String(255), nullable=False)
    # "room_charge" | "service_request" | "adjustment" — free-form
    item_type: Mapped[str] = mapped_column(String(30), nullable=False, default="room_charge")
    quantity: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=1)
    unit_price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    line_total: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)