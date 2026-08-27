# IHG Frontend — Progress Log

This is the per-session, file-level working log for the `ihg-frontend`
repo. It belongs at `docs/PROGRESS.md` inside that repo. Paste the
relevant completed section(s) into every new session alongside the
Global Context Prompt and that phase's Brief (see
`IHG_Frontend_Master_Prompt.md`). For the higher-level architecture
snapshot (decisions, RBAC status, flagged requirements), see the
companion `IHG_Frontend_PROJECT_STATE.md` instead — keep that one
updated separately, roughly every few phases rather than every session.

---

## Locked-in decisions
- Stack: React 18 + Vite, Tailwind, React Router v6, React Query,
  Zustand, Axios (two instances — `staffClient`, `customerClient`),
  React Hook Form + Zod, Recharts (Phase 23+ only)
- UI foundation: shadcn/ui (Radix primitives + Tailwind), added Phase 4.
  Treated as project-owned code, not an external dependency — customize
  freely. PascalCase filenames throughout (deviates from shadcn's own
  lowercase default). Requires the `@` → src path alias
  (`vite.config.js` + `jsconfig.json`) and `src/lib/utils.js`'s `cn()`
  helper.
- Two route trees: `/admin` (staff portal), `/shop` (customer storefront)
- **Single-entrypoint nginx architecture** — browser only ever talks to
  nginx, in dev AND prod. `frontend`/`api` are never published to the
  host, only `expose`d. Axios `baseURL` is the relative path `/api/v1`
  everywhere — no `VITE_API_BASE_URL`, no CORS config needed.
- `ihg-frontend` is a separate git repo, checked out as a sibling of
  `ihg-backend` (Compose files live in `ihg-backend`, reference this
  repo via `../ihg-frontend`)
- Brand theme sourced live from `GET /config` at app bootstrap; navy
  `#1F3A5F` / red `#FF2147` used only as the pre-fetch fallback

---

## Completed

### 0. Scaffolding + Docker — [x] complete, confirmed
Files: `package.json`, `vite.config.js`, `tailwind.config.js`,
`postcss.config.js`, `src/index.css`, `src/main.jsx`, `src/App.jsx`,
`src/api/{staffClient,customerClient}.js`, `Dockerfile(.dev)`,
`.dockerignore` (ihg-frontend) + `docker-compose.yml`/`.override.yml`,
`docker/nginx/nginx(.dev).conf` (ihg-backend). Confirmed working: single
entrypoint enforced (`:8000`/`:5173` unreachable from host), hot reload
survives the nginx proxy. Two gaps found post-build and fixed: Swagger/
ReDoc needed their own nginx `location` blocks (backend serves them
unprefixed, not under `/api/v1`); the frontend's own prod nginx layer
needed a `try_files` SPA fallback (new `ihg-frontend/nginx.conf`).

### 1. `/config` bootstrap — [x] complete, confirmed
Files: `src/api/configApi.js`, `src/store/appConfigStore.js`,
`src/hooks/useAppConfig.js`, modified `src/App.jsx`. Real response shape
confirmed FLAT — `company_name`, `logo_url`, `primary_color`,
`secondary_color`, `currency`, `timezone`, `locale`, `footer_text` — NOT
the nested `branding`/`enabledModules` structure originally assumed;
store spreads the whole response rather than destructuring named keys.
Module-toggle key convention confirmed: `` `${module}_module_enabled` ``
(only present after `scripts/seed_data.py` has run) —
`isModuleEnabled()` defaults to `true` when the key is absent.

### 2. Staff auth — [x] complete, confirmed
Files: `src/api/staff/iamAuthApi.js`, `src/utils/permissions.js`,
`src/store/staffAuthStore.js`, `src/hooks/{useStaffAuth,usePermission}.js`,
modified `src/api/staffClient.js` (real token interceptor),
`src/routes/StaffProtectedRoute.jsx`, `src/features/staff/auth/*Form.jsx`,
`src/pages/staff/{Login,ForgotPassword,ResetPassword,AcceptInvite}Page.jsx`.
Confirmed: `POST /iam/auth/login` returns tokens only — role/permissions
come from a separate `GET /iam/auth/me`, which required a backend patch
(tracked as backlog item 15). `ResetPasswordPage` added — was missing
from the original page list despite `ResetPasswordForm` being required.
401-refresh interceptor deliberately deferred (backlog item 6).

