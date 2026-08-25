"""Request/response schemas for menu categories and menu items."""
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class MenuCategoryCreate(BaseModel):
    restaurant_id: UUID
    name: str
    display_order: int = 0
    is_active: bool = True


class MenuCategoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    restaurant_id: UUID
    name: str
    display_order: int
    is_active: bool


class MenuItemCreate(BaseModel):
    restaurant_id: UUID
    category_id: UUID
    name: str
    description: Optional[str] = None
    price: float = Field(gt=0)
    is_available: bool = True
    inventory_item_id: Optional[UUID] = None
    inventory_qty_per_unit: Optional[float] = Field(default=None, gt=0)


class MenuItemUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = Field(default=None, gt=0)
    is_available: Optional[bool] = None
    inventory_item_id: Optional[UUID] = None
    inventory_qty_per_unit: Optional[float] = Field(default=None, gt=0)


class MenuItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    restaurant_id: UUID
    category_id: UUID
    name: str
    description: Optional[str] = None
    price: float
    image_url: Optional[str] = None
    is_available: bool
    inventory_item_id: Optional[UUID] = None
    inventory_qty_per_unit: Optional[float] = None