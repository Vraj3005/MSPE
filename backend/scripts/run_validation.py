"""
Standalone validation runner for MSPE.

Run this script directly to compute full model validation and write results:
  python -m scripts.run_validation

Results are written to:
  reports/model_comparison.csv
  reports/asset_validation_summary.csv
  reports/MSPE_MODEL_VALIDATION.md
  reports/validation_results.json  (consumed by API endpoint)
"""

import sys
import os
import json
import time

# Ensure project root (MSPE_PR) is on path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

import numpy as np
from datetime import datetime, timezone

from backend.quant.validation.comparison import (
    run_asset_comparison,
    FullComparisonResult,
    build_overall_conclusion,
)
from backend.quant.validation.report_builder import (
    build_model_comparison_csv,
    build_asset_summary_csv,
    build_validation_markdown,
)
from backend.app.services.result_engine import (
    TRACKED_ASSETS,
    generate_synthetic_prices,
)
from backend.quant.risk import analytics as risk_calc


def run_validation():
    """Runs full model comparison for all assets and writes reports."""
    print("=" * 60)
    print("MSPE Model Validation Runner")
    print("=" * 60)
    print()

    total_start = time.time()
    result = FullComparisonResult(data_mode="demo")

    for symbol, meta in TRACKED_ASSETS.items():
        t0 = time.time()
        print(f"  [{symbol}] Generating synthetic data...")
        prices = generate_synthetic_prices(
            spot=meta["default_spot"],
            vol=meta["default_vol"],
            drift=meta["default_drift"],
            days=252,
        )
        returns = risk_calc.compute_daily_returns(prices)

        print(f"  [{symbol}] Running walk-forward validation (4 horizons × 8 models)...")
        acr = run_asset_comparison(
            symbol=symbol,
            asset_name=meta["name"],
            prices=prices,
            returns=returns,
            horizons=[1, 3, 7, 30],
            max_validation_steps=15,
        )
        result.assets[symbol] = acr
        elapsed = time.time() - t0
        print(f"  [{symbol}] Done in {elapsed:.1f}s")

        # Print quick summary
        um = acr.user_metrics
        if um:
            print(f"    Accuracy: {um.projection_accuracy}  Range: {um.range_reliability}  Confidence: {um.model_confidence}")
        for label, hcr in acr.horizons.items():
            beaten = "YES" if hcr.baseline_beaten else "NO "
            print(f"    {label}: {hcr.best_model:30s} beats_baseline={beaten} score={hcr.best_model_score:.4f}")
        print()

    result.overall_conclusion = build_overall_conclusion(result)

    # Write reports
    reports_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "reports")
    os.makedirs(reports_dir, exist_ok=True)

    # CSV: model comparison
    csv_data = build_model_comparison_csv(result)
    with open(os.path.join(reports_dir, "model_comparison.csv"), "w", newline="") as f:
        f.write(csv_data)
    print("Wrote reports/model_comparison.csv")

    # CSV: asset summary
    summary_csv = build_asset_summary_csv(result)
    with open(os.path.join(reports_dir, "asset_validation_summary.csv"), "w", newline="") as f:
        f.write(summary_csv)
    print("Wrote reports/asset_validation_summary.csv")

    # Markdown report
    md = build_validation_markdown(result)
    with open(os.path.join(reports_dir, "MSPE_MODEL_VALIDATION.md"), "w", encoding="utf-8") as f:
        f.write(md)
    print("Wrote reports/MSPE_MODEL_VALIDATION.md")

    # JSON for API endpoint
    api_response = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "data_mode": result.data_mode,
        "status": "ready",
        "overall_conclusion": result.overall_conclusion,
        "assets": {sym: acr.to_dict() for sym, acr in result.assets.items()},
    }
    with open(os.path.join(reports_dir, "validation_results.json"), "w", encoding="utf-8") as f:
        json.dump(api_response, f, indent=2, default=str)
    print("Wrote reports/validation_results.json")

    total = time.time() - total_start
    print()
    print("=" * 60)
    print(f"OVERALL CONCLUSION:")
    print(result.overall_conclusion)
    print(f"\nTotal time: {total:.1f}s")
    print("=" * 60)


if __name__ == "__main__":
    run_validation()
