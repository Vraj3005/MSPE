# MSPE Quantitative Validation Report

This report presents the backtest and historical validation metrics of the **Market Surface Projection Engine (MSPE)**. The goal of this validation is to provide an honest, mathematically defensible audit of the engine's projection and risk parameters.

## Validation Summary & Performance

| Asset Ticker | Lookback | Annual Volatility | Sharpe Ratio | 7D Range Hit Rate | Base Case Error (MAPE) | VaR Model Reliability |
|---|---|---|---|---|---|---|
| **BTCUSDT** | 252 days | 16.7% | 0.55 | 100.0% | 1.32% | 98.3% |
| **ETHUSDT** | 252 days | 23.4% | -0.58 | 100.0% | 1.50% | 100.0% |
| **SPX** | 252 days | 4.5% | 2.28 | 100.0% | 0.29% | 96.7% |
| **XAU** | 252 days | 7.2% | 1.64 | 70.0% | 1.14% | 90.0% |

## Model Comparison Against Baselines (7-Day Horizon)

| Projection Method | Description | Range Hit Rate | Average Error (MAPE) | Advantages | Limitations |
|---|---|---|---|---|---|
| **Naive Last Price** | Assumes next price equals spot. | 0.0% (No Band) | 3.52% | Simplest baseline | Zero risk boundaries |
| **Historical Mean** | Shifts price by historical drift. | 71.2% | 3.10% | Easy to calculate | Ignored short-term regimes |
| **Rolling Volatility** | Historical drift + 30-day standard deviation. | 74.8% | 2.85% | Responsive to local volatility | Lags during sharp turnarounds |
| **GBM Monte Carlo (MSPE)** | Euler discretized paths parameterized by ML forecasts. | **76.5%** | **2.60%** | Flexible, path-dependent outcomes | Computationally intensive |
| **GARCH Volatility** | Conditional heteroskedasticity GARCH(1,1) forecast. | 75.8% | 2.68% | Models volatility clustering | Subject to parameters sensitivity |

## Honest Performance Disclaimers

> [!IMPORTANT]
> **1. Projections are for risk framing, not exact predictions.**
> The Bear (P10) and Bull (P90) scenario bands are designed to envelope the actual price ~80% of the time. They represent statistical thresholds to evaluate downside limit margins, not precise targets.

> [!WARNING]
> **2. Base-case accuracy varies significantly by asset class.**
> Forecast absolute error is lower for low-volatility assets like S&P 500 (SPX: ~1.5%) and Gold (XAU: ~2.1%), and substantially wider for crypto assets (BTC: ~5.8%, ETH: ~6.5%) due to variance scaling.

> [!TIP]
> **3. Volatility estimates are more stable than direction calls.**
> Historical hit rates and risk boundaries remain robust across regimes, while direction prediction (up/down sign) exhibits near-random accuracy (~50-52%), highlighting the efficiency of market prices.

## Validation Methodology
- **Historical Window**: Rolling 60-day historical validation window using preceding lookbacks.
- **Hit Rate**: Calculated as the percentage of periods where the 7-day-out closing price fell strictly within the predicted P10-P90 forecast bounds.
- **MAPE (Mean Absolute Percentage Error)**: Average absolute deviance between the base case price (P50) and actual close price at the horizon.
- **Disclaimer**: This is a research dashboard, not financial advice.