### 3. Customer auth — [x] complete, confirmed
Files: `src/api/customer/authApi.js`, `src/store/customerAuthStore.js`,
`src/hooks/useCustomerAuth.js`, modified `src/api/customerClient.js`,
`src/routes/CustomerProtectedRoute.jsx`,
`src/features/customer/auth/*Form.jsx` + `VerifyEmailNotice.jsx`,
`src/pages/customer/{Register,Login,VerifyEmail,ForgotPassword,
ResetPassword}Page.jsx`. Confirmed: `register` does NOT auto-login
(returns a profile snapshot, not tokens) — real flow is register →
verify-email → login, three distinct steps. No customer "me" endpoint
exists anywhere (backlog item 7) — `user` stays `null` after login,
`isAuthenticated` derived from token presence only.
`ForgotPasswordPage`/`ResetPasswordPage` added — both missing from the
original page list.

### 4. Shared UI kit — [x] complete, confirmed
Files: `jsconfig.json`, `components.json`, `src/lib/utils.js`, modified
`vite.config.js` (`@` alias) + `tailwind.config.js` + `src/index.css`
(shadcn tokens), ~20 files under `src/components/ui/` (Button, Input,
Select, Dialog+Modal, Table, Toast+ToastProvider, StatusBadge, etc.),
`src/components/layout/{Navbar,Sidebar,PageHeader}.jsx`,
`src/components/RouteComingSoon.jsx`, modified `src/main.jsx`
(`ToastProvider` wrap). Decision: shadcn/ui (Radix + Tailwind) adopted
as the `components/ui/` foundation, treated as project-owned code —
PascalCase filenames throughout (deviates from shadcn's own lowercase
default). `Table` uses a `columns`+`data` props API, not children
composition — every later list screen builds against this shape.

### 5. Staff portal shell — [x] complete, all decisions confirmed
Files: `src/utils/navConfig.js`, `src/layouts/StaffLayout.jsx`, modified
`src/components/layout/Sidebar.jsx` (heading-group support added this
phase), `src/features/staff/dashboard/DashboardHome.jsx`,
`src/pages/staff/DashboardPage.jsx`, `src/routes/staffRoutes.jsx`,
modified `src/App.jsx` (mounted `StaffRoutes` for real, replacing the
Phase 0/1 placeholder). Delivery nav gating (rider:write for dispatch/
riders screens, order:update_status for My Deliveries) confirmed
correct — deliberately avoids delivery:order:read since Rider also
holds that code. Generic RouteComingSoon.jsx approach confirmed as the
standing pattern for all future reserved routes through Phase 30
(first built this phase at `src/pages/staff/RouteComingSoon.jsx`,
relocated in Phase 6 — see below).

### 6. Customer portal shell — [x] complete, confirmed
Files: `src/components/RouteComingSoon.jsx` (relocated here from
`src/pages/staff/`, old copy deleted by user), modified
`src/routes/staffRoutes.jsx` (import path updated to match),
`src/layouts/CustomerLayout.jsx`, `src/routes/customerRoutes.jsx`,
modified `src/App.jsx` (mounted `CustomerRoutes` for real). All four
decisions confirmed as-is: RouteComingSoon relocated to shared
components/, Cart/Checkout reserved but excluded from top nav, "My
Orders" → Order History, "My Account" generic label pending Phase 29's
profile fetch.

