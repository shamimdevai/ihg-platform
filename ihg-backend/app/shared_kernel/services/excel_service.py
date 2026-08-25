"""Builds XLSX exports from tabular data using openpyxl."""
from io import BytesIO
from typing import Any, Sequence

from openpyxl import Workbook
from openpyxl.styles import Font


def build_excel_report(*, sheet_name: str, headers: Sequence[str], rows: Sequence[Sequence[Any]]) -> bytes:
    """Build a single-sheet XLSX file from a header row + data rows.

    Args:
        sheet_name: worksheet name (Excel caps this at 31 chars — truncated if longer).
        headers: column header labels, written bold in row 1.
        rows: data rows, each a sequence of cell values in the same order as `headers`.

    Returns:
        Raw XLSX file bytes, ready to be returned as a FastAPI FileResponse/StreamingResponse.
    """
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = sheet_name[:31]

    sheet.append(list(headers))
    for cell in sheet[1]:
        cell.font = Font(bold=True)

    for row in rows:
        sheet.append(list(row))

    output = BytesIO()
    workbook.save(output)
    return output.getvalue()