"""Request/response schemas for role CRUD and permission assignment."""
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.domains.iam.schemas.permission import PermissionRead


class RoleCreate(BaseModel):
    """Payload for POST /iam/roles."""

    name: str
    description: Optional[str] = None


class RoleUpdate(BaseModel):
    """Payload for PUT /iam/roles/{id}."""

    name: Optional[str] = None
    description: Optional[str] = None


class RoleRead(BaseModel):
    """Full role representation, including its assigned permissions."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    description: Optional[str] = None
    permissions: List[PermissionRead] = []


class RoleAssignPermissions(BaseModel):
    """Payload for POST /iam/roles/{id}/permissions."""

    permission_ids: List[UUID]