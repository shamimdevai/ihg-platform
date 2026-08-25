"""Guest check-out."""
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_db, require_permission
from app.domains.hotel.schemas.booking import BookingRead
from app.domains.hotel.services import checkin_checkout_service
from app.shared_kernel.schemas.response_envelope import envelope

router = APIRouter(prefix="/hotel/checkout", tags=["hotel"])


@router.post("/{booking_id}", dependencies=[Depends(require_permission("hotel:booking:write"))])
async def check_out(booking_id: UUID, db: AsyncSession = Depends(get_db)) -> dict:
    """Checks out a guest. Does NOT itself generate the invoice — call
    POST /hotel/invoices/generate/{booking_id} (hotel:invoice:write) as an
    explicit next step.
    """
    booking = await checkin_checkout_service.check_out_booking(db, booking_id)
    return envelope(data=BookingRead.model_validate(booking), message="Guest checked out.")