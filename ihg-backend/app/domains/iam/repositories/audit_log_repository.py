"""Raw database queries for the audit_logs table. No business logic here."""
from typing import Any, List, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.iam.models.audit_log import AuditLog


async def create(
    db: AsyncSession,
    *,
    staff_user_id: Optional[UUID],
    action: str,
    entity_type: Optional[str] = None,
    entity_id: Optional[UUID] = None,
    extra_data: Optional[Any] = None,
    impersonated_by_staff_id: Optional[UUID] = None,
) -> AuditLog:
    """Insert a new audit log entry. Audit logs are never soft-deleted in practice,
    though the mixin is present for consistency with the universal model convention.
    """
    entry = AuditLog(
        staff_user_id=staff_user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        extra_data=extra_data,
        impersonated_by_staff_id=impersonated_by_staff_id,
    )
    db.add(entry)
    await db.flush()
    await db.refresh(entry)
    return entry


async def list_by_staff(db: AsyncSession, staff_user_id: UUID) -> List[AuditLog]:
    """List every audit entry performed by (or targeting) a given staff user."""
    result = await db.execute(
        select(AuditLog)
        .where(AuditLog.staff_user_id == staff_user_id, AuditLog.is_deleted.is_(False))
        .order_by(AuditLog.created_at.desc())
    )
    return list(result.scalars().all())