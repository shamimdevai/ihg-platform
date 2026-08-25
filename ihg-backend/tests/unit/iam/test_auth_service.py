"""Unit tests for app.domains.iam.services.auth_service.

email_service is mocked throughout — these tests never require Mailpit to be running.
"""
from unittest.mock import AsyncMock, patch
from urllib.parse import parse_qs, urlparse

import pytest

from app.core.exceptions import AccountLockedError, UnauthorizedError, ValidationError
from app.domains.iam.repositories import role_repository, staff_user_repository
from app.domains.iam.services import auth_service, staff_service


async def _make_active_staff(db_session, *, password="Str0ngPass1"):
    role = await role_repository.create(db_session, name=f"test-role-auth-{id(db_session)}")
    with patch("app.domains.iam.services.staff_service.email_service.send_email", new_callable=AsyncMock):
        staff = await staff_service.invite_staff(
            db_session,
            email=f"staff-{role.id}@example.com",
            first_name="Jane",
            last_name="Doe",
            role_id=role.id,
        )
    from app.core.security import hash_password

    staff.password_hash = hash_password(password)
    staff.is_active = True
    return await staff_user_repository.save(db_session, staff)


async def test_login_succeeds_with_correct_credentials(db_session):
    staff = await _make_active_staff(db_session, password="Str0ngPass1")
    tokens = await auth_service.login(db_session, email=staff.email, password="Str0ngPass1")
    assert tokens.access_token
    assert tokens.refresh_token


async def test_login_fails_with_wrong_password(db_session):
    staff = await _make_active_staff(db_session, password="Str0ngPass1")
    with pytest.raises(UnauthorizedError):
        await auth_service.login(db_session, email=staff.email, password="WrongPassword1")


async def test_login_fails_for_unknown_email(db_session):
    with pytest.raises(UnauthorizedError):
        await auth_service.login(db_session, email="nobody@example.com", password="whatever")


async def test_account_locks_after_max_failed_attempts(db_session):
    staff = await _make_active_staff(db_session, password="Str0ngPass1")

    # Default max_attempts is 5 (no seeded settings row in this test DB session).
    for _ in range(4):
        with pytest.raises(UnauthorizedError):
            await auth_service.login(db_session, email=staff.email, password="WrongPassword1")

    with pytest.raises(AccountLockedError):
        await auth_service.login(db_session, email=staff.email, password="WrongPassword1")

    # Even the CORRECT password is now rejected while locked.
    with pytest.raises(AccountLockedError):
        await auth_service.login(db_session, email=staff.email, password="Str0ngPass1")


async def test_forgot_password_and_reset_end_to_end(db_session):
    staff = await _make_active_staff(db_session, password="OldPassword1")

    with patch("app.shared_kernel.services.email_service.send_email", new_callable=AsyncMock) as mock_send:
        await auth_service.forgot_password(db_session, email=staff.email)
        mock_send.assert_awaited_once()
        reset_link = mock_send.call_args.kwargs["context"]["reset_link"]

    raw_token = parse_qs(urlparse(reset_link).query)["token"][0]

    await auth_service.reset_password(db_session, token=raw_token, new_password="NewPassword1")

    # Old password no longer works, new one does.
    with pytest.raises(UnauthorizedError):
        await auth_service.login(db_session, email=staff.email, password="OldPassword1")
    tokens = await auth_service.login(db_session, email=staff.email, password="NewPassword1")
    assert tokens.access_token


async def test_reset_password_rejects_weak_password(db_session):
    staff = await _make_active_staff(db_session, password="OldPassword1")

    with patch("app.shared_kernel.services.email_service.send_email", new_callable=AsyncMock) as mock_send:
        await auth_service.forgot_password(db_session, email=staff.email)
        reset_link = mock_send.call_args.kwargs["context"]["reset_link"]

    raw_token = parse_qs(urlparse(reset_link).query)["token"][0]

    with pytest.raises(ValidationError):
        await auth_service.reset_password(db_session, token=raw_token, new_password="short")


async def test_change_password_requires_correct_current_password(db_session):
    staff = await _make_active_staff(db_session, password="CorrectPass1")
    with pytest.raises(UnauthorizedError):
        await auth_service.change_password(
            db_session, staff_user_id=staff.id, current_password="WrongPass1", new_password="NewPass123"
        )


async def test_change_password_succeeds_and_updates_login(db_session):
    staff = await _make_active_staff(db_session, password="CorrectPass1")
    await auth_service.change_password(
        db_session, staff_user_id=staff.id, current_password="CorrectPass1", new_password="NewPass123"
    )
    tokens = await auth_service.login(db_session, email=staff.email, password="NewPass123")
    assert tokens.access_token