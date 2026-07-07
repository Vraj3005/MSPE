"""
Statistical forecasting models for MSPE.

Uses statsmodels (ARIMA) and arch (GARCH) — both already in requirements.txt.
EWMA is pure numpy with no external dependency.

All models follow the same interface:
    fit(prices, returns, volumes=None) -> self
    predict(horizon) -> dict with expected_return, expected_volatility, model_name
"""

import numpy as np
from typing import Dict, Optional
import warnings


class ARIMAModel:
    """ARIMA(1,1,1) price-level forecast.

    Fits on prices with first differencing (d=1).
    Predicts the future price level, then converts to expected return.
    Volatility is estimated from the model's residual standard deviation.
    """

    name = "arima"

    def __init__(self, p: int = 1, d: int = 1, q: int = 1):
        self._p = p
        self._d = d
        self._q = q
        self._model_res = None
        self._prices = None
        self._returns = None

    def fit(
        self,
        prices: np.ndarray,
        returns: np.ndarray,
        volumes: Optional[np.ndarray] = None,
    ) -> "ARIMAModel":
        self._prices = prices
        self._returns = returns

        try:
            from statsmodels.tsa.arima.model import ARIMA

            # Limit to last 120 prices for speed (sufficient for ARIMA(1,1,1))
            fit_prices = prices[-120:] if len(prices) > 120 else prices

            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                model = ARIMA(fit_prices, order=(self._p, self._d, self._q))
                self._model_res = model.fit(method="innovations_mle")
        except Exception:
            self._model_res = None
        return self

    def predict(self, horizon: int) -> Dict[str, float]:
        # Fallback values from recent history
        lookback = min(30, len(self._returns))
        hist_ret = float(np.mean(self._returns[-lookback:]) * horizon)
        hist_vol = float(np.std(self._returns[-lookback:]) * np.sqrt(252))

        if self._model_res is None or len(self._prices) == 0:
            return {
                "expected_return": hist_ret,
                "expected_volatility": max(0.001, hist_vol),
                "model_name": self.name,
            }

        try:
            current_price = self._prices[-1]
            forecast = self._model_res.forecast(steps=horizon)
            expected_price = forecast.iloc[-1] if hasattr(forecast, "iloc") else forecast[-1]

            expected_return = float((expected_price / current_price) - 1.0)

            # Volatility from residuals
            residuals = self._model_res.resid
            res_lookback = min(30, len(residuals))
            expected_vol = (
                float(
                    (np.std(residuals[-res_lookback:]) / current_price) * np.sqrt(252)
                )
                if current_price > 0
                else hist_vol
            )

            return {
                "expected_return": expected_return,
                "expected_volatility": max(0.001, min(10.0, expected_vol)),
                "model_name": self.name,
            }
        except Exception:
            return {
                "expected_return": hist_ret,
                "expected_volatility": max(0.001, hist_vol),
                "model_name": self.name,
            }


class GARCHModel:
    """GARCH(1,1) conditional volatility forecast.

    The primary output is a forward-looking volatility estimate
    that captures volatility clustering (periods of high vol
    tend to follow periods of high vol).

    Return forecast uses the fitted conditional mean (mu).
    """

    name = "garch"

    def __init__(self, p: int = 1, q: int = 1):
        self._p = p
        self._q = q
        self._model_res = None
        self._returns = None

    def fit(
        self,
        prices: np.ndarray,
        returns: np.ndarray,
        volumes: Optional[np.ndarray] = None,
    ) -> "GARCHModel":
        self._returns = returns

        try:
            from arch import arch_model

            # Scale returns by 100 for numerical stability during fitting
            scaled_returns = returns * 100.0

            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                model = arch_model(
                    scaled_returns,
                    vol="Garch",
                    p=self._p,
                    q=self._q,
                    dist="normal",
                    rescale=False,
                )
                self._model_res = model.fit(disp="off")
        except Exception:
            self._model_res = None
        return self

    def predict(self, horizon: int) -> Dict[str, float]:
        lookback = min(30, len(self._returns))
        hist_vol = float(np.std(self._returns[-lookback:]) * np.sqrt(252))
        hist_ret = float(np.mean(self._returns[-lookback:]) * horizon)

        if self._model_res is None:
            return {
                "expected_return": hist_ret,
                "expected_volatility": max(0.001, hist_vol),
                "model_name": self.name,
            }

        try:
            # Forecast conditional variance forward
            forecasts = self._model_res.forecast(horizon=horizon)
            variance_forecast = forecasts.variance.values[-1]
            expected_variance_scaled = variance_forecast[-1]

            # Descale: GARCH was fit on returns*100, so variance is in (pct)^2
            expected_vol_daily = np.sqrt(expected_variance_scaled) / 100.0
            expected_vol = float(expected_vol_daily * np.sqrt(252))

            # Return from fitted mean
            mu_scaled = self._model_res.params.get(
                "mu", np.mean(self._returns) * 100.0
            )
            mu = float(mu_scaled) / 100.0
            expected_return = float(mu * horizon)

            return {
                "expected_return": expected_return,
                "expected_volatility": max(0.001, min(10.0, expected_vol)),
                "model_name": self.name,
            }
        except Exception:
            return {
                "expected_return": hist_ret,
                "expected_volatility": max(0.001, hist_vol),
                "model_name": self.name,
            }


class EWMAModel:
    """Exponentially Weighted Moving Average volatility forecast.

    Uses a decay factor (lambda) to weight recent observations
    more heavily. Standard RiskMetrics lambda = 0.94.

    This is simpler than GARCH but often competitive for short horizons.
    Pure numpy — no external dependency.
    """

    name = "ewma"

    def __init__(self, decay: float = 0.94):
        self._decay = decay
        self._returns = None

    def fit(
        self,
        prices: np.ndarray,
        returns: np.ndarray,
        volumes: Optional[np.ndarray] = None,
    ) -> "EWMAModel":
        self._returns = returns
        return self

    def predict(self, horizon: int) -> Dict[str, float]:
        if len(self._returns) < 2:
            return {
                "expected_return": 0.0,
                "expected_volatility": 0.20,
                "model_name": self.name,
            }

        # Compute EWMA variance iteratively
        n = len(self._returns)
        ewma_var = self._returns[0] ** 2
        for i in range(1, n):
            ewma_var = self._decay * ewma_var + (1 - self._decay) * (
                self._returns[i] ** 2
            )

        ewma_vol_daily = np.sqrt(ewma_var)
        ewma_vol_annual = float(ewma_vol_daily * np.sqrt(252))

        # Return estimate: exponentially weighted mean
        weights = np.array(
            [self._decay ** (n - 1 - i) for i in range(n)]
        )
        weights /= np.sum(weights)
        ewma_mean = float(np.dot(weights, self._returns))

        return {
            "expected_return": ewma_mean * horizon,
            "expected_volatility": max(0.001, min(10.0, ewma_vol_annual)),
            "model_name": self.name,
        }
