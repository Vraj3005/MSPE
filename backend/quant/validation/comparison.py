"""
Multi-horizon model comparison engine for MSPE validation.

Runs walk-forward validation across all models for each horizon (1D, 3D, 7D, 30D)
and produces user-facing validation metrics.

Reuses the existing walk_forward.run_walk_forward_validation() — this module
orchestrates it across horizons and computes the user-facing summary layer.
"""

import numpy as np
from dataclasses import dataclass, field
from typing import Dict, List, Optional

from backend.quant.validation.walk_forward import (
    run_walk_forward_validation,
    ModelValidationResult,
    BASELINE_NAMES,
)

# ============================================================
# Data structures
# ============================================================


@dataclass
class UserFacingMetrics:
    """Simple metrics that recruiters and visitors can understand."""

    projection_accuracy: str  # e.g. "94.2%"
    projection_accuracy_value: float  # 0.942
    range_reliability: str  # e.g. "84%"
    range_reliability_value: float  # 0.84
    risk_warning_quality: str  # "Good" / "Fair" / "Poor"
    risk_warning_quality_value: float  # 0.0-1.0
    baseline_improvement: str  # e.g. "+12% over last-price"
    baseline_improvement_value: float  # 0.12
    model_confidence: str  # "High" / "Medium" / "Low"
    model_confidence_value: float  # 0.0-1.0

    def to_dict(self) -> Dict:
        return {
            "projection_accuracy": self.projection_accuracy,
            "projection_accuracy_value": self.projection_accuracy_value,
            "range_reliability": self.range_reliability,
            "range_reliability_value": self.range_reliability_value,
            "risk_warning_quality": self.risk_warning_quality,
            "risk_warning_quality_value": self.risk_warning_quality_value,
            "baseline_improvement": self.baseline_improvement,
            "baseline_improvement_value": self.baseline_improvement_value,
            "model_confidence": self.model_confidence,
            "model_confidence_value": self.model_confidence_value,
        }


@dataclass
class HorizonComparisonResult:
    """Comparison result for a single horizon."""

    horizon_days: int
    horizon_label: str  # "1D", "3D", "7D", "30D"
    best_model: str
    baseline_beaten: bool
    best_baseline_model: str
    best_baseline_score: float
    best_model_score: float
    improvement_over_baseline: float  # percentage improvement
    model_rankings: List[ModelValidationResult] = field(default_factory=list)
    conclusion: str = ""

    def to_dict(self) -> Dict:
        return {
            "horizon_days": self.horizon_days,
            "horizon_label": self.horizon_label,
            "best_model": self.best_model,
            "baseline_beaten": self.baseline_beaten,
            "best_baseline_model": self.best_baseline_model,
            "best_baseline_score": round(self.best_baseline_score, 4),
            "best_model_score": round(self.best_model_score, 4),
            "improvement_over_baseline": round(self.improvement_over_baseline, 4),
            "model_rankings": [r.to_dict() for r in self.model_rankings],
            "conclusion": self.conclusion,
        }


@dataclass
class AssetComparisonResult:
    """Full comparison result for a single asset across all horizons."""

    symbol: str
    asset_name: str
    horizons: Dict[str, HorizonComparisonResult] = field(default_factory=dict)
    user_metrics: Optional[UserFacingMetrics] = None
    overall_conclusion: str = ""

    def to_dict(self) -> Dict:
        return {
            "symbol": self.symbol,
            "asset_name": self.asset_name,
            "horizons": {k: v.to_dict() for k, v in self.horizons.items()},
            "user_metrics": self.user_metrics.to_dict() if self.user_metrics else None,
            "overall_conclusion": self.overall_conclusion,
        }


