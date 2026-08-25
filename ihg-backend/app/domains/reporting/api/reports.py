"""GET /reporting/reports/revenue (JSON) and GET /reporting/reports/revenue/export
(XLSX download) — date-range revenue reports per domain. Gated by reporting:read only.

The /export endpoint returns raw file bytes, not the standard envelope — same
precedent as hotel's GET /invoices/{id}/pdf streaming application/pdf directly.
"""
from datetime import date
from io import BytesIO
from typing import Optional

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_db, require_permission
from app.domains.reporting.schemas.report import RevenueReportRead
from app.domains.reporting.services import report_service
from app.shared_kernel.schemas.response_envelope import envelope

router = APIRouter(prefix="/reporting/reports", tags=["reporting"])


@router.get("/revenue", dependencies=[Depends(require_permission("reporting:read"))])
async def get_revenue_report(
    domain: str = Query(..., description="One of: hotel, restaurant, delivery."),
    date_from: Optional[date] = Query(None, description="Inclusive start date (YYYY-MM-DD)."),
    date_to: Optional[date] = Query(None, description="Inclusive end date (YYYY-MM-DD)."),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Return a domain's revenue records within an optional date window, as JSON."""
    report = await report_service.generate_revenue_report(
        db, domain=domain, date_from=date_from, date_to=date_to
    )
    return envelope(data=RevenueReportRead.model_validate(report))


@router.get("/revenue/export", dependencies=[Depends(require_permission("reporting:read"))])
async def export_revenue_report(
    domain: str = Query(..., description="One of: hotel, restaurant, delivery."),
    date_from: Optional[date] = Query(None, description="Inclusive start date (YYYY-MM-DD)."),
    date_to: Optional[date] = Query(None, description="Inclusive end date (YYYY-MM-DD)."),
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    """Same report as GET /revenue, rendered as a downloadable XLSX file."""
    file_bytes = await report_service.export_revenue_report_excel(
        db, domain=domain, date_from=date_from, date_to=date_to
    )
    filename = f"{domain}_revenue_report.xlsx"
    return StreamingResponse(
        BytesIO(file_bytes),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )