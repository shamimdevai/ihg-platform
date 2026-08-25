"""Unit test for app.shared_kernel.services.pdf_service — no database required."""
from app.shared_kernel.services import pdf_service


def test_render_pdf_from_raw_html_produces_pdf_bytes():
    pdf_bytes = pdf_service.render_pdf(html_content="<html><body><h1>Test Invoice</h1></body></html>")
    assert isinstance(pdf_bytes, bytes)
    assert pdf_bytes.startswith(b"%PDF")