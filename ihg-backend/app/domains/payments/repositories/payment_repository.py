"""Raw database queries for the payments table. No business logic here."""
from typing import List, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.payments.models.payment import Payment


async def get_by_id(db: AsyncSession, payment_id: UUID) -> Optional[Payment]:
    """Fetch a single payment by id, excluding soft-deleted rows."""
    result = await db.execute(
        select(Payment).where(Payment.id == payment_id, Payment.is_deleted.is_(False))
    )
    return result.scalar_one_or_none()


async def list_all(
    db: AsyncSession,
    *,
    reference_type: Optional[str] = None,
    reference_id: Optional[UUID] = None,
) -> List[Payment]:
    """List payments, optionally filtered by reference_type and/or reference_id,
    most recent first.
    """
    stmt = select(Payment).where(Payment.is_deleted.is_(False))
    if reference_type is not None:
        stmt = stmt.where(Payment.reference_type == reference_type)
    if reference_id is not None:
        stmt = stmt.where(Payment.reference_id == reference_id)
    stmt = stmt.order_by(Payment.created_at.desc())
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def create(
    db: AsyncSession,
    *,
    reference_type: str,
    reference_id: UUID,
    amount: float,
    currency: str,
    method_id: Optional[UUID] = None,
    status: str = "pending",
) -> Payment:
    """Insert a new payment row."""
    payment = Payment(
        reference_type=reference_type,
        reference_id=reference_id,
        amount=amount,
        currency=currency,
        method_id=method_id,
        status=status,
    )
    db.add(payment)
    await db.flush()
    await db.refresh(payment)
    return payment


async def save(db: AsyncSession, payment: Payment) -> Payment:
    """Persist changes made to an already-fetched Payment instance."""
    await db.flush()
    await db.refresh(payment)
    return payment