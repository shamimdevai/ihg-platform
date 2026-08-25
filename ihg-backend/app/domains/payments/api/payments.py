"""Staff-facing payment intent creation, mock confirmation, direct refunds, refund
requests, payment history, payment method management, and the simulated gateway
webhook.

Idempotency: every mutating POST endpoint here (/intents, /methods, /{id}/confirm,
/{id}/refund, /{id}/refund-requests, /webhook) is automatically covered by
shared_kernel.middlewares.idempotency_middleware (mounted globally in app/main.py) —
no route-level code is needed. A client that retries one of these requests with the
same `Idempotency-Key` header gets back the original cached response instead of the
handler re-executing (see app/shared_kernel/middlewares/idempotency_middleware.py).
This applies equally to /webhook, since real gateways commonly retry webhook
deliveries.

Dual-refund architecture (Phase 6.5):
  A. Direct refund — POST /{payment_id}/refund, gated by payments:refund:direct.
     Immediately calls payment_service.refund_payment(), no approval step.
  B. Request & approval — POST /{payment_id}/refund-requests (payments:refund:request)
     creates a pending RefundRequest; the review endpoints live in a separate
     router, admin_refund_requests.py, gated by payments:refund:review.
"""
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Header

from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_current_staff_user, get_db, require_permission
from app.core.config import settings
from app.core.exceptions import UnauthorizedError
from app.domains.iam.models.staff_user import StaffUser
from app.domains.payments.schemas.payment import (
    PaymentConfirmRequest,
    PaymentCreateRequest,
    PaymentRead,
    PaymentRefundRequest,
)
from app.domains.payments.schemas.payment_method import PaymentMethodCreate, PaymentMethodRead
from app.domains.payments.schemas.refund_request import RefundRequestCreate, RefundRequestRead
from app.domains.payments.schemas.webhook import WebhookEventRequest
from app.domains.payments.services import payment_service, refund_request_service
from app.shared_kernel.schemas.response_envelope import envelope

router = APIRouter(prefix="/payments", tags=["payments"])


@router.post("/intents", dependencies=[Depends(require_permission("payments:write"))])
async def create_payment_intent(payload: PaymentCreateRequest, db: AsyncSession = Depends(get_db)) -> dict:
    """Create a new pending payment against an arbitrary reference_type/reference_id."""
    payment = await payment_service.create_payment_intent(db, **payload.model_dump())
    return envelope(data=PaymentRead.model_validate(payment), message="Payment intent created.")


