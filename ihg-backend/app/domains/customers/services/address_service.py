"""Business logic for customer delivery address CRUD. Every operation is scoped to a
customer_id supplied by the caller (the API layer derives it from get_current_customer,
never from the request body) so a customer can only ever touch their own addresses.
"""
from typing import List, Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError, PermissionDeniedError
from app.domains.customers.models.customer_address import CustomerAddress
from app.domains.customers.repositories import customer_address_repository


async def create_address(
    db: AsyncSession,
    *,
    customer_id: UUID,
    label: str,
    address_line1: str,
    city: str,
    country: str,
    address_line2: Optional[str] = None,
    state: Optional[str] = None,
    postal_code: Optional[str] = None,
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    is_default: bool = False,
) -> CustomerAddress:
    """Create a new delivery address for a customer."""
    return await customer_address_repository.create(
        db,
        customer_id=customer_id,
        label=label,
        address_line1=address_line1,
        address_line2=address_line2,
        city=city,
        state=state,
        postal_code=postal_code,
        country=country,
        latitude=latitude,
        longitude=longitude,
        is_default=is_default,
    )


async def list_addresses(db: AsyncSession, customer_id: UUID) -> List[CustomerAddress]:
    """List every address belonging to a customer."""
    return await customer_address_repository.list_by_customer(db, customer_id)


async def _get_owned_address(db: AsyncSession, *, customer_id: UUID, address_id: UUID) -> CustomerAddress:
    """Fetch an address and verify it belongs to `customer_id`.

    Raises:
        NotFoundError: address does not exist.
        PermissionDeniedError: address belongs to a different customer.
    """
    address = await customer_address_repository.get_by_id(db, address_id)
    if address is None:
        raise NotFoundError("Address not found.")
    if address.customer_id != customer_id:
        raise PermissionDeniedError("Cannot access another customer's address.")
    return address


async def get_address(db: AsyncSession, *, customer_id: UUID, address_id: UUID) -> CustomerAddress:
    """Fetch a single address, verifying ownership."""
    return await _get_owned_address(db, customer_id=customer_id, address_id=address_id)


async def update_address(
    db: AsyncSession,
    *,
    customer_id: UUID,
    address_id: UUID,
    label: Optional[str] = None,
    address_line1: Optional[str] = None,
    address_line2: Optional[str] = None,
    city: Optional[str] = None,
    state: Optional[str] = None,
    postal_code: Optional[str] = None,
    country: Optional[str] = None,
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    is_default: Optional[bool] = None,
) -> CustomerAddress:
    """Update an address's fields, verifying ownership first."""
    address = await _get_owned_address(db, customer_id=customer_id, address_id=address_id)
    if label is not None:
        address.label = label
    if address_line1 is not None:
        address.address_line1 = address_line1
    if address_line2 is not None:
        address.address_line2 = address_line2
    if city is not None:
        address.city = city
    if state is not None:
        address.state = state
    if postal_code is not None:
        address.postal_code = postal_code
    if country is not None:
        address.country = country
    if latitude is not None:
        address.latitude = latitude
    if longitude is not None:
        address.longitude = longitude
    if is_default is not None:
        address.is_default = is_default
    return await customer_address_repository.save(db, address)


async def delete_address(db: AsyncSession, *, customer_id: UUID, address_id: UUID) -> None:
    """Soft-delete an address, verifying ownership first."""
    address = await _get_owned_address(db, customer_id=customer_id, address_id=address_id)
    await customer_address_repository.soft_delete(db, address)