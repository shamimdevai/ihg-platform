"""Business logic for the refund request & approval workflow (Phase 6.5, dual-refund
architecture path B). Approval internally calls payment_service.refund_payment() —
the SAME entry point used by the direct-refund path — so there is exactly one
function anywhere in the codebase that actually transitions a Payment to
"refunded".
"""
from typing import List, Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError
from app.domains.payments.models.refund_request import RefundRequest
from app.domains.payments.repositories import refund_request_repository
from app.domains.payments.services import payment_service


async def create_refund_request(
    db: AsyncSession,
    payment_id: UUID,
    *,
    requested_by_staff_id: UUID,
    reason: Optional[str] = None,
) -> RefundRequest:
    """Create a new refund request for a payment, for staff who don't hold
    payments:refund:direct.

    Args:
        db: active async session.
        payment_id: the payment being requested for refund. Must currently be "paid".
        requested_by_staff_id: the staff member filing the request.
        reason: optional human-readable reason for the request.

    Returns:
        The newly created RefundRequest, in "pending" status.

    Raises:
        NotFoundError: no payment with that id exists.
        ConflictError: the payment is not currently "paid", or a pending refund
            request already exists for it (avoids duplicate/competing requests).
    """
    payment = await payment_service.get_payment(db, payment_id)
    if payment.status != "paid":
        raise ConflictError(
            f"Cannot request a refund for a payment in '{payment.status}' status; must be 'paid'."
        )

    existing_pending = await refund_request_repository.get_pending_for_payment(db, payment_id)
    if existing_pending is not None:
        raise ConflictError("A pending refund request already exists for this payment.")

    return await refund_request_repository.create(
        db, payment_id=payment_id, requested_by_staff_id=requested_by_staff_id, reason=reason
    )


async def list_refund_requests(db: AsyncSession, *, status: Optional[str] = None) -> List[RefundRequest]:
    """List refund requests, optionally filtered by status ('pending'/'approved'/'rejected')."""
    return await refund_request_repository.list_all(db, status=status)


async def get_refund_request(db: AsyncSession, request_id: UUID) -> RefundRequest:
    """Fetch a single refund request by id.

    Raises:
        NotFoundError: no refund request with that id exists.
    """
    request = await refund_request_repository.get_by_id(db, request_id)
    if request is None:
        raise NotFoundError("Refund request not found.")
    return request


async def approve_refund_request(
    db: AsyncSession,
    request_id: UUID,
    *,
    reviewed_by_staff_id: UUID,
    review_reason: Optional[str] = None,
) -> RefundRequest:
    """Approve a pending refund request, triggering the actual gateway refund via
    payment_service.refund_payment().

    Args:
        db: active async session.
        request_id: the refund request to approve. Must currently be "pending".
        reviewed_by_staff_id: the staff member approving the request.
        review_reason: optional note recorded on the request (not required, unlike
            reject_refund_request's reason).

    Returns:
        The updated RefundRequest, now "approved".

    Raises:
        NotFoundError: no refund request with that id exists.
        ConflictError: the request is not currently "pending", or the underlying
            payment is no longer "paid" (e.g. it was refunded directly, or another
            request for it was approved first, since the time this request was filed).
    """
    from datetime import datetime, timezone

    request = await get_refund_request(db, request_id)
    if request.status != "pending":
        raise ConflictError(f"Cannot approve a refund request in '{request.status}' status.")

    # Re-check the payment's current state — it may have changed since this
    # request was filed (e.g. refunded directly by someone with
    # payments:refund:direct). refund_payment() itself also enforces this, but
    # checking here first gives a clearer error message tied to the request.
    payment = await payment_service.get_payment(db, request.payment_id)
    if payment.status != "paid":
        raise ConflictError(
            f"Cannot approve this refund request: the underlying payment is now "
            f"'{payment.status}', not 'paid'."
        )

    await payment_service.refund_payment(
        db, request.payment_id, reason=review_reason or "Refund request approved."
    )

    request.status = "approved"
    request.reviewed_by_staff_id = reviewed_by_staff_id
    request.review_reason = review_reason
    request.reviewed_at = datetime.now(timezone.utc)
    return await refund_request_repository.save(db, request)


async def reject_refund_request(
    db: AsyncSession,
    request_id: UUID,
    *,
    reviewed_by_staff_id: UUID,
    reason: str,
) -> RefundRequest:
    """Reject a pending refund request. Does not touch the underlying payment.

    Args:
        db: active async session.
        request_id: the refund request to reject. Must currently be "pending".
        reviewed_by_staff_id: the staff member rejecting the request.
        reason: required human-readable rejection reason.

    Returns:
        The updated RefundRequest, now "rejected".

    Raises:
        NotFoundError: no refund request with that id exists.
        ConflictError: the request is not currently "pending".
    """
    from datetime import datetime, timezone

    request = await get_refund_request(db, request_id)
    if request.status != "pending":
        raise ConflictError(f"Cannot reject a refund request in '{request.status}' status.")

    request.status = "rejected"
    request.reviewed_by_staff_id = reviewed_by_staff_id
    request.review_reason = reason
    request.reviewed_at = datetime.now(timezone.utc)
    return await refund_request_repository.save(db, request)