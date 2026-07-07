"""
Walk-forward validation engine for MSPE model selection.

Performs expanding-window out-of-sample testing:
1. For each validation step, train on all data before the test point
2. Predict forward by 'horizon' days
3. Record predicted vs actual outcomes
4. Compute validation metrics for each model
5. Select the model with the best calibration score

No lookahead bias — the training window strictly precedes each test point.
"""

import numpy as np
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field

from backend.quant.models.model_registry import get_all_models
from backend.quant.validation.metrics import (
    compute_mae,
    compute_rmse,
    compute_directional_accuracy,
    compute_interval_coverage,
    compute_var_breach_rate,
    compute_band_width,
    compute_calibration_score,
)


@dataclass
class ModelValidationResult:
    """Validation metrics for a single model."""

    model_name: str
    mae: float = 0.0
    rmse: float = 0.0
    directional_accuracy: float = 0.0
    interval_coverage: float = 0.0
    var_breach_rate: float = 0.0
    band_width: float = 0.0
    calibration_score: float = 0.0
    num_validation_steps: int = 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "model_name": self.model_name,
            "mae": self.mae,
            "rmse": self.rmse,
            "directional_accuracy": self.directional_accuracy,
            "interval_coverage": self.interval_coverage,
            "var_breach_rate": self.var_breach_rate,
            "band_width": self.band_width,
            "calibration_score": self.calibration_score,
            "num_validation_steps": self.num_validation_steps,
        }


@dataclass
class WalkForwardResult:
    """Complete result of walk-forward validation across all models."""

    selected_model: str = ""
    selected_reason: str = ""
    baseline_beaten: bool = False
    best_baseline_score: float = 0.0
    model_results: List[ModelValidationResult] = field(default_factory=list)
    num_models_compared: int = 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "selected_model": self.selected_model,
            "selected_reason": self.selected_reason,
            "baseline_beaten": self.baseline_beaten,
            "best_baseline_score": self.best_baseline_score,
            "num_models_compared": self.num_models_compared,
            "model_results": [r.to_dict() for r in self.model_results],
        }


BASELINE_NAMES = {
    "last_price_baseline",
    "historical_mean_baseline",
    "rolling_mean_baseline",
    "rolling_vol_baseline",
}


