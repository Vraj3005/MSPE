import os
import sys
from fastapi.testclient import TestClient

# Add workspace root directory to path so script runs standalone
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.app.main import app
from backend.app.services.result_engine import ResultEngineService
from backend.app.schemas.dashboard import DashboardOverviewResponse

client = TestClient(app)

def test_result_engine_output_shape():
    """Verify that the result engine output matches the expected Pydantic shape."""
    print("  - Running Result Engine output shape verification...")
    mock_res = ResultEngineService._generate_mock_results()
    
    assert mock_res.is_demo is True
    assert "BTCUSDT" in mock_res.assets
    assert "ETHUSDT" in mock_res.assets
    assert "SPX" in mock_res.assets
    assert "XAU" in mock_res.assets
    
    btc_res = mock_res.assets["BTCUSDT"]
    assert btc_res.market_data.symbol == "BTCUSDT"
    assert btc_res.market_data.name == "Bitcoin / Tether USDT"
    assert btc_res.market_data.asset_class == "CRYPTO"
    assert len(btc_res.projections) == 4
    assert btc_res.risk_summary.risk_score > 0
    assert btc_res.market_read != ""
    assert btc_res.summary_sentence != ""

def test_api_response_schema_overview():
    """Test that the overview API returns the correct schema structure."""
    print("  - Testing GET /api/dashboard/overview schema compliance...")
    response = client.get("/api/dashboard/overview")
    assert response.status_code == 200
    
    json_data = response.json()
    assert "last_updated" in json_data
    assert "data_mode" in json_data
    assert "total_assets" in json_data
    assert "best_risk_reward_asset" in json_data
    assert "highest_risk_asset" in json_data
    assert "market_summary_text" in json_data
    assert "top_cards" in json_data
    assert "asset_cards" in json_data
    
    assert len(json_data["top_cards"]) == 4
    assert len(json_data["asset_cards"]) == 4

def test_api_response_schema_assets_list():
    """Test that the assets summary list API returns correctly."""
    print("  - Testing GET /api/assets list schema compliance...")
    response = client.get("/api/assets")
    assert response.status_code == 200
    
    json_list = response.json()
    assert isinstance(json_list, list)
    assert len(json_list) == 4
    
    first_asset = json_list[0]
    assert "symbol" in first_asset
    assert "name" in first_asset
    assert "asset_class" in first_asset
    assert "last_close" in first_asset
    assert "daily_change" in first_asset
    assert "risk_level" in first_asset
    assert "base_case_7d" in first_asset
    assert "probability_of_loss_7d" in first_asset

def test_api_response_schema_projections():
    """Test that asset projection details return the full 30d simulation range paths."""
    print("  - Testing GET /api/assets/{symbol}/projection schema compliance...")
    response = client.get("/api/assets/BTCUSDT/projection")
    assert response.status_code == 200
    
    json_data = response.json()
    assert "asset" in json_data
    assert "projection_horizon_results" in json_data
    assert "bear_scenario_path" in json_data
    assert "base_scenario_path" in json_data
    assert "bull_scenario_path" in json_data
    assert "monte_carlo_paths" in json_data
    assert "explanation_text" in json_data
    
    # 30 steps means path lengths should be 31
    assert len(json_data["bear_scenario_path"]) == 31
    assert len(json_data["base_scenario_path"]) == 31
    assert len(json_data["bull_scenario_path"]) == 31
    assert len(json_data["monte_carlo_paths"]) == 5
    assert len(json_data["monte_carlo_paths"][0]) == 31
    
    assert "probability_density_data" in json_data
    density = json_data["probability_density_data"]
    assert len(density["prices"]) == 20
    assert len(density["densities"]) == 20

def test_api_response_schema_risk():
    """Test that asset risk endpoint returns downside indicators and stress tests."""
    print("  - Testing GET /api/assets/{symbol}/risk schema compliance...")
    response = client.get("/api/assets/BTCUSDT/risk")
    assert response.status_code == 200
    
    json_data = response.json()
    assert "symbol" in json_data
    assert "var_95" in json_data
    assert "cvar_95" in json_data
    assert "volatility" in json_data
    assert "drawdown" in json_data
    assert "risk_score" in json_data
    assert "risk_level" in json_data
    assert "stress_test_summary" in json_data
    assert "plain_language_explanation" in json_data
    
    # Check metrics values exist and are realistic
    assert json_data["symbol"] == "BTCUSDT"
    assert json_data["var_95"] > 0.0
    assert json_data["cvar_95"] > 0.0
    assert json_data["volatility"] > 0.0
    assert json_data["risk_score"] > 0.0
    assert len(json_data["stress_test_summary"]) == 4

def test_api_response_schema_methodology():
    """Test that methodology API returns correct texts."""
    print("  - Testing GET /api/methodology/simple compliance...")
    response = client.get("/api/methodology/simple")
    assert response.status_code == 200
    
    json_data = response.json()
    assert "projections_calculation" in json_data
    assert "monte_carlo_definition" in json_data
    assert "var_definition" in json_data
    assert "limitations" in json_data
    assert len(json_data["limitations"]) > 0

def test_invalid_symbol():
    """Test that querying an untracked asset symbol returns a clean 404 error."""
    print("  - Testing GET /api/assets/INVALID/projection returns 404...")
    res_proj = client.get("/api/assets/INVALID/projection")
    assert res_proj.status_code == 404
    assert "detail" in res_proj.json()
    
    print("  - Testing GET /api/assets/INVALID/risk returns 404...")
    res_risk = client.get("/api/assets/INVALID/risk")
    assert res_risk.status_code == 404
    assert "detail" in res_risk.json()

def test_demo_fallback_and_missing_data():
    """Verify that data mode indicators signal demo falls dynamically when DB context is empty."""
    print("  - Testing demo fallback data mode indicators...")
    response = client.get("/api/dashboard/overview")
    assert response.status_code == 200
    json_data = response.json()
    # On clean/test environments, it should fallback to demo or live data gracefully
    assert json_data["data_mode"] in ["live", "demo", "cached"]

if __name__ == "__main__":
    print("Starting MSPE User API Results Engine Unit Test Suite...")
    try:
        test_result_engine_output_shape()
        test_api_response_schema_overview()
        test_api_response_schema_assets_list()
        test_api_response_schema_projections()
        test_api_response_schema_risk()
        test_api_response_schema_methodology()
        test_invalid_symbol()
        test_demo_fallback_and_missing_data()
        print("\nSUCCESS: All clean API schema, fallback, and results engine validations passed!")
        sys.exit(0)
    except AssertionError as ae:
        print(f"\nFAILURE: Test assertion failure: {ae}", file=sys.stderr)
        sys.exit(1)
    except Exception as ex:
        print(f"\nCRITICAL ERROR: Unexpected execution exception: {ex}", file=sys.stderr)
        sys.exit(1)
