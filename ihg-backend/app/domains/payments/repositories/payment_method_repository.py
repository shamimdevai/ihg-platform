"""Raw database queries for the payment_methods table. No business logic here."""
from typing import List, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.payments.models.payment_method import PaymentMethod


async def get_by_id(db: AsyncSession, method_id: UUID) -> Optional[PaymentMethod]:
    """Fetch a single payment method by id, excluding soft-deleted rows."""
    result = await db.execute(
        select(PaymentMethod).where(PaymentMethod.id == method_id, PaymentMethod.is_deleted.is_(False))
    )
    return result.scalar_one_or_none()


async def list_all(db: AsyncSession) -> List[PaymentMethod]:
    """List every non-soft-deleted payment method."""
    result = await db.execute(select(PaymentMethod).where(PaymentMethod.is_deleted.is_(False)))
    return list(result.scalars().all())


async def create(
    db: AsyncSession, *, type: str, label: Optional[str] = None, is_active: bool = True
) -> PaymentMethod:
    """Insert a new payment method row."""
    method = PaymentMethod(type=type, label=label, is_active=is_active)
    db.add(method)
    await db.flush()
    await db.refresh(method)
    return method


async def save(db: AsyncSession, method: PaymentMethod) -> PaymentMethod:
    """Persist changes made to an already-fetched PaymentMethod instance."""
    await db.flush()
    await db.refresh(method)
    return method


async def soft_delete(db: AsyncSession, method: PaymentMethod, *, deleted_by_staff_id: UUID) -> None:
    """Soft-delete a payment method. Never hard-delete business records."""
    from datetime import datetime, timezone

    method.is_deleted = True
    method.deleted_at = datetime.now(timezone.utc)
    method.deleted_by_staff_id = deleted_by_staff_id
    await db.flush()