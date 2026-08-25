"""Smoke test confirming the API boots and /health responds with the standard envelope."""


async def test_health_check(client):
    response = await client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["data"]["status"] == "ok"