@dataclass
class FullComparisonResult:
    """Complete comparison across all assets and horizons."""

    assets: Dict[str, AssetComparisonResult] = field(default_factory=dict)
    overall_conclusion: str = ""
    data_mode: str = "demo"

    def to_dict(self) -> Dict:
        return {
            "assets": {k: v.to_dict() for k, v in self.assets.items()},
            "overall_conclusion": self.overall_conclusion,
            "data_mode": self.data_mode,
        }


# ============================================================
# Horizon labels
# ============================================================

HORIZON_MAP = {
    1: "1D",
    3: "3D",
    7: "7D",
    30: "30D",
}


# ============================================================
# Core comparison engine
# ============================================================


def run_asset_comparison(
    symbol: str,
    asset_name: str,
    prices: np.ndarray,
    returns: np.ndarray,
    horizons: List[int] = None,
    volumes: Optional[np.ndarray] = None,
    max_validation_steps: int = 20,
) -> AssetComparisonResult:
    """Runs walk-forward validation for one asset across multiple horizons.

    Args:
        symbol: Asset ticker (e.g. "BTCUSDT")
        asset_name: Human-readable name
        prices: Full price array
        returns: Full return array
        horizons: List of horizons to test (default: [1, 3, 7, 30])
        volumes: Optional volume array
        max_validation_steps: Max validation steps per horizon

    Returns:
        AssetComparisonResult with per-horizon rankings and user metrics
    """
    if horizons is None:
        horizons = [1, 3, 7, 30]

    result = AssetComparisonResult(symbol=symbol, asset_name=asset_name)

    # Filter horizons based on available data
    n = len(returns)
    valid_horizons = [h for h in horizons if n >= 60 + h + 10]

    for horizon in valid_horizons:
        label = HORIZON_MAP.get(horizon, f"{horizon}D")

        wf = run_walk_forward_validation(
            prices=prices,
            returns=returns,
            horizon=horizon,
            volumes=volumes,
            min_train_size=60,
            max_validation_steps=max_validation_steps,
        )

        # Find best baseline
        best_baseline_name = ""
        best_baseline_score = 0.0
        for mr in wf.model_results:
            if mr.model_name in BASELINE_NAMES:
                if mr.calibration_score > best_baseline_score:
                    best_baseline_score = mr.calibration_score
                    best_baseline_name = mr.model_name

        # Get best model score
        best_model_score = (
            wf.model_results[0].calibration_score if wf.model_results else 0.0
        )

        # Compute improvement
        improvement = 0.0
        if best_baseline_score > 0:
            improvement = (best_model_score - best_baseline_score) / best_baseline_score

        # Generate horizon-specific conclusion
        conclusion = _horizon_conclusion(
            label,
            wf.selected_model,
            wf.baseline_beaten,
            improvement,
            wf.model_results,
            symbol,
        )

        hcr = HorizonComparisonResult(
            horizon_days=horizon,
            horizon_label=label,
            best_model=wf.selected_model,
            baseline_beaten=wf.baseline_beaten,
            best_baseline_model=best_baseline_name,
            best_baseline_score=best_baseline_score,
            best_model_score=best_model_score,
            improvement_over_baseline=improvement,
            model_rankings=wf.model_results,
            conclusion=conclusion,
        )
        result.horizons[label] = hcr

    # Compute user-facing metrics (primarily from 7D horizon, fallback to longest)
    result.user_metrics = _compute_user_metrics(result)
    result.overall_conclusion = _asset_conclusion(result)

    return result


# ============================================================
# User-facing metric computation
# ============================================================


