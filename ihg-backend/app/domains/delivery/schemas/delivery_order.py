"""Request/response schemas for delivery orders and order items."""
from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class DeliveryOrderItemCreate(BaseModel):
    menu_item_id: UUID
    quantity: int = Field(default=1, ge=1)
    special_instructions: Optional[str] = None


class DeliveryOrderCreate(BaseModel):
    restaurant_id: UUID
    delivery_address_id: UUID
    delivery_notes: Optional[str] = None
    items: List[DeliveryOrderItemCreate] = Field(min_length=1)


class DeliveryOrderCancelRequest(BaseModel):
    reason: Optional[str] = None


class DeliveryOrderItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    menu_item_id: UUID
    item_name: str
    quantity: int
    unit_price: float
    line_total: float
    special_instructions: Optional[str] = None


class DeliveryOrderRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    customer_id: UUID
    delivery_address_id: UUID
    restaurant_id: UUID
    status: str
    subtotal: float
    delivery_fee: float
    tax_amount: float
    total_amount: float
    currency: str
    delivery_notes: Optional[str] = None
    cancelled_reason: Optional[str] = None
    confirmed_at: Optional[datetime] = None
    ready_at: Optional[datetime] = None
    out_for_delivery_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None
    created_at: datetime


class DeliveryOrderDetailRead(DeliveryOrderRead):
    items: List[DeliveryOrderItemRead] = []