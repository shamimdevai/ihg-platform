"""Response schema for the reporting dashboard endpoint."""
from datetime import date
from typing import Optional

from pydantic import BaseModel


class DashboardSummaryRead(BaseModel):
    """GET /reporting/dashboard response payload.

    `hotel`/`restaurant`/`delivery` are deliberately plain dicts rather than three
    near-duplicate strict models — each domain's internal status vocabulary differs
    (paid invoice vs. billed order vs. delivered order), and a rigid shared schema
    would need editing every time one domain's status values change.
    """

    date_from: Optional[date] = None
    date_to: Optional[date] = None
    hotel: dict
    restaurant: dict
    delivery: dict
    total_revenue: float