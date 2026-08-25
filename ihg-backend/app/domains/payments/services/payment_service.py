"""Business logic for the simulated payment gateway. `create_payment_intent()`,
`confirm_payment()`, and `refund_payment()` are the entry points hotel (Phase 7) and
restaurant/delivery (Phases 8-9) billing services will call — never touch
payments.repositories or payments.models directly, per the cross-domain
service-only rule.

State machine: pending -> paid | failed (via confirm_payment); paid -> refunded
(via refund_payment). No other transitions are permitted.
"""
from typing import List, Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.company_config import get_company_config
from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.domains.payments.models.payment import Payment
from app.domains.payments.models.payment_method import PaymentMethod
from app.domains.payments.repositories import payment_method_repository, payment_repository

_VALID_CONFIRM_OUTCOMES = {"paid", "failed"}

# --- Payment methods -----------------------------------------------------------------


async def create_payment_method(
    db: AsyncSession, *, type: str, label: Optional[str] = None, is_active: bool = True
) -> PaymentMethod:
    """Create a new (demo/test-mode) payment method."""
    return await payment_method_repository.create(db, type=type, label=label, is_active=is_active)


async def list_payment_methods(db: AsyncSession) -> List[PaymentMethod]:
    """List every payment method."""
    return await payment_method_repository.list_all(db)


async def get_payment_method(db: AsyncSession, method_id: UUID) -> PaymentMethod:
    """Fetch a single payment method by id.

    Raises:
        NotFoundError: no payment method with that id exists.
    """
    method = await payment_method_repository.get_by_id(db, method_id)
    if method is None:
        raise NotFoundError("Payment method not found.")
    return method


async def delete_payment_method(db: AsyncSession, method_id: UUID, *, deleted_by_staff_id: UUID) -> None:
    """Soft-delete a payment method."""
    method = await get_payment_method(db, method_id)
    await payment_method_repository.soft_delete(db, method, deleted_by_staff_id=deleted_by_staff_id)


# --- Payment state machine ------------------------------------------------------------


async def create_payment_intent(
    db: AsyncSession,
    *,
    reference_type: str,
    reference_id: UUID,
    amount: float,
    currency: Optional[str] = None,
    method_id: Optional[UUID] = None,
) -> Payment:
    """Create a new payment in "pending" status against an arbitrary reference.

    THE entry point for starting a payment — every domain that needs to charge for
    something (hotel invoices in Phase 7; restaurant/delivery billing in Phases
    8-9) MUST call this rather than touching payments.repositories or
    payments.models directly, per the cross-domain service-only rule
    (PROJECT_STATE.md §3 rule 4 / Global Context Rule 3).

    `reference_type` / `reference_id` loosely identify what's being paid for (e.g.
    a future hotel booking or restaurant order) — never a hard FK, mirroring
    PROJECT_STATE.md §3 rule 9. `currency` defaults to the deployment's configured
    currency (config/company.yaml) when omitted.

    Args:
        db: active async session.
        reference_type: the domain/kind of the record being paid for.
        reference_id: the id of the record being paid for.
        amount: the payment amount. Must be strictly positive.
        currency: ISO 4217 currency code; defaults to company_config.currency.
        method_id: optional payment method to associate immediately. Can also be
            supplied later, at confirm_payment() time.

    Returns:
        The newly created Payment, in "pending" status.

    Raises:
        ValidationError: amount is not positive.
        NotFoundError: method_id was given but no such payment method exists.
    """
    if amount <= 0:
        raise ValidationError("Payment amount must be greater than zero.")

    if method_id is not None:
        await get_payment_method(db, method_id)  # raises NotFoundError if missing

    resolved_currency = currency or get_company_config().currency

    return await payment_repository.create(
        db,
        reference_type=reference_type,
        reference_id=reference_id,
        amount=amount,
        currency=resolved_currency,
        method_id=method_id,
        status="pending",
    )


async def get_payment(db: AsyncSession, payment_id: UUID) -> Payment:
    """Fetch a single payment by id.

    Raises:
        NotFoundError: no payment with that id exists.
    """
    payment = await payment_repository.get_by_id(db, payment_id)
    if payment is None:
        raise NotFoundError("Payment not found.")
    return payment


async def list_payments(
    db: AsyncSession,
    *,
    reference_type: Optional[str] = None,
    reference_id: Optional[UUID] = None,
) -> List[Payment]:
    """List payment history, optionally filtered by reference_type/reference_id."""
    return await payment_repository.list_all(db, reference_type=reference_type, reference_id=reference_id)


