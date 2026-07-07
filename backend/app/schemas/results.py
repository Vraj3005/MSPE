"""
Clean result schemas for the MSPE projection engine.

These are the Pydantic models that define the API response shape
for the upgraded dashboard results endpoint.
"""

from datetime import datetime
from typing import List, Dict, Optional
from pydantic import BaseModel, ConfigDict
from backend.app.schemas.explanations import ExplainabilityLayer


class ValidationMetrics(BaseModel):
    """Metrics from walk-forward validation of a projection model."""

    mae: float
    rmse: float
    directional_accuracy: float
    interval_coverage: float
    var_breach_rate: float
    band_width: float
    calibration_score: float


class ModelSelectionInfo(BaseModel):
    """Information about why a particular model was selected."""

    selected_model: str
    model_reason: str
    validation_summary: ValidationMetrics
    models_compared: int
    baseline_beaten: bool


class ProjectionResult(BaseModel):
    """Projection for a single horizon (e.g. 7 days)."""

    horizon_days: int
    bear_price: float
    base_price: float
    bull_price: float
    expected_return: float
    probability_of_gain: float
    probability_of_loss: float
    confidence_band_width: float
    projected_volatility: float


class RiskResult(BaseModel):
    """Risk assessment for an asset."""

    risk_score: float
    risk_level: str  # Low / Medium / High / Extreme
    var_95: float
    cvar_95: float
    max_drawdown: float
    volatility: float
    downside_probability: float


class ExplanationResult(BaseModel):
    """Plain-English explanation of the projection result."""

    what_mspe_expects: str
    why_this_result: str
    what_risk_to_watch: str
    how_reliable: str


class AssetResult(BaseModel):
    """Complete result for one asset, combining projections, risk, and explanation."""

    asset: str
    asset_name: str
    asset_class: str
    latest_price: float
    latest_date: datetime
    daily_return: float
    seven_day_return: Optional[float] = None
    thirty_day_return: Optional[float] = None
    projections: List[ProjectionResult]
    risk: RiskResult
    model_selection: ModelSelectionInfo
    explanation: ExplanationResult
    explainability: ExplainabilityLayer
    market_read: str
    is_demo: bool = False

    # Chart data
    bear_scenario_path: List[float] = []
    base_scenario_path: List[float] = []
    bull_scenario_path: List[float] = []
    sample_paths: List[List[float]] = []
    density_prices: List[float] = []
    density_values: List[float] = []


class DashboardResultsResponse(BaseModel):
    """Top-level response for the dashboard results endpoint."""

    timestamp: datetime
    data_mode: str  # 'live' or 'demo'
    engine_version: str = "2.0"
    total_assets: int
    assets: Dict[str, AssetResult]

    model_config = ConfigDict(from_attributes=True)
