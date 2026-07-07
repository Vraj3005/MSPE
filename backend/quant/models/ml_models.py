"""
Machine learning projection models for MSPE.

XGBoost dual-head regressor (return + volatility) and an optional
direction classifier. Features are computed internally from raw
price/return/volume arrays — no database dependency.

Uses xgboost and scikit-learn, both already in requirements.txt.
"""

import numpy as np
from typing import Dict, Optional
import warnings


def build_features(
    prices: np.ndarray,
    returns: np.ndarray,
    volumes: Optional[np.ndarray] = None,
) -> np.ndarray:
    """Builds a feature matrix from raw price/return/volume arrays.

    Features per row:
    0:  return_lag_1
    1:  return_lag_2
    2:  return_lag_3
    3:  return_lag_5
    4:  return_lag_10
    5:  rolling_mean_5d
    6:  rolling_mean_10d
    7:  rolling_mean_20d
    8:  rolling_vol_10d
    9:  rolling_vol_20d
    10: rolling_vol_30d
    11: momentum (price / sma20 - 1)
    12: drawdown from peak
    13: ma_distance (price / ema20 - 1)
    14: volume_change (if available, else 0)
    15: volatility_percentile (current 20d vol rank in 252d)

    Returns shape: (n, 16). First ~30 rows will have partial lookback.
    """
    n = len(returns)
    features = np.zeros((n, 16))

    # Lagged returns
    for i in range(n):
        features[i, 0] = returns[i - 1] if i >= 1 else 0.0
        features[i, 1] = returns[i - 2] if i >= 2 else 0.0
        features[i, 2] = returns[i - 3] if i >= 3 else 0.0
        features[i, 3] = returns[i - 5] if i >= 5 else 0.0
        features[i, 4] = returns[i - 10] if i >= 10 else 0.0

    # Rolling statistics
    for i in range(n):
        # Rolling mean returns
        if i >= 5:
            features[i, 5] = np.mean(returns[i - 5 : i])
        if i >= 10:
            features[i, 6] = np.mean(returns[i - 10 : i])
        if i >= 20:
            features[i, 7] = np.mean(returns[i - 20 : i])

        # Rolling volatility
        if i >= 10:
            features[i, 8] = np.std(returns[i - 10 : i])
        if i >= 20:
            features[i, 9] = np.std(returns[i - 20 : i])
        if i >= 30:
            features[i, 10] = np.std(returns[i - 30 : i])

    # Price-based features (need prices array, which has len = len(returns) + 1)
    # Align: prices[i+1] corresponds to returns[i]
    for i in range(n):
        price_idx = i + 1  # prices is 1 longer than returns
        if price_idx >= len(prices):
            price_idx = len(prices) - 1
        current_price = prices[price_idx]

        # Momentum: price / SMA(20) - 1
        if price_idx >= 20 and current_price > 0:
            sma20 = np.mean(prices[price_idx - 20 : price_idx])
            features[i, 11] = (current_price / sma20 - 1.0) if sma20 > 0 else 0.0

        # Drawdown from running peak
        if price_idx >= 1:
            peak = np.max(prices[: price_idx + 1])
            features[i, 12] = (current_price - peak) / peak if peak > 0 else 0.0

        # MA distance: price / EMA(20) - 1
        if price_idx >= 20 and current_price > 0:
            # Simple approximation of EMA using pandas-style calculation
            alpha = 2.0 / 21.0
            ema = prices[price_idx - 20]
            for j in range(price_idx - 19, price_idx + 1):
                ema = alpha * prices[j] + (1 - alpha) * ema
            features[i, 13] = (current_price / ema - 1.0) if ema > 0 else 0.0

    # Volume change
    if volumes is not None and len(volumes) > 1:
        for i in range(n):
            vol_idx = i + 1
            if vol_idx < len(volumes) and vol_idx >= 1 and volumes[vol_idx - 1] > 0:
                features[i, 14] = (
                    volumes[vol_idx] / volumes[vol_idx - 1] - 1.0
                )

    # Volatility percentile: rank of current 20d vol within 252d window
    for i in range(n):
        if i >= 252:
            current_vol = np.std(returns[i - 20 : i]) if i >= 20 else 0.0
            historical_vols = []
            for j in range(i - 252, i - 20):
                if j >= 20:
                    historical_vols.append(np.std(returns[j - 20 : j]))
            if historical_vols:
                features[i, 15] = float(
                    np.mean(np.array(historical_vols) <= current_vol)
                )
        elif i >= 60:
            current_vol = np.std(returns[i - 20 : i]) if i >= 20 else 0.0
            historical_vols = []
            for j in range(20, i - 20):
                if j >= 20:
                    historical_vols.append(np.std(returns[j - 20 : j]))
            if historical_vols:
                features[i, 15] = float(
                    np.mean(np.array(historical_vols) <= current_vol)
                )

    return features


