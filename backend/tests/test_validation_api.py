"""Unit tests for the model validation endpoint."""

import os
import sys

# Add workspace root directory to path so script runs standalone
sys.path.append(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)

from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)


def test_validation_summary_endpoint():
    response = client.get("/api/v1/validation/summary")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert "data_mode" in data
    assert "assets" in data
    assert "overall_conclusion" in data

    # Verify standard tracked assets are reported
    for sym in ["BTCUSDT", "ETHUSDT", "SPX", "XAU"]:
        assert sym in data["assets"]
