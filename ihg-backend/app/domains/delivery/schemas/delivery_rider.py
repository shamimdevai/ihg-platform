"""Request/response schemas for delivery riders."""
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class DeliveryRiderCreate(BaseModel):
    staff_id: UUID
    vehicle_type: Optional[str] = None
    license_plate: Optional[str] = None
    phone: Optional[str] = None


class DeliveryRiderUpdate(BaseModel):
    vehicle_type: Optional[str] = None
    license_plate: Optional[str] = None
    phone: Optional[str] = None
    is_active: Optional[bool] = None


class DeliveryRiderStatusUpdate(BaseModel):
    status: str  # "available" | "busy" | "offline"


class DeliveryRiderRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    staff_id: UUID
    vehicle_type: Optional[str] = None
    license_plate: Optional[str] = None
    phone: Optional[str] = None
    status: str
    is_active: bool