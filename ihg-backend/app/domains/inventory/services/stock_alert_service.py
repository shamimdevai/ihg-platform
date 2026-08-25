"""Business logic for low-stock alerts, including the real (non-stub) notification
fan-out that fires when adjust_stock() detects an item at or below its threshold.
"""
from typing import List, Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError
from app.domains.inventory.models.inventory_item import InventoryItem
from app.domains.inventory.models.stock_alert import StockAlert
from app.domains.inventory.repositories import stock_alert_repository

# --- Low-stock alert notification targeting ----------------------------------------
#
# notification_service.create_notification() requires a single, real recipient_id —
# it is not a broadcast primitive. A low-stock alert is inherently a broadcast event,
# so it needs a real targeting strategy rather than a stub/no-op.
#
# DECISION (locked in for this phase, discussed explicitly — not a silent default):
# fan out to every staff member currently in the "Management" department, resolved
# by calling iam's EXISTING service functions only (department_service.list_departments,
# staff_service.list_staff) — zero changes made to the iam domain itself. This keeps
# the cross-domain call within Global Context Rule 3 (services may call other
# domains' services, never their models/repositories).
#
# Hardcoded for now, per explicit instruction — intended to become configurable
# (e.g. via a system_settings key such as "inventory_alert_department") in a future
# phase rather than a fixed department name. Do not remove this TODO without an
# explicit decision to do so.
ALERT_TARGET_DEPARTMENT_NAME = "Management"  # TODO: make configurable via system_settings


async def _notify_management(db: AsyncSession, *, item: InventoryItem, alert: StockAlert) -> None:
    """Fan out one real notification per staff member in the target department.

    Silently creates zero notifications if the target department doesn't exist in
    this deployment, or if no staff currently belong to it — this is not an error
    condition, just an empty broadcast list.
    """
    from app.domains.iam.services import department_service, staff_service
    from app.shared_kernel.services import notification_service

    departments = await department_service.list_departments(db)
    target_department = next((d for d in departments if d.name == ALERT_TARGET_DEPARTMENT_NAME), None)
    if target_department is None:
        return

    all_staff = await staff_service.list_staff(db)
    target_staff = [s for s in all_staff if s.department_id == target_department.id]

    for staff in target_staff:
        await notification_service.create_notification(
            db,
            recipient_type="staff",
            recipient_id=staff.id,
            title=f"Low stock: {item.name}",
            message=(
                f"{item.name} is at {alert.quantity_at_trigger} {item.unit}, at or below the "
                f"reorder threshold of {alert.threshold_at_trigger} {item.unit}."
            ),
            extra_data={"inventory_item_id": str(item.id), "stock_alert_id": str(alert.id)},
        )


async def trigger_low_stock_alert(
    db: AsyncSession, *, item: InventoryItem, current_quantity: float
) -> StockAlert:
    """Create (or return the existing) open low-stock alert for an item, and notify
    the target department. Called by inventory_service.adjust_stock() — not exposed
    directly to the API, since it's a side effect of a stock movement, not an
    independent action.

    Idempotent per open alert: if an open alert already exists for this item, it is
    returned as-is and no duplicate alert/notification is created — this prevents a
    single item hovering at/under its threshold from spamming staff on every
    subsequent movement.
    """
    existing_open = await stock_alert_repository.get_open_alert_for_item(db, item.id)
    if existing_open is not None:
        return existing_open

    alert = await stock_alert_repository.create(
        db,
        inventory_item_id=item.id,
        threshold_at_trigger=item.reorder_threshold,
        quantity_at_trigger=current_quantity,
        status="open",
    )
    await _notify_management(db, item=item, alert=alert)
    return alert


async def list_alerts(db: AsyncSession, *, status: Optional[str] = None) -> List[StockAlert]:
    """List stock alerts, optionally filtered by status ('open' or 'resolved')."""
    return await stock_alert_repository.list_all(db, status=status)


async def resolve_alert(
    db: AsyncSession, alert_id: UUID, *, resolved_by_staff_id: UUID, resolution_note: Optional[str] = None
) -> StockAlert:
    """Mark an open alert resolved.

    Raises:
        NotFoundError: no alert with that id exists.
        ConflictError: the alert is already resolved.
    """
    from datetime import datetime, timezone

    alert = await stock_alert_repository.get_by_id(db, alert_id)
    if alert is None:
        raise NotFoundError("Stock alert not found.")
    if alert.status == "resolved":
        raise ConflictError("This stock alert has already been resolved.")

    alert.status = "resolved"
    alert.resolved_at = datetime.now(timezone.utc)
    alert.resolved_by_staff_id = resolved_by_staff_id
    alert.resolution_note = resolution_note
    return await stock_alert_repository.save(db, alert)