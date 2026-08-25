"""Shared pytest fixtures.

`client`: async HTTP client bound directly to the FastAPI app (no real network calls).
`db_session`: a real AsyncSession against the configured DATABASE_URL, wrapped so every
test's writes are rolled back on teardown. Requires migrations to already be applied
(`alembic upgrade head` — done automatically by docker/entrypoint.sh). Auth token
fixtures (staff/customer) are added once the iam and customers domains exist
(Phase 3/4) per PROJECT_STATE.md's tests/conftest.py plan.

Uses a DEDICATED test-only engine with NullPool (see db_session below) rather than
importing app.db.connection.engine directly — see that fixture's docstring for why.
Fixed Phase 4.5: this was the root cause of every test after the first DB-writing one
failing with cascading asyncpg "attached to a different loop" / pending-task errors.

Fixed Phase 7 (hotel domain verification): a second instance of the same bug class,
in a different place — the `client` fixture didn't override get_db, so HTTP requests
went through app.db.connection's pooled production engine instead of the dedicated
test engine. See the client fixture's docstring below for the full explanation.
"""
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.api.v1.deps import get_db
from app.core.config import settings
from app.main import app

# Dedicated test engine, NullPool: every checkout opens a brand-new asyncpg
# connection scoped to whichever event loop is currently running, instead of
# reusing a connection from app.db.connection's pooled engine across
# pytest-asyncio's per-test-function event loops. Without this, the second (and
# every subsequent) test that touches the database in the same pytest run fails
# with "attached to a different loop" / pending-task errors, since asyncpg
# connections are permanently bound to the loop they were opened under.
# app/db/connection.py's real engine is intentionally left untouched — this is
# test-only, and the slight per-connection overhead of NullPool is negligible for
# a test suite.
_test_engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool, future=True)
_TestSessionLocal = async_sessionmaker(
    bind=_test_engine, class_=AsyncSession, expire_on_commit=False, autoflush=False
)


async def _override_get_db():
    """Same NullPool test engine as db_session, wired into the app's own get_db
    dependency for the duration of a test — see the client fixture's docstring
    for why this is needed in addition to db_session's existing NullPool fix.
    """
    async with _TestSessionLocal() as session:
        yield session
        await session.commit()


@pytest_asyncio.fixture
async def client() -> AsyncClient:
    """Async test client bound directly to the FastAPI app (no real network calls).

    Overrides get_db for the test's duration so requests made through this
    client run against the dedicated NullPool test engine instead of
    app.db.connection's pooled production engine. Without this, a single test
    function driving one DB-writing request is fine, but a SECOND test function
    in the same pytest run that also makes a DB-writing request via `client`
    fails with asyncpg's "attached to a different loop" — the production
    engine's pooled connection from the first test is bound to a now-closed
    event loop (pytest-asyncio gives each test function its own loop by
    default). This is the same bug class fixed for db_session in Phase 4.5,
    surfacing here for the first time because no earlier test file had two
    separate test functions each make a DB-writing request through `client` (see
    PROJECT_STATE.md Open Decision #29 for the original instance of this bug).
    """
    app.dependency_overrides[get_db] = _override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.pop(get_db, None)


@pytest_asyncio.fixture
async def db_session():
    """A real async DB session; all writes made during a test are rolled back on exit.

    Repositories in this codebase use `db.flush()` rather than `db.commit()` (commits
    happen at the request boundary via get_db), so this rollback is sufficient to keep
    the test database clean between test runs.

    NOTE: if a test explicitly calls db_session.commit() (needed when it also uses
    the `client` fixture, since client now runs on a SEPARATE session/connection
    and needs committed data to see it), this rollback becomes a no-op — that test
    is then responsible for its own explicit teardown. See
    tests/unit/hotel/test_hotel_booking_flow.py's cleanup_hotel_rows fixture for
    the pattern.
    """
    async with _TestSessionLocal() as session:
        yield session
        await session.rollback()