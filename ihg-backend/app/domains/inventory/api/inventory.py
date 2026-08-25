"""Staff-facing inventory item CRUD."""
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_current_staff_user, get_db, require_permission
from app.domains.iam.models.staff_user import StaffUser
from app.domains.inventory.schemas.inventory_item import (
    InventoryItemCreate,
    InventoryItemRead,
    InventoryItemUpdate,
)
from app.domains.inventory.services import inventory_service
from app.shared_kernel.schemas.response_envelope import envelope

router = APIRouter(prefix="/inventory/items", tags=["inventory-items"])


@router.get("", dependencies=[Depends(require_permission("inventory:item:read"))])
async def list_items(db: AsyncSession = Depends(get_db)) -> dict:
    """List every inventory item."""
    items = await inventory_service.list_items(db)
    return envelope(data=[InventoryItemRead.model_validate(i) for i in items])


@router.get("/{item_id}", dependencies=[Depends(require_permission("inventory:item:read"))])
async def get_item(item_id: UUID, db: AsyncSession = Depends(get_db)) -> dict:
    """Get a single inventory item by id."""
    item = await inventory_service.get_item(db, item_id)
    return envelope(data=InventoryItemRead.model_validate(item))


@router.post("", dependencies=[Depends(require_permission("inventory:item:write"))])
async def create_item(payload: InventoryItemCreate, db: AsyncSession = Depends(get_db)) -> dict:
    """Create a new inventory item catalog entry."""
    item = await inventory_service.create_item(db, **payload.model_dump())
    return envelope(data=InventoryItemRead.model_validate(item), message="Inventory item created.")


@router.put("/{item_id}", dependencies=[Depends(require_permission("inventory:item:write"))])
async def update_item(item_id: UUID, payload: InventoryItemUpdate, db: AsyncSession = Depends(get_db)) -> dict:
    """Update an inventory item's editable fields."""
    item = await inventory_service.update_item(db, item_id, **payload.model_dump(exclude_unset=True))
    return envelope(data=InventoryItemRead.model_validate(item), message="Inventory item updated.")


@router.delete("/{item_id}", dependencies=[Depends(require_permission("inventory:item:write"))])
async def delete_item(
    item_id: UUID,
    staff: StaffUser = Depends(get_current_staff_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Delete (soft) an inventory item."""
    await inventory_service.delete_item(db, item_id, deleted_by_staff_id=staff.id)
    return envelope(message="Inventory item deleted.")