### 7. IAM: staff management — [x] complete, confirmed
Files: `src/api/staff/iamStaffApi.js` (listStaff, getStaff, createStaff,
updateStaff, deactivateStaff, resendInvite), `src/features/staff/iam/
staff/{StaffList,StaffForm,InviteStaffModal}.jsx`, `src/pages/staff/iam/
StaffPage.jsx`, modified `src/routes/staffRoutes.jsx` (`iam/staff` route
now renders StaffPage instead of RouteComingSoon). Confirmed gating:
`iam:staff:read` (Admin/Manager/Reception — list/view) vs
`iam:staff:write` (Admin-only — create/edit/deactivate/resend-invite),
matching RBAC_MATRIX v7 §5.1 exactly; enforced client-side via
`usePermission('iam:staff:write')` around every write control, not by
convention. Nav item in `navConfig.js` was already correctly gated from
Phase 5 — not touched.

Ahead-of-phase addition (pre-approved): `src/api/staff/iamRolesApi.js`
and `src/api/staff/iamDepartmentsApi.js` (both previously empty stubs)
each got ONE read-only function — `listRoles()` / `listDepartments()` —
just enough for StaffForm's role/department dropdowns and StaffList's
name lookups. Full CRUD for both still belongs to Phases 8/9 — don't
assume more exists in these files than that single read call.

Decisions made: "invite" splits into two things — creating a staff
account (`POST /iam/staff`) auto-sends the first invite per RBAC_MATRIX
§7 (no separate first-invite endpoint exists), while InviteStaffModal
is specifically for RESENDING via `POST /iam/staff/{id}/invite`. Edit
mode hides the email field entirely (`PUT /iam/staff/{id}`'s schema has
no email field — not editable). Deactivate button hides once
`is_active` is already false — no reactivate endpoint was given, so
there's no in-app path back to active (flagged as a known gap, not a
Bucket B ambiguity — nothing in the client proposal implies one should
exist here). `department_id` uses a `"none"` sentinel value in the form
(Radix Select rejects an empty-string value), converted to `null`
before the API call.

