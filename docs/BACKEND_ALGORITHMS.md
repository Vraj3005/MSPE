# MSPE Backend Algorithms & Quantitative Methodology

This document outlines the mathematical models, statistical architectures, and validation frameworks powering the Market Surface Projection Engine (MSPE). It serves as a guide for quantitative engineers, machine learning specialists, and technical interview preparation.

---

## 1. What the Backend Does

MSPE is a quantitative time-series modeling and risk management backend. Its primary objective is not to guess single-point future asset prices, but to **simulate the full probability distribution of future price pathways** over multiple horizons (1D, 3D, 7D, and 30D). 

By generating these paths, the engine estimates:
- **Trend Pathways:** Downside (Bear Case), Median (Base Case), and Upside (Bull Case).
- **Tail Risks:** 95% Value at Risk (VaR) and 95% Conditional Value at Risk (CVaR).
- **Probability of Loss:** The likelihood that the asset's price will end below the current spot close.

---

## 2. Quantitative Data Flow

MSPE operates as a decoupled data-to-projection pipeline:

```
[Historical Price/Volume Data]
             │
             ▼
┌─────────────────────────┐
│ Feature Engineering &   │ ──► Lags, momentum, drawdowns, rolling vol
│ Return Transformation   │
└─────────────────────────┘
             │
             ▼
┌─────────────────────────┐
│ Walk-Forward Validation │ ──► Computes historical coverage, MAE, calibration
│   (All 8 Models)        │
└─────────────────────────┘
             │
             ▼
┌─────────────────────────┐
│  Model Selection Logic  │ ──► Selects best model; triggers honest fallback
└─────────────────────────┘
             │
             ▼
┌─────────────────────────┐
│  Monte Carlo Simulator  │ ──► Runs 10,000 Euler-Maruyama GBM paths
└─────────────────────────┘
             │
             ▼
┌─────────────────────────┐
│  Risk Analytics Layer   │ ──► Sorts terminal states for VaR/CVaR limits
└─────────────────────────┘
             │
             ▼
┌─────────────────────────┐
│   Explainability API    │ ──► Formulates plain-English UX summaries
└─────────────────────────┘
```

---

## 3. The Model Stack

MSPE implements an 8-model stack categorised into three distinct layers:
1. **Baselines:** Naive structures to prove advanced model value.
2. **Statistical Time Series:** Classical parametric modeling of mean and variance dynamics.
3. **Machine Learning:** Tree-based non-linear return and volatility forecasting.

---

## 4. Baseline Models

### Last Price Baseline (`last_price_baseline`)
- **What it does:** Assumes that the expected future price equals the current spot price (expected return $E[r] = 0$). Volatility is set to the recent 30-day realized standard deviation.
- **Why it is used:** Serves as the absolute minimum baseline of a random walk. Any predictive model must beat this naive benchmark.
- **When it works well:** In highly efficient markets where price follows a pure martingale process (no drift).
- **When it fails:** In trending or momentum-driven markets.
- **Output:** Expected return = `0.0`, expected volatility = recent realized volatility.
- **How it is validated:** Evaluated on out-of-sample MAE and prediction interval coverage.

### Historical Mean Baseline (`historical_mean_baseline`)
- **What it does:** Projects return using the long-run historical daily mean return over the entire available dataset.
- **Why it is used:** Tests whether simple historical drift is sufficient for long-term trends.
- **When it works well:** Over long horizons under stable economic regimes.
- **When it fails:** During rapid market turns, crises, or high-volatility regimes.
- **Output:** Expected return = historical mean $\times$ horizon, expected volatility = full-history standard deviation.
- **How it is validated:** Walk-forward out-of-sample error compared to other models.

### Rolling Volatility Model (`rolling_vol_baseline`)
- **What it does:** Predicts expected return = `0.0`, with volatility estimated from a simple 30-day rolling window of realized returns.
- **Why it is used:** Tests if advanced conditional variance models (like GARCH) actually predict volatility clustering better than a standard rolling window.
- **When it works well:** When volatility is stable and does not cluster heavily.
- **When it fails:** During sudden market shocks or regimes with fat-tailed distributions.
- **Output:** Expected return = `0.0`, expected volatility = rolling window standard deviation.
- **How it is validated:** Prediction interval coverage and VaR breach rates.

---

## 5. Statistical Models

