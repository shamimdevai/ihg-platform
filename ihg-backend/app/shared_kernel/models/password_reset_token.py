"""PasswordResetToken — ONE shared polymorphic model backing password reset, staff
invite, AND email verification flows (PROJECT_STATE.md §3 rule 9 / Open Decisions #13).
Never create a per-domain duplicate of this table.
"""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base_model import Base, SoftDeleteMixin, TimestampMixin, UUIDPKMixin


class PasswordResetToken(Base, UUIDPKMixin, TimestampMixin, SoftDeleteMixin):
    """A single-use token for password reset, staff invite, or email verification.

    Only a SHA-256 hash of the raw token is ever stored (see
    shared_kernel.services.password_reset_service._hash_token) — the raw value exists
    only transiently, embedded in the emailed link.
    """

    __tablename__ = "password_reset_tokens"

    principal_type: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    principal_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    token_hash: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    purpose: Mapped[str] = mapped_column(String(20), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)