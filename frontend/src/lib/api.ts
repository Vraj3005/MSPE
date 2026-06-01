export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Type Definitions
export interface Asset {
  id: string;
  ticker: string;
  name: string;
  asset_class: string;
  is_active: boolean;
}

export interface MarketBar {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  resolution: string;
}

export interface MarketFeature {
  timestamp: string;
  resolution: string;
  asset_id: string;
  sma_20?: number;
  ema_20?: number;
  macd?: number;
  macd_signal?: number;
  macd_histogram?: number;
  rsi_14?: number;
  adx_14?: number;
  atr_14?: number;
  historical_volatility_30?: number;
  parkinson_volatility_30?: number;
  support_30?: number;
  resistance_30?: number;
  volume_profile?: any;
  returns_1d?: number;
  log_returns?: number;
  rolling_mean_30?: number;
  rolling_variance_30?: number;
  rolling_skewness_30?: number;
  rolling_kurtosis_30?: number;
}

export interface MarketForecast {
  timestamp: string;
  horizon_days: number;
  expected_return: number;
  expected_volatility: number;
  confidence_score: number;
}

export interface BearBaseBullPathNode {
  time: string;
  price: number;
}

export interface ProjectedSurfaceBase {
  projection_time: string;
  price: number;
  density: number;
  p10_price: number;
  p50_price: number;
  p90_price: number;
}

export interface SurfaceProjectionResponse {
  ticker: string;
  run_id: string;
  timestamp: string;
  model_type: string;
  bear_scenario: BearBaseBullPathNode[];
  base_scenario: BearBaseBullPathNode[];
  bull_scenario: BearBaseBullPathNode[];
  grid: ProjectedSurfaceBase[];
}

export interface TradingSignal {
  id: string;
  asset_id: string;
  timestamp: string;
  strategy_name: string;
  signal_type: string; // 'LONG', 'SHORT', 'EXIT', 'NO_TRADE'
  entry_price: number;
  stop_loss: number;
  take_profit: number;
  risk_reward_ratio: number;
  position_size_usd: number;
  confidence_score: number;
  rank_score: number;
  details: Record<string, any>;
  is_active: boolean;
  ticker?: string;
}

export interface PortfolioExposureSummary {
  total_equity_usd: number;
  total_active_risk_usd: number;
  total_active_risk_pct: number;
  remaining_risk_capacity_usd: number;
  active_positions_count: number;
}

export interface AssetRiskMetrics {
  id: string;
  asset_id: string;
  timestamp: string;
  ticker?: string;
  var_95: number;
  var_99: number;
  expected_shortfall_95: number;
  expected_shortfall_99: number;
  max_drawdown: number;
  sharpe_ratio: number;
  sortino_ratio: number;
  calmar_ratio: number;
  beta: number;
  alpha: number;
  details: Record<string, any>;
}

export interface PortfolioRiskMetrics {
  id: string;
  timestamp: string;
  var_95: number;
  var_99: number;
  expected_shortfall_95: number;
  expected_shortfall_99: number;
  max_drawdown: number;
  sharpe_ratio: number;
  sortino_ratio: number;
  calmar_ratio: number;
  beta: number;
  alpha: number;
  correlation_matrix: Record<string, Record<string, number>>;
  stress_test_results: Record<string, Record<string, any>>;
  details: Record<string, any>;
}

export interface CorrelationMatrixResponse {
  assets: string[];
  matrix: number[][];
}

export interface StressScenarioResult {
  scenario_name: string;
  spx_shock: number;
  asset_shocks: Record<string, number>;
  portfolio_return_shock: number;
  portfolio_usd_impact: number;
}

export interface StressTestSummary {
  timestamp: string;
  scenarios: StressScenarioResult[];
}

// API Fetch Helper
async function apiRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
  });

  if (!response.ok) {
    let errorDetail = 'API Request failed';
    try {
      const errorJson = await response.json();
      errorDetail = errorJson.detail || JSON.stringify(errorJson);
    } catch {
      errorDetail = await response.text();
    }
    throw new Error(`[${response.status}] ${errorDetail}`);
  }

  return response.json() as Promise<T>;
}

