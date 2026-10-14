"""Business logic for department CRUD."""
from typing import List, Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError
from app.domains.iam.models.department import Department
from app.domains.iam.repositories import department_repository, staff_user_repository


async def create_department(db: AsyncSession, *, name: str, description: Optional[str] = None) -> Department:
    """Create a new department.

    Raises:
        ConflictError: a department with this name already exists.
    """
    existing = await department_repository.get_by_name(db, name)
    if existing is not None:
        raise ConflictError(f"Department '{name}' already exists.")
    return await department_repository.create(db, name=name, description=description)


async def list_departments(db: AsyncSession) -> List[Department]:
    """List every department."""
    return await department_repository.list_all(db)


async def get_department(db: AsyncSession, department_id: UUID) -> Department:
    """Fetch a single department by id.

    Raises:
        NotFoundError: no department with that id exists.
    """
    department = await department_repository.get_by_id(db, department_id)
    if department is None:
        raise NotFoundError("Department not found.")
    return department


async def update_department(
    db: AsyncSession, department_id: UUID, *, name: Optional[str] = None, description: Optional[str] = None
) -> Department:
    """Update a department's fields."""
    department = await get_department(db, department_id)
    if name is not None:
        department.name = name
    if description is not None:
        department.description = description
    return await department_repository.save(db, department)


async def delete_department(db: AsyncSession, department_id: UUID, *, deleted_by_staff_id: UUID) -> None:
    """Soft-delete a department.

    Raises:
        NotFoundError: no department with that id exists (via get_department).
        ConflictError: any active staff member is still assigned to it —
            department_id is nullable on StaffUser, but clearing it out
            from under an active staff member as a silent side effect
            would be confusing; reassignment (to another department, or
            explicitly to none) must be an explicit action taken first.
    """
    department = await get_department(db, department_id)

    assigned_count = await staff_user_repository.count_by_department_id(db, department_id)
    if assigned_count > 0:
        raise ConflictError(
            f"This department is still assigned to {assigned_count} staff member(s). "
            "Reassign them to a different department (or none) before deleting it."
        )

    await department_repository.soft_delete(db, department, deleted_by_staff_id=deleted_by_staff_id)