import pytest
from httpx import AsyncClient, ASGITransport
import sys
import os

# Ustawienie zmiennych środowiska przed importem main.py
os.environ["NODE_ID"] = "test-node-1"
os.environ["DP_ENABLED"] = "false"

# Dodanie katalogu głównego do ścieżki, żeby można było importować main
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from main import app # Upewnij się, że FastAPI jest zdefiniowane jako "app" w main.py

@pytest.fixture
async def async_client():
    # Używamy AsyncClient z httpx do testowania asynchronicznego FastAPI
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://testserver"
    ) as client:
        yield client
