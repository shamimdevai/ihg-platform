"""Business logic for department CRUD."""
from typing import List, Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError
from app.domains.iam.models.department import Department
from app.domains.iam.repositories import department_repository


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