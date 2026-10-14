"""Restaurant — a single dine-in property, mirroring hotel.models.hotel.Hotel for
multi-property support (not a singleton table).
"""
from typing import Optional

from sqlalchemy import Boolean, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base_model import Base, SoftDeleteMixin, TimestampMixin, UUIDPKMixin


class Restaurant(Base, UUIDPKMixin, TimestampMixin, SoftDeleteMixin):
    """A single restaurant property."""

    __tablename__ = "restaurants"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    # Public-facing photo, uploaded via POST /restaurant/restaurants/{id}/image.
    image_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)