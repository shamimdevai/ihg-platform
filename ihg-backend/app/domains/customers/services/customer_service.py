"""Business logic for a customer's own profile (self-service, not staff-facing)."""
from typing import Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.domains.customers.models.customer import Customer
from app.domains.customers.repositories import customer_repository


async def get_customer(db: AsyncSession, customer_id: UUID) -> Customer:
    """Fetch a single customer by id.

    Raises:
        NotFoundError: no customer with that id exists.
    """
    customer = await customer_repository.get_by_id(db, customer_id)
    if customer is None:
        raise NotFoundError("Customer account not found.")
    return customer


async def update_profile(
    db: AsyncSession,
    customer_id: UUID,
    *,
    first_name: Optional[str] = None,
    last_name: Optional[str] = None,
    phone: Optional[str] = None,
) -> Customer:
    """Update a customer's editable self-service profile fields."""
    customer = await get_customer(db, customer_id)
    if first_name is not None:
        customer.first_name = first_name
    if last_name is not None:
        customer.last_name = last_name
    if phone is not None:
        customer.phone = phone
    return await customer_repository.save(db, customer)