@router.get("", dependencies=[Depends(require_permission("payments:read"))])
async def list_payments(
    reference_type: Optional[str] = None,
    reference_id: Optional[UUID] = None,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """List payment history, optionally filtered by reference_type/reference_id."""
    payments = await payment_service.list_payments(
        db, reference_type=reference_type, reference_id=reference_id
    )
    return envelope(data=[PaymentRead.model_validate(p) for p in payments])


# --- Payment methods (static paths — MUST be registered before /{payment_id} below,
# otherwise FastAPI would try to parse "methods"/"webhook" as a payment_id UUID
# path parameter and these routes would never be reached) --------------------------


@router.get("/methods", dependencies=[Depends(require_permission("payments:method:read"))])
async def list_payment_methods(db: AsyncSession = Depends(get_db)) -> dict:
    """List every payment method."""
    methods = await payment_service.list_payment_methods(db)
    return envelope(data=[PaymentMethodRead.model_validate(m) for m in methods])


@router.post("/methods", dependencies=[Depends(require_permission("payments:method:write"))])
async def create_payment_method(payload: PaymentMethodCreate, db: AsyncSession = Depends(get_db)) -> dict:
    """Create a new (demo/test-mode) payment method."""
    method = await payment_service.create_payment_method(db, **payload.model_dump())
    return envelope(data=PaymentMethodRead.model_validate(method), message="Payment method created.")


@router.get("/methods/{method_id}", dependencies=[Depends(require_permission("payments:method:read"))])
async def get_payment_method(method_id: UUID, db: AsyncSession = Depends(get_db)) -> dict:
    """Get a single payment method by id."""
    method = await payment_service.get_payment_method(db, method_id)
    return envelope(data=PaymentMethodRead.model_validate(method))


@router.delete("/methods/{method_id}", dependencies=[Depends(require_permission("payments:method:write"))])
async def delete_payment_method(
    method_id: UUID,
    staff: StaffUser = Depends(get_current_staff_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Delete (soft) a saved payment method."""
    await payment_service.delete_payment_method(db, method_id, deleted_by_staff_id=staff.id)
    return envelope(message="Payment method deleted.")


# --- Simulated gateway webhook (public — no staff/customer auth; authenticated by
# a shared-secret header instead, since a real gateway callback carries no user
# session) ---------------------------------------------------------------------------


@router.post("/webhook")
async def handle_webhook(
    payload: WebhookEventRequest,
    db: AsyncSession = Depends(get_db),
    x_webhook_signature: Optional[str] = Header(default=None),
) -> dict:
    """Handle a simulated asynchronous gateway callback (bKash/SSLCommerz/Stripe-
    shaped, but NOT a real integration — see schemas/webhook.py). Authenticated by
    comparing the `X-Webhook-Signature` header against the configured
    PAYMENTS_WEBHOOK_SECRET, standing in for a real provider's signature scheme
    until a specific gateway is actually integrated.

    Raises:
        UnauthorizedError (401): signature header missing or incorrect.
    """
    import hmac

    if x_webhook_signature is None or not hmac.compare_digest(
        x_webhook_signature, settings.PAYMENTS_WEBHOOK_SECRET
    ):
        raise UnauthorizedError("Invalid or missing webhook signature.")

    payment = await payment_service.process_webhook_event(
        db,
        event_type=payload.event_type,
        payment_id=payload.payment_id,
        failure_reason=payload.failure_reason,
        refund_reason=payload.refund_reason,
    )
    return envelope(data=PaymentRead.model_validate(payment), message="Webhook event processed.")


# --- Individual payment lookups and lifecycle actions --------------------------------


@router.get("/{payment_id}", dependencies=[Depends(require_permission("payments:read"))])
async def get_payment(payment_id: UUID, db: AsyncSession = Depends(get_db)) -> dict:
    """Get a single payment by id."""
    payment = await payment_service.get_payment(db, payment_id)
    return envelope(data=PaymentRead.model_validate(payment))


@router.post("/{payment_id}/confirm", dependencies=[Depends(require_permission("payments:write"))])
async def confirm_payment(
    payment_id: UUID, payload: PaymentConfirmRequest, db: AsyncSession = Depends(get_db)
) -> dict:
    """Confirm a pending payment against the simulated gateway (mock)."""
    payment = await payment_service.confirm_payment(db, payment_id, **payload.model_dump())
    return envelope(data=PaymentRead.model_validate(payment), message="Payment confirmed.")


@router.post("/{payment_id}/refund", dependencies=[Depends(require_permission("payments:refund:direct"))])
async def refund_payment(
    payment_id: UUID, payload: PaymentRefundRequest, db: AsyncSession = Depends(get_db)
) -> dict:
    """Directly refund a paid payment — no approval step. Restricted to staff
    holding payments:refund:direct (dual-refund architecture path A). Staff without
    this permission should use POST /{payment_id}/refund-requests instead.
    """
    payment = await payment_service.refund_payment(db, payment_id, reason=payload.reason)
    return envelope(data=PaymentRead.model_validate(payment), message="Payment refunded.")


@router.post(
    "/{payment_id}/refund-requests", dependencies=[Depends(require_permission("payments:refund:request"))]
)
async def create_refund_request(
    payment_id: UUID,
    payload: RefundRequestCreate,
    staff: StaffUser = Depends(get_current_staff_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Request a refund for review (dual-refund architecture path B) — for staff
    who don't hold payments:refund:direct. Creates a "pending" RefundRequest; see
    admin_refund_requests.py for the approve/reject endpoints.
    """
    request = await refund_request_service.create_refund_request(
        db, payment_id, requested_by_staff_id=staff.id, reason=payload.reason
    )
    return envelope(data=RefundRequestRead.model_validate(request), message="Refund request created.")