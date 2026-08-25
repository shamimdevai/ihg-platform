"""Menu category and menu item management, incl. image upload."""
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_db, require_permission
from app.domains.restaurant.schemas.menu import (
    MenuCategoryCreate,
    MenuCategoryRead,
    MenuItemCreate,
    MenuItemRead,
    MenuItemUpdate,
)
from app.domains.restaurant.services import menu_service
from app.shared_kernel.schemas.response_envelope import envelope

router = APIRouter(prefix="/restaurant/menu", tags=["restaurant"])


@router.post("/categories", dependencies=[Depends(require_permission("restaurant:menu:write"))])
async def create_category(payload: MenuCategoryCreate, db: AsyncSession = Depends(get_db)) -> dict:
    category = await menu_service.create_category(db, **payload.model_dump())
    return envelope(data=MenuCategoryRead.model_validate(category), message="Menu category created.")


@router.get("/categories", dependencies=[Depends(require_permission("restaurant:menu:read"))])
async def list_categories(restaurant_id: UUID, db: AsyncSession = Depends(get_db)) -> dict:
    categories = await menu_service.list_categories(db, restaurant_id)
    return envelope(data=[MenuCategoryRead.model_validate(c) for c in categories])


@router.post("/items", dependencies=[Depends(require_permission("restaurant:menu:write"))])
async def create_item(payload: MenuItemCreate, db: AsyncSession = Depends(get_db)) -> dict:
    item = await menu_service.create_item(db, **payload.model_dump())
    return envelope(data=MenuItemRead.model_validate(item), message="Menu item created.")


@router.get("/items", dependencies=[Depends(require_permission("restaurant:menu:read"))])
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


@router.get("/items/{item_id}", dependencies=[Depends(require_permission("restaurant:menu:read"))])
async def get_item(item_id: UUID, db: AsyncSession = Depends(get_db)) -> dict:
    item = await menu_service.get_item(db, item_id)
    return envelope(data=MenuItemRead.model_validate(item))


@router.put("/items/{item_id}", dependencies=[Depends(require_permission("restaurant:menu:write"))])
async def update_item(item_id: UUID, payload: MenuItemUpdate, db: AsyncSession = Depends(get_db)) -> dict:
    item = await menu_service.update_item(db, item_id, **payload.model_dump())
    return envelope(data=MenuItemRead.model_validate(item), message="Menu item updated.")


@router.post("/items/{item_id}/image", dependencies=[Depends(require_permission("restaurant:menu:write"))])
async def upload_item_image(item_id: UUID, file: UploadFile = File(...), db: AsyncSession = Depends(get_db)) -> dict:
    item = await menu_service.upload_item_image(db, item_id, file)
    return envelope(data=MenuItemRead.model_validate(item), message="Menu item image uploaded.")