// REST endpoints client calls mapping
export const api = {
  // 1. Assets Layer
  getAssets: () => apiRequest<Asset[]>('/api/v1/assets/'),
  
  getHistoricalBars: (
    ticker: string,
    resolution: string = '1d',
    startTime?: string,
    endTime?: string
  ) => {
    let path = `/api/v1/assets/${ticker}/bars?resolution=${resolution}`;
    if (startTime) path += `&start_time=${startTime}`;
    if (endTime) path += `&end_time=${endTime}`;
    return apiRequest<MarketBar[]>(path);
  },
  
  triggerIngestionSync: () => apiRequest<{ status: string; detail: string }>('/api/v1/assets/sync', {
    method: 'POST',
  }),

  // 2. Feature Engineering Layer
  getFeatures: (ticker: string, resolution: string = '1d') =>
    apiRequest<MarketFeature[]>(`/api/v1/features/${ticker}?resolution=${resolution}`),
  
  triggerComputeFeatures: (ticker: string, resolution: string = '1d') =>
    apiRequest<{ status: string; detail: string }>(`/api/v1/features/${ticker}/compute?resolution=${resolution}`, {
      method: 'POST',
    }),

  // 3. Forecasting Layer
  getForecasts: (ticker: string, horizonDays?: number) => {
    let path = `/api/v1/forecasts/${ticker}`;
    if (horizonDays) path += `?horizon_days=${horizonDays}`;
    return apiRequest<MarketForecast[]>(path);
  },
  
  triggerTrainModel: (ticker: string, modelType: string, version: string = 'v1.0.0') =>
    apiRequest<{ status: string; detail: string }>(`/api/v1/forecasts/${ticker}/train`, {
      method: 'POST',
      body: JSON.stringify({ model_type: modelType, version }),
    }),

  // 4. Surface Projections Layer
  getLatestProjection: (ticker: string) =>
    apiRequest<SurfaceProjectionResponse>(`/api/v1/projections/${ticker}/latest`),
  
  triggerProjectionRun: (ticker: string, numPaths: number = 10000, steps: number = 7) =>
    apiRequest<{ status: string; detail: string }>(`/api/v1/projections/${ticker}/run`, {
      method: 'POST',
      body: JSON.stringify({ num_paths: numPaths, steps }),
    }),

  // 5. Trading Signals Layer
  getActiveSignals: () => apiRequest<TradingSignal[]>('/api/v1/signals/active'),
  
  getPortfolioExposure: () => apiRequest<PortfolioExposureSummary>('/api/v1/signals/exposure'),
  
  triggerSignalsEvaluation: () => apiRequest<{ status: string; detail: string }>('/api/v1/signals/evaluate', {
    method: 'POST',
  }),

  // 6. Risk Analytics Layer
  getLatestPortfolioRisk: () => apiRequest<PortfolioRiskMetrics>('/api/v1/risk/portfolio/latest'),
  
  getAssetsRiskMetrics: () => apiRequest<AssetRiskMetrics[]>('/api/v1/risk/assets'),
  
  getCorrelationMatrix: () => apiRequest<CorrelationMatrixResponse>('/api/v1/risk/correlation'),
  
  getStressTestSummary: () => apiRequest<StressTestSummary>('/api/v1/risk/stress-test'),
  
  triggerRiskEvaluation: () => apiRequest<{ status: string; detail: string }>('/api/v1/risk/evaluate', {
    method: 'POST',
  }),

  // 7. Backtest Simulation Engine
  runBacktest: (ticker: string, strategyName: string = 'SMA_CROSSOVER', initialCapital: number = 100000.0) =>
    apiRequest<BacktestResponse>(`/api/v1/backtest/${ticker}?strategy_name=${strategyName}&initial_capital=${initialCapital}`),
};

export interface EquityCurveNode {
  timestamp: string;
  equity: number;
}

export interface TradeLogNode {
  id: number;
  type: string;
  entry_time: string;
  exit_time: string;
  entry_price: number;
  exit_price: number;
  return_pct: number;
  pnl_usd: number;
  capital_after: number;
}

export interface BacktestResponse {
  strategy: string;
  ticker: string;
  total_return_pct: number;
  total_pnl_usd: number;
  win_rate_pct: number;
  total_trades: number;
  profit_factor: number;
  max_drawdown_pct: number;
  final_capital_usd: number;
  equity_curve: EquityCurveNode[];
  trade_logs: TradeLogNode[];
}
