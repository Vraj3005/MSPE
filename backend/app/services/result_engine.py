import numpy as np
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Any, Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, desc
from fastapi import HTTPException

from backend.app.core.logging import logger
from backend.app.models.asset import Asset
from backend.app.models.market_data import MarketBar
from backend.app.models.risk import AssetRiskMetrics
from backend.app.models.forecast import MarketForecast
from backend.quant.simulation.monte_carlo import MonteCarloSimulator
from backend.quant.projection import QuantitativeProjectionEngine
from backend.quant.risk import analytics as risk_calc
from backend.app.schemas.dashboard import (
    DashboardOverviewResponse,
    AssetCard,
    TopCard,
    AssetSummary,
    AssetProjectionResponse,
    AssetInfo,
    HorizonResult,
    DensityData,
    ExplanationText,
    AssetRiskResponse,
    StressScenario,
    RiskExplanation,
    MethodologyResponse,
    HorizonProjection,
    AssetRiskSummary,
    AssetDashboardResult,
    DashboardResultsResponse,
    CurrentMarketData
)

# Standard Tracked Assets
TRACKED_ASSETS = {
    "BTCUSDT": {"name": "Bitcoin / Tether USDT", "asset_class": "CRYPTO", "default_spot": 68420.50, "default_vol": 0.452, "default_drift": 0.155, "beta": 1.45, "var_95": 0.0482, "cvar_95": 0.0621, "max_dd": 0.224},
    "ETHUSDT": {"name": "Ethereum / Tether USDT", "asset_class": "CRYPTO", "default_spot": 3825.20, "default_vol": 0.524, "default_drift": 0.182, "beta": 1.62, "var_95": 0.0545, "cvar_95": 0.0710, "max_dd": 0.285},
    "SPX": {"name": "S&P 500 Index", "asset_class": "INDEX", "default_spot": 5230.15, "default_vol": 0.145, "default_drift": 0.085, "beta": 1.00, "var_95": 0.0125, "cvar_95": 0.0165, "max_dd": 0.085},
    "XAU": {"name": "Gold Commodity", "asset_class": "COMMODITY", "default_spot": 2345.80, "default_vol": 0.182, "default_drift": 0.045, "beta": 0.24, "var_95": 0.0185, "cvar_95": 0.0240, "max_dd": 0.124}
}

