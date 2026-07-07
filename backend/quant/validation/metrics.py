"""
Validation metrics for comparing MSPE projection models.

All functions are pure — they take numpy arrays and return floats.
No database, no side effects.
"""

import numpy as np
from typing import Dict


def compute_mae(predicted: np.ndarray, actual: np.ndarray) -> float:
    """Mean Absolute Error between predicted and actual returns."""
    if len(predicted) == 0 or len(actual) == 0:
        return 999.0
    return float(np.mean(np.abs(predicted - actual)))


def compute_rmse(predicted: np.ndarray, actual: np.ndarray) -> float:
    """Root Mean Squared Error — penalizes large misses more than MAE."""
    if len(predicted) == 0 or len(actual) == 0:
        return 999.0
    return float(np.sqrt(np.mean((predicted - actual) ** 2)))


def compute_directional_accuracy(predicted: np.ndarray, actual: np.ndarray) -> float:
    """Fraction of times the predicted direction (up/down) matched actual.

    Returns a value between 0.0 and 1.0.
    Predictions of exactly 0 are counted as 'up' for consistency.
    """
    if len(predicted) == 0 or len(actual) == 0:
        return 0.0
    pred_sign = np.sign(predicted)
    actual_sign = np.sign(actual)
    # Treat 0 as positive direction
    pred_sign[pred_sign == 0] = 1
    actual_sign[actual_sign == 0] = 1
    return float(np.mean(pred_sign == actual_sign))


def compute_interval_coverage(
    actual_prices: np.ndarray,
    bear_prices: np.ndarray,
    bull_prices: np.ndarray,
) -> float:
    """Fraction of times the actual price fell inside the [bear, bull] band.

    For a well-calibrated P10–P90 band, this should be ~80%.
    Returns a value between 0.0 and 1.0.
    """
    if len(actual_prices) == 0:
        return 0.0
    inside = (actual_prices >= bear_prices) & (actual_prices <= bull_prices)
    return float(np.mean(inside))


def compute_var_breach_rate(
    actual_returns: np.ndarray,
    var_thresholds: np.ndarray,
) -> float:
    """Fraction of times the actual loss exceeded the VaR threshold.

    For a 95% VaR model, the breach rate should be ~5%.
    A much higher rate means the risk model underestimates tail risk.
    """
    if len(actual_returns) == 0:
        return 0.0
    # VaR thresholds are positive numbers representing max expected loss
    breaches = actual_returns < -var_thresholds
    return float(np.mean(breaches))


def compute_band_width(
    bear_prices: np.ndarray,
    bull_prices: np.ndarray,
    spot_prices: np.ndarray,
) -> float:
    """Average width of the prediction band relative to spot price.

    Narrower bands are more useful IF coverage holds.
    Returns a percentage (e.g. 0.12 = 12% average band width).
    """
    if len(bear_prices) == 0 or len(spot_prices) == 0:
        return 999.0
    safe_spots = np.where(spot_prices == 0, 1e-9, spot_prices)
    widths = (bull_prices - bear_prices) / safe_spots
    return float(np.mean(widths))


def compute_calibration_score(
    mae: float,
    directional_accuracy: float,
    interval_coverage: float,
    band_width: float,
    target_coverage: float = 0.80,
) -> float:
    """Combined quality score from 0.0 (worst) to 1.0 (best).

    Weights:
    - 40% interval coverage quality (penalty for over/under-coverage)
    - 30% MAE quality (lower is better, normalized)
    - 20% directional accuracy
    - 10% band width efficiency (narrower is better, if coverage holds)

    This score is used to select the best model per asset/horizon.
    """
    # Coverage quality: 1.0 when exactly at target, drops as it deviates
    coverage_error = abs(interval_coverage - target_coverage)
    coverage_quality = max(0.0, 1.0 - coverage_error * 5.0)

    # MAE quality: exponential decay — 0 error → 1.0, large error → 0.0
    mae_quality = float(np.exp(-mae * 20.0))

    # Direction quality: direct proportion
    direction_quality = directional_accuracy

    # Band width efficiency: narrower is better (capped at 1.0)
    # Typical good band width is 5-15% of spot
    width_quality = max(0.0, 1.0 - band_width * 3.0)

    score = (
        0.40 * coverage_quality
        + 0.30 * mae_quality
        + 0.20 * direction_quality
        + 0.10 * width_quality
    )

    return float(np.clip(score, 0.0, 1.0))


def compute_all_metrics(
    predicted_returns: np.ndarray,
    actual_returns: np.ndarray,
    actual_prices: np.ndarray,
    bear_prices: np.ndarray,
    bull_prices: np.ndarray,
    spot_prices: np.ndarray,
    var_thresholds: np.ndarray,
) -> Dict[str, float]:
    """Computes all validation metrics in one call.

    Returns a dictionary matching the ValidationMetrics schema.
    """
    mae = compute_mae(predicted_returns, actual_returns)
    rmse = compute_rmse(predicted_returns, actual_returns)
    directional_accuracy = compute_directional_accuracy(
        predicted_returns, actual_returns
    )
    interval_coverage = compute_interval_coverage(
        actual_prices, bear_prices, bull_prices
    )
    var_breach_rate = compute_var_breach_rate(actual_returns, var_thresholds)
    band_width = compute_band_width(bear_prices, bull_prices, spot_prices)
    calibration_score = compute_calibration_score(
        mae, directional_accuracy, interval_coverage, band_width
    )

    return {
        "mae": round(mae, 6),
        "rmse": round(rmse, 6),
        "directional_accuracy": round(directional_accuracy, 4),
        "interval_coverage": round(interval_coverage, 4),
        "var_breach_rate": round(var_breach_rate, 4),
        "band_width": round(band_width, 4),
        "calibration_score": round(calibration_score, 4),
    }
