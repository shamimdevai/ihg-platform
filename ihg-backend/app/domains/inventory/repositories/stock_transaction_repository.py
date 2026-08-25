"""Raw database queries for the stock_transactions table. No business logic here.
Transactions are append-only — there is deliberately no `save`/`soft_delete` here.
"""
from typing import List, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.inventory.models.stock_transaction import StockTransaction


async def create(
    db: AsyncSession,
    *,
    inventory_item_id: UUID,
    quantity_delta: float,
    balance_after: float,
    transaction_type: str,
    reason: Optional[str] = None,
    reference_type: Optional[str] = None,
    reference_id: Optional[UUID] = None,
    performed_by_staff_id: Optional[UUID] = None,
) -> StockTransaction:
    """Insert a new, immutable stock transaction row."""
    transaction = StockTransaction(
        inventory_item_id=inventory_item_id,
        quantity_delta=quantity_delta,
        balance_after=balance_after,
        transaction_type=transaction_type,
        reason=reason,
        reference_type=reference_type,
        reference_id=reference_id,
        performed_by_staff_id=performed_by_staff_id,
    )
    db.add(transaction)
    await db.flush()
    await db.refresh(transaction)
    return transaction


async def list_by_item(db: AsyncSession, inventory_item_id: UUID) -> List[StockTransaction]:
    """List every transaction for an inventory item, most recent first."""
    result = await db.execute(
        select(StockTransaction)
        .where(
            StockTransaction.inventory_item_id == inventory_item_id,
            StockTransaction.is_deleted.is_(False),
        )
        .order_by(StockTransaction.created_at.desc())
    )
    return list(result.scalars().all())