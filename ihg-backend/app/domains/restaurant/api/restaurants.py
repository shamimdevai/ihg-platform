"""Restaurant property management. Gated by restaurant:table:* — the property
is the top-level container of tables, mirroring hotel.api.hotels.py being
gated by hotel:room:* rather than a separate property-level permission code.
"""
from uuid import UUID

from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_db, require_permission
from app.domains.restaurant.schemas.restaurant import RestaurantCreate, RestaurantRead, RestaurantUpdate
from app.domains.restaurant.services import restaurant_service
from app.shared_kernel.schemas.response_envelope import envelope

router = APIRouter(prefix="/restaurant/restaurants", tags=["restaurant"])


@router.post("", dependencies=[Depends(require_permission("restaurant:table:write"))])
async def create_restaurant(payload: RestaurantCreate, db: AsyncSession = Depends(get_db)) -> dict:
    restaurant = await restaurant_service.create_restaurant(db, **payload.model_dump())
    return envelope(data=RestaurantRead.model_validate(restaurant), message="Restaurant created.")


@router.get("", dependencies=[Depends(require_permission("restaurant:table:read"))])
async def list_restaurants(db: AsyncSession = Depends(get_db)) -> dict:
    restaurants = await restaurant_service.list_restaurants(db)
    return envelope(data=[RestaurantRead.model_validate(r) for r in restaurants])


@router.get("/{restaurant_id}", dependencies=[Depends(require_permission("restaurant:table:read"))])
async def get_restaurant(restaurant_id: UUID, db: AsyncSession = Depends(get_db)) -> dict:
    restaurant = await restaurant_service.get_restaurant(db, restaurant_id)
    return envelope(data=RestaurantRead.model_validate(restaurant))


@router.put("/{restaurant_id}", dependencies=[Depends(require_permission("restaurant:table:write"))])
async def update_restaurant(restaurant_id: UUID, payload: RestaurantUpdate, db: AsyncSession = Depends(get_db)) -> dict:
    restaurant = await restaurant_service.update_restaurant(db, restaurant_id, **payload.model_dump())
    return envelope(data=RestaurantRead.model_validate(restaurant), message="Restaurant updated.")


@router.post("/{restaurant_id}/image", dependencies=[Depends(require_permission("restaurant:table:write"))])
async def upload_restaurant_image(
    restaurant_id: UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
) -> dict:
    restaurant = await restaurant_service.upload_restaurant_image(db, restaurant_id, file)
    return envelope(data=RestaurantRead.model_validate(restaurant), message="Restaurant image uploaded.")