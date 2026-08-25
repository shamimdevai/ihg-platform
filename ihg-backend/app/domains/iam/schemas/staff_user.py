"""Request/response schemas for staff account CRUD."""
from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr


class StaffUserRead(BaseModel):
    """Full staff account representation (never includes password_hash)."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: EmailStr
    first_name: str
    last_name: str
    role_id: UUID
    department_id: Optional[UUID] = None
    is_active: bool
    is_superadmin: bool
    last_login_at: Optional[datetime] = None


class StaffUserUpdate(BaseModel):
    """Payload for PUT /iam/staff/{id}. All fields optional (partial update)."""

    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role_id: Optional[UUID] = None
    department_id: Optional[UUID] = None