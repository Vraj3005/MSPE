"""
Model registry for MSPE projection engine.

Provides a single entry point to instantiate all models,
run them all, and retrieve results in a standard format.
Handles failures gracefully — if a model crashes, it's skipped.
"""

import numpy as np
from typing import Dict, List, Optional, Any

from backend.quant.models.baselines import (
    LastPriceBaseline,
    HistoricalMeanBaseline,
    RollingMeanBaseline,
    RollingVolBaseline,
)
from backend.quant.models.statistical import (
    ARIMAModel,
    GARCHModel,
    EWMAModel,
)
from backend.quant.models.ml_models import XGBoostReturnModel

# Type alias for any model that follows the fit/predict interface
ProjectionModel = Any


def get_all_models() -> List[ProjectionModel]:
    """Returns a fresh list of all model instances.

    Each call creates new instances — models are not shared
    between assets or horizons.
    """
    return [
        # Baselines (must be included so we can prove MSPE is better)
        LastPriceBaseline(),
        HistoricalMeanBaseline(),
        RollingMeanBaseline(window=30),
        RollingVolBaseline(window=30),
        # Statistical models
        ARIMAModel(p=1, d=1, q=1),
        GARCHModel(p=1, q=1),
        EWMAModel(decay=0.94),
        # Machine learning
        XGBoostReturnModel(n_estimators=50, max_depth=3, learning_rate=0.05),
    ]


def get_model_names() -> List[str]:
    """Returns the names of all models in the registry."""
    return [m.name for m in get_all_models()]


def get_model_by_name(name: str) -> Optional[ProjectionModel]:
    """Returns a fresh instance of the model with the given name."""
    for model in get_all_models():
        if model.name == name:
            return model
    return None


def run_all_models(
    prices: np.ndarray,
    returns: np.ndarray,
    horizon: int,
    volumes: Optional[np.ndarray] = None,
) -> List[Dict[str, Any]]:
    """Fits and predicts with every model in the registry.

    Returns a list of prediction dicts, one per model.
    Models that fail are silently skipped.
    Each result dict contains:
        - model_name: str
        - expected_return: float
        - expected_volatility: float
        - model_instance: the fitted model object (for reuse)
    """
    models = get_all_models()
    results = []

    for model in models:
        try:
            model.fit(prices=prices, returns=returns, volumes=volumes)
            prediction = model.predict(horizon=horizon)
            prediction["model_instance"] = model
            results.append(prediction)
        except Exception:
            # Model failed — skip it, don't crash the pipeline
            continue

    return results


def fit_single_model(
    model_name: str,
    prices: np.ndarray,
    returns: np.ndarray,
    horizon: int,
    volumes: Optional[np.ndarray] = None,
) -> Optional[Dict[str, Any]]:
    """Fits and predicts with a single named model.

    Returns the prediction dict or None if the model fails.
    """
    model = get_model_by_name(model_name)
    if model is None:
        return None

    try:
        model.fit(prices=prices, returns=returns, volumes=volumes)
        prediction = model.predict(horizon=horizon)
        prediction["model_instance"] = model
        return prediction
    except Exception:
        return None
