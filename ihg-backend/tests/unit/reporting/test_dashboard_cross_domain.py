"""Phase 10 cross-domain e2e test — the acceptance-check scenario: a completed
hotel booking (paid invoice), a completed restaurant dine-in order (billed),
and a completed delivery order (delivered) must all be correctly reflected in
GET /reporting/dashboard's aggregated counts and revenue.

Located under tests/unit/reporting/, matching the established precedent set by
tests/unit/hotel/test_hotel_booking_flow.py, tests/unit/restaurant/
test_restaurant_flow.py, and tests/unit/delivery/test_delivery_flow.py: mixes
db_session-only fixtures and real client-driven HTTP tests under
tests/unit/<domain>/, not tests/integration/.

Uses a BEFORE/AFTER delta assertion, not absolute counts — per the standing
testing lesson formalized after a real bug in Phase 5 (PROJECT_STATE.md Open
Decision #39): asserting on the absolute state of shared, real-world entities
in a live database is fragile, since other data may already exist. Capturing
the dashboard's numbers before this test creates anything, then asserting the
delta after, is correct regardless of what else is in the database.

Reuses each domain's own established seeding/flow/cleanup patterns exactly:
  - Hotel: tests/unit/hotel/test_hotel_booking_flow.py (booking -> checkin ->
    checkout -> generate invoice -> ISSUE -> PAY -- this file goes one step
    further than that one, which stops at draft-invoice generation, because
    dashboard_service only counts invoices with status="paid").
  - Restaurant: tests/unit/restaurant/test_restaurant_flow.py (reserve -> seat
    -> place order -> kitchen ticket progression -> bill).
  - Delivery: tests/unit/delivery/test_delivery_flow.py (customer places order
    -> staff confirms/preps/ready -> rider assigned -> pickup -> deliver).
"""
import uuid
from datetime import date, datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio

from app.api.v1.deps import get_current_customer, get_current_staff_user
from app.domains.customers.models.customer import Customer
from app.domains.customers.repositories import customer_address_repository, customer_repository
from app.domains.hotel.repositories import hotel_repository, room_repository, room_type_repository
from app.domains.iam.models.staff_user import StaffUser
from app.domains.iam.repositories import role_repository, staff_user_repository
from app.domains.restaurant.repositories import dining_table_repository, menu_repository, restaurant_repository
from app.main import app

pytestmark = pytest.mark.asyncio

# Expected dollar amounts, fixed by the seed data below -- used to assert exact deltas.
_HOTEL_EXPECTED_REVENUE = 200.0  # 2 nights x $100.00/night
_RESTAURANT_EXPECTED_REVENUE = 25.0  # 2 x $12.50
_DELIVERY_EXPECTED_REVENUE = 30.0  # 2 x $15.00


async def _make_staff(db_session, *, role_name: str) -> StaffUser:
    """In-memory StaffUser bound to a real seeded role, mirroring every prior
    flow test's helper exactly.
    """
    role = await role_repository.get_by_name(db_session, role_name)
    assert role is not None, f"Role '{role_name}' must exist (run seed_data.py against the test DB)."
    return StaffUser(
        id=uuid.uuid4(),
        email=f"{role_name.lower()}-{uuid.uuid4().hex[:6]}@test.local",
        first_name="Test",
        last_name=role_name,
        role_id=role.id,
        role=role,
        is_active=True,
        is_superadmin=False,
    )


async def _make_rider_staff(db_session) -> StaffUser:
    """A REAL, persisted StaffUser row -- rider_service.create_rider() verifies
    staff_id via a real cross-domain call to iam.services.staff_service.get_staff(),
    mirroring test_delivery_flow.py's _make_rider_staff() exactly.
    """
    role = await role_repository.get_by_name(db_session, "Rider")
    assert role is not None, "Role 'Rider' must exist (run seed_data.py against the test DB)."
    return await staff_user_repository.create(
        db_session,
        email=f"rider-{uuid.uuid4().hex[:8]}@test.local",
        first_name="Test",
        last_name="Rider",
        role_id=role.id,
        is_active=True,
    )


