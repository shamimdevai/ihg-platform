"""Request/response schemas for restaurants."""
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class RestaurantCreate(BaseModel):
    name: str
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    is_active: bool = True


class RestaurantUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    is_active: Optional[bool] = None


class RestaurantRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    is_active: bool
    image_url: Optional[str] = None


class RestaurantPublicRead(BaseModel):
    """Narrow, customer-facing restaurant read — id/name only. No
    management fields (address/phone/email) a customer has no need to
    see; those stay exclusive to RestaurantRead (staff-only). Backlog
    item 10. Phase 1 (public website): also exposes address/phone so the
    public site can show where a restaurant is. Still no email/is_active."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    address: Optional[str] = None
    phone: Optional[str] = None
    image_url: Optional[str] = None