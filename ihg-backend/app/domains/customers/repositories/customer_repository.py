"""Raw database queries for the customers table. No business logic here."""
from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.customers.models.customer import Customer


async def get_by_id(db: AsyncSession, customer_id: UUID) -> Optional[Customer]:
    """Fetch a customer by id, excluding soft-deleted rows."""
    result = await db.execute(
        select(Customer).where(Customer.id == customer_id, Customer.is_deleted.is_(False))
    )
    return result.scalar_one_or_none()


async def get_by_email(db: AsyncSession, email: str) -> Optional[Customer]:
    """Fetch a customer by email, excluding soft-deleted rows."""
    result = await db.execute(
        select(Customer).where(Customer.email == email, Customer.is_deleted.is_(False))
    )
    return result.scalar_one_or_none()


async def create(
    db: AsyncSession,
    *,
    email: str,
    password_hash: str,
    first_name: str,
    last_name: str,
    phone: Optional[str] = None,
) -> Customer:
    """Insert a new customer row (email_verified_at left NULL until verified)."""
    customer = Customer(
        email=email,
        password_hash=password_hash,
        first_name=first_name,
        last_name=last_name,
        phone=phone,
    )
    db.add(customer)
    await db.flush()
    await db.refresh(customer)
    return customer


async def save(db: AsyncSession, customer: Customer) -> Customer:
    """Persist changes made to an already-fetched Customer instance."""
    await db.flush()
    await db.refresh(customer)
    return customer