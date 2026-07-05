import numpy as np
from typing import Dict, List, Any, Tuple

class QuantitativeProjectionEngine:
    @staticmethod
    def run_gbm_projection(
        spot: float,
        drift_annual: float,
        volatility_annual: float,
        horizons: List[int] = [1, 3, 7, 30],
        num_paths: int = 10000,
        seed: int = 42
    ) -> Dict[int, Dict[str, float]]:
        """
        Runs a deterministic Geometric Brownian Motion (GBM) simulation
        to calculate projections for specified horizons.
        
        Returns a dict mapping horizon_days -> projection metrics
        """
        np.random.seed(seed)
        dt = 1.0 / 252.0
        max_horizon = max(horizons)
        
        # Generate standard normal increments
        z = np.random.normal(0.0, 1.0, size=(num_paths, max_horizon))
        
        # Accumulate price paths
        paths = np.zeros((num_paths, max_horizon + 1))
        paths[:, 0] = spot
        
        for t in range(1, max_horizon + 1):
            drift_term = (drift_annual - 0.5 * (volatility_annual ** 2)) * dt
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
                "confidence_band_width": p90 - p10
            }
            
        return results
