import numpy as np
import pandas as pd
from typing import Dict, List, Any, Tuple

def compute_daily_returns(prices: np.ndarray) -> np.ndarray:
    """Computes daily percentage returns for a price series."""
    if len(prices) < 2:
        return np.array([])
    return (prices[1:] - prices[:-1]) / prices[:-1]

def calculate_var_historical(returns: np.ndarray, confidence: float = 0.95) -> float:
    """Calculates Empirical (Historical Simulation) Value at Risk (VaR)."""
    if len(returns) == 0:
        return 0.0
    alpha = 1.0 - confidence
    var_val = -np.percentile(returns, alpha * 100.0)
    return max(0.0, float(var_val))

def calculate_var_parametric(returns: np.ndarray, confidence: float = 0.95) -> float:
    """Calculates Parametric (Variance-Covariance) Value at Risk (VaR)."""
    if len(returns) == 0:
        return 0.0
    from scipy.stats import norm
    mean = np.mean(returns)
    std = np.std(returns)
    z_score = norm.ppf(confidence)
    var_val = -(mean - z_score * std)
    return max(0.0, float(var_val))

def calculate_expected_shortfall(returns: np.ndarray, confidence: float = 0.95) -> float:
    """Calculates Historical Expected Shortfall (ES / CVaR)."""
    if len(returns) == 0:
        return 0.0
    var_val = calculate_var_historical(returns, confidence)
    # Filter returns worse than negative VaR
    tail_returns = returns[returns < -var_val]
    if len(tail_returns) == 0:
        # Fallback if no returns exceed VaR (e.g. uniform or small series)
        tail_returns = np.sort(returns)[:max(1, int(len(returns) * (1 - confidence)))]
    es_val = -np.mean(tail_returns)
    return max(0.0, float(es_val))

def calculate_max_drawdown(prices: np.ndarray) -> float:
    """Calculates the absolute maximum drawdown from prices peak-to-trough decline."""
    if len(prices) < 2:
        return 0.0
    
    # Calculate running max
    running_max = np.maximum.accumulate(prices)
    drawdowns = (running_max - prices) / running_max
    mdd_val = np.max(drawdowns)
    return max(0.0, float(mdd_val))

def calculate_sharpe_ratio(returns: np.ndarray, risk_free_rate_annual: float = 0.02) -> float:
    """Calculates annualized Sharpe Ratio based on daily returns."""
    if len(returns) == 0:
        return 0.0
    
    daily_rf = risk_free_rate_annual / 252.0
    excess_returns = returns - daily_rf
    
    mean_excess = np.mean(excess_returns)
    std_dev = np.std(returns)
    
    if std_dev < 1e-8:
        return 0.0
    
    daily_sharpe = mean_excess / std_dev
    return float(daily_sharpe * np.sqrt(252.0))

def calculate_sortino_ratio(returns: np.ndarray, risk_free_rate_annual: float = 0.02) -> float:
    """Calculates annualized Sortino Ratio focusing strictly on downside risk."""
    if len(returns) == 0:
        return 0.0
    
    daily_rf = risk_free_rate_annual / 252.0
    excess_returns = returns - daily_rf
    
    mean_excess = np.mean(excess_returns)
    
    # Calculate downside deviation (semi-standard deviation)
    downside_returns = excess_returns[excess_returns < 0.0]
    if len(downside_returns) == 0:
        return 0.0
    
    downside_std = np.sqrt(np.sum(downside_returns ** 2) / len(returns))
    
    if downside_std < 1e-8:
        return 0.0
    
    daily_sortino = mean_excess / downside_std
    return float(daily_sortino * np.sqrt(252.0))

def calculate_calmar_ratio(prices: np.ndarray, annualized_return: float, risk_free_rate_annual: float = 0.02) -> float:
    """Calculates the Calmar Ratio (Annualized Excess Return / Max Drawdown)."""
    mdd = calculate_max_drawdown(prices)
    if mdd < 1e-6:
        return 0.0
    return float((annualized_return - risk_free_rate_annual) / mdd)

