"""Request/response schemas for a customer's own self-service profile."""
from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr


class CustomerRead(BaseModel):
    """Full customer profile representation (never includes password_hash)."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: EmailStr
    phone: Optional[str] = None
    first_name: str
    last_name: str
    email_verified_at: Optional[datetime] = None
    is_active: bool


class CustomerUpdate(BaseModel):
    """Payload for PUT /customers/me. All fields optional (partial update). Email is
    intentionally not updatable here — changing email would require re-verification,
    out of scope for this phase.
    """

    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None