async def confirm_payment(
    db: AsyncSession,
    payment_id: UUID,
    *,
    method_id: Optional[UUID] = None,
    simulate_outcome: str = "paid",
    failure_reason: Optional[str] = None,
) -> Payment:
    """Confirm a pending payment against the simulated gateway.

    This is a MOCK confirmation — there is no real payment processor behind it.
    `simulate_outcome` lets the caller choose whether this confirmation succeeds
    ("paid") or fails ("failed"), which is how a demo/test-mode gateway exercises
    both paths deterministically.

    Args:
        db: active async session.
        payment_id: the payment to confirm. Must currently be "pending".
        method_id: optionally set/override the payment method at confirmation time
            (a payment can be created without one and have it selected here).
        simulate_outcome: "paid" or "failed" — the simulated gateway result.
        failure_reason: optional human-readable reason, recorded when
            simulate_outcome is "failed".

    Returns:
        The updated Payment, now "paid" or "failed".

    Raises:
        NotFoundError: no payment with that id exists (or method_id doesn't exist).
        ConflictError: the payment is not currently "pending".
        ValidationError: simulate_outcome is not "paid" or "failed".
    """
    if simulate_outcome not in _VALID_CONFIRM_OUTCOMES:
        raise ValidationError(f"simulate_outcome must be one of {sorted(_VALID_CONFIRM_OUTCOMES)}.")

    payment = await get_payment(db, payment_id)
    if payment.status != "pending":
        raise ConflictError(f"Cannot confirm a payment in '{payment.status}' status; must be 'pending'.")

    if method_id is not None:
        await get_payment_method(db, method_id)  # raises NotFoundError if missing
        payment.method_id = method_id

    from datetime import datetime, timezone

    if simulate_outcome == "paid":
        payment.status = "paid"
        payment.paid_at = datetime.now(timezone.utc)
    else:
        payment.status = "failed"
        payment.failure_reason = failure_reason

    return await payment_repository.save(db, payment)


async def refund_payment(db: AsyncSession, payment_id: UUID, *, reason: Optional[str] = None) -> Payment:
    """Refund a paid payment.

    Args:
        db: active async session.
        payment_id: the payment to refund. Must currently be "paid".
        reason: optional human-readable refund reason.

    Returns:
        The updated Payment, now "refunded".

    Raises:
        NotFoundError: no payment with that id exists.
        ConflictError: the payment is not currently "paid".
    """
    payment = await get_payment(db, payment_id)
    if payment.status != "paid":
        raise ConflictError(f"Cannot refund a payment in '{payment.status}' status; must be 'paid'.")

    from datetime import datetime, timezone

    payment.status = "refunded"
    payment.refund_reason = reason
    payment.refunded_at = datetime.now(timezone.utc)
    return await payment_repository.save(db, payment)


# --- Simulated gateway webhook -------------------------------------------------------


async def process_webhook_event(
    db: AsyncSession,
    *,
    event_type: str,
    payment_id: UUID,
    failure_reason: Optional[str] = None,
    refund_reason: Optional[str] = None,
) -> Payment:
    """Apply a simulated gateway webhook event to a payment.

    Deliberately reuses confirm_payment()/refund_payment() rather than mutating
    Payment directly, so a webhook-driven state change is validated by the exact
    same state-machine rules (and raises the exact same ConflictError on an
    invalid transition) as a staff-driven one.

    Args:
        db: active async session.
        event_type: "payment.succeeded" | "payment.failed" | "payment.refunded".
        payment_id: the payment this event applies to.
        failure_reason: used when event_type is "payment.failed".
        refund_reason: used when event_type is "payment.refunded".

    Returns:
        The updated Payment.

    Raises:
        NotFoundError: no payment with that id exists.
        ConflictError: the event doesn't apply to the payment's current status
            (e.g. a "payment.refunded" event for a payment that's still "pending").
        ValidationError: event_type is not one of the three recognized values.
    """
    if event_type == "payment.succeeded":
        return await confirm_payment(db, payment_id, simulate_outcome="paid")
    elif event_type == "payment.failed":
        return await confirm_payment(
            db, payment_id, simulate_outcome="failed", failure_reason=failure_reason
        )
    elif event_type == "payment.refunded":
        return await refund_payment(db, payment_id, reason=refund_reason)
    else:
        raise ValidationError(
            "event_type must be one of 'payment.succeeded', 'payment.failed', 'payment.refunded'."
        )