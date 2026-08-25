"""Unit tests for app.domains.inventory.services.inventory_service (stock transaction
logic) and app.domains.inventory.services.stock_alert_service (low-stock alert
trigger + notification fan-out).

notification_service.create_notification is mocked throughout — these tests verify
*that* the correct staff member(s) are notified, not the notification persistence
layer itself (that's covered by shared_kernel's own tests).
"""
from unittest.mock import AsyncMock, patch

import pytest

from app.core.exceptions import NotFoundError, ValidationError
from app.domains.iam.repositories import department_repository, role_repository, staff_user_repository
from app.domains.inventory.repositories import inventory_item_repository, stock_alert_repository
from app.domains.inventory.services import inventory_service, stock_alert_service


async def _make_item(db_session, *, reorder_threshold=None, unit="kg", name="Flour"):
    return await inventory_item_repository.create(
        db_session, name=name, unit=unit, reorder_threshold=reorder_threshold
    )


async def _make_management_staff(db_session, *, email="manager@example.com"):
    """Creates (or reuses) the Management department and one staff member in it,
    matching stock_alert_service.ALERT_TARGET_DEPARTMENT_NAME exactly.
    """
    department = await department_repository.get_by_name(db_session, "Management")
    if department is None:
        department = await department_repository.create(db_session, name="Management")

    role = await role_repository.create(db_session, name=f"test-role-{email}")
    staff = await staff_user_repository.create(
        db_session,
        email=email,
        first_name="Manager",
        last_name="Test",
        role_id=role.id,
        department_id=department.id,
        is_active=True,
    )
    return staff


# --- adjust_stock(): increment/decrement -------------------------------------------


async def test_adjust_stock_increments_from_zero(db_session):
    item = await _make_item(db_session)
    transaction = await inventory_service.adjust_stock(
        db_session,
        inventory_item_id=item.id,
        quantity_delta=10,
        transaction_type="receipt",
    )
    assert transaction.quantity_delta == 10
    assert transaction.balance_after == 10

    stock = await inventory_service.get_stock(db_session, item.id)
    assert stock.quantity_on_hand == 10


async def test_adjust_stock_decrements_existing_balance(db_session):
    item = await _make_item(db_session)
    await inventory_service.adjust_stock(
        db_session, inventory_item_id=item.id, quantity_delta=10, transaction_type="receipt"
    )
    transaction = await inventory_service.adjust_stock(
        db_session, inventory_item_id=item.id, quantity_delta=-4, transaction_type="consumption"
    )
    assert transaction.quantity_delta == -4
    assert transaction.balance_after == 6

    stock = await inventory_service.get_stock(db_session, item.id)
    assert stock.quantity_on_hand == 6


async def test_adjust_stock_rejects_negative_resulting_balance(db_session):
    item = await _make_item(db_session)
    await inventory_service.adjust_stock(
        db_session, inventory_item_id=item.id, quantity_delta=5, transaction_type="receipt"
    )
    with pytest.raises(ValidationError):
        await inventory_service.adjust_stock(
            db_session, inventory_item_id=item.id, quantity_delta=-6, transaction_type="consumption"
        )
    # Balance must be unchanged after the rejected movement.
    stock = await inventory_service.get_stock(db_session, item.id)
    assert stock.quantity_on_hand == 5


async def test_adjust_stock_rejects_unknown_item(db_session):
    import uuid

    with pytest.raises(NotFoundError):
        await inventory_service.adjust_stock(
            db_session, inventory_item_id=uuid.uuid4(), quantity_delta=1, transaction_type="receipt"
        )


async def test_adjust_stock_records_full_audit_trail(db_session):
    item = await _make_item(db_session)
    await inventory_service.adjust_stock(
        db_session, inventory_item_id=item.id, quantity_delta=10, transaction_type="receipt"
    )
    await inventory_service.adjust_stock(
        db_session, inventory_item_id=item.id, quantity_delta=-3, transaction_type="consumption"
    )
    transactions = await inventory_service.list_transactions(db_session, item.id)
    assert len(transactions) == 2
    # Most recent first.
    assert transactions[0].transaction_type == "consumption"
    assert transactions[1].transaction_type == "receipt"


# --- Low-stock alert trigger + notification fan-out ---------------------------------


async def test_adjust_stock_does_not_trigger_alert_when_no_threshold_set(db_session):
    item = await _make_item(db_session, reorder_threshold=None)
    with patch(
        "app.shared_kernel.services.notification_service.create_notification", new_callable=AsyncMock
    ) as mock_notify:
        await inventory_service.adjust_stock(
            db_session, inventory_item_id=item.id, quantity_delta=1, transaction_type="receipt"
        )
    mock_notify.assert_not_called()
    alerts = await stock_alert_repository.list_all(db_session)
    assert alerts == []


