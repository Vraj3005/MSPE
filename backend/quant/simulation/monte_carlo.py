from typing import Dict, List, Any, Tuple
import numpy as np
from scipy.stats import gaussian_kde

from backend.app.core.logging import logger

class MonteCarloSimulator:
    def __init__(self, spot: float, drift: float, volatility: float, num_paths: int = 10000, steps: int = 7):
        self.spot = spot
        
        # Annualized drift and volatility parameters
        self.drift = drift
        self.volatility = volatility
        self.num_paths = num_paths
        self.steps = steps
        
        # Daily discretization step (1 business trading day)
        self.dt = 1.0 / 252.0

    def generate_paths(self) -> np.ndarray:
        """Simulates 10,000 geometric Brownian motion price paths.
        
        Returns a numpy array of shape (num_paths, steps + 1)
        """
        logger.info(f"Generating {self.num_paths} Monte Carlo paths over {self.steps} steps...")
        
        # Set stable random seed for model consistency
        np.random.seed(42)
        
        # Generate random standard normal increments: shape (num_paths, steps)
        z = np.random.normal(0.0, 1.0, size=(self.num_paths, self.steps))
        
        # Euler-Maruyama accumulation paths matrix: shape (num_paths, steps + 1)
        paths = np.zeros((self.num_paths, self.steps + 1))
        paths[:, 0] = self.spot
        
        # Cumulative exponent simulation
        for t in range(1, self.steps + 1):
            drift_term = (self.drift - 0.5 * (self.volatility ** 2)) * self.dt
            vol_term = self.volatility * np.sqrt(self.dt) * z[:, t - 1]
            paths[:, t] = paths[:, t - 1] * np.exp(drift_term + vol_term)
            
        return paths

    def extract_scenarios(self, paths: np.ndarray) -> Dict[str, np.ndarray]:
        """Compiles confidence scenario paths for Bear (p10), Base (p50), and Bull (p90) states."""
        # Quantiles shape: (steps + 1,)
        p10 = np.percentile(paths, 10.0, axis=0)
        p50 = np.percentile(paths, 50.0, axis=0)
        p90 = np.percentile(paths, 90.0, axis=0)
        
        return {
            "bear_scenario": p10,
            "base_scenario": p50,
            "bull_scenario": p90
        }

    def calculate_density_grid(
        self, paths: np.ndarray, step_indices: List[int], grid_points: int = 20
    ) -> List[Dict[str, Any]]:
        """Applies Kernel Density Estimation (KDE) to compile continuous 3D coordinate meshes.
        
        Returns a list of dicts: {"step": int, "prices": np.ndarray, "densities": np.ndarray, "p10", "p50", "p90"}
        """
        logger.info(f"Computing continuous Kernel Density Estimations (KDE) at steps {step_indices}...")
        
        scenarios = self.extract_scenarios(paths)
        results = []
        
        for step in step_indices:
            # Safely clamp step bounds
            s_idx = max(0, min(step, self.steps))
            prices_at_step = paths[:, s_idx]
            
            # Retrieve percentile bounds for this step to establish the price grid domain
            p10 = float(scenarios["bear_scenario"][s_idx])
            p50 = float(scenarios["base_scenario"][s_idx])
            p90 = float(scenarios["bull_scenario"][s_idx])
            
            # Construct Price Y-Axis grid coordinate points between P5 and P95 to capture full density curves
            p05 = float(np.percentile(prices_at_step, 5.0))
            p95 = float(np.percentile(prices_at_step, 95.0))
            grid_prices = np.linspace(p05, p95, grid_points)
            
            # Fit continuous probability density function
            kde = gaussian_kde(prices_at_step)
            densities = kde.evaluate(grid_prices)
            
            # Normalise densities to keep weights stable
            sum_densities = np.sum(densities)
            norm_densities = densities / sum_densities if sum_densities > 0.0 else densities
            
            results.append({
                "step": s_idx,
                "prices": grid_prices,
                "densities": norm_densities,
                "p10_price": p10,
                "p50_price": p50,
                "p90_price": p90
            })
            
        return results
