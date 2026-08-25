"""Seed default departments, permissions, and roles (with permission assignments).

Run via `make seed` (docker compose run --rm api python scripts/seed_data.py).
Also seeds default system_settings via settings_service.seed_defaults(). Idempotent —
safe to run multiple times.
"""
import asyncio
import sys
from pathlib import Path

# Add the project root to sys.path so `import app...` resolves when this script is
# invoked directly (`python scripts/seed_data.py`), since only the script's own
# directory is added to sys.path by default, not the project root.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db.connection import AsyncSessionLocal  # noqa: E402
from app.domains.iam.repositories import department_repository, permission_repository, role_repository  # noqa: E402
from app.domains.settings.services import settings_service  # noqa: E402

DEFAULT_DEPARTMENTS = ["Reception", "Housekeeping", "Kitchen", "Delivery", "Management"]

DEFAULT_PERMISSIONS = [
    ("settings:read", "View system settings"),
    ("settings:write", "Modify system settings"),
    ("iam:staff:read", "View staff accounts"),
    ("iam:staff:write", "Create/update/deactivate staff accounts"),
    ("iam:roles:read", "View roles and their permissions"),
    ("iam:roles:write", "Create/update roles and assign permissions"),
    ("iam:permissions:read", "View permissions"),
    ("iam:departments:read", "View departments"),
    ("iam:departments:write", "Create/update departments"),
# Added Phase 4.5 — fixes a confirmed live bug: guests.py has gated its endpoints
    # with these two codes since Phase 4, but neither was ever seeded, so no role
    # (including Admin, previously an enumerated list) could be granted access to any
    # guest endpoint. See PROJECT_STATE.md Open Decision #25 / RBAC_MATRIX.md §10 #1.
    ("customers:guests:read", "View hotel guests"),
    ("customers:guests:write", "Create/update hotel guests"),
    # Added Phase 4.5 — enables the Admin role to hold one self-maintaining grant
    # instead of an enumerated list that silently under-grants as new domains ship
    # permissions. See PROJECT_STATE.md Open Decision #24 / RBAC_MATRIX.md §9.
    ("*", "Wildcard — full access to every permission, platform-wide"),
# Added Phase 5 — inventory domain. Seeded in the SAME unit of work as
    # app/domains/inventory/api/*.py, per the explicit lesson from the Phase 4
    # customers:guests:* gap (PROJECT_STATE.md Open Decision #25). Admin already
    # covers all of these via its "*" wildcard grant — no DEFAULT_ROLES change was
    # made for any other role this phase (kept Admin-only, per explicit instruction;
    # RBAC_MATRIX.md §5.2's proposed Manager/Housekeeping/Waiter/Kitchen grants are
    # deferred to a future, explicit decision). inventory:stock:adjust and
    # inventory:alert:resolve are named exceptions rather than "write", since each
    # is one specific audited action, not general CRUD (RBAC_MATRIX.md §8).
    ("inventory:item:read", "View inventory items"),
    ("inventory:item:write", "Create/update/delete inventory items"),
    ("inventory:stock:read", "View stock levels and transaction history"),
    ("inventory:stock:adjust", "Manually adjust an item's stock level"),
    ("inventory:supplier:read", "View suppliers"),
    ("inventory:supplier:write", "Create/update/delete suppliers"),
    ("inventory:alert:read", "View low-stock alerts"),
    ("inventory:alert:resolve", "Resolve a low-stock alert"),
# Added Phase 6 — payments domain. Seeded in the SAME unit of work as
    # app/domains/payments/api/payments.py, per the standing lesson from the Phase
    # 4 customers:guests:* gap. Admin already covers all of the below via its "*"
    # wildcard grant — no DEFAULT_ROLES change made, consistent with the Phase 5
    # inventory decision to keep new-domain grants Admin-only for now.
    #
    # payments:write now covers only the core payment lifecycle (create intent,
    # confirm) — refunds and payment methods were split out below in Phase 6.5
    # once real roles emerged that need partial access (RBAC_MATRIX.md §8
    # governance rule: split when a real role needs it, not speculatively).
    ("payments:read", "View payments"),
    ("payments:write", "Create and confirm payments"),
# Phase 6.5 — payment method CRUD split from the general payments:write, since
    # method management (incl. delete) is a distinct concern from the payment
    # lifecycle itself.
    ("payments:method:read", "View payment methods"),
    ("payments:method:write", "Create/delete payment methods"),
    # Phase 6.5 — dual-refund architecture. Three separate codes because three
    # distinct roles are now real: staff who can refund immediately
    # (payments:refund:direct, e.g. Finance Admin), staff who can only ask for a
    # refund (payments:refund:request, e.g. Reception/Desk Staff), and staff who
    # review those requests (payments:refund:review, e.g. Refund Manager).
    # Approve+reject are kept as one "review" permission rather than split further
    # — a role trusted to approve a refund is reasonably trusted to reject one too,
    # and RBAC_MATRIX.md §8 warns against pre-splitting without a concrete need.
    ("payments:refund:direct", "Directly refund a paid payment, no approval required"),
    ("payments:refund:request", "Request a refund for admin review"),
    ("payments:refund:review", "List, approve, and reject refund requests"),

# Added Phase 7 — hotel domain. Seeded in the SAME unit of work as
    # app/domains/hotel/api/*.py, per the standing lesson from the Phase 4
    # customers:guests:* gap. This domain is the concrete case RBAC_MATRIX.md
    # §4.5-4.9 flagged as needing a real split: Housekeeping staff must be able to
    # update housekeeping tasks WITHOUT any booking/invoice access, so hotel:* is
    # never used as a literal permission code — each resource gets its own
    # read/write pair. hotel:service_request:* was added beyond RBAC_MATRIX.md's
    # originally proposed 4-resource catalog, following the same §8 governance
    # rule (default read/write pair per resource).
    ("hotel:room:read", "View hotels, room types, and rooms"),
    ("hotel:room:write", "Create/update hotels, room types, and rooms"),
    ("hotel:booking:read", "View bookings"),
    ("hotel:booking:write", "Create, check in/out, and cancel bookings"),
    ("hotel:housekeeping:read", "View housekeeping tasks"),
    ("hotel:housekeeping:write", "Create, assign, and update housekeeping tasks"),
    ("hotel:invoice:read", "View invoices"),
    ("hotel:invoice:write", "Generate, issue, and pay invoices"),
    ("hotel:service_request:read", "View in-room service requests"),
    ("hotel:service_request:write", "Create, assign, and update in-room service requests"),

# Added Phase 8 — restaurant domain. Seeded in the SAME unit of work as
    # app/domains/restaurant/api/*.py, per the standing lesson from the Phase 4
    # customers:guests:* gap. Task spec's "minimum split" instruction calls for
    # exactly 4 resource groups here — restaurant:table:* deliberately covers
    # restaurants.py, tables.py, reservations.py, AND waiters.py (waiter-to-table
    # assignment is a table-management action), mirroring hotel:room:* covering
    # hotels/room-types/rooms as one grouped resource. restaurant:order:* and
    # restaurant:kitchen:* are the two codes the task explicitly calls for
    # splitting apart, so the Waiter role can hold order access without menu
    # write, and the Kitchen role can hold kitchen access without table/
    # reservation access — see DEFAULT_ROLES below.
    ("restaurant:table:read", "View restaurants, dining tables, reservations, and waiter assignments"),
    ("restaurant:table:write", "Create/update restaurants and tables; manage reservations and waiter assignments"),
    ("restaurant:menu:read", "View menu categories and items"),
    ("restaurant:menu:write", "Create/update menu categories and items, incl. images"),
    ("restaurant:order:read", "View dine-in orders"),
    ("restaurant:order:write", "Place, bill, and cancel dine-in orders"),
    ("restaurant:kitchen:read", "View kitchen tickets"),
    ("restaurant:kitchen:write", "Update kitchen ticket status"),

# Added Phase 9 — delivery domain. Seeded in the SAME unit of work as
    # app/domains/delivery/api/*.py, per the standing lesson from the Phase 4
    # customers:guests:* gap. Task spec's minimum split calls for exactly
    # delivery:order:read/write and delivery:rider:read/write, plus asks us to
    # consider a narrower delivery:order:update_status distinct from full
    # delivery:order:write — added as a genuine named exception (RBAC_MATRIX.md
    # §8 governance rule), since the Rider role needs to progress deliveries
    # actually assigned to them (pickup/deliver) without also holding
    # confirm/preparing/ready/cancel access over every order in the system.
    # Order PLACEMENT itself is not gated by any of these codes at all — it's a
    # customer-facing action behind get_current_customer +
    # require_verified_customer (app/api/v1/deps.py), the same structural
    # separation every other customer self-service endpoint uses.
    ("delivery:order:read", "View delivery orders"),
    ("delivery:order:write", "Confirm, progress (preparing/ready), and cancel delivery orders"),
    ("delivery:order:update_status", "Mark an assigned delivery as picked up or delivered"),
    ("delivery:rider:read", "View delivery riders and rider-to-order assignments"),
    ("delivery:rider:write", "Create/update rider profiles, set rider status, and dispatch riders to orders"),

    # Added Phase 10 — reporting domain. Read-only, owns no tables, so a single
    # code covers it (mirrors settings' 2-part collapse: one resource, one action
    # that matters). No reporting:write exists — there is nothing to write.
    ("reporting:read", "View dashboard aggregates and revenue reports"),
]

