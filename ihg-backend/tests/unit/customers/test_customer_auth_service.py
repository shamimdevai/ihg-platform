"""Unit tests for app.domains.customers.services.customer_auth_service.

email_service is mocked throughout — these tests never require Mailpit to be running.
"""
from unittest.mock import AsyncMock, patch
from urllib.parse import parse_qs, urlparse

import pytest

from app.core.exceptions import AccountLockedError, ConflictError, UnauthorizedError, ValidationError
from app.domains.customers.services import customer_auth_service


async def _register(db_session, *, email="new-customer@example.com", password="Str0ngPass1"):
    with patch(
        "app.domains.customers.services.customer_auth_service.email_service.send_email",
        new_callable=AsyncMock,
    ) as mock_send:
        customer = await customer_auth_service.register(
            db_session, email=email, password=password, first_name="Jane", last_name="Doe"
        )
        verification_link = mock_send.call_args.kwargs["context"]["verification_link"]
    return customer, verification_link


async def test_register_creates_unverified_customer(db_session):
    customer, _ = await _register(db_session)
    assert customer.email_verified_at is None
    assert customer.is_active is True


async def test_register_rejects_duplicate_email(db_session):
    await _register(db_session, email="dupe@example.com")
    with pytest.raises(ConflictError):
        await _register(db_session, email="dupe@example.com")


async def test_register_rejects_weak_password(db_session):
    with pytest.raises(ValidationError):
        await customer_auth_service.register(
            db_session, email="weak@example.com", password="short", first_name="A", last_name="B"
        )


async def test_verify_email_marks_verified(db_session):
    customer, verification_link = await _register(db_session, email="verify-me@example.com")
    raw_token = parse_qs(urlparse(verification_link).query)["token"][0]

    verified = await customer_auth_service.verify_email(db_session, token=raw_token)
    assert verified.email_verified_at is not None


async def test_login_succeeds_even_when_unverified(db_session):
    """DESIGN DECISION under test: login does not require a verified email — see
    customer_auth_service module docstring."""
    customer, _ = await _register(db_session, email="unverified-login@example.com", password="Str0ngPass1")
    assert customer.email_verified_at is None

    tokens = await customer_auth_service.login(
        db_session, email="unverified-login@example.com", password="Str0ngPass1"
    )
    assert tokens.access_token
    assert tokens.refresh_token


async def test_login_fails_with_wrong_password(db_session):
    await _register(db_session, email="wrong-pw@example.com", password="Str0ngPass1")
    with pytest.raises(UnauthorizedError):
        await customer_auth_service.login(db_session, email="wrong-pw@example.com", password="WrongPassword1")


async def test_login_fails_for_unknown_email(db_session):
    with pytest.raises(UnauthorizedError):
        await customer_auth_service.login(db_session, email="nobody@example.com", password="whatever")


async def test_account_locks_after_max_failed_attempts(db_session):
    await _register(db_session, email="lockout-test@example.com", password="Str0ngPass1")

    for _ in range(4):
        with pytest.raises(UnauthorizedError):
            await customer_auth_service.login(
                db_session, email="lockout-test@example.com", password="WrongPassword1"
            )

    with pytest.raises(AccountLockedError):
        await customer_auth_service.login(
            db_session, email="lockout-test@example.com", password="WrongPassword1"
        )

    # Even the CORRECT password is now rejected while locked.
    with pytest.raises(AccountLockedError):
        await customer_auth_service.login(
            db_session, email="lockout-test@example.com", password="Str0ngPass1"
        )


async def test_forgot_password_and_reset_end_to_end(db_session):
    await _register(db_session, email="reset-flow@example.com", password="OldPassword1")

    with patch(
        "app.domains.customers.services.customer_auth_service.email_service.send_email",
        new_callable=AsyncMock,
    ) as mock_send:
        await customer_auth_service.forgot_password(db_session, email="reset-flow@example.com")
        mock_send.assert_awaited_once()
        reset_link = mock_send.call_args.kwargs["context"]["reset_link"]

    raw_token = parse_qs(urlparse(reset_link).query)["token"][0]
    await customer_auth_service.reset_password(db_session, token=raw_token, new_password="NewPassword1")

    with pytest.raises(UnauthorizedError):
        await customer_auth_service.login(db_session, email="reset-flow@example.com", password="OldPassword1")

    tokens = await customer_auth_service.login(
        db_session, email="reset-flow@example.com", password="NewPassword1"
    )
    assert tokens.access_token


async def test_change_password_requires_correct_current_password(db_session):
    customer, _ = await _register(db_session, email="change-pw@example.com", password="CorrectPass1")
    with pytest.raises(UnauthorizedError):
        await customer_auth_service.change_password(
            db_session, customer_id=customer.id, current_password="WrongPass1", new_password="NewPass123"
        )


async def test_get_current_customer_rejects_staff_token(db_session):
    """A staff-issued token must never resolve via get_current_customer — proves the
    structural staff/customer separation holds at the auth layer, not just the DB.
    """
    from app.core.exceptions import UnauthorizedError as CoreUnauthorizedError
    from app.core.security import create_access_token
    import uuid

    staff_token = create_access_token(subject=uuid.uuid4(), principal_type="staff")
    with pytest.raises(CoreUnauthorizedError):
        await customer_auth_service.get_current_customer(db_session, staff_token)