"""Smoke test for the new MSPE v2 engine pipeline."""
import sys
import os

# Add workspace root to path
workspace_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, workspace_root)

import numpy as np

print("=" * 60)
print("MSPE v2.0 Engine Smoke Test")
print("=" * 60)

# 1. Import all new modules
print("\n[1] Testing imports...")
from backend.quant.models.baselines import (
    LastPriceBaseline, HistoricalMeanBaseline,
    RollingMeanBaseline, RollingVolBaseline,
)
from backend.quant.models.statistical import ARIMAModel, GARCHModel, EWMAModel
from backend.quant.models.ml_models import XGBoostReturnModel, build_features
from backend.quant.models.model_registry import get_all_models, run_all_models
from backend.quant.validation.metrics import compute_all_metrics
from backend.quant.validation.walk_forward import run_walk_forward_validation
from backend.quant.projection.engine import QuantitativeProjectionEngine
from backend.quant.projection.scenarios import extract_scenarios
from backend.app.schemas.results import AssetResult, DashboardResultsResponse
print("  All imports successful!")

# 2. List registered models
print("\n[2] Model registry...")
models = get_all_models()
print(f"  Registered models ({len(models)}): {[m.name for m in models]}")

# 3. Generate synthetic data
print("\n[3] Generating synthetic data (252 days, GBM-like)...")
from backend.app.services.result_engine import generate_synthetic_prices
prices = generate_synthetic_prices(spot=68000.0, vol=0.45, drift=0.15, days=252)
from backend.quant.risk.analytics import compute_daily_returns
returns = compute_daily_returns(prices)
print(f"  Prices: {len(prices)} points, range ${prices.min():,.0f} — ${prices.max():,.0f}")
print(f"  Returns: {len(returns)} points, mean {np.mean(returns)*100:.3f}%/day")

# 4. Run all models
print("\n[4] Running all models (7-day horizon)...")
results = run_all_models(prices, returns, horizon=7)
for r in results:
    print(f"  {r['model_name']:30s} ret={r['expected_return']:+.4f}  vol={r['expected_volatility']:.4f}")

# 5. Run walk-forward validation
print("\n[5] Walk-forward validation (7-day horizon)...")
wf = run_walk_forward_validation(prices, returns, horizon=7, max_validation_steps=30)
print(f"  Selected model: {wf.selected_model}")
print(f"  Reason: {wf.selected_reason}")
print(f"  Baseline beaten: {wf.baseline_beaten}")
print(f"  Models compared: {wf.num_models_compared}")
print(f"  Validation steps: {wf.model_results[0].num_validation_steps if wf.model_results else 0}")
print(f"\n  Full ranking:")
for r in wf.model_results:
    print(f"    {r.model_name:30s} cal={r.calibration_score:.4f}  cov={r.interval_coverage:.4f}  dir={r.directional_accuracy:.4f}  mae={r.mae:.6f}")

# 6. Run projection
print("\n[6] Monte Carlo projection...")
proj = QuantitativeProjectionEngine.run_projection(
    spot=float(prices[-1]),
    drift_annual=0.15,
    volatility_annual=0.45,
    horizons=[1, 3, 7, 30],
    num_paths=10000,
)
for s in proj.horizons:
    print(f"  {s.horizon_days:2d}d: Bear=${s.bear_price:,.2f}  Base=${s.base_price:,.2f}  Bull=${s.bull_price:,.2f}  P(gain)={s.probability_of_gain:.1%}")
print(f"  Path lengths: bear={len(proj.bear_path)}, base={len(proj.base_path)}, bull={len(proj.bull_path)}")
print(f"  Sample paths: {len(proj.sample_paths)}")
print(f"  Density grid: {len(proj.density_prices)} points")

# 7. Full pipeline test
print("\n[7] Full pipeline test (demo mode)...")
from backend.app.services.result_engine import ResultEngineService
result = ResultEngineService._run_demo_pipeline("BTCUSDT")
print(f"  Asset: {result.asset}")
print(f"  Price: ${result.latest_price:,.2f}")
print(f"  Projections: {len(result.projections)}")
for p in result.projections:
    print(f"    {p.horizon_days:2d}d: ${p.bear_price:,.2f} — ${p.base_price:,.2f} — ${p.bull_price:,.2f}  ({p.expected_return:+.2%})")
print(f"  Risk: {result.risk.risk_level} (score {result.risk.risk_score:.1f})")
print(f"  VaR(95%): {result.risk.var_95:.2%}")
print(f"  CVaR(95%): {result.risk.cvar_95:.2%}")
print(f"  Selected model: {result.model_selection.selected_model}")
print(f"  Models compared: {result.model_selection.models_compared}")
print(f"  Baseline beaten: {result.model_selection.baseline_beaten}")
print(f"  Calibration: {result.model_selection.validation_summary.calibration_score:.4f}")
print(f"\n  Explanation:")
print(f"    Expects: {result.explanation.what_mspe_expects[:100]}...")
print(f"    Why: {result.explanation.why_this_result[:100]}...")
print(f"    Risk: {result.explanation.what_risk_to_watch[:100]}...")
print(f"    Reliable: {result.explanation.how_reliable[:100]}...")

print("\n" + "=" * 60)
print("ALL SMOKE TESTS PASSED!")
print("=" * 60)