### ARIMA(1, 1, 1) (`arima`)
- **What it does:** Fits an Autoregressive Integrated Moving Average model on price levels. It assumes price is integrated of order 1 ($d=1$, first-differenced to returns) with an AR(1) term for momentum and an MA(1) term for shock decay.
- **Why it is used:** Captures short-term linear mean reversion and trends.
- **When it works well:** In markets with clear short-term autocorrelation in returns (e.g., gold or commodities).
- **When it fails:** In noisy asset classes (e.g., highly speculative crypto) where price changes are dominated by sudden, non-linear shocks.
- **Output:** Expected return = projected conditional mean, expected volatility = residual standard deviation.
- **How it is validated:** Walk-forward out-of-sample forecast accuracy (MAE).
- **Code Optimization:** Restricts lookback to the last 120 observations and utilizes `innovations_mle` fitting to prevent execution blocks during web requests.

### GARCH(1, 1) (`garch`)
- **What it does:** A Generalized Autoregressive Conditional Heteroskedasticity model. It models the conditional variance of returns as a function of past squared residuals (ARCH term) and past conditional variances (GARCH term).
- **Why it is used:** Captures "volatility clustering"—the empirical phenomenon where large price moves are followed by large price moves.
- **When it works well:** In equity indices and crypto during regime transitions (calm-to-panic).
- **When it fails:** When volatility shifts are driven by discrete, non-stationary structural breaks rather than autoregressive variance.
- **Output:** Expected return = mean return, expected volatility = forecasted conditional volatility.
- **How it is validated:** Evaluated on the precision of VaR breach rates (target: exactly 5% breaches at a 95% confidence interval).

### Exponentially Weighted Moving Average (`ewma`)
- **What it does:** Computes volatility by placing exponentially decaying weights on past squared returns. 
- **Why it is used:** Highly responsive to recent price shocks without the estimation overhead of GARCH.
- **When it works well:** In fast-moving markets where recent price movements are highly informative of short-term risk.
- **When it fails:** Under long-term static regimes where it overreacts to short-term anomalies.
- **Output:** Expected return = mean return, expected volatility = exponentially weighted standard deviation.
- **How it is validated:** Out-of-sample coverage and band width efficiency.

---

## 6. Machine Learning Models

### XGBoost Dual-Head Regressor (`xgboost`)
- **What it does:** Features are engineered from prices (lags, momentum, rolling means/vols, drawdowns from peaks, volume changes). It fits two independent XGBoost regressors: one predicting future returns (mean) and one predicting future residual squared errors (volatility/variance).
- **Why it is used:** Captures non-linear feature interactions (e.g., how momentum interacts with volume spikes to drive volatility).
- **When it works well:** In complex datasets with multiple overlapping regimes and interactive features.
- **When it fails:** On very small datasets or under extreme market regimes not represented in the training set (high extrapolation error).
- **Output:** Predicted expected return (mean) and expected volatility (derived from squared error projections).
- **How it is validated:** Walk-forward validation. Tree depth is restricted to `max_depth=3` to prevent overfitting.

---

## 7. Monte Carlo Projection Engine

Future price paths are simulated using **Geometric Brownian Motion (GBM)** via Euler-Maruyama discretization:

$$dS_t = \mu S_t dt + \sigma S_t dW_t$$

