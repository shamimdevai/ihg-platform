"""Full hotel booking lifecycle — booking -> check-in -> check-out -> invoice
generation -> PDF download — plus the Housekeeping-role permission-split
acceptance check from the Phase 7 task spec.

Located under tests/unit/hotel/, not tests/integration/, matching the
established precedent set by tests/unit/payments/test_refund_workflow.py, which
mixes db_session-only tests and real client-driven HTTP tests in the same file
under tests/unit/<domain>/. tests/integration/*.py remain empty planned
placeholders (test_hotel_flow.py included) until whichever later phase (if any)
populates them.

Verified against the real tests/conftest.py and customers/services/guest_service.py
and run against a live Postgres instance (7 migrations + seed_data.py applied):
  - `client`/`db_session` fixture contracts confirmed as assumed.
  - Staff auth bypass via `app.dependency_overrides[get_current_staff_user]` works
    as written.
  - `booking_service._verify_guest_exists()` correctly calls
    `guest_service.get_guest(db, guest_id)`, which raises NotFoundError on a
    missing guest — the patch target below is accurate.
  - Found and fixed two real bugs during verification, both documented at their
    fix site: (1) conftest.py's `client` fixture didn't override `get_db`, so a
    second DB-writing test via `client` in the same run hit the same
    asyncpg "attached to a different loop" bug Phase 4.5 fixed for db_session,
    just in a different place — fixed in conftest.py, not here; (2) this file's
    mid-test `db_session.commit()` calls defeated db_session's rollback-only
    cleanup contract, permanently leaking rows (confirmed via direct psql query:
    10 hotels/rooms, 5 bookings/invoices accumulated across repeated runs before
    this fix) — fixed with the cleanup_hotel_rows fixture below.
"""
import uuid
from datetime import date, timedelta
from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio

from app.api.v1.deps import get_current_staff_user
from app.domains.hotel.repositories import hotel_repository, housekeeping_task_repository, room_repository, room_type_repository
from app.domains.iam.models.staff_user import StaffUser
from app.domains.iam.repositories import role_repository
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


async def _seed_hotel_room(db_session):
    hotel = await hotel_repository.create(db_session, name="Test Hotel", is_active=True)
    room_type = await room_type_repository.create(
        db_session, hotel_id=hotel.id, name="Standard", base_rate=100.00, capacity=2
    )
    room = await room_repository.create(
        db_session, hotel_id=hotel.id, room_type_id=room_type.id, room_number="101", is_active=True
    )
    await db_session.commit()
    return hotel, room_type, room


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
async def cleanup_hotel_rows(db_session):
    """This test commits mid-test (needed so the `client` fixture's separate DB
    connection can see seeded rows), which defeats db_session's normal
    rollback-only cleanup contract (see conftest.py's docstring). Explicitly
    delete everything this test creates instead, most-dependent tables first.
    Confirmed via direct psql inspection that rows leaked permanently across
    repeated test runs before this fixture was added.
    """
    from sqlalchemy import delete, select

    from app.domains.hotel.models.booking import Booking
    from app.domains.hotel.models.hotel import Hotel
    from app.domains.hotel.models.housekeeping_task import HousekeepingTask
    from app.domains.hotel.models.invoice import Invoice
    from app.domains.hotel.models.invoice_item import InvoiceItem
    from app.domains.hotel.models.room import Room
    from app.domains.hotel.models.room_type import RoomType

    created_hotel_ids = []
    yield created_hotel_ids

    for hotel_id in created_hotel_ids:
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
    await db_session.commit()


@patch(
    "app.domains.hotel.services.booking_service._verify_guest_exists",
    new_callable=AsyncMock,
    return_value=None,
)
async def test_full_booking_to_invoice_flow(
    _mock_guest_check, client, db_session, override_staff, cleanup_hotel_rows
):
    """booking -> check-in -> check-out -> invoice generated -> PDF downloadable."""
    admin = await _make_staff(db_session, role_name="Admin")
    override_staff(admin)

    hotel, room_type, room = await _seed_hotel_room(db_session)
    cleanup_hotel_rows.append(hotel.id)
    guest_id = uuid.uuid4()

    check_in = date.today() + timedelta(days=1)
    check_out = check_in + timedelta(days=2)

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
    booking = resp.json()["data"]
    booking_id = booking["id"]
    assert booking["status"] == "reserved"

    resp = await client.post(f"/api/v1/hotel/checkin/{booking_id}")
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"]["status"] == "checked_in"

    resp = await client.post(f"/api/v1/hotel/checkout/{booking_id}")
    assert resp.status_code == 200, resp.text
    checked_out = resp.json()["data"]
    assert checked_out["status"] == "checked_out"
    assert checked_out["total_amount"] == 200.0  # 2 nights x 100.00

    resp = await client.post(f"/api/v1/hotel/invoices/generate/{booking_id}")
    assert resp.status_code == 200, resp.text
    invoice = resp.json()["data"]
    invoice_id = invoice["id"]
    assert invoice["status"] == "draft"
    assert invoice["total_amount"] == 200.0

    resp = await client.get(f"/api/v1/hotel/invoices/{invoice_id}/pdf")
    assert resp.status_code == 200, resp.text
    assert resp.headers["content-type"].startswith("application/pdf")
    assert len(resp.content) > 0


async def test_housekeeping_role_permission_split(client, db_session, override_staff, cleanup_hotel_rows):
    """Housekeeping staff can update a housekeeping task's status, but are
    correctly rejected creating a booking or viewing an invoice — the exact
    acceptance check from the Phase 7 task spec.
    """
    admin = await _make_staff(db_session, role_name="Admin")
    override_staff(admin)
    hotel, _, room = await _seed_hotel_room(db_session)
    cleanup_hotel_rows.append(hotel.id)

    task = await housekeeping_task_repository.create(
        db_session, room_id=room.id, task_type="cleaning", status="pending"
    )
    await db_session.commit()

    housekeeping_staff = await _make_staff(db_session, role_name="Housekeeping")
    override_staff(housekeeping_staff)

    resp = await client.put(f"/api/v1/hotel/housekeeping/{task.id}/status", json={"status": "in_progress"})
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"]["status"] == "in_progress"

    resp = await client.post(
        "/api/v1/hotel/bookings",
        json={
            "hotel_id": str(uuid.uuid4()),
            "room_id": str(room.id),
            "guest_id": str(uuid.uuid4()),
            "check_in_date": date.today().isoformat(),
            "check_out_date": (date.today() + timedelta(days=1)).isoformat(),
        },
    )
    assert resp.status_code == 403, resp.text

    resp = await client.get(f"/api/v1/hotel/invoices/{uuid.uuid4()}")
    assert resp.status_code == 403, resp.text