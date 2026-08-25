"""Loads config/company.yaml into a typed, importable object at startup.

This is the SINGLE file to edit to re-brand a deployment for a different company.
Static values only — anything that needs to change without a redeploy belongs in the
DB-backed system_settings table (app/domains/settings, built in Phase 2), not here.
"""
from functools import lru_cache
from pathlib import Path

import yaml
from pydantic import BaseModel

from app.core.config import settings


class CompanyConfig(BaseModel):
    """Typed representation of config/company.yaml's `company:` section."""

    name: str
    legal_name: str
    logo_url: str
    primary_color: str
    secondary_color: str
    support_email: str
    support_phone: str
    address: str
    tax_id: str
    currency: str
    timezone: str
    locale: str
    footer_text: str


@lru_cache
def get_company_config() -> CompanyConfig:
    """Load and cache config/company.yaml.

    Raises:
        FileNotFoundError: if the configured YAML file does not exist.
        KeyError: if the YAML file is missing the top-level `company:` key.
    """
    config_path = Path(settings.COMPANY_CONFIG_PATH)
    if not config_path.is_absolute():
        # Resolve relative to the project root (two levels up from app/core/).
        config_path = Path(__file__).resolve().parents[2] / config_path

    if not config_path.exists():
        raise FileNotFoundError(f"Company config file not found at: {config_path}")

    with config_path.open("r", encoding="utf-8") as f:
        raw = yaml.safe_load(f)

    if not raw or "company" not in raw:
        raise KeyError("config/company.yaml must contain a top-level 'company:' key")

    return CompanyConfig(**raw["company"])


company_config = get_company_config()