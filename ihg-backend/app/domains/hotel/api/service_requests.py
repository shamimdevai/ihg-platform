"""In-room service request management."""
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_db, require_permission
from app.domains.hotel.schemas.service_request import (
    ServiceRequestAssignRequest,
    ServiceRequestCreate,
    ServiceRequestRead,
    ServiceRequestStatusUpdate,
)
from app.domains.hotel.services import service_request_service
from app.shared_kernel.schemas.response_envelope import envelope

router = APIRouter(prefix="/hotel/service-requests", tags=["hotel"])


@router.post("", dependencies=[Depends(require_permission("hotel:service_request:write"))])
async def create_request(payload: ServiceRequestCreate, db: AsyncSession = Depends(get_db)) -> dict:
    req = await service_request_service.create_request(db, **payload.model_dump())
    return envelope(data=ServiceRequestRead.model_validate(req), message="Service request created.")


@router.get("", dependencies=[Depends(require_permission("hotel:service_request:read"))])
async def list_requests(
    booking_id: Optional[UUID] = None, status: Optional[str] = None, db: AsyncSession = Depends(get_db)
) -> dict:
    requests = await service_request_service.list_requests(db, booking_id=booking_id, status=status)
    return envelope(data=[ServiceRequestRead.model_validate(r) for r in requests])


@router.get("/{request_id}", dependencies=[Depends(require_permission("hotel:service_request:read"))])
async def get_request(request_id: UUID, db: AsyncSession = Depends(get_db)) -> dict:
    req = await service_request_service.get_request(db, request_id)
    return envelope(data=ServiceRequestRead.model_validate(req))


@router.put("/{request_id}/assign", dependencies=[Depends(require_permission("hotel:service_request:write"))])
async def assign_request(request_id: UUID, payload: ServiceRequestAssignRequest, db: AsyncSession = Depends(get_db)) -> dict:
    req = await service_request_service.assign_request(db, request_id, payload.assigned_to_staff_id)
    return envelope(data=ServiceRequestRead.model_validate(req), message="Request assigned.")


@router.put("/{request_id}/status", dependencies=[Depends(require_permission("hotel:service_request:write"))])
async def update_request_status(request_id: UUID, payload: ServiceRequestStatusUpdate, db: AsyncSession = Depends(get_db)) -> dict:
    req = await service_request_service.update_request_status(db, request_id, payload.status)
    return envelope(data=ServiceRequestRead.model_validate(req), message="Request status updated.")