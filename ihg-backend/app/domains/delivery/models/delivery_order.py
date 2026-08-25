"""DeliveryOrder — a single food-delivery order placed by a registered,
verified customer. restaurant_id/customer_id/delivery_address_id are all
loosely coupled to peer domains (restaurant, customers) — no hard FK, per the
cross-domain rule; mirrors hotel.models.invoice.Invoice.payment_id's precedent
for cross-domain references.
"""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base_model import Base, SoftDeleteMixin, TimestampMixin, UUIDPKMixin


class DeliveryOrder(Base, UUIDPKMixin, TimestampMixin, SoftDeleteMixin):
    """A delivery order. Status machine: placed -> confirmed -> preparing ->
    ready_for_pickup -> assigned -> out_for_delivery -> delivered, or
    placed/confirmed/preparing -> cancelled. No other transitions permitted
    (enforced in delivery_order_service / delivery_tracking_service /
    rider_service).
    """

    __tablename__ = "delivery_orders"

    # Loosely coupled to customers.customer.id — no FK, cross-domain rule.
    customer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    # Loosely coupled to customers.customer_address.id — no FK, cross-domain rule.
    delivery_address_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    # Loosely coupled to restaurant.restaurants.id — no FK, cross-domain rule
    # (delivery and restaurant are peer domains, same as hotel and payments).
    restaurant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)

    status: Mapped[str] = mapped_column(String(20), default="placed", nullable=False)
    subtotal: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    delivery_fee: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    tax_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    total_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)

    delivery_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    cancelled_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    confirmed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    ready_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    out_for_delivery_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    delivered_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    cancelled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)