def _compute_user_metrics(result: AssetComparisonResult) -> UserFacingMetrics:
    """Derives simple user-facing metrics from raw validation data."""
    # Pick the primary horizon for user metrics (7D preferred, else longest)
    primary = (
        result.horizons.get("7D")
        or result.horizons.get("30D")
        or result.horizons.get("3D")
        or result.horizons.get("1D")
    )

    if primary is None or not primary.model_rankings:
        return _default_user_metrics()

    best = primary.model_rankings[0]  # Already sorted by calibration_score desc

    # 1. Projection Accuracy: how close base case was (1 - MAE as pct)
    accuracy_val = max(0.0, 1.0 - best.mae * 10.0)  # Scale: MAE of 0.05 → 50% acc
    accuracy_val = min(1.0, accuracy_val)
    accuracy_str = f"{accuracy_val:.1%}"

    # 2. Range Reliability: interval coverage
    reliability_val = best.interval_coverage
    reliability_str = f"{reliability_val:.0%}"

    # 3. Risk Warning Quality: how close VaR breach rate is to target 5%
    breach_error = abs(best.var_breach_rate - 0.05)
    if breach_error < 0.03:
        risk_quality = "Good"
        risk_val = 1.0 - breach_error * 10
    elif breach_error < 0.08:
        risk_quality = "Fair"
        risk_val = 0.5
    else:
        risk_quality = "Poor"
        risk_val = max(0.0, 0.3 - breach_error)

    # 4. Baseline Improvement
    improvement_val = primary.improvement_over_baseline
    if improvement_val > 0.01:
        improvement_str = f"+{improvement_val:.0%} over {primary.best_baseline_model}"
    elif improvement_val < -0.01:
        improvement_str = f"Baseline performed better by {abs(improvement_val):.0%}"
    else:
        improvement_str = "Similar to baseline"

    # 5. Model Confidence
    cal = best.calibration_score
    if cal >= 0.65:
        confidence = "High"
    elif cal >= 0.45:
        confidence = "Medium"
    else:
        confidence = "Low"

    return UserFacingMetrics(
        projection_accuracy=accuracy_str,
        projection_accuracy_value=round(accuracy_val, 4),
        range_reliability=reliability_str,
        range_reliability_value=round(reliability_val, 4),
        risk_warning_quality=risk_quality,
        risk_warning_quality_value=round(risk_val, 4),
        baseline_improvement=improvement_str,
        baseline_improvement_value=round(improvement_val, 4),
        model_confidence=confidence,
        model_confidence_value=round(cal, 4),
    )


def _default_user_metrics() -> UserFacingMetrics:
    """Fallback when no validation data is available."""
    return UserFacingMetrics(
        projection_accuracy="N/A",
        projection_accuracy_value=0.0,
        range_reliability="N/A",
        range_reliability_value=0.0,
        risk_warning_quality="N/A",
        risk_warning_quality_value=0.0,
        baseline_improvement="N/A",
        baseline_improvement_value=0.0,
        model_confidence="Low",
        model_confidence_value=0.0,
    )


# ============================================================
# Conclusion generators (plain English, honest)
# ============================================================


def _horizon_conclusion(
    label: str,
    best_model: str,
    beaten: bool,
    improvement: float,
    rankings: List[ModelValidationResult],
    symbol: str,
) -> str:
    """Generates an honest, plain-English conclusion for one horizon."""
    if not rankings:
        return f"Insufficient data to validate {label} projections for {symbol}."

    best = rankings[0]
    coverage = best.interval_coverage
    dir_acc = best.directional_accuracy

    if not beaten:
        # Baseline won — be honest
        if coverage >= 0.75:
            return (
                f"For {label} projections, baseline methods performed best for {symbol}. "
                f"However, the projection range still captured actual prices {coverage:.0%} of the time. "
                f"MSPE is more useful for risk range estimation than exact direction at this horizon."
            )
        else:
            return (
                f"Baseline performed better for {symbol} at the {label} horizon. "
                f"Projection reliability is moderate ({coverage:.0%} range coverage). "
                f"This is an honest result — simpler models sometimes work better."
            )

    # MSPE won
    if improvement > 0.10:
        return (
            f"MSPE's {best.model_name} significantly outperformed baselines for {symbol} "
            f"at the {label} horizon (+{improvement:.0%} improvement). "
            f"Range coverage: {coverage:.0%}, directional accuracy: {dir_acc:.0%}."
        )
    elif improvement > 0.02:
        return (
            f"MSPE improved {label} projection quality for {symbol} by {improvement:.0%} "
            f"over the best baseline. Range coverage: {coverage:.0%}."
        )
    else:
        return (
            f"MSPE marginally improved {label} projections for {symbol}. "
            f"The improvement is small ({improvement:.0%}), suggesting both approaches "
            f"have similar predictive power at this horizon."
        )


