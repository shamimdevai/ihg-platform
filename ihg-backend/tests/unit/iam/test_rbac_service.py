"""Unit tests for app.domains.iam.services.rbac_service."""
from app.domains.iam.repositories import permission_repository, role_repository, staff_user_repository
from app.domains.iam.services import rbac_service


async def _make_staff_with_role(db_session, *, permission_codes, is_superadmin=False):
    role = await role_repository.create(db_session, name=f"test-role-{is_superadmin}")
    for code in permission_codes:
        # get-or-create: avoids an IntegrityError when `code` collides with a
        # permission row that already exists for real (e.g. "*", if
        # scripts/seed_data.py has already been run against this database).
        permission = await permission_repository.get_by_code(db_session, code)
        if permission is None:
            permission = await permission_repository.create(db_session, code=code)
        await role_repository.add_permission(db_session, role_id=role.id, permission_id=permission.id)

    # role_repository.create() calls db.refresh(role) immediately after insert, which
    # — because Role.permissions is lazy="selectin" — eagerly loads role.permissions
    # as an empty list at that moment (correct then: no permissions existed yet).
    # add_permission() above inserts the role_permissions association row directly,
    # bypassing the ORM relationship's own mutation API (role.permissions.append(...)),
    # so SQLAlchemy has no way to know that already-loaded collection is now stale —
    # it stays cached as empty for the rest of this session/identity map. Expire it
    # explicitly so the next access (directly, or via staff.role below) re-queries and
    # sees the real grants. Without this, every "should be allowed" assertion below
    # silently sees an empty permission set and fails, while every "should be denied"
    # assertion trivially passes — which is exactly the failure pattern this fixes.
    db_session.expire(role, ["permissions"])

    staff = await staff_user_repository.create(
        db_session,
        email=f"test-{role.id}@example.com",
        first_name="Test",
        last_name="Staff",
        role_id=role.id,
        is_active=True,
        is_superadmin=is_superadmin,
    )
    # Re-fetch so the lazy="selectin" role/permissions relationship is freshly loaded.
    return await staff_user_repository.get_by_id(db_session, staff.id)


async def test_superadmin_bypasses_permission_check(db_session):
    staff = await _make_staff_with_role(db_session, permission_codes=[], is_superadmin=True)
    assert await rbac_service.has_permission(db_session, staff, "anything:not:granted") is True


async def test_staff_with_granted_permission_is_allowed(db_session):
    staff = await _make_staff_with_role(db_session, permission_codes=["hotel:booking:write"])
    assert await rbac_service.has_permission(db_session, staff, "hotel:booking:write") is True


async def test_staff_without_permission_is_denied(db_session):
    staff = await _make_staff_with_role(db_session, permission_codes=["hotel:booking:write"])
    assert await rbac_service.has_permission(db_session, staff, "hotel:booking:delete") is False


# --- Wildcard resolution (Phase 4.5) --------------------------------------------
# Coverage matches RBAC_MATRIX.md §9.3's worked-examples table exactly.


async def test_resource_wildcard_covers_any_action_on_that_resource(db_session):
    """A role holding "<domain>:<resource>:*" passes checks for any action on that resource."""
    staff = await _make_staff_with_role(db_session, permission_codes=["inventory:stock:*"])
    assert await rbac_service.has_permission(db_session, staff, "inventory:stock:adjust") is True
    assert await rbac_service.has_permission(db_session, staff, "inventory:stock:read") is True


async def test_resource_wildcard_does_not_cover_a_different_resource(db_session):
    """"inventory:stock:*" must not leak into a different resource in the same domain."""
    staff = await _make_staff_with_role(db_session, permission_codes=["inventory:stock:*"])
    assert await rbac_service.has_permission(db_session, staff, "inventory:supplier:write") is False


async def test_domain_wildcard_covers_any_resource_in_that_domain(db_session):
    """A role holding "<domain>:*" passes checks for any resource/action within that domain."""
    staff = await _make_staff_with_role(db_session, permission_codes=["inventory:*"])
    assert await rbac_service.has_permission(db_session, staff, "inventory:stock:adjust") is True
    assert await rbac_service.has_permission(db_session, staff, "inventory:supplier:write") is True
    assert await rbac_service.has_permission(db_session, staff, "inventory:alert:resolve") is True


async def test_domain_wildcard_does_not_cover_a_different_domain(db_session):
    staff = await _make_staff_with_role(db_session, permission_codes=["inventory:*"])
    assert await rbac_service.has_permission(db_session, staff, "iam:staff:write") is False


async def test_global_wildcard_covers_any_permission_whatsoever(db_session):
    """A role holding "*" passes any check, in any domain — this is how Admin is seeded
    as of Phase 4.5 (scripts/seed_data.py), distinct from is_superadmin (see module
    docstring and PROJECT_STATE.md §7.3)."""
    staff = await _make_staff_with_role(db_session, permission_codes=["*"])
    assert await rbac_service.has_permission(db_session, staff, "hotel:booking:write") is True
    assert await rbac_service.has_permission(db_session, staff, "iam:staff:write") is True
    assert await rbac_service.has_permission(db_session, staff, "anything:not:seeded") is True


async def test_two_part_code_wildcard_resolution_skips_resource_level(db_session):
    """Single-resource domains (e.g. settings) have no resource segment to wildcard
    independently — resolution goes straight from the exact code to the domain-level
    wildcard, per _wildcard_candidates' documented behavior."""
    staff = await _make_staff_with_role(db_session, permission_codes=["settings:*"])
    assert await rbac_service.has_permission(db_session, staff, "settings:write") is True
    assert await rbac_service.has_permission(db_session, staff, "settings:read") is True


async def test_split_permissions_remain_independent_under_wildcard_resolution(db_session):
    """Confirms wildcard resolution does not accidentally widen deliberately-split,
    narrow grants — e.g. an add-only role (holding only "hotel:booking:create") must
    NOT be able to update or delete, exactly the "Receptionist: read + booking:create"
    scenario from the RBAC design discussion."""
    staff = await _make_staff_with_role(
        db_session, permission_codes=["hotel:booking:read", "hotel:booking:create"]
    )
    assert await rbac_service.has_permission(db_session, staff, "hotel:booking:create") is True
    assert await rbac_service.has_permission(db_session, staff, "hotel:booking:update") is False
    assert await rbac_service.has_permission(db_session, staff, "hotel:booking:delete") is False


async def test_superadmin_bypass_is_independent_of_wildcard_mechanism(db_session):
    """is_superadmin short-circuits even with zero permissions/no wildcard granted —
    confirms the two mechanisms (Rule 9 vs Rule 18 in the Global Context Block) stay
    genuinely separate rather than one silently subsuming the other."""
    staff = await _make_staff_with_role(db_session, permission_codes=[], is_superadmin=True)
    assert await rbac_service.has_permission(db_session, staff, "iam:staff:write") is True


def test_wildcard_candidates_three_part_code():
    """Unit-level check of the resolution order itself, independent of the DB."""
    assert rbac_service._wildcard_candidates("customers:guests:write") == [
        "customers:guests:write",
        "customers:guests:*",
        "customers:*",
        "*",
    ]


def test_wildcard_candidates_two_part_code():
    assert rbac_service._wildcard_candidates("settings:write") == [
        "settings:write",
        "settings:*",
        "*",
    ]