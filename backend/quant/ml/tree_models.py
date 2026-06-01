import os
import joblib
from typing import Dict, Any, Optional
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from xgboost import XGBRegressor
from sklearn.model_selection import RandomizedSearchCV

from backend.quant.ml.base import BaseForecaster
from backend.app.core.logging import logger

class XGBoostForecaster(BaseForecaster):
    def __init__(self, n_estimators: int = 100, max_depth: int = 3, learning_rate: float = 0.05):
        self.n_estimators = n_estimators
        self.max_depth = max_depth
        self.learning_rate = learning_rate
        self.model_ret = None
        self.model_vol = None
        self.latest_features = None
        self.history_returns = None

    def fit(self, prices: np.ndarray, returns: np.ndarray, features: Optional[np.ndarray] = None) -> "XGBoostForecaster":
        """Fits double regression heads: one for expected return and one for expected volatility.
        
        features array: Matrix shape (N, D) containing lag returns, RSI, MACD, and volatilities.
        """
        self.history_returns = returns.tolist()
        
        # Fallback to random features if not provided
        if features is None or len(features) < 15:
            logger.warning("Features array not provided or too short. Generating fallback lag features.")
            features = self._create_lag_features(returns)
        
        # We target a 1-day step target for base fitting, horizons are scaled in predict()
        # Returns target: Next day return
        # Volatility target: Next day rolling volatility estimate
        target_ret = np.roll(returns, -1)
        # Target realized volatility over next 3 days
        target_vol = np.zeros_like(returns)
        for i in range(len(returns) - 3):
            target_vol[i] = np.std(returns[i+1:i+4]) * np.sqrt(252)

        # Slice away boundary effects at the end
        X = features[:-3]
        y_ret = target_ret[:-3]
        y_vol = target_vol[:-3]
        
        self.latest_features = features[-1] # Store latest features for forward inference
        
        logger.info(f"Training XGBoost double-heads on {len(X)} samples...")
        try:
            self.model_ret = XGBRegressor(n_estimators=self.n_estimators, max_depth=self.max_depth, learning_rate=self.learning_rate)
            self.model_ret.fit(X, y_ret)
            
            self.model_vol = XGBRegressor(n_estimators=self.n_estimators, max_depth=self.max_depth, learning_rate=self.learning_rate)
            self.model_vol.fit(X, y_vol)
        except Exception as e:
            logger.error(f"XGBoost fit failed: {e}. Falling back to default estimators.")
            self.model_ret = None
            self.model_vol = None
        return self

    def tune_hyperparameters(self, X: np.ndarray, y_ret: np.ndarray, y_vol: np.ndarray) -> None:
        """Tuning estimators using randomized cross-validation."""
        logger.info("Executing XGBoost hyperparameter tuning...")
        param_dist = {
            "n_estimators": [50, 100, 150],
            "max_depth": [2, 3, 5],
            "learning_rate": [0.01, 0.05, 0.1]
        }
        try:
            rs_ret = RandomizedSearchCV(XGBRegressor(), param_distributions=param_dist, n_iter=5, cv=3, random_state=42)
            rs_ret.fit(X, y_ret)
            self.model_ret = rs_ret.best_estimator_
            self.n_estimators = rs_ret.best_params_["n_estimators"]
            self.max_depth = rs_ret.best_params_["max_depth"]
            self.learning_rate = rs_ret.best_params_["learning_rate"]
            
            rs_vol = RandomizedSearchCV(XGBRegressor(), param_distributions=param_dist, n_iter=5, cv=3, random_state=42)
            rs_vol.fit(X, y_vol)
            self.model_vol = rs_vol.best_estimator_
            logger.info(f"Optimal parameters found: n_estimators={self.n_estimators}, max_depth={self.max_depth}")
        except Exception as e:
            logger.warning(f"Hyperparameter tuning failed: {e}. Reverting to standard defaults.")

    def predict(self, horizon: int) -> Dict[str, float]:
        hist_vol = float(np.std(self.history_returns[-30:]) * np.sqrt(252))
        hist_ret = float(np.mean(self.history_returns[-30:]) * horizon)

        if self.model_ret is None or self.model_vol is None or self.latest_features is None:
            return {"expected_return": hist_ret, "expected_volatility": hist_vol}

        try:
            X_inf = self.latest_features.reshape(1, -1)
            # Predict daily expected return and scale over the horizon
            pred_daily_ret = float(self.model_ret.predict(X_inf)[0])
            expected_return = pred_daily_ret * horizon
            
            # Predict annualized expected volatility over horizon
            expected_volatility = float(self.model_vol.predict(X_inf)[0])
            
            # Bound expected volatility with safe minimum bounds
            expected_volatility = max(0.001, expected_volatility)

            return {
                "expected_return": expected_return,
                "expected_volatility": expected_volatility
            }
        except Exception as e:
            logger.error(f"XGBoost predict failed: {e}")
            return {"expected_return": hist_ret, "expected_volatility": hist_vol}

    def _create_lag_features(self, returns: np.ndarray, lags: int = 5) -> np.ndarray:
        """Helper to dynamically generate features matrix if none was parsed."""
        n = len(returns)
        features = []
        for i in range(n):
            if i < lags:
                features.append(np.zeros(lags))
                continue
            features.append(returns[i-lags:i])
        return np.array(features)

    def save(self, file_path: str) -> None:
        state = {
            "n_estimators": self.n_estimators,
            "max_depth": self.max_depth,
            "learning_rate": self.learning_rate,
            "model_ret": self.model_ret,
            "model_vol": self.model_vol,
            "latest_features": self.latest_features,
            "history_returns": self.history_returns
        }
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        joblib.dump(state, file_path)

    def load(self, file_path: str) -> "XGBoostForecaster":
        state = joblib.load(file_path)
        self.n_estimators = state["n_estimators"]
        self.max_depth = state["max_depth"]
        self.learning_rate = state["learning_rate"]
        self.model_ret = state["model_ret"]
        self.model_vol = state["model_vol"]
        self.latest_features = state["latest_features"]
        self.history_returns = state["history_returns"]
        return self


