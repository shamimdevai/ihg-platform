"""Raw database queries for the notifications table. No business logic here."""
from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.shared_kernel.models.notification import Notification


async def create(
    db: AsyncSession,
    *,
    recipient_type: str,
    recipient_id: UUID,
    title: str,
    message: str,
    extra_data: Optional[dict] = None,
) -> Notification:
    """Insert a new notification row."""
    notification = Notification(
        recipient_type=recipient_type,
        recipient_id=recipient_id,
        title=title,
        message=message,
        extra_data=extra_data,
    )
    db.add(notification)
    await db.flush()
    await db.refresh(notification)
    return notification


async def list_by_recipient(
    db: AsyncSession, *, recipient_type: str, recipient_id: UUID, unread_only: bool = False
) -> List[Notification]:
    """List a recipient's notifications, newest first."""
    stmt = select(Notification).where(
        Notification.recipient_type == recipient_type,
        Notification.recipient_id == recipient_id,
        Notification.is_deleted.is_(False),
    )
    if unread_only:
        stmt = stmt.where(Notification.read_at.is_(None))
    result = await db.execute(stmt.order_by(Notification.created_at.desc()))
    return list(result.scalars().all())


async def get_by_id(db: AsyncSession, notification_id: UUID) -> Optional[Notification]:
    """Fetch a single notification by id."""
    result = await db.execute(
        select(Notification).where(Notification.id == notification_id, Notification.is_deleted.is_(False))
    )
    return result.scalar_one_or_none()


async def mark_read(db: AsyncSession, notification: Notification) -> Notification:
    """Stamp read_at on an already-fetched notification."""
    notification.read_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(notification)
    return notification