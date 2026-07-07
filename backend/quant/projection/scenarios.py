"""
Scenario extraction from Monte Carlo simulation paths.

Takes raw simulation paths (numpy array) and produces clean
scenario objects: bear/base/bull prices, probabilities,
expected return, confidence intervals, and sample paths.
"""

import numpy as np
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field


@dataclass
class ScenarioResult:
    """Clean scenario output for one horizon."""

    horizon_days: int
    bear_price: float  # P10
    base_price: float  # P50
    bull_price: float  # P90
    expected_return: float
    probability_of_gain: float
    probability_of_loss: float
    confidence_band_width: float
    projected_volatility: float

    def to_dict(self) -> Dict[str, Any]:
        return {
            "horizon_days": self.horizon_days,
            "bear_price": round(self.bear_price, 2),
            "base_price": round(self.base_price, 2),
            "bull_price": round(self.bull_price, 2),
            "expected_return": round(self.expected_return, 6),
            "probability_of_gain": round(self.probability_of_gain, 4),
            "probability_of_loss": round(self.probability_of_loss, 4),
            "confidence_band_width": round(self.confidence_band_width, 2),
            "projected_volatility": round(self.projected_volatility, 4),
        }


@dataclass
class ProjectionScenarios:
    """Complete scenario output from a Monte Carlo projection run."""

    spot: float
    horizons: List[ScenarioResult] = field(default_factory=list)
    bear_path: List[float] = field(default_factory=list)
    base_path: List[float] = field(default_factory=list)
    bull_path: List[float] = field(default_factory=list)
    sample_paths: List[List[float]] = field(default_factory=list)
    density_prices: List[float] = field(default_factory=list)
    density_values: List[float] = field(default_factory=list)


def extract_scenarios(
    paths: np.ndarray,
    spot: float,
    volatility: float,
    horizons: List[int],
) -> ProjectionScenarios:
    """Extracts scenarios from Monte Carlo simulation paths.

    Args:
        paths: Array of shape (num_paths, max_steps + 1)
        spot: Current price (should equal paths[:, 0])
        volatility: Annualized volatility used in simulation
        horizons: List of horizon days to extract (e.g., [1, 3, 7, 30])

    Returns:
        ProjectionScenarios with all scenario data
    """
    max_step = paths.shape[1] - 1
    result = ProjectionScenarios(spot=spot)

    # Full-path percentile paths
    result.bear_path = [float(np.percentile(paths[:, t], 10.0)) for t in range(paths.shape[1])]
    result.base_path = [float(np.percentile(paths[:, t], 50.0)) for t in range(paths.shape[1])]
    result.bull_path = [float(np.percentile(paths[:, t], 90.0)) for t in range(paths.shape[1])]

    # Sample paths for visualization (5 random paths)
    n_paths = paths.shape[0]
    rng = np.random.RandomState(42)
    sample_indices = rng.choice(n_paths, size=min(5, n_paths), replace=False)
    result.sample_paths = [paths[i].tolist() for i in sample_indices]

    # Per-horizon scenario extraction
    for h in horizons:
        step = min(h, max_step)
        prices_at_h = paths[:, step]

        p10 = float(np.percentile(prices_at_h, 10.0))
        p50 = float(np.percentile(prices_at_h, 50.0))
        p90 = float(np.percentile(prices_at_h, 90.0))

        gains = prices_at_h > spot
        prob_gain = float(np.mean(gains))
        prob_loss = 1.0 - prob_gain

        expected_ret = (p50 - spot) / spot if spot > 0 else 0.0

        scenario = ScenarioResult(
            horizon_days=h,
            bear_price=p10,
            base_price=p50,
            bull_price=p90,
            expected_return=expected_ret,
            probability_of_gain=prob_gain,
            probability_of_loss=prob_loss,
            confidence_band_width=p90 - p10,
            projected_volatility=volatility,
        )
        result.horizons.append(scenario)

    # KDE density at the longest horizon for probability distribution chart
    longest_step = min(max(horizons), max_step)
    terminal_prices = paths[:, longest_step]

    try:
        from scipy.stats import gaussian_kde

        p05 = float(np.percentile(terminal_prices, 5.0))
        p95 = float(np.percentile(terminal_prices, 95.0))
        grid = np.linspace(p05, p95, 30)

        kde = gaussian_kde(terminal_prices)
        densities = kde.evaluate(grid)
        total = np.sum(densities)
        if total > 0:
            densities = densities / total

        result.density_prices = grid.tolist()
        result.density_values = densities.tolist()
    except Exception:
        # scipy not available or KDE failed — skip density
        result.density_prices = []
        result.density_values = []

    return result
