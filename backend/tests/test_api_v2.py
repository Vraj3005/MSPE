"""Unit tests for the MSPE v2 dashboard endpoints."""

import os
import sys

# Add workspace root directory to path so script runs standalone
sys.path.append(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)

from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)


def test_v2_dashboard_results():
    response = client.get("/api/v1/dashboard/results")
    assert response.status_code == 200
    data = response.json()
    assert "data_mode" in data
    assert "engine_version" in data
    assert "assets" in data

    # Verify standard tracked assets exist in output
    for sym in ["BTCUSDT", "ETHUSDT", "SPX", "XAU"]:
        assert sym in data["assets"]
        asset = data["assets"][sym]
        assert "latest_price" in asset
        assert "model_selection" in asset
        assert "risk" in asset
        assert "projections" in asset


def test_legacy_endpoints():
    r1 = client.get("/api/dashboard/overview")
    assert r1.status_code == 200

    r2 = client.get("/api/assets")
    assert r2.status_code == 200

    r3 = client.get("/api/assets/BTCUSDT/projection")
    assert r3.status_code == 200

    r4 = client.get("/api/assets/BTCUSDT/risk")
    assert r4.status_code == 200

    r5 = client.get("/api/methodology/simple")
    assert r5.status_code == 200

    r6 = client.get("/api/assets/INVALID/projection")
    assert r6.status_code in [404, 444]
