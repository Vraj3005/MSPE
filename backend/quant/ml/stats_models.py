import os
import joblib
from typing import Dict, Any, Optional
import numpy as np
from statsmodels.tsa.arima.model import ARIMA
from statsmodels.tsa.statespace.sarimax import SARIMAX
from arch import arch_model

from backend.quant.ml.base import BaseForecaster
from backend.app.core.logging import logger

class ARIMAForecaster(BaseForecaster):
    def __init__(self, p: int = 1, d: int = 1, q: int = 1):
        self.p = p
        self.d = d
        self.q = q
        self.model_res = None
        self.history_prices = None
        self.history_returns = None

    def fit(self, prices: np.ndarray, returns: np.ndarray, features: Optional[np.ndarray] = None) -> "ARIMAForecaster":
        self.history_prices = prices.tolist()
        self.history_returns = returns.tolist()
        
        # Fit ARIMA model on prices or returns
        # For return projections, fitting on prices with d=1 is equivalent to modeled returns
        logger.info(f"Fitting ARIMA({self.p},{self.d},{self.q}) on {len(prices)} bars...")
        try:
            model = ARIMA(prices, order=(self.p, self.d, self.q))
            self.model_res = model.fit(method="statespace")
        except Exception as e:
            logger.warning(f"ARIMA fit failed to converge: {e}. Falling back to simple historical estimators.")
            self.model_res = None
        return self

    def predict(self, horizon: int) -> Dict[str, float]:
        if self.model_res is None or len(self.history_prices) == 0:
            # Safe historical fallback
            return {
                "expected_return": float(np.mean(self.history_returns[-30:]) * horizon),
                "expected_volatility": float(np.std(self.history_returns[-30:]) * np.sqrt(252))
            }
        
        try:
            # Predict future price points
            current_price = self.history_prices[-1]
            forecast = self.model_res.forecast(steps=horizon)
            expected_price = forecast[-1]
            
            # Cumulative return: (Expected_Price / Current_Price) - 1
            expected_return = float((expected_price / current_price) - 1.0)
            
            # Estimate volatility based on fitted residuals standard deviation (relative to current price)
            residuals = self.model_res.resid
            expected_volatility = float((np.std(residuals[-30:]) / current_price) * np.sqrt(252)) if current_price > 0 else 0.20
            
            # Enforce reasonable upper bound for volatility to avoid database numerical constraints
            expected_volatility = min(999.0, max(0.0001, expected_volatility))
            
            return {
                "expected_return": expected_return,
                "expected_volatility": expected_volatility
            }
        except Exception as e:
            logger.error(f"ARIMA prediction exception: {e}. Executing fallback.")
            return {
                "expected_return": float(np.mean(self.history_returns[-30:]) * horizon),
                "expected_volatility": float(np.std(self.history_returns[-30:]) * np.sqrt(252))
            }

    def save(self, file_path: str) -> None:
        state = {
            "p": self.p, "d": self.d, "q": self.q,
            "history_prices": self.history_prices,
            "history_returns": self.history_returns,
            "model_res": self.model_res
        }
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        joblib.dump(state, file_path)

    def load(self, file_path: str) -> "ARIMAForecaster":
        state = joblib.load(file_path)
        self.p = state["p"]
        self.d = state["d"]
        self.q = state["q"]
        self.history_prices = state["history_prices"]
        self.history_returns = state["history_returns"]
        self.model_res = state["model_res"]
        return self


