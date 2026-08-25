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

### 0. Scaffolding + Docker — [ ] not started
### 1. `/config` bootstrap — [ ] not started
### 2. Staff auth — [ ] not started
### 3. Customer auth — [ ] not started
### 4. Shared UI kit — [ ] not started
### 5. Staff portal shell (+ Flag #4 banner) — [ ] not started
### 6. Customer portal shell — [ ] not started
### 7. IAM: staff management — [ ] not started
### 8. IAM: roles & permissions — [ ] not started
### 9. IAM: departments + impersonation — [ ] not started
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
- [ ] Phase 0 — Scaffolding + Docker

---

## Open Questions for Product Owner (flagged, NOT silently dropped —
## resolve these with the client/instructor before final submission)
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
      endpoint before frontend can build it? Flagged in-app at Phase 5.

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

## RBAC — unconfirmed grants to verify before building (don't assume)
- Inventory access (Phase 11)
- Restaurant table/reservation write access (Phase 17)
- Restaurant menu write access (Phase 18)
- Delivery dispatch/rider management access (Phase 21)
- Hotel invoice/payment access (Phase 16 — confirmed NOT Reception, exact
  role still unconfirmed)

*Check off / replace with the confirmed permission code once verified
against the real `RBAC_MATRIX.md` or OpenAPI slice during that phase.*

---

## Notes for next session

*(Empty — fill in anything non-obvious the previous session decided:
exact enum string values confirmed from real responses, the chosen cart
pattern, which repo layout was actually used, workarounds, anything
intentionally left unstyled, etc. This is what lets a fresh AI account
pick up exactly where the last one left off.)*
