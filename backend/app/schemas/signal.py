import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class TradingSignalBase(BaseModel):
    strategy_name: str
    signal_type: str = Field(..., pattern="^(LONG|SHORT|EXIT|NO_TRADE)$")

    entry_price: float
    stop_loss: float
    take_profit: float
    risk_reward_ratio: float

    position_size_usd: float
    confidence_score: float = Field(..., ge=0.0, le=1.0)
    rank_score: float
    details: dict
    is_active: bool = True


class TradingSignalCreate(TradingSignalBase):
    asset_id: uuid.UUID


class TradingSignal(TradingSignalBase):
    id: uuid.UUID
    asset_id: uuid.UUID
    timestamp: datetime

    model_config = ConfigDict(from_attributes=True)


class PortfolioExposureSummary(BaseModel):
    """Aggregate dashboard metrics summarizing total capital allocation and active portfolio risk limits."""

    total_equity_usd: float
    total_active_risk_usd: float
    total_active_risk_pct: float = Field(
        ..., ge=0.0, le=100.0
    )  # locked under 5% aggregate cap
    remaining_risk_capacity_usd: float
    active_positions_count: int
