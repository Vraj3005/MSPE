from datetime import datetime
from typing import List, Dict, Optional, Any
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


# ==================== V2 Legacy Schemas ====================


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


class AssetSummary(BaseModel):
    symbol: str
    name: str
    asset_class: str
    last_close: float
    daily_change: float
    risk_level: str
    base_case_7d: float
    probability_of_loss_7d: float


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


# ==================== New Clean Result Contract Schemas ====================


class HorizonResultDetail(BaseModel):
    horizon_label: str  # '1D', '3D', '7D', '30D'
    horizon_days: int  # compatibility
    bear_case_price: float
    bear_price: float  # compatibility
    base_case_price: float
    base_price: float  # compatibility
    bull_case_price: float
    bull_price: float  # compatibility
    expected_return: float
    probability_of_gain: float
    probability_of_loss: float
    projected_volatility: float
    confidence_band_width: float  # compatibility
    risk_score: float
    risk_level: str
    var_95: float
    cvar_95: float
    explanation: str

    model_config = ConfigDict(from_attributes=True)


class AssetProjectionResult(BaseModel):
    symbol: str
    name: str
    asset_class: str
    latest_price: float
    latest_date: datetime
    daily_return: float
    data_mode: str  # 'live' | 'cached' | 'demo'
    horizons: List[HorizonResultDetail]

    # Dynamic Path Support
    bear_scenario_path: List[float] = []
    base_scenario_path: List[float] = []
    bull_scenario_path: List[float] = []
    monte_carlo_paths: List[List[float]] = []
    probability_density_data: Optional[DensityData] = None
    explainability: Optional[ExplainabilityLayer] = None

    # Compatibility Nesting
    asset: Optional[AssetInfo] = None
    projection_horizon_results: Optional[List[HorizonResultDetail]] = None
    explanation_text: Optional[ExplanationText] = None

    model_config = ConfigDict(from_attributes=True)


class ValidationSummaryItem(BaseModel):
    ticker: str
    lookback_window: str
    annualized_volatility: float
    sharpe_ratio: float
    range_hit_rate_7d: float
    base_case_error_mape: float
    risk_model_reliability: float

    model_config = ConfigDict(from_attributes=True)


class ValidationSummary(BaseModel):
    average_hit_rate: float
    reliability_level: str
    metrics: List[ValidationSummaryItem]

    model_config = ConfigDict(from_attributes=True)


class DashboardOverviewResult(BaseModel):
    last_updated: datetime
    data_mode: str  # 'live' | 'cached' | 'demo'
    total_assets: int
    highest_risk_asset: str
    best_risk_reward_asset: str
    average_probability_of_loss_7d: float
    asset_cards: List[AssetProjectionResult]
    market_summary_text: str
    validation_summary: ValidationSummary

    model_config = ConfigDict(from_attributes=True)


# Endpoint 4: Risk Detail
class StressScenario(BaseModel):
    scenario_name: str
    spx_shock: float
    portfolio_return_shock: float
    portfolio_usd_impact: float

    model_config = ConfigDict(from_attributes=True)


class RiskExplanation(BaseModel):
    summary: str
    warning: str
    reason: str

    model_config = ConfigDict(from_attributes=True)


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

    model_config = ConfigDict(from_attributes=True)


# Endpoint 5: Methodology
class MethodologyResponse(BaseModel):
    projections_calculation: str
    monte_carlo_definition: str
    var_definition: str
    limitations: List[str]

    model_config = ConfigDict(from_attributes=True)
