"""Unit tests for Phase 6.5: the refund request & approval workflow
(refund_request_service), payment method delete, and the simulated webhook
dispatcher (payment_service.process_webhook_event).
"""
import uuid

import pytest

from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.domains.payments.services import payment_service, refund_request_service


async def _make_paid_payment(db_session, amount=100):
    payment = await payment_service.create_payment_intent(
        db_session, reference_type="hotel_booking", reference_id=uuid.uuid4(), amount=amount
    )
    return await payment_service.confirm_payment(db_session, payment.id, simulate_outcome="paid")


# --- create_refund_request() --------------------------------------------------------


async def test_create_refund_request_on_paid_payment(db_session):
    payment = await _make_paid_payment(db_session)
    requester_id = uuid.uuid4()
    request = await refund_request_service.create_refund_request(
        db_session, payment.id, requested_by_staff_id=requester_id, reason="Guest complaint."
    )
    assert request.status == "pending"
    assert request.payment_id == payment.id
    assert request.requested_by_staff_id == requester_id
    assert request.reason == "Guest complaint."


async def test_create_refund_request_rejects_non_paid_payment(db_session):
    payment = await payment_service.create_payment_intent(
        db_session, reference_type="hotel_booking", reference_id=uuid.uuid4(), amount=50
    )
    # Still "pending" -> cannot request a refund yet.
    with pytest.raises(ConflictError):
        await refund_request_service.create_refund_request(
            db_session, payment.id, requested_by_staff_id=uuid.uuid4()
        )


async def test_create_refund_request_rejects_unknown_payment(db_session):
    with pytest.raises(NotFoundError):
        await refund_request_service.create_refund_request(
            db_session, uuid.uuid4(), requested_by_staff_id=uuid.uuid4()
        )


async def test_create_refund_request_rejects_duplicate_pending_request(db_session):
    payment = await _make_paid_payment(db_session)
    await refund_request_service.create_refund_request(
        db_session, payment.id, requested_by_staff_id=uuid.uuid4()
    )
    with pytest.raises(ConflictError):
        await refund_request_service.create_refund_request(
            db_session, payment.id, requested_by_staff_id=uuid.uuid4()
        )


# --- approve_refund_request() -------------------------------------------------------


async def test_approve_refund_request_refunds_the_payment(db_session):
    payment = await _make_paid_payment(db_session)
    request = await refund_request_service.create_refund_request(
        db_session, payment.id, requested_by_staff_id=uuid.uuid4(), reason="Guest complaint."
    )
    reviewer_id = uuid.uuid4()
    approved = await refund_request_service.approve_refund_request(
        db_session, request.id, reviewed_by_staff_id=reviewer_id, review_reason="Confirmed valid."
    )
    assert approved.status == "approved"
    assert approved.reviewed_by_staff_id == reviewer_id
    assert approved.review_reason == "Confirmed valid."
    assert approved.reviewed_at is not None

    # The underlying payment must actually be refunded — approval isn't just a
    # status flip on the request, it triggers the real refund via
    # payment_service.refund_payment().
    refunded_payment = await payment_service.get_payment(db_session, payment.id)
    assert refunded_payment.status == "refunded"
    assert refunded_payment.refunded_at is not None


async def test_approve_refund_request_rejects_already_reviewed_request(db_session):
    payment = await _make_paid_payment(db_session)
    request = await refund_request_service.create_refund_request(
        db_session, payment.id, requested_by_staff_id=uuid.uuid4()
    )
    await refund_request_service.approve_refund_request(db_session, request.id, reviewed_by_staff_id=uuid.uuid4())
    with pytest.raises(ConflictError):
        await refund_request_service.approve_refund_request(
            db_session, request.id, reviewed_by_staff_id=uuid.uuid4()
        )


async def test_approve_refund_request_rejects_unknown_request(db_session):
    with pytest.raises(NotFoundError):
        await refund_request_service.approve_refund_request(
            db_session, uuid.uuid4(), reviewed_by_staff_id=uuid.uuid4()
        )


async def test_approve_refund_request_conflicts_if_payment_already_refunded_directly(db_session):
    """Race condition: a request is filed, then the SAME payment is refunded
    directly (path A) before the request is reviewed. Approval must fail cleanly
    rather than double-refund or silently succeed.
    """
    payment = await _make_paid_payment(db_session)
    request = await refund_request_service.create_refund_request(
        db_session, payment.id, requested_by_staff_id=uuid.uuid4()
    )
    # Direct refund happens first (path A).
    await payment_service.refund_payment(db_session, payment.id, reason="Refunded directly by Finance Admin.")

    with pytest.raises(ConflictError):
        await refund_request_service.approve_refund_request(
            db_session, request.id, reviewed_by_staff_id=uuid.uuid4()
        )
    # The request itself must remain "pending" — the failed approval attempt must
    # not have partially mutated it.
    still_pending = await refund_request_service.get_refund_request(db_session, request.id)
    assert still_pending.status == "pending"


# --- reject_refund_request() --------------------------------------------------------


async def test_reject_refund_request_requires_reason_and_does_not_touch_payment(db_session):
    payment = await _make_paid_payment(db_session)
    request = await refund_request_service.create_refund_request(
        db_session, payment.id, requested_by_staff_id=uuid.uuid4()
    )
    reviewer_id = uuid.uuid4()
    rejected = await refund_request_service.reject_refund_request(
        db_session, request.id, reviewed_by_staff_id=reviewer_id, reason="Outside refund window."
    )
    assert rejected.status == "rejected"
    assert rejected.review_reason == "Outside refund window."
    assert rejected.reviewed_by_staff_id == reviewer_id

    # Payment must remain "paid" — rejection never touches it.
    unchanged_payment = await payment_service.get_payment(db_session, payment.id)
    assert unchanged_payment.status == "paid"