async def _make_customer(db_session, *, verified: bool) -> Customer:
    customer = await customer_repository.create(
        db_session,
        email=f"cust-{uuid.uuid4().hex[:8]}@test.local",
        password_hash="not-a-real-hash",
        first_name="Test",
        last_name="Customer",
    )
    if verified:
        customer.email_verified_at = datetime.now(timezone.utc)
        customer = await customer_repository.save(db_session, customer)
    return customer


@pytest.fixture
def override_staff():
    holder = {}

    def _set(staff: StaffUser):
        holder["staff"] = staff
        app.dependency_overrides[get_current_staff_user] = lambda: holder["staff"]

    yield _set
    app.dependency_overrides.pop(get_current_staff_user, None)


@pytest.fixture
def override_customer():
    holder = {}

    def _set(customer: Customer):
        holder["customer"] = customer
        app.dependency_overrides[get_current_customer] = lambda: holder["customer"]

    yield _set
    app.dependency_overrides.pop(get_current_customer, None)


@pytest_asyncio.fixture
async def cleanup_cross_domain_rows(db_session):
    """Combines cleanup_hotel_rows, cleanup_restaurant_rows, and
    cleanup_delivery_rows's exact deletion patterns into one fixture, since
    this single test spans all three domains and commits mid-test (same
    reason as each of those three files -- see their docstrings).
    """
    from sqlalchemy import delete, select

    from app.domains.customers.models.customer import Customer as CustomerModel
    from app.domains.customers.models.customer_address import CustomerAddress
    from app.domains.delivery.models.delivery_assignment import DeliveryAssignment
    from app.domains.delivery.models.delivery_order import DeliveryOrder
    from app.domains.delivery.models.delivery_order_item import DeliveryOrderItem
    from app.domains.delivery.models.delivery_rider import DeliveryRider
    from app.domains.hotel.models.booking import Booking
    from app.domains.hotel.models.hotel import Hotel
    from app.domains.hotel.models.housekeeping_task import HousekeepingTask
    from app.domains.hotel.models.invoice import Invoice
    from app.domains.hotel.models.invoice_item import InvoiceItem
    from app.domains.hotel.models.room import Room
    from app.domains.hotel.models.room_type import RoomType
    from app.domains.iam.models.staff_user import StaffUser as StaffUserModel
    from app.domains.restaurant.models.dine_in_order import DineInOrder
    from app.domains.restaurant.models.dine_in_order_item import DineInOrderItem
    from app.domains.restaurant.models.dining_table import DiningTable
    from app.domains.restaurant.models.kitchen_ticket import KitchenTicket
    from app.domains.restaurant.models.menu_category import MenuCategory
    from app.domains.restaurant.models.menu_item import MenuItem
    from app.domains.restaurant.models.restaurant import Restaurant
    from app.domains.restaurant.models.table_reservation import TableReservation
    from app.domains.restaurant.models.waiter_assignment import WaiterAssignment

    state = {"hotel_ids": [], "restaurant_ids": [], "customer_ids": [], "rider_staff_ids": []}
    yield state

    # --- Hotel: most-dependent tables first ---
    for hotel_id in state["hotel_ids"]:
        room_ids = [
            r[0] for r in (await db_session.execute(select(Room.id).where(Room.hotel_id == hotel_id))).all()
        ]
        booking_ids = []
        if room_ids:
            booking_ids = [
                b[0]
                for b in (
                    await db_session.execute(select(Booking.id).where(Booking.room_id.in_(room_ids)))
                ).all()
            ]
        if booking_ids:
            invoice_ids = [
                i[0]
                for i in (
                    await db_session.execute(select(Invoice.id).where(Invoice.booking_id.in_(booking_ids)))
                ).all()
            ]
            if invoice_ids:
                await db_session.execute(delete(InvoiceItem).where(InvoiceItem.invoice_id.in_(invoice_ids)))
                await db_session.execute(delete(Invoice).where(Invoice.id.in_(invoice_ids)))
            await db_session.execute(
                delete(HousekeepingTask).where(HousekeepingTask.booking_id.in_(booking_ids))
            )
            await db_session.execute(delete(Booking).where(Booking.id.in_(booking_ids)))
        if room_ids:
            await db_session.execute(delete(HousekeepingTask).where(HousekeepingTask.room_id.in_(room_ids)))
            await db_session.execute(delete(Room).where(Room.id.in_(room_ids)))
        await db_session.execute(delete(RoomType).where(RoomType.hotel_id == hotel_id))
        await db_session.execute(delete(Hotel).where(Hotel.id == hotel_id))

    # --- Restaurant: most-dependent tables first ---
    for restaurant_id in state["restaurant_ids"]:
        table_ids = [
            r[0]
            for r in (
                await db_session.execute(select(DiningTable.id).where(DiningTable.restaurant_id == restaurant_id))
            ).all()
        ]
        order_ids = []
        if table_ids:
            order_ids = [
                o[0]
                for o in (
                    await db_session.execute(select(DineInOrder.id).where(DineInOrder.table_id.in_(table_ids)))
                ).all()
            ]
        if order_ids:
            await db_session.execute(delete(KitchenTicket).where(KitchenTicket.order_id.in_(order_ids)))
            await db_session.execute(delete(DineInOrderItem).where(DineInOrderItem.order_id.in_(order_ids)))
            await db_session.execute(delete(DineInOrder).where(DineInOrder.id.in_(order_ids)))
        if table_ids:
            await db_session.execute(delete(TableReservation).where(TableReservation.table_id.in_(table_ids)))
            await db_session.execute(delete(WaiterAssignment).where(WaiterAssignment.table_id.in_(table_ids)))
            await db_session.execute(delete(DiningTable).where(DiningTable.id.in_(table_ids)))
        category_ids = [
            c[0]
            for c in (
                await db_session.execute(
                    select(MenuCategory.id).where(MenuCategory.restaurant_id == restaurant_id)
                )
            ).all()
        ]
        if category_ids:
            await db_session.execute(delete(MenuItem).where(MenuItem.category_id.in_(category_ids)))
            await db_session.execute(delete(MenuCategory).where(MenuCategory.id.in_(category_ids)))
        await db_session.execute(delete(Restaurant).where(Restaurant.id == restaurant_id))

    # --- Delivery + customer ---
    delivery_order_ids = []
    if state["customer_ids"]:
        delivery_order_ids = [
            o[0]
            for o in (
                await db_session.execute(
                    select(DeliveryOrder.id).where(DeliveryOrder.customer_id.in_(state["customer_ids"]))
                )
            ).all()
        ]
    if delivery_order_ids:
        await db_session.execute(
            delete(DeliveryAssignment).where(DeliveryAssignment.order_id.in_(delivery_order_ids))
        )
        await db_session.execute(
            delete(DeliveryOrderItem).where(DeliveryOrderItem.order_id.in_(delivery_order_ids))
        )
        await db_session.execute(delete(DeliveryOrder).where(DeliveryOrder.id.in_(delivery_order_ids)))

    if state["rider_staff_ids"]:
        await db_session.execute(
            delete(DeliveryRider).where(DeliveryRider.staff_id.in_(state["rider_staff_ids"]))
        )
        await db_session.execute(delete(StaffUserModel).where(StaffUserModel.id.in_(state["rider_staff_ids"])))

    if state["customer_ids"]:
        await db_session.execute(
            delete(CustomerAddress).where(CustomerAddress.customer_id.in_(state["customer_ids"]))
        )
        await db_session.execute(delete(CustomerModel).where(CustomerModel.id.in_(state["customer_ids"])))

    await db_session.commit()


