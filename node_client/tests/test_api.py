import pytest

@pytest.mark.asyncio
async def test_health_check(async_client):
    """Zakładając, że w main.py jest endpoint @app.get('/health')"""
    response = await async_client.get("/health")
    assert response.status_code == 200

