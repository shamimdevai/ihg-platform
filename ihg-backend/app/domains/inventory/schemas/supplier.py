"""Request/response schemas for supplier CRUD."""
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class SupplierCreate(BaseModel):
    """Payload for POST /inventory/suppliers."""

    name: str
    contact_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    is_active: bool = True


class SupplierUpdate(BaseModel):
    """Payload for PUT /inventory/suppliers/{id}. All fields optional."""

    name: Optional[str] = None
    contact_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    is_active: Optional[bool] = None


class SupplierRead(BaseModel):
    """Full supplier representation."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    contact_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    is_active: bool