@patch(
    "app.domains.hotel.services.booking_service._verify_guest_exists",
    new_callable=AsyncMock,
    return_value=None,
)
async def test_dashboard_reflects_completed_hotel_restaurant_delivery_activity(
    _mock_guest_check, client, db_session, override_staff, override_customer, cleanup_cross_domain_rows
):
    """The core Phase 10 acceptance-check scenario: complete one full flow in
    each of hotel/restaurant/delivery, then confirm GET /reporting/dashboard's
    counts and revenue reflect exactly that activity (as a delta against a
    baseline captured before any of it happened).
    """
    admin = await _make_staff(db_session, role_name="Admin")
    override_staff(admin)

    # --- Baseline: dashboard numbers BEFORE this test creates anything --------------
    baseline_resp = await client.get("/api/v1/reporting/dashboard")
    assert baseline_resp.status_code == 200, baseline_resp.text
    baseline = baseline_resp.json()["data"]

    # =================================================================================
    # HOTEL: booking -> check-in -> check-out -> generate invoice -> issue -> pay
    # =================================================================================
    hotel = await hotel_repository.create(db_session, name="Dashboard Test Hotel", is_active=True)
    room_type = await room_type_repository.create(
        db_session, hotel_id=hotel.id, name="Standard", base_rate=100.00, capacity=2
    )
    room = await room_repository.create(
        db_session, hotel_id=hotel.id, room_type_id=room_type.id, room_number="D1", is_active=True
    )
    await db_session.commit()
    cleanup_cross_domain_rows["hotel_ids"].append(hotel.id)

    guest_id = uuid.uuid4()
    check_in = date.today() + timedelta(days=1)
    check_out = check_in + timedelta(days=2)  # 2 nights x $100 = $200

    resp = await client.post(
        "/api/v1/hotel/bookings",
        json={
            "hotel_id": str(hotel.id),
            "room_id": str(room.id),
            "guest_id": str(guest_id),
            "check_in_date": check_in.isoformat(),
            "check_out_date": check_out.isoformat(),
        },
    )
    assert resp.status_code == 200, resp.text
    booking_id = resp.json()["data"]["id"]

    resp = await client.post(f"/api/v1/hotel/checkin/{booking_id}")
    assert resp.status_code == 200, resp.text

    resp = await client.post(f"/api/v1/hotel/checkout/{booking_id}")
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"]["total_amount"] == _HOTEL_EXPECTED_REVENUE

    resp = await client.post(f"/api/v1/hotel/invoices/generate/{booking_id}")
    assert resp.status_code == 200, resp.text
    invoice_id = resp.json()["data"]["id"]

    resp = await client.post(f"/api/v1/hotel/invoices/{invoice_id}/issue")
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"]["status"] == "issued"

    resp = await client.post(f"/api/v1/hotel/invoices/{invoice_id}/pay", json={})
    assert resp.status_code == 200, resp.text
    paid_invoice = resp.json()["data"]
    assert paid_invoice["status"] == "paid"
    assert paid_invoice["total_amount"] == _HOTEL_EXPECTED_REVENUE

    # =================================================================================
    # RESTAURANT: reserve -> seat -> order -> kitchen ticket -> serve -> bill
    # =================================================================================
    restaurant = await restaurant_repository.create(db_session, name="Dashboard Test Bistro", is_active=True)
    table = await dining_table_repository.create(
        db_session, restaurant_id=restaurant.id, table_number="D1", capacity=4, is_active=True
    )
    category = await menu_repository.create_category(
        db_session, restaurant_id=restaurant.id, name="Mains", display_order=0, is_active=True
    )
    item = await menu_repository.create_item(
        db_session,
        restaurant_id=restaurant.id,
        category_id=category.id,
        name="Dashboard Test Dish",
        description="Test item.",
        price=12.50,
        is_available=True,
        inventory_item_id=None,
        inventory_qty_per_unit=None,
    )
    await db_session.commit()
    cleanup_cross_domain_rows["restaurant_ids"].append(restaurant.id)

    reservation_time = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
    resp = await client.post(
        "/api/v1/restaurant/reservations",
        json={
            "restaurant_id": str(restaurant.id),
            "table_id": str(table.id),
            "customer_name": "Dashboard Diner",
            "customer_phone": "555-0199",
            "reservation_time": reservation_time,
            "party_size": 2,
        },
    )
    assert resp.status_code == 200, resp.text
    reservation_id = resp.json()["data"]["id"]

    resp = await client.post(f"/api/v1/restaurant/reservations/{reservation_id}/seat")
    assert resp.status_code == 200, resp.text

    resp = await client.post(
        "/api/v1/restaurant/orders",
        json={
            "restaurant_id": str(restaurant.id),
            "table_id": str(table.id),
            "reservation_id": reservation_id,
            "items": [{"menu_item_id": str(item.id), "quantity": 2}],
        },
    )
    assert resp.status_code == 200, resp.text
    order = resp.json()["data"]
    order_id = order["id"]
    assert order["total_amount"] == _RESTAURANT_EXPECTED_REVENUE

    resp = await client.get("/api/v1/restaurant/kitchen", params={"status": "pending"})
    assert resp.status_code == 200, resp.text
    ticket_id = next(t["id"] for t in resp.json()["data"] if t["order_id"] == order_id)

    for status_value in ("preparing", "ready", "served"):
        resp = await client.put(
            f"/api/v1/restaurant/kitchen/{ticket_id}/status", json={"status": status_value}
        )
        assert resp.status_code == 200, resp.text

    resp = await client.post(f"/api/v1/restaurant/orders/{order_id}/bill")
    assert resp.status_code == 200, resp.text
    billed_order = resp.json()["data"]
    assert billed_order["status"] == "billed"
    assert billed_order["total_amount"] == _RESTAURANT_EXPECTED_REVENUE

    # =================================================================================
    # DELIVERY: customer places order -> confirm/preparing/ready -> assign rider
    # -> pickup -> deliver
    # =================================================================================
    customer = await _make_customer(db_session, verified=True)
    cleanup_cross_domain_rows["customer_ids"].append(customer.id)
    address = await customer_address_repository.create(
        db_session,
        customer_id=customer.id,
        label="Home",
        address_line1="1 Dashboard Test Ave",
        city="Dhaka",
        country="Bangladesh",
    )
    delivery_restaurant = await restaurant_repository.create(
        db_session, name="Dashboard Test Delivery Kitchen", is_active=True
    )
    delivery_category = await menu_repository.create_category(
        db_session, restaurant_id=delivery_restaurant.id, name="Mains", display_order=0, is_active=True
    )
    delivery_item = await menu_repository.create_item(
        db_session,
        restaurant_id=delivery_restaurant.id,
        category_id=delivery_category.id,
        name="Dashboard Delivery Dish",
        description="Test item.",
        price=15.00,
        is_available=True,
        inventory_item_id=None,
        inventory_qty_per_unit=None,
    )
    rider_staff = await _make_rider_staff(db_session)
    cleanup_cross_domain_rows["rider_staff_ids"].append(rider_staff.id)
    cleanup_cross_domain_rows["restaurant_ids"].append(delivery_restaurant.id)
    await db_session.commit()

    override_customer(customer)
    resp = await client.post(
        "/api/v1/delivery/orders",
        json={
            "restaurant_id": str(delivery_restaurant.id),
            "delivery_address_id": str(address.id),
            "items": [{"menu_item_id": str(delivery_item.id), "quantity": 2}],
        },
    )
    assert resp.status_code == 200, resp.text
    delivery_order = resp.json()["data"]
    delivery_order_id = delivery_order["id"]
    assert delivery_order["total_amount"] == _DELIVERY_EXPECTED_REVENUE

    override_staff(admin)
    for action in ("confirm", "preparing", "ready"):
        resp = await client.post(f"/api/v1/delivery/tracking/{delivery_order_id}/{action}")
        assert resp.status_code == 200, resp.text

    resp = await client.post(
        "/api/v1/delivery/riders", json={"staff_id": str(rider_staff.id), "vehicle_type": "bike"}
    )
    assert resp.status_code == 200, resp.text
    rider = resp.json()["data"]

    resp = await client.put(f"/api/v1/delivery/riders/{rider['id']}/status", json={"status": "available"})
    assert resp.status_code == 200, resp.text

    resp = await client.post(
        "/api/v1/delivery/assignments", json={"order_id": delivery_order_id, "rider_id": rider["id"]}
    )
    assert resp.status_code == 200, resp.text

    override_staff(rider_staff)
    resp = await client.post(f"/api/v1/delivery/tracking/{delivery_order_id}/pickup")
    assert resp.status_code == 200, resp.text

    resp = await client.post(f"/api/v1/delivery/tracking/{delivery_order_id}/deliver")
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"]["status"] == "delivered"

    # =================================================================================
    # DASHBOARD: confirm the delta reflects exactly what was just completed
    # =================================================================================
    override_staff(admin)
    after_resp = await client.get("/api/v1/reporting/dashboard")
    assert after_resp.status_code == 200, after_resp.text
    after = after_resp.json()["data"]

    hotel_revenue_delta = after["hotel"]["revenue"] - baseline["hotel"]["revenue"]
    hotel_paid_delta = after["hotel"]["paid_invoices_count"] - baseline["hotel"]["paid_invoices_count"]
    assert hotel_revenue_delta == pytest.approx(_HOTEL_EXPECTED_REVENUE)
    assert hotel_paid_delta == 1

    restaurant_revenue_delta = after["restaurant"]["revenue"] - baseline["restaurant"]["revenue"]
    restaurant_billed_delta = (
        after["restaurant"]["billed_orders_count"] - baseline["restaurant"]["billed_orders_count"]
    )
    assert restaurant_revenue_delta == pytest.approx(_RESTAURANT_EXPECTED_REVENUE)
    assert restaurant_billed_delta == 1

    delivery_revenue_delta = after["delivery"]["revenue"] - baseline["delivery"]["revenue"]
    delivery_delivered_delta = (
        after["delivery"]["delivered_orders_count"] - baseline["delivery"]["delivered_orders_count"]
    )
    assert delivery_revenue_delta == pytest.approx(_DELIVERY_EXPECTED_REVENUE)
    assert delivery_delivered_delta == 1

    total_revenue_delta = after["total_revenue"] - baseline["total_revenue"]
    expected_total_delta = _HOTEL_EXPECTED_REVENUE + _RESTAURANT_EXPECTED_REVENUE + _DELIVERY_EXPECTED_REVENUE
    assert total_revenue_delta == pytest.approx(expected_total_delta)