async def test_adjust_stock_does_not_trigger_alert_above_threshold(db_session):
    item = await _make_item(db_session, reorder_threshold=5)
    with patch(
        "app.shared_kernel.services.notification_service.create_notification", new_callable=AsyncMock
    ) as mock_notify:
        await inventory_service.adjust_stock(
            db_session, inventory_item_id=item.id, quantity_delta=10, transaction_type="receipt"
        )
    mock_notify.assert_not_called()


async def test_adjust_stock_triggers_alert_and_notifies_management_staff(db_session):
    """Real dev/CI databases may already have other staff seeded into Management
    (e.g. from manual invite-flow testing in earlier phases) — this test must not
    assume the department starts empty. It only asserts that OUR staff member is
    among the recipients, not the total call count.
    """
    staff = await _make_management_staff(db_session, email="mgr1@example.com")
    item = await _make_item(db_session, reorder_threshold=5, name="Rice")

    with patch(
        "app.shared_kernel.services.notification_service.create_notification", new_callable=AsyncMock
    ) as mock_notify:
        await inventory_service.adjust_stock(
            db_session, inventory_item_id=item.id, quantity_delta=3, transaction_type="receipt"
        )
        # 3 <= reorder_threshold of 5 -> alert should fire, and OUR staff member
        # must be among the recipients exactly once.
        matching_calls = [
            c for c in mock_notify.call_args_list if c.kwargs.get("recipient_id") == staff.id
        ]
        assert len(matching_calls) == 1
        call_kwargs = matching_calls[0].kwargs
        assert call_kwargs["recipient_type"] == "staff"
        assert "Rice" in call_kwargs["title"]

    alerts = await stock_alert_repository.list_all(db_session, status="open")
    assert len(alerts) == 1
    assert alerts[0].inventory_item_id == item.id
    assert alerts[0].quantity_at_trigger == 3


async def test_adjust_stock_does_not_duplicate_open_alert(db_session):
    """A second movement that stays at/under threshold must not create a second
    alert or send any additional notifications while one is already open. Asserts
    on the CHANGE in call_count between the two movements, not an absolute count,
    since a real dev database may already have other staff seeded into Management.
    """
    staff = await _make_management_staff(db_session, email="mgr2@example.com")
    item = await _make_item(db_session, reorder_threshold=5, name="Sugar")

    with patch(
        "app.shared_kernel.services.notification_service.create_notification", new_callable=AsyncMock
    ) as mock_notify:
        await inventory_service.adjust_stock(
            db_session, inventory_item_id=item.id, quantity_delta=3, transaction_type="receipt"
        )
        count_after_first_movement = mock_notify.call_count
        assert count_after_first_movement > 0  # our alert did fire at least once

        await inventory_service.adjust_stock(
            db_session, inventory_item_id=item.id, quantity_delta=-1, transaction_type="consumption"
        )
        # No NEW notifications from the second movement — the open alert is reused.
        assert mock_notify.call_count == count_after_first_movement

    alerts = await stock_alert_repository.list_all(db_session, status="open")
    assert len(alerts) == 1
    _ = staff  # staff creation is required for the fan-out target to exist


async def test_adjust_stock_with_no_matching_department_creates_alert_but_notifies_nobody(db_session):
    """If the configured target department doesn't exist in this deployment, the
    alert still fires — the fan-out is just an empty list, not an error. Patches
    ALERT_TARGET_DEPARTMENT_NAME to a name guaranteed not to exist, rather than
    assuming the real "Management" department has no staff (it may well have real
    staff seeded from manual testing in a live dev database).
    """
    item = await _make_item(db_session, reorder_threshold=5, name="Salt")
    with patch(
        "app.domains.inventory.services.stock_alert_service.ALERT_TARGET_DEPARTMENT_NAME",
        "Department-That-Does-Not-Exist",
    ), patch(
        "app.shared_kernel.services.notification_service.create_notification", new_callable=AsyncMock
    ) as mock_notify:
        await inventory_service.adjust_stock(
            db_session, inventory_item_id=item.id, quantity_delta=2, transaction_type="receipt"
        )
    mock_notify.assert_not_called()
    alerts = await stock_alert_repository.list_all(db_session, status="open")
    assert len(alerts) == 1


# --- resolve_alert() -----------------------------------------------------------------


async def test_resolve_alert_marks_resolved(db_session):
    item = await _make_item(db_session, reorder_threshold=5, name="Butter")
    with patch(
        "app.shared_kernel.services.notification_service.create_notification", new_callable=AsyncMock
    ):
        await inventory_service.adjust_stock(
            db_session, inventory_item_id=item.id, quantity_delta=2, transaction_type="receipt"
        )
    open_alerts = await stock_alert_service.list_alerts(db_session, status="open")
    assert len(open_alerts) == 1

    import uuid

    resolved = await stock_alert_service.resolve_alert(
        db_session, open_alerts[0].id, resolved_by_staff_id=uuid.uuid4(), resolution_note="Restocked."
    )
    assert resolved.status == "resolved"
    assert resolved.resolution_note == "Restocked."
    assert resolved.resolved_at is not None

    still_open = await stock_alert_service.list_alerts(db_session, status="open")
    assert still_open == []