"""Date-range revenue reports, exportable as XLSX via shared_kernel.excel_service.
Same cross-domain service-only rule as dashboard_service.py.
"""
from datetime import date
from typing import List, Optional, Tuple

from app.core.exceptions import ValidationError
from app.domains.reporting.services._utils import in_date_range
from app.shared_kernel.services.excel_service import build_excel_report

_VALID_DOMAINS = ("hotel", "restaurant", "delivery")


async def _hotel_rows(db, *, date_from: Optional[date], date_to: Optional[date]) -> List[Tuple]:
    from app.domains.hotel.services import invoice_service

    invoices = await invoice_service.list_invoices(db, status="paid")
    rows = []
    for inv in invoices:
        if not in_date_range(inv.created_at, date_from, date_to):
            continue
        rows.append((
            str(inv.id), inv.invoice_number, inv.created_at.date().isoformat(),
            inv.status, float(inv.total_amount), inv.currency,
        ))
    return rows


async def _restaurant_rows(db, *, date_from: Optional[date], date_to: Optional[date]) -> List[Tuple]:
    from app.domains.restaurant.services import dine_in_order_service

    orders = await dine_in_order_service.list_orders(db, status="billed")
    rows = []
    for o in orders:
        if not in_date_range(o.created_at, date_from, date_to):
            continue
        rows.append((
            str(o.id), str(o.table_id), o.created_at.date().isoformat(),
            o.status, float(o.total_amount), o.currency,
        ))
    return rows


async def _delivery_rows(db, *, date_from: Optional[date], date_to: Optional[date]) -> List[Tuple]:
    from app.domains.delivery.services import delivery_order_service

    orders = await delivery_order_service.list_orders(db, status="delivered")
    rows = []
    for o in orders:
        if not in_date_range(o.created_at, date_from, date_to):
            continue
        rows.append((
            str(o.id), str(o.customer_id), o.created_at.date().isoformat(),
            o.status, float(o.total_amount), o.currency,
        ))
    return rows


_DOMAIN_CONFIG = {
    "hotel": {
        "headers": ["Invoice ID", "Invoice Number", "Date", "Status", "Total Amount", "Currency"],
        "rows_fn": _hotel_rows,
        "sheet_name": "Hotel Revenue",
    },
    "restaurant": {
        "headers": ["Order ID", "Table ID", "Date", "Status", "Total Amount", "Currency"],
        "rows_fn": _restaurant_rows,
        "sheet_name": "Restaurant Revenue",
    },
    "delivery": {
        "headers": ["Order ID", "Customer ID", "Date", "Status", "Total Amount", "Currency"],
        "rows_fn": _delivery_rows,
        "sheet_name": "Delivery Revenue",
    },
}


async def generate_revenue_report(
    db, *, domain: str, date_from: Optional[date] = None, date_to: Optional[date] = None
) -> dict:
    """Return a domain's paid/billed/delivered revenue records within an optional
    [date_from, date_to] window, as headers + rows (JSON-friendly form).

    Raises:
        ValidationError: `domain` is not one of "hotel", "restaurant", "delivery".
    """
    if domain not in _VALID_DOMAINS:
        raise ValidationError(f"domain must be one of {_VALID_DOMAINS}, got '{domain}'.")

    config = _DOMAIN_CONFIG[domain]
    rows = await config["rows_fn"](db, date_from=date_from, date_to=date_to)
    total = sum(row[4] for row in rows)  # "Total Amount" is always column index 4

    return {
        "domain": domain,
        "date_from": date_from,
        "date_to": date_to,
        "headers": config["headers"],
        "rows": rows,
        "row_count": len(rows),
        "total_amount": total,
    }


async def export_revenue_report_excel(
    db, *, domain: str, date_from: Optional[date] = None, date_to: Optional[date] = None
) -> bytes:
    """Same data as generate_revenue_report(), rendered as XLSX bytes."""
    report = await generate_revenue_report(db, domain=domain, date_from=date_from, date_to=date_to)
    return build_excel_report(
        sheet_name=_DOMAIN_CONFIG[domain]["sheet_name"],
        headers=report["headers"],
        rows=report["rows"],
    )