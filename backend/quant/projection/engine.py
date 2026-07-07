"""
MSPE Projection Engine.

Generates Monte Carlo GBM price paths parameterized by model outputs.
This is the core simulation layer that converts (drift, volatility)
estimates into scenario distributions.

Replaces the old engine with:
- Support for model-output-driven parameters
- Non-deterministic seeds with optional reproducibility
- Integration with the new scenarios module
"""

import numpy as np
from typing import Dict, List, Optional

from backend.quant.projection.scenarios import (
    extract_scenarios,
    ProjectionScenarios,
)


class QuantitativeProjectionEngine:
    """GBM Monte Carlo projection engine.

    Takes drift and volatility parameters from the best model
    and generates thousands of simulated price paths.
    """

    @staticmethod
    def run_projection(
        spot: float,
        drift_annual: float,
        volatility_annual: float,
        horizons: List[int] = None,
        num_paths: int = 10000,
        seed: Optional[int] = None,
    ) -> ProjectionScenarios:
        """Runs a Monte Carlo GBM simulation and extracts scenarios.

        Args:
            spot: Current price
            drift_annual: Annualized expected return (from model)
            volatility_annual: Annualized volatility (from model)
            horizons: List of horizon days to extract (default: [1, 3, 7, 30])
            num_paths: Number of simulation paths
            seed: Random seed for reproducibility (None = non-deterministic)

        Returns:
            ProjectionScenarios with all scenario data
        """
        if horizons is None:
            horizons = [1, 3, 7, 30]

        # Bound volatility to prevent numerical issues
        volatility_annual = max(0.001, min(10.0, volatility_annual))

        max_horizon = max(horizons)
        dt = 1.0 / 252.0

        # Generate paths
        rng = np.random.RandomState(seed)
        z = rng.normal(0.0, 1.0, size=(num_paths, max_horizon))

        paths = np.zeros((num_paths, max_horizon + 1))
        paths[:, 0] = spot

        for t in range(1, max_horizon + 1):
            drift_term = (drift_annual - 0.5 * volatility_annual**2) * dt
            vol_term = volatility_annual * np.sqrt(dt) * z[:, t - 1]
            paths[:, t] = paths[:, t - 1] * np.exp(drift_term + vol_term)

        # Extract scenarios
        return extract_scenarios(
            paths=paths,
            spot=spot,
            volatility=volatility_annual,
            horizons=horizons,
        )

    @staticmethod
    def run_gbm_projection(
        spot: float,
        drift_annual: float,
        volatility_annual: float,
        horizons: List[int] = None,
        num_paths: int = 10000,
        seed: int = 42,
    ) -> Dict[int, Dict[str, float]]:
        """Legacy-compatible GBM projection.

        Returns the old dict format for backward compatibility
        with existing API endpoints.
        """
        if horizons is None:
            horizons = [1, 3, 7, 30]

        # Bound volatility
        volatility_annual = max(0.001, min(10.0, volatility_annual))

        max_horizon = max(horizons)
        dt = 1.0 / 252.0

        np.random.seed(seed)
        z = np.random.normal(0.0, 1.0, size=(num_paths, max_horizon))

        paths = np.zeros((num_paths, max_horizon + 1))
        paths[:, 0] = spot

        for t in range(1, max_horizon + 1):
            drift_term = (drift_annual - 0.5 * volatility_annual**2) * dt
            vol_term = volatility_annual * np.sqrt(dt) * z[:, t - 1]
            paths[:, t] = paths[:, t - 1] * np.exp(drift_term + vol_term)

        results = {}
        for h in horizons:
            prices_at_h = paths[:, h]

            p10 = float(np.percentile(prices_at_h, 10.0))
            p50 = float(np.percentile(prices_at_h, 50.0))
            p90 = float(np.percentile(prices_at_h, 90.0))

            gains = prices_at_h > spot
            prob_gain = float(np.mean(gains))
            prob_loss = 1.0 - prob_gain

            expected_ret = (p50 - spot) / spot

            results[h] = {
                "bear_price": p10,
                "base_price": p50,
                "bull_price": p90,
                "expected_return": expected_ret,
                "probability_of_gain": prob_gain,
                "probability_of_loss": prob_loss,
                "projected_volatility": volatility_annual,
                "confidence_band_width": p90 - p10,
            }

        return results
