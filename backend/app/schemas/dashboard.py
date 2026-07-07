from datetime import datetime
from typing import List, Dict, Optional
from pydantic import BaseModel, ConfigDict
from backend.app.schemas.explanations import ExplainabilityLayer

# ==================== V1 Backward Compatibility Schemas ====================


class CurrentMarketData(BaseModel):
    symbol: str
    name: str
    asset_class: str
    latest_close: float
    latest_date: datetime
    daily_return: float
    seven_day_return: Optional[float] = None
    thirty_day_return: Optional[float] = None


class HorizonProjection(BaseModel):
    horizon_days: int
    bear_price: float
    base_price: float
    bull_price: float
    expected_return: float
    probability_of_gain: float
    probability_of_loss: float
    projected_volatility: float
    confidence_band_width: float


class AssetRiskSummary(BaseModel):
    risk_level: str  # 'Low', 'Medium', 'High', 'Extreme'
    risk_score: float  # 0 to 100
    var_95: float
    cvar_95: float
    max_drawdown: float
    volatility_percentile: float
    downside_probability: float


class AssetDashboardResult(BaseModel):
    market_data: CurrentMarketData
    projections: List[HorizonProjection]
    risk_summary: AssetRiskSummary
    market_read: str  # 'Bullish but volatile', 'Neutral / wait for confirmation', etc.
    summary_sentence: str
    warning_sentence: str
    reason_sentence: str
    is_demo: bool = False


class DashboardResultsResponse(BaseModel):
    timestamp: datetime
    assets: Dict[str, AssetDashboardResult]
    is_demo: bool = False

    model_config = ConfigDict(from_attributes=True)


# ==================== V2 Refactored Schemas ====================


# Endpoint 1: Overview
class TopCard(BaseModel):
    title: str
    value: str
    description: str
    type: str


class AssetCard(BaseModel):
    symbol: str
    name: str
    asset_class: str
    last_close: float
    daily_change: float
    risk_level: str
    risk_score: float
    market_read: str
    base_case_7d: float


class DashboardOverviewResponse(BaseModel):
    last_updated: datetime
    data_mode: str  # 'live' | 'demo' | 'cached'
    total_assets: int
    best_risk_reward_asset: str
    highest_risk_asset: str
    market_summary_text: str
    top_cards: List[TopCard]
    asset_cards: List[AssetCard]


# Endpoint 2: Simple List
class AssetSummary(BaseModel):
    symbol: str
    name: str
    asset_class: str
    last_close: float
    daily_change: float
    risk_level: str
    base_case_7d: float
    probability_of_loss_7d: float


# Endpoint 3: Projection Detail
class AssetInfo(BaseModel):
    symbol: str
    name: str
    asset_class: str
    last_close: float
    latest_date: datetime


class HorizonResult(BaseModel):
    horizon_days: int
    bear_price: float
    base_price: float
    bull_price: float
    expected_return: float
    probability_of_gain: float
    probability_of_loss: float
    projected_volatility: float
    confidence_band_width: float


class DensityData(BaseModel):
    prices: List[float]
    densities: List[float]


class ExplanationText(BaseModel):
    summary: str
    warning: str
    reason: str


class AssetProjectionResponse(BaseModel):
    asset: AssetInfo
    projection_horizon_results: List[HorizonResult]
    bear_scenario_path: List[float]
    base_scenario_path: List[float]
    bull_scenario_path: List[float]
    monte_carlo_paths: List[List[float]]
    probability_density_data: Optional[DensityData] = None
    explanation_text: ExplanationText
    explainability: ExplainabilityLayer
    data_mode: str


# Endpoint 4: Risk Detail
class StressScenario(BaseModel):
    scenario_name: str
    spx_shock: float
    portfolio_return_shock: float
    portfolio_usd_impact: float


class RiskExplanation(BaseModel):
    summary: str
    warning: str
    reason: str


class AssetRiskResponse(BaseModel):
    symbol: str
    var_95: float
    cvar_95: float
    volatility: float
    drawdown: float
    risk_score: float
    risk_level: str
    stress_test_summary: List[StressScenario]
    plain_language_explanation: RiskExplanation
    data_mode: str


# Endpoint 5: Methodology
class MethodologyResponse(BaseModel):
    projections_calculation: str
    monte_carlo_definition: str
    var_definition: str
    limitations: List[str]
