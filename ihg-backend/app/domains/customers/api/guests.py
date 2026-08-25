"""Staff-facing hotel guest management. Protected by require_permission — guests
themselves never authenticate to use these endpoints.
"""
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_current_staff_user, get_db, require_permission
from app.domains.iam.models.staff_user import StaffUser
from app.domains.customers.schemas.hotel_guest import HotelGuestCreate, HotelGuestRead, HotelGuestUpdate
from app.domains.customers.services import guest_service
from app.shared_kernel.schemas.response_envelope import envelope

router = APIRouter(prefix="/customers/guests", tags=["hotel-guests"])


@router.get("", dependencies=[Depends(require_permission("customers:guests:read"))])
async def list_guests(db: AsyncSession = Depends(get_db)) -> dict:
    """List every hotel guest."""
    guests = await guest_service.list_guests(db)
    return envelope(data=[HotelGuestRead.model_validate(g) for g in guests])


@router.get("/{guest_id}", dependencies=[Depends(require_permission("customers:guests:read"))])
async def get_guest(guest_id: UUID, db: AsyncSession = Depends(get_db)) -> dict:
    """Get a single hotel guest by id."""
    guest = await guest_service.get_guest(db, guest_id)
    return envelope(data=HotelGuestRead.model_validate(guest))


@router.post("", dependencies=[Depends(require_permission("customers:guests:write"))])
async def create_guest(
    payload: HotelGuestCreate,
    staff: StaffUser = Depends(get_current_staff_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Create a walk-in hotel guest — no account or password required for the guest."""
    guest = await guest_service.create_guest(db, **payload.model_dump(), created_by_staff_id=staff.id)
    return envelope(data=HotelGuestRead.model_validate(guest), message="Guest created.")


@router.put("/{guest_id}", dependencies=[Depends(require_permission("customers:guests:write"))])
async def update_guest(guest_id: UUID, payload: HotelGuestUpdate, db: AsyncSession = Depends(get_db)) -> dict:
    """Update a hotel guest's editable fields."""
    guest = await guest_service.update_guest(db, guest_id, **payload.model_dump(exclude_unset=True))
    return envelope(data=HotelGuestRead.model_validate(guest), message="Guest updated.")


@router.post(
    "/{guest_id}/link-customer/{customer_id}",
    dependencies=[Depends(require_permission("customers:guests:write"))],
)
async def link_guest_to_customer(guest_id: UUID, customer_id: UUID, db: AsyncSession = Depends(get_db)) -> dict:
    """Link a hotel guest identity to an existing customer account."""
    guest = await guest_service.link_to_customer(db, guest_id=guest_id, customer_id=customer_id)
    return envelope(data=HotelGuestRead.model_validate(guest), message="Guest linked to customer account.")