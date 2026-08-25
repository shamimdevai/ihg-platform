"""Request/response schemas for department CRUD."""
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class DepartmentCreate(BaseModel):
    """Payload for POST /iam/departments."""

    name: str
    description: Optional[str] = None


class DepartmentUpdate(BaseModel):
    """Payload for PUT /iam/departments/{id}."""

    name: Optional[str] = None
    description: Optional[str] = None


class DepartmentRead(BaseModel):
    """Full department representation."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    description: Optional[str] = None