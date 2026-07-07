import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict, field_validator


class MarketBarBase(BaseModel):
    timestamp: datetime
    open: float
    high: float
    low: float
    close: float
    volume: float
    resolution: str

    @field_validator("open", "high", "low", "close", mode="after")
    @classmethod
    def validate_positive_prices(cls, v: float) -> float:
        if v <= 0.0:
            raise ValueError(f"Price must be strictly positive, got {v}")
        return v

    @field_validator("volume", mode="after")
    @classmethod
    def validate_non_negative_volume(cls, v: float) -> float:
        if v < 0.0:
            raise ValueError(f"Volume must be non-negative, got {v}")
        return v


class MarketBarCreate(MarketBarBase):
    asset_id: uuid.UUID


class MarketBar(MarketBarBase):
    asset_id: uuid.UUID

    model_config = ConfigDict(from_attributes=True)
