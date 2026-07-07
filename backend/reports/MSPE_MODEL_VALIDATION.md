# MSPE Model Validation Report

*Generated: 2026-07-07 17:13 UTC*

*Data mode: demo*

## What This Report Shows

This report compares MSPE's projection engine against simple baselines
to prove (or honestly admit) where the engine adds value.

> **Key question**: Is MSPE better than just guessing the last price?

## Overall Conclusion

MSPE outperformed baselines across most horizons for ETHUSDT, SPX, XAU. Mspe improved projection quality at select horizons for btcusdt (30d). Where MSPE does not beat baselines on point accuracy, it still provides structured risk analytics, bear/base/bull scenarios, and Monte Carlo-based range projections that simple price-following cannot offer.

## Validation Summary

| Asset | Projection Accuracy | Range Reliability | Risk Warning | Baseline Improvement | Confidence |
|:------|:-------------------:|:-----------------:|:------------:|:--------------------:|:----------:|
| **BTCUSDT** | 61.8% | 81% | Good | Similar to baseline | High |
| **ETHUSDT** | 79.7% | 81% | Fair | Similar to baseline | High |
| **SPX** | 91.8% | 88% | Good | Similar to baseline | High |
| **XAU** | 90.0% | 81% | Good | +13% over rolling_mean_baseline | High |

### What These Metrics Mean

- **Projection Accuracy**: How close was the base-case projection to the actual price historically?
- **Range Reliability**: How often did the actual price stay inside the projected bear–bull range?
- **Risk Warning Quality**: How well did VaR warnings match actual large moves? (Good = VaR breaches close to expected 5%)
- **Baseline Improvement**: How much better is MSPE vs. simply using the last known price?
- **Confidence**: High/Medium/Low based on overall validation score.

---

## BTCUSDT — Bitcoin / Tether USDT

### Conclusion

MSPE showed improvement for BTCUSDT only at 30D. For other horizons, simpler models performed similarly or better. The engine is most useful for risk range estimation.

### Model Comparison by Horizon

| Horizon | Best Model | Beats Baseline? | Calibration | Coverage | Direction | MAE |
|:--------|:-----------|:---------------:|:-----------:|:--------:|:---------:|:---:|
| 1D | last_price_baseline | ❌ No | 81.7% | 81% | 69% | 0.0158 |
| 3D | rolling_mean_baseline | ❌ No | 63.9% | 88% | 56% | 0.0198 |
| 7D | last_price_baseline | ❌ No | 72.7% | 81% | 75% | 0.0382 |
| 30D | ewma | ✅ Yes | 59.6% | 82% | 88% | 0.0835 |

**1D**: For 1D projections, baseline methods performed best for BTCUSDT. However, the projection range still captured actual prices 81% of the time. MSPE is more useful for risk range estimation than exact direction at this horizon.

**3D**: For 3D projections, baseline methods performed best for BTCUSDT. However, the projection range still captured actual prices 88% of the time. MSPE is more useful for risk range estimation than exact direction at this horizon.

**7D**: For 7D projections, baseline methods performed best for BTCUSDT. However, the projection range still captured actual prices 81% of the time. MSPE is more useful for risk range estimation than exact direction at this horizon.

**30D**: MSPE improved 30D projection quality for BTCUSDT by 4% over the best baseline. Range coverage: 82%.

### Full Model Ranking (7-Day Horizon)

| Rank | Model | Calibration | Coverage | Direction | MAE | Band Width |
|:----:|:------|:-----------:|:--------:|:---------:|:---:|:----------:|
| 1 | last_price_baseline ⭐ | 72.7% | 81% | 75% | 0.0382 | 12.7% |
| 2 | rolling_vol_baseline | 72.7% | 81% | 75% | 0.0382 | 12.7% |
| 3 | rolling_mean_baseline | 72.0% | 81% | 69% | 0.0359 | 12.8% |
| 4 | garch | 67.5% | 81% | 50% | 0.0386 | 12.8% |
| 5 | ewma | 60.0% | 88% | 69% | 0.0339 | 13.5% |
| 6 | arima | 56.5% | 88% | 50% | 0.0341 | 12.1% |
| 7 | xgboost | 35.7% | 62% | 69% | 0.0519 | 12.3% |
| 8 | historical_mean_baseline | 25.8% | 100% | 44% | 0.0418 | 19.9% |

