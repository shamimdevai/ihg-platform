"""CRUD endpoints for departments."""
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_current_staff_user, get_db, require_permission
from app.domains.iam.models.staff_user import StaffUser
from app.domains.iam.schemas.department import DepartmentCreate, DepartmentRead, DepartmentUpdate
from app.domains.iam.services import department_service
from app.shared_kernel.schemas.response_envelope import envelope

router = APIRouter(prefix="/iam/departments", tags=["iam-departments"])


@router.get("", dependencies=[Depends(require_permission("iam:departments:read"))])
async def list_departments(db: AsyncSession = Depends(get_db)) -> dict:
    """List every department."""
    departments = await department_service.list_departments(db)
    return envelope(data=[DepartmentRead.model_validate(d) for d in departments])


@router.get("/{department_id}", dependencies=[Depends(require_permission("iam:departments:read"))])
async def get_department(department_id: UUID, db: AsyncSession = Depends(get_db)) -> dict:
    """Get a single department by id."""
    department = await department_service.get_department(db, department_id)
    return envelope(data=DepartmentRead.model_validate(department))


@router.post("", dependencies=[Depends(require_permission("iam:departments:write"))])
async def create_department(payload: DepartmentCreate, db: AsyncSession = Depends(get_db)) -> dict:
    """Create a new department."""
    department = await department_service.create_department(db, name=payload.name, description=payload.description)
    return envelope(data=DepartmentRead.model_validate(department), message="Department created.")


@router.put("/{department_id}", dependencies=[Depends(require_permission("iam:departments:write"))])
async def update_department(department_id: UUID, payload: DepartmentUpdate, db: AsyncSession = Depends(get_db)) -> dict:
    """Update a department's fields."""
    department = await department_service.update_department(
        db, department_id, name=payload.name, description=payload.description
    )
    return envelope(data=DepartmentRead.model_validate(department), message="Department updated.")


@router.delete("/{department_id}", dependencies=[Depends(require_permission("iam:departments:write"))])
async def delete_department(
    department_id: UUID,
    current_staff: StaffUser = Depends(get_current_staff_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Soft-delete a department."""
    await department_service.delete_department(db, department_id, deleted_by_staff_id=current_staff.id)
    return envelope(message="Department deleted.")