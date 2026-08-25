"""Request/response schemas for customer address CRUD."""
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class CustomerAddressCreate(BaseModel):
    """Payload for POST /customers/me/addresses."""

    label: str
    address_line1: str
    address_line2: Optional[str] = None
    city: str
    state: Optional[str] = None
    postal_code: Optional[str] = None
    country: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    is_default: bool = False


class CustomerAddressUpdate(BaseModel):
    """Payload for PUT /customers/me/addresses/{id}. All fields optional."""

    label: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    country: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    is_default: Optional[bool] = None


class CustomerAddressRead(BaseModel):
    """Full address representation."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    customer_id: UUID
    label: str
    address_line1: str
    address_line2: Optional[str] = None
    city: str
    state: Optional[str] = None
    postal_code: Optional[str] = None
    country: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    is_default: bool