"""Request/response schemas for the settings API."""
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class SystemSettingBase(BaseModel):
    """Fields shared by create and update payloads."""

    value: Any
    value_type: str
    description: Optional[str] = None
    is_public: bool = False


class SystemSettingCreateOrUpdate(SystemSettingBase):
    """Payload for PUT /settings/{key}."""


class SystemSettingRead(SystemSettingBase):
    """Full representation returned by the settings API."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    key: str
    updated_by_staff_id: Optional[UUID] = None