class SARIMAForecaster(BaseForecaster):
    def __init__(self, p: int = 1, d: int = 1, q: int = 1, P: int = 0, D: int = 0, Q: int = 0, s: int = 7):
        self.p = p
        self.d = d
        self.q = q
        self.P = P
        self.D = D
        self.Q = Q
        self.s = s
        self.model_res = None
        self.history_prices = None
        self.history_returns = None

    def fit(self, prices: np.ndarray, returns: np.ndarray, features: Optional[np.ndarray] = None) -> "SARIMAForecaster":
        self.history_prices = prices.tolist()
        self.history_returns = returns.tolist()
        
        logger.info(f"Fitting SARIMA({self.p},{self.d},{self.q})x({self.P},{self.D},{self.Q}){self.s}...")
        try:
            model = SARIMAX(prices, order=(self.p, self.d, self.q), seasonal_order=(self.P, self.D, self.Q, self.s))
            self.model_res = model.fit(disp=False, maxiter=50)
        except Exception as e:
            logger.warning(f"SARIMA fit failed: {e}. Falling back.")
            self.model_res = None
        return self

    def predict(self, horizon: int) -> Dict[str, float]:
        if self.model_res is None or len(self.history_prices) == 0:
            return {
                "expected_return": float(np.mean(self.history_returns[-30:]) * horizon),
                "expected_volatility": float(np.std(self.history_returns[-30:]) * np.sqrt(252))
            }
        
        try:
            current_price = self.history_prices[-1]
            forecast = self.model_res.forecast(steps=horizon)
            expected_price = forecast[-1]
            
            expected_return = float((expected_price / current_price) - 1.0)
            residuals = self.model_res.resid
            expected_volatility = float((np.std(residuals[-30:]) / current_price) * np.sqrt(252)) if current_price > 0 else 0.20
            
            # Enforce reasonable upper bound for volatility to avoid database numerical constraints
            expected_volatility = min(999.0, max(0.0001, expected_volatility))
            
            return {
                "expected_return": expected_return,
                "expected_volatility": expected_volatility
            }
        except Exception as e:
            logger.error(f"SARIMA prediction exception: {e}")
            return {
                "expected_return": float(np.mean(self.history_returns[-30:]) * horizon),
                "expected_volatility": float(np.std(self.history_returns[-30:]) * np.sqrt(252))
            }

    def save(self, file_path: str) -> None:
        state = {
            "p": self.p, "d": self.d, "q": self.q,
            "P": self.P, "D": self.D, "Q": self.Q, "s": self.s,
            "history_prices": self.history_prices,
            "history_returns": self.history_returns,
            "model_res": self.model_res
        }
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        joblib.dump(state, file_path)

    def load(self, file_path: str) -> "SARIMAForecaster":
        state = joblib.load(file_path)
        self.p = state["p"]
        self.d = state["d"]
        self.q = state["q"]
        self.P = state["P"]
        self.D = state["D"]
        self.Q = state["Q"]
        self.s = state["s"]
        self.history_prices = state["history_prices"]
        self.history_returns = state["history_returns"]
        self.model_res = state["model_res"]
        return self


class GARCHForecaster(BaseForecaster):
    def __init__(self, p: int = 1, q: int = 1):
        self.p = p
        self.q = q
        self.model_res = None
        self.history_returns = None

    def fit(self, prices: np.ndarray, returns: np.ndarray, features: Optional[np.ndarray] = None) -> "GARCHForecaster":
        # GARCH operates strictly on return series (scaled by 100 for mathematical fitting stability)
        self.history_returns = returns.tolist()
        scaled_returns = returns * 100.0
        
        logger.info(f"Fitting GARCH({self.p},{self.q}) volatility model on {len(returns)} bars...")
        try:
            model = arch_model(scaled_returns, vol="Garch", p=self.p, q=self.q, dist="normal", rescale=False)
            self.model_res = model.fit(disp="off")
        except Exception as e:
            logger.warning(f"GARCH calibration failed: {e}. Falling back to historical standard deviation.")
            self.model_res = None
        return self

    def predict(self, horizon: int) -> Dict[str, float]:
        hist_vol = float(np.std(self.history_returns[-30:]) * np.sqrt(252))
        hist_ret = float(np.mean(self.history_returns[-30:]) * horizon)

        if self.model_res is None:
            return {
                "expected_return": hist_ret,
                "expected_volatility": hist_vol
            }

        try:
            # Predict conditional variance forward
            forecasts = self.model_res.forecast(horizon=horizon)
            variance_forecast = forecasts.variance.values[-1] # shape (horizon,)
            expected_variance_scaled = variance_forecast[-1]
            
            # GARCH fits scaled returns (r * 100), so we must descale the volatility result
            expected_volatility_daily = np.sqrt(expected_variance_scaled) / 100.0
            expected_volatility = float(expected_volatility_daily * np.sqrt(252))
            
            # Since GARCH models volatility, returns are forecasted as the fitted mean component
            mu = float(self.model_res.params.get("mu", np.mean(self.history_returns) * 100.0)) / 100.0
            expected_return = float(mu * horizon)

            return {
                "expected_return": expected_return,
                "expected_volatility": expected_volatility
            }
        except Exception as e:
            logger.error(f"GARCH prediction exception: {e}")
            return {
                "expected_return": hist_ret,
                "expected_volatility": hist_vol
            }

    def save(self, file_path: str) -> None:
        state = {
            "p": self.p, "q": self.q,
            "history_returns": self.history_returns,
            "model_res": self.model_res
        }
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        joblib.dump(state, file_path)

    def load(self, file_path: str) -> "GARCHForecaster":
        state = joblib.load(file_path)
        self.p = state["p"]
        self.q = state["q"]
        self.history_returns = state["history_returns"]
        self.model_res = state["model_res"]
        return self
