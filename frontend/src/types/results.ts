// ==================== V1 Backward Compatibility Types ====================

export interface CurrentMarketData {
  symbol: string;
  name: string;
  asset_class: string;
  latest_close: number;
  latest_date: string;
  daily_return: number;
  seven_day_return?: number;
  thirty_day_return?: number;
}

export interface HorizonProjection {
  horizon_days: number;
  bear_price: number;
  base_price: number;
  bull_price: number;
  expected_return: number;
  probability_of_gain: number;
  probability_of_loss: number;
  projected_volatility: number;
  confidence_band_width: number;
}

export interface AssetRiskSummary {
  risk_level: string;
  risk_score: number;
  var_95: number;
  cvar_95: number;
  max_drawdown: number;
  volatility_percentile: number;
  downside_probability: number;
}

export interface AssetDashboardResult {
  market_data: CurrentMarketData;
  projections: HorizonProjection[];
  risk_summary: AssetRiskSummary;
  market_read: string;
  summary_sentence: string;
  warning_sentence: string;
  reason_sentence: string;
  is_demo: boolean;
}

export interface DashboardResultsResponse {
  timestamp: string;
  assets: Record<string, AssetDashboardResult>;
  is_demo: boolean;
}

// ==================== V2 Types ====================

// Endpoint 1: Overview
export interface TopCard {
  title: string;
  value: string;
  description: string;
  type: string;
}

export interface AssetCard {
  symbol: string;
  name: string;
  asset_class: string;
  last_close: number;
  daily_change: number;
  risk_level: string;
  risk_score: number;
  market_read: string;
  base_case_7d: number;
}

export interface DashboardOverviewResponse {
  last_updated: string;
  data_mode: string;
  total_assets: number;
  best_risk_reward_asset: string;
  highest_risk_asset: string;
  market_summary_text: string;
  top_cards: TopCard[];
  asset_cards: AssetCard[];
}

// Endpoint 2: Simple List
export interface AssetSummary {
  symbol: string;
  name: string;
  asset_class: string;
  last_close: number;
  daily_change: number;
  risk_level: string;
  base_case_7d: number;
  probability_of_loss_7d: number;
}

// Endpoint 3: Projection Details
export interface AssetInfo {
  symbol: string;
  name: string;
  asset_class: string;
  last_close: number;
  latest_date: string;
}

export interface HorizonResult {
  horizon_days: number;
  bear_price: number;
  base_price: number;
  bull_price: number;
  expected_return: number;
  probability_of_gain: number;
  probability_of_loss: number;
  projected_volatility: number;
  confidence_band_width: number;
}

export interface DensityData {
  prices: number[];
  densities: number[];
}

export interface ExplanationText {
  summary: string;
  warning: string;
  reason: string;
}

export interface AssetProjectionResponse {
  asset: AssetInfo;
  projection_horizon_results: HorizonResult[];
  bear_scenario_path: number[];
  base_scenario_path: number[];
  bull_scenario_path: number[];
  monte_carlo_paths: number[][];
  probability_density_data?: DensityData;
  explanation_text: ExplanationText;
  data_mode: string;
}

// Endpoint 4: Risk Details
export interface StressScenario {
  scenario_name: string;
  spx_shock: number;
  portfolio_return_shock: number;
  portfolio_usd_impact: number;
}

export interface RiskExplanation {
  summary: string;
  warning: string;
  reason: string;
}

export interface AssetRiskResponse {
  symbol: string;
  var_95: number;
  cvar_95: number;
  volatility: number;
  drawdown: number;
  risk_score: number;
  risk_level: string;
  stress_test_summary: StressScenario[];
  plain_language_explanation: RiskExplanation;
  data_mode: string;
}

// Endpoint 5: Methodology Details
export interface MethodologyResponse {
  projections_calculation: string;
  monte_carlo_definition: string;
  var_definition: string;
  limitations: string[];
}

// ==================== New Clean Result Contract Types ====================

export interface HorizonResultDetail {
  horizon_label: string; // '1D' | '3D' | '7D' | '30D'
  horizon_days: number;
  bear_case_price: number;
  bear_price: number;
  base_case_price: number;
  base_price: number;
  bull_case_price: number;
  bull_price: number;
  expected_return: number;
  probability_of_gain: number;
  probability_of_loss: number;
  projected_volatility: number;
  confidence_band_width: number;
  risk_score: number;
  risk_level: string;
  var_95: number;
  cvar_95: number;
  explanation: string;
}

export interface AssetProjectionResult {
  symbol: string;
  name: string;
  asset_class: string;
  latest_price: number;
  latest_date: string;
  daily_return: number;
  data_mode: string; // 'live' | 'cached' | 'demo'
  horizons: HorizonResultDetail[];

  // Supporting fields for details page and charts
  bear_scenario_path: number[];
  base_scenario_path: number[];
  bull_scenario_path: number[];
  monte_carlo_paths: number[][];
  probability_density_data?: DensityData;
  explainability?: any;
  
  // Nested asset detail mapping to prevent breaks on details page
  asset: {
    symbol: string;
    name: string;
    asset_class: string;
    last_close: number;
    latest_date: string;
  };
  projection_horizon_results: HorizonResultDetail[];
  explanation_text: ExplanationText;
}

export interface ValidationSummaryItem {
  ticker: string;
  lookback_window: string;
  annualized_volatility: number;
  sharpe_ratio: number;
  range_hit_rate_7d: number;
  base_case_error_mape: number;
  risk_model_reliability: number;
}

export interface ValidationSummary {
  average_hit_rate: number;
  reliability_level: string;
  metrics: ValidationSummaryItem[];
}

export interface DashboardOverviewResult {
  last_updated: string;
  data_mode: string; // 'live' | 'cached' | 'demo'
  total_assets: number;
  highest_risk_asset: string;
  best_risk_reward_asset: string;
  average_probability_of_loss_7d: number;
  asset_cards: AssetProjectionResult[];
  market_summary_text: string;
  validation_summary: ValidationSummary;
}