async def test_reject_refund_request_rejects_already_reviewed_request(db_session):
    payment = await _make_paid_payment(db_session)
    request = await refund_request_service.create_refund_request(
        db_session, payment.id, requested_by_staff_id=uuid.uuid4()
    )
    await refund_request_service.reject_refund_request(
        db_session, request.id, reviewed_by_staff_id=uuid.uuid4(), reason="No."
    )
    with pytest.raises(ConflictError):
        await refund_request_service.reject_refund_request(
            db_session, request.id, reviewed_by_staff_id=uuid.uuid4(), reason="Still no."
        )


# --- list_refund_requests() ---------------------------------------------------------


async def test_list_refund_requests_filters_by_status(db_session):
    payment_a = await _make_paid_payment(db_session)
    payment_b = await _make_paid_payment(db_session)
    request_a = await refund_request_service.create_refund_request(
        db_session, payment_a.id, requested_by_staff_id=uuid.uuid4()
    )
    await refund_request_service.create_refund_request(db_session, payment_b.id, requested_by_staff_id=uuid.uuid4())
    await refund_request_service.approve_refund_request(
        db_session, request_a.id, reviewed_by_staff_id=uuid.uuid4()
    )

    pending = await refund_request_service.list_refund_requests(db_session, status="pending")
    approved = await refund_request_service.list_refund_requests(db_session, status="approved")
    assert all(r.status == "pending" for r in pending)
    assert all(r.status == "approved" for r in approved)
    assert any(r.id == request_a.id for r in approved)


# --- payment method delete ------------------------------------------------------------


async def test_delete_payment_method_excludes_from_list(db_session):
    method = await payment_service.create_payment_method(db_session, type="card", label="Test Card")
    deleter_id = uuid.uuid4()
    await payment_service.delete_payment_method(db_session, method.id, deleted_by_staff_id=deleter_id)

    methods = await payment_service.list_payment_methods(db_session)
    assert all(m.id != method.id for m in methods)

    with pytest.raises(NotFoundError):
        await payment_service.get_payment_method(db_session, method.id)


async def test_delete_payment_method_rejects_unknown_id(db_session):
    with pytest.raises(NotFoundError):
        await payment_service.delete_payment_method(db_session, uuid.uuid4(), deleted_by_staff_id=uuid.uuid4())


# --- process_webhook_event() ---------------------------------------------------------


async def test_webhook_event_succeeded_confirms_payment(db_session):
    payment = await payment_service.create_payment_intent(
        db_session, reference_type="hotel_booking", reference_id=uuid.uuid4(), amount=75
    )
    updated = await payment_service.process_webhook_event(
        db_session, event_type="payment.succeeded", payment_id=payment.id
    )
    assert updated.status == "paid"
    assert updated.paid_at is not None


async def test_webhook_event_failed_sets_failure_reason(db_session):
    payment = await payment_service.create_payment_intent(
        db_session, reference_type="hotel_booking", reference_id=uuid.uuid4(), amount=75
    )
    updated = await payment_service.process_webhook_event(
        db_session, event_type="payment.failed", payment_id=payment.id, failure_reason="Insufficient funds."
    )
    assert updated.status == "failed"
    assert updated.failure_reason == "Insufficient funds."


async def test_webhook_event_refunded_refunds_paid_payment(db_session):
    payment = await _make_paid_payment(db_session)
    updated = await payment_service.process_webhook_event(
        db_session, event_type="payment.refunded", payment_id=payment.id, refund_reason="Gateway-initiated refund."
    )
    assert updated.status == "refunded"
    assert updated.refund_reason == "Gateway-initiated refund."


async def test_webhook_event_refunded_conflicts_on_pending_payment(db_session):
    payment = await payment_service.create_payment_intent(
        db_session, reference_type="hotel_booking", reference_id=uuid.uuid4(), amount=75
    )
    # Still "pending" -> a "payment.refunded" event doesn't apply.
    with pytest.raises(ConflictError):
        await payment_service.process_webhook_event(
            db_session, event_type="payment.refunded", payment_id=payment.id
        )


async def test_webhook_event_rejects_unrecognized_event_type(db_session):
    payment = await payment_service.create_payment_intent(
        db_session, reference_type="hotel_booking", reference_id=uuid.uuid4(), amount=75
    )
    with pytest.raises(ValidationError):
        await payment_service.process_webhook_event(
            db_session, event_type="payment.something_else", payment_id=payment.id
        )


async def test_webhook_event_rejects_unknown_payment(db_session):
    with pytest.raises(NotFoundError):
        await payment_service.process_webhook_event(
            db_session, event_type="payment.succeeded", payment_id=uuid.uuid4()
        )


# --- Webhook signature guard (HTTP layer) --------------------------------------------
#
# These two hit the real route via the in-process ASGI client (no real network,
# no uvicorn subprocess) rather than calling process_webhook_event() directly,
# since the signature check itself lives in the route handler, not the service.
# Both cases fail the signature check before any DB access, so no dev-DB writes
# occur — deliberately not exercising the 200/success path here to avoid writing
# test data into a real, persistent dev database (see the Phase 5 lesson about
# tests polluting shared state).


async def test_webhook_rejects_missing_signature(client):
    response = await client.post(
        "/api/v1/payments/webhook",
        json={"event_type": "payment.succeeded", "payment_id": str(uuid.uuid4())},
    )
    assert response.status_code == 401


async def test_webhook_rejects_wrong_signature(client):
    response = await client.post(
        "/api/v1/payments/webhook",
        json={"event_type": "payment.succeeded", "payment_id": str(uuid.uuid4())},
        headers={"X-Webhook-Signature": "definitely-not-the-secret"},
    )
    assert response.status_code == 401