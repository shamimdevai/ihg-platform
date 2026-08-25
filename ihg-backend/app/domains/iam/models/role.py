"""Role — a named collection of permissions (Admin, Manager, Reception, Waiter, ...)."""
from typing import List, Optional

from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.base_model import Base, SoftDeleteMixin, TimestampMixin, UUIDPKMixin


class Role(Base, UUIDPKMixin, TimestampMixin, SoftDeleteMixin):
    """A named role assignable to staff_user, granting a set of permissions."""

    __tablename__ = "roles"

    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    permissions: Mapped[List["Permission"]] = relationship(
        "Permission", secondary="role_permissions", back_populates="roles", lazy="selectin"
    )