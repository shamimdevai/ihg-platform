"""GET /health — liveness/readiness probe. Unversioned and unauthenticated by design."""
from fastapi import APIRouter

from app.shared_kernel.schemas.response_envelope import envelope

router = APIRouter(tags=["health"])


@router.get("/health")
async def health_check() -> dict:
    """Return a simple 200 OK payload confirming the API process is up."""
    return envelope(data={"status": "ok"}, message="Service is healthy.")