"""Full dine-in lifecycle — reserve table -> seat -> place order -> kitchen
ticket created -> kitchen advances ticket -> bill generated — plus the
Waiter/Kitchen role permission-split acceptance check from the Phase 8 task
spec.

Located under tests/unit/restaurant/, not tests/integration/, matching the
established precedent set by tests/unit/hotel/test_hotel_booking_flow.py
(itself following tests/unit/payments/test_refund_workflow.py's lead): mixes
db_session-only fixtures and real client-driven HTTP tests in the same file
under tests/unit/<domain>/. tests/integration/*.py remain empty planned
placeholders until whichever later phase (if any) populates them.

No inventory item is linked to the seeded menu item in either test below —
dine_in_order_service.place_order() skips inventory consumption entirely when
MenuItem.inventory_item_id is None (see that model's docstring), so this file
deliberately avoids needing to seed a real inventory item/stock row just to
exercise the reserve-to-bill flow. Inventory consumption itself is exercised
at the inventory domain's own test layer (adjust_stock() is a thin, already-
tested single entry point — see tests/unit/inventory/test_stock_transaction.py)
and is not re-tested here.

Follows the same mid-test-commit / explicit-cleanup pattern
tests/unit/hotel/test_hotel_booking_flow.py established: this file's tests use
the `client` fixture (a separate DB connection/session from `db_session`), so
seed data created via `db_session` must be committed before `client` can see
it — which defeats db_session's normal rollback-only cleanup contract. The
cleanup_restaurant_rows fixture below deletes everything explicitly, most-
dependent tables first, mirroring cleanup_hotel_rows's structure exactly.
"""
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio

from app.api.v1.deps import get_current_staff_user
from app.domains.iam.models.staff_user import StaffUser
from app.domains.iam.repositories import role_repository
from app.domains.restaurant.repositories import dining_table_repository, menu_repository, restaurant_repository
from app.main import app

pytestmark = pytest.mark.asyncio


