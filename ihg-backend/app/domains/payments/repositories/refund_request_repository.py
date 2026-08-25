"""Raw database queries for the refund_requests table. No business logic here."""
from typing import List, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.payments.models.refund_request import RefundRequest


async def get_by_id(db: AsyncSession, request_id: UUID) -> Optional[RefundRequest]:
    """Fetch a single refund request by id, excluding soft-deleted rows."""
    result = await db.execute(
        select(RefundRequest).where(RefundRequest.id == request_id, RefundRequest.is_deleted.is_(False))
    )
    return result.scalar_one_or_none()


async def get_pending_for_payment(db: AsyncSession, payment_id: UUID) -> Optional[RefundRequest]:
    """Fetch the current pending refund request for a payment, if one exists. Used
    to avoid creating a duplicate request while one is already awaiting review.
    """
    result = await db.execute(
        select(RefundRequest).where(
            RefundRequest.payment_id == payment_id,
            RefundRequest.status == "pending",
            RefundRequest.is_deleted.is_(False),
        )
    )
    return result.scalar_one_or_none()


async def list_all(db: AsyncSession, *, status: Optional[str] = None) -> List[RefundRequest]:
    """List refund requests, optionally filtered by status, most recent first."""
    stmt = select(RefundRequest).where(RefundRequest.is_deleted.is_(False))
    if status is not None:
        stmt = stmt.where(RefundRequest.status == status)
    stmt = stmt.order_by(RefundRequest.created_at.desc())
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def create(
    db: AsyncSession,
    *,
    payment_id: UUID,
    requested_by_staff_id: UUID,
    reason: Optional[str] = None,
    status: str = "pending",
) -> RefundRequest:
    """Insert a new refund request row."""
    request = RefundRequest(
        payment_id=payment_id,
        requested_by_staff_id=requested_by_staff_id,
        reason=reason,
        status=status,
    )
    db.add(request)
    await db.flush()
    await db.refresh(request)
    return request


async def save(db: AsyncSession, request: RefundRequest) -> RefundRequest:
    """Persist changes made to an already-fetched RefundRequest instance."""
    await db.flush()
    await db.refresh(request)
    return request