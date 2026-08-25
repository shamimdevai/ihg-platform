"""Request/response schemas for permissions (read-only via API — seeded, not user-created)."""
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class PermissionRead(BaseModel):
    """Full permission representation."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    code: str
    description: Optional[str] = None