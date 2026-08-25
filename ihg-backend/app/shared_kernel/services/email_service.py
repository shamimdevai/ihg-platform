"""Sends templated transactional emails via SMTP (async).

Always sends through real SMTP — there is no dev/prod code branch (PROJECT_STATE.md §3
rule 10). In development, .env points SMTP_HOST at Mailpit (Docker Compose service,
SMTP :1025, Web UI :8025) so emails are captured locally instead of reaching real
inboxes. In production, only the .env SMTP_* values change to a real provider.

Automated tests must mock `send_email` (or `aiosmtplib.send`) entirely — never hit a
real or even a Mailpit SMTP server from pytest.
"""
from email.message import EmailMessage
from pathlib import Path
from typing import Any, Dict, Optional

import aiosmtplib
from jinja2 import Environment, FileSystemLoader, select_autoescape

from app.core.company_config import company_config
from app.core.config import settings

_TEMPLATES_DIR = Path(__file__).resolve().parents[2] / "templates" / "email"

_jinja_env = Environment(
    loader=FileSystemLoader(str(_TEMPLATES_DIR)),
    autoescape=select_autoescape(["html"]),
)


def _render_template(template_name: str, context: Dict[str, Any]) -> str:
    """Render an email template with branding context automatically merged in."""
    branded_context = {
        "company_name": company_config.name,
        "logo_url": company_config.logo_url,
        "primary_color": company_config.primary_color,
        "secondary_color": company_config.secondary_color,
        "currency": company_config.currency,
        "footer_text": company_config.footer_text,
        "support_email": company_config.support_email,
        **context,
    }
    template = _jinja_env.get_template(template_name)
    return template.render(**branded_context)


async def send_email(
    *,
    to_email: str,
    subject: str,
    template_name: str,
    context: Optional[Dict[str, Any]] = None,
) -> None:
    """Render `template_name` (from app/templates/email/) and send it via SMTP.

    Args:
        to_email: recipient address.
        subject: email subject line.
        template_name: filename under app/templates/email/, e.g. "welcome.html".
        context: template variables (merged with branding context automatically).
    """
    html_body = _render_template(template_name, context or {})

    message = EmailMessage()
    message["From"] = settings.SMTP_FROM_EMAIL
    message["To"] = to_email
    message["Subject"] = subject
    message.set_content("This email requires an HTML-capable client to view.")
    message.add_alternative(html_body, subtype="html")

    await aiosmtplib.send(
        message,
        hostname=settings.SMTP_HOST,
        port=settings.SMTP_PORT,
        use_tls=settings.SMTP_USE_TLS,
    )