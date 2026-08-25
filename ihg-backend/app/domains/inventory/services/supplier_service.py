"""Business logic for supplier CRUD."""
from typing import List, Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.domains.inventory.models.supplier import Supplier
from app.domains.inventory.repositories import supplier_repository


async def create_supplier(
    db: AsyncSession,
    *,
    name: str,
    contact_name: Optional[str] = None,
    email: Optional[str] = None,
    phone: Optional[str] = None,
    address: Optional[str] = None,
    is_active: bool = True,
) -> Supplier:
    """Create a new supplier."""
    return await supplier_repository.create(
        db,
        name=name,
        contact_name=contact_name,
        email=email,
        phone=phone,
        address=address,
        is_active=is_active,
    )


async def list_suppliers(db: AsyncSession) -> List[Supplier]:
    """List every supplier."""
    return await supplier_repository.list_all(db)


async def get_supplier(db: AsyncSession, supplier_id: UUID) -> Supplier:
    """Fetch a single supplier by id.

    Raises:
        NotFoundError: no supplier with that id exists.
    """
    supplier = await supplier_repository.get_by_id(db, supplier_id)
    if supplier is None:
        raise NotFoundError("Supplier not found.")
    return supplier


async def update_supplier(
    db: AsyncSession,
    supplier_id: UUID,
    *,
    name: Optional[str] = None,
    contact_name: Optional[str] = None,
    email: Optional[str] = None,
    phone: Optional[str] = None,
    address: Optional[str] = None,
    is_active: Optional[bool] = None,
) -> Supplier:
    """Update a supplier's editable fields."""
    supplier = await get_supplier(db, supplier_id)
    if name is not None:
        supplier.name = name
    if contact_name is not None:
        supplier.contact_name = contact_name
    if email is not None:
        supplier.email = email
    if phone is not None:
        supplier.phone = phone
    if address is not None:
        supplier.address = address
    if is_active is not None:
        supplier.is_active = is_active
    return await supplier_repository.save(db, supplier)


async def delete_supplier(db: AsyncSession, supplier_id: UUID, *, deleted_by_staff_id: UUID) -> None:
    """Soft-delete a supplier."""
    supplier = await get_supplier(db, supplier_id)
    await supplier_repository.soft_delete(db, supplier, deleted_by_staff_id=deleted_by_staff_id)