"""Unit tests for app.domains.payments.services.payment_service — the
create -> confirm -> refund state machine and payment method CRUD.
"""
import uuid

import pytest

from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.core.company_config import get_company_config
from app.domains.payments.services import payment_service


# --- create_payment_intent() --------------------------------------------------------


async def test_create_payment_intent_defaults_to_pending(db_session):
    ref_id = uuid.uuid4()
    payment = await payment_service.create_payment_intent(
        db_session, reference_type="hotel_booking", reference_id=ref_id, amount=150.00
    )
    assert payment.status == "pending"
    assert payment.reference_type == "hotel_booking"
    assert payment.reference_id == ref_id
    assert float(payment.amount) == 150.00
    assert payment.method_id is None
    assert payment.paid_at is None
    assert payment.refunded_at is None


async def test_create_payment_intent_defaults_currency_from_company_config(db_session):
    payment = await payment_service.create_payment_intent(
        db_session, reference_type="restaurant_order", reference_id=uuid.uuid4(), amount=42.50
    )
    assert payment.currency == get_company_config().currency


async def test_create_payment_intent_respects_explicit_currency(db_session):
    payment = await payment_service.create_payment_intent(
        db_session,
        reference_type="restaurant_order",
        reference_id=uuid.uuid4(),
        amount=42.50,
        currency="EUR",
    )
    assert payment.currency == "EUR"


async def test_create_payment_intent_rejects_non_positive_amount(db_session):
    with pytest.raises(ValidationError):
        await payment_service.create_payment_intent(
            db_session, reference_type="hotel_booking", reference_id=uuid.uuid4(), amount=0
        )
    with pytest.raises(ValidationError):
        await payment_service.create_payment_intent(
            db_session, reference_type="hotel_booking", reference_id=uuid.uuid4(), amount=-5
        )


async def test_create_payment_intent_rejects_unknown_method_id(db_session):
    with pytest.raises(NotFoundError):
        await payment_service.create_payment_intent(
            db_session,
            reference_type="hotel_booking",
            reference_id=uuid.uuid4(),
            amount=10,
            method_id=uuid.uuid4(),
        )


async def test_create_payment_intent_accepts_valid_method_id(db_session):
    method = await payment_service.create_payment_method(db_session, type="card", label="Visa ending 4242")
    payment = await payment_service.create_payment_intent(
        db_session,
        reference_type="hotel_booking",
        reference_id=uuid.uuid4(),
        amount=10,
        method_id=method.id,
    )
    assert payment.method_id == method.id


# --- confirm_payment(): pending -> paid | failed ------------------------------------


async def test_confirm_payment_paid_sets_paid_at(db_session):
    payment = await payment_service.create_payment_intent(
        db_session, reference_type="hotel_booking", reference_id=uuid.uuid4(), amount=100
    )
    confirmed = await payment_service.confirm_payment(db_session, payment.id, simulate_outcome="paid")
    assert confirmed.status == "paid"
    assert confirmed.paid_at is not None
    assert confirmed.failure_reason is None


async def test_confirm_payment_failed_sets_failure_reason(db_session):
    payment = await payment_service.create_payment_intent(
        db_session, reference_type="hotel_booking", reference_id=uuid.uuid4(), amount=100
    )
    confirmed = await payment_service.confirm_payment(
        db_session, payment.id, simulate_outcome="failed", failure_reason="Card declined."
    )
    assert confirmed.status == "failed"
    assert confirmed.failure_reason == "Card declined."
    assert confirmed.paid_at is None


async def test_confirm_payment_can_set_method_id_at_confirm_time(db_session):
    payment = await payment_service.create_payment_intent(
        db_session, reference_type="hotel_booking", reference_id=uuid.uuid4(), amount=100
    )
    assert payment.method_id is None
    method = await payment_service.create_payment_method(db_session, type="cash")
    confirmed = await payment_service.confirm_payment(
        db_session, payment.id, method_id=method.id, simulate_outcome="paid"
    )
    assert confirmed.method_id == method.id


async def test_confirm_payment_rejects_invalid_simulate_outcome(db_session):
    payment = await payment_service.create_payment_intent(
        db_session, reference_type="hotel_booking", reference_id=uuid.uuid4(), amount=100
    )
    with pytest.raises(ValidationError):
        await payment_service.confirm_payment(db_session, payment.id, simulate_outcome="pending")


