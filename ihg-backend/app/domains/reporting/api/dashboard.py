"""GET /reporting/dashboard — cross-domain aggregate summary. Gated by
reporting:read only (this domain owns no tables and has no write endpoints).
"""
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_db, require_permission
from app.domains.reporting.schemas.dashboard import DashboardSummaryRead
from app.domains.reporting.services import dashboard_service
from app.shared_kernel.schemas.response_envelope import envelope

router = APIRouter(prefix="/reporting/dashboard", tags=["reporting"])


@router.get("", dependencies=[Depends(require_permission("reporting:read"))])
async def get_dashboard(
    date_from: Optional[date] = Query(None, description="Inclusive start date (YYYY-MM-DD)."),
    date_to: Optional[date] = Query(None, description="Inclusive end date (YYYY-MM-DD)."),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Aggregate booking/order counts and revenue across hotel, restaurant, and
    delivery for an optional date window. Omit both query params for all-time totals.
    """
    summary = await dashboard_service.get_dashboard_summary(db, date_from=date_from, date_to=date_to)
    return envelope(data=DashboardSummaryRead.model_validate(summary))