Where:
- $S_t$: Asset price.
- $\mu$: Drift (derived from the winning model's expected return).
- $\sigma$: Annualized volatility (derived from the winning model's volatility forecast).
- $dW_t$: Wiener process increments ($dW_t = \epsilon \sqrt{dt}$, where $\epsilon \sim N(0, 1)$).

The simulation runs **10,000 parallel paths** over a 30-day horizon. Scenarios are extracted from the terminal states:
- **Bear Case:** 10th percentile path.
- **Base Case:** 50th percentile path (median).
- **Bull Case:** 90th percentile path.

---

## 8. Risk Analytics Layer

Using the simulated paths and historical prices, the engine calculates:
- **95% Value at Risk (VaR):** The 5th percentile of daily returns, indicating the threshold loss that will not be exceeded with 95% confidence over 1 day.
- **95% Conditional Value at Risk (CVaR):** The average return in the worst 5% of daily returns, measuring the expected depth of extreme tail-risk shocks.
- **Downside Probability:** The percentage of simulated paths ending below the starting price.

---

## 9. Validation & Model Selection Logic

### Validation Methodology
MSPE utilizes a **Rolling Window Walk-Forward Validation** framework:

```
Step 1: [ Train (1..200) ] ──► [ Test (201..208) ]
Step 2:      [ Train (9..208) ] ──► [ Test (209..216) ]
Step 3:           [ Train (17..216) ] ──► [ Test (217..224) ]
```

At each validation step:
- The model is fit on a historical lookback window.
- Out-of-sample forecasts are generated for the target horizon.
- Predictions are evaluated against actual price paths using the **Model calibration Score**:

$$\text{Calibration Score} = \text{Directional Accuracy} \times 0.3 + \text{Prediction Interval Coverage} \times 0.7$$

### Selection & Honesty Logic
1. **Performance Rank:** The model with the highest Calibration Score across all walk-forward steps is selected for active projection.
2. **Naive Baseline Validation:** If the selected advanced model (ARIMA, GARCH, XGBoost) does not beat the naive baseline's calibration score, the system:
   - Honestly selects the baseline model.
   - Flags `baseline_beaten = False` in the metadata.
   - Triggers the explainability layer to state: *"At this horizon, naive baseline models performed similarly or better than advanced models."*

---

## 10. Why MSPE is Better Than a Simple Forecast

1. **Focus on Probability Envelopes:** Point forecasts (e.g. "Bitcoin will hit $75,000") are mathematically fragile. MSPE projects statistical price envelopes (bear-to-bull) with target coverage parameters, acknowledging market uncertainty.
2. **Validated Risk Bounds:** Rather than guessing risk, MSPE simulates tail risks (VaR/CVaR) directly from dynamic volatility forecasts.
3. **Transparency and Calibration:** The engine openly shows when it fails to beat simple baselines, preserving recruiter trust and scientific defensibility.

---

## 11. Limitations & Future Work

### Limitations
- **Stationarity Assumption:** Models assume historical volatility structures remain stationary over the projection window.
- **Extrapolation Risk:** Machine learning models (XGBoost) cannot extrapolate trends beyond historical feature limits.
- **Normal/Empirical Residuals:** GBM simulations assume normally distributed random shocks, which can underestimate the frequency of extreme black-swan event tails.

### Future Work
- **Fat-Tailed Simulations:** Incorporating Student's t-distributions or jump-diffusion processes into the Monte Carlo engine to capture heavy-tailed market crashes.
- **Intraday Scaling:** Ingesting high-frequency (1-minute or 5-minute) bars to scale the dataset size to 100,000+ points, making deep learning (LSTMs) statistically viable.

---

## 12. What to Say in Interviews

### The 60-Second Elevator Pitch
> *"I built MSPE—a Market Surface Projection Engine. Instead of trying to output fragile, single-price predictions, it acknowledges market uncertainty by simulating 10,000 parallel future price paths using Geometric Brownian Motion. The engine fits its drift and volatility parameters by evaluating an 8-model stack—including baselines, ARIMA, GARCH, and XGBoost—through a rolling walk-forward backtest. If advanced models fail to beat naive benchmarks, the engine honestly falls back to the baseline and explains this on the dashboard, making the projection framework mathematically defensible."*

### Technical Drilldown
* **Why did you use walk-forward validation instead of a simple train-test split?**
  > *"Financial time-series data is highly non-stationary and suffers from autocorrelation. A standard random train-test split leaks future information into past predictions. Rolling walk-forward validation maintains the temporal ordering of data, simulating how the model would have performed in production."*
* **How did you combine model selection with simulation?**
  > *"The walk-forward engine ranks models on a calibration score that combines directional accuracy and prediction interval coverage. The winning model's expected return and forecasted volatility are passed as parameters into the Euler-Maruyama discretization of Geometric Brownian Motion to simulate terminal scenario boundaries and tail risks."*

### Why Not Deep Learning First?
* **Why didn't you build an LSTM or Transformer?**
  > *"LSTMs have thousands of parameters. The lookback data available for daily price intervals (typically 252 days) is microscopic for deep learning, making LSTMs severely prone to memorizing training noise. Furthermore, importing PyTorch (2GB+ footprint) poses severe memory and runtime constraints on micro hosting instances. I wrote a formal feasibility study justifying why simple regularized models like ARIMA, GARCH, and XGBoost are mathematically superior for this scale."*

### System Architecture
* **Why FastAPI and Next.js?**
  > *"FastAPI allows high-performance CPU execution for quantitative calculations in Python (using NumPy, pandas, statsmodels) and exposes clean type-checked endpoints via Pydantic. Next.js offers a responsive UX that consumes pre-computed validation reports and renders dynamic Plotly charts, bypassing typical SSR limitations through dynamic importing."*
