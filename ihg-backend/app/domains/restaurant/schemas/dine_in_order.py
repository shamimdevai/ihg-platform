"""Request/response schemas for dine-in orders and order items."""
from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class DineInOrderItemCreate(BaseModel):
    menu_item_id: UUID
    quantity: int = Field(default=1, ge=1)
    special_instructions: Optional[str] = None


class DineInOrderCreate(BaseModel):
    restaurant_id: UUID
    table_id: UUID
    reservation_id: Optional[UUID] = None
    customer_id: Optional[UUID] = None
    notes: Optional[str] = None
    items: List[DineInOrderItemCreate] = Field(min_length=1)


class DineInOrderItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    menu_item_id: UUID
    item_name: str
    quantity: int
    unit_price: float
    line_total: float
    special_instructions: Optional[str] = None


class DineInOrderRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    restaurant_id: UUID
    table_id: UUID
    reservation_id: Optional[UUID] = None
    customer_id: Optional[UUID] = None
    status: str
    subtotal: float
    tax_amount: float
    total_amount: float
    currency: str
    notes: Optional[str] = None
    placed_by_staff_id: Optional[UUID] = None
    created_at: datetime


class DineInOrderDetailRead(DineInOrderRead):
    items: List[DineInOrderItemRead] = []