"""Notification — generic in-app notification record. recipient_type distinguishes
staff vs customer without creating a direct FK to either domain's table (kept in
shared_kernel deliberately since both iam and customers need it).
"""
import uuid
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import JSON, DateTime, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base_model import Base, SoftDeleteMixin, TimestampMixin, UUIDPKMixin


class Notification(Base, UUIDPKMixin, TimestampMixin, SoftDeleteMixin):
    """A single in-app notification for a staff member or customer."""

    __tablename__ = "notifications"

    recipient_type: Mapped[str] = mapped_column(String(20), nullable=False)
    recipient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    read_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    # Column name stays "metadata" in the DB (matches PROJECT_STATE.md's description),
    # but the Python attribute is named extra_data — `metadata` is reserved on
    # SQLAlchemy's DeclarativeBase (Base.metadata) and cannot be used as an attribute name.
    extra_data: Mapped[Optional[Any]] = mapped_column("metadata", JSON, nullable=True)