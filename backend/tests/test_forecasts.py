import os
import sys
import numpy as np

# Add workspace root directory to path so script runs standalone
sys.path.append(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)

from backend.quant.ml.stats_models import (
    ARIMAForecaster,
    SARIMAForecaster,
    GARCHForecaster,
)
from backend.quant.ml.tree_models import XGBoostForecaster, RandomForestForecaster
from backend.quant.ml.deep_models import LSTMForecaster
from backend.app.core.logging import logger

# Establish temporary models store for unit testing
TEST_STORE_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "models_store",
    "test_runs",
)
os.makedirs(TEST_STORE_DIR, exist_ok=True)


def generate_mock_arrays(n_bars: int = 60) -> tuple:
    """Generates synthetic pricing arrays and aligned feature matrices."""
    # Predictable rising series with deterministic volatility
    prices = np.linspace(100.0, 150.0, n_bars)
    returns = np.diff(prices, prepend=100.0) / 100.0

    # 6 mock features: log_returns, rsi, adx, atr, historical_volatility, constant
    features = []
    for i in range(n_bars):
        feat = [
            returns[i],
            np.log(prices[i] / prices[i - 1]) if i > 0 else 0.0,
            65.0 + (i % 5),  # Bullish RSI
            25.0 + (i % 3),  # Trend ADX
            0.02,  # Constant ATR
            0.15,  # Constant Volatility
        ]
        features.append(feat)
    return prices, returns, np.array(features)


def run_model_pipeline_test(
    model_class, model_name: str, p_keys: dict, prices, returns, features
):
    logger.info(f"Testing Forecaster Pipeline: {model_name}...")

    # 1. Instantiate & Fit
    model = model_class(**p_keys)
    model.fit(prices=prices, returns=returns, features=features)

    # 2. Predict over horizons
    for horizon in [1, 3, 7]:
        pred = model.predict(horizon)
        assert "expected_return" in pred, f"Missing expected_return for {model_name}"
        assert (
            "expected_volatility" in pred
        ), f"Missing expected_volatility for {model_name}"
        assert isinstance(pred["expected_return"], float)
        assert isinstance(pred["expected_volatility"], float)
        assert (
            pred["expected_volatility"] > 0.0
        ), f"Expected volatility is non-positive: {pred['expected_volatility']}"

    # 3. Model Persistence: Save weights to temporary store
    file_path = os.path.join(TEST_STORE_DIR, f"test_{model_name.lower()}.joblib")
    model.save(file_path)

    # 4. Deserialization: Load model
    loaded_model = model_class(**p_keys)
    loaded_model.load(file_path)

    # 5. Predict on loaded model
    pred_loaded = loaded_model.predict(3)
    assert "expected_return" in pred_loaded
    assert "expected_volatility" in pred_loaded
    assert isinstance(pred_loaded["expected_return"], float)

    logger.info(f"SUCCESS: Forecaster pipeline fully validated for {model_name}")


if __name__ == "__main__":
    print("Starting MSPE Forecasting Layer Unit Test Suite...")

    prices, returns, features = generate_mock_arrays(60)

    try:
        # Test 1: ARIMA
        run_model_pipeline_test(
            model_class=ARIMAForecaster,
            model_name="ARIMA",
            p_keys={"p": 1, "d": 1, "q": 1},
            prices=prices,
            returns=returns,
            features=features,
        )

        # Test 2: SARIMA
        run_model_pipeline_test(
            model_class=SARIMAForecaster,
            model_name="SARIMA",
            p_keys={"p": 1, "d": 0, "q": 1, "s": 4},
            prices=prices,
            returns=returns,
            features=features,
        )

        # Test 3: GARCH
        run_model_pipeline_test(
            model_class=GARCHForecaster,
            model_name="GARCH",
            p_keys={"p": 1, "q": 1},
            prices=prices,
            returns=returns,
            features=features,
        )

        # Test 4: XGBoost
        run_model_pipeline_test(
            model_class=XGBoostForecaster,
            model_name="XGBoost",
            p_keys={"n_estimators": 10, "max_depth": 2},
            prices=prices,
            returns=returns,
            features=features,
        )

        # Test 5: Random Forest
        run_model_pipeline_test(
            model_class=RandomForestForecaster,
            model_name="RandomForest",
            p_keys={"n_estimators": 10, "max_depth": 3},
            prices=prices,
            returns=returns,
            features=features,
        )

        # Test 6: PyTorch LSTM
        run_model_pipeline_test(
            model_class=LSTMForecaster,
            model_name="LSTM",
            p_keys={"epochs": 5, "lr": 0.05, "seq_len": 5, "hidden_dim": 8},
            prices=prices,
            returns=returns,
            features=features,
        )

        print(
            "\nCONGRATULATIONS: All 6 quantitative forecasting models passed mathematical integration tests!"
        )
        sys.exit(0)
    except AssertionError as ae:
        print(f"\nFAILURE: Model assertion mismatch: {ae}", file=sys.stderr)
        sys.exit(1)
    except Exception as ex:
        print(f"\nCRITICAL ERROR: Forecaster execution crash: {ex}", file=sys.stderr)
        sys.exit(1)
