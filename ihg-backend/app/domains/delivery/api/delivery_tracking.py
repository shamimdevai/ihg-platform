"""Delivery order status progression: staff-driven confirm/preparing/ready
transitions (delivery:order:write) plus rider-driven pickup/delivered
transitions (delivery:order:update_status — a narrower permission than full
delivery:order:write, since a Rider should be able to progress their OWN
assigned deliveries without also being able to confirm/cancel/manage every
order in the system; ownership is enforced in
delivery_tracking_service._get_active_assignment_for_rider(), not just by the
permission code). Also exposes a lightweight customer-facing tracking
endpoint (ownership-checked, no staff permission).
"""
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_current_customer, get_current_staff_user, get_db, require_permission
from app.domains.customers.models.customer import Customer
from app.domains.delivery.schemas.delivery_order import DeliveryOrderRead
from app.domains.delivery.services import delivery_tracking_service
from app.domains.iam.models.staff_user import StaffUser
from app.shared_kernel.schemas.response_envelope import envelope

router = APIRouter(prefix="/delivery/tracking", tags=["delivery"])


@router.post("/{order_id}/confirm", dependencies=[Depends(require_permission("delivery:order:write"))])
async def confirm_order(order_id: UUID, db: AsyncSession = Depends(get_db)) -> dict:
    order = await delivery_tracking_service.confirm_order(db, order_id)
    return envelope(data=DeliveryOrderRead.model_validate(order), message="Order confirmed.")


@router.post("/{order_id}/preparing", dependencies=[Depends(require_permission("delivery:order:write"))])
async def mark_preparing(order_id: UUID, db: AsyncSession = Depends(get_db)) -> dict:
    order = await delivery_tracking_service.mark_preparing(db, order_id)
    return envelope(data=DeliveryOrderRead.model_validate(order), message="Order marked as preparing.")


@router.post("/{order_id}/ready", dependencies=[Depends(require_permission("delivery:order:write"))])
async def mark_ready(order_id: UUID, db: AsyncSession = Depends(get_db)) -> dict:
    order = await delivery_tracking_service.mark_ready(db, order_id)
    return envelope(data=DeliveryOrderRead.model_validate(order), message="Order marked ready for pickup.")


@router.post("/{order_id}/pickup", dependencies=[Depends(require_permission("delivery:order:update_status"))])
async def mark_picked_up(
    order_id: UUID,
    staff: StaffUser = Depends(get_current_staff_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Rider marks a delivery as picked up. Ownership-enforced in the service
    layer — only the rider actually holding the active assignment for this
    order may call this successfully.
    """
    order = await delivery_tracking_service.mark_picked_up(db, order_id, rider_staff_id=staff.id)
    return envelope(data=DeliveryOrderRead.model_validate(order), message="Order picked up; out for delivery.")


@router.post("/{order_id}/deliver", dependencies=[Depends(require_permission("delivery:order:update_status"))])
async def mark_delivered(
    order_id: UUID,
    staff: StaffUser = Depends(get_current_staff_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Rider marks a delivery as delivered. Same ownership enforcement as
    mark_picked_up above.
    """
    order = await delivery_tracking_service.mark_delivered(db, order_id, rider_staff_id=staff.id)
    return envelope(data=DeliveryOrderRead.model_validate(order), message="Order delivered.")


@router.get("/{order_id}/status")
async def get_my_order_status(
    order_id: UUID,
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Customer-facing tracking view — no staff permission, ownership-checked
    against the current customer instead (mirrors
    customers.api.addresses.py's self-service ownership pattern).
    """
    order = await delivery_tracking_service.get_status_for_customer(
        db, customer_id=customer.id, order_id=order_id
    )
    return envelope(data=DeliveryOrderRead.model_validate(order))