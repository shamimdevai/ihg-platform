"""Read-only listing of permissions. Permissions are seeded, not created via API."""
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_db, require_permission
from app.core.exceptions import NotFoundError
from app.domains.iam.repositories import permission_repository
from app.domains.iam.schemas.permission import PermissionRead
from app.shared_kernel.schemas.response_envelope import envelope

router = APIRouter(prefix="/iam/permissions", tags=["iam-permissions"])


@router.get("", dependencies=[Depends(require_permission("iam:permissions:read"))])
async def list_permissions(db: AsyncSession = Depends(get_db)) -> dict:
    """List every permission."""
    permissions = await permission_repository.list_all(db)
    return envelope(data=[PermissionRead.model_validate(p) for p in permissions])


@router.get("/{permission_id}", dependencies=[Depends(require_permission("iam:permissions:read"))])
async def get_permission(permission_id: UUID, db: AsyncSession = Depends(get_db)) -> dict:
    """Get a single permission by id."""
    permission = await permission_repository.get_by_id(db, permission_id)
    if permission is None:
        raise NotFoundError("Permission not found.")
    return envelope(data=PermissionRead.model_validate(permission))