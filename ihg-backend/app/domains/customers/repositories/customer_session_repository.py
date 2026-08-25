"""Raw database queries for the customer_sessions table. No business logic here."""
from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.customers.models.customer_session import CustomerSession


async def create(
    db: AsyncSession,
    *,
    customer_id: UUID,
    refresh_token_hash: str,
    expires_at: datetime,
    device_info: Optional[str] = None,
) -> CustomerSession:
    """Insert a new customer session row."""
    session = CustomerSession(
        customer_id=customer_id,
        refresh_token_hash=refresh_token_hash,
        device_info=device_info,
        expires_at=expires_at,
    )
    db.add(session)
    await db.flush()
    await db.refresh(session)
    return session


async def get_by_token_hash(db: AsyncSession, refresh_token_hash: str) -> Optional[CustomerSession]:
    """Look up a session by its refresh token hash."""
    result = await db.execute(
        select(CustomerSession).where(
            CustomerSession.refresh_token_hash == refresh_token_hash, CustomerSession.is_deleted.is_(False)
        )
    )
    return result.scalar_one_or_none()


async def list_active_by_customer(db: AsyncSession, customer_id: UUID) -> List[CustomerSession]:
    """List a customer's currently active (non-revoked, non-expired) sessions."""
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(CustomerSession).where(
            CustomerSession.customer_id == customer_id,
            CustomerSession.is_deleted.is_(False),
            CustomerSession.revoked_at.is_(None),
            CustomerSession.expires_at > now,
        )
    )
    return list(result.scalars().all())


async def revoke(db: AsyncSession, session: CustomerSession) -> CustomerSession:
    """Mark a single session as revoked."""
    session.revoked_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(session)
    return session


async def revoke_all_for_customer(db: AsyncSession, customer_id: UUID) -> int:
    """Revoke every active session for a customer. Returns the count revoked."""
    active = await list_active_by_customer(db, customer_id)
    for session in active:
        session.revoked_at = datetime.now(timezone.utc)
    await db.flush()
    return len(active)