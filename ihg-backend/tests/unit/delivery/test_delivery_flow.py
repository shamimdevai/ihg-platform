"""Full delivery lifecycle — customer places order -> staff confirms/prepares
/marks ready -> rider assigned -> rider picks up -> rider delivers -- plus the
Phase 9 acceptance check that an unverified customer is blocked from placing
a delivery order by app.api.v1.deps.require_verified_customer() (Phase 4's
stub, finally wired to a live endpoint this phase), not a hand-rolled check.

Located under tests/unit/delivery/, not tests/integration/, matching the
established precedent set by tests/unit/hotel/test_hotel_booking_flow.py and
tests/unit/restaurant/test_restaurant_flow.py: mixes db_session-only fixtures
and real client-driven HTTP tests in the same file under
tests/unit/<domain>/. tests/integration/*.py remain empty planned
placeholders.

No inventory item is linked to the seeded menu item, mirroring
test_restaurant_flow.py's precedent exactly — inventory consumption itself is
already exercised at the inventory domain's own test layer and is not
re-tested here.

Follows the same mid-test-commit / explicit-cleanup pattern
tests/unit/hotel/test_hotel_booking_flow.py and
tests/unit/restaurant/test_restaurant_flow.py established: this file's tests
use the `client` fixture (a separate DB connection/session from `db_session`),
so seed data created via `db_session` must be committed before `client` can
see it — which defeats db_session's normal rollback-only cleanup contract.
The cleanup_delivery_rows fixture below deletes everything explicitly,
most-dependent tables first.
"""
import uuid
from datetime import datetime, timezone

import pytest
import pytest_asyncio

from app.api.v1.deps import get_current_customer, get_current_staff_user
from app.domains.customers.models.customer import Customer
from app.domains.customers.repositories import customer_address_repository, customer_repository
from app.domains.iam.models.staff_user import StaffUser
from app.domains.iam.repositories import role_repository, staff_user_repository
from app.domains.restaurant.repositories import menu_repository, restaurant_repository
from app.main import app

pytestmark = pytest.mark.asyncio


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


async def _make_rider_staff(db_session) -> StaffUser:
    """A REAL, persisted StaffUser row — unlike _make_staff() below, this one
    must actually exist in the database because
    rider_service.create_rider() verifies staff_id via a real cross-domain
    call to iam.services.staff_service.get_staff().
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


async def _make_staff(db_session, *, role_name: str) -> StaffUser:
    """In-memory-only StaffUser for roles other than Rider, mirroring
    tests/unit/restaurant/test_restaurant_flow.py's _make_staff() exactly —
    safe here because delivery_order_service/delivery_tracking_service never
    call staff_service.get_staff() for anything except rider_service.create_rider().
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


async def _seed_restaurant_menu(db_session):
    restaurant = await restaurant_repository.create(db_session, name="Test Delivery Kitchen", is_active=True)
    category = await menu_repository.create_category(
        db_session, restaurant_id=restaurant.id, name="Mains", display_order=0, is_active=True
    )
    item = await menu_repository.create_item(
        db_session,
        restaurant_id=restaurant.id,
        category_id=category.id,
        name="Chicken Biryani",
        description="Serves 1.",
        price=15.00,
        is_available=True,
        inventory_item_id=None,
        inventory_qty_per_unit=None,
    )
    return restaurant, category, item


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
async def cleanup_delivery_rows(db_session):
    """Mirrors cleanup_hotel_rows / cleanup_restaurant_rows exactly: these
    tests commit mid-test (needed so the `client` fixture's separate DB
    connection can see seeded rows), which defeats db_session's normal
    rollback-only cleanup contract. Explicitly delete everything this file
    creates instead, most-dependent tables first.

    The state dict's lists are appended to by each test as it creates rows;
    teardown reads them back to know what to clean up.
    """
    from sqlalchemy import delete, select

    from app.domains.customers.models.customer import Customer as CustomerModel
    from app.domains.customers.models.customer_address import CustomerAddress
    from app.domains.delivery.models.delivery_assignment import DeliveryAssignment
    from app.domains.delivery.models.delivery_order import DeliveryOrder
    from app.domains.delivery.models.delivery_order_item import DeliveryOrderItem
    from app.domains.delivery.models.delivery_rider import DeliveryRider
    from app.domains.iam.models.staff_user import StaffUser as StaffUserModel
    from app.domains.restaurant.models.menu_category import MenuCategory
    from app.domains.restaurant.models.menu_item import MenuItem
    from app.domains.restaurant.models.restaurant import Restaurant

    state = {"restaurant_ids": [], "customer_ids": [], "rider_staff_ids": []}
    yield state

    order_ids = []
    if state["customer_ids"]:
        order_ids = [
            o[0]
            for o in (
                await db_session.execute(
                    select(DeliveryOrder.id).where(DeliveryOrder.customer_id.in_(state["customer_ids"]))
                )
            ).all()
        ]
    if order_ids:
        await db_session.execute(delete(DeliveryAssignment).where(DeliveryAssignment.order_id.in_(order_ids)))
        await db_session.execute(delete(DeliveryOrderItem).where(DeliveryOrderItem.order_id.in_(order_ids)))
        await db_session.execute(delete(DeliveryOrder).where(DeliveryOrder.id.in_(order_ids)))

    if state["rider_staff_ids"]:
        await db_session.execute(
            delete(DeliveryRider).where(DeliveryRider.staff_id.in_(state["rider_staff_ids"]))
        )
        await db_session.execute(delete(StaffUserModel).where(StaffUserModel.id.in_(state["rider_staff_ids"])))

    for restaurant_id in state["restaurant_ids"]:
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

    if state["customer_ids"]:
        await db_session.execute(
            delete(CustomerAddress).where(CustomerAddress.customer_id.in_(state["customer_ids"]))
        )
        await db_session.execute(delete(CustomerModel).where(CustomerModel.id.in_(state["customer_ids"])))

    await db_session.commit()


