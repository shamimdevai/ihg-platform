"""Department — organizational grouping for staff (Reception, Housekeeping, etc.)."""
from typing import Optional

from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base_model import Base, SoftDeleteMixin, TimestampMixin, UUIDPKMixin


class Department(Base, UUIDPKMixin, TimestampMixin, SoftDeleteMixin):
    """A staff department, e.g. Reception, Housekeeping, Kitchen, Delivery, Management."""

    __tablename__ = "departments"

    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)