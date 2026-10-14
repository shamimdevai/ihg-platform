"""Business logic for restaurants and dining tables."""
from typing import List, Optional
from uuid import UUID

from fastapi import UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.shared_kernel.services import upload_service
from app.domains.restaurant.models.dining_table import DiningTable
from app.domains.restaurant.models.restaurant import Restaurant
from app.domains.restaurant.repositories import dining_table_repository, restaurant_repository

_VALID_TABLE_STATUSES = {"available", "reserved", "occupied", "cleaning"}


# --- Restaurants -----------------------------------------------------------------------


async def create_restaurant(db: AsyncSession, **kwargs) -> Restaurant:
    return await restaurant_repository.create(db, **kwargs)


async def list_restaurants(db: AsyncSession) -> List[Restaurant]:
    return await restaurant_repository.list_all(db)


async def get_restaurant(db: AsyncSession, restaurant_id: UUID) -> Restaurant:
    restaurant = await restaurant_repository.get_by_id(db, restaurant_id)
    if restaurant is None:
        raise NotFoundError("Restaurant not found.")
    return restaurant


async def update_restaurant(db: AsyncSession, restaurant_id: UUID, **fields) -> Restaurant:
    restaurant = await get_restaurant(db, restaurant_id)
    for key, value in fields.items():
        if value is not None:
            setattr(restaurant, key, value)
    return await restaurant_repository.save(db, restaurant)


# --- Dining tables ---------------------------------------------------------------------


async def create_table(db: AsyncSession, *, restaurant_id: UUID, table_number: str, **kwargs) -> DiningTable:
    await get_restaurant(db, restaurant_id)
    if await dining_table_repository.get_by_restaurant_and_number(db, restaurant_id, table_number) is not None:
        raise ConflictError(f"Table number '{table_number}' already exists for this restaurant.")
    return await dining_table_repository.create(
        db, restaurant_id=restaurant_id, table_number=table_number, **kwargs
    )


async def list_tables(
    db: AsyncSession, *, restaurant_id: Optional[UUID] = None, status: Optional[str] = None
) -> List[DiningTable]:
    return await dining_table_repository.list_all(db, restaurant_id=restaurant_id, status=status)


async def get_table(db: AsyncSession, table_id: UUID) -> DiningTable:
    table = await dining_table_repository.get_by_id(db, table_id)
    if table is None:
        raise NotFoundError("Dining table not found.")
    return table


async def update_table_status(db: AsyncSession, table_id: UUID, status: str) -> DiningTable:
    if status not in _VALID_TABLE_STATUSES:
        raise ValidationError(f"status must be one of {sorted(_VALID_TABLE_STATUSES)}.")
    table = await get_table(db, table_id)
    table.status = status
    return await dining_table_repository.save(db, table)


async def upload_restaurant_image(db: AsyncSession, restaurant_id: UUID, file: UploadFile) -> Restaurant:
    """Save an uploaded photo and store its URL on Restaurant.image_url."""
    restaurant = await get_restaurant(db, restaurant_id)
    result = await upload_service.save_upload(file, subfolder="restaurants")
    restaurant.image_url = result.url
    return await restaurant_repository.save(db, restaurant)