async def test_full_order_to_delivery_flow(
    client, db_session, override_staff, override_customer, cleanup_delivery_rows
):
    """customer places order -> staff confirms/preps/marks ready -> rider
    assigned -> rider picks up -> rider delivers -> customer sees final status.
    """
    customer = await _make_customer(db_session, verified=True)
    cleanup_delivery_rows["customer_ids"].append(customer.id)
    address = await customer_address_repository.create(
        db_session,
        customer_id=customer.id,
        label="Home",
        address_line1="123 Test Street",
        city="Dhaka",
        country="Bangladesh",
    )
    restaurant, category, item = await _seed_restaurant_menu(db_session)
    cleanup_delivery_rows["restaurant_ids"].append(restaurant.id)

    rider_staff = await _make_rider_staff(db_session)
    cleanup_delivery_rows["rider_staff_ids"].append(rider_staff.id)
    await db_session.commit()

    override_customer(customer)

    # --- Customer places the order -----------------------------------------------------
    resp = await client.post(
        "/api/v1/delivery/orders",
        json={
            "restaurant_id": str(restaurant.id),
            "delivery_address_id": str(address.id),
            "items": [{"menu_item_id": str(item.id), "quantity": 2}],
        },
    )
    assert resp.status_code == 200, resp.text
    order = resp.json()["data"]
    order_id = order["id"]
    assert order["status"] == "placed"
    assert order["subtotal"] == 30.0  # 2 x 15.00
    assert order["total_amount"] == 30.0

    resp = await client.get(f"/api/v1/delivery/orders/mine/{order_id}")
    assert resp.status_code == 200, resp.text
    detail = resp.json()["data"]
    assert len(detail["items"]) == 1
    assert detail["items"][0]["quantity"] == 2

    # --- Staff (Admin) progresses the order through confirm/preparing/ready ----------
    admin = await _make_staff(db_session, role_name="Admin")
    override_staff(admin)

    resp = await client.post(f"/api/v1/delivery/tracking/{order_id}/confirm")
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"]["status"] == "confirmed"

    resp = await client.post(f"/api/v1/delivery/tracking/{order_id}/preparing")
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"]["status"] == "preparing"

    resp = await client.post(f"/api/v1/delivery/tracking/{order_id}/ready")
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"]["status"] == "ready_for_pickup"

    # --- Dispatch: create a rider profile, mark it available, assign it --------------
    resp = await client.post(
        "/api/v1/delivery/riders", json={"staff_id": str(rider_staff.id), "vehicle_type": "bike"}
    )
    assert resp.status_code == 200, resp.text
    rider = resp.json()["data"]
    assert rider["status"] == "offline"

    resp = await client.put(f"/api/v1/delivery/riders/{rider['id']}/status", json={"status": "available"})
    assert resp.status_code == 200, resp.text

    resp = await client.post(
        "/api/v1/delivery/assignments", json={"order_id": order_id, "rider_id": rider["id"]}
    )
    assert resp.status_code == 200, resp.text
    assignment = resp.json()["data"]
    assert assignment["status"] == "assigned"

    resp = await client.get(f"/api/v1/delivery/orders/{order_id}")
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"]["status"] == "assigned"

    # --- Rider picks up and delivers ---------------------------------------------------
    override_staff(rider_staff)

    resp = await client.post(f"/api/v1/delivery/tracking/{order_id}/pickup")
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"]["status"] == "out_for_delivery"

    resp = await client.post(f"/api/v1/delivery/tracking/{order_id}/deliver")
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"]["status"] == "delivered"

    # --- Customer can see the final status via the tracking endpoint ------------------
    override_customer(customer)
    resp = await client.get(f"/api/v1/delivery/tracking/{order_id}/status")
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"]["status"] == "delivered"


async def test_unverified_customer_blocked_from_placing_order(
    client, db_session, override_customer, cleanup_delivery_rows
):
    """Acceptance check: an unverified customer is blocked from POST
    /delivery/orders by require_verified_customer() (403), not a hand-rolled
    check inside the endpoint or service.
    """
    customer = await _make_customer(db_session, verified=False)
    cleanup_delivery_rows["customer_ids"].append(customer.id)
    address = await customer_address_repository.create(
        db_session,
        customer_id=customer.id,
        label="Home",
        address_line1="123 Test Street",
        city="Dhaka",
        country="Bangladesh",
    )
    restaurant, category, item = await _seed_restaurant_menu(db_session)
    cleanup_delivery_rows["restaurant_ids"].append(restaurant.id)
    await db_session.commit()

    override_customer(customer)

    resp = await client.post(
        "/api/v1/delivery/orders",
        json={
            "restaurant_id": str(restaurant.id),
            "delivery_address_id": str(address.id),
            "items": [{"menu_item_id": str(item.id), "quantity": 1}],
        },
    )
    assert resp.status_code == 403, resp.text