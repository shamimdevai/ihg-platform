"""SystemSetting — the DB-backed dynamic-tier configuration table (see PROJECT_STATE.md
§3 rule 11: two-tier configuration). Static branding lives in config/company.yaml
instead; never duplicate branding values here.
"""
import uuid
from typing import Any, Optional

from sqlalchemy import JSON, Boolean, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base_model import Base, SoftDeleteMixin, TimestampMixin, UUIDPKMixin


class SystemSetting(Base, UUIDPKMixin, TimestampMixin, SoftDeleteMixin):
    """A single runtime-adjustable setting: module toggles, password policy, tax rate, etc.

    `updated_by_staff_id` intentionally carries NO ForeignKey constraint yet — the
    iam.staff_user table doesn't exist until Phase 3. The column is added now so no
    migration needs to alter this table later; Phase 3 adds the FK constraint via its
    own migration once staff_user exists (never edit this applied migration directly).
    """

    __tablename__ = "system_settings"

    key: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    value: Mapped[Any] = mapped_column(JSON, nullable=False)
    value_type: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_public: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    updated_by_staff_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)