def _asset_conclusion(result: AssetComparisonResult) -> str:
    """Generates an overall conclusion for one asset."""
    horizons_beaten = sum(1 for h in result.horizons.values() if h.baseline_beaten)
    total_horizons = len(result.horizons)

    if total_horizons == 0:
        return f"Insufficient data to validate projections for {result.symbol}."

    if horizons_beaten == total_horizons:
        return (
            f"MSPE outperformed baseline models across all tested horizons for {result.symbol}. "
            f"The engine provides meaningful improvement in projection quality."
        )
    elif horizons_beaten > total_horizons / 2:
        beaten_labels = [
            h.horizon_label for h in result.horizons.values() if h.baseline_beaten
        ]
        return (
            f"MSPE improved projection quality for {result.symbol} at {', '.join(beaten_labels)} horizons, "
            f"while baseline methods remained competitive at other horizons."
        )
    elif horizons_beaten > 0:
        beaten_labels = [
            h.horizon_label for h in result.horizons.values() if h.baseline_beaten
        ]
        return (
            f"MSPE showed improvement for {result.symbol} only at {', '.join(beaten_labels)}. "
            f"For other horizons, simpler models performed similarly or better. "
            f"The engine is most useful for risk range estimation."
        )
    else:
        return (
            f"For {result.symbol}, baseline models performed at least as well as advanced methods. "
            f"This is honest — MSPE still provides structured risk analytics and range projections "
            f"that simple price-following cannot."
        )


def build_overall_conclusion(full_result: FullComparisonResult) -> str:
    """Generates the single-paragraph overall conclusion across all assets."""
    assets_where_mspe_dominates = []  # >50% horizons beaten
    assets_with_partial_wins = []  # some horizons beaten
    assets_where_baseline_dominates = []  # 0 horizons beaten

    for sym, acr in full_result.assets.items():
        horizons_beaten = sum(1 for h in acr.horizons.values() if h.baseline_beaten)
        total = len(acr.horizons)

        if horizons_beaten > total / 2:
            assets_where_mspe_dominates.append(sym)
        elif horizons_beaten > 0:
            # Find which horizons MSPE won
            won_labels = [
                h.horizon_label for h in acr.horizons.values() if h.baseline_beaten
            ]
            assets_with_partial_wins.append((sym, won_labels))
        else:
            assets_where_baseline_dominates.append(sym)

    parts = []

    if assets_where_mspe_dominates:
        parts.append(
            f"MSPE outperformed baselines across most horizons for "
            f"{', '.join(assets_where_mspe_dominates)}"
        )

    if assets_with_partial_wins:
        details = []
        for sym, labels in assets_with_partial_wins:
            details.append(f"{sym} ({', '.join(labels)})")
        parts.append(
            f"MSPE improved projection quality at select horizons for "
            f"{', '.join(details)}"
        )

    if assets_where_baseline_dominates:
        parts.append(
            f"simple baseline models remained competitive for "
            f"{', '.join(assets_where_baseline_dominates)}"
        )

    if not parts:
        return "Insufficient data to draw conclusions."

    conclusion = (
        ". ".join(p[0].upper() + p[1:] if i > 0 else p for i, p in enumerate(parts))
        + "."
    )

    # Add honesty + value note
    conclusion += (
        " Where MSPE does not beat baselines on point accuracy, it still provides "
        "structured risk analytics, bear/base/bull scenarios, and Monte Carlo-based "
        "range projections that simple price-following cannot offer."
    )

    return conclusion