# role_name -> list of permission codes granted to that role
DEFAULT_ROLES = {
    # Was an enumerated list of every DEFAULT_PERMISSIONS code. Switched to a single
    # wildcard grant now that rbac_service.has_permission() resolves "*" (Phase 4.5).
    # Behaviorally equivalent ("Admin can do everything") but no longer goes stale
    # when a future phase adds new permission codes.
    "Admin": ["*"],
        # Added reporting:read, Phase 10 — RBAC_MATRIX.md's own §5.2 proposed table
    # anticipated Manager holding this (alongside Admin) once reporting existed;
    # implementing that now that the domain is real.
    "Manager": [
        "iam:staff:read", "iam:roles:read", "iam:permissions:read", "iam:departments:read",
        "settings:read", "reporting:read",
    ],
    # Added customers:guests:read/write — Reception's actual job (per
    # IHG_Architecture.md Part A) is managing hotel guests; the previous seed left it
    # with only iam:staff:read, which had no bearing on that job at all.
    # Updated Phase 7 — Reception's job (per the architecture doc's business
    # process: guest books -> Reception confirms -> guest checks in -> ... ->
    # checks out) needs room visibility + booking management + check-in/out.
    # hotel:booking:write was verified to cover only create/cancel/check-in/
    # check-out (bookings.py, checkin.py, checkout.py) — it does NOT reach
    # invoice generation or payment (those are hotel:invoice:*, a separate code
    # gating invoices.py only), so this grant carries no financial privilege.
    # hotel:invoice:* and hotel:service_request:* are deliberately withheld from
    # Reception — left Admin-only, no change requested for those.
    "Reception": [
        "iam:staff:read",
        "customers:guests:read",
        "customers:guests:write",
        "hotel:room:read",
        "hotel:booking:read",
        "hotel:booking:write",
    ],
    # Updated Phase 8 — Waiter's actual job is taking and managing dine-in
    # orders at their assigned tables. Granted restaurant:order:read/write per
    # the task spec ("dine-in-order access"), plus restaurant:menu:read so a
    # waiter can see what's on the menu while taking an order — but explicitly
    # NOT restaurant:menu:write ("without menu-editing rights", per the task
    # spec) and NOT restaurant:table:*, since table/reservation/waiter-
    # assignment management is a supervisory/host action, not the waiter's own.
    "Waiter": ["restaurant:order:read", "restaurant:order:write", "restaurant:menu:read"],
    # Updated Phase 8 — Kitchen's actual job is working the kitchen ticket
    # queue. Granted restaurant:kitchen:read/write only, per the task spec
    # ("kitchen-ticket access without table/reservation access") — kitchen
    # tickets are returned with embedded order-item summaries (see
    # KitchenTicketDetailRead), so Kitchen never needs restaurant:order:read
    # either, keeping this role scoped to exactly one resource group.
    "Kitchen": ["restaurant:kitchen:read", "restaurant:kitchen:write"],
    # Updated Phase 9 — Rider's actual job is progressing deliveries actually
    # assigned to them (pickup/deliver) and viewing their own order/rider
    # data. Granted delivery:order:read (see which orders exist/are assigned)
    # and delivery:order:update_status (the narrow pickup/deliver action,
    # ownership-checked in delivery_tracking_service — a Rider still can't
    # progress anyone else's delivery even with this code) and
    # delivery:rider:read (view their own rider profile via GET
    # /delivery/riders/me). Deliberately NOT delivery:order:write (confirm/
    # preparing/ready/cancel is a restaurant/dispatcher action, not a rider's)
    # and NOT delivery:rider:write (a Rider cannot create rider profiles,
    # edit anyone's vehicle info, force a status change, or dispatch
    # themselves/others to an order — dispatch is a supervisory action, same
    # reasoning as restaurant:table:* gating waiter-to-table assignment
    # rather than restaurant:order:*).
    "Rider": ["delivery:order:read", "delivery:order:update_status", "delivery:rider:read"],
    # Added Phase 4.5 — "Housekeeping" existed in DEFAULT_DEPARTMENTS but had no
    # matching role. Seeded empty for now; real hotel:housekeeping:* permissions
    # don't exist until Phase 7 builds the hotel domain.
    # Updated Phase 7 — Housekeeping's role now holds real permissions, scoped
    # deliberately to hotel:housekeeping:* only (RBAC_MATRIX.md §4.5-4.9 footnote:
    # "Housekeeping's hotel:* access should be scoped to hotel:housekeeping:* only,
    # not hotel:booking:*/hotel:invoice:*").
    "Housekeeping": ["hotel:housekeeping:read", "hotel:housekeeping:write"],
}


