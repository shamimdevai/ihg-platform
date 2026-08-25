"""CRUD endpoints for roles + permission assignment."""
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_db, require_permission
from app.domains.iam.repositories import role_repository
from app.domains.iam.schemas.role import RoleAssignPermissions, RoleCreate, RoleRead, RoleUpdate
from app.domains.iam.services import department_service, rbac_service  # noqa: F401 (department_service kept for symmetry/future use)
from app.core.exceptions import NotFoundError
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