class RandomForestForecaster(BaseForecaster):
    def __init__(self, n_estimators: int = 100, max_depth: int = 5):
        self.n_estimators = n_estimators
        self.max_depth = max_depth
        self.model_ret = None
        self.model_vol = None
        self.latest_features = None
        self.history_returns = None

    def fit(self, prices: np.ndarray, returns: np.ndarray, features: Optional[np.ndarray] = None) -> "RandomForestForecaster":
        self.history_returns = returns.tolist()
        
        if features is None or len(features) < 15:
            features = self._create_lag_features(returns)
        
        target_ret = np.roll(returns, -1)
        target_vol = np.zeros_like(returns)
        for i in range(len(returns) - 3):
            target_vol[i] = np.std(returns[i+1:i+4]) * np.sqrt(252)

        X = features[:-3]
        y_ret = target_ret[:-3]
        y_vol = target_vol[:-3]
        
        self.latest_features = features[-1]
        
        logger.info(f"Training Random Forest double-heads on {len(X)} samples...")
        try:
            self.model_ret = RandomForestRegressor(n_estimators=self.n_estimators, max_depth=self.max_depth, random_state=42)
            self.model_ret.fit(X, y_ret)
            
            self.model_vol = RandomForestRegressor(n_estimators=self.n_estimators, max_depth=self.max_depth, random_state=42)
            self.model_vol.fit(X, y_vol)
        except Exception as e:
            logger.error(f"Random Forest fit failed: {e}")
            self.model_ret = None
            self.model_vol = None
        return self

    def predict(self, horizon: int) -> Dict[str, float]:
        hist_vol = float(np.std(self.history_returns[-30:]) * np.sqrt(252))
        hist_ret = float(np.mean(self.history_returns[-30:]) * horizon)

        if self.model_ret is None or self.model_vol is None or self.latest_features is None:
            return {"expected_return": hist_ret, "expected_volatility": hist_vol}

        try:
            X_inf = self.latest_features.reshape(1, -1)
            pred_daily_ret = float(self.model_ret.predict(X_inf)[0])
            expected_return = pred_daily_ret * horizon
            
            expected_volatility = float(self.model_vol.predict(X_inf)[0])
            expected_volatility = max(0.001, expected_volatility)

            return {
                "expected_return": expected_return,
                "expected_volatility": expected_volatility
            }
        except Exception as e:
            logger.error(f"Random Forest predict failed: {e}")
            return {"expected_return": hist_ret, "expected_volatility": hist_vol}

    def _create_lag_features(self, returns: np.ndarray, lags: int = 5) -> np.ndarray:
        n = len(returns)
        features = []
        for i in range(n):
            if i < lags:
                features.append(np.zeros(lags))
                continue
            features.append(returns[i-lags:i])
        return np.array(features)

    def save(self, file_path: str) -> None:
        state = {
            "n_estimators": self.n_estimators,
            "max_depth": self.max_depth,
            "model_ret": self.model_ret,
            "model_vol": self.model_vol,
            "latest_features": self.latest_features,
            "history_returns": self.history_returns
        }
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        joblib.dump(state, file_path)

    def load(self, file_path: str) -> "RandomForestForecaster":
        state = joblib.load(file_path)
        self.n_estimators = state["n_estimators"]
        self.max_depth = state["max_depth"]
        self.model_ret = state["model_ret"]
        self.model_vol = state["model_vol"]
        self.latest_features = state["latest_features"]
        self.history_returns = state["history_returns"]
        return self
