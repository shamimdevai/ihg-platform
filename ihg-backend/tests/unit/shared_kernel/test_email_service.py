"""Unit test for app.shared_kernel.services.email_service.

Mocks aiosmtplib.send entirely — this test must never require Mailpit or any real
SMTP server to be running for `pytest` to pass.
"""
from unittest.mock import AsyncMock, patch

from app.shared_kernel.services import email_service


async def test_send_email_renders_template_and_calls_smtp():
    with patch("app.shared_kernel.services.email_service.aiosmtplib.send", new_callable=AsyncMock) as mock_send:
        await email_service.send_email(
            to_email="guest@example.com",
            subject="Welcome!",
            template_name="welcome.html",
            context={"recipient_name": "Jane Doe"},
        )
        mock_send.assert_awaited_once()
        sent_message = mock_send.call_args.args[0]
        assert sent_message["To"] == "guest@example.com"
        assert sent_message["Subject"] == "Welcome!"