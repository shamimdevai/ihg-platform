"""Renders HTML (raw or Jinja2 templates under app/templates/pdf/) into branded PDF bytes.

Uses xhtml2pdf (pure Python, no system-level dependencies like Cairo/Pango) so the
Docker image stays lightweight. Branding (logo, colors, footer) from company_config is
merged into every template's context automatically.
"""
from io import BytesIO
from pathlib import Path
from typing import Any, Dict

from jinja2 import Environment, FileSystemLoader, select_autoescape
from xhtml2pdf import pisa

from app.core.company_config import company_config
from app.core.exceptions import AppError

_TEMPLATES_DIR = Path(__file__).resolve().parents[2] / "templates" / "pdf"

_jinja_env = Environment(
    loader=FileSystemLoader(str(_TEMPLATES_DIR)),
    autoescape=select_autoescape(["html"]),
)


class PdfRenderError(AppError):
    """Raised when xhtml2pdf fails to convert HTML into a PDF."""

    status_code = 500
    default_message = "Failed to render PDF."


def render_pdf(*, html_content: str) -> bytes:
    """Convert a raw HTML string into PDF bytes.

    Use this directly when you already have HTML (e.g. built inline or via
    `render_pdf_template`).

    Raises:
        PdfRenderError: xhtml2pdf failed to convert the HTML.
    """
    output = BytesIO()
    result = pisa.CreatePDF(src=html_content, dest=output)
    if result.err:
        raise PdfRenderError(details={"xhtml2pdf_error_count": result.err})
    return output.getvalue()


def render_pdf_template(template_name: str, context: Dict[str, Any]) -> bytes:
    """Render app/templates/pdf/{template_name} with Jinja2 (branding merged in
    automatically) and convert the result into PDF bytes.
    """
    branded_context = {
        "company_name": company_config.name,
        "logo_url": company_config.logo_url,
        "primary_color": company_config.primary_color,
        "secondary_color": company_config.secondary_color,
        "currency": company_config.currency,
        "footer_text": company_config.footer_text,
        **context,
    }
    template = _jinja_env.get_template(template_name)
    html_content = template.render(**branded_context)
    return render_pdf(html_content=html_content)