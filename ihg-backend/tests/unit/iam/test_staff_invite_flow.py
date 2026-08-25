"""Proves the staff invite -> accept-invite flow end-to-end, mocking email_service."""
from unittest.mock import AsyncMock, patch
from urllib.parse import parse_qs, urlparse

from app.domains.iam.repositories import role_repository
from app.domains.iam.services import auth_service, staff_service


async def test_invite_then_accept_activates_account(db_session):
    role = await role_repository.create(db_session, name="test-role-invite-flow")

    with patch("app.domains.iam.services.staff_service.email_service.send_email", new_callable=AsyncMock) as mock_send:
        staff = await staff_service.invite_staff(
            db_session,
            email="new-hire@example.com",
            first_name="New",
            last_name="Hire",
            role_id=role.id,
        )
        mock_send.assert_awaited_once()
        invite_link = mock_send.call_args.kwargs["context"]["invite_link"]

    assert staff.is_active is False
    assert staff.password_hash is None

    raw_token = parse_qs(urlparse(invite_link).query)["token"][0]
    activated = await staff_service.accept_invite(db_session, token=raw_token, new_password="MyNewPass1")

    assert activated.is_active is True
    assert activated.password_hash is not None

    tokens = await auth_service.login(db_session, email="new-hire@example.com", password="MyNewPass1")
    assert tokens.access_token