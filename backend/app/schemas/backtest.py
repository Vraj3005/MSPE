from pydantic import BaseModel, Field
from typing import List


class BacktestRequest(BaseModel):
    strategy_name: str = Field(
        "SMA_CROSSOVER", pattern="^(SMA_CROSSOVER|RSI_MEAN_REVERSION)$"
    )
    initial_capital: float = Field(100000.0, ge=1000.0)


class EquityCurveNode(BaseModel):
    timestamp: str
    equity: float


class TradeLogNode(BaseModel):
    id: int
    type: str
    entry_time: str
    exit_time: str
    entry_price: float
    exit_price: float
    return_pct: float
    pnl_usd: float
    capital_after: float


class BacktestResponse(BaseModel):
    strategy: str
    ticker: str
    total_return_pct: float
    total_pnl_usd: float
    win_rate_pct: float
    total_trades: int
    profit_factor: float
    max_drawdown_pct: float
    final_capital_usd: float
    equity_curve: List[EquityCurveNode]
    trade_logs: List[TradeLogNode]
