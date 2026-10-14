"""Request/response schemas for menu categories and menu items."""
from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, computed_field

from app.domains.restaurant.services.discount_utils import compute_effective_price


class MenuCategoryCreate(BaseModel):
    restaurant_id: UUID
    name: str
    display_order: int = 0
    is_active: bool = True


class MenuCategoryUpdate(BaseModel):
    """Payload for PUT /restaurant/menu/categories/{category_id}."""

    name: Optional[str] = None
    display_order: Optional[int] = None
    is_active: Optional[bool] = None


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
    # discount_type/discount_value must be supplied TOGETHER — validated in
    # menu_service._validate_discount_fields, not here, since the
    # cross-field + price-dependent checks (e.g. a fixed amount must be
    # less than price) need the full picture, not just this one schema.
    discount_type: Optional[Literal["percentage", "fixed_amount"]] = None
    discount_value: Optional[float] = Field(default=None, gt=0)
    discount_starts_at: Optional[datetime] = None
    discount_ends_at: Optional[datetime] = None


class MenuItemUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = Field(default=None, gt=0)
    is_available: Optional[bool] = None
    inventory_item_id: Optional[UUID] = None
    inventory_qty_per_unit: Optional[float] = Field(default=None, gt=0)
    discount_type: Optional[Literal["percentage", "fixed_amount"]] = None
    discount_value: Optional[float] = Field(default=None, gt=0)
    discount_starts_at: Optional[datetime] = None
    discount_ends_at: Optional[datetime] = None


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
    discount_type: Optional[str] = None
    discount_value: Optional[float] = None
    discount_starts_at: Optional[datetime] = None
    discount_ends_at: Optional[datetime] = None

    @computed_field  # type: ignore[misc]
    @property
    def effective_price(self) -> float:
        """The actual price a customer pays right now — the SAME
        calculation menu_service.get_effective_price() uses for real
        order pricing (both share compute_effective_price()), so the
        price shown here is never cosmetic-only."""
        return compute_effective_price(
            price=self.price,
            discount_type=self.discount_type,
            discount_value=self.discount_value,
            discount_starts_at=self.discount_starts_at,
            discount_ends_at=self.discount_ends_at,
        )

    @computed_field  # type: ignore[misc]
    @property
    def discount_active(self) -> bool:
        """Whether a discount is CURRENTLY in effect — respects the
        scheduling window, unlike just checking discount_type is set.
        Frontend should gate the "on sale" badge off this, not off
        effective_price != price (which could be fragile around
        rounding)."""
        return self.effective_price < self.price