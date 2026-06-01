import os
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

import pandas as pd
import numpy as np
from datetime import datetime, timedelta, timezone

from backend.app.services.feature import FeatureService

def generate_synthetic_data(n_bars: int = 50) -> pd.DataFrame:
    """Generates a predictable trending pricing DataFrame for unit testing."""
    start_time = datetime.now(timezone.utc) - timedelta(days=n_bars)
    timestamps = [start_time + timedelta(days=i) for i in range(n_bars)]
    
    # Generate a steady trending series
    # Price rises steadily from 100.0 up to 150.0
    close_prices = np.linspace(100.0, 150.0, n_bars)
    open_prices = close_prices - 1.0
    high_prices = close_prices + 2.0
    low_prices = close_prices - 2.0
    volume = np.linspace(1000.0, 2000.0, n_bars)
    
    df = pd.DataFrame({
        "timestamp": timestamps,
        "open": open_prices,
        "high": high_prices,
        "low": low_prices,
        "close": close_prices,
        "volume": volume
    })
    return df

def test_trend_indicators():
    df = generate_synthetic_data(50)
    df_feat = FeatureService.calculate_features_dataframe(df, "1d")
    
    # 1. Verify SMA & EMA
    assert "sma_20" in df_feat.columns
    assert "ema_20" in df_feat.columns
    
    # Warmup indexes should contain None/NaN, but later indexes must exist
    assert df_feat.loc[19, "sma_20"] is not None
    # With a rising trend, close should exceed SMA
    assert df_feat.loc[49, "close"] > df_feat.loc[49, "sma_20"]
    
    # 2. Verify MACD
    assert "macd" in df_feat.columns
    assert "macd_signal" in df_feat.columns
    assert "macd_histogram" in df_feat.columns
    assert df_feat.loc[34, "macd"] is not None
    
    # 3. Verify RSI
    assert "rsi_14" in df_feat.columns
    # Due to a steady upward trend, RSI should be highly bullish (> 50)
    assert df_feat.loc[49, "rsi_14"] > 50.0

def test_volatility_indicators():
    df = generate_synthetic_data(50)
    df_feat = FeatureService.calculate_features_dataframe(df, "1d")
    
    assert "atr_14" in df_feat.columns
    assert "historical_volatility_30" in df_feat.columns
    assert "parkinson_volatility_30" in df_feat.columns
    
    # Verify values at late indexes are calculated
    assert df_feat.loc[30, "historical_volatility_30"] is not None
    assert df_feat.loc[30, "parkinson_volatility_30"] is not None
    assert df_feat.loc[30, "atr_14"] > 0.0

def test_market_structure():
    df = generate_synthetic_data(50)
    df_feat = FeatureService.calculate_features_dataframe(df, "1d")
    
    assert "support_30" in df_feat.columns
    assert "resistance_30" in df_feat.columns
    assert "volume_profile" in df_feat.columns
    
    # For a trending price series from 100 to 150:
    # 30-period support at index 49 (window: index 20 to 49) should match low price at index 20
    expected_support = df.loc[20, "low"]
    expected_resistance = df.loc[49, "high"]
    
    assert abs(df_feat.loc[49, "support_30"] - expected_support) < 1e-4
    assert abs(df_feat.loc[49, "resistance_30"] - expected_resistance) < 1e-4
    
    # Verify volume profile array
    profile = df_feat.loc[49, "volume_profile"]
    assert profile is not None
    assert len(profile) == 10
    assert "price_bin" in profile[0]
    assert "volume_weight" in profile[0]
    # Sum of weights should be approximately 1.0
    total_weight = sum([p["volume_weight"] for p in profile])
    assert abs(total_weight - 1.0) < 1e-2

def test_statistical_indicators():
    df = generate_synthetic_data(50)
    df_feat = FeatureService.calculate_features_dataframe(df, "1d")
    
    assert "returns_1d" in df_feat.columns
    assert "log_returns" in df_feat.columns
    assert "rolling_mean_30" in df_feat.columns
    assert "rolling_skewness_30" in df_feat.columns
    
    # Simple check on log returns
    expected_log_ret = np.log(df.loc[10, "close"] / df.loc[9, "close"])
    assert abs(df_feat.loc[10, "log_returns"] - expected_log_ret) < 1e-6
    
    # Warmup check
    assert df_feat.loc[10, "rolling_mean_30"] is None
    assert df_feat.loc[29, "rolling_mean_30"] is not None

if __name__ == "__main__":
    print("Starting MSPE Feature Engineering Unit Test Suite...")
    print("  - Running Trend indicators test...")
    test_trend_indicators()
    print("  - Running Volatility indicators test...")
    test_volatility_indicators()
    print("  - Running Market Structure test...")
    test_market_structure()
    print("  - Running Statistical indicators test...")
    test_statistical_indicators()
    print("\nSUCCESS: All quantitative feature calculations passed mathematical validations!")
