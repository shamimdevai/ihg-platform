"""CRUD endpoints for runtime system settings — protected by real IAM permissions
as of Phase 3 (was a placeholder dependency in Phase 2).
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_db, require_permission
from app.core.exceptions import NotFoundError
from app.domains.settings.schemas.system_setting import (
    SystemSettingCreateOrUpdate,
    SystemSettingRead,
)
from app.domains.settings.services import settings_service
from app.shared_kernel.schemas.response_envelope import envelope

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("", dependencies=[Depends(require_permission("settings:read"))])
async def list_settings(db: AsyncSession = Depends(get_db)) -> dict:
    """List every system setting."""
    settings_list = await settings_service.list_all_settings(db)
    return envelope(data=[SystemSettingRead.model_validate(s) for s in settings_list])


@router.get("/{key}", dependencies=[Depends(require_permission("settings:read"))])
async def get_setting_by_key(key: str, db: AsyncSession = Depends(get_db)) -> dict:
    """Get a single system setting by key."""
    value = await settings_service.get_setting(db, key)
    if value is None:
        raise NotFoundError(f"Setting '{key}' not found.")
    return envelope(data={"key": key, "value": value})


@router.put("/{key}", dependencies=[Depends(require_permission("settings:write"))])
async def upsert_setting(
    key: str,
    payload: SystemSettingCreateOrUpdate,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Create or update a system setting."""
    setting = await settings_service.set_setting(
        db,
        key=key,
        value=payload.value,
        value_type=payload.value_type,
        description=payload.description,
        is_public=payload.is_public,
    )
    return envelope(data=SystemSettingRead.model_validate(setting), message="Setting updated.")