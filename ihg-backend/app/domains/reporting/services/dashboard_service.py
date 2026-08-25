"""Read-only dashboard aggregation. Reporting owns no tables — every number here is
computed by calling hotel/restaurant/delivery's own SERVICE layers only, never their
models or repositories directly (architecture rule: cross-domain calls go through
services, never models/repos).

See this module's own PR/session notes for two flagged design decisions: (1) no
date-range filter exists on the underlying list_* service functions, so filtering
happens here in Python rather than by adding a repository-level date-range query to
another domain; (2) module toggles (hotel_module_enabled etc.) are NOT checked here
— a disabled module's historical data still counts toward these totals.
"""
from datetime import date
from typing import Optional

from app.domains.reporting.services._utils import in_date_range


async def _hotel_summary(db, *, date_from: Optional[date], date_to: Optional[date]) -> dict:
    from app.domains.hotel.services import booking_service, invoice_service

    bookings = await booking_service.list_bookings(db)
    bookings_in_range = [b for b in bookings if in_date_range(b.created_at, date_from, date_to)]

    invoices = await invoice_service.list_invoices(db, status="paid")
    paid_invoices_in_range = [i for i in invoices if in_date_range(i.created_at, date_from, date_to)]
    revenue = sum(float(i.total_amount) for i in paid_invoices_in_range)

    return {
        "bookings_count": len(bookings_in_range),
        "cancelled_bookings_count": len([b for b in bookings_in_range if b.status == "cancelled"]),
        "paid_invoices_count": len(paid_invoices_in_range),
        "revenue": revenue,
    }


async def _restaurant_summary(db, *, date_from: Optional[date], date_to: Optional[date]) -> dict:
    from app.domains.restaurant.services import dine_in_order_service

    all_orders = await dine_in_order_service.list_orders(db)
    orders_in_range = [o for o in all_orders if in_date_range(o.created_at, date_from, date_to)]
    billed_in_range = [o for o in orders_in_range if o.status == "billed"]
    revenue = sum(float(o.total_amount) for o in billed_in_range)

    return {
        "orders_count": len(orders_in_range),
        "billed_orders_count": len(billed_in_range),
        "cancelled_orders_count": len([o for o in orders_in_range if o.status == "cancelled"]),
        "revenue": revenue,
    }


async def _delivery_summary(db, *, date_from: Optional[date], date_to: Optional[date]) -> dict:
    from app.domains.delivery.services import delivery_order_service

    all_orders = await delivery_order_service.list_orders(db)
    orders_in_range = [o for o in all_orders if in_date_range(o.created_at, date_from, date_to)]
    delivered_in_range = [o for o in orders_in_range if o.status == "delivered"]
    revenue = sum(float(o.total_amount) for o in delivered_in_range)

    return {
        "orders_count": len(orders_in_range),
        "delivered_orders_count": len(delivered_in_range),
        "cancelled_orders_count": len([o for o in orders_in_range if o.status == "cancelled"]),
        "revenue": revenue,
    }


async def get_dashboard_summary(
    db, *, date_from: Optional[date] = None, date_to: Optional[date] = None
) -> dict:
    """Aggregate counts + revenue across hotel, restaurant, and delivery for an
    optional [date_from, date_to] window (inclusive, filtered on each record's
    created_at). Both bounds are optional; omitting both returns all-time totals.
    """
    hotel = await _hotel_summary(db, date_from=date_from, date_to=date_to)
    restaurant = await _restaurant_summary(db, date_from=date_from, date_to=date_to)
    delivery = await _delivery_summary(db, date_from=date_from, date_to=date_to)

    total_revenue = hotel["revenue"] + restaurant["revenue"] + delivery["revenue"]

    return {
        "date_from": date_from,
        "date_to": date_to,
        "hotel": hotel,
        "restaurant": restaurant,
        "delivery": delivery,
        "total_revenue": total_revenue,
    }