"""
Validation API endpoint for MSPE.

GET /api/v1/validation/summary
Returns model comparison results from pre-computed validation.

The validation is computed offline by running:
    python backend/scripts/run_validation.py

The API reads from reports/validation_results.json.
If no pre-computed results exist, it runs a fast single-asset validation
to provide immediate feedback.
"""

import os
import json
import time
import asyncio
from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Dict

from backend.app.api.dependencies.db import get_db
from backend.app.core.logging import logger
from backend.app.services.result_engine import (
    TRACKED_ASSETS,
    generate_synthetic_prices,
)
from backend.quant.validation.comparison import (
    run_asset_comparison,
    FullComparisonResult,
    build_overall_conclusion,
)
from backend.quant.risk import analytics as risk_calc

router = APIRouter()

# Cache for validation results
_validation_cache: Dict = {}
_validation_cache_ts: float = 0.0
_VALIDATION_CACHE_TTL: float = (
    3600.0  # 1 hour (pre-computed results don't change often)
)

# Path to pre-computed results
_REPORTS_DIR = os.path.join(
    os.path.dirname(
        os.path.dirname(
            os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        )
    ),
    "reports",
)
_VALIDATION_JSON = os.path.join(_REPORTS_DIR, "validation_results.json")


def _load_precomputed() -> Dict:
    """Tries to load pre-computed validation results from JSON file."""
    if os.path.exists(_VALIDATION_JSON):
        try:
            with open(_VALIDATION_JSON, "r", encoding="utf-8") as f:
                data = json.load(f)
            logger.info("Loaded pre-computed validation results from JSON.")
            return data
        except Exception as e:
            logger.error(f"Failed to load validation JSON: {e}")
    return {}


def _run_quick_validation() -> Dict:
    """Runs a quick validation for one asset (BTC, 7D only) as a fallback."""
    symbol = "BTCUSDT"
    meta = TRACKED_ASSETS[symbol]
    prices = generate_synthetic_prices(
        spot=meta["default_spot"],
        vol=meta["default_vol"],
        drift=meta["default_drift"],
        days=252,
    )
    returns = risk_calc.compute_daily_returns(prices)

    acr = run_asset_comparison(
        symbol=symbol,
        asset_name=meta["name"],
        prices=prices,
        returns=returns,
        horizons=[7],
        max_validation_steps=10,
    )

    result = FullComparisonResult(data_mode="demo")
    result.assets[symbol] = acr
    result.overall_conclusion = build_overall_conclusion(result)

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "data_mode": "demo",
        "status": "partial",
        "message": (
            "Showing quick validation for BTCUSDT only. "
            "Run 'python backend/scripts/run_validation.py' for full results."
        ),
        "overall_conclusion": result.overall_conclusion,
        "assets": {symbol: acr.to_dict()},
    }


@router.get("/summary")
async def get_validation_summary(db: AsyncSession = Depends(get_db)):
    """GET /api/v1/validation/summary

    Returns model comparison results with user-facing metrics.
    Reads from pre-computed validation_results.json if available.
    Falls back to quick single-asset validation otherwise.
    """
    global _validation_cache, _validation_cache_ts

    now = time.time()

    # Return cached results if fresh
    if _validation_cache and (now - _validation_cache_ts) < _VALIDATION_CACHE_TTL:
        return _validation_cache

    # Try to load pre-computed results
    precomputed = _load_precomputed()
    if precomputed and precomputed.get("assets"):
        _validation_cache = precomputed
        _validation_cache_ts = now
        return precomputed

    # Fallback: run quick single-asset validation in thread
    logger.info("No pre-computed results found. Running quick validation...")
    result = await asyncio.to_thread(_run_quick_validation)

    _validation_cache = result
    _validation_cache_ts = now
    return result
