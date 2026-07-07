import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, ConfigDict, Field


class AssetRiskMetricsBase(BaseModel):
    var_95: float = Field(
        ..., description="1-day Value at Risk at 95% confidence level"
    )
    var_99: float = Field(
        ..., description="1-day Value at Risk at 99% confidence level"
    )
    expected_shortfall_95: float = Field(
        ..., description="Expected Shortfall at 95% confidence level"
    )
    expected_shortfall_99: float = Field(
        ..., description="Expected Shortfall at 99% confidence level"
    )
    max_drawdown: float = Field(
        ..., description="Maximum Drawdown over lookback window"
    )

    sharpe_ratio: float = Field(
        ..., description="Annualized excess return per unit of standard deviation"
    )
    sortino_ratio: float = Field(
        ..., description="Annualized excess return per unit of downside deviation"
    )
    calmar_ratio: float = Field(
        ..., description="Annualized excess return per unit of max drawdown"
    )

    beta: float = Field(
        ..., description="Sensitivity of asset returns relative to market index (SPX)"
    )
    alpha: float = Field(
        ..., description="Risk-adjusted excess return relative to market index"
    )

    details: Dict[str, Any] = Field(
        default_factory=dict, description="Detailed computational properties"
    )


class AssetRiskMetricsCreate(AssetRiskMetricsBase):
    asset_id: uuid.UUID


class AssetRiskMetricsResponse(AssetRiskMetricsBase):
    id: uuid.UUID
    asset_id: uuid.UUID
    timestamp: datetime
    ticker: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class PortfolioRiskMetricsBase(BaseModel):
    var_95: float = Field(
        ..., description="Portfolio 1-day Value at Risk at 95% confidence level"
    )
    var_99: float = Field(
        ..., description="Portfolio 1-day Value at Risk at 99% confidence level"
    )
    expected_shortfall_95: float = Field(
        ..., description="Portfolio Expected Shortfall at 95% confidence level"
    )
    expected_shortfall_99: float = Field(
        ..., description="Portfolio Expected Shortfall at 99% confidence level"
    )
    max_drawdown: float = Field(..., description="Portfolio Maximum Drawdown")

    sharpe_ratio: float = Field(..., description="Portfolio Annualized Sharpe Ratio")
    sortino_ratio: float = Field(..., description="Portfolio Annualized Sortino Ratio")
    calmar_ratio: float = Field(..., description="Portfolio Annualized Calmar Ratio")

    beta: float = Field(
        ..., description="Weighted portfolio Beta relative to SPX benchmark"
    )
    alpha: float = Field(..., description="Weighted portfolio Jensen's Alpha")

    correlation_matrix: Dict[str, Dict[str, float]] = Field(
        ..., description="Asset returns correlation grid"
    )
    stress_test_results: Dict[str, Dict[str, float]] = Field(
        ..., description="Returns and USD value shocks under macro stress scenarios"
    )
    details: Dict[str, Any] = Field(
        default_factory=dict, description="Computational and execution metadata"
    )


class PortfolioRiskMetricsResponse(PortfolioRiskMetricsBase):
    id: uuid.UUID
    timestamp: datetime

    model_config = ConfigDict(from_attributes=True)


class StressScenarioResult(BaseModel):
    scenario_name: str
    spx_shock: float
    asset_shocks: Dict[str, float]
    portfolio_return_shock: float
    portfolio_usd_impact: float


class StressTestSummary(BaseModel):
    timestamp: datetime
    scenarios: List[StressScenarioResult]


class CorrelationMatrixGrid(BaseModel):
    assets: List[str]
    matrix: List[List[float]]


class RiskDashboardSummary(BaseModel):
    timestamp: datetime
    portfolio: PortfolioRiskMetricsBase
    assets_risk: List[AssetRiskMetricsResponse]
