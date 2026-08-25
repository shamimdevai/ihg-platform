"""Raw database queries for the invoices and invoice_items tables — combined per
task instructions, since invoice_item is always accessed in the context of its
parent invoice.
"""
from typing import List, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.hotel.models.invoice import Invoice
from app.domains.hotel.models.invoice_item import InvoiceItem


async def get_by_id(db: AsyncSession, invoice_id: UUID) -> Optional[Invoice]:
    result = await db.execute(select(Invoice).where(Invoice.id == invoice_id, Invoice.is_deleted.is_(False)))
    return result.scalar_one_or_none()


async def get_by_booking_id(db: AsyncSession, booking_id: UUID) -> Optional[Invoice]:
    result = await db.execute(
        select(Invoice).where(Invoice.booking_id == booking_id, Invoice.is_deleted.is_(False))
    )
    return result.scalar_one_or_none()


async def list_all(db: AsyncSession, *, status: Optional[str] = None) -> List[Invoice]:
    stmt = select(Invoice).where(Invoice.is_deleted.is_(False))
    if status is not None:
        stmt = stmt.where(Invoice.status == status)
    stmt = stmt.order_by(Invoice.created_at.desc())
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def create(db: AsyncSession, **kwargs) -> Invoice:
    invoice = Invoice(**kwargs)
    db.add(invoice)
    await db.flush()
    await db.refresh(invoice)
    return invoice


async def save(db: AsyncSession, invoice: Invoice) -> Invoice:
    await db.flush()
    await db.refresh(invoice)
    return invoice


async def add_item(db: AsyncSession, **kwargs) -> InvoiceItem:
    item = InvoiceItem(**kwargs)
    db.add(item)
    await db.flush()
    await db.refresh(item)
    return item


async def list_items(db: AsyncSession, invoice_id: UUID) -> List[InvoiceItem]:
    result = await db.execute(
        select(InvoiceItem)
        .where(InvoiceItem.invoice_id == invoice_id, InvoiceItem.is_deleted.is_(False))
        .order_by(InvoiceItem.created_at)
    )
    return list(result.scalars().all())