def run_walk_forward_validation(
    prices: np.ndarray,
    returns: np.ndarray,
    horizon: int,
    volumes: Optional[np.ndarray] = None,
    min_train_size: int = 60,
    max_validation_steps: int = 60,
) -> WalkForwardResult:
    """Runs walk-forward validation for all models on one asset/horizon.

    Args:
        prices: Full price array (chronological)
        returns: Full return array (len = len(prices) - 1)
        horizon: Prediction horizon in days
        volumes: Optional volume array (same length as prices)
        min_train_size: Minimum training window before validation starts
        max_validation_steps: Maximum number of validation steps

    Returns:
        WalkForwardResult with selected model and all metrics
    """
    n_returns = len(returns)
    n_prices = len(prices)

    # We need at least min_train_size + horizon data points for validation
    if n_returns < min_train_size + horizon + 10:
        return _fallback_result()

    # Determine validation window boundaries
    # Start validation at min_train_size, end at n_returns - horizon
    val_start = min_train_size
    val_end = n_returns - horizon

    if val_end <= val_start:
        return _fallback_result()

    # Limit number of validation steps to avoid excessive computation
    total_possible_steps = val_end - val_start
    step_stride = max(1, total_possible_steps // max_validation_steps)
    validation_indices = list(range(val_start, val_end, step_stride))

    if len(validation_indices) < 10:
        # Not enough steps for meaningful validation
        return _fallback_result()

    # Initialize tracking arrays for each model
    model_templates = get_all_models()
    model_names = [m.name for m in model_templates]
    n_models = len(model_names)

    # Per-model tracking
    predicted_returns_by_model = {name: [] for name in model_names}
    actual_returns_list = []
    actual_prices_list = []
    bear_prices_by_model = {name: [] for name in model_names}
    bull_prices_by_model = {name: [] for name in model_names}
    spot_prices_list = []
    var_thresholds_by_model = {name: [] for name in model_names}

    # Walk-forward loop
    for split_idx in validation_indices:
        # Training data: everything before split_idx
        train_prices = prices[: split_idx + 1]  # +1 because prices is 1 longer
        train_returns = returns[:split_idx]
        train_volumes = volumes[: split_idx + 1] if volumes is not None else None

        # Actual outcome: return over the horizon
        actual_return = float(np.sum(returns[split_idx : split_idx + horizon]))
        actual_price = prices[split_idx + horizon]
        spot = prices[split_idx]

        actual_returns_list.append(actual_return)
        actual_prices_list.append(actual_price)
        spot_prices_list.append(spot)

        # Fit and predict with each model
        models = get_all_models()
        for model in models:
            try:
                model.fit(
                    prices=train_prices,
                    returns=train_returns,
                    volumes=train_volumes,
                )
                pred = model.predict(horizon=horizon)
                pred_return = pred["expected_return"]
                pred_vol = pred["expected_volatility"]
            except Exception:
                # Model failed — use zero as prediction (worst case)
                pred_return = 0.0
                pred_vol = 0.20

            predicted_returns_by_model[model.name].append(pred_return)

            # Compute bear/bull from GBM formula using model's drift and vol
            dt = horizon / 252.0
            drift_annual = pred_return / dt if dt > 0 else 0.0
            vol_annual = pred_vol

            bear_price = spot * np.exp(
                (drift_annual - 0.5 * vol_annual**2) * dt
                - 1.28 * vol_annual * np.sqrt(dt)
            )
            bull_price = spot * np.exp(
                (drift_annual - 0.5 * vol_annual**2) * dt
                + 1.28 * vol_annual * np.sqrt(dt)
            )

            bear_prices_by_model[model.name].append(bear_price)
            bull_prices_by_model[model.name].append(bull_price)

            # VaR threshold: 95th percentile daily loss, scaled
            var_daily = pred_vol / np.sqrt(252) * 1.645
            var_horizon = var_daily * np.sqrt(horizon)
            var_thresholds_by_model[model.name].append(var_horizon)

    # Convert tracking lists to numpy arrays
    actual_returns_arr = np.array(actual_returns_list)
    actual_prices_arr = np.array(actual_prices_list)
    spot_prices_arr = np.array(spot_prices_list)

    # Compute metrics for each model
    model_validation_results = []

    for name in model_names:
        pred_arr = np.array(predicted_returns_by_model[name])
        bear_arr = np.array(bear_prices_by_model[name])
        bull_arr = np.array(bull_prices_by_model[name])
        var_arr = np.array(var_thresholds_by_model[name])

        mae = compute_mae(pred_arr, actual_returns_arr)
        rmse = compute_rmse(pred_arr, actual_returns_arr)
        dir_acc = compute_directional_accuracy(pred_arr, actual_returns_arr)
        coverage = compute_interval_coverage(actual_prices_arr, bear_arr, bull_arr)
        var_breach = compute_var_breach_rate(actual_returns_arr, var_arr)
        bw = compute_band_width(bear_arr, bull_arr, spot_prices_arr)
        cal_score = compute_calibration_score(mae, dir_acc, coverage, bw)

        mvr = ModelValidationResult(
            model_name=name,
            mae=round(mae, 6),
            rmse=round(rmse, 6),
            directional_accuracy=round(dir_acc, 4),
            interval_coverage=round(coverage, 4),
            var_breach_rate=round(var_breach, 4),
            band_width=round(bw, 4),
            calibration_score=round(cal_score, 4),
            num_validation_steps=len(validation_indices),
        )
        model_validation_results.append(mvr)

    # Select best model by calibration score
    model_validation_results.sort(key=lambda r: r.calibration_score, reverse=True)

    best = model_validation_results[0]

    # Check if the best model beats all baselines
    best_baseline_score = max(
        (r.calibration_score for r in model_validation_results if r.model_name in BASELINE_NAMES),
        default=0.0,
    )
    baseline_beaten = best.model_name not in BASELINE_NAMES

    # Generate human-readable selection reason
    reason = _generate_selection_reason(best, model_validation_results, baseline_beaten)

    return WalkForwardResult(
        selected_model=best.model_name,
        selected_reason=reason,
        baseline_beaten=baseline_beaten,
        best_baseline_score=best_baseline_score,
        model_results=model_validation_results,
        num_models_compared=len(model_validation_results),
    )


def _generate_selection_reason(
    best: ModelValidationResult,
    all_results: List[ModelValidationResult],
    baseline_beaten: bool,
) -> str:
    """Generates a plain-English reason for why this model was selected."""
    score_pct = best.calibration_score * 100

    if not baseline_beaten:
        return (
            f"'{best.model_name}' was selected because no advanced model "
            f"outperformed the baselines in walk-forward testing. "
            f"This is an honest result — simple methods sometimes work best. "
            f"Calibration score: {score_pct:.0f}%."
        )

    # Find the best baseline for comparison
    best_baseline = None
    for r in all_results:
        if r.model_name in BASELINE_NAMES:
            if best_baseline is None or r.calibration_score > best_baseline.calibration_score:
                best_baseline = r

    improvement = ""
    if best_baseline and best_baseline.calibration_score > 0:
        pct_better = (
            (best.calibration_score - best_baseline.calibration_score)
            / best_baseline.calibration_score
            * 100
        )
        improvement = f" It outperformed the best baseline by {pct_better:.0f}%."

    coverage_note = ""
    if best.interval_coverage > 0.70:
        coverage_note = (
            f" Its prediction bands contained the actual price "
            f"{best.interval_coverage:.0%} of the time."
        )

    return (
        f"'{best.model_name}' achieved the highest validation score "
        f"({score_pct:.0f}%) across {best.num_validation_steps} walk-forward "
        f"test periods.{improvement}{coverage_note}"
    )


def _fallback_result() -> WalkForwardResult:
    """Returns a minimal result when there's not enough data for validation."""
    return WalkForwardResult(
        selected_model="rolling_mean_baseline",
        selected_reason=(
            "Insufficient data for walk-forward validation. "
            "Defaulting to rolling mean baseline as a conservative estimate."
        ),
        baseline_beaten=False,
        best_baseline_score=0.5,
        model_results=[
            ModelValidationResult(
                model_name="rolling_mean_baseline",
                calibration_score=0.5,
                num_validation_steps=0,
            )
        ],
        num_models_compared=1,
    )
