"""Request/response schemas for inventory item CRUD."""
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class InventoryItemCreate(BaseModel):
    """Payload for POST /inventory/items."""

    name: str
    unit: str
    sku: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    reorder_threshold: Optional[float] = None
    default_supplier_id: Optional[UUID] = None
    is_active: bool = True


class InventoryItemUpdate(BaseModel):
    """Payload for PUT /inventory/items/{id}. All fields optional."""

    name: Optional[str] = None
    unit: Optional[str] = None
    sku: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    reorder_threshold: Optional[float] = None
    default_supplier_id: Optional[UUID] = None
    is_active: Optional[bool] = None


class InventoryItemRead(BaseModel):
    """Full inventory item representation."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    unit: str
    sku: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    reorder_threshold: Optional[float] = None
    default_supplier_id: Optional[UUID] = None
    is_active: bool