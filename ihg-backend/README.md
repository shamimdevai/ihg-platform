# IHG Platform API

Backend API unifying Hotel, Restaurant, and Food Delivery operations for International
Hospitality Group. White-label by design — see `config/company.yaml` and `docs/
API_CONVENTIONS.md` §5 for the runtime module on/off switches (hotel/restaurant/delivery can
each be independently enabled or disabled per deployment, no redeploy needed).

**Status:** All 9 planned domains built and live-verified — `settings`, `iam`, `customers`,
`inventory`, `payments`, `hotel`, `restaurant`, `delivery`, `reporting`. **114/114 tests
passing.** See `PROJECT_STATE.md` for the exact, current, file-by-file build status.

## Stack
Python 3.11 · FastAPI · SQLAlchemy 2.0 (async) · Alembic · PostgreSQL · Docker Compose

## Local setup

1. Copy the environment template:
   ```
   cp .env.example .env
   ```
   If you're developing a frontend against this API, also set `CORS_ALLOWED_ORIGINS` in `.env`
   to your frontend dev server's origin (comma-separated if more than one, e.g.
   `http://localhost:5173,http://localhost:3000`).

2. Start the stack (API + Postgres + Mailpit, with hot reload):
   ```
   make up
   ```
   or directly: `docker compose up --build`

3. Check the API is up:
   ```
   curl http://localhost:8000/health
   ```

4. Explore and test the API interactively — every endpoint across all 9 domains, with a built-in
   "Authorize" button for bearer tokens:
   ```
   http://localhost:8000/docs
   ```

5. Mailpit web UI (dev email testing — no real emails are ever sent in dev):
   ```
   http://localhost:8025
   ```

Alembic migrations run automatically on container start (`docker/entrypoint.sh`) — the full
chain (`0001` through `0009`) applies cleanly on a fresh database. To run them manually:
`make migrate`. To generate a new migration after changing models:
`make makemigrations m="add something"`.

## Seeding data & creating an admin account

```
docker compose run --rm api python scripts/seed_data.py
docker compose run --rm api python scripts/create_superuser.py \
  --email admin@example.com --password "<strong-password>" \
  --first-name Admin --last-name User
```
`seed_data.py` seeds default roles, permissions (51 codes across all 9 domains), departments,
and runtime settings (including the module toggles above). `create_superuser.py` creates a
staff account with `is_superadmin=true`, which bypasses permission checks entirely — see
`docs/DOCKER_AND_OPERATIONS_GUIDE.md` §10 for the Superadmin-vs-Admin distinction and why
superadmin creation is deliberately not exposed as an API endpoint.

## Project structure

Domain-driven modular monolith:
```
app/domains/<domain>/{models, repositories, services, schemas, api}/
```
Each domain owns its own data, business rules, and endpoints; cross-domain calls only ever go
through another domain's `services/` layer, never its `models`/`repositories` directly. See
`PROJECT_STATE.md` for the full directory structure, conventions, and phase-by-phase roadmap —
that file is the living source of truth for the build.

## Documentation

| Document | Covers |
|---|---|
| `PROJECT_STATE.md` | The living engineering source of truth — exact build status, environment config, roadmap, open decisions. Read this first if anything below seems out of date. |
| `RBAC_MATRIX.md` | The exact, verified permission catalog and which endpoint requires which permission code. |
| `docs/API_CONVENTIONS.md` | Response envelope shape, auth (staff vs. customer), error codes, module-toggle behavior, pagination status — start here if you're building a frontend or any external client. |
| `IHG_Architecture.md` | Why the system is designed the way it is (staff/customer separation, domain-driven structure). |
| `IHG_Traceability.md` | Every client proposal requirement mapped to exactly where it's addressed in the system. |
| `IHG_WhiteLabel_Auth_PlatformOps.md` | White-label config design, auth hardening detail, superadmin/impersonation/audit mechanics. |
| `docs/DOCKER_AND_OPERATIONS_GUIDE.md` | Day-to-day commands, local troubleshooting, DB access, testing walkthroughs — the practical companion to this README. |

`docs/ARCHITECTURE.md`, `docs/PROPOSAL_TRACEABILITY.md`, `docs/WHITE_LABEL_GUIDE.md`,
`docs/USER_MANUAL.md`, and `docs/DEPLOYMENT.md` are still empty placeholders inside this repo's
own `docs/` folder — the underlying content mostly already exists in the standalone companion
docs listed above (`IHG_Architecture.md`, `IHG_Traceability.md`,
`IHG_WhiteLabel_Auth_PlatformOps.md`); copying it in is a tracked, known-open item, not a gap in
the work itself.

## Common commands

| Command | Purpose |
|---|---|
| `make up` | Build and start API + Postgres + Mailpit |
| `make down` | Stop the stack |
| `make migrate` | Apply Alembic migrations |
| `make makemigrations m="msg"` | Generate a new Alembic migration |
| `make seed` | Seed default roles, permissions, departments, and settings |
| `make test` | Run the pytest suite (114 tests) |
| `make lint` | Run black / isort / mypy checks |

On Windows PowerShell, `make` isn't available by default — use the raw `docker compose`
equivalents instead; see `docs/DOCKER_AND_OPERATIONS_GUIDE.md` §5 for the full command reference.

## Running tests

```
docker compose run --rm api pytest
```
Runs the full suite (114 tests) against a real Postgres instance, migrations applied
automatically first. Run a single file or test with:
```
docker compose run --rm api pytest tests/unit/hotel/test_hotel_booking_flow.py -v
```

## White-label / module toggles

- **Static branding** (name, logo, colors, currency, etc.): edit `config/company.yaml`, restart
  the stack.
- **Business-line on/off switches** (hotel / restaurant / delivery, independently): change via
  the API (`PUT /api/v1/settings/{hotel,restaurant,delivery}_module_enabled`, requires
  `settings:write`) — takes effect on the very next request, **no restart needed**. A disabled
  module's routes all return `404`. See `docs/API_CONVENTIONS.md` §5.

## Production

`docker-compose.yml` now includes production-hardening (restart policies, healthchecks, log
rotation, resource limits, and an `nginx` reverse proxy wired to `docker/nginx/nginx.conf`).
Production uses only the base file — no override file, no Mailpit:
```
docker compose -f docker-compose.yml up -d --build
```
Point `SMTP_HOST`/`SMTP_PORT` at a real provider (Gmail/SendGrid/SES) via `.env` — no code
changes are needed to move from dev to prod email delivery.

**Before deploying to production**, note two open items tracked in `PROJECT_STATE.md`: the
checked-in `.env` still carries `PAYMENTS_WEBHOOK_SECRET` on its default value (rotate this), and
secrets generally should move out of plaintext `.env` into a real secrets manager. `docs/
DEPLOYMENT.md` — a fuller, dedicated deployment guide — is still an open item, deliberately
deferred until closer to the actual production step.
