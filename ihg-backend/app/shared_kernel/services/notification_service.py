"""Create/list/mark-read in-app notifications. Recipient-agnostic (staff or customer),
identified only by recipient_type + recipient_id — mirrors the polymorphic pattern used
by password_reset_token.
"""
from typing import Any, Dict, List, Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.shared_kernel.models.notification import Notification
from app.shared_kernel.repositories import notification_repository


async def create_notification(
    db: AsyncSession,
    *,
    recipient_type: str,
    recipient_id: UUID,
    title: str,
    message: str,
    extra_data: Optional[Dict[str, Any]] = None,
) -> Notification:
    """Create a single in-app notification for a staff member or customer."""
    return await notification_repository.create(
        db,
        recipient_type=recipient_type,
        recipient_id=recipient_id,
        title=title,
        message=message,
        extra_data=extra_data,
    )


async def list_notifications(
    db: AsyncSession, *, recipient_type: str, recipient_id: UUID, unread_only: bool = False
) -> List[Notification]:
    """List notifications for a recipient, optionally filtered to unread only."""
    return await notification_repository.list_by_recipient(
        db, recipient_type=recipient_type, recipient_id=recipient_id, unread_only=unread_only
    )


async def mark_read(db: AsyncSession, *, notification_id: UUID) -> Notification:
    """Mark a single notification as read.

    Raises:
        NotFoundError: no notification with that id exists.
    """
    notification = await notification_repository.get_by_id(db, notification_id)
    if notification is None:
        raise NotFoundError("Notification not found.")
    return await notification_repository.mark_read(db, notification)