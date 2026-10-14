"""Aggregates every domain's API router under /api/v1.

Phase 7 added the hotel domain (hotels/room-types, rooms, bookings, check-in/out,
housekeeping, invoices, service requests). Phase 8 added the restaurant domain
(restaurants/tables, reservations, menu, dine-in orders, kitchen tickets,
waiter-to-table assignments). Phase 9 added the delivery domain (delivery orders,
order tracking/status progression, riders, rider-to-order assignments).

Phase 10: hotel/restaurant/delivery routers are now gated by
`require_module_enabled("<domain>")` (app/api/v1/deps.py) at mount time — a disabled
module's routes 404 on every request, re-checked live via system_settings on every
call (no restart/redeploy needed to flip a toggle). `settings`, `iam`, `customers`,
`inventory`, `payments`, and `reporting` are core/shared/always-on and are NOT
module-gated. Also adds the reporting domain (dashboard aggregation + reports,
read-only, owns no tables).
"""
from fastapi import APIRouter, Depends

from app.api.v1.deps import require_module_enabled
from app.domains.customers.api.addresses import router as customer_addresses_router
from app.domains.customers.api.customer_auth import router as customer_auth_router
from app.domains.customers.api.customers import router as customer_profile_router
from app.domains.customers.api.guests import router as hotel_guests_router
from app.domains.delivery.api.delivery_orders import router as delivery_orders_router
from app.domains.delivery.api.delivery_tracking import router as delivery_tracking_router
from app.domains.delivery.api.riders import assignments_router as delivery_assignments_router
from app.domains.delivery.api.riders import router as delivery_riders_router
from app.domains.hotel.api.bookings import router as hotel_bookings_router
from app.domains.hotel.api.checkin import router as hotel_checkin_router
from app.domains.hotel.api.checkout import router as hotel_checkout_router
from app.domains.hotel.api.hotels import router as hotel_hotels_router
from app.domains.hotel.api.housekeeping import router as hotel_housekeeping_router
from app.domains.hotel.api.public_catalog import router as hotel_public_router
from app.domains.hotel.api.invoices import router as hotel_invoices_router
from app.domains.hotel.api.rooms import router as hotel_rooms_router
from app.domains.hotel.api.service_requests import router as hotel_service_requests_router
from app.domains.iam.api.auth import router as iam_auth_router
from app.domains.iam.api.departments import router as iam_departments_router
from app.domains.iam.api.impersonation import router as iam_impersonation_router
from app.domains.iam.api.permissions import router as iam_permissions_router
from app.domains.iam.api.roles import router as iam_roles_router
from app.domains.iam.api.staff_users import router as iam_staff_users_router
from app.domains.inventory.api.inventory import router as inventory_items_router
from app.domains.inventory.api.stock import alerts_router as inventory_alerts_router
from app.domains.inventory.api.stock import router as inventory_stock_router
from app.domains.inventory.api.suppliers import router as inventory_suppliers_router
from app.domains.payments.api.admin_refund_requests import router as admin_refund_requests_router
from app.domains.payments.api.payments import router as payments_router
from app.domains.restaurant.api.customer_menu import router as restaurant_customer_menu_router
from app.domains.restaurant.api.dine_in_orders import router as restaurant_orders_router
from app.domains.restaurant.api.kitchen import router as restaurant_kitchen_router
from app.domains.restaurant.api.menu import router as restaurant_menu_router
from app.domains.restaurant.api.public_catalog import router as restaurant_public_router
from app.domains.restaurant.api.reservations import router as restaurant_reservations_router
from app.domains.restaurant.api.restaurants import router as restaurant_restaurants_router
from app.domains.restaurant.api.tables import router as restaurant_tables_router
from app.domains.restaurant.api.waiters import router as restaurant_waiters_router
from app.domains.settings.api.public_config import router as public_config_router
from app.domains.settings.api.settings import router as settings_router
from app.domains.reporting.api.dashboard import router as reporting_dashboard_router
from app.domains.reporting.api.reports import router as reporting_reports_router

api_router = APIRouter(prefix="/api/v1")

# --- Core / always-on (never module-gated) ---
api_router.include_router(public_config_router)
api_router.include_router(settings_router)

api_router.include_router(iam_auth_router)
api_router.include_router(iam_staff_users_router)
api_router.include_router(iam_roles_router)
api_router.include_router(iam_permissions_router)
api_router.include_router(iam_departments_router)
api_router.include_router(iam_impersonation_router)

api_router.include_router(hotel_guests_router)
api_router.include_router(customer_auth_router)
api_router.include_router(customer_profile_router)
api_router.include_router(customer_addresses_router)

api_router.include_router(inventory_items_router)
api_router.include_router(inventory_suppliers_router)
api_router.include_router(inventory_stock_router)
api_router.include_router(inventory_alerts_router)

api_router.include_router(payments_router)
api_router.include_router(admin_refund_requests_router)

# --- Hotel (module-gated: hotel_module_enabled) ---
_hotel_gate = [Depends(require_module_enabled("hotel"))]
api_router.include_router(hotel_hotels_router, dependencies=_hotel_gate)
api_router.include_router(hotel_public_router, dependencies=_hotel_gate)
api_router.include_router(hotel_rooms_router, dependencies=_hotel_gate)
api_router.include_router(hotel_bookings_router, dependencies=_hotel_gate)
api_router.include_router(hotel_checkin_router, dependencies=_hotel_gate)
api_router.include_router(hotel_checkout_router, dependencies=_hotel_gate)
api_router.include_router(hotel_housekeeping_router, dependencies=_hotel_gate)
api_router.include_router(hotel_invoices_router, dependencies=_hotel_gate)
api_router.include_router(hotel_service_requests_router, dependencies=_hotel_gate)

# --- Restaurant (module-gated: restaurant_module_enabled) ---
_restaurant_gate = [Depends(require_module_enabled("restaurant"))]
api_router.include_router(restaurant_restaurants_router, dependencies=_restaurant_gate)
api_router.include_router(restaurant_customer_menu_router, dependencies=_restaurant_gate)
api_router.include_router(restaurant_public_router, dependencies=_restaurant_gate)
api_router.include_router(restaurant_tables_router, dependencies=_restaurant_gate)
api_router.include_router(restaurant_reservations_router, dependencies=_restaurant_gate)
api_router.include_router(restaurant_menu_router, dependencies=_restaurant_gate)
api_router.include_router(restaurant_orders_router, dependencies=_restaurant_gate)
api_router.include_router(restaurant_kitchen_router, dependencies=_restaurant_gate)
api_router.include_router(restaurant_waiters_router, dependencies=_restaurant_gate)

# --- Delivery (module-gated: delivery_module_enabled) ---
_delivery_gate = [Depends(require_module_enabled("delivery"))]
api_router.include_router(delivery_orders_router, dependencies=_delivery_gate)
api_router.include_router(delivery_tracking_router, dependencies=_delivery_gate)
api_router.include_router(delivery_riders_router, dependencies=_delivery_gate)
api_router.include_router(delivery_assignments_router, dependencies=_delivery_gate)

# --- Reporting (core/always-on, read-only, no module gate — owns no tables) ---
api_router.include_router(reporting_dashboard_router)
api_router.include_router(reporting_reports_router)