def calculate_beta_alpha(
    asset_returns: np.ndarray, benchmark_returns: np.ndarray, risk_free_rate_annual: float = 0.02
) -> Tuple[float, float]:
    """Calculates systemic risk (Beta) and risk-adjusted excess performance (Jensen's Alpha)."""
    if len(asset_returns) == 0 or len(benchmark_returns) == 0 or len(asset_returns) != len(benchmark_returns):
        return 1.0, 0.0
    
    covariance_matrix = np.cov(asset_returns, benchmark_returns)
    covariance = covariance_matrix[0, 1]
    benchmark_variance = covariance_matrix[1, 1]
    
    if benchmark_variance < 1e-8:
        beta = 1.0
    else:
        beta = float(covariance / benchmark_variance)
    
    # Calculate annualized returns
    mean_asset = np.mean(asset_returns) * 252.0
    mean_benchmark = np.mean(benchmark_returns) * 252.0
    
    # Jensen's Alpha: Alpha = E(R_asset) - [R_f + Beta * (E(R_bench) - R_f)]
    alpha = float(mean_asset - (risk_free_rate_annual + beta * (mean_benchmark - risk_free_rate_annual)))
    
    return beta, alpha

def compute_correlation_matrix(asset_returns_dict: Dict[str, np.ndarray]) -> Dict[str, Dict[str, float]]:
    """Calculates a Pearson product-moment correlation coefficient matrix across return vectors."""
    tickers = list(asset_returns_dict.keys())
    if not tickers:
        return {}
    
    # Align return indices
    min_len = min(len(asset_returns_dict[t]) for t in tickers)
    if min_len == 0:
        return {t1: {t2: 0.0 for t2 in tickers} for t1 in tickers}
    
    aligned_returns = {t: asset_returns_dict[t][-min_len:] for t in tickers}
    df = pd.DataFrame(aligned_returns)
    corr_df = df.corr()
    
    # Convert correlation dataframe to nested dictionary
    grid = {}
    for t1 in tickers:
        grid[t1] = {}
        for t2 in tickers:
            val = corr_df.loc[t1, t2]
            grid[t1][t2] = round(float(val) if not np.isnan(val) else 0.0, 4)
            
    return grid

def run_portfolio_stress_test(
    weights: Dict[str, float], portfolio_equity: float
) -> Dict[str, Dict[str, float]]:
    """Simulates shocks to active assets and calculates portfolio returns/USD impact under macro scenarios.
    
    Stress Shocks Definition:
      {Scenario: {Ticker: ShockPercent}}
    """
    scenarios = {
        "2008_GFC": {
            "BTCUSDT": -0.65,
            "ETHUSDT": -0.70,
            "SPX": -0.40,
            "XAU": 0.10
        },
        "COVID_CRASH_2020": {
            "BTCUSDT": -0.50,
            "ETHUSDT": -0.55,
            "SPX": -0.30,
            "XAU": -0.05
        },
        "DOTCOM_BURST": {
            "BTCUSDT": -0.70,
            "ETHUSDT": -0.75,
            "SPX": -0.50,
            "XAU": -0.10
        },
        "CRYPTO_WINTER_2022": {
            "BTCUSDT": -0.70,
            "ETHUSDT": -0.75,
            "SPX": -0.20,
            "XAU": 0.05
        },
        "HIGH_INFLATION": {
            "BTCUSDT": -0.30,
            "ETHUSDT": -0.35,
            "SPX": -0.15,
            "XAU": 0.20
        }
    }
    
    results = {}
    
    for scenario_name, shocks in scenarios.items():
        portfolio_shock = 0.0
        details = {}
        
        for ticker, w in weights.items():
            # If the ticker exists in shock scenarios, apply it, else default to 0.0 (or simulated benchmark mapping)
            shock_pct = shocks.get(ticker, 0.0)
            portfolio_shock += w * shock_pct
            details[f"{ticker}_shock"] = round(shock_pct, 4)
            
        usd_impact = portfolio_equity * portfolio_shock
        
        results[scenario_name] = {
            "scenario_shock": round(portfolio_shock, 6),
            "usd_impact": round(usd_impact, 2),
            **details
        }
        
    return results