async def test_confirm_payment_rejects_unknown_payment(db_session):
    with pytest.raises(NotFoundError):
        await payment_service.confirm_payment(db_session, uuid.uuid4(), simulate_outcome="paid")


async def test_confirm_payment_rejects_non_pending_payment(db_session):
    payment = await payment_service.create_payment_intent(
        db_session, reference_type="hotel_booking", reference_id=uuid.uuid4(), amount=100
    )
    await payment_service.confirm_payment(db_session, payment.id, simulate_outcome="paid")
    # Already "paid" -> confirming again must be rejected, not silently re-applied.
    with pytest.raises(ConflictError):
        await payment_service.confirm_payment(db_session, payment.id, simulate_outcome="paid")


# --- refund_payment(): paid -> refunded ----------------------------------------------


async def test_refund_payment_marks_refunded(db_session):
    payment = await payment_service.create_payment_intent(
        db_session, reference_type="hotel_booking", reference_id=uuid.uuid4(), amount=100
    )
    await payment_service.confirm_payment(db_session, payment.id, simulate_outcome="paid")
    refunded = await payment_service.refund_payment(db_session, payment.id, reason="Guest cancelled.")
    assert refunded.status == "refunded"
    assert refunded.refund_reason == "Guest cancelled."
    assert refunded.refunded_at is not None


async def test_refund_payment_rejects_unknown_payment(db_session):
    with pytest.raises(NotFoundError):
        await payment_service.refund_payment(db_session, uuid.uuid4())


async def test_refund_payment_rejects_pending_payment(db_session):
    payment = await payment_service.create_payment_intent(
        db_session, reference_type="hotel_booking", reference_id=uuid.uuid4(), amount=100
    )
    # Still "pending" -> cannot refund without confirming first.
    with pytest.raises(ConflictError):
        await payment_service.refund_payment(db_session, payment.id)


async def test_refund_payment_rejects_failed_payment(db_session):
    payment = await payment_service.create_payment_intent(
        db_session, reference_type="hotel_booking", reference_id=uuid.uuid4(), amount=100
    )
    await payment_service.confirm_payment(db_session, payment.id, simulate_outcome="failed")
    with pytest.raises(ConflictError):
        await payment_service.refund_payment(db_session, payment.id)


async def test_refund_payment_rejects_double_refund(db_session):
    payment = await payment_service.create_payment_intent(
        db_session, reference_type="hotel_booking", reference_id=uuid.uuid4(), amount=100
    )
    await payment_service.confirm_payment(db_session, payment.id, simulate_outcome="paid")
    await payment_service.refund_payment(db_session, payment.id)
    with pytest.raises(ConflictError):
        await payment_service.refund_payment(db_session, payment.id)


# --- list_payments() / get_payment() -------------------------------------------------


async def test_list_payments_filters_by_reference(db_session):
    ref_id_a = uuid.uuid4()
    ref_id_b = uuid.uuid4()
    await payment_service.create_payment_intent(
        db_session, reference_type="hotel_booking", reference_id=ref_id_a, amount=10
    )
    await payment_service.create_payment_intent(
        db_session, reference_type="hotel_booking", reference_id=ref_id_a, amount=20
    )
    await payment_service.create_payment_intent(
        db_session, reference_type="hotel_booking", reference_id=ref_id_b, amount=30
    )
    await payment_service.create_payment_intent(
        db_session, reference_type="restaurant_order", reference_id=ref_id_a, amount=40
    )

    by_ref_id = await payment_service.list_payments(db_session, reference_id=ref_id_a)
    assert len(by_ref_id) == 3  # hotel_booking x2 + restaurant_order x1, same reference_id

    by_type_and_id = await payment_service.list_payments(
        db_session, reference_type="hotel_booking", reference_id=ref_id_a
    )
    assert len(by_type_and_id) == 2


async def test_get_payment_rejects_unknown_id(db_session):
    with pytest.raises(NotFoundError):
        await payment_service.get_payment(db_session, uuid.uuid4())


# --- payment methods -------------------------------------------------------------------


async def test_create_and_list_payment_methods(db_session):
    method = await payment_service.create_payment_method(db_session, type="wallet", label="Test Wallet")
    methods = await payment_service.list_payment_methods(db_session)
    assert any(m.id == method.id for m in methods)


async def test_get_payment_method_rejects_unknown_id(db_session):
    with pytest.raises(NotFoundError):
        await payment_service.get_payment_method(db_session, uuid.uuid4())