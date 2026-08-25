"""Raw database queries for the attachments table. No business logic here."""
from typing import List, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.shared_kernel.models.attachment import Attachment


async def create(
    db: AsyncSession,
    *,
    owner_type: str,
    owner_id: UUID,
    file_path: str,
    file_name: str,
    mime_type: str,
    file_size_bytes: int,
) -> Attachment:
    """Insert a new attachment row."""
    attachment = Attachment(
        owner_type=owner_type,
        owner_id=owner_id,
        file_path=file_path,
        file_name=file_name,
        mime_type=mime_type,
        file_size_bytes=file_size_bytes,
    )
    db.add(attachment)
    await db.flush()
    await db.refresh(attachment)
    return attachment


async def get_by_owner(db: AsyncSession, *, owner_type: str, owner_id: UUID) -> List[Attachment]:
    """List all attachments belonging to a given owner."""
    result = await db.execute(
        select(Attachment).where(
            Attachment.owner_type == owner_type,
            Attachment.owner_id == owner_id,
            Attachment.is_deleted.is_(False),
        )
    )
    return list(result.scalars().all())


async def get_by_id(db: AsyncSession, attachment_id: UUID) -> Optional[Attachment]:
    """Fetch a single attachment by id."""
    result = await db.execute(
        select(Attachment).where(Attachment.id == attachment_id, Attachment.is_deleted.is_(False))
    )
    return result.scalar_one_or_none()