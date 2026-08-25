"""Tests for require_module_enabled (Phase 10) — verifies that disabling a business-
line module (hotel/restaurant/delivery) via system_settings makes its routes 404,
that re-enabling restores normal behavior without a restart, and that other,
unrelated modules are unaffected by one module's toggle.

Uses unauthenticated requests deliberately: an ENABLED module's protected endpoint
returns 401 (no token supplied) -- proof the module gate passed and the request
reached the endpoint's own auth dependency. A DISABLED module's endpoint returns 404
-- proof the module gate fired first and rejected the request before auth was ever
evaluated. This contrast is what actually proves the toggle works, without needing
to construct a real staff JWT in this file.
"""
import pytest

from app.domains.settings.services import settings_service


@pytest.fixture(autouse=True)
async def _reset_module_toggles(db_session):
    """Ensure every module toggle is True before and after each test in this file,
    and clear settings_service's in-process cache so no state leaks between tests
    or into other test files.
    """
    settings_service._clear_cache()
    for key in ("hotel_module_enabled", "restaurant_module_enabled", "delivery_module_enabled"):
        await settings_service.set_setting(
            db_session, key=key, value=True, value_type="bool", is_public=True,
        )
    await db_session.commit()
    yield
    settings_service._clear_cache()
    for key in ("hotel_module_enabled", "restaurant_module_enabled", "delivery_module_enabled"):
        await settings_service.set_setting(
            db_session, key=key, value=True, value_type="bool", is_public=True,
        )
    await db_session.commit()


@pytest.mark.asyncio
async def test_enabled_module_reaches_auth_check(client):
    """Hotel enabled + no token -> 401, not 404: the request reached the endpoint's
    own auth dependency, proving the module gate did not block it.
    """
    response = await client.get("/api/v1/hotel/hotels")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_disabled_module_returns_404_before_auth(client, db_session):
    """Disabling hotel_module_enabled makes every /hotel/* route 404, even for an
    unauthenticated caller -- proof the module gate fires ahead of (or independent
    of) the auth dependency, not after it.
    """
    await settings_service.set_setting(
        db_session, key="hotel_module_enabled", value=False, value_type="bool", is_public=True,
    )
    await db_session.commit()

    response = await client.get("/api/v1/hotel/hotels")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_toggle_takes_effect_without_restart(client, db_session):
    """Disable then re-enable within the same test/process -- no app restart -- and
    confirm the route's behavior flips both times. This is the core claim of Option B
    (per-request DB check) over Option A (startup-time-only mount).
    """
    await settings_service.set_setting(
        db_session, key="hotel_module_enabled", value=False, value_type="bool", is_public=True,
    )
    await db_session.commit()
    disabled_response = await client.get("/api/v1/hotel/hotels")
    assert disabled_response.status_code == 404

    await settings_service.set_setting(
        db_session, key="hotel_module_enabled", value=True, value_type="bool", is_public=True,
    )
    await db_session.commit()
    enabled_response = await client.get("/api/v1/hotel/hotels")
    assert enabled_response.status_code == 401  # back to normal: reaches auth check


@pytest.mark.asyncio
async def test_disabling_one_module_does_not_affect_another(client, db_session):
    """Disabling hotel must not touch restaurant or delivery -- each module's gate
    checks its own independent setting key.
    """
    await settings_service.set_setting(
        db_session, key="hotel_module_enabled", value=False, value_type="bool", is_public=True,
    )
    await db_session.commit()

    hotel_response = await client.get("/api/v1/hotel/hotels")
    assert hotel_response.status_code == 404

    restaurant_response = await client.get("/api/v1/restaurant/restaurants")
    assert restaurant_response.status_code == 401  # unaffected -- reaches auth check

    delivery_response = await client.get("/api/v1/delivery/orders")
    assert delivery_response.status_code == 401  # unaffected -- reaches auth check