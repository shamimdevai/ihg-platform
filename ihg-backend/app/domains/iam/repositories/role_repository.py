"""Raw database queries for the roles table. No business logic here."""
from typing import List, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.iam.models.role import Role
from app.domains.iam.models.role_permission import RolePermission


async def get_by_id(db: AsyncSession, role_id: UUID) -> Optional[Role]:
    """Fetch a role by id (permissions eager-loaded), excluding soft-deleted rows."""
    result = await db.execute(select(Role).where(Role.id == role_id, Role.is_deleted.is_(False)))
    return result.scalar_one_or_none()


async def get_by_name(db: AsyncSession, name: str) -> Optional[Role]:
    """Fetch a role by name, excluding soft-deleted rows."""
    result = await db.execute(select(Role).where(Role.name == name, Role.is_deleted.is_(False)))
    return result.scalar_one_or_none()


async def list_all(db: AsyncSession) -> List[Role]:
    """List every non-soft-deleted role."""
    result = await db.execute(select(Role).where(Role.is_deleted.is_(False)))
    return list(result.scalars().all())


async def create(db: AsyncSession, *, name: str, description: Optional[str] = None) -> Role:
    """Insert a new role row."""
    role = Role(name=name, description=description)
    db.add(role)
    await db.flush()
    await db.refresh(role)
    return role


async def save(db: AsyncSession, role: Role) -> Role:
    """Persist changes made to an already-fetched Role instance."""
    await db.flush()
    await db.refresh(role)
    return role


async def add_permission(db: AsyncSession, *, role_id: UUID, permission_id: UUID) -> RolePermission:
    """Link a permission to a role via the role_permissions association row."""
    link = RolePermission(role_id=role_id, permission_id=permission_id)
    db.add(link)
    await db.flush()
    return link


async def remove_permission(db: AsyncSession, *, role_id: UUID, permission_id: UUID) -> None:
    """Unlink a permission from a role by hard-deleting the association row.

    Hard delete is acceptable here (unlike business records) since RolePermission is a
    pure many-to-many link table, not a business record with independent meaning.
    """
    result = await db.execute(
        select(RolePermission).where(
            RolePermission.role_id == role_id, RolePermission.permission_id == permission_id
        )
    )
    link = result.scalar_one_or_none()
    if link is not None:
        await db.delete(link)
        await db.flush()


async def soft_delete(db: AsyncSession, role: Role, *, deleted_by_staff_id: UUID) -> None:
    """Soft-delete a role. Never hard-delete business records (mirrors
    staff_user_repository.soft_delete's own convention) — a Role row must
    survive (e.g. for audit_log rows referencing actions taken by staff who
    held it) even after it's no longer assignable to anyone new.
    """
    from datetime import datetime, timezone

    role.is_deleted = True
    role.deleted_at = datetime.now(timezone.utc)
    role.deleted_by_staff_id = deleted_by_staff_id
    await db.flush()