### 8. IAM: Roles & Permissions — [x] complete, with one confirmed backend dependency
Files: `src/api/staff/iamRolesApi.js`, `iamPermissionsApi.js`,
`src/features/staff/iam/roles/{RolesList,RoleForm,PermissionAssignment}.jsx`,
`src/pages/staff/iam/RolesPage.jsx`, modified `src/routes/staffRoutes.jsx`
(`iam/roles` route only). Roles list/create/edit + live permission
assignment (checkboxes sourced from `GET /iam/permissions`, grouped by
domain) all working. Role holding the `*` wildcard (Admin, or any future
custom super-role) is shown "Protected" and locked from edit/permission
changes, to prevent lockout. **Role DELETE deliberately not built** — no
`DELETE /iam/roles/{role_id}` endpoint exists yet; confirmed as a real
backend addition to come (owner's decision, not a scope cut), tracked
below and in backlog item (17). Manager-visibility question resolved:
nav/route stays gated by `iam:roles:read` (Manager holds it), all write
actions gated by `iam:roles:write` (Admin-only) — confirmed dynamic,
permission-based not role-hardcoded (owner verified this by design:
Admin can toggle `iam:roles:read` on/off Manager's own role through this
same UI). Assign-permissions endpoint assumed additive (diffed
client-side against a single-id remove call) — not yet confirmed against
real backend behavior, owner accepted this as provisional.

### 9. IAM: departments + impersonation — [x] complete, confirmed
Files: `src/api/staff/iamDepartmentsApi.js` (extended — listDepartments()
unchanged from Phase 7, added getDepartment/createDepartment/
updateDepartment), `src/api/staff/iamImpersonationApi.js`,
`src/features/staff/iam/departments/{DepartmentsList,DepartmentForm}.jsx`,
`src/pages/staff/iam/DepartmentsPage.jsx`,
`src/features/staff/iam/impersonation/{ImpersonateModal,
ImpersonationBanner}.jsx`, `src/store/impersonationStore.js`, modified
`src/routes/staffRoutes.jsx` (iam/departments route only), modified
`src/features/staff/iam/staff/StaffList.jsx` (Impersonate row action,
gated independently by is_superadmin per RBAC_MATRIX §7 — not folded
into iam:staff:write), modified `src/layouts/StaffLayout.jsx`
(ImpersonationBanner wired in unconditionally + stop-on-logout),
modified `src/api/staffClient.js` (interceptor prefers the impersonation
token while active) and `src/hooks/useStaffAuth.js` (`user` resolves to
the impersonated identity while active; `realUser`/`isImpersonating`
exposed separately) — both required for impersonation to actually affect
API calls and permission checks, not just display a banner; approved
explicitly before implementation.

Impersonation session state lives in its own store
(`impersonationStore.js`), persisted to sessionStorage only — survives a
page refresh, never a browser/tab close or logout (explicitly cleared in
StaffLayout's logout handler). staffAuthStore.js itself was NOT modified.

Decisions confirmed: department DELETE deliberately not built — no
`DELETE /iam/departments/{id}` endpoint exists; tracked as backlog,
mirrors Phase 8's role-delete gap (see below). An earlier standalone
`ImpersonationPage.jsx` (manual target-ID entry, built before Phase 7's
real StaffList.jsx was available) was retired once the real Impersonate
row-action was wired into StaffList — deleted, along with its nav item
and route.

### 10. Customers/guests (staff side) — [ ] not started
### 11. Inventory — [ ] not started
### 12. Payments (admin review) — [ ] not started
### 13. Hotel: rooms & room types — [ ] not started
### 14. Hotel: bookings/check-in/out (+ Flag #1 banner) — [ ] not started
### 15. Hotel: housekeeping board — [ ] not started
### 16. Hotel: invoices & real payment flow — [ ] not started
### 17. Restaurant: tables & reservations (+ Flag #2 banner) — [ ] not started
### 18. Restaurant: menu management — [ ] not started
### 19. Restaurant: dine-in orders & billing (+ Flag #3 banner) — [ ] not started
### 20. Restaurant: kitchen ticket board — [ ] not started
### 21. Delivery: orders, riders, dispatch — [ ] not started
### 22. Delivery: rider's own view — [ ] not started
### 23. Reporting: dashboard widgets — [ ] not started
### 24. Reporting: revenue report + Excel export — [ ] not started
### 25. Settings: branding + module toggles — [ ] not started
### 26. Storefront: menu browsing + cart — [ ] not started
### 27. Storefront: delivery checkout — [ ] not started
### 28. Storefront: order tracking + history — [ ] not started
### 29. Storefront: addresses + profile — [ ] not started
### 30. Cross-cutting polish pass — [ ] not started

*As each phase completes, replace its `[ ] not started` line with a
short summary: which files were created/modified, any exact enum values
or field names confirmed from the real schema, any decisions the phase
brief left open that got resolved (e.g. Phase 26's cart pattern choice,
Phase 16's confirmed invoice-access role). Keep it brief — a few lines,
not a full diff.*

---

## In progress / next up
- [ ] Phase 10 - Customers/guests (staff side)

---

## Open Questions for Product Owner
*(flagged, NOT silently dropped — resolve these with the
client/instructor before final submission)*
- [ ] **(1) Hotel guest self-booking** — proposal implies guests can book
      directly; backend only supports staff-created bookings. Confirm:
      is staff-only booking acceptable, or does this need a backend
      change before frontend can build it? Flagged in-app at Phase 14.
- [ ] **(2) Customer-facing restaurant table reservation** — proposal's
      Restaurant process starts with "customer reserves table"; backend
      reservation endpoints are staff-only. Confirm: is staff-taken
      reservation acceptable, or does this need a customer-facing
      endpoint added? Flagged in-app at Phase 17.
- [ ] **(3) Restaurant bill/payment processing** — `bill` endpoint marks
      status only, doesn't create a real Payment record like hotel
      invoices do. Confirm: is "marked billed" sufficient, or is real
      payment processing required for restaurant too? Flagged in-app at
      Phase 19.
- [ ] **(4) Instant in-app alerts** — listed as a Shared Feature in the
      proposal; no notification list/read endpoint exists in the API.
      Confirm: was this deprioritized, or does it need a backend
      endpoint before frontend can build it? Flagged in-app at Phase 5
      — `PendingFeatureBanner` is live in `StaffLayout.jsx`; the
      underlying backend gap is still open, only the frontend
      acknowledgment is done.

---

## Resolved
- [x] (5) Module-toggle settings key naming convention — CONFIRMED as
      `${module}_module_enabled` (e.g. `hotel_module_enabled`,
      `restaurant_module_enabled`, `delivery_module_enabled`), matching
      appConfigStore.isModuleEnabled()'s implementation exactly. These
      keys only populate after `scripts/seed_data.py` has run on a given
      backend (see settings_service.py DEFAULT_SETTINGS) — the store's
      default-enabled-when-absent behavior correctly covers this pre-seed
      window, not an unconfirmed naming guess. No code changes needed.
- [x] (8) Settings nav visibility — CONFIRMED: settings:read-based gating
      is correct and stays. Manager sees the Settings nav item because
      RBAC_MATRIX v7 grants Manager settings:read, overriding the Master
      Prompt Phase 25 brief's looser "Admin only" description. Exact
      Manager-facing screen behavior (read-only vs. excluded) is
      explicitly deferred to Phase 25, not decided now.
- [x] (9) Reception + iam:staff:read — CONFIRMED intentional. Reception
      sees the Staff nav item because RBAC_MATRIX v7 explicitly grants
      this. Permission-driven gating stays as the rule; no hardcoded
      role exceptions.
- [x] (10) Inventory access (was open, ex-Phase 11 item below) — CONFIRMED
      Admin-only via RBAC_MATRIX v7 §5.1/§5.2. No Manager/Housekeeping/
      Waiter/Kitchen grant exists or is planned; revisit only if a
      concrete operational need is identified.
- [x] (11) Restaurant table/reservation write access (was open, ex-Phase
      17 item below) — CONFIRMED Admin-only. `restaurant:table:write` —
      Waiter does NOT hold it (holds only `restaurant:order:*` +
      `restaurant:menu:read`).
- [x] (12) Restaurant menu write access (was open, ex-Phase 18 item
      below) — CONFIRMED Admin-only. `restaurant:menu:write` — Waiter
      explicitly holds `restaurant:menu:read` but NOT the write code,
      "without menu-editing rights" per the task spec verbatim.
- [x] (13) Delivery dispatch/rider management access (was open, ex-Phase
      21 item below) — CONFIRMED Admin-only. `delivery:rider:write` —
      Rider does NOT hold it (Rider's grant is `delivery:order:read` +
      `delivery:order:update_status` + `delivery:rider:read` only).
      IMPLEMENTATION NUANCE for whoever builds Phase 21: gate the
      "Orders & Dispatch"/"Riders" screens by `delivery:rider:write`,
      NOT `delivery:order:read` — Rider also holds `delivery:order:read`
      (for their own delivery visibility), so gating by that code would
      incorrectly expose the full dispatch screen to Rider. Already
      applied this way in Phase 5's `navConfig.js`; repeat the same
      code choice in Phase 21's actual route guard.
- [x] (14) Hotel invoice/payment access (was open, ex-Phase 16 item
      below) — CONFIRMED Admin-only. `hotel:invoice:*` — confirmed via a
      real HTTP test rejecting Reception (403), closing the "who is,
      isn't confirmed" gap this was previously left open with.

---

## Backlog — must resolve before production
- [ ] (6) Automatic 401 → refresh-token interceptor — deferred at
      Phase 2 by explicit decision, confirmed still deferred at Phase 3.
      Applies identically to BOTH `staffClient` and `customerClient`.
      Currently: a 401 from any authenticated endpoint just fails the
      request; the user stays "logged in" client-side (token still in
      store) but every subsequent call keeps 401ing until they manually
      log out/in. No refresh-token exchange, no request retry, no
      forced-logout-on-refresh-failure exists yet.
      Needs, when implemented (build once, share the retry/queue logic
      between both clients rather than duplicating it): (a) on 401,
      attempt the relevant refresh endpoint (`POST /iam/auth/refresh` or
      `POST /customers/auth/refresh`) using the stored refresh_token;
      (b) on success, update the stored access_token and retry the
      original failed request once; (c) on refresh failure (expired/
      revoked refresh token), clear the relevant auth store entirely and
      redirect to the matching login page — don't leave a stale user
      object behind; (d) guard against a refresh stampede — if multiple
      requests 401 simultaneously, only one refresh call should fire,
      the rest should queue and retry once it resolves.
      Target: before production, not tied to a specific phase number in
      the roadmap — raise this explicitly before Phase 30's polish pass
      at the latest.
- [ ] (7) Customer profile is never fetched after login (Phase 3) — no
      "me" equivalent exists in customer-auth, unlike staff's patched
      /iam/auth/me. customerAuthStore.user stays null after a successful
      login; only accessToken/refreshToken are populated. Phase 29
      (customer-profile tag, GET /customers self-profile) needs to
      either (a) call a profile-fetch on login success going forward, or
      (b) have every consumer of `user` handle null gracefully
      indefinitely. Decide explicitly at Phase 29, don't let it stay an
      implicit gap into Phase 6's CustomerLayout build.
- [ ] (15) `GET /iam/auth/me` requires a backend patch to exist at all
      (Phase 2) — staff login only returns tokens; role/permissions come
      from this separate endpoint, which was NOT part of the original
      backend spec and needed a patch applied to work. This isn't a
      frontend gap, but it's a real standing dependency: before assuming
      staff nav-gating/hasPermission() will work on any NEW backend
      instance (fresh clone, different environment, etc.), confirm the
      patch has actually been applied there. If it hasn't, login will
      succeed but the follow-up profile fetch will fail and no role/
      permissions will ever populate.

- [ ] (16) Permission/role changes require re-login to take effect — no
      live re-fetch (discovered Phase 8). `hasPermission()` reads off
      `user.role.permissions`, populated once at login via
      `GET /iam/auth/me` and cached in `staffAuthStore` (persisted to
      localStorage). If an Admin edits a role's permissions via Phase
      8's PermissionAssignment UI (e.g. revoking `iam:roles:read` from
      Manager) while a staff member with that role is actively logged
      in, their client-side nav/route access does NOT update until they
      log out and back in — nothing currently triggers a re-fetch of
      `/iam/auth/me` mid-session. Same class of staleness as backlog
      item (6)'s 401-refresh gap, but a different trigger (a permission
      grant changing server-side, not a token expiring). Needs, when
      addressed: either (a) a manual "refresh my permissions" action
      surfaced somewhere in the staff UI, (b) a periodic background
      re-fetch of `/iam/auth/me`, or (c) some server-push mechanism —
      none currently exist or are assumed. Target: before production,
      not tied to a specific phase number — raise explicitly before
      Phase 30's polish pass, same as item (6).

- [ ] (17) `DELETE /iam/roles/{role_id}` does not exist yet (Phase 8) —
      confirmed, deliberate: owner will add this endpoint (including the
      delete/dependency behavior — e.g. what happens if a role is still
      assigned to staff — and the matching RBAC_MATRIX update) in a
      separate backend session. NOT a frontend gap or an open question
      for the product owner — the decision to build it is already made,
      this is purely "not built yet." When the real endpoint, response
      shape, and error behavior are provided, integrate: a `deleteRole()`
      call in `iamRolesApi.js`, a Delete button in `RolesList.jsx`
      (disabled for protected/`*`-holding roles, same as Edit/Manage
      Permissions), and a `ConfirmDialog` confirmation step. Target:
      whenever the backend session delivers it — not tied to a specific
      frontend phase number.

- [ ] (18) `DELETE /iam/departments/{department_id}` does not exist yet
      (Phase 9) — confirmed deliberate, same pattern as backlog item (17)
      (role delete). Not a frontend gap or open product-owner question.
      Integrate a `deleteDepartment()` call + Delete button + ConfirmDialog
      once the real endpoint is provided.


---

## Known gaps — cleanly out of scope, NOT ambiguous, no flag needed
- No customer self-service for hotel or dine-in restaurant *ordering*
  (as opposed to table *reservation*, which IS flagged above) —
  staff-only, by design, matches the proposal's own business process
- No pagination on list endpoints yet — using client-side/load-more
- No public unauthenticated menu browsing — customer must log in first

## Delivery customer self-service — confirmed required, fully built
- Not ambiguous, not flagged — explicit client requirement with real
  working endpoints. Status: pending (Phases 26–28)

---

## RBAC — ✅ all previously-open items now RESOLVED
This section used to list 5 permission grants as "unconfirmed, verify
before building." All 5 are now resolved via RBAC_MATRIX v7 — see
**Resolved items (10)–(14) above** for the confirmed answer to each
(inventory, restaurant table-write, restaurant menu-write, delivery
dispatch, hotel invoice access — all Admin-only). Kept as a section
header only so a search for "RBAC" still lands somewhere useful; the
stale "don't assume, go verify" framing that used to live here has been
removed since it's no longer accurate.

---

## Notes for next session

- RouteComingSoon.jsx moved from src/pages/staff/ to src/components/ at
  Phase 6 — shared between staffRoutes.jsx and customerRoutes.jsx now.
  Confirm the old file was deleted from the repo.
- Customer nav shows generic "My Account" instead of a name — no
  customer "me" endpoint exists yet (Phase 3 backlog item #7). Revisit
  this nav label once Phase 29 adds a profile fetch.
- `AuthLayout.jsx` was never actually built despite being listed in the
  original §1A folder skeleton — each auth page (staff and customer,
  Phases 2/3) inlined its own centered-card wrapper markup instead of
  sharing one layout component. Still a valid future consolidation
  (would deduplicate the wrapper markup across ~9 pages) but don't
  assume the file exists.
- Three Docker/infra gaps were found after the first real Phase 0 build
  and are now fixed (full detail in Master Prompt §5A, summarized in
  PROJECT_STATE §2.4): (1) Swagger/ReDoc/openapi.json needed their own
  nginx `location` blocks since the backend serves them unprefixed, not
  under `/api/v1`; (2) the frontend's own prod nginx layer needed a
  `try_files` SPA fallback (`ihg-frontend/nginx.conf`), or a hard
  refresh on a real client route would 404; (3) new npm packages must be
  installed via `docker compose exec frontend npm install <pkg>`, not
  on the host — the `frontend` service's anonymous `node_modules`
  volume isolates it from the host's copy.
- iamRolesApi.js and iamDepartmentsApi.js are no longer empty stubs —
  each holds exactly one read-only list function, added early for
  Phase 7's dropdowns. Phase 8 should EXTEND iamRolesApi.js (add create/
  update/permission-assignment calls), not recreate it. Phase 9 should
  extend iamDepartmentsApi.js the same way.
- `PermissionAssignment.jsx` (Phase 8) uses the raw `Dialog`/`DialogContent`
  primitives directly, NOT the shared `Modal.jsx` wrapper — needed a wider
  `max-w-2xl` container for the checkbox list and `Modal` doesn't expose a
  className override. If a future phase needs a wide dialog too, follow
  this same pattern (import from `@/components/ui/Dialog` directly) rather
  than modifying `Modal.jsx` itself — that's shared Phase 4 infrastructure,
  changing it needs explicit sign-off first.
- `isProtectedRole(role)` (role holds the `*` wildcard) lives in
  `RolesList.jsx` and is exported from there — `PermissionAssignment.jsx`
  imports it rather than duplicating the check. If a future phase needs
  the same "is this a super-role" check elsewhere, import it from
  `RolesList.jsx`, don't reimplement it inline.
- Confirmed working as of Phase 8: Admin can toggle `iam:roles:read`
  on/off the *Manager* role itself via the Manage Permissions UI, and
  RolesList/PermissionAssignment have zero role-name-specific logic — the
  nav-gating rule ("permission-based, never hardcoded by role") is
  genuinely live, not just aspirational. Useful precedent to point to if
  a future phase is tempted to hardcode a role check "just this once."
- `iamRolesApi.js` has no `deleteRole` — confirmed, deliberate, backend
  dependency (see backlog item 17). Don't add a delete button to
  `RolesList.jsx` speculatively before that endpoint exists.
- Phase 7's real files (`iamStaffApi.js`, `StaffList.jsx`, `StaffForm.jsx`,
  `InviteStaffModal.jsx`, `StaffPage.jsx`) were confirmed built in a
  separate session but are NOT present in the currently-uploaded zip
  snapshot (all 0 bytes) — `staffRoutes.jsx`'s `iam/staff` route may still
  show `RouteComingSoon` in what gets pasted next session. If a future
  phase needs to extend those files, ask for the real versions first
  rather than assuming the zip reflects them.
