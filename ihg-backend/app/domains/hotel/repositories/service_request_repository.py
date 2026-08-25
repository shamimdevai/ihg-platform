"""Raw database queries for the service_requests table."""
from typing import List, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.hotel.models.service_request import ServiceRequest


async def get_by_id(db: AsyncSession, request_id: UUID) -> Optional[ServiceRequest]:
    result = await db.execute(
        select(ServiceRequest).where(ServiceRequest.id == request_id, ServiceRequest.is_deleted.is_(False))
    )
    return result.scalar_one_or_none()


async def list_all(
    db: AsyncSession, *, booking_id: Optional[UUID] = None, status: Optional[str] = None
) -> List[ServiceRequest]:
    stmt = select(ServiceRequest).where(ServiceRequest.is_deleted.is_(False))
    if booking_id is not None:
        stmt = stmt.where(ServiceRequest.booking_id == booking_id)
    if status is not None:
        stmt = stmt.where(ServiceRequest.status == status)
    stmt = stmt.order_by(ServiceRequest.created_at.desc())
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def create(db: AsyncSession, **kwargs) -> ServiceRequest:
    req = ServiceRequest(**kwargs)
    db.add(req)
    await db.flush()
    await db.refresh(req)
    return req


async def save(db: AsyncSession, req: ServiceRequest) -> ServiceRequest:
    await db.flush()
    await db.refresh(req)
    return req