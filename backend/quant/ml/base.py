from abc import ABC, abstractmethod
from typing import Dict, Optional
import numpy as np


class BaseForecaster(ABC):
    @abstractmethod
    def fit(
        self,
        prices: np.ndarray,
        returns: np.ndarray,
        features: Optional[np.ndarray] = None,
    ) -> "BaseForecaster":
        """Fits the forecasting model using historical arrays of prices, returns, and dynamic features."""
        pass

    @abstractmethod
    def predict(self, horizon: int) -> Dict[str, float]:
        """Generates forecast expectations over a forward horizon.

        Returns a dictionary containing:
        - "expected_return": projected cumulative return over the horizon
        - "expected_volatility": projected annualized volatility over the horizon
        """
        pass

    @abstractmethod
    def save(self, file_path: str) -> None:
        """Serializes the fitted estimator weights to the file system."""
        pass

    @abstractmethod
    def load(self, file_path: str) -> "BaseForecaster":
        """Deserializes and restores model state from a stored file path."""
        pass
