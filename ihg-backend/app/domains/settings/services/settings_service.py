"""Business logic for reading/writing runtime system settings.

Two-tier configuration (PROJECT_STATE.md §3 rule 11): static branding lives in
config/company.yaml (app.core.company_config); this service owns the DYNAMIC tier —
values that change via API without a redeploy (module toggles, password policy, tax
rate, etc.), backed by the system_settings table.

Reads are served from a simple in-process cache and only fall through to the database
on a cache miss; every write invalidates the cache for that key.
"""
from typing import Any, Dict, List, Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.settings.models.system_setting import SystemSetting
from app.domains.settings.repositories import system_setting_repository

# Simple in-process cache. Not shared across multiple API processes/workers — acceptable
# for this phase since there is only one `api` process; revisit if horizontal scaling is
# introduced (would need a shared cache such as Redis, already planned per Open Decisions #3).
_cache: Dict[str, Any] = {}

DEFAULT_SETTINGS: List[Dict[str, Any]] = [
    {"key": "hotel_module_enabled", "value": True, "value_type": "bool", "is_public": True,
     "description": "Whether the Hotel business line is enabled for this deployment."},
    {"key": "restaurant_module_enabled", "value": True, "value_type": "bool", "is_public": True,
     "description": "Whether the Restaurant business line is enabled for this deployment."},
    {"key": "delivery_module_enabled", "value": True, "value_type": "bool", "is_public": True,
     "description": "Whether the Delivery business line is enabled for this deployment."},
    {"key": "password_min_length", "value": 8, "value_type": "int", "is_public": False,
     "description": "Minimum password length enforced at staff/customer signup and reset."},
    {"key": "password_require_uppercase", "value": True, "value_type": "bool", "is_public": False,
     "description": "Whether passwords must contain at least one uppercase letter."},
    {"key": "password_require_number", "value": True, "value_type": "bool", "is_public": False,
     "description": "Whether passwords must contain at least one digit."},
    {"key": "account_lockout_max_attempts", "value": 5, "value_type": "int", "is_public": False,
     "description": "Failed login attempts before an account is locked."},
    {"key": "account_lockout_duration_minutes", "value": 15, "value_type": "int", "is_public": False,
     "description": "How long an account stays locked after exceeding max failed attempts."},
]


async def seed_defaults(db: AsyncSession) -> None:
    """Insert default module toggles + password policy settings if they don't already exist.

    Safe to call multiple times (idempotent) — existing keys are left untouched.
    """
    for default in DEFAULT_SETTINGS:
        existing = await system_setting_repository.get_by_key(db, default["key"])
        if existing is None:
            await system_setting_repository.create(
                db,
                key=default["key"],
                value=default["value"],
                value_type=default["value_type"],
                description=default["description"],
                is_public=default["is_public"],
            )
    await db.flush()


async def get_setting(db: AsyncSession, key: str, default: Any = None) -> Any:
    """Return a setting's value, checking the in-process cache before the database."""
    if key in _cache:
        return _cache[key]

    setting = await system_setting_repository.get_by_key(db, key)
    if setting is None:
        return default

    _cache[key] = setting.value
    return setting.value


async def set_setting(
    db: AsyncSession,
    *,
    key: str,
    value: Any,
    value_type: str,
    description: Optional[str] = None,
    is_public: bool = False,
    updated_by_staff_id: Optional[UUID] = None,
) -> SystemSetting:
    """Create or update a setting and invalidate its cache entry."""
    setting = await system_setting_repository.upsert(
        db,
        key=key,
        value=value,
        value_type=value_type,
        description=description,
        is_public=is_public,
        updated_by_staff_id=updated_by_staff_id,
    )
    _cache[key] = setting.value
    return setting


async def list_all_settings(db: AsyncSession) -> List[SystemSetting]:
    """Return every system setting (staff/admin use only — may include non-public values)."""
    return await system_setting_repository.list_all(db)


async def list_public_settings(db: AsyncSession) -> Dict[str, Any]:
    """Return only settings flagged is_public=True, as a flat {key: value} dict — used by
    the unauthenticated GET /api/v1/config endpoint.
    """
    public = await system_setting_repository.list_public(db)
    return {s.key: s.value for s in public}


def _clear_cache() -> None:
    """Test-only helper to reset the in-process cache between test runs."""
    _cache.clear()