---

## ETHUSDT — Ethereum / Tether USDT

### Conclusion

MSPE improved projection quality for ETHUSDT at 1D, 3D, 30D horizons, while baseline methods remained competitive at other horizons.

### Model Comparison by Horizon

| Horizon | Best Model | Beats Baseline? | Calibration | Coverage | Direction | MAE |
|:--------|:-----------|:---------------:|:-----------:|:--------:|:---------:|:---:|
| 1D | xgboost | ✅ Yes | 82.4% | 81% | 50% | 0.0079 |
| 3D | arima | ✅ Yes | 82.3% | 81% | 69% | 0.0146 |
| 7D | rolling_mean_baseline | ❌ No | 74.2% | 81% | 44% | 0.0203 |
| 30D | arima | ✅ Yes | 63.9% | 76% | 76% | 0.0550 |

**1D**: MSPE's xgboost significantly outperformed baselines for ETHUSDT at the 1D horizon (+42% improvement). Range coverage: 81%, directional accuracy: 50%.

**3D**: MSPE improved 3D projection quality for ETHUSDT by 6% over the best baseline. Range coverage: 81%.

**7D**: For 7D projections, baseline methods performed best for ETHUSDT. However, the projection range still captured actual prices 81% of the time. MSPE is more useful for risk range estimation than exact direction at this horizon.

**30D**: MSPE's arima significantly outperformed baselines for ETHUSDT at the 30D horizon (+11% improvement). Range coverage: 76%, directional accuracy: 76%.

### Full Model Ranking (7-Day Horizon)

| Rank | Model | Calibration | Coverage | Direction | MAE | Band Width |
|:----:|:------|:-----------:|:--------:|:---------:|:---:|:----------:|
| 1 | rolling_mean_baseline ⭐ | 74.2% | 81% | 44% | 0.0203 | 6.9% |
| 2 | arima | 66.6% | 88% | 69% | 0.0204 | 6.8% |
| 3 | last_price_baseline | 61.1% | 88% | 38% | 0.0187 | 6.9% |
| 4 | rolling_vol_baseline | 61.1% | 88% | 38% | 0.0187 | 6.9% |
| 5 | garch | 58.1% | 88% | 25% | 0.0197 | 6.9% |
| 6 | ewma | 38.8% | 100% | 50% | 0.0179 | 7.1% |
| 7 | xgboost | 34.5% | 44% | 50% | 0.0305 | 6.1% |
| 8 | historical_mean_baseline | 31.9% | 100% | 25% | 0.0199 | 10.9% |

---

## SPX — S&P 500 Index

### Conclusion

MSPE improved projection quality for SPX at 1D, 3D, 30D horizons, while baseline methods remained competitive at other horizons.

### Model Comparison by Horizon

| Horizon | Best Model | Beats Baseline? | Calibration | Coverage | Direction | MAE |
|:--------|:-----------|:---------------:|:-----------:|:--------:|:---------:|:---:|
| 1D | xgboost | ✅ Yes | 74.4% | 88% | 56% | 0.0026 |
| 3D | ewma | ✅ Yes | 79.6% | 81% | 31% | 0.0061 |
| 7D | last_price_baseline | ❌ No | 73.2% | 88% | 69% | 0.0082 |
| 30D | garch | ✅ Yes | 74.5% | 76% | 59% | 0.0167 |

**1D**: MSPE's xgboost significantly outperformed baselines for SPX at the 1D horizon (+34% improvement). Range coverage: 88%, directional accuracy: 56%.

**3D**: MSPE's ewma significantly outperformed baselines for SPX at the 3D horizon (+16% improvement). Range coverage: 81%, directional accuracy: 31%.

