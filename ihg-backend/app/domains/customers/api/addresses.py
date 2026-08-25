"""Customer self-service delivery address CRUD."""
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_current_customer, get_db
from app.domains.customers.models.customer import Customer
from app.domains.customers.schemas.customer_address import (
    CustomerAddressCreate,
    CustomerAddressRead,
    CustomerAddressUpdate,
)
from app.domains.customers.services import address_service
from app.shared_kernel.schemas.response_envelope import envelope

router = APIRouter(prefix="/customers/me/addresses", tags=["customer-addresses"])


@router.get("")
async def list_addresses(
    customer: Customer = Depends(get_current_customer), db: AsyncSession = Depends(get_db)
) -> dict:
    """List every saved address for the current customer."""
    addresses = await address_service.list_addresses(db, customer.id)
    return envelope(data=[CustomerAddressRead.model_validate(a) for a in addresses])


@router.post("")
async def create_address(
    payload: CustomerAddressCreate,
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Save a new delivery address for the current customer."""
    address = await address_service.create_address(db, customer_id=customer.id, **payload.model_dump())
    return envelope(data=CustomerAddressRead.model_validate(address), message="Address saved.")


@router.get("/{address_id}")
async def get_address(
    address_id: UUID,
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Get a single saved address, verifying it belongs to the current customer."""
    address = await address_service.get_address(db, customer_id=customer.id, address_id=address_id)
    return envelope(data=CustomerAddressRead.model_validate(address))


@router.put("/{address_id}")
async def update_address(
    address_id: UUID,
    payload: CustomerAddressUpdate,
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Update a saved address, verifying ownership."""
    address = await address_service.update_address(
        db, customer_id=customer.id, address_id=address_id, **payload.model_dump(exclude_unset=True)
    )
    return envelope(data=CustomerAddressRead.model_validate(address), message="Address updated.")


@router.delete("/{address_id}")
async def delete_address(
    address_id: UUID,
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Delete (soft) a saved address, verifying ownership."""
    await address_service.delete_address(db, customer_id=customer.id, address_id=address_id)
    return envelope(message="Address deleted.")