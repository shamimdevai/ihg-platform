"""Customer self-service profile endpoints."""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_current_customer, get_db
from app.domains.customers.models.customer import Customer
from app.domains.customers.schemas.customer import CustomerRead, CustomerUpdate
from app.domains.customers.services import customer_service
from app.shared_kernel.schemas.response_envelope import envelope

router = APIRouter(prefix="/customers/me", tags=["customer-profile"])


@router.get("")
async def get_my_profile(customer: Customer = Depends(get_current_customer)) -> dict:
    """Get the current customer's own profile."""
    return envelope(data=CustomerRead.model_validate(customer))


@router.put("")
async def update_my_profile(
    payload: CustomerUpdate,
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Update the current customer's own profile fields."""
    updated = await customer_service.update_profile(
        db,
        customer.id,
        first_name=payload.first_name,
        last_name=payload.last_name,
        phone=payload.phone,
    )
    return envelope(data=CustomerRead.model_validate(updated), message="Profile updated.")