async def _make_staff(db_session, *, role_name: str) -> StaffUser:
    """Build an in-memory StaffUser bound to a real seeded role, for use with
    app.dependency_overrides[get_current_staff_user]. Does not hit auth/login.
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


async def _seed_restaurant_menu_table(db_session):
    """Restaurant + one dining table + one menu category + one $12.50 menu item
    (no inventory linkage — see module docstring).
    """
    restaurant = await restaurant_repository.create(db_session, name="Test Bistro", is_active=True)
    table = await dining_table_repository.create(
        db_session, restaurant_id=restaurant.id, table_number="T1", capacity=4, is_active=True
    )
    category = await menu_repository.create_category(
        db_session, restaurant_id=restaurant.id, name="Mains", display_order=0, is_active=True
    )
    item = await menu_repository.create_item(
        db_session,
        restaurant_id=restaurant.id,
        category_id=category.id,
        name="Grilled Salmon",
        description="Served with seasonal vegetables.",
        price=12.50,
        is_available=True,
        inventory_item_id=None,
        inventory_qty_per_unit=None,
    )
    await db_session.commit()
    return restaurant, table, category, item


@pytest.fixture
def override_staff():
    """Override get_current_staff_user for the duration of one test."""
    holder = {}

    def _set(staff: StaffUser):
        holder["staff"] = staff
        app.dependency_overrides[get_current_staff_user] = lambda: holder["staff"]

    yield _set
    app.dependency_overrides.pop(get_current_staff_user, None)


@pytest_asyncio.fixture
async def cleanup_restaurant_rows(db_session):
    """Mirrors tests/unit/hotel/test_hotel_booking_flow.py's cleanup_hotel_rows
    fixture exactly: these tests commit mid-test (needed so the `client`
    fixture's separate DB connection can see seeded rows), which defeats
    db_session's normal rollback-only cleanup contract. Explicitly delete
    everything this file creates instead, most-dependent tables first.
    """
    from sqlalchemy import delete, select

    from app.domains.restaurant.models.dine_in_order import DineInOrder
    from app.domains.restaurant.models.dine_in_order_item import DineInOrderItem
    from app.domains.restaurant.models.dining_table import DiningTable
    from app.domains.restaurant.models.kitchen_ticket import KitchenTicket
    from app.domains.restaurant.models.menu_category import MenuCategory
    from app.domains.restaurant.models.menu_item import MenuItem
    from app.domains.restaurant.models.restaurant import Restaurant
    from app.domains.restaurant.models.table_reservation import TableReservation
    from app.domains.restaurant.models.waiter_assignment import WaiterAssignment

    created_restaurant_ids = []
    yield created_restaurant_ids

    for restaurant_id in created_restaurant_ids:
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
                await db_session.execute(select(MenuCategory.id).where(MenuCategory.restaurant_id == restaurant_id))
            ).all()
        ]
        if category_ids:
            await db_session.execute(delete(MenuItem).where(MenuItem.category_id.in_(category_ids)))
            await db_session.execute(delete(MenuCategory).where(MenuCategory.id.in_(category_ids)))
        await db_session.execute(delete(Restaurant).where(Restaurant.id == restaurant_id))
    await db_session.commit()


async def test_full_reserve_to_bill_flow(client, db_session, override_staff, cleanup_restaurant_rows):
    """reserve table -> seat -> place order -> kitchen ticket created ->
    kitchen advances ticket (order status stays in sync) -> bill generated.
    """
    admin = await _make_staff(db_session, role_name="Admin")
    override_staff(admin)

    restaurant, table, category, item = await _seed_restaurant_menu_table(db_session)
    cleanup_restaurant_rows.append(restaurant.id)

    reservation_time = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()

    # --- Reserve --------------------------------------------------------------------
    resp = await client.post(
        "/api/v1/restaurant/reservations",
        json={
            "restaurant_id": str(restaurant.id),
            "table_id": str(table.id),
            "customer_name": "Jane Diner",
            "customer_phone": "555-0100",
            "reservation_time": reservation_time,
            "party_size": 2,
        },
    )
    assert resp.status_code == 200, resp.text
    reservation = resp.json()["data"]
    reservation_id = reservation["id"]
    assert reservation["status"] == "reserved"

    resp = await client.get(f"/api/v1/restaurant/tables/{table.id}")
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"]["status"] == "reserved"

    # --- Seat -------------------------------------------------------------------------
    resp = await client.post(f"/api/v1/restaurant/reservations/{reservation_id}/seat")
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"]["status"] == "seated"

    resp = await client.get(f"/api/v1/restaurant/tables/{table.id}")
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"]["status"] == "occupied"

    # --- Place order --------------------------------------------------------------------
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
    assert order["status"] == "placed"
    assert order["subtotal"] == 25.0  # 2 x 12.50
    assert order["total_amount"] == 25.0

    # --- Kitchen ticket auto-created --------------------------------------------------
    resp = await client.get("/api/v1/restaurant/kitchen", params={"status": "pending"})
    assert resp.status_code == 200, resp.text
    tickets = resp.json()["data"]
    matching = [t for t in tickets if t["order_id"] == order_id]
    assert len(matching) == 1, f"Expected exactly one pending kitchen ticket for order {order_id}"
    ticket_id = matching[0]["id"]

    # Ticket detail embeds order items directly — no restaurant:order:read needed.
    resp = await client.get(f"/api/v1/restaurant/kitchen/{ticket_id}")
    assert resp.status_code == 200, resp.text
    detail = resp.json()["data"]
    assert detail["table_id"] == str(table.id)
    assert len(detail["items"]) == 1
    assert detail["items"][0]["quantity"] == 2

    # --- Kitchen advances the ticket; order status stays in sync ---------------------
    resp = await client.put(f"/api/v1/restaurant/kitchen/{ticket_id}/status", json={"status": "preparing"})
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"]["status"] == "preparing"

    resp = await client.get(f"/api/v1/restaurant/orders/{order_id}")
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"]["status"] == "preparing"

    resp = await client.put(f"/api/v1/restaurant/kitchen/{ticket_id}/status", json={"status": "ready"})
    assert resp.status_code == 200, resp.text

    resp = await client.get(f"/api/v1/restaurant/orders/{order_id}")
    assert resp.json()["data"]["status"] == "ready"

    resp = await client.put(f"/api/v1/restaurant/kitchen/{ticket_id}/status", json={"status": "served"})
    assert resp.status_code == 200, resp.text

    resp = await client.get(f"/api/v1/restaurant/orders/{order_id}")
    assert resp.json()["data"]["status"] == "served"

    # --- Bill generated ----------------------------------------------------------------
    resp = await client.post(f"/api/v1/restaurant/orders/{order_id}/bill")
    assert resp.status_code == 200, resp.text
    billed = resp.json()["data"]
    assert billed["status"] == "billed"
    assert billed["total_amount"] == 25.0


async def test_waiter_and_kitchen_role_permission_split(
    client, db_session, override_staff, cleanup_restaurant_rows
):
    """Waiter can place a dine-in order but is correctly rejected creating a
    menu item (403). Kitchen can update a kitchen ticket's status but is
    correctly rejected reading the tables list (403) — the exact acceptance
    check from the Phase 8 task spec.
    """
    admin = await _make_staff(db_session, role_name="Admin")
    override_staff(admin)
    restaurant, table, category, item = await _seed_restaurant_menu_table(db_session)
    cleanup_restaurant_rows.append(restaurant.id)

    # --- Waiter: can place an order, cannot edit the menu -----------------------------
    waiter = await _make_staff(db_session, role_name="Waiter")
    override_staff(waiter)

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

    resp = await client.post(
        "/api/v1/restaurant/menu/items",
        json={
            "restaurant_id": str(restaurant.id),
            "category_id": str(category.id),
            "name": "Unauthorized Item",
            "price": 5.0,
        },
    )
    assert resp.status_code == 403, resp.text

    # --- Kitchen: can update the ticket, cannot read the tables list -----------------
    # Ticket lookup done back under the Admin override — Waiter deliberately
    # holds no restaurant:kitchen:read grant (see DEFAULT_ROLES), so this isn't
    # something a Waiter could do either; only Admin/Kitchen can list tickets.
    override_staff(admin)
    resp = await client.get("/api/v1/restaurant/kitchen", params={"status": "pending"})
    assert resp.status_code == 200, resp.text
    ticket_id = next(t["id"] for t in resp.json()["data"] if t["order_id"] == order_id)

    kitchen_staff = await _make_staff(db_session, role_name="Kitchen")
    override_staff(kitchen_staff)

    resp = await client.put(f"/api/v1/restaurant/kitchen/{ticket_id}/status", json={"status": "preparing"})
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"]["status"] == "preparing"

    resp = await client.get("/api/v1/restaurant/tables", params={"restaurant_id": str(restaurant.id)})
    assert resp.status_code == 403, resp.text