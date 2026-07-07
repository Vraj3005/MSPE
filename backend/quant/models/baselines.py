"""
Baseline projection models for MSPE.

These models exist so MSPE can prove its statistical and ML models
are actually better than simple guessing. If a baseline wins,
MSPE honestly reports that.

All models follow the same interface:
    fit(prices, returns, volumes=None) -> self
    predict(horizon) -> dict with expected_return, expected_volatility, model_name

No database dependency. Pure numpy.
"""

import numpy as np
from typing import Dict, Optional


class LastPriceBaseline:
    """Predicts that the future price equals the current price.

    Expected return = 0. Volatility = recent realized vol.
    This is the absolute minimum bar any model must beat.
    """

    name = "last_price_baseline"

    def __init__(self):
        self._returns = None

    def fit(
        self,
        prices: np.ndarray,
        returns: np.ndarray,
        volumes: Optional[np.ndarray] = None,
    ) -> "LastPriceBaseline":
        self._returns = returns
        return self

    def predict(self, horizon: int) -> Dict[str, float]:
        # Volatility: 30-day rolling std, annualized
        lookback = min(30, len(self._returns))
        vol = float(np.std(self._returns[-lookback:]) * np.sqrt(252))
        return {
            "expected_return": 0.0,
            "expected_volatility": max(0.001, vol),
            "model_name": self.name,
        }


class HistoricalMeanBaseline:
    """Predicts that the future return equals the long-run mean daily return.

    Uses the full available history to estimate the mean.
    """

    name = "historical_mean_baseline"

    def __init__(self):
        self._returns = None

    def fit(
        self,
        prices: np.ndarray,
        returns: np.ndarray,
        volumes: Optional[np.ndarray] = None,
    ) -> "HistoricalMeanBaseline":
        self._returns = returns
        return self

    def predict(self, horizon: int) -> Dict[str, float]:
        mean_daily = float(np.mean(self._returns))
        vol = float(np.std(self._returns) * np.sqrt(252))
        return {
            "expected_return": mean_daily * horizon,
            "expected_volatility": max(0.001, vol),
            "model_name": self.name,
        }


class RollingMeanBaseline:
    """Predicts return = recent 30-day mean daily return × horizon.

    More responsive to recent trends than the full-history mean.
    """

    name = "rolling_mean_baseline"

    def __init__(self, window: int = 30):
        self._window = window
        self._returns = None

    def fit(
        self,
        prices: np.ndarray,
        returns: np.ndarray,
        volumes: Optional[np.ndarray] = None,
    ) -> "RollingMeanBaseline":
        self._returns = returns
        return self

    def predict(self, horizon: int) -> Dict[str, float]:
        lookback = min(self._window, len(self._returns))
        recent = self._returns[-lookback:]
        mean_daily = float(np.mean(recent))
        vol = float(np.std(recent) * np.sqrt(252))
        return {
            "expected_return": mean_daily * horizon,
            "expected_volatility": max(0.001, vol),
            "model_name": self.name,
        }


class RollingVolBaseline:
    """Predicts return = 0, volatility = 30-day rolling standard deviation.

    This baseline tests whether a model's volatility estimate
    is better than a simple rolling window.
    """

    name = "rolling_vol_baseline"

    def __init__(self, window: int = 30):
        self._window = window
        self._returns = None

    def fit(
        self,
        prices: np.ndarray,
        returns: np.ndarray,
        volumes: Optional[np.ndarray] = None,
    ) -> "RollingVolBaseline":
        self._returns = returns
        return self

    def predict(self, horizon: int) -> Dict[str, float]:
        lookback = min(self._window, len(self._returns))
        vol = float(np.std(self._returns[-lookback:]) * np.sqrt(252))
        return {
            "expected_return": 0.0,
            "expected_volatility": max(0.001, vol),
            "model_name": self.name,
        }
