"""Staff-facing supplier CRUD."""
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_current_staff_user, get_db, require_permission
from app.domains.iam.models.staff_user import StaffUser
from app.domains.inventory.schemas.supplier import SupplierCreate, SupplierRead, SupplierUpdate
from app.domains.inventory.services import supplier_service
from app.shared_kernel.schemas.response_envelope import envelope

router = APIRouter(prefix="/inventory/suppliers", tags=["inventory-suppliers"])


@router.get("", dependencies=[Depends(require_permission("inventory:supplier:read"))])
async def list_suppliers(db: AsyncSession = Depends(get_db)) -> dict:
    """List every supplier."""
    suppliers = await supplier_service.list_suppliers(db)
    return envelope(data=[SupplierRead.model_validate(s) for s in suppliers])


@router.get("/{supplier_id}", dependencies=[Depends(require_permission("inventory:supplier:read"))])
async def get_supplier(supplier_id: UUID, db: AsyncSession = Depends(get_db)) -> dict:
    """Get a single supplier by id."""
    supplier = await supplier_service.get_supplier(db, supplier_id)
    return envelope(data=SupplierRead.model_validate(supplier))


@router.post("", dependencies=[Depends(require_permission("inventory:supplier:write"))])
async def create_supplier(payload: SupplierCreate, db: AsyncSession = Depends(get_db)) -> dict:
    """Create a new supplier."""
    supplier = await supplier_service.create_supplier(db, **payload.model_dump())
    return envelope(data=SupplierRead.model_validate(supplier), message="Supplier created.")


@router.put("/{supplier_id}", dependencies=[Depends(require_permission("inventory:supplier:write"))])
async def update_supplier(
    supplier_id: UUID, payload: SupplierUpdate, db: AsyncSession = Depends(get_db)
) -> dict:
    """Update a supplier's editable fields."""
    supplier = await supplier_service.update_supplier(
        db, supplier_id, **payload.model_dump(exclude_unset=True)
    )
    return envelope(data=SupplierRead.model_validate(supplier), message="Supplier updated.")


@router.delete("/{supplier_id}", dependencies=[Depends(require_permission("inventory:supplier:write"))])
async def delete_supplier(
    supplier_id: UUID,
    staff: StaffUser = Depends(get_current_staff_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Delete (soft) a supplier."""
    await supplier_service.delete_supplier(db, supplier_id, deleted_by_staff_id=staff.id)
    return envelope(message="Supplier deleted.")