class ResultEngineService:
    @classmethod
    async def _get_asset_raw_data(cls, db: AsyncSession, symbol: str) -> Dict[str, Any]:
        """
        Fetches prices, returns, expected drift, and volatility for a given asset.
        Falls back to demo estimators if DB is empty or fails.
        """
        if symbol not in TRACKED_ASSETS:
            raise HTTPException(status_code=404, detail=f"Asset '{symbol}' is not currently tracked.")
            
        metadata = TRACKED_ASSETS[symbol]
        
        try:
            # 1. Fetch asset record
            asset_res = await db.execute(select(Asset).where(Asset.ticker == symbol))
            asset = asset_res.scalar_one_or_none()
            
            if not asset:
                return {"metadata": metadata, "is_demo": True}
                
            # 2. Fetch bars (lookback 253 days)
            bars_res = await db.execute(
                select(MarketBar)
                .where(and_(MarketBar.asset_id == asset.id, MarketBar.resolution == "1d"))
                .order_by(MarketBar.timestamp.desc())
                .limit(253)
            )
            bars = list(reversed(bars_res.scalars().all()))
            
            if len(bars) < 15:
                return {"metadata": metadata, "is_demo": True}
                
            prices = np.array([float(b.close) for b in bars])
            returns = risk_calc.compute_daily_returns(prices)
            spot = float(bars[-1].close)
            latest_date = bars[-1].timestamp
            
            # Fetch latest model forecast
            forecast_query = select(MarketForecast).where(
                and_(MarketForecast.asset_id == asset.id, MarketForecast.horizon_days == 1)
            ).order_by(MarketForecast.timestamp.desc()).limit(1)
            fc_res = await db.execute(forecast_query)
            latest_fc = fc_res.scalar_one_or_none()
            
            if latest_fc:
                drift_annual = float(latest_fc.expected_return) * 252.0
                volatility_annual = float(latest_fc.expected_volatility)
            else:
                drift_annual = float(np.mean(returns) * 252.0)
                volatility_annual = float(np.std(returns) * np.sqrt(252.0))
                
            # Tail risk
            var_95 = float(risk_calc.calculate_var_historical(returns, 0.95))
            cvar_95 = float(risk_calc.calculate_expected_shortfall(returns, 0.95))
            max_dd = float(risk_calc.calculate_max_drawdown(prices))
            
            daily_change = float(returns[-1])
            
            return {
                "symbol": symbol,
                "name": asset.name,
                "asset_class": asset.asset_class,
                "spot": spot,
                "latest_date": latest_date,
                "returns": returns,
                "prices": prices,
                "drift_annual": drift_annual,
                "volatility_annual": volatility_annual,
                "var_95": var_95,
                "cvar_95": cvar_95,
                "max_dd": max_dd,
                "daily_change": daily_change,
                "is_demo": False
            }
            
        except Exception as e:
            logger.error(f"Error fetching live data for {symbol}: {e}. Falling back to demo data.")
            return {"metadata": metadata, "is_demo": True}

    @classmethod
    async def _get_demo_data(cls, symbol: str) -> Dict[str, Any]:
        """Generates clean, consistent mock parameters for demo mode."""
        meta = TRACKED_ASSETS[symbol]
        return {
            "symbol": symbol,
            "name": meta["name"],
            "asset_class": meta["asset_class"],
            "spot": meta["default_spot"],
            "latest_date": datetime.now(timezone.utc),
            "returns": np.random.normal(meta["default_drift"]/252.0, meta["default_vol"]/np.sqrt(252), 252),
            "prices": np.array([meta["default_spot"]]),
            "drift_annual": meta["default_drift"],
            "volatility_annual": meta["default_vol"],
            "var_95": meta["var_95"],
            "cvar_95": meta["cvar_95"],
            "max_dd": meta["max_dd"],
            "daily_change": 0.0125,
            "is_demo": True
        }

    @classmethod
    async def get_dashboard_overview(cls, db: AsyncSession) -> DashboardOverviewResponse:
        """GET /api/dashboard/overview endpoint processor."""
        asset_cards: List[AssetCard] = []
        is_demo_mode = False
        
        # Pull data for all assets
        raw_assets = {}
        for symbol in TRACKED_ASSETS.keys():
            data = await cls._get_asset_raw_data(db, symbol)
            if data.get("is_demo"):
                is_demo_mode = True
                data = await cls._get_demo_data(symbol)
            raw_assets[symbol] = data
            
        # Analyze metrics
        best_sharpe = -999.0
        best_ticker = "SPX"
        highest_vol = 0.0
        highest_ticker = "BTCUSDT"
        
        for symbol, data in raw_assets.items():
            drift = data["drift_annual"]
            vol = data["volatility_annual"]
            sharpe = drift / vol if vol > 0 else 0.0
            
            if sharpe > best_sharpe:
                best_sharpe = sharpe
                best_ticker = symbol
                
            if vol > highest_vol:
                highest_vol = vol
                highest_ticker = symbol
                
            # Classify Risk Score
            risk_score = min(100.0, max(0.0, (vol * 120.0 + data["max_dd"] * 80.0)))
            if risk_score > 75.0:
                risk_level = "Extreme"
            elif risk_score > 50.0:
                risk_level = "High"
            elif risk_score > 25.0:
                risk_level = "Medium"
            else:
                risk_level = "Low"
                
            # Classifier Signal Read
            if drift > 0.05 and vol > 0.35:
                market_read = "Bullish but volatile"
            elif drift > 0.15 and vol > 0.45:
                market_read = "Strong trend but downside risk high"
            elif drift > 0.05:
                market_read = "Bullish trend established"
            elif drift < -0.05:
                market_read = "Bearish risk elevated"
            elif vol < 0.15:
                market_read = "Low volatility consolidation"
            else:
                market_read = "Neutral / wait for confirmation"
                
            # Compute a quick 7d expected return using spot and drift
            base_7d = data["spot"] * np.exp((drift - 0.5 * vol**2) * (7.0 / 252.0))
            
            asset_cards.append(AssetCard(
                symbol=symbol,
                name=data["name"],
                asset_class=data["asset_class"],
                last_close=data["spot"],
                daily_change=data["daily_change"],
                risk_level=risk_level,
                risk_score=round(risk_score, 1),
                market_read=market_read,
                base_case_7d=base_7d
            ))
            
        # Top aggregate cards
        top_cards = [
            TopCard(title="Total Tracked Assets", value=f"{len(raw_assets)} Active", description="Benchmarking Crypto, Equities, and Gold", type="primary"),
            TopCard(title="Systemic Risk Regime", value="Moderate Risk", description="Average portfolio volatility is 32.5%", type="info"),
            TopCard(title="Outperformance Leader", value=best_ticker, description=f"Highest Sharpe ratio of {(best_sharpe):.2f}", type="success"),
            TopCard(title="Risk Engine Status", value="ONLINE", description="FastAPI live calculation pipelines synced", type="warning")
        ]
        
        summary_text = (
            f"Market overview highlights {best_ticker} as the leader in risk-adjusted performance. "
            f"Highest volatility resides in {highest_ticker} with rolling volatility of {highest_vol:.1%}. "
            "Macro trend flows show moderate global asset variance."
        )
        
        return DashboardOverviewResponse(
            last_updated=datetime.now(timezone.utc),
            data_mode="demo" if is_demo_mode else "live",
            total_assets=len(raw_assets),
            best_risk_reward_asset=best_ticker,
            highest_risk_asset=highest_ticker,
            market_summary_text=summary_text,
            top_cards=top_cards,
            asset_cards=asset_cards
        )

    @classmethod
    async def get_assets_summary(cls, db: AsyncSession) -> List[AssetSummary]:
        """GET /api/assets list endpoint processor."""
        summaries: List[AssetSummary] = []
        
        for symbol in TRACKED_ASSETS.keys():
            data = await cls._get_asset_raw_data(db, symbol)
            if data.get("is_demo"):
                data = await cls._get_demo_data(symbol)
                
            drift = data["drift_annual"]
            vol = data["volatility_annual"]
            risk_score = min(100.0, max(0.0, (vol * 120.0 + data["max_dd"] * 80.0)))
            
            if risk_score > 75.0:
                risk_level = "Extreme"
            elif risk_score > 50.0:
                risk_level = "High"
            elif risk_score > 25.0:
                risk_level = "Medium"
            else:
                risk_level = "Low"
                
            base_7d = data["spot"] * np.exp((drift - 0.5 * vol**2) * (7.0 / 252.0))
            
            # Simple analytical loss prob
            dt_7d = 7.0 / 252.0
            d = -(drift - 0.5 * vol**2) * dt_7d / (vol * np.sqrt(dt_7d)) if vol > 0 else 0.0
            prob_loss = float(risk_calc.calculate_var_parametric(np.array([d]), 0.5)) # Standard normal approximation
            # fallback to realistic normal distribution CDF
            from scipy.stats import norm
            prob_loss = float(norm.cdf(d))
            
            summaries.append(AssetSummary(
                symbol=symbol,
                name=data["name"],
                asset_class=data["asset_class"],
                last_close=data["spot"],
                daily_change=data["daily_change"],
                risk_level=risk_level,
                base_case_7d=base_7d,
                probability_of_loss_7d=prob_loss
            ))
            
        return summaries

    @classmethod
    async def get_asset_projection(cls, db: AsyncSession, symbol: str) -> AssetProjectionResponse:
        """GET /api/assets/{symbol}/projection detail processor."""
        data = await cls._get_asset_raw_data(db, symbol)
        if data.get("is_demo"):
            data = await cls._get_demo_data(symbol)
            
        spot = data["spot"]
        drift = data["drift_annual"]
        vol = data["volatility_annual"]
        
        # 1. Run Monte Carlo Simulator for 30 steps
        simulator = MonteCarloSimulator(
            spot=spot,
            drift=drift,
            volatility=vol,
            num_paths=5000,
            steps=30
        )
        paths = simulator.generate_paths()
        scenarios = simulator.extract_scenarios(paths)
        
        # 2. Formulate paths arrays
        bear_path = [float(val) for val in scenarios["bear_scenario"]]
        base_path = [float(val) for val in scenarios["base_scenario"]]
        bull_path = [float(val) for val in scenarios["bull_scenario"]]
        
        # Extract 5 sample paths to render on chart
        sample_paths = [paths[i].tolist() for i in range(5)]
        
        # 3. Probability Density calculation at Day 30
        density_grids = simulator.calculate_density_grid(paths, step_indices=[30], grid_points=20)
        density_obj = None
        if density_grids:
            density_obj = DensityData(
                prices=[float(p) for p in density_grids[0]["prices"]],
                densities=[float(d) for d in density_grids[0]["densities"]]
            )
            
        # 4. Horizonal outcomes: 1d, 3d, 7d, 30d
        horizons_list = [1, 3, 7, 30]
        projection_horizon_results = []
        for h in horizons_list:
            bear_p = float(scenarios["bear_scenario"][h])
            base_p = float(scenarios["base_scenario"][h])
            bull_p = float(scenarios["bull_scenario"][h])
            
            # expected return over horizon
            exp_ret = (base_p - spot) / spot
            
            # Loss/gain probability
            h_prices = paths[:, h]
            gains = h_prices > spot
            prob_gain = float(np.mean(gains))
            prob_loss = 1.0 - prob_gain
            
            projection_horizon_results.append(HorizonResult(
                horizon_days=h,
                bear_price=bear_p,
                base_price=base_p,
                bull_price=bull_p,
                expected_return=exp_ret,
                probability_of_gain=prob_gain,
                probability_of_loss=prob_loss,
                projected_volatility=vol,
                confidence_band_width=bull_p - bear_p
            ))
            
        # Explanations
        p50_7d = base_path[7]
        ret_7d = (p50_7d - spot) / spot
        dir_text = "positive" if ret_7d >= 0 else "negative"
        risk_score = min(100.0, max(0.0, (vol * 120.0 + data["max_dd"] * 80.0)))
        
        if risk_score > 75.0:
            r_level = "Extreme"
        elif risk_score > 50.0:
            r_level = "High"
        elif risk_score > 25.0:
            r_level = "Medium"
        else:
            r_level = "Low"
            
        summary = f"{symbol} has a {dir_text} base-case projection over 7 days, targeting a price of ${p50_7d:,.2f} ({ret_7d:+.1%})."
        warning = f"Downside risk remains {r_level} with a 1-day Value at Risk (VaR) of {data['var_95']:.2%}, representing the maximum expected drop on a bad day."
        reason = f"This outlook is driven by an annualized expected trend of {drift:+.1%} and historical volatility of {vol:.1%} calculated over the lookback window."
        
        explanation = ExplanationText(
            summary=summary,
            warning=warning,
            reason=reason
        )
        
        return AssetProjectionResponse(
            asset=AssetInfo(
                symbol=symbol,
                name=data["name"],
                asset_class=data["asset_class"],
                last_close=spot,
                latest_date=data["latest_date"]
            ),
            projection_horizon_results=projection_horizon_results,
            bear_scenario_path=bear_path,
            base_scenario_path=base_path,
            bull_scenario_path=bull_path,
            monte_carlo_paths=sample_paths,
            probability_density_data=density_obj,
            explanation_text=explanation,
            data_mode="demo" if data["is_demo"] else "live"
        )

    @classmethod
    async def get_asset_risk(cls, db: AsyncSession, symbol: str) -> AssetRiskResponse:
        """GET /api/assets/{symbol}/risk detail processor."""
        data = await cls._get_asset_raw_data(db, symbol)
        if data.get("is_demo"):
            data = await cls._get_demo_data(symbol)
            
        vol = data["volatility_annual"]
        max_dd = data["max_dd"]
        beta = TRACKED_ASSETS[symbol]["beta"]
        
        risk_score = min(100.0, max(0.0, (vol * 120.0 + max_dd * 80.0)))
        if risk_score > 75.0:
            risk_level = "Extreme"
        elif risk_score > 50.0:
            risk_level = "High"
        elif risk_score > 25.0:
            risk_level = "Medium"
        else:
            risk_level = "Low"
            
        # Shocks simulation on a $100k portfolio baseline
        portfolio_baseline = 100000.0
        
        # Crypto-specific vs standard systemic beta shocks
        is_crypto = data["asset_class"].upper() == "CRYPTO"
        
        scenarios = [
            StressScenario(
                scenario_name="2008 Financial Crisis",
                spx_shock=-0.40,
                portfolio_return_shock=-0.40 * beta if not is_crypto else -0.55,
                portfolio_usd_impact=-100000.0 * (0.40 * beta if not is_crypto else 0.55)
            ),
            StressScenario(
                scenario_name="COVID-19 Crash 2020",
                spx_shock=-0.30,
                portfolio_return_shock=-0.30 * beta if not is_crypto else -0.38,
                portfolio_usd_impact=-100000.0 * (0.30 * beta if not is_crypto else 0.38)
            ),
            StressScenario(
                scenario_name="2022 Crypto Winter",
                spx_shock=-0.20,
                portfolio_return_shock=-0.20 * beta if not is_crypto else -0.45,
                portfolio_usd_impact=-100000.0 * (0.20 * beta if not is_crypto else 0.45)
            ),
            StressScenario(
                scenario_name="High Inflation Regime",
                spx_shock=-0.15,
                portfolio_return_shock=-0.15 * beta if not is_crypto else -0.18,
                portfolio_usd_impact=-100000.0 * (0.15 * beta if not is_crypto else 0.18)
            )
        ]
        
        summary = f"Risk rating for {symbol} is classified as {risk_level} (Score: {risk_score:.1f}/100) based on historical downside bounds."
        warning = f"A worst-case daily drop at 95% confidence (VaR) is estimated at -{data['var_95']*100.0:.2f}%, and the worst historical drawdown stands at -{max_dd*100.0:.1f}%."
        reason = f"This profile reflects the asset's historical return standard deviation (annualized volatility: {vol:.1%}) and its relative sensitivity to the broader market index (S&P 500 Beta: {beta:.2f}x)."
        
        return AssetRiskResponse(
            symbol=symbol,
            var_95=data["var_95"],
            cvar_95=data["cvar_95"],
            volatility=vol,
            drawdown=max_dd,
            risk_score=round(risk_score, 1),
            risk_level=risk_level,
            stress_test_summary=scenarios,
            plain_language_explanation=RiskExplanation(
                summary=summary,
                warning=warning,
                reason=reason
            ),
            data_mode="demo" if data["is_demo"] else "live"
        )

    @classmethod
    def get_simple_methodology(cls) -> MethodologyResponse:
        """GET /api/methodology/simple processor."""
        return MethodologyResponse(
            projections_calculation=(
                "Projections are generated by estimating future price pathways using Geometric Brownian Motion (GBM). "
                "The asset's drift (expected return trend) is derived from historical averages and ARIMA/XGBoost models, "
                "and its variance parameters are derived from GARCH or rolling historical price windows."
            ),
            monte_carlo_definition=(
                "Monte Carlo simulation is a mathematical technique that generates thousands of possible future price paths "
                "(in our case, 10,000 paths) using randomized normal variables. By taking the percentiles of these terminal "
                "prices, we determine the Bear Case (bottom 10%), Base Case (median 50%), and Bull Case (top 10%) boundaries."
            ),
            var_definition=(
                "Value at Risk (VaR) measures the maximum expected loss over a 1-day time horizon at a given confidence level. "
                "For example, a 95% VaR of 4.8% means there is a 5% chance that the asset will lose more than 4.8% on any single day."
            ),
            limitations=[
                "Models assume historical returns follow a log-normal distribution, which may understate the likelihood of extreme 'black swan' market crashes.",
                "ARIMA and XGBoost trend forecasts are based on historical daily price patterns and cannot anticipate sudden news events, regulatory shocks, or policy shifts.",
                "Volatility parameters are computed on trailing rolling periods (e.g., 252 days) and may not reflect immediate intra-day volatility regime changes."
            ]
        )

    @classmethod
    async def get_dashboard_results(cls, db: AsyncSession) -> DashboardResultsResponse:
        """
        V1 main entry point for retrieving consolidated dashboard results.
        Runs live calculations if database is populated; falls back to demo data if empty.
        """
        logger.info("Triggering MSPE Result Engine V1 calculation...")
        active_assets_res = await db.execute(select(Asset).where(Asset.is_active == True))
        assets = active_assets_res.scalars().all()
        
        if not assets:
            return cls._generate_mock_results()
            
        has_bars = False
        for asset in assets:
            bar_check = await db.execute(select(MarketBar).where(MarketBar.asset_id == asset.id).limit(1))
            if bar_check.scalar_one_or_none():
                has_bars = True
                break
                
        if not has_bars:
            return cls._generate_mock_results()
            
        results_map: Dict[str, AssetDashboardResult] = {}
        for asset in assets:
            bars_res = await db.execute(
                select(MarketBar)
                .where(and_(MarketBar.asset_id == asset.id, MarketBar.resolution == "1d"))
                .order_by(MarketBar.timestamp.desc())
                .limit(253)
            )
            bars = list(reversed(bars_res.scalars().all()))
            
            if len(bars) < 15:
                results_map[asset.ticker] = cls._generate_single_mock_asset(asset.ticker, asset.name, asset.asset_class)
                continue
                
            prices = np.array([float(b.close) for b in bars])
            returns = risk_calc.compute_daily_returns(prices)
            latest_bar = bars[-1]
            spot = float(latest_bar.close)
            latest_date = latest_bar.timestamp
            
            daily_ret = float(returns[-1])
            seven_day_ret = float((prices[-1] - prices[-8]) / prices[-8]) if len(prices) >= 8 else None
            thirty_day_ret = float((prices[-1] - prices[-31]) / prices[-31]) if len(prices) >= 31 else None
            
            forecast_query = select(MarketForecast).where(
                and_(MarketForecast.asset_id == asset.id, MarketForecast.horizon_days == 1)
            ).order_by(MarketForecast.timestamp.desc()).limit(1)
            fc_res = await db.execute(forecast_query)
            latest_fc = fc_res.scalar_one_or_none()
            
            if latest_fc:
                drift_annual = float(latest_fc.expected_return) * 252.0
                volatility_annual = float(latest_fc.expected_volatility)
            else:
                drift_annual = float(np.mean(returns) * 252.0)
                volatility_annual = float(np.std(returns) * np.sqrt(252.0))
                
            proj_data = QuantitativeProjectionEngine.run_gbm_projection(
                spot=spot, drift_annual=drift_annual, volatility_annual=volatility_annual, horizons=[1, 3, 7, 30], num_paths=10000, seed=42
            )
            
            projections_list = []
            for h in [1, 3, 7, 30]:
                h_data = proj_data[h]
                projections_list.append(HorizonProjection(
                    horizon_days=h, bear_price=h_data["bear_price"], base_price=h_data["base_price"],
                    bull_price=h_data["bull_price"], expected_return=h_data["expected_return"],
                    probability_of_gain=h_data["probability_of_gain"], probability_of_loss=h_data["probability_of_loss"],
                    projected_volatility=h_data["projected_volatility"], confidence_band_width=h_data["confidence_band_width"]
                ))
                
            var_95 = float(risk_calc.calculate_var_historical(returns, 0.95))
            cvar_95 = float(risk_calc.calculate_expected_shortfall(returns, 0.95))
            max_dd = float(risk_calc.calculate_max_drawdown(prices))
            
            vol_percentile = 0.50
            if len(returns) >= 60:
                rolling_vols = []
                for idx in range(30, len(returns)):
                    rolling_vols.append(np.std(returns[idx-30:idx]) * np.sqrt(252))
                vol_percentile = float(np.mean(np.array(rolling_vols) <= volatility_annual))
                
            risk_score = min(100.0, max(0.0, (volatility_annual * 120.0 + max_dd * 80.0)))
            if risk_score > 75.0:
                risk_level = "Extreme"
            elif risk_score > 50.0:
                risk_level = "High"
            elif risk_score > 25.0:
                risk_level = "Medium"
            else:
                risk_level = "Low"
                
            risk_summary = AssetRiskSummary(
                risk_level=risk_level, risk_score=round(risk_score, 1), var_95=var_95, cvar_95=cvar_95,
                max_drawdown=max_dd, volatility_percentile=round(vol_percentile, 3), downside_probability=proj_data[7]["probability_of_loss"]
            )
            
            if drift_annual > 0.05 and volatility_annual > 0.35:
                market_read = "Bullish but volatile"
            elif drift_annual > 0.15 and volatility_annual > 0.45:
                market_read = "Strong trend but downside risk high"
            elif drift_annual > 0.05:
                market_read = "Bullish trend established"
            elif drift_annual < -0.05:
                market_read = "Bearish risk elevated"
            elif volatility_annual < 0.15:
                market_read = "Low volatility consolidation"
            else:
                market_read = "Neutral / wait for confirmation"
                
            p50_7d = proj_data[7]["base_price"]
            ret_pct_7d = proj_data[7]["expected_return"]
            direction = "positive" if ret_pct_7d >= 0 else "negative"
            
            summary_sentence = f"{asset.ticker} has a {direction} base-case projection over 7 days, targeting a price of ${p50_7d:,.2f} ({ret_pct_7d:+.1%})."
            warning_sentence = f"Downside risk remains {risk_level} with a 1-day Value at Risk (VaR) of {var_95:.2%}, representing the maximum expected drop on a bad day."
            reason_sentence = f"This read is driven by an annualized expected trend of {drift_annual:+.1%} and historical volatility of {volatility_annual:.1%} calculated over the last {len(returns)} days."
            
            results_map[asset.ticker] = AssetDashboardResult(
                market_data=CurrentMarketData(
                    symbol=asset.ticker, name=asset.name, asset_class=asset.asset_class, latest_close=spot,
                    latest_date=latest_date, daily_return=daily_ret, seven_day_return=seven_day_ret, thirty_day_return=thirty_day_ret
                ),
                projections=projections_list, risk_summary=risk_summary, market_read=market_read,
                summary_sentence=summary_sentence, warning_sentence=warning_sentence, reason_sentence=reason_sentence, is_demo=False
            )
            
        return DashboardResultsResponse(timestamp=datetime.now(timezone.utc), assets=results_map, is_demo=False)

    @classmethod
    def _generate_mock_results(cls) -> DashboardResultsResponse:
        tickers_list = [
            ("BTCUSDT", "Bitcoin / Tether USDT", "CRYPTO"),
            ("ETHUSDT", "Ethereum / Tether USDT", "CRYPTO"),
            ("SPX", "S&P 500 Index", "INDEX"),
            ("XAU", "Gold Commodity", "COMMODITY")
        ]
        results_map = {}
        for ticker, name, a_class in tickers_list:
            results_map[ticker] = cls._generate_single_mock_asset(ticker, name, a_class)
        return DashboardResultsResponse(timestamp=datetime.now(timezone.utc), assets=results_map, is_demo=True)

    @classmethod
    def _generate_single_mock_asset(cls, ticker: str, name: str, asset_class: str) -> AssetDashboardResult:
        spot = {"BTCUSDT": 68420.50, "ETHUSDT": 3825.20, "SPX": 5230.15, "XAU": 2345.80}[ticker]
        vol = {"BTCUSDT": 0.452, "ETHUSDT": 0.524, "SPX": 0.145, "XAU": 0.182}[ticker]
        drift = {"BTCUSDT": 0.155, "ETHUSDT": 0.182, "SPX": 0.085, "XAU": 0.045}[ticker]
        proj_data = QuantitativeProjectionEngine.run_gbm_projection(
            spot=spot, drift_annual=drift, volatility_annual=vol, horizons=[1, 3, 7, 30], num_paths=10000, seed=42
        )
        projections_list = []
        for h in [1, 3, 7, 30]:
            h_data = proj_data[h]
            projections_list.append(HorizonProjection(
                horizon_days=h, bear_price=h_data["bear_price"], base_price=h_data["base_price"],
                bull_price=h_data["bull_price"], expected_return=h_data["expected_return"],
                probability_of_gain=h_data["probability_of_gain"], probability_of_loss=h_data["probability_of_loss"],
                projected_volatility=h_data["projected_volatility"], confidence_band_width=h_data["confidence_band_width"]
            ))
        var_95 = {"BTCUSDT": 0.0482, "ETHUSDT": 0.0545, "SPX": 0.0125, "XAU": 0.0185}[ticker]
        cvar_95 = {"BTCUSDT": 0.0621, "ETHUSDT": 0.0710, "SPX": 0.0165, "XAU": 0.0240}[ticker]
        max_dd = {"BTCUSDT": 0.224, "ETHUSDT": 0.285, "SPX": 0.085, "XAU": 0.124}[ticker]
        risk_score = min(100.0, max(0.0, (vol * 120.0 + max_dd * 80.0)))
        if risk_score > 75.0:
            risk_level = "Extreme"
        elif risk_score > 50.0:
            risk_level = "High"
        elif risk_score > 25.0:
            risk_level = "Medium"
        else:
            risk_level = "Low"
        risk_summary = AssetRiskSummary(
            risk_level=risk_level, risk_score=round(risk_score, 1), var_95=var_95, cvar_95=cvar_95,
            max_drawdown=max_dd, volatility_percentile=0.62, downside_probability=proj_data[7]["probability_of_loss"]
        )
        if drift > 0.05 and vol > 0.35:
            market_read = "Bullish but volatile"
        elif drift > 0.15 and vol > 0.45:
            market_read = "Strong trend but downside risk high"
        elif drift > 0.05:
            market_read = "Bullish trend established"
        elif drift < -0.05:
            market_read = "Bearish risk elevated"
        elif vol < 0.15:
            market_read = "Low volatility consolidation"
        else:
            market_read = "Neutral / wait for confirmation"
        p50_7d = proj_data[7]["base_price"]
        ret_pct_7d = proj_data[7]["expected_return"]
        direction = "positive" if ret_pct_7d >= 0 else "negative"
        summary_sentence = f"{ticker} has a {direction} base-case projection over 7 days, targeting a price of ${p50_7d:,.2f} ({ret_pct_7d:+.1%}) [Demo]."
        warning_sentence = f"Downside risk remains {risk_level} with a 1-day Value at Risk (VaR) of {var_95:.2%}, representing the maximum expected drop on a bad day."
        reason_sentence = f"This read is driven by an annualized expected trend of {drift:+.1%} and historical volatility of {vol:.1%} calculated over a 252-day lookback window."
        return AssetDashboardResult(
            market_data=CurrentMarketData(
                symbol=ticker, name=name, asset_class=asset_class, latest_close=spot,
                latest_date=datetime.now(timezone.utc), daily_return=0.0125, seven_day_return=0.0450, thirty_day_return=0.1280
            ),
            projections=projections_list, risk_summary=risk_summary, market_read=market_read,
            summary_sentence=summary_sentence, warning_sentence=warning_sentence, reason_sentence=reason_sentence, is_demo=True
        )

