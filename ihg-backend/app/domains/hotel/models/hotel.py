"""Hotel — a single property under multi-property support (see PROJECT_STATE.md
Open Decision #4). Owns room types and rooms; not a singleton table.
"""
from typing import Optional

from sqlalchemy import Boolean, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base_model import Base, SoftDeleteMixin, TimestampMixin, UUIDPKMixin


class Hotel(Base, UUIDPKMixin, TimestampMixin, SoftDeleteMixin):
    """A single hotel property."""

    __tablename__ = "hotels"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)