"""GET /api/v1/config — unauthenticated. Merges static branding (config/company.yaml)
with public runtime settings (module toggles, etc.) for frontend theming.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_db
from app.core.company_config import company_config
from app.domains.settings.services import settings_service
from app.shared_kernel.schemas.response_envelope import envelope

router = APIRouter(tags=["config"])


@router.get("/config")
async def get_public_config(db: AsyncSession = Depends(get_db)) -> dict:
    """Return merged branding + public settings — safe to call with no authentication."""
    public_settings = await settings_service.list_public_settings(db)
    merged = {
        "company_name": company_config.name,
        "logo_url": company_config.logo_url,
        "primary_color": company_config.primary_color,
        "secondary_color": company_config.secondary_color,
        "currency": company_config.currency,
        "timezone": company_config.timezone,
        "locale": company_config.locale,
        "footer_text": company_config.footer_text,
        **public_settings,
    }
    return envelope(data=merged)