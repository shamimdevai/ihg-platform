# PROJECT_STATE.md
### IHG Enterprise Hospitality, Restaurant & Food Delivery Management Platform — Backend API

| | |
|---|---|
| **Client** | International Hospitality Group |
| **Issued To** | Development Team, AI-Powered Software Engineering (Batch 26/4 & 26/5), ICT Bangladesh |
| **Project Timeline** | 1 August – 30 September 2026 |
| **Document Owner** | Development Team |
| **Document Type** | Living project state — updated after every phase/session. This is a **standalone, self-contained document** — it does not reference or depend on any prior version. |
| **Version** | v2.11 — Phase 10 (Reporting, cross-domain wiring, docs/infra hardening) **partially complete** — flagged explicitly, not silently marked done: the `reporting` domain itself, the module-toggle mechanism, the cross-domain e2e proof, and Docker Compose production hardening are all built and live-verified; the six `docs/*.md` deliverables are only **one-sixth done** (`API_CONVENTIONS.md` only — deliberately prioritized ahead of the rest at the user's request, since a React frontend build starts immediately after this session, before the "Deployment" step this roadmap originally sequenced Phase 10 around). See §8's Phase 10 checklist below for the exact item-by-item split. `reporting` domain: 0 models (owns no tables, calls other domains' services only), 2 services (`dashboard_service.py`, `report_service.py`, plus an internal `_utils.py` helper), 2 schema files, 2 API files/3 endpoints (`GET /reporting/dashboard`, `GET /reporting/reports/revenue`, `GET /reporting/reports/revenue/export`). No migration needed (reporting owns no tables) — `model_registry.py` correctly never gained a `reporting` entry. `scripts/seed_data.py` updated with 1 new permission code (`reporting:read`), granted to `Admin` (via `*`) and, breaking with `inventory`/`payments`'s Admin-only precedent, also directly to `Manager` — the first time this document's own §5.2-successor proposed grant (RBAC_MATRIX.md's pre-Phase-10 draft) was applied exactly as anticipated. Full test suite confirmed green (**114/114** — 108 prior + 4 module-toggle-gating tests + 2 new cross-domain e2e tests). New mechanism, not tied to any one domain: `app.api.v1.deps.require_module_enabled()` — a per-request dependency (Option B of two designs discussed; startup-time-only mounting was rejected as inconsistent with `system_settings`' own "no redeploy" design principle), applied at router-mount time in `api.py` via `include_router(..., dependencies=[...])`, gating `hotel`/`restaurant`/`delivery`'s routers (never `settings`/`iam`/`customers`/`inventory`/`payments`/`reporting`, which stay always-on) behind their respective `<domain>_module_enabled` system_settings toggle — disabled returns 404, not 403, and takes effect on the very next request with zero restart/redeploy. One unresolved discrepancy flagged rather than papered over: live route enumeration under the same methodology prior phases used (`/api/v1/*` + `/health` paths on the booted app) now shows **173** routes — 4 *fewer* than the naively-expected 177 (Phase 9's stated 174 + reporting's 3 new endpoints), not the expected increase. Reproduced twice, including after a full `docker compose down` + `up -d --build` to rule out a stale image. Root cause not yet identified — see Open Decision #54. |

---

## 1. Project Summary

A single connected backend platform bringing Hotel, Restaurant, and Food Delivery operations
under one system, replacing manual/spreadsheet-based workflows. The system centralizes data,
enforces role-based access for staff, gives external guests/customers self-service accounts,
and exposes reporting for management decision-making. Built API-first and **white-label by
design** — a single config file and a runtime settings table let the same codebase be
redeployed for a different company without code changes. Designed to support future
AI-powered features (chat support, personalized recommendations) without a rebuild.

Full business context lives in the original client proposal and in the standalone
`IHG_Architecture.md` (**v2.5** — design rationale) / `IHG_Traceability.md` (**v2.4** —
proposal-requirement mapping) documents — split from an earlier combined file, each updated
post-Phase-10a to reflect `delivery` and `reporting` as built (previously two full phases stale).
This document (`PROJECT_STATE.md`) covers **engineering state only**. Day-to-day Docker commands,
local setup, troubleshooting, and DB access instructions live in
`docs/DOCKER_AND_OPERATIONS_GUIDE.md` (**v2**, updated post-Phase-10a) — kept separate so this
file stays focused on architecture and progress tracking. Role/permission details — the exact,
verified permission catalog and endpoint gating — live in `RBAC_MATRIX.md` (**v7 as of this
session**, updated in the same unit of work as this document per the standing lesson from the
Phase 4.5→6.5 documentation-drift incident — see `RBAC_MATRIX.md`'s own header for the full
history). White-label/auth/platform-ops design detail lives in
`IHG_WhiteLabel_Auth_PlatformOps.md` (**v3**, updated post-Phase-10a — the module-toggle section,
§1.3, is the single most significantly revised section, since Phase 10 is what actually built the
mechanism that document had previously only described as planned). Per-phase build prompts live
in `IHG_AI_SubTask_Prompts.md` (v2.2/2.3).

**Note on the repo's own `docs/` folder**: as of the last confirmed repo snapshot, several files
listed in §5 below (`docs/RBAC_MATRIX.md`, `docs/ARCHITECTURE.md`, etc.) were still empty
placeholders *inside the repository itself*. This was first flagged as an open item at Phase 4.5
and **still has not been closed** — now six phases further behind (5, 6, 6.5, 7, 8, and 9). The real, current content
for all of these exists only as separate deliverables (this document, `RBAC_MATRIX.md`, etc.)
that should be copied into the repo's `docs/` folder so it isn't misleading to anyone browsing
the repo directly. Carried forward again in §8.

---

## 2. Technology Stack

| Layer | Choice | Pinned version (confirmed via `requirements.txt`) |
|---|---|---|
| Language | Python 3.11 | — |
| API Framework | FastAPI | `fastapi==0.115.6`, `uvicorn[standard]==0.32.1` |
| ORM | SQLAlchemy 2.0 (async) | `sqlalchemy==2.0.36`, `asyncpg==0.30.0` |
| Migrations | Alembic | `alembic==1.14.0` |
| Database | PostgreSQL | — |
| Containerization | Docker & Docker Compose | — |
| Validation | Pydantic v2 | `pydantic==2.10.3`, `pydantic-settings==2.6.1` |
| Auth | JWT (separate token flows for Staff vs Customer), refresh-token session tracking | `python-jose[cryptography]==3.3.0` |
| Password hashing | Argon2 | `passlib[argon2]==1.7.4`, `argon2-cffi==23.1.0` |
| Background Jobs | Celery (+ Redis broker) — **not yet introduced**, deferred until a phase first needs background jobs (Open Decision #3) | not yet in requirements.txt |
| Testing | Pytest (unit / integration / e2e) | `pytest==8.3.4`, `pytest-asyncio==0.24.0` (in `requirements-dev.txt`) |
| File handling | Image upload, PDF generation, Excel export (all in `shared_kernel`) | PDF: `xhtml2pdf==0.2.16` · Excel: `openpyxl==3.1.5` |
| Email sending | Async SMTP | `aiosmtplib==3.0.2`, `Jinja2==3.1.4` (templates) |
| Dev Email Testing | Mailpit (Docker Compose service, dev/test only — never used in production) | — |
| Config loading | YAML (`company.yaml`) | `pyyaml==6.0.2` |
| Misc | `httpx`, `email-validator`, `python-dotenv`, `python-multipart` | `httpx==0.28.1`, `email-validator==2.2.0`, `python-dotenv==1.0.1`, `python-multipart==0.0.19` |
| Dev tooling | `black`, `isort`, `mypy`, `flake8` | `black==24.10.0`, `isort==5.13.2`, `mypy==1.13.0`, `flake8==7.1.1` |

**Dependency management note (deviation from original plan):** the repo uses **both**
`pyproject.toml` (tool config for black/isort/mypy/pytest) **and** `requirements.txt` +
`requirements-dev.txt` (actual dependency pinning) — not `pyproject.toml` alone as originally
planned. `requirements-dev.txt` starts with `-r requirements.txt` and layers on test/lint tools.

**No new third-party dependencies were introduced in Phases 5, 6, 6.5, 7, 8, or 9.** The simulated
payment gateway (Phase 6) and simulated webhook (Phase 6.5) use only the standard library
(`hmac.compare_digest` for the webhook signature check) — deliberately, since neither phase
integrates a real payment provider yet (see Open Decision #35). Phase 7's invoice PDF generation
reuses the existing `xhtml2pdf`-based `pdf_service.py` built in Phase 2 — no new PDF/rendering
dependency was needed. Phase 8's menu-item image upload reuses the existing
`shared_kernel.services.upload_service` built in Phase 2 as well — no new upload/storage
dependency was needed either. Phase 9 needed no new dependency either — delivery order placement
is plain request/response CRUD plus cross-domain service calls into `restaurant`, `inventory`,
`customers`, and `iam`, none of which required any new library.

---

## 3. Architecture Principles (non-negotiable)

1. **Domain-driven modular monolith.** Each business domain is a self-contained vertical slice:
   `app/domains/<domain>/{models, repositories, services, schemas, api}/`
2. **Layered data access — strict order.** `api → services → repositories → models`.
   Repositories contain *only* raw DB queries. Services contain business logic, validation,
   and orchestration (including cross-domain calls). API routes never touch models or
   repositories directly.
3. **Staff vs Customer separation is structural, not just logical.** `staff_user` is the only
   table connected to `role` / `permission` / `audit_log`. Guests and customers are external
   identities with no RBAC relationship whatsoever.
4. **No cross-domain model or repository imports.** A domain may only import its own models
   and repositories directly. If it needs another domain's data, it calls that domain's
   **service** function — services are the only public interface between domains.
   **Confirmed exercised in practice, Phase 5**: `inventory.services.stock_alert_service`
   calls `iam.services.department_service.list_departments()` and
   `iam.services.staff_service.list_staff()` for low-stock alert fan-out — zero changes made to
   `iam`'s models/repositories/services. **Confirmed again, Phase 7 — the first time TWO
   separate cross-domain service calls exist in a single call chain**: `hotel.services.
   booking_service._verify_guest_exists()` calls `customers.services.guest_service.get_guest()`,
   and `hotel.services.invoice_service.pay_invoice()` calls `payments.services.payment_service.
   create_payment_intent()`/`confirm_payment()` — `hotel` imports zero models or repositories
   from either `customers` or `payments`. **Confirmed again, Phase 8**: `restaurant.services.
   dine_in_order_service._consume_inventory_for_item()` calls `inventory.services.
   inventory_service.adjust_stock()` (skipped entirely when a `MenuItem` has no
   `inventory_item_id` linked — see rule 9 below), and `restaurant.services.menu_service.
   _verify_inventory_item_exists()` calls `inventory.services.inventory_service.get_item()` as a
   pure existence check before letting a menu item reference an inventory item — `restaurant`
   imports zero models or repositories from `inventory`, following the exact pattern
   `hotel.services.booking_service._verify_guest_exists()` set for `customers` in Phase 7.**
   **Confirmed a fourth time, Phase 9 — the first domain to call into THREE separate peer
   domains' services in a single call chain**: `delivery.services.delivery_order_service.
   place_order()` calls `restaurant.services.restaurant_service.get_restaurant()` +
   `restaurant.services.menu_service.get_item()` (menu-item snapshotting), `customers.services.
   address_service.get_address()` (delivery-address ownership check), and — via
   `_consume_inventory_for_item()` — `inventory.services.inventory_service.adjust_stock()`,
   mirroring `restaurant`'s own Phase 8 pattern exactly. `delivery.services.rider_service.
   create_rider()` additionally calls `iam.services.staff_service.get_staff()` as a cross-domain
   existence check — the first time any domain other than `hotel`'s `booking_service` has needed
   to verify a staff account exists before referencing it. `delivery` imports zero models or
   repositories from `restaurant`, `inventory`, `customers`, or `iam`.**
5. **Shared, non-business logic lives in `shared_kernel/`** (uploads, PDF, Excel, email,
   notifications, password reset tokens) — never duplicated per-domain.
6. **Framework plumbing only in `core/`** — no business rules here, ever.
   **Deviation, Phase 6.5**: `core/config.py` gained one new field,
   `PAYMENTS_WEBHOOK_SECRET` — a configuration value, not business logic, so this stays
   consistent with the rule; flagged explicitly at the time as a cross-domain-adjacent touch
   requiring the user's awareness before editing (see Open Decision #36).
7. **Every endpoint response uses the standard envelope**: `{success, message, data, meta}`.
8. **Every schema change ships with an Alembic migration**, in the same unit of work, and must
   be visible to Alembic via `app/db/model_registry.py` (see §7.4). **Confirmed for real,
   Phases 5/6/6.5/7**: migrations `0004`, `0005`, `0006`, `0007` were each generated in the same
   unit of work as their models and applied via `alembic upgrade head` against a live Postgres
   instance before being handed over — not just written and assumed correct. **Correction, this
   pass (v2.10)**: an earlier draft of this rule's Phase 8 note (carried in v2.9) stated that
   `0008_add_restaurant_tables.py` had NOT yet been applied against a live instance at hand-off,
   since no Docker/DB access was available in that authoring session. That note went stale the
   moment the user actually ran it — Phase 8's roadmap entry (§8) and Change Log already recorded
   the real outcome (`alembic upgrade head` applied `0008` for real, full suite 106/106 confirmed
   by the user directly) but this rule's own wording was never brought back in sync. Corrected
   here rather than silently left contradictory. **Phase 9's `0009_add_delivery_tables.py`** was
   generated in the same unit of work as its models, chain-verified (`0007→0008→0009`), applied
   for real via `alembic upgrade head`, and confirmed by the user directly (108/108) — no
   applied-vs-written ambiguity this time.
9. **Payments are loosely coupled** to other domains via `reference_type` + `reference_id` —
   never a hard foreign key from `payments` into `hotel`/`restaurant`/`delivery`. **Now
   implemented, not just planned**: `Payment.reference_type` / `Payment.reference_id` are plain
   columns with no FK constraint, confirmed in migration `0005`. **Confirmed exercised from the
   other side, Phase 7**: `invoice_service.pay_invoice()` calls `payment_service.
   create_payment_intent(reference_type="hotel_invoice", reference_id=invoice.id, ...)` — the
   first real call site anywhere in the codebase supplying a non-generic `reference_type`. The
   same no-hard-FK convention was also applied to every other cross-domain-shaped reference
   inside `hotel` itself: `Booking.guest_id` (→ `customers.hotel_guest`), `Booking.
   booked_by_staff_id`, `HousekeepingTask.assigned_to_staff_id`, `ServiceRequest.
   assigned_to_staff_id` (→ `iam.staff_user`), and `Invoice.payment_id` (→ `payments.payment`)
   are all plain UUID columns with zero FK constraints — matching `StockTransaction.
   performed_by_staff_id` and `RefundRequest.requested_by_staff_id`'s precedent exactly.
   **Confirmed a fourth time, Phase 8**: every staff/customer-shaped reference inside
   `restaurant` follows the identical no-hard-FK convention — `TableReservation.
   booked_by_staff_id`/`customer_id`, `DineInOrder.placed_by_staff_id`/`customer_id`,
   `WaiterAssignment.staff_id`. `MenuItem.inventory_item_id` (→ `inventory.inventory_item`) is
   the domain's own new example of the same rule applied to a peer *operational* domain rather
   than `iam`/`customers` — loosely coupled and optional, since not every menu item needs stock
   tracking (see §5's `menu_item.py` entry).
   **Confirmed a fifth time, Phase 9, and now with THREE separate peer-domain-shaped loose
   references on a single model**: `DeliveryOrder.customer_id` (→ `customers.customer`),
   `DeliveryOrder.delivery_address_id` (→ `customers.customer_address`), and
   `DeliveryOrder.restaurant_id` (→ `restaurant.restaurants`) are all plain UUID columns with no
   FK constraint — the first model in the codebase to loosely reference three different domains
   at once. `DeliveryOrderItem.menu_item_id` (→ `restaurant.menu_items`) and
   `DeliveryAssignment.assigned_by_staff_id` (→ `iam.staff_user`) follow the same convention.
   **`DeliveryAssignment.order_id`/`rider_id`, by contrast, ARE real hard FKs** — both target
   tables (`delivery_orders`, `delivery_riders`) live inside `delivery` itself, so the no-hard-FK
   rule (which exists specifically to prevent cross-*domain* coupling) correctly does not apply
   to same-domain references; this mirrors `KitchenTicket.order_id`'s real hard FK inside
   `restaurant` from Phase 8.
10. **All protected endpoints use dependency-injected auth**: `get_current_staff_user()` +
    `require_permission("<domain>:<resource>:<action>")` for staff; `get_current_customer()` for
    customers. Superadmin bypasses permission checks entirely (see §7.3), but never bypasses
    audit logging. Permission code shape confirmed 3-part against real code — see §9,
    Decision #23 — **and now also confirmed across five more built domains (`inventory`,
    `payments`, `hotel`, `restaurant`, `delivery`) with zero exceptions to the shape, including
    named exceptions like `inventory:stock:adjust`, `payments:refund:direct`, and
    `delivery:order:update_status` staying within the 3-part pattern. `restaurant` deliberately
    grouped `restaurants`/`tables`/`reservations`/`waiters` under one `restaurant:table:*`
    resource pair — mirroring `hotel:room:*` covering `hotels`/`room_types`/`rooms` — rather than
    inventing a separate code per API router; the 3-part shape constrains the code's segments,
    not a 1:1 mapping between routers and codes. `delivery:order:update_status` is the exact
    narrower-than-`write` code `RBAC_MATRIX.md` §4.10 (pre-Phase-9) had anticipated Rider would
    need — a real, live confirmation of a governance prediction, not a speculative addition.**
11. **Two-tier configuration.** Static, per-deployment branding lives in `config/company.yaml`
    (redeploy to change). Operationally adjustable values live in the DB-backed
    `system_settings` table (change via API, no redeploy). See §6.
12. **Full type hints + docstrings** on all public functions/classes. PEP8 throughout.
13. **New, Phase 6.5**: **static API path segments must be registered before dynamic
    (`{param}`) segments within the same router**, or FastAPI/Starlette will attempt to parse
    the static segment as the path parameter and the static route becomes unreachable. This bit
    Phase 6's original `payments.py` (`/methods` registered after `/{payment_id}`) before it
    shipped — caught by inspecting route→handler bindings directly, not by chance. Every
    subsequent router (`/methods`, `/methods/{method_id}`, `/webhook`, all registered ahead of
    `/{payment_id}`) follows the corrected ordering, with an inline comment at the boundary.
    **Re-checked against every Phase 7 router, Phase 7**: `hotel`'s 8 routers were designed with
    each resource getting its own router/prefix (`/hotel/hotels`, `/hotel/rooms`, `/hotel/
    bookings`, etc.) rather than one large shared router, so the specific static-vs-dynamic
    collision this rule guards against never had an opportunity to occur — `invoices.py`'s
    `POST /generate/{booking_id}` and `POST /{invoice_id}/issue` sit under genuinely different
    path prefixes (`/generate/...` vs `/{invoice_id}/...`), not a shadowing risk. Confirmed by
    direct route enumeration against the booted app (32 hotel routes), not just visual review.
    **Re-checked again, Phase 8**: `restaurant`'s 7 routers follow the identical
    one-router-per-resource pattern (`/restaurant/restaurants`, `/restaurant/tables`,
    `/restaurant/reservations`, `/restaurant/menu`, `/restaurant/orders`, `/restaurant/kitchen`,
    `/restaurant/waiters`), so this rule's specific static-vs-dynamic collision again never had
    an opportunity to occur. Confirmed by direct route enumeration against the booted app (33
    restaurant routes, 152 total app-wide), not just visual review.
    **Genuinely load-bearing again, Phase 9 — the first domain since `payments` (Phase 6) where
    this rule wasn't structurally avoided by one-router-per-resource design**: `delivery_orders.py`
    mixes customer-facing static paths (`/mine`, `/mine/{order_id}`) with staff-facing dynamic
    paths (`/{order_id}`) in the SAME router, and `riders.py`'s `router` mixes `/me` with
    `/{rider_id}`. Both static blocks are registered before their respective dynamic route, with
    an inline comment at each boundary — this is the first router since `payments.py` itself
    where getting this ordering wrong would have caused a real, silent shadowing bug (a request to
    `GET /delivery/orders/mine` being swallowed by an attempt to parse `"mine"` as a UUID). Confirmed
    by direct route enumeration against the booted app (22 delivery routes, 174 total app-wide).
14. **New, Phase 7 — test infrastructure**: any test file that drives more than one DB-writing
    HTTP request through the `client` fixture, across more than one test function in the same
    pytest run, requires `client` to run on its own dedicated (NullPool) database connection —
    never `app.db.connection`'s pooled production engine. This was not previously an explicit
    rule because no test file before `tests/unit/hotel/test_hotel_booking_flow.py` had two
    separate test functions each make a DB-writing request via `client`; see Open Decision #40
    for the full incident and fix (in `tests/conftest.py`, not `app/db/connection.py`, which
    remains untouched). **Phase 8's `tests/unit/restaurant/test_restaurant_flow.py` relies on
    this same fixed `client` behavior** (its own `cleanup_restaurant_rows` fixture mirrors
    `cleanup_hotel_rows`'s mid-test-commit-then-explicit-teardown pattern exactly) — confirmed
    working correctly, both tests passing cleanly against a live database (106/106 full suite).
    **Phase 9's `tests/unit/delivery/test_delivery_flow.py` relies on the identical fixed
    `client` behavior a third time** (its own `cleanup_delivery_rows` fixture follows the same
    mid-test-commit-then-explicit-teardown shape, additionally hard-deleting a real, persisted
    `StaffUser` row created for the rider — the first cleanup fixture to tear down an `iam` row
    alongside its own domain's rows, since `rider_service.create_rider()` requires a genuinely
    existing staff account, not an in-memory-only one) — confirmed working correctly, both tests
    passing cleanly against a live database (108/108 full suite).
15. **New, Phase 10 — module-toggle gating is a per-request dependency check, not a
    startup-time-only decision.** `app.api.v1.deps.require_module_enabled(module_key)`
    is applied ONCE per domain, at router-mount time in `api.py`, via
    `include_router(..., dependencies=[Depends(require_module_enabled("hotel"))])` —
    never inside an individual domain's own `api/*.py` files, so `hotel`/`restaurant`/
    `delivery`'s existing route files needed zero changes. Checked fresh via
    `settings_service.get_setting()` (itself cached in-process, invalidated on every
    write) on every request — toggling `<domain>_module_enabled` via `PUT /settings/
    {key}` takes effect on the very next request, no restart/redeploy, consistent with
    `system_settings`' own "no redeploy" design principle (§3 rule 11 / §11). Returns
    404, not 403, on a disabled module — a disabled module should look like it doesn't
    exist to a caller, not like a permission boundary. This was an explicit two-option
    design discussion before implementation (Option A: startup-time-only conditional
    mounting, simpler but breaks the no-redeploy contract for this one case; Option B:
    this per-request gate) — Option B was chosen by explicit user sign-off, mirroring
    how Phase 6.5's dual-refund architecture and Phase 7/8's non-Admin RBAC grants were
    each confirmed collaboratively before code was written, not defaulted to.

---

## 4. Domain Map

| Domain | Type | Owns | Status (verified against real repo) |
|---|---|---|---|
| `settings` | Core/infra | Runtime system settings, module toggles, password policy | ✅ Built (Phase 2) — 344 lines across 11 files |
| `iam` | Core | Staff accounts, roles, permissions, departments, audit log, staff sessions, staff auth | ✅ Built (Phase 3) — 1,654 lines |
| `customers` | Core | Hotel guests, restaurant/delivery customers, addresses, customer sessions, customer auth | ✅ Built (Phase 4) — 1,522 lines |
| `inventory` | Shared | Stock items, suppliers, stock transactions, low-stock alerts | ✅ **Built (Phase 5)** — 5 models, 5 repositories, 5 schema files, 3 services, 3 API files (4 routers), 16 endpoints, 11 unit tests. (Exact line count not recorded this pass — earlier line-count figures above were captured during their own phase's session and this convention wasn't repeated for Phase 5/6/6.5; flagged rather than estimated.) |
| `payments` | Thin/shared | Payment records, payment methods (demo/test mode), refund requests | ✅ **Built (Phases 6 + 6.5)** — 3 models, 3 repositories, 4 schema files, 2 services, 2 API files, 14 endpoints, 40 unit tests (21 from Phase 6 + 19 service-layer/2 HTTP-layer from Phase 6.5). |
| `hotel` | Operational | Rooms, bookings, check-in/out, housekeeping, invoices, service requests | ✅ **Built (Phase 7)** — 8 models, 7 repositories, 8 schema files, 6 services, 8 API files/routers, 32 endpoints, 2 unit tests (full booking→check-in→check-out→invoice→PDF flow + Housekeeping permission-split acceptance check). |
| `restaurant` | Operational | Tables, reservations, menu, dine-in orders, kitchen, waiters | ✅ **Built (Phase 8)** — 9 models, 7 repositories, 7 schema files, 6 services, 7 API files/routers, 33 endpoints, 2 unit tests (full reserve→seat→order→kitchen-ticket→bill flow + Waiter/Kitchen permission-split acceptance check). |
| `delivery` | Operational | Delivery orders, riders, assignment, tracking | ✅ **Built (Phase 9)** — 4 models, 3 repositories (order+items combined), 3 schema files, 3 services, 3 API files/4 routers, 22 endpoints, 2 unit tests (full placed→confirmed→preparing→ready→assigned→out_for_delivery→delivered flow + unverified-customer-blocked acceptance check). |
| `reporting` | Read-only | Dashboard aggregation, exportable reports (calls other domains' services only — owns no tables) | ✅ **Built (Phase 10)** — 0 models (by design), 2 services, 2 schema files, 2 API files, 3 endpoints. Gated by `reporting:read` only — no write permission exists, since there is nothing to write. |

---

## 5. Full Project Directory Structure

Legend: **✅** = real, non-empty, built file · **⏳** = file/folder exists as an empty placeholder
(scaffolded but not yet written) · **🆕** = discovered/added during actual coding, not in the
original plan · **🔀** = re-scoped/changed from an earlier phase's version.

```
ihg-platform-api/
│
├── config/
│   └── company.yaml                            # ✅ SINGLE FILE TO EDIT to re-brand this deployment for another company:
│                                                  # name, legal_name, logo_url, primary_color, secondary_color,
│                                                  # support_email, support_phone, address, tax_id,
│                                                  # currency, timezone, locale, footer_text
│
├── app/
│   ├── __init__.py                             # ✅
│   ├── main.py                                 # ✅ FastAPI app factory; mounts /api/v1 router + unversioned /health,
│   │                                              # CORS, 4 shared_kernel middlewares (order: Idempotency → Audit →
│   │                                              # RateLimit → RequestLogging, added outermost-last per Starlette's
│   │                                              # reverse-order execution), global exception handlers. Loads
│   │                                              # company_config at startup (fail-fast on bad company.yaml). No
│   │                                              # changes needed in Phases 5/6/6.5 — idempotency for every new
│   │                                              # mutating endpoint (inventory stock adjustments, payment intents,
│   │                                              # confirm/refund, refund requests, webhook) comes entirely from
│   │                                              # this already-mounted middleware.
│   │
│   ├── core/                                   # Framework-level only. No business logic ever lives here.
│   │   ├── __init__.py                         # ✅
│   │   ├── config.py                           # 🔀 ✅ Pydantic Settings — reads .env (DB URL, JWT secret/expiry, upload dirs, SMTP, CORS origins). **Edited Phase 6.5**: added `PAYMENTS_WEBHOOK_SECRET: str = "mock-webhook-secret-change-me"` — has a safe default so existing `.env` files don't break, but MUST be overridden with a real random value before any shared/staging/production deployment (currently running on the checked-in default everywhere). Used only by the Phase 6.5 simulated webhook's signature check.
│   │   ├── company_config.py                   # ✅ Loads config/company.yaml into a typed object at startup. `get_company_config().currency` is used by `payments.services.payment_service.create_payment_intent()` to default a payment's currency when not explicitly supplied.
│   │   ├── security.py                         # ✅ Password hashing (argon2), JWT encode/decode primitives — gap-filled in Phase 3
│   │   ├── exceptions.py                       # ✅ Custom exception hierarchy (NotFoundError, ValidationError, ConflictError, PermissionDeniedError, UnauthorizedError...). `UnauthorizedError` (→ 401) is used, for the first time in this codebase, by Phase 6.5's webhook signature check — every other domain so far only ever triggered 401s via `deps.py`'s own token-validation logic, never a raised exception.
│   │   ├── constants.py                        # ⏳ Planned — global enums (OrderStatus, BookingStatus, PaymentStatus, PrincipalType). Still not built as of Phase 6.5 — `Payment.status`, `StockAlert.status`, and `RefundRequest.status` are all free-form strings by deliberate choice (see Open Decision #32), not blocked on this file existing.
│   │   ├── logging.py                          # ⏳ Planned — structured logging setup (JSON logs for prod, readable for dev). Not yet built.
│   │   └── base_model.py                       # ✅ SQLAlchemy Base + UUIDPKMixin + TimestampMixin + SoftDeleteMixin (is_deleted, deleted_at, deleted_by_staff_id). UUID PK uses server-side `gen_random_uuid()` (Postgres 13+ built-in, no pgcrypto needed) — not Python-side. **Re-confirmed working exactly as documented during Phase 5**: verified `gen_random_uuid()` resolves with zero extensions enabled on a fresh Postgres 16 instance.
│   │
│   ├── shared_kernel/                          # Cross-cutting concerns used by every domain — NOT a business domain itself
│   │   ├── __init__.py                         # ✅
│   │   ├── models/
│   │   │   ├── __init__.py                     # ✅ Re-exports all shared_kernel models — imported by model_registry.py
│   │   │   ├── notification.py                 # ✅ In-app notification records: recipient_type, recipient_id, title, message, extra_data (JSON), read_at. `recipient_id` is a REQUIRED, non-nullable UUID — confirmed directly against the real model during Phase 5, which is why `inventory.services.stock_alert_service` fans out one `create_notification()` call per targeted staff member rather than attempting a single "broadcast" call (no such primitive exists).
│   │   │   ├── attachment.py                   # ✅ Generic uploaded file/image reference (owner_type, owner_id, file_path, mime_type)
│   │   │   └── password_reset_token.py         # ✅ Polymorphic — principal_type ("staff"/"customer"), principal_id, token_hash, purpose ("reset"/"invite"/"verify_email"), expires_at, used_at
│   │   ├── repositories/
│   │   │   ├── __init__.py                     # ✅
│   │   │   ├── notification_repository.py      # ✅
│   │   │   ├── attachment_repository.py        # ✅
│   │   │   └── password_reset_token_repository.py  # ✅
│   │   ├── schemas/
│   │   │   ├── __init__.py                     # ✅
│   │   │   ├── response_envelope.py            # ✅ Standard {success, message, data, meta} wrapper — `ResponseEnvelope[T]` (typed) + `envelope()` (plain-dict helper). Used unchanged by every Phase 5/6/6.5 endpoint — no envelope changes were needed.
│   │   │   ├── pagination.py                   # ⏳ Planned — PageParams, PageResponse[T] generic schema. Still not built as of Phase 6.5; inventory/payments list endpoints return plain unpaginated arrays (acceptable at current data volumes, flagged for a future phase if list sizes grow).
│   │   │   └── filters.py                      # ⏳ Planned — common query filter base schema (date range, search, sort). Not yet built. Inventory/payments list endpoints implement their own simple query-param filters ad hoc (e.g. `reference_type`/`reference_id` on `GET /payments`, `status` on `GET /admin/refund-requests`) rather than a shared filter schema.
│   │   ├── services/
│   │   │   ├── __init__.py                     # ✅
│   │   │   ├── upload_service.py               # ✅ Validates + stores uploaded images/docs, returns accessible URL
│   │   │   ├── pdf_service.py                  # ✅ Renders HTML templates (invoices/reports) to PDF via xhtml2pdf, uses company_config for branding
│   │   │   ├── excel_service.py                # ✅ Builds XLSX exports via openpyxl from tabular data
│   │   │   ├── email_service.py                # ✅ Sends templated emails via real SMTP (async/background) — no dev/prod code branch, only .env differs
│   │   │   ├── notification_service.py         # ✅ create_notification(db, *, recipient_type, recipient_id, title, message, extra_data=None); list_notifications(); mark_read(). **First real cross-domain consumer confirmed, Phase 5**: `inventory.services.stock_alert_service._notify_management()` calls this directly for low-stock alert fan-out.
│   │   │   └── password_reset_service.py       # ✅ Generic generate/validate/consume reset-purpose tokens — called by iam.auth_service AND customers.customer_auth_service
│   │   ├── middlewares/
│   │   │   ├── __init__.py                     # ✅
│   │   │   ├── error_handler.py                # ✅ Global exception → HTTP response mapping (`register_exception_handlers(app)`). Confirmed correctly mapping `ConflictError`, `ValidationError`, `NotFoundError`, and (newly exercised, Phase 6.5) `UnauthorizedError` for every Phase 5/6/6.5 endpoint — no changes needed to this file.
│   │   │   ├── request_logging.py              # ✅ Logs method/path/status/duration per request
│   │   │   ├── audit_middleware.py             # ✅ Writes staff actions to iam.audit_log automatically (incl. impersonated actions) — imports iam.services.audit_service (documented cross-domain exception, service-only). **Confirmed safe for unauthenticated requests, Phase 6.5**: the simulated webhook endpoint (`POST /payments/webhook`) carries no staff bearer token; `audit_middleware`'s staff-id extraction degrades gracefully to `None` rather than erroring, so webhook calls still get an audit_log row with `staff_user_id=NULL` — verified by reading the middleware's extraction logic directly before relying on this behavior.
│   │   │   ├── rate_limit_middleware.py        # ✅ Throttles auth endpoints against brute force
│   │   │   └── idempotency_middleware.py       # ✅ Idempotency-Key header support for order/payment creation. **Confirmed exercised exactly as designed, Phase 6**: every mutating payments endpoint (`/intents`, `/methods`, `/{id}/confirm`, `/{id}/refund`, `/{id}/refund-requests`, `/webhook`) is covered transparently by this existing global middleware — zero route-level idempotency code was written anywhere in `payments.py` or `admin_refund_requests.py`.
│   │   ├── utils/
│   │   │   ├── __init__.py                     # ✅ (folder exists, empty otherwise)
│   │   │   ├── image_processor.py              # ⏳ Planned — resize/compress images on upload. Not yet built.
│   │   │   ├── file_validators.py              # ⏳ Planned — MIME type + size/extension validation. Not yet built.
│   │   │   ├── datetime_utils.py               # ⏳ Planned — timezone-safe date helpers. Not yet built.
│   │   │   └── slug.py                         # ⏳ Planned — slug generation for menu items, hotels, etc. Not yet built.
│   │   └── api/
│   │       ├── __init__.py                     # ✅ 🆕 (not explicitly listed in original plan, but implied — confirmed present)
│   │       ├── health.py                       # ✅ GET /health — liveness/readiness probe, mounted unversioned in main.py
│   │       ├── uploads.py                      # ⏳ Planned — POST /uploads/image, /uploads/document. Not yet built.
│   │       └── documents.py                    # ⏳ Planned — generic "generate PDF/Excel for X" trigger + download endpoint. Not yet built.
│   │
│   ├── domains/
│   │   ├── __init__.py                         # ✅
│   │   │
│   │   ├── settings/                            # ✅ BUILT — Phase 2. Runtime-adjustable configuration, no redeploy needed.
│   │   │   ├── __init__.py                     # ✅
│   │   │   ├── models/
│   │   │   │   ├── __init__.py                 # ✅
│   │   │   │   └── system_setting.py            # ✅ key (unique), value (JSON), value_type, description, `is_public: bool` (deviation, see Open Decision #15), updated_by_staff_id (no hard FK — see Open Decision #18)
│   │   │   ├── repositories/
│   │   │   │   ├── __init__.py                 # ✅
│   │   │   │   └── system_setting_repository.py # ✅
│   │   │   ├── schemas/
│   │   │   │   ├── __init__.py                 # ✅
│   │   │   │   └── system_setting.py            # ✅
│   │   │   ├── services/
│   │   │   │   ├── __init__.py                 # ✅
│   │   │   │   └── settings_service.py          # ✅ get_setting(key, default), set_setting(key, value, value_type, description, is_public), seed_defaults(db) — used by scripts/seed_data.py. **Not yet used for the Phase 5 `ALERT_TARGET_DEPARTMENT_NAME` or Phase 6.5 `PAYMENTS_WEBHOOK_SECRET`** — both are still hardcoded/env-based with an explicit TODO to migrate to `system_settings` in a future phase (see Open Decisions #33, #36).
│   │   │   └── api/
│   │   │       ├── __init__.py                 # ✅
│   │   │       ├── settings.py                  # ✅ GET/PUT /settings, GET /settings/{key} — gated by `settings:read` / `settings:write` real IAM permissions (as of Phase 3; was placeholder in Phase 2)
│   │   │       └── public_config.py             # ✅ GET /config — unauthenticated; merges company.yaml + public system_settings (enabled modules, currency) for frontend theming
│   │   │
│   │   ├── iam/                                 # ✅ BUILT — Phase 3, corrected Phase 4.5. Internal staff, RBAC, audit.
│   │   │   ├── __init__.py                     # ✅
│   │   │   ├── models/
│   │   │   │   ├── __init__.py                  # ✅ Re-exports all iam models — imported by model_registry.py
│   │   │   │   ├── staff_user.py                # ✅ email (unique), password_hash (nullable — invite flow), first_name, last_name, role_id (FK, NOT NULL), department_id (FK, nullable), is_active (default False until invite accepted), is_superadmin, failed_login_attempts, locked_until, last_login_at. `role` relationship eager-loaded (`lazy="selectin"`).
│   │   │   │   ├── department.py                # ✅ Reception, Housekeeping, Kitchen, Delivery, Management (seeded defaults). **`Management` is now also the fan-out target for Phase 5's low-stock alerts** — no schema change to this model was needed; `inventory` reads existing rows via `iam`'s service layer only.
│   │   │   │   ├── role.py                      # ✅ Named role (name unique, description). `permissions` relationship via `role_permissions` secondary table, eager-loaded.
│   │   │   │   ├── permission.py                # ✅ Atomic permission code (unique, indexed, e.g. `"iam:staff:write"`), description. `roles` relationship via `role_permissions`. **26 permission codes now seeded** (up from 11 as of Phase 4.5) — see `RBAC_MATRIX.md` §4/§6 for the full current catalog.
│   │   │   │   ├── role_permission.py           # ✅ Many-to-many association: role ↔ permission. `UniqueConstraint(role_id, permission_id)`.
│   │   │   │   ├── audit_log.py                 # ✅ staff_user_id, action, entity_type, entity_id, timestamp, metadata(JSON), impersonated_by_staff_id (nullable). `staff_user_id` nullable — confirmed load-bearing for Phase 6.5's unauthenticated webhook endpoint (see `audit_middleware.py` note above).
│   │   │   │   └── staff_session.py             # ✅ staff_user_id, refresh_token_hash, device_info, revoked_at, expires_at
│   │   │   ├── repositories/
│   │   │   │   ├── __init__.py                 # ✅
│   │   │   │   ├── staff_user_repository.py    # ✅
│   │   │   │   ├── department_repository.py    # ✅ incl. get_by_name() — used (read-only, via the service layer) by Phase 5's `stock_alert_service`
│   │   │   │   ├── role_repository.py           # ✅ incl. get_by_name(), add_permission(), remove_permission()
│   │   │   │   ├── permission_repository.py    # ✅ get_by_id(), get_by_code(), list_all(), create(code, description)
│   │   │   │   ├── audit_log_repository.py     # ✅
│   │   │   │   └── staff_session_repository.py # ✅
│   │   │   ├── schemas/
│   │   │   │   ├── __init__.py                 # ✅
│   │   │   │   ├── staff_user.py                # ✅
│   │   │   │   ├── department.py                # ✅
│   │   │   │   ├── role.py                      # ✅
│   │   │   │   ├── permission.py                # ✅
│   │   │   │   └── auth.py                      # ✅ LoginRequest, TokenResponse, RefreshRequest, ForgotPasswordRequest, ResetPasswordRequest, ChangePasswordRequest, InviteStaffRequest
│   │   │   ├── services/
│   │   │   │   ├── __init__.py                 # ✅
│   │   │   │   ├── auth_service.py              # ✅ Login, refresh, logout, logout-all, forgot/reset/change password (delegates token logic to shared_kernel.password_reset_service), lockout checks, `get_current_staff(db, token)`
│   │   │   │   ├── rbac_service.py              # ✅ `has_permission(db, staff, permission_code)` — superadmin short-circuits to True; otherwise resolves hierarchical wildcards via `_wildcard_candidates()`: exact code → `<domain>:<resource>:*` → `<domain>:*` → `*` (implemented Phase 4.5, Open Decision #24, verified via `tests/unit/iam/test_rbac_service.py`, 13/13 passing). **Re-confirmed working correctly against two entirely new domains without any code change, Phases 5/6/6.5** — `Admin`'s single `"*"` grant transparently covered every new `inventory:*` and `payments:*` permission the moment each was seeded, exactly as the wildcard design intended (this is the concrete payoff of Open Decision #24, now proven outside `iam`/`customers`). `assign_permission_to_role()`, `remove_permission_from_role()` — unchanged, and this is also the mechanism by which any future "Finance Admin"/"Refund Manager" custom role would be built (see `RBAC_MATRIX.md` §11).
│   │   │   │   ├── staff_service.py             # ✅ Staff account CRUD orchestration + invite flow. `list_staff(db)` — used (read-only) by Phase 5's `stock_alert_service` for department-based notification fan-out.
│   │   │   │   ├── department_service.py        # ✅ `list_departments(db)` — used (read-only) by Phase 5's `stock_alert_service`.
│   │   │   │   ├── audit_service.py             # ✅ Write audit entries (called by audit_middleware + services)
│   │   │   │   ├── session_service.py           # ✅ List/revoke staff sessions ("logout everywhere")
│   │   │   │   └── impersonation_service.py     # ✅ Superadmin-only impersonation (hardcoded `is_superadmin` check, not a permission code), always audit-logged. `target_type` currently only supports `"staff"` — customer impersonation deferred.
│   │   │   └── api/
│   │   │       ├── __init__.py                 # ✅
│   │   │       ├── auth.py                      # ✅ login, refresh, logout, logout-all, forgot-password, reset-password, change-password
│   │   │       ├── staff_users.py                # ✅ CRUD /iam/staff + POST /iam/staff/{id}/invite — gated `iam:staff:read` / `iam:staff:write`
│   │   │       ├── roles.py                      # ✅ CRUD /iam/roles + POST/DELETE /iam/roles/{id}/permissions/{permission_id} — gated `iam:roles:read` / `iam:roles:write`. **This is the existing, unmodified mechanism** through which any custom "Finance Admin" / "Refund Manager" role would be assigned the new `payments:refund:*` codes — Phase 6.5 needed zero new code here.
│   │   │       ├── permissions.py                # ✅ List /iam/permissions — gated `iam:permissions:read` only (no write endpoint built yet — permissions are currently only created via seed_data.py, not via API)
│   │   │       ├── departments.py                # ✅ CRUD /iam/departments — gated `iam:departments:read` / `iam:departments:write`
│   │   │       └── impersonation.py              # ✅ POST /iam/staff/{staff_id}/impersonate/{target_type}/{target_id} — gated by `get_current_staff_user` + hardcoded `is_superadmin` check inside the service (not `require_permission`), plus a route-level check that `staff_id` in the path matches the caller's own id
│   │   │
│   │   ├── customers/                            # ✅ BUILT — Phase 4. External: hotel guests + restaurant/delivery customers.
│   │   │   ├── __init__.py                     # ✅
│   │   │   ├── models/
│   │   │   │   ├── __init__.py                   # ✅ Re-exports all customers models — imported by model_registry.py
│   │   │   │   ├── hotel_guest.py                # ✅ Stay-specific identity — ID/passport no., nationality, VIP flag, optional login link. No password/login fields.
│   │   │   │   ├── customer.py                   # ✅ email, phone, password_hash, email_verified_at, failed_login_attempts, locked_until. **Still has no relationship to `payments.Payment` or `payments.RefundRequest`** — Phase 6.5's refund-request workflow is deliberately staff-only for exactly this reason (see Open Decision #34); customer self-service refunds are explicitly deferred until a real domain (hotel, Phase 7+) can verify payment ownership.
│   │   │   │   ├── customer_address.py           # ✅ Delivery addresses, many-to-one → customer
│   │   │   │   ├── customer_favorite.py          # ✅ Saved menu items (foundation for future recommendations)
│   │   │   │   └── customer_session.py           # ✅ customer_id, refresh_token_hash, device_info, revoked_at, expires_at
│   │   │   ├── repositories/
│   │   │   │   ├── __init__.py                 # ✅
│   │   │   │   ├── hotel_guest_repository.py    # ✅
│   │   │   │   ├── customer_repository.py       # ✅
│   │   │   │   ├── customer_address_repository.py # ✅
│   │   │   │   ├── customer_favorite_repository.py # ✅
│   │   │   │   └── customer_session_repository.py # ✅
│   │   │   ├── schemas/
│   │   │   │   ├── __init__.py                 # ✅
│   │   │   │   ├── hotel_guest.py                # ✅
│   │   │   │   ├── customer.py                   # ✅
│   │   │   │   ├── customer_address.py           # ✅
│   │   │   │   └── auth.py                       # ✅ RegisterRequest, LoginRequest, TokenResponse, VerifyEmailRequest, ForgotPasswordRequest, ResetPasswordRequest, ChangePasswordRequest
│   │   │   ├── services/
│   │   │   │   ├── __init__.py                 # ✅
│   │   │   │   ├── guest_service.py              # ✅ Created by staff (reception) — no login required
│   │   │   │   ├── customer_service.py           # ✅
│   │   │   │   ├── customer_auth_service.py      # ✅ Register, login, refresh, logout, verify-email, forgot/reset/change password, lockout checks, `get_current_customer(db, token)`. Email verification does NOT gate login (Open Decision #19).
│   │   │   │   ├── address_service.py            # ✅
│   │   │   │   └── session_service.py            # ✅ List/revoke customer sessions
│   │   │   └── api/
│   │   │       ├── __init__.py                 # ✅
│   │   │       ├── guests.py                     # ✅ Staff-facing guest management — gated `customers:guests:read` / `customers:guests:write`. Both codes seeded in `scripts/seed_data.py` and granted to `Admin` (via `*`) and `Reception` — fixed Phase 4.5, see Open Decision #25.
│   │   │       ├── customer_auth.py               # ✅ register, verify-email, resend-verification, login, refresh, logout, forgot-password, reset-password, change-password
│   │   │       ├── customers.py                   # ✅ Customer self-service profile (`/customers/me`) — gated by `get_current_customer()`, not a staff permission
│   │   │       └── addresses.py                   # ✅ CRUD delivery addresses — gated by `get_current_customer()`
│   │   │
│   │   ├── inventory/                            # ✅ BUILT — Phase 5. Shared stock, suppliers, stock transactions, low-stock alerts. Consumed (in later phases) by hotel/restaurant/delivery via `inventory_service.adjust_stock()` — the single stock-mutation entry point.
│   │   │   ├── __init__.py                     # ✅
│   │   │   ├── models/
│   │   │   │   ├── __init__.py                 # ✅ Re-exports InventoryItem, Stock, StockAlert, StockTransaction, Supplier — imported by model_registry.py
│   │   │   │   ├── inventory_item.py            # ✅ name, sku (unique, nullable), description, unit, category, `reorder_threshold` (nullable — NULL means alerting is intentionally disabled for that item), `default_supplier_id` (FK → suppliers.id, nullable), is_active
│   │   │   │   ├── stock.py                     # ✅ `inventory_item_id` (FK → inventory_items.id, UNIQUE — one row per item), `quantity_on_hand` (Numeric(12,3), default 0). Mutated ONLY via `inventory_service.adjust_stock()` — never edited directly by any repository caller outside that function, so every change is guaranteed to also produce a `StockTransaction` row.
│   │   │   │   ├── supplier.py                  # ✅ name, contact_name, email, phone, address, is_active
│   │   │   │   ├── stock_transaction.py         # ✅ `inventory_item_id` (FK), `quantity_delta` (signed Numeric(12,3)), `balance_after`, `transaction_type` (free-form string, e.g. "manual_adjustment"/"receipt"/"consumption"/"return" — not an enum, so future domains can introduce new values without a migration), `reason`, `reference_type`/`reference_id` (loosely coupled, no hard FK, mirroring `payments`' pattern — §3 rule 9), `performed_by_staff_id` (no hard FK, same no-cross-domain-FK convention as elsewhere)
│   │   │   │   └── stock_alert.py                # ✅ `inventory_item_id` (FK), `status` ("open"/"resolved"), `threshold_at_trigger`, `quantity_at_trigger`, `resolved_at`, `resolved_by_staff_id` (no hard FK), `resolution_note`
│   │   │   ├── repositories/
│   │   │   │   ├── __init__.py                 # ✅
│   │   │   │   ├── inventory_item_repository.py # ✅ get_by_id, get_by_sku, list_all, create, save, soft_delete
│   │   │   │   ├── stock_repository.py          # ✅ get_by_item_id, list_all, create, save
│   │   │   │   ├── supplier_repository.py       # ✅ get_by_id, list_all, create, save, soft_delete
│   │   │   │   ├── stock_transaction_repository.py # ✅ create, list_by_item — deliberately append-only, no `save`/`soft_delete` (transactions are an immutable audit trail)
│   │   │   │   └── stock_alert_repository.py    # ✅ get_by_id, get_open_alert_for_item (dedup check — avoids a second alert/notification round while one is already open), list_all(status filter), create, save
│   │   │   ├── schemas/
│   │   │   │   ├── __init__.py                 # ✅
│   │   │   │   ├── inventory_item.py            # ✅ InventoryItemCreate/Update/Read
│   │   │   │   ├── stock.py                      # ✅ StockRead, StockAdjustRequest (quantity_delta, transaction_type, reason, reference_type, reference_id)
│   │   │   │   ├── supplier.py                   # ✅ SupplierCreate/Update/Read
│   │   │   │   ├── stock_transaction.py          # ✅ StockTransactionRead
│   │   │   │   └── stock_alert.py                # ✅ 🆕 StockAlertRead, StockAlertResolveRequest — added beyond the original 4-file Phase 1 scaffold (only `__init__`, `inventory_item`, `stock`, `supplier`, `stock_transaction` were originally planned), since the alert endpoints this phase required needed request/response schemas of their own.
│   │   │   ├── services/
│   │   │   │   ├── __init__.py                 # ✅
│   │   │   │   ├── inventory_service.py          # ✅ Item CRUD (create/list/get/update/delete_item) + stock read access (get_stock, list_stock, list_transactions) + **`adjust_stock()`** — THE single entry point hotel/restaurant/delivery will call in later phases to move stock. Exact signature (hand-off contract, confirmed): `adjust_stock(db, *, inventory_item_id: UUID, quantity_delta: float, transaction_type: str, reason: Optional[str]=None, reference_type: Optional[str]=None, reference_id: Optional[UUID]=None, performed_by_staff_id: Optional[UUID]=None) -> StockTransaction`. Positive delta increments, negative decrements; raises `NotFoundError` (unknown item) or `ValidationError` (would go negative). If the resulting quantity is at/below `reorder_threshold`, triggers `stock_alert_service.trigger_low_stock_alert()` as a real side effect (not a stub).
│   │   │   │   ├── stock_alert_service.py        # ✅ `trigger_low_stock_alert()` (idempotent per open alert — a second movement that stays at/under threshold does not create a duplicate alert or send duplicate notifications), `list_alerts()`, `resolve_alert()`. **Low-stock notification targeting (locked-in design decision)**: fans out to every staff member in the `"Management"` department, resolved by calling `iam`'s existing `department_service.list_departments()` and `staff_service.list_staff()` — zero changes made to `iam`. Hardcoded via module constant `ALERT_TARGET_DEPARTMENT_NAME = "Management"` with an explicit `# TODO: make configurable via system_settings` comment (Open Decision #33) — chosen because `app/tasks/` (Celery) doesn't exist yet (Open Decision #3), so deferring dispatch to a background task wasn't available this phase, and `notification_service.create_notification()`'s `recipient_id` is a required, non-nullable UUID (not a broadcast primitive), so a real per-staff fan-out was the only option that produces genuine, addressed notifications rather than a stub/no-op.
│   │   │   │   └── supplier_service.py           # ✅ Supplier CRUD
│   │   │   └── api/
│   │   │       ├── __init__.py                 # ✅
│   │   │       ├── inventory.py                  # ✅ Item CRUD — `/inventory/items`. GET/GET-by-id gated `inventory:item:read`; POST/PUT/DELETE gated `inventory:item:write`.
│   │   │       ├── suppliers.py                  # ✅ Supplier CRUD — `/inventory/suppliers`. GET/GET-by-id gated `inventory:supplier:read`; POST/PUT/DELETE gated `inventory:supplier:write`.
│   │   │       └── stock.py                      # ✅ Two `APIRouter` instances in one file (deliberate, matching this phase's exact deliverable list of 3 API files, not 4) — `router` (prefix `/inventory/stock`: list/get stock, list transactions, `POST /{item_id}/adjust` gated `inventory:stock:adjust` as a **named exception**, not `write`, since it's one specific audited movement rather than general CRUD) and `alerts_router` (prefix `/inventory/alerts`: `GET` gated `inventory:alert:read`, `POST /{alert_id}/resolve` gated `inventory:alert:resolve`, also a named exception, narrower than `write`). Both routers are included separately in `app/api/v1/api.py`.
│   │   │
│   │   ├── hotel/                                # ✅ BUILT — Phase 7. Rooms, bookings, check-in/out, housekeeping, invoices, in-room service requests. First real consumer of `payment_service.create_payment_intent()`/`confirm_payment()` (via `invoice_service.pay_invoice()`) and of a cross-domain existence check into `customers` (via `booking_service._verify_guest_exists()` → `guest_service.get_guest()`). `inventory_service.adjust_stock()` is NOT yet wired from this domain — no minibar/amenity stock consumption was in this phase's scope; flagged as still-open, not forgotten (see §8 Phase 7 checklist).
│   │   │   ├── __init__.py                     # ✅
│   │   │   ├── models/
│   │   │   │   ├── __init__.py                 # ✅ Re-exports Hotel, RoomType, Room, Booking, HousekeepingTask, Invoice, InvoiceItem, ServiceRequest — imported by model_registry.py
│   │   │   │   ├── hotel.py                     # ✅ name, address, phone, email, is_active — a real table, not a singleton (Open Decision #4, multi-property support)
│   │   │   │   ├── room_type.py                  # ✅ hotel_id (FK), name, description, base_rate (Numeric(12,2) — snapshotted into `Booking.rate_per_night` at booking time, not re-read live), capacity, amenities (free-form text, no dedicated amenities table)
│   │   │   │   ├── room.py                       # ✅ hotel_id (FK), room_type_id (FK), room_number, floor, `status` (free-form: "available"/"occupied"/"cleaning"/"maintenance", matching the `Payment.status`/`StockAlert.status` no-enum convention), is_active. `UniqueConstraint(hotel_id, room_number)`.
│   │   │   │   ├── booking.py                    # ✅ hotel_id (FK), room_id (FK), `guest_id` (no hard FK → `customers.hotel_guest`, loosely coupled per §3 rule 9), check_in_date/check_out_date (Date), actual_check_in_at/actual_check_out_at (nullable DateTime, set on real check-in/out), num_guests, rate_per_night (snapshot), total_amount (computed at checkout), `status` (free-form: "reserved"/"checked_in"/"checked_out"/"cancelled"), notes, cancelled_reason, `booked_by_staff_id` (no hard FK)
│   │   │   │   ├── housekeeping_task.py          # ✅ room_id (FK), booking_id (FK, nullable — auto-created on checkout, but also independently creatable), task_type (free-form: "cleaning"/"maintenance"/"inspection"), status (free-form: "pending"/"in_progress"/"completed"/"cancelled"), notes, `assigned_to_staff_id` (no hard FK), completed_at
│   │   │   │   ├── invoice.py                    # ✅ booking_id (FK), invoice_number (unique, human-readable — `INV-{yyyymmdd}-{booking_id[:8]}`, no sequential-counter table), status (free-form: "draft"/"issued"/"paid"/"refunded"/"cancelled"), subtotal/tax_amount/total_amount (Numeric(12,2) — tax_amount hardcoded 0 with a TODO, no configurable tax rate exists yet), currency, `payment_id` (no hard FK → `payments.payment` — the first field in the codebase explicitly documented as syncing loosely with a `payments` row), issued_at, pdf_path (unused — PDF is generated on-demand, not cached to disk), notes
│   │   │   │   ├── invoice_item.py                # ✅ invoice_id (FK), description, item_type (free-form: "room_charge"/"service_request"/"adjustment" — only "room_charge" is actually produced this phase; service-request line items are a known gap, see §8), quantity, unit_price, line_total
│   │   │   │   └── service_request.py            # ✅ booking_id (FK), room_id (FK), request_type (free-form: "food"/"cleaning"/"amenities"/"maintenance"), description, status (free-form, same 4-state shape as housekeeping_task), `assigned_to_staff_id` (no hard FK), completed_at. Has no price field — see invoice_item.py note above for why service requests aren't itemized on invoices yet.
│   │   │   ├── repositories/
│   │   │   │   ├── __init__.py                 # ✅
│   │   │   │   ├── hotel_repository.py           # ✅ get_by_id, list_all, create, save
│   │   │   │   ├── room_type_repository.py       # ✅ get_by_id, list_by_hotel, create, save
│   │   │   │   ├── room_repository.py            # ✅ get_by_id, list_all (filterable by hotel_id/status), get_by_hotel_and_number (uniqueness check), create, save
│   │   │   │   ├── booking_repository.py         # ✅ get_by_id, list_all (filterable by hotel_id/room_id/guest_id/status), **find_overlapping** (active-status date-range overlap query — the no-double-booking enforcement primitive), create, save
│   │   │   │   ├── housekeeping_task_repository.py # ✅ get_by_id, list_all (filterable by room_id/status/assigned_to_staff_id), create, save
│   │   │   │   ├── invoice_repository.py          # ✅ Combined Invoice + InvoiceItem per the explicit task instruction (invoice items are always accessed in the context of their parent invoice, mirroring `stock_transaction_repository.py`'s single-file-per-concept precedent from a different angle): get_by_id, get_by_booking_id, list_all(status filter), create, save, add_item, list_items
│   │   │   │   └── service_request_repository.py # ✅ get_by_id, list_all (filterable by booking_id/status), create, save
│   │   │   ├── schemas/
│   │   │   │   ├── __init__.py                 # ✅
│   │   │   │   ├── hotel.py                      # 🔀 ✅ HotelCreate/Update/Read only. **Corrected mid-phase**: `RoomTypeCreate`/`RoomTypeRead` were originally (incorrectly) folded into this file; moved to their own `room_type.py` once it was noticed the domain already had a pre-scaffolded empty `room_type.py` schema placeholder reserving that slot — one schema file per model, matching `payments`/`inventory`'s established convention exactly. See Open Decision #42.
│   │   │   │   ├── room_type.py                  # 🔀 ✅ RoomTypeCreate, RoomTypeRead. Was an empty scaffold placeholder as of Phase 1 — now populated (Open Decision #42).
│   │   │   │   ├── room.py                       # ✅ RoomCreate, RoomStatusUpdate, RoomRead
│   │   │   │   ├── booking.py                    # ✅ BookingCreate, BookingCancelRequest, BookingRead
│   │   │   │   ├── housekeeping_task.py           # ✅ HousekeepingTaskCreate, HousekeepingTaskStatusUpdate, HousekeepingTaskAssignRequest, HousekeepingTaskRead
│   │   │   │   ├── invoice.py                     # ✅ InvoiceItemRead, InvoicePayRequest, InvoiceRead, InvoiceDetailRead (extends InvoiceRead with `items: List[InvoiceItemRead]`)
│   │   │   │   └── service_request.py             # ✅ ServiceRequestCreate, ServiceRequestStatusUpdate, ServiceRequestAssignRequest, ServiceRequestRead
│   │   │   ├── services/
│   │   │   │   ├── __init__.py                 # ✅
│   │   │   │   ├── room_service.py                # ✅ Hotel CRUD, RoomType CRUD, Room CRUD + `update_room_status()` + **`is_room_available()`** (delegates to `booking_repository.find_overlapping()` — the no-double-booking check every booking creation runs through)
│   │   │   │   ├── booking_service.py             # ✅ `create_booking()` (validates dates, hotel/room/guest existence — the guest check is the domain's one cross-domain-to-`customers` call — and room availability before creating), `get_booking()`, `list_bookings()`, `cancel_booking()` (only from "reserved"). guest existence check: `_verify_guest_exists()` → `customers.services.guest_service.get_guest()`, raises `NotFoundError` on a missing guest.
│   │   │   │   ├── checkin_checkout_service.py    # ✅ `check_in_booking()` (reserved→checked_in, marks room "occupied"), `check_out_booking()` (checked_in→checked_out, computes `total_amount`, marks room "cleaning", **auto-creates a housekeeping cleaning task** via `housekeeping_service.create_task()`). Invoice generation is a deliberately SEPARATE, explicit next step — not automatic on checkout, matching the codebase's existing intent-vs-confirm / request-vs-approval granularity precedent.
│   │   │   │   ├── housekeeping_service.py        # ✅ `create_task()`, `get_task()`, `list_tasks()`, `assign_task()`, `update_task_status()` (on "completed", also marks the room "available" again — this service owns the room/task lifecycle end-to-end)
│   │   │   │   ├── invoice_service.py             # ✅ `generate_invoice_for_booking()` (only from "checked_out", one room-charge line item = nights × rate_per_night; rejects if an invoice already exists for the booking), `get_invoice()`, `get_invoice_items()`, `list_invoices()`, `issue_invoice()` (draft→issued), **`pay_invoice()`** (issued→paid — calls `payments.services.payment_service.create_payment_intent()` then `confirm_payment()` immediately, a staff-initiated "mark paid" action distinct from the payments webhook path), **`get_invoice_pdf_bytes()`** (calls `shared_kernel.services.pdf_service.render_pdf_template("invoice_template.html", {...})` — see §5's `templates/pdf/invoice_template.html` entry for the current-empty-template caveat)
│   │   │   │   └── service_request_service.py     # ✅ `create_request()` (only accepted for a currently "checked_in" booking — a guest must actually be in-house), `get_request()`, `list_requests()`, `assign_request()`, `update_request_status()`
│   │   │   └── api/
│   │   │       ├── __init__.py                 # ✅
│   │   │       ├── hotels.py                      # 🔀 ✅ `/hotel/hotels` — Hotel CRUD (`hotel:room:read`/`hotel:room:write` — hotels share the room resource's permission pair, not a separate `hotel:hotel:*` code) + nested `/hotel/hotels/{hotel_id}/room-types` (same gate). **Bug found and fixed, Phase 8 session**: this file called `envelope(...)` throughout its handlers but never imported it from `app.shared_kernel.schemas.response_envelope` — a real `NameError` waiting to happen on the first actual request to any endpoint in this router. Went undetected through Phase 7's own verification because `test_hotel_booking_flow.py` seeds hotels/rooms via the repository layer directly, never through this router's endpoints. Fixed with a one-line import addition; confirmed no other `hotel` API file has the same gap, and route count is unaffected (152 total, unchanged by the fix itself). See §9 Open Decision #46.
│   │   │       ├── rooms.py                       # ✅ `/hotel/rooms` — Room CRUD + `PUT /{room_id}/status`, gated `hotel:room:read`/`hotel:room:write`
│   │   │       ├── bookings.py                    # ✅ `/hotel/bookings` — create/list/get/`POST /{id}/cancel`, gated `hotel:booking:read`/`hotel:booking:write`
│   │   │       ├── checkin.py                     # ✅ `POST /hotel/checkin/{booking_id}`, gated `hotel:booking:write`
│   │   │       ├── checkout.py                    # ✅ `POST /hotel/checkout/{booking_id}`, gated `hotel:booking:write` — does NOT itself generate the invoice, see `checkin_checkout_service.py` note above
│   │   │       ├── housekeeping.py                 # ✅ `/hotel/housekeeping` — create/list/get/`PUT /{id}/assign`/`PUT /{id}/status`, gated `hotel:housekeeping:read`/`hotel:housekeeping:write` — **this is the router `Housekeeping`-role staff actually use**, deliberately isolated from booking/invoice permissions (§9 Open Decision #38 update)
│   │   │       ├── invoices.py                     # ✅ `/hotel/invoices` — `POST /generate/{booking_id}`, list, get (returns `InvoiceDetailRead` incl. line items), `POST /{id}/issue`, `POST /{id}/pay`, `GET /{id}/pdf` (streams `application/pdf`), gated `hotel:invoice:read`/`hotel:invoice:write`
│   │   │       └── service_requests.py             # ✅ `/hotel/service-requests` — create/list/get/assign/status-update, gated `hotel:service_request:read`/`hotel:service_request:write` — a 5th hotel resource beyond `RBAC_MATRIX.md`'s originally-proposed 4-resource catalog (room/booking/housekeeping/invoice), added per §8's standard read/write-by-default governance rule since this router was an explicit in-scope deliverable
│   │   │
│   │   ├── restaurant/                           # ✅ BUILT — Phase 8. Tables, reservations, menu, dine-in orders, kitchen tickets, waiter assignments. First real consumer of a cross-domain existence check into a peer *operational* domain (`inventory`, via `menu_service._verify_inventory_item_exists()`) beyond `iam`/`customers`.
│   │   │   ├── __init__.py                     # ✅
│   │   │   ├── models/
│   │   │   │   ├── __init__.py                 # ✅ Re-exports Restaurant, DiningTable, TableReservation, MenuCategory, MenuItem, DineInOrder, DineInOrderItem, WaiterAssignment, KitchenTicket — imported by model_registry.py
│   │   │   │   ├── restaurant.py                 # ✅ name, address, phone, email, is_active — a real table, not a singleton, mirroring `hotel.models.hotel.Hotel`'s multi-property precedent (Open Decision #4)
│   │   │   │   ├── dining_table.py                # ✅ restaurant_id (FK), table_number, capacity, `status` (free-form: "available"/"reserved"/"occupied"/"cleaning", matching the no-enum convention), is_active. `UniqueConstraint(restaurant_id, table_number)`.
│   │   │   │   ├── table_reservation.py           # ✅ restaurant_id (FK), table_id (FK), `customer_id` (no hard FK → `customers.customer`, loosely coupled per §3 rule 9, nullable — a walk-in reservation taken by staff has no account), customer_name, customer_phone, reservation_time, party_size, `status` (free-form: "reserved"/"seated"/"completed"/"cancelled"/"no_show"), notes, `booked_by_staff_id` (no hard FK)
│   │   │   │   ├── menu_category.py               # ✅ restaurant_id (FK), name, display_order, is_active
│   │   │   │   ├── menu_item.py                   # ✅ restaurant_id (FK), category_id (FK), name, description, price (Numeric(12,2)), image_url (set via `upload_service`), is_available, **`inventory_item_id`** (no hard FK → `inventory.inventory_item`, loosely coupled per §3 rule 9, nullable — NOT every menu item needs stock tracking), `inventory_qty_per_unit` (nullable — units of the linked inventory item consumed per 1 quantity ordered, default 1 when linked)
│   │   │   │   ├── dine_in_order.py                # ✅ restaurant_id (FK), table_id (FK), reservation_id (FK, nullable — a walk-in order has none), `customer_id` (no hard FK, nullable), `status` (free-form: "placed"/"preparing"/"ready"/"served"/"billed"/"cancelled"), subtotal/tax_amount/total_amount (Numeric(12,2) — tax_amount hardcoded 0 with a TODO, same open item as `hotel.Invoice`), currency, notes, `placed_by_staff_id` (no hard FK)
│   │   │   │   ├── dine_in_order_item.py           # ✅ order_id (FK), menu_item_id (FK), `item_name`/`unit_price` (snapshots at order time — never re-read from the menu item after creation, mirroring `Booking.rate_per_night`'s snapshot precedent), quantity, line_total, special_instructions
│   │   │   │   ├── waiter_assignment.py            # ✅ table_id (FK), `staff_id` (no hard FK → `iam.staff_user`), assigned_at, unassigned_at (nullable), is_active (only one active assignment per table at a time, enforced in `waiter_service`)
│   │   │   │   └── kitchen_ticket.py               # ✅ `order_id` (FK, **unique** — one ticket per order), `status` (free-form: "pending"/"preparing"/"ready"/"served"/"cancelled"), notes, started_at/ready_at/served_at (nullable, set as the ticket progresses)
│   │   │   ├── repositories/
│   │   │   │   ├── __init__.py                 # ✅
│   │   │   │   ├── restaurant_repository.py       # ✅ get_by_id, list_all, create, save
│   │   │   │   ├── dining_table_repository.py     # ✅ get_by_id, list_all (filterable by restaurant_id/status), get_by_restaurant_and_number (uniqueness check), create, save
│   │   │   │   ├── table_reservation_repository.py # ✅ get_by_id, **get_active_for_table** (dedup check — the no-double-booking-a-table primitive, mirroring `booking_repository.find_overlapping()`'s role for `hotel`), list_all (filterable by restaurant_id/table_id/status), create, save
│   │   │   │   ├── menu_repository.py             # ✅ Combined MenuCategory + MenuItem per the explicit task instruction (a menu item is always accessed in the context of its category/restaurant menu, mirroring `invoice_repository.py`'s Invoice+InvoiceItem precedent from Phase 7): get_category_by_id, list_categories, create_category, save_category, get_item_by_id, list_items, create_item, save_item
│   │   │   │   ├── dine_in_order_repository.py    # ✅ Combined DineInOrder + DineInOrderItem, same rationale as `menu_repository.py`: get_by_id, list_all (filterable by restaurant_id/table_id/status), create, save, add_item, list_items
│   │   │   │   ├── waiter_assignment_repository.py # ✅ get_by_id, get_active_for_table (dedup check for the "only one active waiter per table" rule), list_all (filterable by table_id/staff_id/is_active), create, save
│   │   │   │   └── kitchen_ticket_repository.py    # ✅ get_by_id, get_by_order_id (the 1:1-with-order lookup), list_all (status filter), create, save
│   │   │   ├── schemas/
│   │   │   │   ├── __init__.py                 # ✅
│   │   │   │   ├── restaurant.py                  # ✅ RestaurantCreate/Update/Read
│   │   │   │   ├── dining_table.py                # ✅ DiningTableCreate, DiningTableStatusUpdate, DiningTableRead
│   │   │   │   ├── table_reservation.py           # ✅ TableReservationCreate, TableReservationCancelRequest, TableReservationRead
│   │   │   │   ├── menu.py                        # ✅ MenuCategoryCreate/Read, MenuItemCreate/Update/Read — one file for both models, mirroring `menu_repository.py`'s combined-file rationale
│   │   │   │   ├── dine_in_order.py                # ✅ DineInOrderItemCreate, DineInOrderCreate, DineInOrderItemRead, DineInOrderRead, DineInOrderDetailRead (extends DineInOrderRead with `items: List[DineInOrderItemRead]`)
│   │   │   │   ├── waiter.py                      # ✅ WaiterAssignmentCreate, WaiterAssignmentRead
│   │   │   │   └── kitchen_ticket.py               # ✅ KitchenTicketStatusUpdate, KitchenTicketRead, **KitchenTicketDetailRead** (extends KitchenTicketRead with `table_id` + embedded `items: List[DineInOrderItemRead]` — deliberately duplicates order-item data onto the ticket response so the Kitchen role never needs `restaurant:order:read` to see what's on a ticket; see §9 Open Decision #48)
│   │   │   ├── services/
│   │   │   │   ├── __init__.py                 # ✅
│   │   │   │   ├── restaurant_service.py          # ✅ Restaurant CRUD + DiningTable CRUD + `update_table_status()` (validates against a fixed status set, mirroring `room_service.update_room_status()`)
│   │   │   │   ├── table_reservation_service.py   # ✅ `create_reservation()` (validates restaurant/table existence + no active reservation on the table already, marks the table "reserved"), `seat_reservation()` (reserved→seated, table→"occupied"), `complete_reservation()` (seated→completed, table→"cleaning"), `cancel_reservation()` (reserved-only, table→"available")
│   │   │   │   ├── menu_service.py                # ✅ MenuCategory CRUD + MenuItem CRUD + **`upload_item_image()`** (calls `shared_kernel.services.upload_service.save_upload()`, subfolder `"menu_items"`, stores the returned URL directly on `MenuItem.image_url` — no separate Attachment row, mirroring how `company.yaml`'s `logo_url` is a plain string field). `_verify_inventory_item_exists()` is this domain's cross-domain-to-`inventory` existence check, called whenever a menu item's `inventory_item_id` is set or changed
│   │   │   │   ├── dine_in_order_service.py        # ✅ **`place_order()`** — creates an order with its line items in one call (no separate "cart" concept; status starts at "placed", not a draft state), snapshotting `item_name`/`unit_price` per line, and calling `_consume_inventory_for_item()` per line (which itself calls `inventory_service.adjust_stock()`, but ONLY when the ordered menu item has an `inventory_item_id` — skipped entirely otherwise, deliberately, so most orders never touch `inventory` at all). Does NOT create the order's `KitchenTicket` itself — that's a separate, explicit follow-up call from the API layer, matching this codebase's existing intent-vs-confirm granularity precedent (payments' intent-then-confirm; hotel's checkout-then-generate-invoice). Also: `get_order()`, `list_orders()`, `mark_served()` (ready→served), `generate_bill()` (served→billed, recomputes totals — tax_amount TODO, same open item as `hotel.invoice_service`), `cancel_order()` (does NOT reverse any inventory already consumed — a real, flagged gap, not silently dropped; see §9 Open Decision #47)
│   │   │   │   ├── kitchen_service.py              # ✅ `create_ticket_for_order()` (one ticket per order, rejects a duplicate), `get_ticket()`, `list_tickets()`, **`update_ticket_status()`** (advances pending→preparing→ready→served, or →cancelled; on preparing/ready/served, also advances the underlying `DineInOrder.status` directly via `dine_in_order_repository` — same domain, so this is an ordinary same-domain repository call, not a cross-domain violation, mirroring `checkin_checkout_service.py` calling `booking_repository` directly rather than routing through `booking_service`) — this is how the Kitchen role's actions stay in sync with order state without ever needing `restaurant:order:write`
│   │   │   │   └── waiter_service.py               # ✅ `assign_waiter()` (deactivates any existing active assignment for the table first, then creates a new one — only one active waiter per table at a time), `get_assignment()`, `list_assignments()`, `unassign_waiter()`
│   │   │   └── api/
│   │   │       ├── __init__.py                 # ✅
│   │   │       ├── restaurants.py                 # ✅ `/restaurant/restaurants` — Restaurant CRUD, gated `restaurant:table:read`/`restaurant:table:write` — restaurants share the table resource's permission pair, not a separate `restaurant:restaurant:*` code, mirroring `hotel.api.hotels.py` sharing `hotel:room:*`
│   │   │       ├── tables.py                      # ✅ `/restaurant/tables` — DiningTable CRUD + `PUT /{table_id}/status`, gated `restaurant:table:read`/`restaurant:table:write`
│   │   │       ├── reservations.py                 # ✅ `/restaurant/reservations` — create/list/get/`POST /{id}/seat`/`POST /{id}/complete`/`POST /{id}/cancel`, gated `restaurant:table:read`/`restaurant:table:write` — reservations share the table resource too, since this domain's minimum-split instruction specified exactly 4 resource groups, not a 5th for reservations
│   │   │       ├── menu.py                        # ✅ `/restaurant/menu` — category create/list + item create/list/get/update/`POST /{item_id}/image`, gated `restaurant:menu:read`/`restaurant:menu:write` — **this is the router the `Waiter` role can read but not write to**, per the task's explicit "dine-in-order access without menu-editing rights" instruction
│   │   │       ├── dine_in_orders.py                # ✅ `/restaurant/orders` — `POST ""` (place order, then immediately calls `kitchen_service.create_ticket_for_order()`), list, get (returns `DineInOrderDetailRead` incl. line items), `POST /{id}/bill`, `POST /{id}/cancel`, gated `restaurant:order:read`/`restaurant:order:write` — **this is the router `Waiter`-role staff actually use**, deliberately isolated from menu-write/table-management permissions
│   │   │       ├── kitchen.py                      # ✅ `/restaurant/kitchen` — list/get (returns `KitchenTicketDetailRead` with embedded order items + table_id)/`PUT /{id}/status`, gated `restaurant:kitchen:read`/`restaurant:kitchen:write` — **this is the router `Kitchen`-role staff actually use**, deliberately isolated from table/reservation/menu/order permissions (§9 Open Decision #48)
│   │   │       └── waiters.py                      # ✅ `/restaurant/waiters` — assign/list/get/`POST /{id}/unassign`, gated `restaurant:table:read`/`restaurant:table:write` — waiter-to-table assignment is a table-management/supervisory action, deliberately NOT under `restaurant:order:*` (the Waiter role's own grant is about taking/managing orders once assigned, not about who gets assigned where)
│   │   │
│   │   ├── delivery/                             # ✅ BUILT — Phase 9. Delivery orders, riders, rider-to-order assignment, order tracking. First domain to call into THREE separate peer domains' services (`restaurant`, `inventory`, `customers`) plus a fourth (`iam`, for rider staff-account verification) in a single domain's own service layer. First live use of `app.api.v1.deps.require_verified_customer()` anywhere in the codebase (Phase 4 stub, finally wired).
│   │   │   ├── __init__.py                     # ✅
│   │   │   ├── models/
│   │   │   │   ├── __init__.py                 # ✅ Re-exports DeliveryRider, DeliveryOrder, DeliveryOrderItem, DeliveryAssignment — imported by model_registry.py
│   │   │   │   ├── delivery_rider.py            # ✅ `staff_id` (no hard FK → `iam.staff_user`, loosely coupled per §3 rule 9, but DB-level UNIQUE — at most one rider profile per staff account), vehicle_type/license_plate/phone (all nullable), `status` (free-form: "available"/"offline"/"busy", matching the no-enum convention — maintained mostly as a side effect of dispatch/delivery-completion rather than a dedicated self-service permission this phase, see `rider_service.py`'s note), is_active
│   │   │   │   ├── delivery_order.py             # ✅ `customer_id`/`delivery_address_id` (both no hard FK → `customers.customer`/`customers.customer_address`) and `restaurant_id` (no hard FK → `restaurant.restaurants`) — the first model in the codebase to loosely reference three different peer domains at once. `status` (free-form: "placed"/"confirmed"/"preparing"/"ready_for_pickup"/"assigned"/"out_for_delivery"/"delivered"/"cancelled" — the longest status chain of any domain so far), subtotal/delivery_fee/tax_amount/total_amount (Numeric(12,2) — tax_amount and delivery_fee both hardcoded 0 with a TODO, same open item as `hotel.Invoice`/`restaurant.DineInOrder`), currency, delivery_notes, cancelled_reason, confirmed_at/ready_at/out_for_delivery_at/delivered_at/cancelled_at (nullable DateTime timestamps, one per status transition — the richest timestamp trail of any domain's order/booking model, built specifically to support customer-facing tracking)
│   │   │   │   ├── delivery_order_item.py        # ✅ `order_id` (FK, same-domain hard FK), `menu_item_id` (no hard FK → `restaurant.menu_items`), `item_name`/`unit_price` (snapshots at order time — never re-read from the menu item after creation, mirroring `DineInOrderItem`'s Phase 8 precedent), quantity, line_total, special_instructions
│   │   │   │   └── delivery_assignment.py        # ✅ `order_id`/`rider_id` — **real hard FKs**, since both target tables live inside `delivery` itself (the no-hard-FK rule exists specifically to prevent cross-*domain* coupling, and doesn't apply within a domain — mirrors `KitchenTicket.order_id`'s Phase 8 precedent). `status` (free-form: "assigned"/"picked_up"/"delivered"/"cancelled"), assigned_at (NOT NULL), picked_up_at/delivered_at/cancelled_at (nullable), is_active (only one active assignment per order at a time, enforced in `rider_service` — mirrors `WaiterAssignment`'s Phase 8 precedent), `assigned_by_staff_id` (no hard FK → `iam.staff_user`)
│   │   │   ├── repositories/
│   │   │   │   ├── __init__.py                 # ✅
│   │   │   │   ├── delivery_rider_repository.py  # ✅ get_by_id, get_by_staff_id, list_all (filterable by status/is_active), create, save
│   │   │   │   ├── delivery_order_repository.py  # ✅ Combined DeliveryOrder + DeliveryOrderItem per the explicit task instruction (an order item is always accessed in the context of its parent order, mirroring `menu_repository.py`/`dine_in_order_repository.py`'s Phase 8 combined-file precedent): get_by_id, list_all (filterable by customer_id/restaurant_id/status), create, save, add_item, list_items
│   │   │   │   └── delivery_assignment_repository.py # ✅ get_by_id, **get_active_for_order** (dedup check — the "only one active assignment per order" primitive, mirroring `waiter_assignment_repository.get_active_for_table()`), list_all (filterable by order_id/rider_id/is_active), create, save
│   │   │   ├── schemas/
│   │   │   │   ├── __init__.py                 # ✅
│   │   │   │   ├── delivery_rider.py             # ✅ DeliveryRiderCreate, DeliveryRiderUpdate, DeliveryRiderStatusUpdate, DeliveryRiderRead
│   │   │   │   ├── delivery_order.py             # ✅ DeliveryOrderItemCreate, DeliveryOrderCreate, DeliveryOrderCancelRequest, DeliveryOrderItemRead, DeliveryOrderRead, DeliveryOrderDetailRead (extends DeliveryOrderRead with `items: List[DeliveryOrderItemRead]`)
│   │   │   │   └── delivery_assignment.py        # ✅ DeliveryAssignmentCreate, DeliveryAssignmentRead
│   │   │   ├── services/
│   │   │   │   ├── __init__.py                 # ✅
│   │   │   │   ├── delivery_order_service.py     # ✅ **`place_order()`** — customer-initiated (not staff-initiated, unlike every prior domain's order/booking creation), validates restaurant existence via `restaurant_service.get_restaurant()`, delivery-address ownership via `customers.address_service.get_address()`, snapshots menu items via `menu_service.get_item()`, and consumes linked inventory via `_consume_inventory_for_item()` → `inventory_service.adjust_stock()` (skipped entirely when a menu item has no `inventory_item_id`, identical to `dine_in_order_service`'s Phase 8 precedent). Also: `get_order()`, `get_order_for_customer()` (ownership-checked, mirrors `address_service._get_owned_address()`'s pattern), `get_order_items()`, `list_orders()`, `is_customer_cancellable()`, `cancel_order()` (does NOT reverse consumed inventory — same real, flagged gap as `dine_in_order_service.cancel_order()`)
│   │   │   │   ├── delivery_tracking_service.py   # ✅ Staff-driven status progression — `confirm_order()` (placed→confirmed), `mark_preparing()` (confirmed→preparing), `mark_ready()` (preparing→ready_for_pickup) — plus rider-driven `mark_picked_up()` (assigned→out_for_delivery) and `mark_delivered()` (out_for_delivery→delivered, also frees the rider back to "available"), both of which call **`_get_active_assignment_for_rider()`** first — an ownership check verifying the calling rider actually holds the order's active assignment, raising `PermissionDeniedError` otherwise. This ownership check, not just the `delivery:order:update_status` permission code alone, is what actually prevents one rider from progressing another rider's delivery. `get_status_for_customer()` delegates to `delivery_order_service.get_order_for_customer()` for the customer-facing tracking view.
│   │   │   │   └── rider_service.py               # ✅ `create_rider()` (cross-domain existence check via `iam.staff_service.get_staff()` — a rider profile can only be created for a real, persisted staff account), `get_rider()`, `get_rider_by_staff_id()`, `list_riders()`, `update_rider()`, `set_rider_status()` (dispatcher-driven manual override, e.g. clocking a rider out), **`assign_rider_to_order()`** (deactivates any existing active assignment first, mirrors `waiter_service.assign_waiter()`'s Phase 8 precedent; requires the order to be "ready_for_pickup" and the rider to be "available"; advances order→"assigned", rider→"busy"). **Rider self-service availability toggling was deliberately NOT built this phase** — a rider's status is instead maintained automatically as a side effect of dispatch/delivery-completion; see the module's own docstring and §9 Open Decision #51 for why a dedicated self-toggle endpoint was flagged as a real, open gap rather than silently added beyond the task's explicit minimum permission catalog.
│   │   │   └── api/
│   │   │       ├── __init__.py                 # ✅
│   │   │       ├── delivery_orders.py             # ✅ `/delivery/orders` — customer-facing `POST ""` (place order, gated by `require_verified_customer()` — the first live use of this Phase 4 stub anywhere in the codebase), `GET /mine`, `GET /mine/{order_id}`, `POST /mine/{order_id}/cancel` (self-cancel, only while still "placed"/"confirmed"); staff-facing `GET ""`/`GET /{order_id}` (`delivery:order:read`), `POST /{order_id}/cancel` (`delivery:order:write`). **The static `/mine`/`/mine/{order_id}` paths are registered before the dynamic `/{order_id}` staff route** — the first router since `payments.py` itself where this ordering is genuinely load-bearing, not structurally avoided (§3 rule 13).
│   │   │       ├── delivery_tracking.py           # ✅ `/delivery/tracking` — staff-facing `POST /{id}/confirm`/`/preparing`/`/ready` (`delivery:order:write`); rider-facing `POST /{id}/pickup`/`/deliver` (`delivery:order:update_status` — a narrower code than `delivery:order:write`, since a Rider should progress only their OWN assigned deliveries, enforced by `delivery_tracking_service`'s ownership check, not the permission code alone); customer-facing `GET /{id}/status` (no staff permission — ownership-checked against the current customer, mirrors `customers.api.addresses.py`'s self-service pattern)
│   │   │       └── riders.py                      # ✅ Two `APIRouter`s in one file, mirroring `inventory.api.stock.py`'s `router` + `alerts_router` precedent — `router` (`/delivery/riders`: create/list/get/update/`PUT /{id}/status`, gated `delivery:rider:read`/`delivery:rider:write`, plus `GET /me` for a Rider's own profile lookup — still gated by `delivery:rider:read`, not an unauthenticated-ownership shortcut) and `assignments_router` (`/delivery/assignments`: `POST ""` dispatch/`GET ""` list/`GET /{id}` get, all gated `delivery:rider:*`) — **this is the router `Rider`-role staff actually use** (via `delivery_tracking.py`'s pickup/deliver endpoints and this file's `/riders/me`), deliberately isolated from full rider CRUD and dispatch, which stay Admin/dispatcher-only
│   │   │
│   │   ├── payments/                             # ✅ BUILT — Phase 6 (base: intents, confirm, refund, methods) + Phase 6.5 (dual-refund architecture, methods CRUD completion, simulated webhook). Simulated/demo-test-mode gateway — NOT integrated with any real provider (Stripe/bKash/SSLCommerz), deliberately (Open Decision #35).
│   │   │   ├── __init__.py                     # ✅
│   │   │   ├── models/
│   │   │   │   ├── __init__.py                 # ✅ Re-exports Payment, PaymentMethod, RefundRequest — imported by model_registry.py
│   │   │   │   ├── payment.py                   # ✅ `reference_type`/`reference_id` (loosely coupled, no hard FK, per §3 rule 9), `amount` (Numeric(12,2)), `currency` (ISO 4217, String(3)), `status` (free-form: "pending"/"paid"/"failed"/"refunded"), `method_id` (FK → payment_methods.id, nullable), `failure_reason`, `refund_reason`, `paid_at`, `refunded_at`
│   │   │   │   ├── payment_method.py             # ✅ `type` (free-form: "card"/"cash"/"wallet"/"bank_transfer"), `label` (display only, e.g. "Visa ending 4242" — demo/mock data, NEVER a real PAN or account number), `is_active`. Deliberately has NO owner/principal field (no link to `customer` or `staff_user`) — kept generic/platform-level by original Phase 6 design; "set-default per user" was explicitly proposed and then **skipped** in Phase 6.5 to avoid a schema hack ahead of real customer/account ownership (Open Decision #34).
│   │   │   │   └── refund_request.py             # ✅ 🆕 Phase 6.5. `payment_id` (FK → payments.id), `status` (free-form, lowercase: "pending"/"approved"/"rejected"), `reason` (requester's stated reason), `requested_by_staff_id` (no hard FK), `reviewed_by_staff_id` (no hard FK), `review_reason` (approver's optional note OR the rejecter's REQUIRED reason — "required" is enforced at the service layer, not the schema, since it only applies to one of the two outcomes), `reviewed_at`.
│   │   │   ├── repositories/
│   │   │   │   ├── __init__.py                 # ✅
│   │   │   │   ├── payment_repository.py        # ✅ get_by_id, list_all (filterable by reference_type/reference_id), create, save
│   │   │   │   ├── payment_method_repository.py # 🔀 ✅ get_by_id, list_all, create, save, **soft_delete** (added Phase 6.5, for the new `DELETE /payments/methods/{id}` endpoint)
│   │   │   │   └── refund_request_repository.py # ✅ 🆕 Phase 6.5. get_by_id, **get_pending_for_payment** (dedup check — prevents a duplicate/competing pending request for the same payment), list_all(status filter), create, save
│   │   │   ├── schemas/
│   │   │   │   ├── __init__.py                 # ✅
│   │   │   │   ├── payment.py                    # ✅ PaymentCreateRequest, PaymentConfirmRequest (incl. `simulate_outcome: Literal["paid","failed"]` — this IS a mock gateway, this field is how it's driven deterministically), PaymentRefundRequest, PaymentRead
│   │   │   │   ├── payment_method.py             # ✅ PaymentMethodCreate, PaymentMethodRead
│   │   │   │   ├── refund_request.py             # ✅ 🆕 Phase 6.5. RefundRequestCreate, RefundRequestApprove, RefundRequestReject (`reason: str` — REQUIRED, unlike approve's optional `review_reason`), RefundRequestRead
│   │   │   │   └── webhook.py                    # ✅ 🆕 Phase 6.5. WebhookEventRequest — `event_type: Literal["payment.succeeded","payment.failed","payment.refunded"]`, `payment_id`, `failure_reason`, `refund_reason`. Shaped to look like a real gateway callback but is NOT tied to any specific provider's actual payload format.
│   │   │   ├── services/
│   │   │   │   ├── __init__.py                 # ✅
│   │   │   │   ├── payment_service.py            # 🔀 ✅ Payment method CRUD (`create_payment_method`, `list_payment_methods`, `get_payment_method`, **`delete_payment_method`** — added Phase 6.5) + the payment state machine. Exact hand-off signatures (confirmed, for hotel Phase 7 / restaurant+delivery Phases 8–9 to call): `create_payment_intent(db, *, reference_type: str, reference_id: UUID, amount: float, currency: Optional[str]=None, method_id: Optional[UUID]=None) -> Payment`; `confirm_payment(db, payment_id, *, method_id: Optional[UUID]=None, simulate_outcome: str="paid", failure_reason: Optional[str]=None) -> Payment`; `refund_payment(db, payment_id, *, reason: Optional[str]=None) -> Payment`. State machine: `pending → paid|failed` (confirm), `paid → refunded` (refund) — all other transitions raise `ConflictError`. **`process_webhook_event()` added Phase 6.5** — dispatches a simulated gateway event to `confirm_payment()`/`refund_payment()` internally, so a webhook-driven state change is validated by the exact same rules as a staff-driven one, never mutating `Payment` directly.
│   │   │   │   └── refund_request_service.py     # ✅ 🆕 Phase 6.5. `create_refund_request()` (validates the payment is currently "paid"; rejects a duplicate pending request for the same payment), `list_refund_requests()`, `get_refund_request()`, `approve_refund_request()` (re-checks the payment is still "paid" at approval time — handles the race where a payment was refunded directly, path A, before this request, path B, was reviewed — then calls the SAME `payment_service.refund_payment()` used by the direct-refund path, so exactly one function anywhere ever transitions a `Payment` to "refunded"), `reject_refund_request()` (required reason, never touches the underlying payment).
│   │   │   └── api/
│   │   │       ├── __init__.py                 # ✅
│   │   │       ├── payments.py                   # 🔀 ✅ `POST /intents` (`payments:write`), `GET ""` (`payments:read`, list history filterable by reference_type/reference_id), `GET/POST /methods` (`payments:method:read`/`payments:method:write` — split from the general `payments:write` in Phase 6.5), `GET/DELETE /methods/{method_id}` (🆕 Phase 6.5, same method codes), `POST /webhook` (🆕 Phase 6.5, **public — no staff/customer auth**, authenticated instead by a `X-Webhook-Signature` header compared via `hmac.compare_digest()` against `settings.PAYMENTS_WEBHOOK_SECRET`; raises `UnauthorizedError` → 401 on mismatch/missing), `GET /{payment_id}` (`payments:read`), `POST /{payment_id}/confirm` (`payments:write`), `POST /{payment_id}/refund` (🔀 Phase 6.5: re-gated from `payments:write` to **`payments:refund:direct`** — the "direct refund" path of the dual-refund architecture, no approval step), `POST /{payment_id}/refund-requests` (🆕 Phase 6.5, `payments:refund:request` — the "request" path). **Route-ordering note (see §3 rule 13)**: all static `/methods...` and `/webhook` paths are registered before the dynamic `/{payment_id}` paths, with an inline comment marking the boundary — this exact ordering bug shipped once in Phase 6, was caught before being handed over, and is now defended against explicitly.
│   │   │       └── admin_refund_requests.py       # ✅ 🆕 Phase 6.5. Mounted at **`/admin/refund-requests`** — a deliberate URL-namespace deviation from the `payments` domain's usual `/payments` prefix, matching the endpoint shape explicitly requested for this phase; the code still lives in `app/domains/payments/` since the business logic belongs there. `GET ""` (list, optional `?status=` filter — `payments:refund:review`), `POST /{request_id}/approve` (`payments:refund:review`), `POST /{request_id}/reject` (`payments:refund:review`, required `reason`). Approve+reject deliberately share one permission code rather than being split further — a role trusted to approve a refund is reasonably trusted to reject one too (`RBAC_MATRIX.md` §8 governance rule against pre-splitting without a concrete need).
│   │   │
│   │   └── reporting/                             # ✅ BUILT — Phase 10. Read-only cross-domain aggregation. Owns no tables — every number is computed by calling hotel/restaurant/delivery's own SERVICE layers only (never their models/repositories directly), same cross-domain rule every other domain follows.
│   │       ├── __init__.py                         # ✅
│   │       ├── schemas/
│   │       │   ├── __init__.py                     # ✅
│   │       │   ├── dashboard.py                     # ✅ DashboardSummaryRead — hotel/restaurant/delivery sub-summaries are deliberately plain dicts, not three near-duplicate strict models, since each domain's internal status vocabulary differs (paid invoice vs. billed order vs. delivered order) and a rigid shared schema would need editing every time one domain's status values change
│   │       │   └── report.py                        # ✅ RevenueReportRead — headers/rows/row_count/total_amount, shared shape for both the JSON and (pre-Excel-render) XLSX export paths
│   │       ├── services/
│   │       │   ├── __init__.py                     # ✅
│   │       │   ├── _utils.py                        # ✅ 🆕 Internal-only helper (`in_date_range()`), not part of any public cross-domain contract — shared between dashboard_service.py and report_service.py since neither hotel/restaurant/delivery's list_* service functions expose a native date-range filter; filtering happens here, in Python, at the reporting layer instead. Flagged, not silently absorbed: a real performance tradeoff at scale, fine at current data volume.
│   │       │   ├── dashboard_service.py              # ✅ `get_dashboard_summary()` — aggregates counts/revenue by calling `hotel.services.{booking_service,invoice_service}`, `restaurant.services.dine_in_order_service`, `delivery.services.delivery_order_service` — never their models/repositories. **Deliberately does NOT check module toggles** — a disabled module's historical data still counts toward dashboard totals; only its API routes are hidden (see Open Decision #55).
│   │       │   └── report_service.py                 # ✅ `generate_revenue_report()` (JSON form) + `export_revenue_report_excel()` (same data via `shared_kernel.services.excel_service.build_excel_report()`) — one `domain` param (`hotel`/`restaurant`/`delivery`), `ValidationError` on anything else
│   │       └── api/
│   │           ├── __init__.py                     # ✅
│   │           ├── dashboard.py                     # ✅ `GET /reporting/dashboard` — gated `reporting:read` only, optional `date_from`/`date_to` query params
│   │           └── reports.py                       # ✅ `GET /reporting/reports/revenue` (JSON) + `GET /reporting/reports/revenue/export` (raw XLSX bytes via StreamingResponse, same precedent as `hotel`'s invoice-PDF-streaming endpoint — not wrapped in the standard envelope) — both gated `reporting:read` only
│   │
│   ├── api/
│   │   ├── __init__.py                         # ✅ 🆕 (not explicitly listed in original plan)
│   │   └── v1/
│   │       ├── __init__.py                     # ✅ 🆕 (not explicitly listed in original plan)
│   │       ├── api.py                          # 🔀 ✅ Imports + mounts every real domain's api router under /api/v1. **As of Phase 9**: public_config, settings, iam × 6 routers, customers × 4 routers, inventory × 4 routers (Phase 5), payments × 2 routers (Phases 6/6.5), hotel × 8 routers (Phase 7), restaurant × 7 routers (Phase 8), **delivery × 4 routers** (delivery_orders, delivery_tracking, delivery_riders [`riders.router`], delivery_assignments [`riders.assignments_router`] — Phase 9). Route registration confirmed correct via direct route enumeration against the booted app — **Phase 9 total: 174 routes registered app-wide, 22 of them under `/delivery`** — confirmed live via the full pytest run (108/108 passing). Module-toggle gating for `reporting` still not wired since that domain doesn't exist yet.
│   │       └── deps.py                          # ✅ `get_db` (re-exported from db/connection.py), `get_current_staff_user()`, `require_permission(code)` (factory, exact-match only — wildcard resolution happens inside `rbac_service.has_permission()`, which this calls), `get_current_customer()`, `require_verified_customer()` (Phase 4 stub, not wired to any live endpoint — see Open Decision #19). **Unchanged across Phases 5/6/6.5** — every new endpoint in `inventory` and `payments` imports `get_current_staff_user`/`require_permission`/`get_db` from here exactly as every prior domain does; no new auth primitive was needed for either the mock webhook (which deliberately does NOT use this file's dependencies — see `core/exceptions.py` note above) or anything else this phase.
│   │
│   ├── db/
│   │   ├── __init__.py                         # ✅
│   │   ├── connection.py                       # ✅ Async engine + `AsyncSessionLocal` factory + `get_db` dependency (renamed from session.py per team convention)
│   │   ├── model_registry.py                   # 🔀 ✅ Imports `settings`, `iam`, `customers`, `inventory` (Phase 5), `payments` (Phase 6), `hotel` (Phase 7), `restaurant` (Phase 8), **`delivery`** (uncommented Phase 9), `shared_kernel` model packages (all active). `reporting` never registered (owns no tables) — the only domain remaining unregistered. Confirmed via direct inspection of `Base.metadata.tables.keys()` after each phase: `inventory_items`, `stock`, `stock_transactions`, `stock_alerts`, `suppliers` (Phase 5); `payments`, `payment_methods` (Phase 6); `refund_requests` (Phase 6.5); `hotels`, `room_types`, `rooms`, `bookings`, `housekeeping_tasks`, `invoices`, `invoice_items`, `service_requests` (Phase 7); `restaurants`, `dining_tables`, `table_reservations`, `menu_categories`, `menu_items`, `dine_in_orders`, `dine_in_order_items`, `waiter_assignments`, `kitchen_tickets` (Phase 8); **`delivery_riders`, `delivery_orders`, `delivery_order_items`, `delivery_assignments` (Phase 9)** — all present and correct, zero FK/naming conflicts, confirmed by actually building `Base.metadata` against real Postgres and by the full test suite passing (108/108).
│   │   └── init_db.py                          # ⏳ Planned — first-run bootstrap hook (calls seed_data if DB empty). Not yet built; `scripts/seed_data.py` is currently run manually instead.
│   │
│   ├── tasks/                                   # Background jobs (Celery) — folder scaffolded, contents deferred per Open Decision #3 (Celery/Redis not introduced until first actually needed). **Still true as of Phase 6.5** — this is precisely why Phase 5's low-stock alert dispatch and Phase 6.5's webhook are both synchronous/inline rather than queued; see Open Decisions #33 and #35 respectively for where this constraint shaped a design choice.
│   │   └── __init__.py                         # ✅ (only file present)
│   │       # celery_app.py, email_tasks.py, notification_tasks.py, report_generation_tasks.py,
│   │       # inventory_alert_tasks.py — all ⏳ Planned, not yet built.
│   │
│   ├── templates/
│   │   ├── email/
│   │   │   ├── welcome.html                     # ✅ New staff/customer welcome email
│   │   │   ├── staff_invite.html                # ✅ "Set your password" invite email
│   │   │   ├── password_reset.html              # ✅
│   │   │   ├── email_verification.html          # ✅
│   │   │   ├── booking_confirmation.html        # ✅ (template exists; not yet triggered — hotel domain not built)
│   │   │   └── order_confirmation.html          # ✅ (template exists; not yet triggered — restaurant/delivery not built)
│   │   └── pdf/
│   │       ├── invoice_template.html            # ✅ Branded (company_config colors/logo) invoice layout (not yet triggered — hotel not built)
│   │       └── report_template.html             # ✅ Branded report layout (not yet triggered — reporting not built)
│   │
│   └── static/
│       └── branding/
│           └── logo.svg                         # ✅ Fallback/default logo — real per-deployment logo referenced via config/company.yaml logo_url
│
├── uploads/                                     # ✅ Runtime-generated media — gitignored, folder structure present with .gitkeep placeholders
│   ├── images/{rooms,menu_items,users,restaurants}/
│   ├── documents/{invoices,reports}/
│   └── temp/
│
├── alembic/
│   ├── versions/
│   │   ├── 0001_add_settings_and_shared_kernel_core_tables.py  # ✅ Applied
│   │   ├── 0002_add_iam_tables.py                               # ✅ Applied
│   │   ├── 0003_add_customers_tables.py                         # ✅ Applied (named `_customers_tables`, not `_customers_domain_tables`)
│   │   ├── 0004_add_inventory_tables.py                         # ✅ 🆕 Phase 5. Applied — verified via real `alembic upgrade head` against a live Postgres 16 instance. Creates `suppliers`, `inventory_items` (+ unique index on `sku`), `stock` (+ unique index on `inventory_item_id`), `stock_transactions`, `stock_alerts`.
│   │   ├── 0005_add_payments_tables.py                          # ✅ 🆕 Phase 6. Applied. Creates `payment_methods`, `payments` (+ indexes on `reference_type`, `reference_id`).
│   │   ├── 0006_add_refund_requests_table.py                    # ✅ 🆕 Phase 6.5. Applied. Creates `refund_requests` (+ index on `payment_id`).
│   │   ├── 0007_add_hotel_tables.py                              # ✅ 🆕 Phase 7. Applied for real against a live Postgres 16 instance in Docker — verified via `alembic upgrade head` reaching `0007` and via `alembic current`. Creates `hotels`, `room_types`, `rooms` (+ `UniqueConstraint(hotel_id, room_number)`), `bookings` (+ indexes on `hotel_id`/`room_id`/`guest_id`), `housekeeping_tasks`, `invoices` (+ unique index on `invoice_number`), `invoice_items`, `service_requests`.
│   │   ├── 0008_add_restaurant_tables.py                         # ✅ 🆕 Phase 8. Applied for real against a live Postgres instance — verified via `alembic upgrade head` reaching `0008`. Creates `restaurants`, `dining_tables` (+ `UniqueConstraint(restaurant_id, table_number)`), `table_reservations` (+ indexes on `restaurant_id`/`table_id`/`customer_id`), `menu_categories`, `menu_items` (+ indexes on `restaurant_id`/`category_id`), `dine_in_orders` (+ indexes on `restaurant_id`/`table_id`/`reservation_id`/`customer_id`), `dine_in_order_items` (+ indexes on `order_id`/`menu_item_id`), `waiter_assignments` (+ indexes on `table_id`/`staff_id`), `kitchen_tickets` (+ unique index on `order_id`).
│   │   └── 0009_add_delivery_tables.py                           # ✅ 🆕 Phase 9. Applied for real against a live Postgres instance, confirmed by the user directly — `alembic upgrade head` reaching `0009`, chain `0007→0008→0009` verified. Creates `delivery_riders` (+ unique index on `staff_id`), `delivery_orders` (+ indexes on `customer_id`/`delivery_address_id`/`restaurant_id`), `delivery_order_items` (+ indexes on `order_id`/`menu_item_id`), `delivery_assignments` (+ indexes on `order_id`/`rider_id`, real hard FKs to `delivery_orders`/`delivery_riders` since both are same-domain tables).
│   ├── env.py                                   # ✅ Imports app.db.model_registry (all domain metadata) + app.core.base_model.Base before autogenerate
│   ├── script.py.mako                           # ✅
│   └── README                                   # ✅
│
├── tests/
│   ├── __init__.py                              # ✅
│   ├── conftest.py                              # ✅ Fixed Phase 4.5, unchanged since. `db_session` uses a DEDICATED test engine with `NullPool`; `client` (an `httpx.AsyncClient` bound to the app via `ASGITransport`, in-process — no real network/socket) is used directly for the first time in Phases 5/6/6.5 by the two new HTTP-layer webhook-signature tests (see below) — every other Phase 5/6/6.5 test uses `db_session` and calls services directly.
│   ├── test_health.py                           # ✅ 🆕 (top-level health check test, not explicitly in original plan)
│   ├── unit/
│   │   ├── __init__.py                          # ✅
│   │   ├── settings/
│   │   │   ├── __init__.py                      # ✅
│   │   │   └── test_settings_service.py         # ✅
│   │   ├── iam/
│   │   │   ├── __init__.py                      # ✅
│   │   │   ├── test_auth_service.py             # ✅ Fixed Phase 4.5, unchanged since.
│   │   │   ├── test_rbac_service.py             # ✅ 13 tests, unchanged since Phase 4.5 — no new rbac_service-level tests were needed in Phases 5/6/6.5, since the wildcard mechanism itself didn't change; its correctness against the two new domains is instead demonstrated indirectly (Admin's `"*"` grant transparently covering every new permission, confirmed via the seeded permission catalog and `psql` verification, not a new unit test).
│   │   │   └── test_staff_invite_flow.py        # ✅ 🆕 (specific filename confirmed)
│   │   ├── customers/
│   │   │   ├── __init__.py                      # ✅
│   │   │   └── test_customer_auth_service.py    # ✅
│   │   ├── shared_kernel/
│   │   │   ├── __init__.py                      # ✅
│   │   │   ├── test_email_service.py            # ✅
│   │   │   ├── test_excel_service.py            # ✅
│   │   │   ├── test_pdf_service.py              # ✅
│   │   │   └── test_password_reset_service.py   # ✅
│   │   ├── inventory/                            # ✅ 🆕 Phase 5 — was `.gitkeep`-only as of v2.4
│   │   │   ├── __init__.py                      # ✅
│   │   │   └── test_stock_transaction.py         # ✅ 11 tests — increment/decrement/reject-negative on `adjust_stock()`, full audit-trail recording, low-stock alert trigger + notification fan-out (incl. duplicate-alert suppression and the "no matching department" branch, patched via `ALERT_TARGET_DEPARTMENT_NAME` rather than assumed-empty real data — see §9 Open Decision #37 for why), `resolve_alert()`. **3 of these tests were rewritten mid-phase** after a real bug was caught: the original versions asserted absolute notification-call counts, which silently assumed the real `"Management"` department starts empty — untrue against a live dev DB with prior manual-testing history. Fixed to assert deltas / specific-recipient membership instead; reproduced the exact original failure locally (by permanently committing a real staff member into `Management`) before and after the fix to confirm.
│   │   │   ├── hotel/                            # 🔀 ✅ Phase 7 — was `.gitkeep`-only as of v2.7. **Located here, not `tests/integration/`**, per the precedent `test_refund_workflow.py` (Phase 6.5) already set — full-flow/API tests belong under `tests/unit/<domain>/`, `tests/integration/*.py` remain planned-but-empty placeholders. See Open Decision #43.
│   │   │   │   ├── .gitkeep                       # ✅ retained alongside `__init__.py` — matches `tests/unit/payments/`'s and `tests/unit/inventory/`'s precedent of keeping `.gitkeep` even once a directory is populated
│   │   │   │   ├── __init__.py                    # ✅
│   │   │   │   └── test_hotel_booking_flow.py      # ✅ 🆕 Phase 7. 2 tests, both mixing `db_session` seeding and real `client`-driven HTTP requests: (1) full lifecycle — booking → check-in → check-out (asserts `total_amount` computed correctly) → invoice generation → `GET .../pdf` (asserts valid PDF bytes returned); (2) the Housekeeping-role permission-split acceptance check — a Housekeeping-role staff account can `PUT .../housekeeping/{id}/status` (200) but is correctly rejected (403) creating a booking or viewing an invoice. Guest-existence check patched via `unittest.mock.patch` on `booking_service._verify_guest_exists`. Uses a `cleanup_hotel_rows` fixture for explicit teardown (see Open Decision #41) and relies on `conftest.py`'s `client`/`get_db` override fix (Open Decision #40) to run correctly as a pair.
│   │   │   ├── restaurant/                       # 🔀 ✅ Phase 8 — was `.gitkeep`-only as of v2.8. Located under `tests/unit/`, not `tests/integration/`, following the exact precedent `test_hotel_booking_flow.py` (Phase 7) and `test_refund_workflow.py` (Phase 6.5) both set.
│   │   │   │   ├── __init__.py                    # ✅
│   │   │   │   └── test_restaurant_flow.py         # 🆕 Phase 8. 2 tests, both mixing `db_session` seeding and real `client`-driven HTTP requests, mirroring `test_hotel_booking_flow.py`'s structure exactly: (1) full lifecycle — reserve table → seat → place order (no inventory-linked menu item, so `adjust_stock()` is never called — see `dine_in_order_service.py`'s note) → kitchen ticket auto-created → kitchen advances the ticket through preparing/ready/served (order status stays in sync at each step) → bill generated; (2) the Waiter/Kitchen permission-split acceptance check — a Waiter-role staff account can place an order (200) but is correctly rejected (403) creating a menu item; a Kitchen-role staff account can update a kitchen ticket's status (200) but is correctly rejected (403) reading the tables list. Uses a `cleanup_restaurant_rows` fixture for explicit teardown, structured identically to `cleanup_hotel_rows` (cascading deletes, most-dependent-table-first, committed at teardown). Full suite verified green: **106/106** (104 prior + 2 new).
│   │   │   ├── delivery/                         # 🔀 ✅ Phase 9 — was `.gitkeep`-only as of v2.9. Located under `tests/unit/`, not `tests/integration/`, following the exact precedent `test_hotel_booking_flow.py` (Phase 7) and `test_restaurant_flow.py` (Phase 8) both set.
│   │   │   │   ├── __init__.py                    # ✅
│   │   │   │   └── test_delivery_flow.py           # 🆕 Phase 9. 2 tests, both mixing `db_session` seeding and real `client`-driven HTTP requests, mirroring `test_restaurant_flow.py`'s structure exactly: (1) full lifecycle — customer places order (`require_verified_customer()`-gated) → staff (Admin) confirms/marks preparing/marks ready → rider profile created and set "available" → dispatcher assigns rider (order → "assigned") → rider marks picked up ("out_for_delivery") → rider marks delivered ("delivered") → customer confirms final status via the tracking endpoint; (2) the unverified-customer-blocked acceptance check — an unverified customer's `POST /delivery/orders` is rejected with 403 by `require_verified_customer()` itself, not a hand-rolled check. Uses a `cleanup_delivery_rows` fixture for explicit teardown, structured identically to `cleanup_hotel_rows`/`cleanup_restaurant_rows` (cascading deletes, most-dependent-table-first, committed at teardown) — additionally hard-deletes the real, persisted `StaffUser` row created for the rider, since `rider_service.create_rider()` requires a genuinely existing staff account (verified via `iam.staff_service.get_staff()`), unlike the in-memory-only `StaffUser` objects `_make_staff()` builds for every other role. Full suite verified green: **108/108** (106 prior + 2 new), confirmed by the user directly.
│   │   │   └── payments/                         # ✅ 🆕 Phases 6 + 6.5 — was `.gitkeep`-only as of v2.4
│   │   │       ├── __init__.py                   # ✅
│   │   │       ├── test_payment_state_transitions.py # ✅ 🆕 Phase 6. 21 tests — `create_payment_intent()` defaults/validation, `confirm_payment()` paid/failed paths + method-id-at-confirm-time + invalid-transition rejection, `refund_payment()` + invalid-transition rejection, `list_payments()` filtering, payment method CRUD basics.
│   │   │       └── test_refund_workflow.py            # ✅ 🆕 Phase 6.5. 21 tests — 19 service-layer (refund request create/approve/reject incl. the direct-refund race-condition case, duplicate-pending-request rejection, status filtering, payment method delete, `process_webhook_event()` for all 3 event types + invalid event type + unknown payment) + **2 real HTTP-layer tests** using the `client` fixture directly against `POST /payments/webhook` (missing signature → 401, wrong signature → 401) — deliberately stops short of exercising the 200/success path over HTTP to avoid writing test data into a real, persistent dev database (the same lesson from the Phase 5 `Management`-department incident, applied proactively here). **Note, Phase 7**: this file's two `client`-based tests never reach the database (both return 401 before any DB write), which is exactly why the `conftest.py` `client`/`get_db`-override bug (Open Decision #40) went undetected until `tests/unit/hotel/test_hotel_booking_flow.py` became the first file with two separate test functions each driving a real DB-writing request through `client`.
│   ├── integration/                             # ⏳ Planned, folder not yet populated — test_staff_auth_flow.py, test_customer_auth_flow.py, test_hotel_flow.py, test_restaurant_flow.py, test_delivery_flow.py, test_inventory_deduction.py all still to be written (as bare filenames on this planned list, distinct from the real, populated files that now exist under `tests/unit/<domain>/`). **`test_hotel_flow.py`, `test_restaurant_flow.py`, and `test_delivery_flow.py` deliberately left empty here through Phases 7/8/9** — each domain's actual full-flow test coverage lives at `tests/unit/<domain>/test_<domain>_*.py` instead, per the precedent `test_hotel_booking_flow.py` set in Phase 7; none of these three placeholders were populated and none should be assumed to contain anything.
│   └── e2e/                                     # ⏳ Planned, folder not yet populated — test_cross_domain_dashboard.py still to be written
│
├── scripts/
│   ├── seed_data.py                             # 🔀 ✅ Updated Phases 5, 6, 6.5, 7, 8, and 9 (each in the SAME unit of work as that phase's endpoints, per the standing lesson from the Phase 4 `customers:guests:*` gap — Open Decision #25). `DEFAULT_PERMISSIONS` now holds **50 codes** (up from 45 as of v2.9): the prior 45, plus 5 new `delivery:*` codes (Phase 9 — `delivery:order:read/write`, `delivery:order:update_status`, `delivery:rider:read/write` — see `RBAC_MATRIX.md` §4.10 for the full catalog and per-endpoint gating). `DEFAULT_ROLES["Admin"]` is **unchanged** — still `["*"]`, automatically covering all 5 new codes (the wildcard payoff proven yet again, now across five brand-new domains). **`DEFAULT_ROLES["Rider"]` is NOT unchanged this time** — the third phase since 4.5 (after Phases 7 and 8) to add a real, non-Admin grant: `Rider` → `["delivery:order:read", "delivery:order:update_status", "delivery:rider:read"]` — a deliberately narrower grant than `Waiter`'s or `Kitchen`'s from Phase 8: `delivery:order:update_status` (the named-exception code, not full `delivery:order:write`) lets a Rider progress only deliveries actually assigned to them, ownership-enforced in `delivery_tracking_service`, not just permission-gated; `delivery:rider:read` lets a Rider view their own profile via `GET /delivery/riders/me`. Deliberately NOT `delivery:order:write` (confirm/preparing/ready/cancel is a restaurant/dispatcher action) and NOT `delivery:rider:write` (a Rider cannot create rider profiles, edit vehicle info, force a status change, or dispatch themselves/others). Confirmed applied to a live Postgres instance and verified by the user directly: full suite green (108/108).
│   ├── create_superuser.py                      # ✅ CLI to create initial admin staff account with is_superadmin=true
│   ├── wait_for_db.sh                           # ✅ Used by docker entrypoint before migrations run
│   └── backup_db.sh                             # ✅
│
├── docs/
│   ├── ARCHITECTURE.md                          # ⏳ Still empty in the repo itself as of this pass — open since Phase 4.5, not yet closed.
│   ├── PROPOSAL_TRACEABILITY.md                 # ⏳ Still empty in the repo itself as of this pass.
│   ├── RBAC_MATRIX.md                           # ⏳ Still empty in the repo itself as of this pass. The finalized standalone `RBAC_MATRIX.md` deliverable (now v6, current through Phase 9) exists only outside the repo's own `docs/` folder — copying it in remains overdue, now covering Phases 4.5 through 9.
│   ├── API_CONVENTIONS.md                       # ⏳ File exists but is empty.
│   ├── WHITE_LABEL_GUIDE.md                     # ⏳ File exists but is empty.
│   ├── ERD.png                                  # ✅ Present (binary placeholder/diagram) — **not regenerated for Phases 5/6/6.5's new tables**; flagged as stale.
│   ├── DEPLOYMENT.md                            # ⏳ File exists but is empty.
│   ├── USER_MANUAL.md                           # ⏳ File exists but is empty.
│   └── DOCKER_AND_OPERATIONS_GUIDE.md           # 🆕 Referenced and maintained as a separate living doc — not present in this particular repo zip snapshot; tracked alongside PROJECT_STATE.md.
│
├── docker/
│   ├── Dockerfile                               # ✅ Production image
│   ├── Dockerfile.dev                           # ✅ Dev image with hot-reload
│   ├── entrypoint.sh                            # ✅ wait_for_db → alembic upgrade head → start uvicorn
│   └── nginx/
│       └── nginx.conf                           # ✅ Reverse proxy config (production)
│
├── .github/
│   └── workflows/                               # ✅ folder present (ci.yml / cd.yml contents not individually verified this pass)
│
├── docker-compose.yml                           # ✅ api + postgres (+ mailpit via override)
├── docker-compose.override.yml                  # ✅ Local dev overrides — hot reload, exposed DB port, mailpit service (SMTP :1025, Web UI :8025)
├── .env                                         # ✅ 🆕 (actual working .env present in repo — real secrets/dev values, distinct from .env.example). **Does NOT yet contain a real `PAYMENTS_WEBHOOK_SECRET`** — Phase 6.5's default is currently in effect; see §6 and Open Decision #36.
├── .env.example                                 # 🔀 ✅ All required env vars with placeholder/dev values — see §6 for exact confirmed contents, **now including `PAYMENTS_WEBHOOK_SECRET` (Phase 6.5)**.
├── .gitignore                                   # (not individually re-verified this pass, assumed present)
├── .dockerignore                                # ✅
├── alembic.ini                                  # ✅ Tool config only (`script_location`, logging, blank `sqlalchemy.url` — overridden at runtime by `alembic/env.py` from `settings.DATABASE_URL`). **Briefly suspected missing during Phase 7's live verification** — absent from a particular zip export of the repo, which momentarily looked like a real gap. Confirmed a zip-export artifact, not an actual repository gap, once the real file was provided. See Open Decision #44.
├── pyproject.toml                                # ✅ Tool config (black line-length 100, isort, mypy, pytest incl. `asyncio_mode = "auto"` + `asyncio_default_fixture_loop_scope = "function"`). Unchanged since Phase 4.5. **Same brief false-missing-file scare as `alembic.ini` during Phase 7 verification — same resolution, see Open Decision #44.**
├── requirements.txt                             # ✅ 🆕 Real dependency pinning (see §2 table). **Unchanged in Phases 5/6/6.5** — no new third-party dependencies were needed for either the simulated payment gateway or the simulated webhook.
├── requirements-dev.txt                         # ✅ 🆕 `-r requirements.txt` + pytest/black/isort/mypy/flake8
├── Makefile                                     # ✅ Confirmed targets: `up`, `down`, `migrate`, `makemigrations`, `seed`, `createsuperuser`, `test`, `lint`
├── LICENSE                                      # ✅
├── README.md                                    # ✅ Setup + run instructions
└── PROJECT_STATE.md                             # This file
```

---

## 6. Environment Variables

Confirmed exact contents of the real `.env.example` in the repo (values shown are the actual
dev-placeholder values checked in, not just field names). **Updated Phase 6.5** — added
`PAYMENTS_WEBHOOK_SECRET` (new); everything else unchanged since v2.4. **No new variables were
needed for Phase 7, Phase 8, or Phase 9** — menu-item image uploads reuse the existing `UPLOAD_DIR`/
`MAX_UPLOAD_SIZE_MB` settings via `upload_service`, invoice PDF generation reuses `pdf_service`
with no new config surface, and delivery order placement needed no new configuration at all
(the delivery fee is a hardcoded 0 with an open TODO — see §5's `delivery_order.py` entry — not
yet wired to any env var or `system_settings` key):

```
# App
APP_ENV=development
APP_DEBUG=true
APP_SECRET_KEY=changeme-app-secret
APP_BASE_URL=http://localhost:3000        # Builds invite/reset/verify links in emails. Points at
                                            # a frontend that doesn't exist yet — tokens must be
                                            # retrieved manually via Mailpit's "HTML Source" tab
                                            # during testing (see docs/DOCKER_AND_OPERATIONS_GUIDE.md).

# Database
DATABASE_URL=postgresql+asyncpg://postgres:1234@db:5432/ihg_platform
DATABASE_HOST=db                           # MUST be the Docker service name "db", never "localhost"
DATABASE_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=1234
POSTGRES_DB=ihg_platform

# JWT
JWT_SECRET_KEY=changeme-jwt-secret
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30
JWT_REFRESH_TOKEN_EXPIRE_DAYS=7

# Uploads
UPLOAD_DIR=/app/uploads
MAX_UPLOAD_SIZE_MB=5

# Email (SMTP) — DEV uses Mailpit, PROD uses real provider (Gmail/SendGrid/SES)
SMTP_HOST=mailpit
SMTP_PORT=1025
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM_EMAIL=noreply@ihg-platform.com
SMTP_USE_TLS=false
# No dev/prod code branch — email_service.py always sends via real SMTP;
# only these .env values change per environment.

# Celery / Redis
REDIS_URL=redis://redis:6379/0             # Present in .env.example even though Celery isn't
                                            # wired into any code yet (app/tasks/ is still just
                                            # an empty package) — kept ready for whenever it's needed.

# CORS
CORS_ALLOWED_ORIGINS=http://localhost:3000

# Rate limiting
AUTH_RATE_LIMIT_PER_MINUTE=5

# Idempotency
IDEMPOTENCY_KEY_TTL_SECONDS=86400

# Payments — simulated gateway webhook (Phase 6.5). Mock shared-secret check only,
# NOT a real provider signature scheme (Stripe/bKash/SSLCommerz each use their own
# HMAC format) — see app/domains/payments/api/payments.py. Has a code-level default
# ("mock-webhook-secret-change-me") so existing .env files don't break, but MUST be
# overridden with a real random value here before any shared/staging/production use.
PAYMENTS_WEBHOOK_SECRET=mock-webhook-secret-change-me

# Company branding config path (usually left as default)
COMPANY_CONFIG_PATH=config/company.yaml
```

`config/company.yaml` holds the actual branding values (name, logo, colors, currency, etc.) —
kept separate from `.env` because it's meant to be edited/replaced wholesale per deployment,
not merged with secrets. **`currency` from this file is now also the default currency for
every `payments.Payment` row** created without an explicit `currency` argument (Phase 6),
resolved via `get_company_config().currency`.

**Note:** a real `.env` (not just `.env.example`) is checked into this particular repo snapshot
with working dev values — flagging only because `.env` files are typically gitignored; worth
confirming `.gitignore` actually excludes it before any future push to a shared/public remote.
**Also flagging, Phase 6.5**: this real `.env` does not yet carry an overridden
`PAYMENTS_WEBHOOK_SECRET` — the code-level default is currently in effect everywhere this repo
snapshot runs.

---

## 7. Conventions

### 7.1 General

| Area | Rule |
|---|---|
| File naming | `snake_case.py`, singular nouns for models (`booking.py`, not `bookings.py`) |
| API routes | Plural nouns, versioned: `/api/v1/hotel/bookings` |
| DB tables | Plural snake_case: `bookings`, `dine_in_orders` |
| Primary keys | UUID, generated **server-side** via Postgres `gen_random_uuid()` (not Python-side `uuid.uuid4()`) — confirmed in `base_model.py`, re-confirmed working on a fresh Postgres 16 instance with zero extensions during Phase 5 |
| Timestamps | UTC, `created_at` / `updated_at` on every table |
| Soft delete | `is_deleted`, `deleted_at`, `deleted_by_staff_id` — never hard-delete business records; default query scope excludes soft-deleted rows. **Deliberate exception, confirmed Phase 5**: `StockTransaction` has no `save`/`soft_delete` repository function at all — transactions are append-only by design, since they're an immutable audit trail, not an editable record. |
| Response format | `{ "success": bool, "message": str, "data": any, "meta": {...} }` — confirmed via `shared_kernel/schemas/response_envelope.py`: `ResponseEnvelope[T]` (typed) + `envelope()` (dict helper) |
| Error format | Consistent structure via `core/exceptions.py` + `error_handler.py`. **`UnauthorizedError` (→ 401) used for the first time, Phase 6.5**, by the simulated webhook's signature check. |
| Auth | `Authorization: Bearer <token>`; `principal_type` claim = `staff` / `guest` / `customer`. `guest` is reserved but not currently issued by any flow — hotel guests have no login by design. **The Phase 6.5 webhook endpoint (`POST /payments/webhook`) is the first endpoint in the codebase with NO principal_type/bearer-token auth at all** — authenticated instead by a shared-secret header, since a real gateway callback carries no user session (see §9 Open Decision #35). |
| Migrations | One migration per schema change, descriptive slug. **Confirmed followed exactly, Phases 5/6/6.5/7/8/9**: `0004_add_inventory_tables.py`, `0005_add_payments_tables.py`, `0006_add_refund_requests_table.py`, `0007_add_hotel_tables.py`, `0008_add_restaurant_tables.py`, `0009_add_delivery_tables.py` — each in the same unit of work as its models, each applied for real (`alembic upgrade head`, live Postgres) before hand-off. |
| Tests | Every service gets unit tests; every cross-step process gets one integration test. **Note**: Phases 5/6/6.5 delivered unit tests only (73 new tests total) — the `tests/integration/` folder remained unpopulated through v2.7. **Phase 7 delivered the first genuine cross-step-process test** (`tests/unit/hotel/test_hotel_booking_flow.py`'s full booking→check-in→check-out→invoice→PDF flow) but places it under `tests/unit/hotel/`, not `tests/integration/`, per the precedent `test_refund_workflow.py` already set in Phase 6.5 — see Open Decision #43. **Phase 8 followed the identical precedent**: `tests/unit/restaurant/test_restaurant_flow.py`'s full reserve→bill flow sits under `tests/unit/restaurant/`, not `tests/integration/`. **Phase 9 followed it a third time**: `tests/unit/delivery/test_delivery_flow.py`'s full placed→delivered flow sits under `tests/unit/delivery/`. The `tests/integration/` folder itself, including `test_hotel_flow.py`/`test_restaurant_flow.py`/`test_delivery_flow.py`, remains an unpopulated set of placeholders — see §5's updated note on this. |
| Permission codes | **3-part**: `<domain>:<resource>:<action>` — confirmed via every real `require_permission(...)` call site in `settings`, `iam`, `customers`, `inventory`, `payments`, `hotel`, `restaurant`, **and now also `delivery`, with zero exceptions to the shape**, including named exceptions like `inventory:stock:adjust`, `payments:refund:direct`, and `delivery:order:update_status` staying within the pattern alongside `hotel`'s/`restaurant`'s straightforward read/write pairs. No flat `hotel:*`/`restaurant:*`/`delivery:*` code was ever used, per explicit instruction — all three domains are concrete cases `RBAC_MATRIX.md` had long flagged as needing a real permission split (Housekeeping must reach `hotel:housekeeping:*` without `hotel:booking:*`/`hotel:invoice:*`; Waiter must reach `restaurant:order:*` without `restaurant:menu:write`; Kitchen must reach `restaurant:kitchen:*` without table/reservation access; Rider must reach `delivery:order:update_status` — narrower than full `delivery:order:write` — without confirm/preparing/ready/cancel access), and all are now demonstrated working, not just designed. See `RBAC_MATRIX.md` §2 and §9, Decision #23. |

### 7.2 Data access layering

**Correction, this pass (v2.9):** earlier versions of this document described this as a
"four-layer pattern" and omitted `schemas/` entirely from the table below — a real gap, not a
simplification, since `schemas/` is a genuine fifth folder present in every built domain and does
real work (it's the Pydantic request/response shape `api/` validates against and formats with —
distinct from `models/`, which defines the database table shape, not the wire shape). Every
module internally follows the same five-folder pattern, so any engineer (or AI session) working
on any module already knows where to find things. Corrected below:

| Layer | Responsibility | May import from |
|---|---|---|
| `api/` | The endpoints the frontend calls — HTTP concerns only: request/response, status codes, dependency injection | own domain's `services/`, `schemas/`; `shared_kernel`; `core` |
| `schemas/` | The Pydantic request/response shapes `api/` validates against and formats with — separate from `models/`, which defines the database table shape, not the wire shape | own domain's `models/` (for `from_attributes=True` conversion only, never queried directly); `core` |
| `services/` | The business rules and decision-making — validation, orchestration, cross-domain calls | own domain's `repositories/`, `schemas/`; other domains' `services/` (never their models/repos); `shared_kernel`; `core` |
| `repositories/` | The raw database queries — kept separate so logic and data access don't mix; no business rules | own domain's `models/` only |
| `models/` | The database table definitions — SQLAlchemy ORM classes | `core/base_model.py` mixins only |

**Confirmed exercised correctly, Phase 5**: `inventory.services.stock_alert_service` calls
`iam.services.department_service` and `iam.services.staff_service` (other domains' **services**)
— never `iam.repositories` or `iam.models` directly. This is the first real, working example in
the codebase of the "services are the only public interface between domains" rule being
exercised by a domain other than the one that originally documented it. **Confirmed again,
Phase 8**: `restaurant.services.menu_service._verify_inventory_item_exists()` calls
`inventory.services.inventory_service.get_item()` — a pure existence check, not a query — and
`restaurant.services.dine_in_order_service._consume_inventory_for_item()` calls
`inventory.services.inventory_service.adjust_stock()`; neither ever imports
`inventory.repositories` or `inventory.models`. **Confirmed a third time, Phase 9 — the first
domain to exercise this rule against FOUR other domains' services from within one domain's own
service layer**: `delivery.services.delivery_order_service` calls `restaurant.services.
restaurant_service`/`menu_service` and `customers.services.address_service`, plus (via
`_consume_inventory_for_item()`) `inventory.services.inventory_service`; `delivery.services.
rider_service` calls `iam.services.staff_service`. `delivery` never imports any other domain's
`repositories/` or `models/`.

### 7.3 Superadmin & RBAC

- `is_superadmin` is a boolean flag on `staff_user`, **not a role** — cannot be granted through
  the roles/permissions UI or any API endpoint, only via `scripts/create_superuser.py` or a
  direct DB action. This is deliberate: "Admin" (a role) is manageable/revocable through normal
  channels; superadmin is a break-glass-style flag that bypasses the permission system entirely
  and is intentionally hard to grant. See `docs/DOCKER_AND_OPERATIONS_GUIDE.md` for the
  full superadmin-vs-Admin explanation and production creation procedure.
- `rbac_service.has_permission()` short-circuits to `True` for superadmins, but every action they
  take still passes through `audit_middleware`. Wildcard resolution implemented and verified
  Phase 4.5 — resolution order: exact code match → `<domain>:<resource>:*` → `<domain>:*` →
  `*`, via `_wildcard_candidates()`. `Admin` is seeded with a single `"*"` grant. **Re-confirmed
  working correctly against two brand-new domains with zero code changes, Phases 5/6/6.5** — the
  moment `inventory:*` and `payments:*` codes were seeded, Admin's existing `"*"` grant covered
  all of them automatically; this is the concrete, now-proven payoff of the Phase 4.5 wildcard
  work (Open Decision #24), not just a theoretical benefit anymore.
- Impersonation is superadmin-only (hardcoded check inside `impersonation_service.py`, not a
  permission code) and always tags `audit_log.impersonated_by_staff_id`. Currently only supports
  `target_type="staff"`.
- **New pattern established, Phase 6.5**: creating a custom role with a narrower slice of
  permissions than Admin (e.g. a "Finance Admin" holding `payments:refund:direct`, or a "Refund
  Manager" holding `payments:refund:review`) requires **zero new code** — it's done entirely
  through the existing `POST/DELETE /iam/roles/{id}/permissions/{permission_id}` endpoints,
  which is exactly what Phase 4.5's roles/permissions/RBAC work was originally built to support.
  This was discussed explicitly during Phase 6.5's scoping and confirmed rather than assumed.
- **Wildcard resolution re-confirmed correct a third time, Phase 7** — Admin's single `"*"`
  grant covered all 10 new `hotel:*` codes automatically, zero changes to `rbac_service.py` or
  `DEFAULT_ROLES["Admin"]` needed, exactly as in Phases 5 and 6/6.5. **Re-confirmed a fourth
  time, Phase 8** — the identical thing happened again with all 8 new `restaurant:*` codes.
  **Re-confirmed a fifth time, Phase 9** — the identical thing happened again with all 5 new
  `delivery:*` codes, including the named-exception code `delivery:order:update_status`, which
  the wildcard covers exactly like any other leaf permission.
- **First real test of scoped, non-wildcard role isolation since Phase 4.5, Phase 7**: unlike
  every permission code added in Phases 5/6/6.5 (all Admin-only), `hotel`'s codes were partly
  granted to `Housekeeping` and `Reception` — two roles holding explicit, narrow code lists, not
  a wildcard. This is the resolution algorithm's *first* step (exact code match) being exercised
  for real by a non-Admin role in a newly-built domain, and it was verified working end-to-end:
  a Housekeeping-role staff account can `PUT /hotel/housekeeping/{id}/status` (200) but is
  correctly rejected (`403 Missing required permission`) on `POST /hotel/bookings` and
  `GET /hotel/invoices/{id}` — confirmed via a real HTTP test against a live database, not
  reasoned about from the seeded permission list alone.
- **Second real test of scoped, non-wildcard role isolation, Phase 8**: `restaurant`'s
  `Waiter` and `Kitchen` roles both hold explicit, narrow code lists (`Waiter`:
  `restaurant:order:read/write` + `restaurant:menu:read`; `Kitchen`: `restaurant:kitchen:
  read/write` only) — verified working end-to-end against a live database: a Waiter-role staff
  account can `POST /restaurant/orders` (200) but is correctly rejected (`403`) on
  `POST /restaurant/menu/items`; a Kitchen-role staff account can
  `PUT /restaurant/kitchen/{id}/status` (200) but is correctly rejected (`403`) on
  `GET /restaurant/tables`. This is also the first role in the codebase to hold a permission
  grant that spans two *different* resource groups within the same domain (`restaurant:order:*`
  plus `restaurant:menu:read`) rather than one full resource pair — confirming the exact-match
  step of the resolution algorithm composes correctly across multiple held codes, not just one.
- **Third real test of scoped, non-wildcard role isolation, Phase 9 — and the first to combine
  permission-level scoping with an application-level ownership check**: `delivery`'s `Rider` role
  holds `delivery:order:read`, `delivery:order:update_status`, and `delivery:rider:read` — no
  `delivery:order:write`/`delivery:rider:write`. Holding `delivery:order:update_status` is
  necessary but not sufficient to progress a given delivery: `delivery_tracking_service.
  _get_active_assignment_for_rider()` additionally verifies the calling rider actually holds the
  order's active `DeliveryAssignment` before allowing `mark_picked_up()`/`mark_delivered()` to
  proceed, raising `PermissionDeniedError` otherwise. Verified end-to-end against a live
  database as part of the full lifecycle test: the rider holding the active assignment can
  `POST /delivery/tracking/{order_id}/pickup` (200) and `.../deliver` (200) for THEIR OWN
  assigned order; a different Rider-role account holding the identical `delivery:order:
  update_status` permission would be correctly rejected (`403`) on the same endpoints for an
  order assigned to someone else — the permission code alone would incorrectly allow this, which
  is exactly why the RBAC layer and the ownership check are both required and neither is
  redundant.

### 7.4 Model registration for Alembic

- Each domain's `models/__init__.py` re-exports all of that domain's model classes.
- `app/db/model_registry.py` imports each domain's `models` package (one line per domain) —
  this is the single file that guarantees `Base.metadata` is complete.
- `alembic/env.py` and `app/db/init_db.py` (⏳ planned, not yet built) both import
  `model_registry` before touching metadata.
- No domain, service, or API file should ever need to import `model_registry` directly — it
  exists solely for Alembic/bootstrap purposes.
- **Current confirmed state:** `settings`, `shared_kernel`, `iam`, `customers`, `inventory`
  (Phase 5), `payments` (Phase 6), `hotel` (Phase 7), `restaurant` (Phase 8), **`delivery`
  (Phase 9)** are uncommented and active in `model_registry.py` — **every domain except
  `reporting` is now registered**, since `reporting` owns no tables and is never registered by
  design. Verified after each phase via direct inspection of `Base.metadata.tables.keys()`
  against a real running instance, not just visual review of the import list — **Phase 9: 4 new
  tables confirmed (`delivery_riders`, `delivery_orders`, `delivery_order_items`,
  `delivery_assignments`), zero conflicts, full suite green (108/108).**

---

## 8. Development Roadmap & Progress Tracker

- [x] **Phase 0: Project Setup & Proposal Review**
  - [x] Review client proposal and establish core objectives
  - [x] Agree on engineering standards and technology stack
  - [x] Initialize Docker Compose environment (api, db, mailpit) — confirmed working

- [x] **Phase 1: Project Scaffolding & Core Infrastructure**
  - [x] Define directory structure architecture (domain-driven, with repositories layer)
  - [x] Establish `PROJECT_STATE.md`
  - [x] Full folder scaffold incl. `config/company.yaml`, `app/core/company_config.py`
  - [x] `app/db/connection.py` (async engine/session) + `app/db/model_registry.py`
  - [x] `app/core/base_model.py` (Base + Timestamp/SoftDelete/UUID mixins, server-side `gen_random_uuid()`)
  - [x] Alembic initialized, wired to `model_registry`
  - [x] Docker/Docker Compose, Makefile, `.env.example`

- [x] **Phase 2: Settings Domain & Shared Kernel Core Services**
  - [x] `settings` domain: system_settings model/repository/service/api (incl. module toggles, password policy, `is_public` flag)
  - [x] `GET /api/v1/config` public endpoint (company.yaml + public settings)
  - [x] `shared_kernel` services: upload, PDF (xhtml2pdf), Excel (openpyxl), email, notifications, password_reset_service
  - [x] `shared_kernel` middlewares: error handler, request logging, audit (placeholder at this stage), rate limit, idempotency
  - [x] 6 email templates + 2 PDF templates created

- [x] **Phase 3: IAM Domain (Staff, RBAC, Auth, Sessions)**
  - [x] `app/core/security.py` created (gap-fill — was missing from Phase 1)
  - [x] Models/repositories/services/api for staff_user, department, role, permission, audit_log, staff_session
  - [x] Full staff auth: login, refresh, logout, logout-all, forgot/reset/change password, invite flow, accept-invite
  - [x] Superadmin flag + bypass logic; account lockout
  - [x] Impersonation (superadmin-only, audit-logged)
  - [x] Seed default roles/permissions/superadmin via `scripts/`
  - [x] `audit_middleware` rewired to write real `iam.audit_log` entries
  - [x] `app/api/v1/deps.py` — real `get_current_staff_user()`, `require_permission()`
  - [x] Verified manually: superadmin created, staff invited, invite email confirmed in Mailpit, accept-invite flow completed successfully

- [x] **Phase 4: Customers Domain (Guests, Customers, Auth, Sessions)**
  - [x] Models/repositories/services/api for hotel_guest, customer, customer_address, customer_favorite, customer_session
  - [x] Full customer auth: register, verify-email, login, refresh, logout, forgot/reset/change password
  - [x] Account lockout
  - [x] `get_current_customer()` dependency added to `app/api/v1/deps.py`
  - [x] Migration `0003_add_customers_tables` applied successfully
  - [ ] ⚠️ **Phase 4 endpoint verification status**: still not explicitly confirmed back into this
        document as of this pass — carried forward unresolved since v2.4. Treat as **still open**
        until explicitly confirmed.

- [x] **Phase 4.5: RBAC Correction Pass** — **COMPLETE, verified**
  - [x] Full codebase review completed — confirmed real permission codes are already 3-part
  - [x] Design locked in: read/write pair per resource by default, named exceptions where a role
        genuinely needs finer control, plus hierarchical wildcard support — Open Decisions #23–24
  - [x] Implemented hierarchical wildcard resolution in `rbac_service.has_permission()`
  - [x] Fixed `scripts/seed_data.py`: added `customers:guests:read`/`write`, `Housekeeping` role,
        switched `Admin` to a single `"*"` grant, granted Reception its actual permissions
  - [x] Updated `tests/unit/iam/test_rbac_service.py` — 13 tests
  - [x] Two unrelated pre-existing bugs found and fixed (conftest event-loop issue; broken mock
        patch targets in test_auth_service.py)
  - [x] Full suite verified green: **49/49 tests passing**
  - [x] Applied to the live dev database via `scripts/seed_data.py`, confirmed via `psql`
  - [x] **Now also closed, this pass**: `RBAC_MATRIX.md` itself is finally updated to reflect
        Phase 4.5 — it had remained stalled at its pre-4.5 content the entire time between v2.4
        and this version, despite this document claiming it was current. See `RBAC_MATRIX.md`'s
        own header for the full explanation.
  - [ ] **Still open**: copy the finalized `RBAC_MATRIX.md`, `IHG_Architecture.md`,
        `IHG_Traceability.md`, and `IHG_WhiteLabel_Auth_PlatformOps.md` into the repo's actual
        `docs/` folder — carried forward again, now three phases further overdue (see §1 and §5).

- [x] **Phase 5: Shared Inventory Domain** — **COMPLETE, verified**
  - [x] Models/repositories/services/api for inventory_item, stock, supplier, stock_transaction, stock_alert
  - [x] Applied the corrected permission convention from the start: 3-part, read/write pairs
        (`inventory:item:*`, `inventory:supplier:*`) + named exceptions where justified
        (`inventory:stock:read`/`inventory:stock:adjust`, `inventory:alert:read`/`inventory:alert:resolve`)
  - [x] `inventory_service.adjust_stock()` built as the single stock-mutation entry point,
        confirmed signature (see §5 directory tree entry for `inventory_service.py`)
  - [x] Low-stock alert notification fan-out to the `"Management"` department, via `iam`'s
        existing service layer only — zero changes to `iam`
  - [x] Migration `0004_add_inventory_tables.py` — applied for real against a live Postgres 16 instance
  - [x] `scripts/seed_data.py` updated with 8 new permission codes, in the same unit of work as
        the endpoints that use them (Admin-only grant — see Open Decision #38)
  - [x] `app/db/model_registry.py` and `app/api/v1/api.py` updated and verified (route
        enumeration confirmed all 16 endpoints registered correctly)
  - [x] 11 unit tests written — **3 later rewritten after a real bug was caught**: an unsafe
        assumption that the real `"Management"` department starts empty in tests, which doesn't
        hold against a live dev DB with prior manual-testing history. Fixed to assert deltas /
        specific-recipient membership; reproduced the original failure locally before and after
        the fix to confirm (see Open Decision #37)
  - [x] Full suite verified green: **60/60 tests passing** (49 prior + 11 new)

- [x] **Phase 6: Payments Domain** — **COMPLETE, verified**
  - [x] Models/repositories/services/api for payment, payment_method (demo/test mode)
  - [x] Payment state machine built: `pending → paid|failed` (confirm) → `paid → refunded` (refund)
  - [x] Currency defaults from `config/company.yaml` via `get_company_config().currency`
  - [x] Idempotency confirmed working for every mutating endpoint via the pre-existing global
        `idempotency_middleware` — zero new route-level code required
  - [x] Migration `0005_add_payments_tables.py` — applied for real
  - [x] `scripts/seed_data.py` updated with `payments:read`/`payments:write` (flat pair,
        matching `RBAC_MATRIX.md`'s allowance for single-primary-resource domains at the time —
        **later split further in Phase 6.5**, see below)
  - [x] A real routing bug caught and fixed **before** hand-off: `/methods` was originally
        registered after `/{payment_id}`, which would have caused FastAPI to parse `"methods"`
        as an invalid UUID path parameter. Caught by inspecting route→handler bindings directly,
        not by chance — fixed by reordering, and this ordering rule is now codified as
        Architecture Principle #13 (§3) for every subsequent router.
  - [x] 21 unit tests written and passing. Full suite verified green: **81/81** (60 prior + 21 new)

- [x] **Phase 6.5: Payments — Dual-Refund Architecture, Payment Method CRUD, Simulated Webhook**
      — **COMPLETE, verified.** *(New phase, inserted after Phase 6 at the user's explicit
      request — same pattern as Phase 4.5 being inserted between Phases 4 and 5.)*
  - [x] Scoped and confirmed collaboratively before any code was written — 5 explicit decisions
        were locked in ahead of implementation (staff-only refund requests; set-default skipped;
        webhook fully simulated; lowercase RefundRequest statuses; tracked as its own phase) —
        see Open Decision #34 for the full record
  - [x] `RefundRequest` model + migration `0006_add_refund_requests_table.py` — applied for real
  - [x] Dual-refund architecture implemented: direct refund (`payments:refund:direct`, no
        approval) and request/approval flow (`payments:refund:request` to file,
        `payments:refund:review` to list/approve/reject) — both paths converge on the SAME
        `payment_service.refund_payment()`, so there is exactly one function anywhere that
        actually transitions a `Payment` to `"refunded"`
  - [x] Payment method CRUD completed: `GET`/`DELETE /payments/methods/{method_id}` added;
        "set-default" explicitly **not** built (Open Decision #34)
  - [x] Simulated webhook (`POST /payments/webhook`) — shared-secret header auth via
        `PAYMENTS_WEBHOOK_SECRET` (new `core/config.py` field, flagged as an infra touch before
        being made), dispatches to the same `confirm_payment()`/`refund_payment()` used
        everywhere else, deliberately not tied to any real provider SDK (Open Decision #35)
  - [x] Permission catalog split further: `payments:method:read`/`write` split out from the
        general `payments:write`; `payments:refund:direct`/`request`/`review` added.
        `payments:write` now covers only intent creation + confirmation. All still Admin-only in
        `DEFAULT_ROLES` — creating "Finance Admin"/"Refund Manager" roles uses the pre-existing
        IAM roles/permissions API, no new code
  - [x] `app/api/v1/api.py` updated to mount the new `admin_refund_requests` router
  - [x] 21 unit tests written (19 service-layer + 2 real HTTP-layer webhook-signature checks via
        the project's own in-process `client` fixture). Full suite verified green: **102/102**
        (81 prior + 21 new)
  - [ ] **Still open, this pass**: `PROJECT_STATE.md` and `RBAC_MATRIX.md` had not yet been
        updated to reflect Phases 5/6/6.5 — **this is exactly what this version (v2.7) and
        `RBAC_MATRIX.md` v3 close out.**

- [x] **Phase 7: Hotel Operations Engine** — **COMPLETE, verified end-to-end in Docker**
  - [x] Room management & availability — `Hotel`/`RoomType`/`Room` models + `room_service.py`
        (incl. `is_room_available()`, the no-double-booking check every booking runs through)
  - [x] Guest booking, check-in, check-out — `Booking` model (status machine: reserved →
        checked_in → checked_out, or reserved → cancelled), `booking_service.py`,
        `checkin_checkout_service.py`. Cross-domain guest-existence check confirmed calling
        `customers.services.guest_service.get_guest()` (not `customers` models/repositories).
  - [x] Billing & PDF invoice generation — **first real consumer of
        `payment_service.create_payment_intent()`/`confirm_payment()`**, via
        `invoice_service.pay_invoice()`. PDF generated on-demand via the existing
        `pdf_service.render_pdf_template()` — `refund_payment()` is NOT yet called from
        anywhere in `hotel` (no refund flow was in this phase's scope; still open, not
        forgotten)
  - [x] Housekeeping & room service requests — `HousekeepingTask`/`ServiceRequest` models,
        `housekeeping_service.py` (auto-creates a cleaning task on checkout),
        `service_request_service.py` (only accepted for a checked-in booking).
        **`inventory_service.adjust_stock()` was NOT wired this phase** — no
        minibar/amenity stock consumption exists yet; flagged as a real, still-open gap, not
        silently dropped (see below)
  - [x] Integration tests for hotel flow — delivered as
        `tests/unit/hotel/test_hotel_booking_flow.py` (2 tests: full lifecycle, and the
        Housekeeping permission-split acceptance check), **not** under `tests/integration/`,
        per the precedent `test_refund_workflow.py` set in Phase 6.5 — see Open Decision #43
  - [x] `hotel:write` was NOT used as a flat code — split into 5 real read/write resource pairs
        (`room`, `booking`, `housekeeping`, `invoice`, `service_request`) from the start, per
        the exact RBAC design discussion `RBAC_MATRIX.md` §4.8 had flagged. `Housekeeping`
        role granted `hotel:housekeeping:*` only; `Reception` granted `hotel:room:read` +
        `hotel:booking:*` — **`hotel:booking:write`'s actual scope was explicitly verified
        before granting it to Reception**: confirmed (by inspecting every endpoint gated by it)
        to cover only create/cancel/check-in/check-out, with zero reachable path into
        invoice/payment logic (that's `hotel:invoice:*`, a separate code Reception does not
        hold)
  - [ ] **Still open, carried forward from this phase**: `inventory_service.adjust_stock()` has
        no real caller yet anywhere in `hotel` — minibar/amenity consumption was never wired.
        `Payment`/`PaymentMethod` still have no ownership link to a `hotel_guest`/`customer` —
        Open Decision #34's Phase-7-revisit trigger was reached, but customer self-service
        refunds and payment-method "set-default" were not built this phase; still deferred.
  - [x] **Two real, pre-existing bugs found and fixed during live verification, before hand-off**
        (both are test-infrastructure, not `hotel`-domain-logic bugs):
        (1) `tests/conftest.py`'s `client` fixture didn't override `get_db`, so a second
        DB-writing test driven through `client` in the same pytest run hit the same asyncpg
        "attached to a different loop" failure Phase 4.5 fixed for `db_session` — just in a
        different place, undetected until now because no earlier test file had two separate
        test functions each make a DB-writing request via `client`. Fixed in `conftest.py`
        (see Open Decision #40); `app/db/connection.py` untouched, same precedent as Phase 4.5.
        (2) `test_hotel_booking_flow.py`'s own mid-test `db_session.commit()` calls (needed for
        `client`'s separate connection to see seeded data) defeated `db_session`'s rollback-only
        cleanup contract — confirmed via direct `psql` query that 10 hotels/rooms and 5
        bookings/invoices had leaked permanently across repeated runs. Fixed with an explicit
        `cleanup_hotel_rows` teardown fixture (Open Decision #41).
  - [x] Two mid-delivery corrections made before hand-off, at the user's explicit request:
        `RoomType`'s schemas were originally (incorrectly) folded into `hotel.py`'s schema file
        instead of the pre-scaffolded empty `room_type.py` placeholder reserved for them —
        corrected to match the domain's 1:1 model-to-schema-file convention (Open Decision #42).
        The integration test was initially placed under `tests/integration/`, inconsistent with
        the `tests/unit/<domain>/` precedent `test_refund_workflow.py` had already set — moved
        (Open Decision #43).
  - [x] `alembic.ini`/`pyproject.toml` briefly suspected missing during live verification (both
        absent from a particular zip export of the repo) — confirmed a zip-export artifact, not
        a real repository gap, once the actual files were provided; verified byte-for-byte
        functionally equivalent to what had been reconstructed as a stopgap (Open Decision #44)
  - [x] Migration `0007_add_hotel_tables.py` — applied for real (`alembic upgrade head`,
        reaching `0007`, verified via `alembic current`) against a live Postgres 16 instance
        running in Docker (not the sandbox this document's earlier phases were verified in)
  - [x] `scripts/seed_data.py` updated with 10 new permission codes, in the same unit of work
        as `hotel`'s endpoints. `Housekeeping` and `Reception` granted real, scoped hotel
        permissions — confirmed live via direct `psql` query (`Housekeeping`: exactly 2 rows;
        `Reception`: exactly 6 rows)
  - [x] `app/db/model_registry.py` and `app/api/v1/api.py` updated and verified (32 hotel routes
        confirmed registered via direct route enumeration against the booted app; 119 routes
        total app-wide)
  - [x] Full suite verified green: **104/104 tests passing** (102 prior + 2 new), run twice in a
        row against a live Postgres instance to rule out ordering flakiness, with post-run
        `psql` row-count checks confirming zero leaked data after the cleanup-fixture fix

- [x] **Phase 8: Restaurant Operations Engine** — **COMPLETE, verified**
  - [x] Table reservations & dine-in ordering — `Restaurant`/`DiningTable`/`TableReservation`
        models + `restaurant_service.py`/`table_reservation_service.py`. Reservation status
        machine: reserved → seated → completed, or reserved → cancelled/no_show; each transition
        also drives the table's own status (`available`→`reserved`→`occupied`→`cleaning`)
  - [x] Real-time Kitchen Display System (KDS) order routing — `DineInOrder`/`DineInOrderItem`/
        `KitchenTicket` models (1:1 order-to-ticket), `dine_in_order_service.place_order()`
        (creates the order + snapshotted line items in one call — no separate "cart" concept),
        `kitchen_service.py` (`create_ticket_for_order()` called as an explicit follow-up from
        the API layer immediately after an order is placed, matching the intent-then-confirm
        granularity precedent from `payments`/`hotel`; `update_ticket_status()` advances
        pending→preparing→ready→served, keeping the underlying `DineInOrder.status` in sync via
        same-domain repository calls, never needing `restaurant:order:write` for the Kitchen role
        to do this)
  - [x] Billing & waiter duty tracking — `dine_in_order_service.generate_bill()` (served→billed,
        recomputes totals; tax_amount left at 0 with a TODO, same open item as `hotel.
        invoice_service`), `WaiterAssignment` model + `waiter_service.py` (only one active
        assignment per table at a time)
  - [x] **First real consumer of `inventory_service.adjust_stock()` since Phase 5** —
        `dine_in_order_service._consume_inventory_for_item()` calls it per order line, but
        **only** when the ordered `MenuItem` has an `inventory_item_id` linked; skipped entirely
        otherwise, a deliberate design choice (not every menu item needs stock tracking) that
        also keeps the integration test self-contained (no inventory item needed to be seeded to
        exercise the reserve-to-bill flow) — see Open Decision #47
  - [x] Integration tests for restaurant flow — delivered as
        `tests/unit/restaurant/test_restaurant_flow.py` (2 tests: full reserve→seat→order→
        kitchen-ticket→bill lifecycle, and the Waiter/Kitchen permission-split acceptance
        check), **not** under `tests/integration/`, following the identical precedent Phase 7
        set (itself following `test_refund_workflow.py`'s Phase 6.5 precedent)
  - [x] Waiter-vs-Kitchen permission split evaluated and implemented, per the exact task
        instruction: `restaurant:table:*` (deliberately covers restaurants, tables,
        reservations, AND waiter assignments as one grouped resource — mirroring `hotel:room:*`
        covering hotels/room-types/rooms, since the task's "minimum split" instruction specified
        exactly 4 resource groups), `restaurant:menu:*`, `restaurant:order:*`,
        `restaurant:kitchen:*`. No flat `restaurant:write` code was ever used. `Waiter` granted
        `restaurant:order:read/write` + `restaurant:menu:read` (menu-read so a waiter can see
        what's on the menu while taking an order, but explicitly NOT `restaurant:menu:write` —
        "without menu-editing rights," per the task spec, verbatim). `Kitchen` granted
        `restaurant:kitchen:read/write` only — kitchen tickets are returned with embedded
        order-item summaries (`KitchenTicketDetailRead`) so Kitchen never needs
        `restaurant:order:read` either — see Open Decision #48
  - [x] **One pre-existing bug from Phase 7 found and fixed this session, unrelated to Phase 8's
        own scope but flagged and fixed since it was a one-line, isolated fix**:
        `app/domains/hotel/api/hotels.py` called `envelope(...)` throughout but never imported
        it from `app.shared_kernel.schemas.response_envelope` — a real `NameError` waiting to
        happen on the first actual request to any `/hotel/hotels` endpoint. Undetected by Phase
        7's own test suite because `test_hotel_booking_flow.py` seeds hotels/rooms via the
        repository layer directly, never through this router. Fixed with a one-line import
        addition; confirmed no other `hotel` API file has the same gap — see Open Decision #46
  - [x] Migration `0008_add_restaurant_tables.py` — applied for real (`alembic upgrade head`,
        reaching `0008`) against a live Postgres instance
  - [x] `scripts/seed_data.py` updated with 8 new permission codes, in the same unit of work as
        `restaurant`'s endpoints. `Waiter` and `Kitchen` granted real, scoped restaurant
        permissions (`Waiter`: exactly 3 codes; `Kitchen`: exactly 2 codes)
  - [x] `app/db/model_registry.py` and `app/api/v1/api.py` updated and verified (33 restaurant
        routes confirmed registered via direct route enumeration against the booted app; 152
        routes total app-wide)
  - [x] Full suite verified green: **106/106 tests passing** (104 prior + 2 new)

- [x] **Phase 9: Food Delivery Engine** — **COMPLETE, verified end-to-end, confirmed by the user (108/108)**
  - [x] Customer order placement & delivery dispatch tracking — `DeliveryOrder`/
        `DeliveryOrderItem` models + `delivery_order_service.place_order()` (customer-initiated,
        not staff-initiated — the first order/booking-creation flow in the codebase driven
        entirely by a customer identity rather than a staff one). Status machine: placed →
        confirmed → preparing → ready_for_pickup → assigned → out_for_delivery → delivered, or
        placed/confirmed/preparing → cancelled — the longest status chain of any domain so far,
        deliberately built with a timestamp column per transition to support customer-facing
        tracking
  - [x] Rider assignment & status updates — `DeliveryRider`/`DeliveryAssignment` models +
        `rider_service.py` (`create_rider()` — cross-domain existence check via `iam.
        staff_service.get_staff()`, `assign_rider_to_order()` — deactivates any existing active
        assignment first, mirrors `waiter_service.assign_waiter()`'s Phase 8 precedent) +
        `delivery_tracking_service.py` (`mark_picked_up()`/`mark_delivered()` — both
        ownership-checked via `_get_active_assignment_for_rider()`, so a Rider can progress only
        deliveries actually assigned to them, not just any order they hold the permission code
        for)
  - [x] **First domain to call into THREE separate peer domains' services in a single call
        chain, plus a fourth for rider verification** — `delivery_order_service.place_order()`
        calls `restaurant.restaurant_service`/`menu_service`, `customers.address_service`, and
        (via `_consume_inventory_for_item()`) `inventory.inventory_service.adjust_stock()`
        (skipped entirely when a menu item has no `inventory_item_id` linked, identical to
        `dine_in_order_service`'s Phase 8 precedent); `rider_service.create_rider()` calls
        `iam.staff_service.get_staff()`. `delivery` imports zero models or repositories from any
        of the four
  - [x] **`app.api.v1.deps.require_verified_customer()` wired to a live endpoint for the first
        time anywhere in the codebase** — gates `POST /delivery/orders`. This closes out Open
        Decision #19 (open since Phase 4): `email_verified_at` still does NOT gate customer
        *login* (unchanged, that decision stands), but delivery order *placement* specifically
        now requires a verified email, exactly as originally planned for "Phase 9" back when
        that phase number was still an abstract placeholder in the roadmap
  - [x] Integration tests for delivery flow — delivered as
        `tests/unit/delivery/test_delivery_flow.py` (2 tests: full placed→confirmed→preparing→
        ready→assigned→out_for_delivery→delivered lifecycle across customer/staff/rider actors,
        and the unverified-customer-blocked acceptance check — `require_verified_customer()`
        itself returns 403, not a hand-rolled check), **not** under `tests/integration/`,
        following the identical precedent Phases 7 and 8 both set
  - [x] Permission catalog: exactly 5 codes, per the task's explicit minimum —
        `delivery:order:read`, `delivery:order:write`, `delivery:rider:read`,
        `delivery:rider:write`, plus **`delivery:order:update_status`** — the narrower,
        Rider-scoped named exception the task asked us to "consider," added because a Rider
        genuinely needs to progress deliveries assigned to them without also holding
        confirm/preparing/ready/cancel access over every order in the system. Order *placement*
        itself needs no permission code at all — customer-facing, gated by
        `require_verified_customer()` instead. `Rider` granted `delivery:order:read`,
        `delivery:order:update_status`, `delivery:rider:read` — deliberately NOT
        `delivery:order:write` (a restaurant/dispatcher action) or `delivery:rider:write`
        (dispatch/rider-CRUD is a supervisory action, mirroring `restaurant:table:*` gating
        waiter-to-table assignment rather than `restaurant:order:*`) — see Open Decision #50
  - [x] **Rider self-service availability toggling deliberately NOT built this phase** — a
        rider's status ("available"/"busy"/"offline") is instead maintained automatically as a
        side effect of dispatch (`assign_rider_to_order()` sets "busy") and delivery completion
        (`mark_delivered()` sets "available" again); a dispatcher/admin can still force a status
        via `PUT /delivery/riders/{id}/status` (`delivery:rider:write`). Building a dedicated
        Rider self-toggle endpoint would need a 6th permission code beyond the task's explicit
        minimum — flagged as a real, open gap for a future phase rather than silently added, the
        same practice as `PaymentMethod` "set-default" being explicitly skipped in Phase 6.5 or
        hotel's minibar stock consumption being flagged as not wired in Phase 7 — see Open
        Decision #51
  - [x] **No payments integration for delivery orders this phase** — `DeliveryOrder` does not
        create or reference any `payments.Payment` row; cash-on-delivery is implicitly assumed
        but never modeled. The task didn't ask for payments integration and it wasn't silently
        added — flagged as an open item for a future phase, same practice as the two gaps above
        — see Open Decision #52
  - [x] Migration `0009_add_delivery_tables.py` — applied for real (`alembic upgrade head`,
        reaching `0009`, chain `0007→0008→0009` verified) against a live Postgres instance,
        confirmed by the user directly
  - [x] `scripts/seed_data.py` updated with 5 new permission codes, in the same unit of work as
        `delivery`'s endpoints. `Rider` granted a real, scoped, deliberately narrow permission
        set (exactly 3 codes)
  - [x] `app/db/model_registry.py` and `app/api/v1/api.py` updated and verified (22 delivery
        routes confirmed registered via direct route enumeration against the booted app; 174
        routes total app-wide)
  - [x] Full suite verified green: **108/108 tests passing** (106 prior + 2 new), confirmed by
        the user directly against a live Postgres instance — see Open Decision #53

- [x] **Phase 10a: Reporting Domain, Module Toggles, Cross-Domain Proof, Compose Hardening**
      — **COMPLETE, verified live (114/114)**
  - [x] Management dashboard analytics — `GET /reporting/dashboard`, cross-domain
        aggregate counts/revenue via hotel/restaurant/delivery's own service layers,
        optional `date_from`/`date_to` window
  - [x] Excel export for reports — `GET /reporting/reports/revenue/export`, via the
        pre-existing `shared_kernel.services.excel_service.build_excel_report()`
        (Phase 2), no new export dependency needed
  - [x] End-to-end test (cross-domain) — `tests/unit/reporting/test_dashboard_cross_
        domain.py`: a completed hotel booking (paid invoice), a completed restaurant
        dine-in order (billed), and a completed delivery order (delivered) all run to
        completion in one test, then asserted against the dashboard's BEFORE/AFTER
        delta (not absolute counts — per the standing testing lesson, Open Decision
        #39) plus a second test confirming the date-range filter genuinely excludes
        out-of-window activity
  - [x] Module toggles — `require_module_enabled()` (Architecture Principle #15 above),
        `hotel`/`restaurant`/`delivery` routers gated at mount time in `api.py`;
        `tests/unit/settings/test_module_toggle_gating.py` (4 tests: enabled reaches
        auth check, disabled 404s, toggle flips live without restart, disabling one
        module doesn't affect another)
  - [x] `docker-compose.yml` production-readiness review — `restart: unless-stopped`
        and healthchecks added to `api`/`db`, log rotation added to `api`, resource
        limits added to both, and a new `nginx` reverse-proxy service added wiring in
        the pre-existing (previously unmounted) `docker/nginx/nginx.conf` — confirmed
        its upstream target (`api:8000`) matches this Compose file's service name/port
        with no mismatch. `docker-compose.override.yml` confirmed correctly dev-only,
        left unchanged. Two items flagged, explicitly NOT fixed in this pass since
        they're infra/secrets decisions beyond a Compose-file edit: `.env` secrets
        migration to a real secrets manager (Open Decision #28), and rotating
        `PAYMENTS_WEBHOOK_SECRET` off its checked-in default (Open Decision #36) —
        both restated here rather than silently dropped.
  - [x] CORS verified working ahead of the upcoming React frontend build — `app/core/
        config.py`'s `cors_origins_list` property correctly comma-splits
        `CORS_ALLOWED_ORIGINS`, confirmed supports multiple origins (e.g. dev's
        `:5173`/`:3000` alongside a future prod domain), no code change needed
  - [ ] **Not yet closed, carried forward as Phase 10b**: an unexplained live route-
        count discrepancy (measured 173, naively-expected 177) — see Open Decision #54
- [ ] **Phase 10b: Documentation** *(NEXT — deliberately resequenced after Phase 10a,
      ahead of a React frontend build starting immediately after this session, per the
      user's explicit direction)*
  - [x] `docs/API_CONVENTIONS.md` — populated, prioritized ahead of the rest since a
        frontend build needs it immediately (envelope shape, auth header convention,
        error format, module-toggle 404 behavior, no-pagination-yet caveat)
  - [ ] `docs/ARCHITECTURE.md` — still empty, deliberately deferred
  - [ ] `docs/PROPOSAL_TRACEABILITY.md` — still an empty placeholder **inside the repo's own
        `docs/` folder specifically**. The underlying work is no longer outstanding, though: the
        standalone companion `IHG_Traceability.md` (v2.4) was fully re-verified against the real
        `IHG_Project_Proposal.pdf` this session (§C.1–C.11, including two newly-added sections,
        §C.10/§C.11, covering proposal content that had never been mapped before). Populating
        this repo placeholder is now a copy-in, not a from-scratch write — same standing gap
        §1 and §5 have flagged since Phase 4.5 for every doc in this table, not a new blocker.
  - [ ] `docs/WHITE_LABEL_GUIDE.md` — still empty, deliberately deferred
  - [ ] `docs/USER_MANUAL.md` — still empty, deliberately deferred
  - [ ] `docs/DEPLOYMENT.md` — still empty, deliberately deferred until closer to the
        user's actual production step (explicitly sequenced AFTER frontend work this
        session, not before)
  - [ ] Copy every finalized doc into the repo's own `docs/` folder once complete —
        carried forward from every prior version (open since Phase 4.5); now the
        single longest-standing backlog item in this document, six phases overdue

---

## 9. Open Decisions / Assumptions Log

| # | Decision | Status |
|---|---|---|
| 1 | Hotel guests and restaurant/delivery customers kept as separate tables (not unified) | Confirmed |
| 2 | `payments` treated as its own thin domain rather than folded into `shared_kernel` | Confirmed — **now built, Phase 6**, validating this call: `payments` is genuinely thin (3 models) but has enough distinct business logic (a state machine, a dual-refund workflow) to have clearly warranted its own domain rather than living inside `shared_kernel`. |
| 3 | Celery/Redis introduced once a phase first needs background jobs, not from Phase 1 | Confirmed — still true; `app/tasks/` contains only `__init__.py`. **This constraint directly shaped two Phase 5/6.5 design choices**: Phase 5's low-stock alert dispatch is synchronous/inline rather than queued (Open Decision #33), and there was never a serious option to defer Phase 6.5's webhook processing to a background worker either. |
| 4 | Multi-property hotel support (`hotel.py` as a table, not a singleton) | Assumed for future growth per proposal's constraint |
| 5 | AI chat/recommendation features are out of scope for Phases 1–10 | Per proposal: "first version covers core system" |
| 6 | Two-tier config: `config/company.yaml` (static) + `system_settings` table (dynamic) | Confirmed. **Not yet used by either new Phase 5/6.5 hardcoded value** (`ALERT_TARGET_DEPARTMENT_NAME`, `PAYMENTS_WEBHOOK_SECRET`) — both are explicit TODOs for future `system_settings`/env migration, not yet done. |
| 7 | Staff never self-register — admin creates account, staff sets password via invite link | Confirmed |
| 8 | `repositories/` layer added per domain, strictly DB-query-only, separate from `services/` | Confirmed — **followed exactly in `inventory` and `payments`**, including the deliberate exception that `stock_transaction_repository.py` has no `save`/`soft_delete` (append-only) |
| 9 | `db/connection.py` used (not `session.py`) for engine/session setup | Confirmed |
| 10 | `db/base.py` removed — Base+mixins live in `core/base_model.py`; model aggregation lives in `db/model_registry.py` | Confirmed |
| 11 | Model registry pattern: each domain's `models/__init__.py` re-exports its models; `db/model_registry.py` imports each domain's `models` package | Confirmed — **now includes `inventory` and `payments`** |
| 12 | `is_superadmin` is a boolean flag on `staff_user`, not a role | Confirmed |
| 13 | Password reset/invite/verify-email tokens use one polymorphic shared model, not per-domain duplicates | Confirmed |
| 14 | Email testing strategy: Mailpit (dev) + mocked `email_service` in pytest + real SMTP provider in production | Confirmed |
| 15 | `system_setting.is_public: bool` column added (not in original Phase 2 spec) | Confirmed (Phase 2 deviation) |
| 16 | `app/core/security.py` created in Phase 3 as a gap-fill | Confirmed (Phase 3 deviation, necessary) |
| 17 | `app/shared_kernel/middlewares/audit_middleware.py` imports `app.domains.iam.services.audit_service` — documented cross-domain exception | Confirmed. **Re-confirmed safe for an unauthenticated request, Phase 6.5** — the webhook endpoint produces an audit_log row with `staff_user_id=NULL` rather than erroring, verified by reading the extraction logic directly before relying on it. |
| 18 | `system_settings.updated_by_staff_id` has **no hard FK constraint** to `staff_users.id`, kept loosely coupled deliberately, same principle as `payments.reference_id` | Confirmed — **and this exact no-hard-FK convention was then reused directly for real in Phase 5/6/6.5**: `StockTransaction.performed_by_staff_id`, `StockAlert.resolved_by_staff_id`, `Payment.reference_type`/`reference_id`, `RefundRequest.requested_by_staff_id`/`reviewed_by_staff_id` all follow the same pattern — no domain now has a hard FK crossing into `iam.staff_users` or another domain's tables. |
| 19 | Customer login does NOT gate on `email_verified_at` — deferred to Phase 9 | **Partially resolved, Phase 9.** Login itself still does NOT gate on `email_verified_at` — that part of the decision is unchanged and remains deliberate (unverified customers can still log in, browse, and manage their profile/addresses). What Phase 9 actually delivered, per its own task spec's wording ("full enforcement... on delivery-order-relevant actions"), was narrower and more precise: `require_verified_customer()` now gates the one action that specifically needed it — `POST /delivery/orders`. Confirmed working via a real HTTP test: an unverified customer's order-placement attempt returns 403. |
| 20 | `is_superadmin` vs "Admin" (a `Role` row) are architecturally distinct | Confirmed, clarified via discussion (no code change) |
| 21 | `pdf_service` uses `xhtml2pdf`; `excel_service` uses `openpyxl` — neither pinned in the original spec | Confirmed |
| 22 | `APP_BASE_URL` env var added, defaults to `http://localhost:3000` | Confirmed, operational workaround documented in ops guide |
| 23 | **Permission code convention confirmed 3-part**: `<domain>:<resource>:<action>` | Confirmed as the standing convention (locked in) — **now validated against two more built domains with zero exceptions, including named-exception codes like `inventory:stock:adjust` and `payments:refund:direct` staying within the 3-part shape.** |
| 24 | **Hierarchical wildcard permission support** for `rbac_service.has_permission()` | **Implemented and verified, Phase 4.5.** **Now also proven in practice across two brand-new domains, Phases 5/6/6.5** — Admin's single `"*"` grant transparently covered every new `inventory:*` and `payments:*` code the moment each was seeded, with zero code changes to `rbac_service.py` or `DEFAULT_ROLES["Admin"]` required. This is the concrete real-world payoff the design was built for. |
| 25 | `customers:guests:*` seeding bug | **Fixed, Phase 4.5.** |
| 26 | `Housekeeping` role missing from `DEFAULT_ROLES` | **Fixed, Phase 4.5.** |
| 27 | Dependency pinning lives in `requirements.txt` + `requirements-dev.txt` | Confirmed via real repo, no action needed. **Still true, Phases 5/6/6.5** — zero new dependencies were added for either phase. |
| 28 | A real `.env` file is present in this repo snapshot with working dev credentials | Flagged for `.gitignore` verification |
| 29 | Pre-existing `conftest.py` event-loop/connection-pool bug | **Fixed, Phase 4.5.** |
| 30 | Pre-existing broken mock patch targets in `test_auth_service.py` | **Fixed, Phase 4.5.** |
| 31 | **New bug found and fixed within Phase 6, before hand-off**: `app/domains/payments/api/payments.py`'s original route registration order placed `GET/POST /methods` AFTER `GET /{payment_id}`. Since `{payment_id}` is a single dynamic path segment and `/methods` is also a single static segment, FastAPI/Starlette would have attempted to parse the literal string `"methods"` as a `payment_id` UUID and failed with a 422 rather than ever reaching the intended handler | **Fixed, Phase 6, before hand-off** — reordered so all static single-segment paths precede the dynamic `/{payment_id}` route; verified by directly inspecting each route's bound `endpoint.__name__` after the fix, not just by re-reading the source. Generalized into Architecture Principle #13 (§3) for every subsequent router, and explicitly re-applied when Phase 6.5 added `/webhook` and `/methods/{method_id}`. |
| 32 | `Payment.status`, `StockAlert.status`, and `RefundRequest.status` are all free-form strings, not a shared enum from `core/constants.py` (which still doesn't exist — see §5) | Confirmed as the standing convention for Phases 5/6/6.5, consistent with the pre-existing `transaction_type`/`purpose` free-form-string pattern already used by `password_reset_token.purpose` and `StockTransaction.transaction_type`. Revisit once `core/constants.py` is actually built (still unscheduled). |
| 33 | **Low-stock alert notification targeting (Phase 5)**: fans out to every staff member in the `"Management"` department, resolved via `iam`'s existing `department_service.list_departments()` and `staff_service.list_staff()` — zero changes to `iam`. Hardcoded via `ALERT_TARGET_DEPARTMENT_NAME` module constant, chosen over a Celery-queued dispatch (Open Decision #3 — not built yet) and over a `system_settings`-configurable department (Open Decision #6 — not wired up for this yet either) | Confirmed, explicit `# TODO: make configurable via system_settings` left in code. Revisit if/when a real role needs a different target department, or when `system_settings`-driven configuration is prioritized for this specific value. |
| 34 | **Phase 6.5 dual-refund architecture, scoped and confirmed collaboratively before implementation**: (a) refund-request submitters are staff-only (e.g. Reception/Desk Staff), no customer/guest linkage on `RefundRequest` — customer self-service refunds explicitly deferred until a real domain (hotel, Phase 7+) can verify payment ownership; (b) `PaymentMethod` "set-default" was proposed and then explicitly **skipped**, to avoid a schema hack (adding a `principal_type`/`principal_id` polymorphic owner column) ahead of real customer/account ownership existing anywhere in `payments`; (c) `RefundRequest.status` uses lowercase strings, consistent with `Payment.status` | Confirmed by explicit user sign-off before any code was written for Phase 6.5 — not a default assumed by the development team. Revisit trigger for (a)/(b): once Phase 7 (hotel) gives `Payment` a real, verifiable link to a paying customer/guest. |
| 35 | **Phase 6.5 webhook is fully simulated** — a shared-secret header (`X-Webhook-Signature` compared via `hmac.compare_digest()` against `settings.PAYMENTS_WEBHOOK_SECRET`), explicitly NOT wired to any real provider (Stripe/bKash/SSLCommerz) SDK, credentials, or signature-verification scheme. Real integration with a named provider was identified as its own, separate, larger effort (credentials, sandbox accounts, per-provider HMAC/signature verification code, new pinned dependencies) and deliberately not bundled into this phase | Confirmed by explicit user sign-off. Real gateway integration is unscheduled — would need its own phase/session when prioritized, naming a specific provider. |
| 36 | `app/core/config.py` — a `core/` (framework-level) file — was edited in Phase 6.5 to add `PAYMENTS_WEBHOOK_SECRET: str = "mock-webhook-secret-change-me"`. Flagged explicitly as an infra-adjacent touch before being made, per the standing rule that cross-domain/infrastructure changes need explicit awareness, not silent action. Given a safe default so no existing `.env` breaks | Confirmed, done with the user's awareness. **Action still needed**: the real `.env` in this repo snapshot does not yet override this default — must be set to a real random value before any shared/staging/production deployment (see §6). |
| 37 | **Real test-design bug found and fixed within Phase 5**: 3 of the original low-stock-alert tests asserted absolute notification call-counts and alert counts, silently assuming the real `"Management"` department starts empty. `db_session`'s per-test rollback correctly isolates each test's OWN writes from each other, but cannot and does not roll back data that existed in a real, persistent dev database before the test session began (e.g. from prior manual invite-flow testing in Phase 3/4) | **Fixed, Phase 5, before hand-off** — reproduced the exact failure locally first (by permanently committing a real staff member into `Management`, unrolled-back) to confirm the root cause, then rewrote the affected tests to assert deltas / specific-recipient membership instead of absolute counts, and to patch `ALERT_TARGET_DEPARTMENT_NAME` to a guaranteed-nonexistent name for the "no matching department" case rather than relying on real data being empty. Verified the fix against the same polluted-DB reproduction before and after. This is now a standing lesson applied proactively in Phase 6.5's webhook tests too (Open Decision #39). |
| 38 | **All new Phase 5/6/6.5 permission codes are Admin-only in `DEFAULT_ROLES`** — no grants added to Manager, Reception, Housekeeping, Waiter, Kitchen, or Rider for either `inventory:*` or `payments:*`, even though `RBAC_MATRIX.md` §5.2 (pre-4.5 draft) had proposed some of these as future target grants (e.g. Manager/Housekeeping/Waiter/Kitchen getting various `inventory:*` read/write slices) | Confirmed as a deliberate, explicit choice each phase for Phases 5/6/6.5 — not an oversight. **Pattern deliberately broken, Phase 7**: `hotel`'s permissions were NOT kept Admin-only — `Housekeeping` and `Reception` both received real, scoped grants (see Open Decision #45), because Phase 7 is the first domain where a concrete, named operational need for a non-Admin role actually exists and was explicitly requested. **Pattern broken again, Phase 8**: `restaurant`'s `Waiter` and `Kitchen` roles both received real, scoped grants (see Open Decision #48). **Pattern broken a third time, Phase 9**: `delivery`'s `Rider` role received a real, scoped grant (see Open Decision #50) — this is now the established norm for every newly-built *operational* domain (hotel, restaurant, delivery) rather than the exception; `inventory:*`/`payments:*` remain Admin-only, unchanged, since those two are *shared/thin* domains rather than operational ones and this decision was never revisited for them. With `delivery` now built, every operational domain in the platform (`hotel`, `restaurant`, `delivery`) grants real, non-Admin permissions to at least one of its front-line staff roles — only `reporting` (read-only, Phase 10) remains to test this pattern once more. |
| 39 | **Standing testing lesson, formalized after Open Decision #37**: tests must never assert on the absolute emptiness/count of shared, real-world entities (departments, staff rosters, etc.) that may carry state from manual testing or other sessions in a live dev database. Prefer delta-based assertions, scoped-to-a-known-id assertions, or patching a well-known constant (e.g. a target department/config name) to a guaranteed-fresh value | Confirmed as a standing convention going forward. Applied proactively in Phase 6.5 (the two HTTP-layer webhook tests deliberately stop short of exercising the DB-writing success path over a real HTTP client, specifically to avoid leaving test data in a persistent dev database). |
| 40 | **Real bug found and fixed during Phase 7's live verification — a second instance of the Phase 4.5 event-loop/pooled-connection bug, in a different location**: `tests/conftest.py`'s `client` fixture (an `httpx.AsyncClient` bound to the app via `ASGITransport`) never overrode the `get_db` dependency, so every HTTP request made through it ran against `app.db.connection`'s pooled *production* engine rather than a test-only engine. This is harmless for a single test function, but a SECOND test function in the same pytest run that also drives a DB-writing request through `client` fails with asyncpg's "attached to a different loop" — the first test's pooled connection is bound to a now-closed event loop (pytest-asyncio gives each test function its own loop by default). Went undetected through Phases 5/6/6.5 because no earlier test file had two separate test functions each make a DB-writing request via `client` — `test_refund_workflow.py`'s two `client`-based tests both return 401 before ever touching the database. `tests/unit/hotel/test_hotel_booking_flow.py` was the first file to actually trigger it. | **Fixed, Phase 7, before hand-off** — `client` fixture in `conftest.py` now overrides `get_db` for its duration to use the same dedicated `NullPool` test engine `db_session` already uses. `app/db/connection.py` (production code) intentionally untouched, matching the exact precedent Phase 4.5 set for the original instance of this bug class. Verified by running the full suite twice in a row post-fix: 104/104 both times. Formalized as Architecture Principle #14 (§3). |
| 41 | **Real bug found and fixed during Phase 7's live verification**: `tests/unit/hotel/test_hotel_booking_flow.py`'s two test functions call `db_session.commit()` mid-test — necessary so the `client` fixture's separate database connection can see the seeded hotel/room rows — but this defeats `db_session`'s normal rollback-only cleanup contract (see `conftest.py`'s own docstring: cleanup relies on repositories using `flush()`, not `commit()`, being rolled back wholesale on teardown). Once committed, that rollback becomes a no-op for this test's own writes. Confirmed via direct `psql` query against the live test database: 10 `hotels`/`rooms` rows and 5 `bookings`/`invoices` rows had accumulated permanently across repeated manual test runs before the fix. | **Fixed, Phase 7, before hand-off** — added an explicit `cleanup_hotel_rows` fixture that tracks every hotel `id` created during a test and deletes it (and everything cascading from it — rooms, bookings, housekeeping tasks, invoices, invoice items) in most-dependent-table-first order during teardown, then commits that cleanup. Verified by clearing the pre-existing leaked rows, running the full suite twice more, and confirming row counts returned to zero both times. |
| 42 | **Delivery correction, Phase 7, made before hand-off at the user's prompting**: `hotel`'s `schemas/room_type.py` file was originally left empty and `RoomTypeCreate`/`RoomTypeRead` were instead (incorrectly) folded into `schemas/hotel.py`. This broke the domain's own established 1:1 model-to-schema-file convention (matching `payments`: `payment.py`/`payment_method.py`/`refund_request.py`, and `inventory`: `inventory_item.py`/`stock.py`/`supplier.py`/etc. — one schema file per model) — the empty `room_type.py` file was in fact the pre-reserved slot for exactly this content, not dead scaffold. | **Fixed, Phase 7, before hand-off** — `RoomTypeCreate`/`RoomTypeRead` moved into `room_type.py`; `hotel.py` schema shrunk to `Hotel`-only. The one consumer (`api/hotels.py`) had its import updated accordingly. Verified via `py_compile` + a full app import + the full test suite re-passing (104/104) after the change. |
| 43 | **Test-file-location correction, Phase 7, made before hand-off at the user's prompting**: the hotel domain's full-lifecycle test was initially placed at `tests/integration/test_hotel_booking_flow.py`, following the literal wording of the original task instruction ("Integration test: ..."). This conflicted with the precedent Phase 6.5 had already set: `test_refund_workflow.py`, which also mixes `db_session`-only tests and real `client`-driven HTTP tests in one file, lives under `tests/unit/payments/`, not `tests/integration/`. Every file under `tests/integration/` (including the pre-existing empty `test_hotel_flow.py` placeholder) remained an unpopulated, planned-only stub throughout Phases 5–6.5 — that folder was never actually the convention in practice, despite being the original Phase 1 plan. | **Fixed, Phase 7, before hand-off** — test moved to `tests/unit/hotel/test_hotel_booking_flow.py`, with a `tests/unit/hotel/__init__.py` added alongside the pre-existing `.gitkeep` (matching how `tests/unit/payments/` and `tests/unit/inventory/` transitioned from `.gitkeep`-only to populated). The pre-existing `tests/integration/test_hotel_flow.py` placeholder was left untouched/still-empty, consistent with `restaurant`/`delivery`/`reporting`'s equivalent placeholders. Formalized as the explicit convention going forward: full-flow/API tests belong under `tests/unit/<domain>/`, not `tests/integration/`, unless a future phase makes a deliberate, explicit decision to populate the latter instead. |
| 44 | **False alarm, Phase 7 live verification**: `alembic.ini` and `pyproject.toml` were briefly suspected to be genuinely missing from the repository, since a particular zip export of the project used for this phase's verification did not include either file at the project root — `alembic upgrade head` failed immediately with "No config file 'alembic.ini' found", and `pytest`'s handling of unmarked `async def test_...` functions across the suite (e.g. every test in `test_rbac_service.py`) depends on `pyproject.toml`'s `asyncio_mode = "auto"` setting existing somewhere. Both were initially reconstructed from first principles (reading `alembic/env.py`'s actual runtime behavior, and the test suite's own async-test-marking pattern) as a stopgap. | **Resolved as a zip-export artifact, not a real repository gap**, once the actual project files were provided directly: both existed in the real repo all along, and are functionally equivalent to the reconstructed stopgap versions (trivial differences only — e.g. black line-length 100 vs. the stopgap's 110, and `alembic.ini` leaving `sqlalchemy.url` blank vs. the stopgap's placeholder URL; both approaches work identically since `env.py` overrides the URL at runtime regardless). The real files were swapped in and the full suite re-verified green (104/104) against them before hand-off. No corrective action needed beyond this note — flagged so a future zip-export-based session doesn't misdiagnose the same non-issue as a real gap. |
| 45 | **`hotel`'s permission grants deliberately break the Phase 5/6/6.5 "new domains are Admin-only" pattern (Open Decision #38), by explicit instruction**: `Housekeeping` role granted `["hotel:housekeeping:read", "hotel:housekeeping:write"]` — scoped deliberately away from `hotel:booking:*`/`hotel:invoice:*`, matching `RBAC_MATRIX.md`'s own long-standing footnote on this exact point. `Reception` role granted `hotel:room:read`, `hotel:booking:read`, `hotel:booking:write` in addition to its existing `iam:staff:read`/`customers:guests:*` grants. Before granting `hotel:booking:write` to Reception, its actual scope was explicitly verified (not assumed) by inspecting every endpoint gated by it across `bookings.py`/`checkin.py`/`checkout.py`: confirmed to cover only booking creation, cancellation, check-in, and check-out — with zero reachable path into invoice generation, issuing, or payment (`invoice_service.pay_invoice()`, the only function in `hotel` that calls into `payments`, is reachable exclusively through `hotel:invoice:write`-gated endpoints in `invoices.py`, a code Reception does not hold). `hotel:service_request:*` was explicitly kept Admin-only, per instruction. | Confirmed by explicit user sign-off before the seed script was edited — not a default assumed by the development team, mirroring how Open Decision #34's Phase 6.5 scope was confirmed collaboratively before code was written. |
| 46 | **Real, pre-existing bug found and fixed at the start of Phase 8, unrelated to Phase 8's own task scope**: `app/domains/hotel/api/hotels.py` (built Phase 7) called `envelope(...)` in every one of its four handlers but never imported it from `app.shared_kernel.schemas.response_envelope` — a `NameError` waiting to happen on the first real request to any `/hotel/hotels` or nested `/hotel/hotels/{id}/room-types` endpoint. Went undetected by Phase 7's own live verification because `test_hotel_booking_flow.py` seeds `Hotel`/`Room` rows via `hotel_repository`/`room_repository` directly, never by calling this router's endpoints over HTTP. | **Fixed** — one-line import addition. Confirmed no other `hotel` API file has the same gap (checked every file for `envelope(` usage without a corresponding import). Route count unaffected (152 total, unchanged by the fix itself). Flagged to the user before fixing, since it was outside Phase 8's assigned scope, even though low-risk and isolated; fixed with explicit go-ahead. |
| 47 | **`restaurant.dine_in_order_service`'s inventory consumption is skipped entirely for any menu item with no `inventory_item_id` linked** — not every menu item needs stock tracking (e.g. a made-to-order dish with no single trackable ingredient), so `MenuItem.inventory_item_id` is optional and `_consume_inventory_for_item()` short-circuits to a no-op when it's `NULL`, rather than requiring every menu item to reference *some* inventory row. This also means `dine_in_order_service.cancel_order()` does NOT reverse any inventory that WAS consumed for a cancelled order — no domain in this codebase currently supports a stock "return" tied to an order cancellation. | Confirmed as a deliberate design choice, not an oversight — flagged explicitly rather than silently left unhandled, consistent with this codebase's practice of flagging real gaps (see e.g. Open Decision #6's `system_settings` TODOs). Revisit once a concrete operational need for stock-return-on-cancel exists; no such need has been named yet. |
| 48 | **`restaurant`'s permission split, decided per the task's exact "minimum split" instruction**: `restaurant:table:*` deliberately groups `restaurants.py`, `tables.py`, `reservations.py`, AND `waiters.py` under one resource pair (mirroring `hotel:room:*` grouping `hotels.py`/`rooms.py` under one pair) rather than inventing a 5th or 6th resource code, since the task specified exactly 4 resource groups for this domain. `Waiter` role granted `restaurant:order:read/write` + `restaurant:menu:read` (read-only menu access so a waiter can see what's on the menu while taking an order, but explicitly NOT `restaurant:menu:write` — "without menu-editing rights," per the task spec verbatim) — deliberately NOT `restaurant:table:*`, since table/reservation/waiter-assignment management is a supervisory/host action, not the waiter's own job. `Kitchen` role granted `restaurant:kitchen:read/write` ONLY — no `restaurant:order:read`, made possible because `KitchenTicketDetailRead` embeds order-item summaries (and the table id) directly onto the ticket response, so Kitchen staff never need to query orders separately to see what's on a ticket. | Confirmed by explicit user sign-off before the seed script was edited, mirroring Open Decision #45's precedent for `hotel`. Verified working end-to-end against a live database via the Waiter/Kitchen permission-split acceptance test (106/106 full suite). |
| 49 | **Phase 8 was executed and fully verified end-to-end against a live database**, matching Phase 7's verification standard (not merely statically checked, as an earlier draft of this document briefly assumed before the user ran the suite) — `alembic upgrade head` applied migration `0008` for real, `scripts/seed_data.py` re-run and confirmed, and the full test suite (106/106) confirmed green by the user directly. | Confirmed. No outstanding live-verification gap remains for Phase 8 as of this document's version. |
| 50 | **`delivery`'s permission catalog, scoped per the task's explicit minimum plus one asked-for consideration**: `delivery:order:read/write` and `delivery:rider:read/write` as directly specified, plus `delivery:order:update_status` — a genuine named exception (not a speculative 6th code), added because the task explicitly asked us to "consider whether Rider needs a narrower `delivery:order:update_status` distinct from full `delivery:order:write`," and a concrete need was confirmed: a Rider must be able to progress deliveries assigned to them (pickup/deliver) without also holding confirm/preparing/ready/cancel authority over every order in the system. `Rider` role granted `delivery:order:read`, `delivery:order:update_status`, `delivery:rider:read` — deliberately NOT `delivery:order:write` (a restaurant/dispatcher action) or `delivery:rider:write` (rider CRUD and dispatch are supervisory actions, mirroring `restaurant:table:*` gating waiter-to-table assignment rather than `restaurant:order:*`, Open Decision #48). Permission-level scoping alone is not sufficient here — `delivery_tracking_service._get_active_assignment_for_rider()` additionally enforces that the calling rider holds the order's actual active assignment, since `delivery:order:update_status` alone would otherwise let any Rider progress any order. | Confirmed by explicit design decision during the same session the code was written, flagged transparently rather than silently decided, mirroring Open Decisions #45/#48's precedent for `hotel`/`restaurant`. Verified working end-to-end against a live database as part of the full delivery-lifecycle test (108/108 full suite). |
| 51 | **Rider self-service availability toggling was deliberately NOT built in Phase 9** — a `DeliveryRider.status` ("available"/"busy"/"offline") is instead maintained automatically as a side effect of `rider_service.assign_rider_to_order()` (sets "busy") and `delivery_tracking_service.mark_delivered()` (sets "available" again); a dispatcher/admin can still force a status via `PUT /delivery/riders/{id}/status`, gated by `delivery:rider:write`. Building a dedicated Rider self-toggle endpoint (e.g. "go offline at end of shift" without dispatcher involvement) would require a 6th permission code beyond the task's explicit minimum catalog. | Flagged as a real, open gap for a future phase to pick up explicitly, not silently added beyond scope — same practice as `PaymentMethod` "set-default" being explicitly skipped in Phase 6.5 (Open Decision #34) or hotel's minibar stock consumption being flagged as not wired in Phase 7. Revisit once a concrete operational need for rider self-service is named. |
| 52 | **No payments integration for delivery orders in Phase 9** — `DeliveryOrder` does not create, reference, or link to any `payments.Payment` row anywhere in its lifecycle; cash-on-delivery is implicitly assumed by omission but never explicitly modeled (no `payment_method` field, no `is_paid` flag). The task's scope explicitly named `restaurant`, `inventory`, and `customers` as the domains to call into, and did not mention `payments` — so this was treated as out of scope rather than silently added as a cross-domain touch requiring separate sign-off (per the standing cross-domain-approval rule). | Flagged as a real, open gap — revisit if/when online payment collection for delivery orders is prioritized; would need explicit scoping (which of `hotel.invoice_service.pay_invoice()`'s pattern — staff-initiated "mark paid" — or a customer-initiated intent-then-confirm flow more appropriate for a delivery order — applies here) before any code is written, same as every other cross-domain payments integration in this codebase to date. |
| 53 | **Phase 9 was executed and fully verified end-to-end against a live database**, matching Phases 7 and 8's verification standard — `alembic upgrade head` applied migration `0009` for real (chain `0007→0008→0009` verified), `scripts/seed_data.py` re-run and confirmed (50 unique permission codes, zero duplicates, `Rider`'s 3-code grant verified), and the full test suite (108/108) confirmed green by the user directly. | Confirmed. No outstanding live-verification gap remains for Phase 9 as of this document's version. |
| 54 | **Unresolved, flagged not fabricated**: live route enumeration (`/api/v1/*` + `/health` paths on the booted `app.routes`) measured **173** routes after Phase 10a's reporting domain was added — 4 *fewer* than the naive expectation of 177 (Phase 9's stated, live-confirmed 174, plus reporting's 3 new endpoints). Reproduced twice by the user, including after a full `docker compose down` + `up -d --build` to rule out a stale image/container. No code change in this session removes any route — `require_module_enabled()` is a `dependencies=[...]` addition to existing `include_router()` calls, which gates routes, it does not deregister them. | **Open** — root cause not identified. Candidate explanations, none confirmed: (a) the counting methodology used for this session's measurement may not exactly match whatever produced Phase 9's "174" figure; (b) a possible pre-existing miscount in an earlier phase's stated total; (c) something genuinely different in how routes are registered that hasn't been isolated. Revisit with a full path-by-path diff against Phase 9's route list (not available in this session) before trusting either number over the other for planning purposes. |
| 55 | **`dashboard_service.py` deliberately does NOT check module toggles** — a disabled module (e.g. `hotel_module_enabled=False`) hides that module's API routes (via `require_module_enabled()`, Architecture Principle #15) but NOT its historical data from the dashboard's aggregate counts/revenue. | Confirmed as a deliberate design choice, decided in-session rather than defaulted to. Revisit if a future requirement wants disabled-module data excluded from reporting too — would need an explicit toggle check added to each of `dashboard_service.py`'s three per-domain summary functions. |
| 56 | **Module-toggle design: Option B (per-request dependency check) chosen over Option A (startup-time-only conditional router mounting)**, explicitly discussed and confirmed by the user before implementation — mirrors the collaborative-confirmation precedent Open Decisions #34/#45/#48/#50 each set for their respective phases. Option A was rejected specifically because it would break `system_settings`' own stated "no redeploy" design contract (§3 rule 11) for exactly the one setting category (module toggles) most likely to need live, no-restart changes in a real white-label deployment. | Confirmed by explicit user sign-off. See Architecture Principle #15. |
| 57 | **Documentation work (Phase 10 original task item #6) deliberately resequenced, not abandoned**: only `docs/API_CONVENTIONS.md` was populated this session; `ARCHITECTURE.md`, `PROPOSAL_TRACEABILITY.md`, `WHITE_LABEL_GUIDE.md`, `USER_MANUAL.md`, and `DEPLOYMENT.md` remain empty placeholders, deferred at the user's explicit direction because a React frontend build begins immediately after this session, before the production/deployment step this roadmap originally sequenced Phase 10 around — `API_CONVENTIONS.md` was prioritized precisely because frontend work needs it immediately (response envelope shape, auth conventions, error format) while `DEPLOYMENT.md` in particular is more useful closer to the actual production step. | Confirmed by explicit user direction — not an oversight, and not silently dropped from the roadmap; tracked as Phase 10b in §8. |

---

## 10. Change Log

| Date/Phase | Change |
|---|---|
| Phase 0 | Initial `PROJECT_STATE.md` created |
| Pre-Phase 1 (v2) | Added white-label config tier, professional auth, soft delete details, superadmin, impersonation, idempotency, rate limiting; added `settings` domain; roadmap re-sequenced into 10 phases |
| Pre-Phase 1 (v2.1) | Finalized email testing strategy |
| Phase 1 | Full scaffold built |
| Phase 2 | Settings domain + full shared_kernel built. Migration 0001. |
| Phase 3 | Full IAM domain built. Migration 0002. |
| Phase 4 | Full Customers domain built. Migration `0003_add_customers_tables` applied successfully. |
| Post-Phase 4 (ops session) | Diagnosed and fixed `DATABASE_HOST` Docker networking bug. Documented ops guide. |
| Post-Phase 4 (RBAC discussion) | Reviewed full real codebase; found permission codes already 3-part; located `customers:guests:*` bug and missing `Housekeeping` role; locked in wildcard design; inserted **Phase 4.5**. |
| Phase 4.5 (executed) | Implemented hierarchical wildcard resolution. Fixed `seed_data.py` bugs. Found and fixed two unrelated pre-existing test bugs. Full suite green (49/49). |
| v2.3 | Full consolidation of v2.1 and v2.2 into one standalone document. |
| v2.4 | Documented Phase 4.5 as fully complete and verified — code, tests, and the live database confirmed in sync. |
| **Phase 5 (executed)** | **Built the `inventory` domain in full**: 5 models, 5 repositories, 5 schemas, 3 services (incl. `inventory_service.adjust_stock()` as the confirmed single stock-mutation entry point for future domains), 3 API files (4 routers, 16 endpoints). Low-stock alerts fan out to the `"Management"` department via `iam`'s existing service layer only. Migration `0004` applied for real. 8 new permission codes seeded, Admin-only. **Found and fixed a real test-design bug**: 3 tests wrongly assumed the real `"Management"` department starts empty against a live dev DB; rewrote to assert deltas/specific-recipient membership, verified by reproducing the original failure locally first. Full suite green: **60/60**. |
| **Phase 6 (executed)** | **Built the `payments` domain (base)**: 2 models, 2 repositories, 2 schemas, `payment_service.py` (state machine: `pending → paid|failed → refunded`, confirmed hand-off signatures for `create_payment_intent`/`confirm_payment`/`refund_payment`), 1 API router, 7 endpoints. Idempotency confirmed working via the pre-existing global middleware, zero new code. Migration `0005` applied for real. `payments:read`/`payments:write` seeded, Admin-only. **Found and fixed a real routing bug before hand-off**: `/methods` was registered after `/{payment_id}`, which would have shadowed it; reordered and codified the fix as a new Architecture Principle (§3, #13). Full suite green: **81/81**. |
| **Phase 6.5 (executed)** | **Payments follow-up, discussed and scoped collaboratively before implementation** (5 explicit decisions confirmed by the user first — see Open Decision #34). Built the dual-refund architecture (`RefundRequest` model + migration `0006`, `refund_request_service.py`, new `admin_refund_requests.py` router mounted at `/admin/refund-requests`), completed payment method CRUD (`GET`/`DELETE /methods/{id}`; "set-default" explicitly skipped), and added a fully simulated gateway webhook (`POST /payments/webhook`, shared-secret header auth, new `PAYMENTS_WEBHOOK_SECRET` field added to `core/config.py` with a safe default). Permission catalog split further: `payments:method:read`/`write`, `payments:refund:direct`/`request`/`review` — all Admin-only. 21 new unit tests (19 service-layer + 2 real HTTP-layer webhook-signature checks). Full suite green: **102/102**. |
| **v2.7** | Full update covering Phases 5, 6, and 6.5 — every section brought current: domain map, full directory tree (inventory and payments fully expanded from their prior scaffold-only entries), environment variables (`PAYMENTS_WEBHOOK_SECRET` added), conventions (new Architecture Principle #13 on static-before-dynamic route ordering), roadmap (Phases 5/6 marked complete, new Phase 6.5 entry inserted, matching the Phase 4.5 precedent), Open Decisions #31–39 added. Also flagged and corrected: `RBAC_MATRIX.md` had silently remained at its pre-Phase-4.5 content this entire time despite this document claiming otherwise since v2.4 — both documents brought back into sync as of that version. |
| **Phase 7 (executed)** | **Built the `hotel` domain in full**: 8 models, 7 repositories, 8 schema files, 6 services (incl. `invoice_service.pay_invoice()` as the first real cross-domain call into `payment_service`, and `booking_service._verify_guest_exists()` as the first real cross-domain call into `customers.guest_service`), 8 API routers, 32 endpoints. Migration `0007` applied for real against a live Postgres 16 instance running in Docker. 10 new permission codes seeded, split into 5 real read/write resource pairs from the start (no flat `hotel:*` code) — and, breaking the Admin-only pattern every prior new domain had followed since Phase 4.5, `Housekeeping` and `Reception` both received real, scoped, explicitly-verified grants (`Reception`'s `hotel:booking:write` scope was specifically inspected before granting, confirmed to carry no reachable invoice/payment path). **Found and fixed two real pre-existing bugs during live verification**: a second instance of the Phase 4.5 event-loop/pooled-connection bug, this time in `tests/conftest.py`'s `client` fixture (no earlier test file had triggered it); and a genuine permanent database row-leak in the hotel test's own cleanup, confirmed via direct `psql` inspection before and after the fix. **Made two mid-delivery corrections before hand-off**, both at the user's prompting: split `RoomType`'s schemas out of `hotel.py` into their own pre-reserved `room_type.py` file, and relocated the domain's test from `tests/integration/` to `tests/unit/hotel/` to match the precedent Phase 6.5 had already set. Briefly misdiagnosed `alembic.ini`/`pyproject.toml` as missing from the repo (a zip-export artifact, not a real gap) before the real files were provided and swapped in. Full suite verified green: **104/104**, run twice in a row with post-run `psql` checks confirming zero data leakage. |
| **v2.8** | Full update covering Phase 7 — every section brought current: domain map, full directory tree (`hotel` fully expanded from its prior scaffold-only entry — models, repositories, schemas, services, API routers), environment variables (confirmed no new vars needed), conventions (Architecture Principles #4/#9/#13 extended with Phase 7 confirmations, new Architecture Principle #14 on test-client database isolation), roadmap (Phase 7 marked complete with full detail, Phase 8 now "next up"), Open Decisions #38 updated and #40–45 added, and its own Change Log entry. `RBAC_MATRIX.md` (v4) updated in the same unit of work — the exact discipline Phase 4.5→6.5's documentation-drift incident established as mandatory going forward (§8 governance rule 4 in `RBAC_MATRIX.md`). |
| **Phase 8 (executed)** | **Built the `restaurant` domain in full**: 9 models, 7 repositories, 7 schema files, 6 services (incl. `dine_in_order_service._consume_inventory_for_item()` as the first real cross-domain call into `inventory_service.adjust_stock()` since Phase 5, and `menu_service._verify_inventory_item_exists()` as a new cross-domain existence check into `inventory_service.get_item()`), 7 API routers, 33 endpoints. Migration `0008` applied for real against a live Postgres instance. 8 new permission codes seeded, split into 4 real read/write resource pairs from the start (no flat `restaurant:*` code) — `restaurant:table:*` deliberately grouping restaurants/tables/reservations/waiter-assignments as one resource, per the task's exact minimum-split instruction. Continuing the pattern Phase 7 broke, `Waiter` and `Kitchen` both received real, scoped, explicitly-verified grants (`Waiter`: order access + menu-read-only, explicitly no menu-write; `Kitchen`: kitchen-ticket access only, made sufficient by embedding order-item summaries directly onto ticket responses so Kitchen never needs order-read). **Found and fixed one real pre-existing bug from Phase 7**, unrelated to this phase's own scope: `hotel/api/hotels.py` was missing its `envelope` import, a `NameError` waiting to happen, undetected by Phase 7's own tests since they seed data via the repository layer rather than this router. Full suite verified green: **106/106** (104 prior + 2 new), confirmed by the user directly against a live database. |
| **v2.9** | Full update covering Phase 8 — every section brought current: domain map, full directory tree (`restaurant` fully expanded from its prior scaffold-only entry — models, repositories, schemas, services, API routers; `hotel/api/hotels.py`'s entry updated to note the bug fix), environment variables (confirmed no new vars needed), conventions (Architecture Principles #4/#9/#10/#13/#14 extended with Phase 8 confirmations; §7.2 Data Access Layering corrected — earlier versions described a "four-layer pattern" and omitted `schemas/` entirely from the layer table, a real documentation gap since `schemas/` is a genuine fifth folder present in every built domain and does real work; now corrected to the full five-folder pattern with `schemas/` given its own row), roadmap (Phase 8 marked complete with full detail, Phase 9 now "next up"), Open Decisions #38 updated again and #46–49 added, and its own Change Log entry. `RBAC_MATRIX.md` (v5) updated in the same unit of work. |
| **Phase 9 (executed)** | **Built the `delivery` domain in full**: 4 models, 3 repositories (order+items combined per task instruction), 3 schema files, 3 services (incl. `delivery_order_service.place_order()` as the first order/booking-creation flow driven entirely by a customer identity rather than a staff one, and `rider_service.create_rider()` as the first cross-domain existence check into `iam.staff_service.get_staff()` by any domain other than `hotel`), 3 API files/4 routers, 22 endpoints. Migration `0009` applied for real against a live Postgres instance (chain `0007→0008→0009` verified). 5 new permission codes seeded, split into `delivery:order:read/write`, `delivery:rider:read/write`, plus the named exception `delivery:order:update_status` — the exact narrower-than-`write` code the task asked us to "consider," confirmed as a genuine operational need (a Rider progressing only their own assigned deliveries) rather than added speculatively. Continuing the pattern Phases 7 and 8 both broke, `Rider` received a real, scoped, deliberately narrow grant (3 codes — narrower than either `Housekeeping`'s, `Reception`'s, `Waiter`'s, or `Kitchen`'s). **`app.api.v1.deps.require_verified_customer()` — stubbed since Phase 4, never wired to a live endpoint across five intervening phases — finally used for real**, gating `POST /delivery/orders`; this closes out Open Decision #19's delivery-specific half. Two real, deliberate scope decisions flagged rather than silently expanded: Rider self-service availability toggling was not built (a 6th permission code would have been needed beyond the task's explicit minimum), and no payments integration was added for delivery orders (not named in the task's cross-domain scope). No bugs found this session. Full suite verified green: **108/108** (106 prior + 2 new), confirmed by the user directly against a live database. |
| **v2.10** | **Full update covering Phase 9** — every section brought current: domain map, full directory tree (`delivery` fully expanded from its prior scaffold-only entry — models, repositories, schemas, services, API routers; migration and seed_data.py entries added), environment variables (confirmed no new vars needed), conventions (Architecture Principles #4/#9/#10/#13/#14 extended with Phase 9 confirmations — rule 13 in particular now genuinely load-bearing again, the first router since `payments.py` itself where static-before-dynamic ordering wasn't structurally avoided by one-router-per-resource design; §7.3 gained the first worked example combining permission-level scoping with an application-level ownership check), roadmap (Phase 9 marked complete with full detail, Phase 10 now "next up"), Open Decisions #19 and #38 updated, #50–53 added, and this Change Log entry. **Correction made in the same pass**: Architecture Principle #8's Phase 8 note — which had stated migration `0008` was NOT yet applied against a live instance at hand-off — was stale and contradictory with this document's own roadmap/Change Log (which already recorded the user's live confirmation); corrected rather than left silently inconsistent. `RBAC_MATRIX.md` (now v6) updated in the same unit of work. |
| **v2.11 (this version)** | **Partial update covering Phase 10a only** — `reporting` domain fully built and live-verified (dashboard + revenue reports + Excel export), module-toggle mechanism (`require_module_enabled()`, Architecture Principle #15, chosen as Option B over Option A per explicit collaborative sign-off — Open Decision #56) wired into `hotel`/`restaurant`/`delivery`'s router mounts in `api.py`, cross-domain e2e test proving the dashboard correctly aggregates real hotel/restaurant/delivery activity via BEFORE/AFTER deltas, `docker-compose.yml` hardened for production readiness (restart policies, healthchecks, log rotation, resource limits, a newly-wired `nginx` reverse-proxy service), and CORS confirmed correctly configured ahead of upcoming frontend work. Domain map, directory tree, and roadmap all updated to reflect `reporting` as ✅ Built. **Explicitly NOT covered by this version**: five of the six Phase 10 `docs/*.md` deliverables (only `API_CONVENTIONS.md` done) — deliberately resequenced as Phase 10b per the user's explicit direction, tracked in §8, not silently dropped. One new unresolved item flagged rather than fabricated: a live route-count discrepancy (173 measured vs. 177 naively expected) — Open Decision #54. `RBAC_MATRIX.md` (now v7) updated in the same unit of work, per the standing governance rule. |

---

*This document is the authoritative, standalone engineering reference for the IHG Platform API.
It supersedes all prior versions in full — no other version should be consulted alongside it.
This version (v2.11) reflects Phase 10a (reporting domain, module toggles, cross-domain proof,
Compose hardening) as complete and live-verified (114/114 tests passing) — Phase 10b
(documentation) remains explicitly open, tracked in §8, with only `docs/API_CONVENTIONS.md`
delivered so far. `RBAC_MATRIX.md` (v7) is its companion document and has been brought current
in the same session — consult both together.*
