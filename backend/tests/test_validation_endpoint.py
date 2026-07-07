import os
import sys
from fastapi.testclient import TestClient

# Add workspace root directory to path so script runs standalone
sys.path.append(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)

from backend.app.main import app

client = TestClient(app)


def test_validation_summary_endpoint():
    """Verify that the validation summary API loads and returns correct results."""
    print("  - Testing GET /api/v1/validation/summary schema compliance...")
    response = client.get("/api/v1/validation/summary")
    assert response.status_code == 200

    json_data = response.json()
    assert "generated_at" in json_data
    assert "data_mode" in json_data
    assert "status" in json_data
    assert "overall_conclusion" in json_data
    assert "assets" in json_data

    # We expect status to be 'ready' since we just ran the offline script
    assert json_data["status"] == "ready"
    assert "BTCUSDT" in json_data["assets"]
    assert "ETHUSDT" in json_data["assets"]
    assert "SPX" in json_data["assets"]
    assert "XAU" in json_data["assets"]

    # Verify capitalization fix is reflected
    conclusion = json_data["overall_conclusion"]
    print(f"Overall Conclusion: {conclusion}")
    assert "MSPE" in conclusion
    assert "Mspe" not in conclusion
    assert "btcusdt" not in conclusion  # should be capitalized like BTCUSDT
    assert "BTCUSDT" in conclusion


def test_validation_summary_base_endpoint():
    """Verify that the base validation summary API GET /api/validation/summary works."""
    print("  - Testing GET /api/validation/summary schema compliance...")
    response = client.get("/api/validation/summary")
    assert response.status_code == 200

    json_data = response.json()
    assert json_data["status"] == "ready"
    assert "BTCUSDT" in json_data["assets"]
    assert "ETHUSDT" in json_data["assets"]
    assert "SPX" in json_data["assets"]
    assert "XAU" in json_data["assets"]

