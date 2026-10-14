"""Customer-facing, read-only browsing of restaurant/menu data.

Backlog item 10. This domain previously had NO customer-accessible
catalog-browsing routes at all — the frontend (menuApi.js, built at
Phase 26) called the SAME paths restaurantApi.js (staff) uses
(/restaurant/menu/items, /restaurant/menu/categories), which are gated
by require_permission("restaurant:menu:read") — staff-only, via
get_current_staff_user, which rejects a customer token outright. Every
one of those calls would 401 against this real backend.

Fixed with a dedicated new router at /restaurant/customer, reusing the
EXACT same service-layer functions the staff routes call (restaurant_
service, menu_service) — only the auth dependency differs
(get_current_customer here, require_permission there). This follows the
same structural principle the delivery domain already established:
customer and staff read-access to the same underlying data are separate,
differently-gated routes, never one endpoint accepting both token types
(see api/v1/deps.py's own module docstring). This IS a new pattern for
THIS domain specifically, though — restaurant never previously had a
customer-facing catalog browse the way delivery's customer routes
(all "my own orders") did.
"""
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_current_customer, get_db
from app.domains.customers.models.customer import Customer
from app.domains.restaurant.schemas.menu import MenuCategoryRead, MenuItemRead
from app.domains.restaurant.schemas.restaurant import RestaurantPublicRead
from app.domains.restaurant.services import menu_service, restaurant_service
from app.shared_kernel.schemas.response_envelope import envelope

router = APIRouter(prefix="/restaurant/customer", tags=["restaurant-customer"])


@router.get("/restaurants")
async def list_restaurants_for_customer(
    customer: Customer = Depends(get_current_customer), db: AsyncSession = Depends(get_db)
) -> dict:
    """Active restaurants only, id/name only — reuses
    restaurant_service.list_restaurants() (same data staff's
    GET /restaurant/restaurants uses), filtered and narrowed here.
    """
    restaurants = await restaurant_service.list_restaurants(db)
    active = [r for r in restaurants if r.is_active]
    return envelope(data=[RestaurantPublicRead.model_validate(r) for r in active])


@router.get("/menu/categories")
async def list_categories_for_customer(
    restaurant_id: UUID,
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Active categories only — a customer should never see a category
    a staff member has deactivated."""
    categories = await menu_service.list_categories(db, restaurant_id)
    active = [c for c in categories if c.is_active]
    return envelope(data=[MenuCategoryRead.model_validate(c) for c in active])


@router.get("/menu/items")
async def list_items_for_customer(
    restaurant_id: Optional[UUID] = None,
    category_id: Optional[UUID] = None,
    is_available: Optional[bool] = None,
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
) -> dict:
    items = await menu_service.list_items(
        db, restaurant_id=restaurant_id, category_id=category_id, is_available=is_available
    )
    return envelope(data=[MenuItemRead.model_validate(i) for i in items])


@router.get("/menu/items/{item_id}")
async def get_item_for_customer(
    item_id: UUID,
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
) -> dict:
    item = await menu_service.get_item(db, item_id)
    return envelope(data=MenuItemRead.model_validate(item))