**7D**: For 7D projections, baseline methods performed best for SPX. However, the projection range still captured actual prices 88% of the time. MSPE is more useful for risk range estimation than exact direction at this horizon.

**30D**: MSPE's garch significantly outperformed baselines for SPX at the 30D horizon (+10% improvement). Range coverage: 76%, directional accuracy: 59%.

### Full Model Ranking (7-Day Horizon)

| Rank | Model | Calibration | Coverage | Direction | MAE | Band Width |
|:----:|:------|:-----------:|:--------:|:---------:|:---:|:----------:|
| 1 | last_price_baseline ⭐ | 73.2% | 88% | 69% | 0.0082 | 3.3% |
| 2 | rolling_vol_baseline | 73.2% | 88% | 69% | 0.0082 | 3.3% |
| 3 | rolling_mean_baseline | 72.9% | 88% | 69% | 0.0088 | 3.4% |
| 4 | ewma | 69.0% | 88% | 50% | 0.0091 | 3.5% |
| 5 | garch | 59.7% | 94% | 62% | 0.0079 | 3.1% |
| 6 | arima | 59.5% | 94% | 62% | 0.0081 | 3.3% |
| 7 | historical_mean_baseline | 59.4% | 94% | 62% | 0.0079 | 3.9% |
| 8 | xgboost | 50.9% | 62% | 62% | 0.0107 | 2.7% |

---

## XAU — Gold Commodity

### Conclusion

MSPE improved projection quality for XAU at 1D, 3D, 7D horizons, while baseline methods remained competitive at other horizons.

### Model Comparison by Horizon

| Horizon | Best Model | Beats Baseline? | Calibration | Coverage | Direction | MAE |
|:--------|:-----------|:---------------:|:-----------:|:--------:|:---------:|:---:|
| 1D | ewma | ✅ Yes | 78.4% | 75% | 56% | 0.0043 |
| 3D | arima | ✅ Yes | 82.6% | 81% | 50% | 0.0077 |
| 7D | garch | ✅ Yes | 83.5% | 81% | 62% | 0.0100 |
| 30D | historical_mean_baseline | ❌ No | 64.8% | 82% | 24% | 0.0262 |

**1D**: MSPE marginally improved 1D projections for XAU. The improvement is small (0%), suggesting both approaches have similar predictive power at this horizon.

**3D**: MSPE improved 3D projection quality for XAU by 4% over the best baseline. Range coverage: 81%.

**7D**: MSPE's garch significantly outperformed baselines for XAU at the 7D horizon (+13% improvement). Range coverage: 81%, directional accuracy: 62%.

**30D**: For 30D projections, baseline methods performed best for XAU. However, the projection range still captured actual prices 82% of the time. MSPE is more useful for risk range estimation than exact direction at this horizon.

### Full Model Ranking (7-Day Horizon)

| Rank | Model | Calibration | Coverage | Direction | MAE | Band Width |
|:----:|:------|:-----------:|:--------:|:---------:|:---:|:----------:|
| 1 | garch ⭐ | 83.5% | 81% | 62% | 0.0100 | 3.6% |
| 2 | ewma | 79.2% | 75% | 75% | 0.0086 | 3.3% |
| 3 | arima | 74.6% | 75% | 56% | 0.0106 | 3.3% |
| 4 | rolling_mean_baseline | 73.7% | 75% | 50% | 0.0098 | 3.3% |
| 5 | historical_mean_baseline | 66.6% | 88% | 44% | 0.0107 | 4.7% |
| 6 | last_price_baseline | 59.5% | 69% | 44% | 0.0106 | 3.3% |
| 7 | rolling_vol_baseline | 59.5% | 69% | 44% | 0.0106 | 3.3% |
| 8 | xgboost | 43.0% | 56% | 56% | 0.0137 | 3.5% |

---

## Limitations

- These results are from walk-forward backtesting on historical or synthetic data.
- Past performance does not guarantee future results.
- MSPE does not predict exact prices — it estimates ranges of possible outcomes.
- When baselines perform better, we report it honestly.
- Validation uses expanding-window methodology to prevent lookahead bias.
- This is not financial advice.
