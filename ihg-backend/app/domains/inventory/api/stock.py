"""Staff-facing stock level viewing, manual stock adjustment, and low-stock alert
management. Two routers live in this single file (`router` for stock,
`alerts_router` for alerts) rather than a separate alerts.py, matching this phase's
task deliverable list (inventory.py, suppliers.py, stock.py only) — both are
included into api_router in app/api/v1/api.py.
"""
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_current_staff_user, get_db, require_permission
from app.domains.iam.models.staff_user import StaffUser
from app.domains.inventory.schemas.stock import StockAdjustRequest, StockRead
from app.domains.inventory.schemas.stock_alert import StockAlertRead, StockAlertResolveRequest
from app.domains.inventory.schemas.stock_transaction import StockTransactionRead
from app.domains.inventory.services import inventory_service, stock_alert_service
from app.shared_kernel.schemas.response_envelope import envelope

router = APIRouter(prefix="/inventory/stock", tags=["inventory-stock"])
alerts_router = APIRouter(prefix="/inventory/alerts", tags=["inventory-alerts"])


@router.get("", dependencies=[Depends(require_permission("inventory:stock:read"))])
async def list_stock(db: AsyncSession = Depends(get_db)) -> dict:
    """List current on-hand stock levels for every item that has a stock row."""
    stock_rows = await inventory_service.list_stock(db)
    return envelope(data=[StockRead.model_validate(s) for s in stock_rows])


@router.get("/{item_id}", dependencies=[Depends(require_permission("inventory:stock:read"))])
async def get_stock(item_id: UUID, db: AsyncSession = Depends(get_db)) -> dict:
    """Get the current on-hand stock level for a single item."""
    stock = await inventory_service.get_stock(db, item_id)
    return envelope(data=StockRead.model_validate(stock))


@router.get("/{item_id}/transactions", dependencies=[Depends(require_permission("inventory:stock:read"))])
async def list_transactions(item_id: UUID, db: AsyncSession = Depends(get_db)) -> dict:
    """List the full audit trail of stock movements for an item, most recent first."""
    transactions = await inventory_service.list_transactions(db, item_id)
    return envelope(data=[StockTransactionRead.model_validate(t) for t in transactions])


@router.post("/{item_id}/adjust", dependencies=[Depends(require_permission("inventory:stock:adjust"))])
async def adjust_stock(
    item_id: UUID,
    payload: StockAdjustRequest,
    staff: StaffUser = Depends(get_current_staff_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Manually adjust an item's stock level — a named, separately-permissioned
    action (inventory:stock:adjust), distinct from general item CRUD, since it's a
    specific audited movement rather than a catalog edit.
    """
    transaction = await inventory_service.adjust_stock(
        db,
        inventory_item_id=item_id,
        performed_by_staff_id=staff.id,
        **payload.model_dump(),
    )
    return envelope(data=StockTransactionRead.model_validate(transaction), message="Stock adjusted.")


@alerts_router.get("", dependencies=[Depends(require_permission("inventory:alert:read"))])
async def list_alerts(status: str | None = None, db: AsyncSession = Depends(get_db)) -> dict:
    """List low-stock alerts, optionally filtered by status ('open' or 'resolved')."""
    alerts = await stock_alert_service.list_alerts(db, status=status)
    return envelope(data=[StockAlertRead.model_validate(a) for a in alerts])


@alerts_router.post(
    "/{alert_id}/resolve", dependencies=[Depends(require_permission("inventory:alert:resolve"))]
)
async def resolve_alert(
    alert_id: UUID,
    payload: StockAlertResolveRequest,
    staff: StaffUser = Depends(get_current_staff_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Resolve an open low-stock alert — a named exception narrower than a general
    'write', since it's one specific state transition.
    """
    alert = await stock_alert_service.resolve_alert(
        db, alert_id, resolved_by_staff_id=staff.id, resolution_note=payload.resolution_note
    )
    return envelope(data=StockAlertRead.model_validate(alert), message="Stock alert resolved.")