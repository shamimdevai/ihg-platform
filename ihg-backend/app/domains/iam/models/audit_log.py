"""AuditLog — a record of every mutating staff action, including impersonated ones."""
import uuid
from typing import Any, Optional

from sqlalchemy import JSON, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base_model import Base, SoftDeleteMixin, TimestampMixin, UUIDPKMixin


class AuditLog(Base, UUIDPKMixin, TimestampMixin, SoftDeleteMixin):
    """A single audit trail entry. staff_user_id is nullable to allow logging
    unauthenticated mutating requests (e.g. a failed login attempt).
    """

    __tablename__ = "audit_logs"

    staff_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("staff_users.id"), nullable=True
    )
    action: Mapped[str] = mapped_column(String(150), nullable=False)
    entity_type: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    entity_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    # Column stays named "metadata" in the DB; Python attribute is extra_data since
    # `metadata` is reserved on SQLAlchemy's DeclarativeBase.
    extra_data: Mapped[Optional[Any]] = mapped_column("metadata", JSON, nullable=True)
    impersonated_by_staff_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("staff_users.id"), nullable=True
    )