- Phase 9's impersonation feature required two small, approved additions
  to Phase 2 core files — `staffClient.js`'s request interceptor now
  checks `impersonationStore` before falling back to `staffAuthStore`'s
  own token, and `useStaffAuth.js`'s `user` now resolves to the
  impersonated identity while active (`realUser`/`isImpersonating`
  exposed separately for anything that needs the REAL logged-in
  account — e.g. ImpersonationBanner, StaffList's self-impersonation
  guard). `staffAuthStore.js` itself was deliberately never touched —
  impersonation state lives entirely in the new `impersonationStore.js`,
  persisted to sessionStorage only. If a future phase adds its own
  "current user" logic, use `useStaffAuth()`'s `user`, not
  `useStaffAuthStore` directly, or it'll silently ignore impersonation.
- Known edge case, not yet hardened: if a superadmin's browser tab is
  force-closed mid-impersonation (crash, not "Stop impersonating"),
  `impersonationStore`'s sessionStorage clears correctly, but
  `staffAuthStore`'s localStorage may still hold the impersonation
  token as the "current" one — reopening the tab could silently resume
  as the impersonated identity with no banner. Flagged to product
  owner, not addressed this session.
- `iamDepartmentsApi.js` — Phase 7's real `listDepartments()` confirmed
  unchanged and extended (not recreated) with `getDepartment`/
  `createDepartment`/`updateDepartment`. Same file, same export, no
  breaking change for `StaffForm.jsx`'s existing usage.
- `ImpersonateModal.jsx` is confirm-only, no manual target-entry form —
  it requires a `staff` prop (the target staff record) and always
  impersonates `target_type="staff"`. There is no reachable path that
  calls it without a known staff record, by design. If a future backend
  phase adds a second impersonable target type, this component will
  need a real UI decision then, not a speculative one now.
- `ImpersonationPage.jsx` (built as a temporary stopgap earlier this
  session, before the real `StaffList.jsx` was available) was deleted
  once the row-level "Impersonate" action was wired into `StaffList`.
  Its route (`iam/impersonation`) and nav item were both removed —
  confirm neither is referenced anywhere else if a future phase touches
  routing/nav again.
- Department `DELETE` doesn't exist (backlog item 18) — same shape as
  role delete (item 17). Don't add delete UI to `DepartmentsList.jsx`
  speculatively before that endpoint exists, same rule as `RolesList.jsx`.
- `iamStaffApi.js`'s `listStaff()` response was confirmed this session
  to carry NO `is_superadmin` field on staff rows — only the currently
  logged-in account's own `is_superadmin` is knowable client-side (via
  `useStaffAuth().realUser`). Don't assume a future phase can filter or
  badge staff rows by that field without a backend response-shape change.