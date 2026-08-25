"""Hotel guest management — created by staff (reception) with NO login required
(PROJECT_STATE.md Part A). Optionally linked to a Customer account later.
"""
from typing import List, Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.domains.customers.models.hotel_guest import HotelGuest
from app.domains.customers.repositories import customer_repository, hotel_guest_repository


async def create_guest(
    db: AsyncSession,
    *,
    first_name: str,
    last_name: str,
    email: Optional[str] = None,
    phone: Optional[str] = None,
    identification_number: Optional[str] = None,
    nationality: Optional[str] = None,
    is_vip: bool = False,
    created_by_staff_id: Optional[UUID] = None,
) -> HotelGuest:
    """Create a walk-in hotel guest identity. No account or password required."""
    return await hotel_guest_repository.create(
        db,
        first_name=first_name,
        last_name=last_name,
        email=email,
        phone=phone,
        identification_number=identification_number,
        nationality=nationality,
        is_vip=is_vip,
        created_by_staff_id=created_by_staff_id,
    )


async def list_guests(db: AsyncSession) -> List[HotelGuest]:
    """List every hotel guest."""
    return await hotel_guest_repository.list_all(db)


async def get_guest(db: AsyncSession, guest_id: UUID) -> HotelGuest:
    """Fetch a single hotel guest by id.

    Raises:
        NotFoundError: no guest with that id exists.
    """
    guest = await hotel_guest_repository.get_by_id(db, guest_id)
    if guest is None:
        raise NotFoundError("Hotel guest not found.")
    return guest


async def update_guest(
    db: AsyncSession,
    guest_id: UUID,
    *,
    first_name: Optional[str] = None,
    last_name: Optional[str] = None,
    email: Optional[str] = None,
    phone: Optional[str] = None,
    identification_number: Optional[str] = None,
    nationality: Optional[str] = None,
    is_vip: Optional[bool] = None,
) -> HotelGuest:
    """Update a hotel guest's editable fields."""
    guest = await get_guest(db, guest_id)
    if first_name is not None:
        guest.first_name = first_name
    if last_name is not None:
        guest.last_name = last_name
    if email is not None:
        guest.email = email
    if phone is not None:
        guest.phone = phone
    if identification_number is not None:
        guest.identification_number = identification_number
    if nationality is not None:
        guest.nationality = nationality
    if is_vip is not None:
        guest.is_vip = is_vip
    return await hotel_guest_repository.save(db, guest)


async def link_to_customer(db: AsyncSession, *, guest_id: UUID, customer_id: UUID) -> HotelGuest:
    """Link a hotel guest identity to an existing Customer account, enabling the guest
    to use restaurant/delivery self-service under the same login.

    Raises:
        NotFoundError: guest or customer does not exist.
    """
    guest = await get_guest(db, guest_id)
    customer = await customer_repository.get_by_id(db, customer_id)
    if customer is None:
        raise NotFoundError("Customer account not found.")
    guest.customer_id = customer.id
    return await hotel_guest_repository.save(db, guest)