class XGBoostReturnModel:
    """XGBoost dual-head model: predicts expected return and volatility.

    Trains two separate XGBRegressor models:
    - Return head: predicts the next-day log return
    - Volatility head: predicts the next 5-day realized volatility (annualized)

    Features are built internally via build_features().
    """

    name = "xgboost"

    def __init__(
        self,
        n_estimators: int = 50,
        max_depth: int = 3,
        learning_rate: float = 0.05,
    ):
        self._n_estimators = n_estimators
        self._max_depth = max_depth
        self._learning_rate = learning_rate
        self._model_ret = None
        self._model_vol = None
        self._latest_features = None
        self._returns = None

    def fit(
        self,
        prices: np.ndarray,
        returns: np.ndarray,
        volumes: Optional[np.ndarray] = None,
    ) -> "XGBoostReturnModel":
        self._returns = returns

        if len(returns) < 40:
            return self

        features = build_features(prices, returns, volumes)

        # Target: next-day return (shift by -1)
        target_ret = np.roll(returns, -1)

        # Target: next 5-day realized volatility (annualized)
        target_vol = np.zeros(len(returns))
        for i in range(len(returns) - 5):
            target_vol[i] = np.std(returns[i + 1 : i + 6]) * np.sqrt(252)

        # Remove boundary effects: skip first 30 rows (warmup) and last 5 (target leakage)
        start_idx = 30
        end_idx = len(returns) - 5
        if end_idx <= start_idx + 10:
            return self

        X = features[start_idx:end_idx]
        y_ret = target_ret[start_idx:end_idx]
        y_vol = target_vol[start_idx:end_idx]

        self._latest_features = features[-1]

        try:
            from xgboost import XGBRegressor

            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                self._model_ret = XGBRegressor(
                    n_estimators=self._n_estimators,
                    max_depth=self._max_depth,
                    learning_rate=self._learning_rate,
                    random_state=42,
                    verbosity=0,
                )
                self._model_ret.fit(X, y_ret)

                self._model_vol = XGBRegressor(
                    n_estimators=self._n_estimators,
                    max_depth=self._max_depth,
                    learning_rate=self._learning_rate,
                    random_state=42,
                    verbosity=0,
                )
                self._model_vol.fit(X, y_vol)
        except Exception:
            self._model_ret = None
            self._model_vol = None

        return self

    def predict(self, horizon: int) -> Dict[str, float]:
        lookback = min(30, len(self._returns))
        hist_ret = float(np.mean(self._returns[-lookback:]) * horizon)
        hist_vol = float(np.std(self._returns[-lookback:]) * np.sqrt(252))

        if (
            self._model_ret is None
            or self._model_vol is None
            or self._latest_features is None
        ):
            return {
                "expected_return": hist_ret,
                "expected_volatility": max(0.001, hist_vol),
                "model_name": self.name,
            }

        try:
            X_inf = self._latest_features.reshape(1, -1)

            # Predict daily return and scale to horizon
            pred_daily_ret = float(self._model_ret.predict(X_inf)[0])
            expected_return = pred_daily_ret * horizon

            # Predict annualized volatility
            expected_vol = float(self._model_vol.predict(X_inf)[0])
            expected_vol = max(0.001, min(10.0, expected_vol))

            return {
                "expected_return": expected_return,
                "expected_volatility": expected_vol,
                "model_name": self.name,
            }
        except Exception:
            return {
                "expected_return": hist_ret,
                "expected_volatility": max(0.001, hist_vol),
                "model_name": self.name,
            }
