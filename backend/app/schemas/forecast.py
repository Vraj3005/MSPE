import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class ModelMetadataBase(BaseModel):
    model_name: str
    model_type: str
    version: str
    hyperparameters: dict
    metrics: dict
    file_path: str
    is_active: bool = True


class ModelMetadataCreate(ModelMetadataBase):
    pass


class ModelMetadata(ModelMetadataBase):
    id: uuid.UUID
    trained_at: datetime

    model_config = ConfigDict(from_attributes=True)


class MarketForecastBase(BaseModel):
    timestamp: datetime
    horizon_days: int = Field(..., ge=1, le=7)
    expected_return: float
    expected_volatility: float
    confidence_score: float = Field(..., ge=0.0, le=1.0)


class MarketForecastCreate(MarketForecastBase):
    asset_id: uuid.UUID
    model_id: uuid.UUID


class MarketForecast(MarketForecastBase):
    asset_id: uuid.UUID
    model_id: uuid.UUID

    model_config = ConfigDict(from_attributes=True)
