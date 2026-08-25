"""Admin/Finance review endpoints for the refund request & approval workflow
(dual-refund architecture path B — see app/domains/payments/api/payments.py for
path A, direct refunds, and for where requests are created).

Deliberately mounted under /admin/refund-requests rather than /payments/... —
this is an intentional URL-namespace deviation from the payments domain's usual
/payments prefix, matching the endpoint shape requested for Phase 6.5. The code
still lives in app/domains/payments/ since the business logic
(refund_request_service) belongs to the payments domain.
"""
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_current_staff_user, get_db, require_permission
from app.domains.iam.models.staff_user import StaffUser
from app.domains.payments.schemas.refund_request import (
    RefundRequestApprove,
    RefundRequestReject,
    RefundRequestRead,
)
from app.domains.payments.services import refund_request_service
from app.shared_kernel.schemas.response_envelope import envelope

router = APIRouter(prefix="/admin/refund-requests", tags=["payments-refund-admin"])


@router.get("", dependencies=[Depends(require_permission("payments:refund:review"))])
async def list_refund_requests(status: Optional[str] = None, db: AsyncSession = Depends(get_db)) -> dict:
    """List refund requests, optionally filtered by status ('pending', 'approved',
    or 'rejected'). Defaults to showing every status if no filter is given —
    pass ?status=pending to see only requests awaiting review.
    """
    requests = await refund_request_service.list_refund_requests(db, status=status)
    return envelope(data=[RefundRequestRead.model_validate(r) for r in requests])


@router.post(
    "/{request_id}/approve", dependencies=[Depends(require_permission("payments:refund:review"))]
)
async def approve_refund_request(
    request_id: UUID,
    payload: RefundRequestApprove,
    staff: StaffUser = Depends(get_current_staff_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Approve a pending refund request. Triggers the actual gateway refund via
    payment_service.refund_payment() (the same function used by the direct-refund
    path), so the underlying Payment transitions the same way either path.
    """
    request = await refund_request_service.approve_refund_request(
        db, request_id, reviewed_by_staff_id=staff.id, review_reason=payload.review_reason
    )
    return envelope(data=RefundRequestRead.model_validate(request), message="Refund request approved.")


@router.post("/{request_id}/reject", dependencies=[Depends(require_permission("payments:refund:review"))])
async def reject_refund_request(
    request_id: UUID,
    payload: RefundRequestReject,
    staff: StaffUser = Depends(get_current_staff_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Reject a pending refund request with a required reason. Does not touch the
    underlying payment.
    """
    request = await refund_request_service.reject_refund_request(
        db, request_id, reviewed_by_staff_id=staff.id, reason=payload.reason
    )
    return envelope(data=RefundRequestRead.model_validate(request), message="Refund request rejected.")