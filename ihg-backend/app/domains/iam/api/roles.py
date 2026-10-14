"""CRUD endpoints for roles + permission assignment."""
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_current_staff_user, get_db, require_permission
from app.domains.iam.models.staff_user import StaffUser
from app.domains.iam.repositories import role_repository, staff_user_repository
from app.domains.iam.schemas.role import RoleAssignPermissions, RoleCreate, RoleRead, RoleUpdate
from app.domains.iam.services import department_service, rbac_service  # noqa: F401 (department_service kept for symmetry/future use)
from app.core.exceptions import ConflictError, NotFoundError
from app.shared_kernel.schemas.response_envelope import envelope

router = APIRouter(prefix="/iam/roles", tags=["iam-roles"])


@router.get("", dependencies=[Depends(require_permission("iam:roles:read"))])
async def list_roles(db: AsyncSession = Depends(get_db)) -> dict:
    """List every role, including assigned permissions."""
    roles = await role_repository.list_all(db)
    return envelope(data=[RoleRead.model_validate(r) for r in roles])


@router.get("/{role_id}", dependencies=[Depends(require_permission("iam:roles:read"))])
async def get_role(role_id: UUID, db: AsyncSession = Depends(get_db)) -> dict:
    """Get a single role by id, including assigned permissions."""
    role = await role_repository.get_by_id(db, role_id)
    if role is None:
        raise NotFoundError("Role not found.")
    return envelope(data=RoleRead.model_validate(role))


@router.post("", dependencies=[Depends(require_permission("iam:roles:write"))])
async def create_role(payload: RoleCreate, db: AsyncSession = Depends(get_db)) -> dict:
    """Create a new role."""
    role = await role_repository.create(db, name=payload.name, description=payload.description)
    return envelope(data=RoleRead.model_validate(role), message="Role created.")


@router.put("/{role_id}", dependencies=[Depends(require_permission("iam:roles:write"))])
async def update_role(role_id: UUID, payload: RoleUpdate, db: AsyncSession = Depends(get_db)) -> dict:
    """Update a role's name/description."""
    role = await role_repository.get_by_id(db, role_id)
    if role is None:
        raise NotFoundError("Role not found.")
    if payload.name is not None:
        role.name = payload.name
    if payload.description is not None:
        role.description = payload.description
    role = await role_repository.save(db, role)
    return envelope(data=RoleRead.model_validate(role), message="Role updated.")


@router.post("/{role_id}/permissions", dependencies=[Depends(require_permission("iam:roles:write"))])
async def assign_permissions(role_id: UUID, payload: RoleAssignPermissions, db: AsyncSession = Depends(get_db)) -> dict:
    """Assign one or more permissions to a role."""
    for permission_id in payload.permission_ids:
        await rbac_service.assign_permission_to_role(db, role_id=role_id, permission_id=permission_id)
    role = await role_repository.get_by_id(db, role_id)
    return envelope(data=RoleRead.model_validate(role), message="Permissions assigned.")


@router.delete(
    "/{role_id}/permissions/{permission_id}", dependencies=[Depends(require_permission("iam:roles:write"))]
)
async def remove_permission(role_id: UUID, permission_id: UUID, db: AsyncSession = Depends(get_db)) -> dict:
    """Remove a single permission from a role."""
    await rbac_service.remove_permission_from_role(db, role_id=role_id, permission_id=permission_id)
    return envelope(message="Permission removed from role.")


@router.delete("/{role_id}", dependencies=[Depends(require_permission("iam:roles:write"))])
async def delete_role(
    role_id: UUID,
    current_staff: StaffUser = Depends(get_current_staff_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Soft-delete a role.

    Blocked (409 ConflictError) if:
      - the role currently holds the platform-wide "*" permission grant —
        deleting the only wildcard-holding role would leave the platform
        with no super-privileged role at all, a more destructive outcome
        than the ordinary "role in use" case below, so this is checked
        first; or
      - any active (non-soft-deleted) staff member is still assigned to
        it — StaffUser.role_id is NOT NULL (a staff account can never be
        left without a role), so those staff must be reassigned to a
        different role before this role can be deleted.
    """
    role = await role_repository.get_by_id(db, role_id)
    if role is None:
        raise NotFoundError("Role not found.")

    if any(p.code == "*" for p in role.permissions):
        raise ConflictError(
            "This role holds the platform-wide '*' permission and cannot be deleted."
        )

    assigned_count = await staff_user_repository.count_by_role_id(db, role_id)
    if assigned_count > 0:
        raise ConflictError(
            f"This role is still assigned to {assigned_count} staff member(s). "
            "Reassign them to a different role before deleting it."
        )

    await role_repository.soft_delete(db, role, deleted_by_staff_id=current_staff.id)
    return envelope(message="Role deleted.")