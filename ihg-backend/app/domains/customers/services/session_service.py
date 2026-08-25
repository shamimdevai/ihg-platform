"""List/revoke customer sessions. Mirrors iam.services.session_service's pattern."""
from typing import List
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError, PermissionDeniedError
from app.domains.customers.models.customer_session import CustomerSession
from app.domains.customers.repositories import customer_session_repository


async def list_sessions(db: AsyncSession, customer_id: UUID) -> List[CustomerSession]:
    """List a customer's active sessions."""
    return await customer_session_repository.list_active_by_customer(db, customer_id)


async def revoke_session(db: AsyncSession, *, customer_id: UUID, session_id: UUID) -> None:
    """Revoke a single session, verifying it belongs to the requesting customer.

    Raises:
        NotFoundError: session does not exist.
        PermissionDeniedError: session belongs to a different customer.
    """
    sessions = await customer_session_repository.list_active_by_customer(db, customer_id)
    target = next((s for s in sessions if s.id == session_id), None)
    if target is None:
        raise NotFoundError("Session not found.")
    if target.customer_id != customer_id:
        raise PermissionDeniedError("Cannot revoke another customer's session.")
    await customer_session_repository.revoke(db, target)


async def revoke_all_sessions(db: AsyncSession, customer_id: UUID) -> int:
    """Revoke every active session for a customer. Returns the count revoked."""
    return await customer_session_repository.revoke_all_for_customer(db, customer_id)