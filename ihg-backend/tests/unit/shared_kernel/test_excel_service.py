"""Unit test for app.shared_kernel.services.excel_service — no database required."""
from app.shared_kernel.services import excel_service


def test_build_excel_report_produces_xlsx_bytes():
    xlsx_bytes = excel_service.build_excel_report(
        sheet_name="Test Report",
        headers=["Name", "Revenue"],
        rows=[["Room A", 100], ["Room B", 200]],
    )
    assert isinstance(xlsx_bytes, bytes)
    # XLSX files are zip archives — the zip local file header magic bytes are "PK\x03\x04"
    assert xlsx_bytes.startswith(b"PK")