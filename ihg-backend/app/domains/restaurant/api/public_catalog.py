"""Public (no-login) restaurant + menu browsing for the customer website.

Same service-layer calls as the staff and customer-token routers; only the
auth gate differs (none). Read-only. Placing an order or reserving a table
still requires a logged-in, verified customer.
"""
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_db
from app.domains.restaurant.schemas.menu import MenuCategoryRead, MenuItemRead
from app.domains.restaurant.schemas.restaurant import RestaurantPublicRead
from app.domains.restaurant.services import menu_service, restaurant_service
from app.shared_kernel.schemas.response_envelope import envelope

router = APIRouter(prefix="/restaurant/public", tags=["restaurant-public"])


@router.get("/restaurants")
async def list_restaurants(db: AsyncSession = Depends(get_db)) -> dict:
    restaurants = await restaurant_service.list_restaurants(db)
    active = [r for r in restaurants if r.is_active]
    return envelope(data=[RestaurantPublicRead.model_validate(r) for r in active])


@router.get("/menu/categories")
async def list_categories(restaurant_id: UUID, db: AsyncSession = Depends(get_db)) -> dict:
    categories = await menu_service.list_categories(db, restaurant_id)
    active = [c for c in categories if c.is_active]
    return envelope(data=[MenuCategoryRead.model_validate(c) for c in active])


@router.get("/menu/items")
async def list_items(
    restaurant_id: Optional[UUID] = None,
    category_id: Optional[UUID] = None,
    is_available: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
) -> dict:
    items = await menu_service.list_items(
        db, restaurant_id=restaurant_id, category_id=category_id, is_available=is_available
    )
    return envelope(data=[MenuItemRead.model_validate(i) for i in items])


@router.get("/menu/items/{item_id}")
async def get_item(item_id: UUID, db: AsyncSession = Depends(get_db)) -> dict:
    item = await menu_service.get_item(db, item_id)
    return envelope(data=MenuItemRead.model_validate(item))