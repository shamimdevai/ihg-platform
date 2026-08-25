"""Writes audit trail entries. Called by AuditMiddleware for every mutating request,
and may also be called directly by other iam services (e.g. impersonation_service) for
finer-grained, business-meaningful audit entries.
"""
from typing import Any, Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.iam.models.audit_log import AuditLog
from app.domains.iam.repositories import audit_log_repository


async def log_action(
    db: AsyncSession,
    *,
    staff_user_id: Optional[UUID],
    action: str,
    entity_type: Optional[str] = None,
    entity_id: Optional[UUID] = None,
    metadata: Optional[Any] = None,
    impersonated_by_staff_id: Optional[UUID] = None,
) -> AuditLog:
    """Record a single audit trail entry."""
    return await audit_log_repository.create(
        db,
        staff_user_id=staff_user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        extra_data=metadata,
        impersonated_by_staff_id=impersonated_by_staff_id,
    )