async def test_dashboard_date_range_excludes_out_of_range_activity(
    client, db_session, override_staff, cleanup_cross_domain_rows
):
    """A narrow date_from/date_to window that predates any activity in this test
    file must show zero for this file's own data — confirms the date-range
    filter genuinely filters, not just accepts and ignores the params.
    """
    admin = await _make_staff(db_session, role_name="Admin")
    override_staff(admin)

    restaurant = await restaurant_repository.create(db_session, name="Date Filter Test Bistro", is_active=True)
    table = await dining_table_repository.create(
        db_session, restaurant_id=restaurant.id, table_number="F1", capacity=2, is_active=True
    )
    category = await menu_repository.create_category(
        db_session, restaurant_id=restaurant.id, name="Mains", display_order=0, is_active=True
    )
    item = await menu_repository.create_item(
        db_session,
        restaurant_id=restaurant.id,
        category_id=category.id,
        name="Date Filter Test Dish",
        description="Test item.",
        price=9.99,
        is_available=True,
        inventory_item_id=None,
        inventory_qty_per_unit=None,
    )
    await db_session.commit()
    cleanup_cross_domain_rows["restaurant_ids"].append(restaurant.id)

    resp = await client.post(
        "/api/v1/restaurant/orders",
        json={
            "restaurant_id": str(restaurant.id),
            "table_id": str(table.id),
            "items": [{"menu_item_id": str(item.id), "quantity": 1}],
        },
    )
    assert resp.status_code == 200, resp.text
    order_id = resp.json()["data"]["id"]

    resp = await client.get("/api/v1/restaurant/kitchen", params={"status": "pending"})
    ticket_id = next(t["id"] for t in resp.json()["data"] if t["order_id"] == order_id)
    for status_value in ("preparing", "ready", "served"):
        resp = await client.put(
            f"/api/v1/restaurant/kitchen/{ticket_id}/status", json={"status": status_value}
        )
        assert resp.status_code == 200, resp.text
    resp = await client.post(f"/api/v1/restaurant/orders/{order_id}/bill")
    assert resp.status_code == 200, resp.text

    # A window entirely in the past (year 2000) must not include today's order.
    resp = await client.get(
        "/api/v1/reporting/dashboard",
        params={"date_from": "2000-01-01", "date_to": "2000-01-31"},
    )
    assert resp.status_code == 200, resp.text
    filtered = resp.json()["data"]
    assert filtered["date_from"] == "2000-01-01"
    assert filtered["date_to"] == "2000-01-31"
    # Cannot assert absolute zero (other data may exist from 2000-01 in a live
    # DB in principle), but this test's own order/revenue must not appear —
    # verified via the report endpoint instead, which returns row-level data.
    report_resp = await client.get(
        "/api/v1/reporting/reports/revenue",
        params={"domain": "restaurant", "date_from": "2000-01-01", "date_to": "2000-01-31"},
    )
    assert report_resp.status_code == 200, report_resp.text
    report_rows = report_resp.json()["data"]["rows"]
    assert not any(row[0] == order_id for row in report_rows)