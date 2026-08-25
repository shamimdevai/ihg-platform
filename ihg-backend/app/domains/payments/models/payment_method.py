"""PaymentMethod — a demo/test-mode payment method record (this phase's payment
gateway is simulated, per the task's "Demo/Test Mode" scope; no real card/account
data is ever stored here).
"""
from typing import Optional

from sqlalchemy import Boolean, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base_model import Base, SoftDeleteMixin, TimestampMixin, UUIDPKMixin


class PaymentMethod(Base, UUIDPKMixin, TimestampMixin, SoftDeleteMixin):
    """A payment method available to the simulated gateway (e.g. "card", "cash")."""

    __tablename__ = "payment_methods"

    # Free-form, e.g. "card", "cash", "wallet", "bank_transfer" — not an enum, so new
    # method types can be added without a migration.
    type: Mapped[str] = mapped_column(String(30), nullable=False)
    # Display label only, e.g. "Visa ending 4242" — demo/mock data, never a real PAN
    # or account number.
    label: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)