import uuid
from datetime import datetime
from typing import Optional, List, Dict
from pydantic import BaseModel, ConfigDict


class MarketFeatureBase(BaseModel):
    timestamp: datetime
    resolution: str

    # Trend Features
    sma_20: Optional[float] = None
    ema_20: Optional[float] = None
    macd: Optional[float] = None
    macd_signal: Optional[float] = None
    macd_histogram: Optional[float] = None
    rsi_14: Optional[float] = None
    adx_14: Optional[float] = None

    # Volatility Features
    atr_14: Optional[float] = None
    historical_volatility_30: Optional[float] = None
    parkinson_volatility_30: Optional[float] = None

    # Market Structure Features
    support_30: Optional[float] = None
    resistance_30: Optional[float] = None
    volume_profile: Optional[List[Dict[str, float]]] = None

    # Statistical Features
    returns_1d: Optional[float] = None
    log_returns: Optional[float] = None
    rolling_mean_30: Optional[float] = None
    rolling_variance_30: Optional[float] = None
    rolling_skewness_30: Optional[float] = None
    rolling_kurtosis_30: Optional[float] = None


class MarketFeatureCreate(MarketFeatureBase):
    asset_id: uuid.UUID


class MarketFeature(MarketFeatureBase):
    asset_id: uuid.UUID

    model_config = ConfigDict(from_attributes=True)
