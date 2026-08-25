"""Request/response schema for date-range revenue reports."""
from datetime import date
from typing import List, Optional

from pydantic import BaseModel


class RevenueReportRead(BaseModel):
    """GET /reporting/reports/revenue response payload (JSON form; the /export
    variant of the same endpoint returns raw XLSX bytes instead of this schema).
    """

    domain: str
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    headers: List[str]
    rows: List[list]
    row_count: int
    total_amount: float