async def seed() -> None:
    """Insert default departments, permissions, and roles if they don't already exist."""
    async with AsyncSessionLocal() as db:
        for name in DEFAULT_DEPARTMENTS:
            if await department_repository.get_by_name(db, name) is None:
                await department_repository.create(db, name=name)
                print(f"Created department: {name}")

        code_to_id = {}
        for code, description in DEFAULT_PERMISSIONS:
            existing = await permission_repository.get_by_code(db, code)
            if existing is None:
                existing = await permission_repository.create(db, code=code, description=description)
                print(f"Created permission: {code}")
            code_to_id[code] = existing.id

        for role_name, permission_codes in DEFAULT_ROLES.items():
            role = await role_repository.get_by_name(db, role_name)
            if role is None:
                role = await role_repository.create(db, name=role_name)
                print(f"Created role: {role_name}")

            existing_permission_ids = {p.id for p in role.permissions}
            for code in permission_codes:
                permission_id = code_to_id[code]
                if permission_id not in existing_permission_ids:
                    await role_repository.add_permission(db, role_id=role.id, permission_id=permission_id)
                    print(f"  Granted {code} to {role_name}")

        await settings_service.seed_defaults(db)
        print("Seeded default system settings.")

        await db.commit()
    print("Seeding complete.")


if __name__ == "__main__":
    asyncio.run(seed())