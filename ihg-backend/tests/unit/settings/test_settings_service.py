"""Unit tests for app.domains.settings.services.settings_service.

Requires a reachable Postgres database (see tests/conftest.py db_session fixture) with
migrations applied — run via `make test` (docker compose), not bare `pytest` outside
Docker, unless DATABASE_URL in your local .env points at a running Postgres instance.
"""
import pytest

from app.domains.settings.services import settings_service


@pytest.fixture(autouse=True)
def _reset_cache():
    """Ensure the in-process settings cache doesn't leak state between tests."""
    settings_service._clear_cache()
    yield
    settings_service._clear_cache()


async def test_set_and_get_setting_roundtrip(db_session):
    await settings_service.set_setting(
        db_session, key="test_roundtrip_key", value={"foo": "bar"}, value_type="json"
    )
    result = await settings_service.get_setting(db_session, "test_roundtrip_key")
    assert result == {"foo": "bar"}


async def test_get_setting_returns_default_when_missing(db_session):
    result = await settings_service.get_setting(db_session, "definitely_missing_key", default="fallback")
    assert result == "fallback"


async def test_set_setting_invalidates_cache(db_session):
    await settings_service.set_setting(db_session, key="test_cache_key", value=1, value_type="int")
    assert await settings_service.get_setting(db_session, "test_cache_key") == 1

    await settings_service.set_setting(db_session, key="test_cache_key", value=2, value_type="int")
    assert await settings_service.get_setting(db_session, "test_cache_key") == 2


async def test_seed_defaults_creates_module_toggles(db_session):
    await settings_service.seed_defaults(db_session)
    assert await settings_service.get_setting(db_session, "hotel_module_enabled") is True
    assert await settings_service.get_setting(db_session, "restaurant_module_enabled") is True
    assert await settings_service.get_setting(db_session, "delivery_module_enabled") is True


async def test_seed_defaults_is_idempotent(db_session):
    await settings_service.seed_defaults(db_session)
    await settings_service.set_setting(
        db_session, key="hotel_module_enabled", value=False, value_type="bool"
    )
    await settings_service.seed_defaults(db_session)
    # seed_defaults must not overwrite an existing value
    result = await settings_service.get_setting(db_session, "hotel_module_enabled")
    assert result is False


async def test_list_public_settings_excludes_private(db_session):
    await settings_service.set_setting(
        db_session, key="test_public_key", value="visible", value_type="string", is_public=True
    )
    await settings_service.set_setting(
        db_session, key="test_private_key", value="hidden", value_type="string", is_public=False
    )
    public = await settings_service.list_public_settings(db_session)
    assert public.get("test_public_key") == "visible"
    assert "test_private_key" not in public