import numpy as np
from datetime import datetime, timezone
from typing import Dict, List, Any, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.dialects.postgresql import insert

from backend.app.core.logging import logger
from backend.app.models.asset import Asset
from backend.app.models.market_data import MarketBar
from backend.app.models.signal import TradingSignal
from backend.app.models.risk import AssetRiskMetrics, PortfolioRiskMetrics
from backend.app.services.ingestion import IngestionService
from backend.quant.risk import analytics as risk_calc


class RiskService:
    @classmethod
    async def get_asset_returns(
        cls,
        db: AsyncSession,
        asset_id: Any,
        resolution: str = "1d",
        lookback: int = 252,
    ) -> Tuple[np.ndarray, np.ndarray]:
        """Queries historical bars for an asset and calculates daily closing prices and returns."""
        query = (
            select(MarketBar)
            .where(
                and_(MarketBar.asset_id == asset_id, MarketBar.resolution == resolution)
            )
            .order_by(MarketBar.timestamp.desc())
            .limit(lookback + 1)
        )  # get 1 extra bar for returns computation

        result = await db.execute(query)
        bars = result.scalars().all()

        if not bars:
            return np.array([]), np.array([])

        # Reverse to chronological order (oldest to newest)
        bars = list(reversed(bars))
        prices = np.array([float(b.close) for b in bars])

        returns = risk_calc.compute_daily_returns(prices)
        return prices, returns

    @classmethod
    async def evaluate_risk_analytics(cls, db: AsyncSession) -> Dict[str, Any]:
        """Performs comprehensive risk evaluations for individual assets and portfolio,

        persisting results into the database.
        """
        logger.info("Executing MSPE Risk Analytics Layer scan...")

        # 1. Fetch active asset catalog
        active_assets_res = await db.execute(
            select(Asset).where(Asset.is_active)
        )
        assets = active_assets_res.scalars().all()
        if not assets:
            logger.warning(
                "No active assets registered in database. Aborting risk analytics evaluation."
            )
            return {}

        # 2. Extract benchmark (S&P 500) pricing history
        benchmark_asset = next((a for a in assets if a.ticker == "SPX"), None)
        if not benchmark_asset:
            # Fallback search in db in case SPX is active but not returned in first loop
            benchmark_asset = await IngestionService.get_asset_by_ticker(db, "SPX")

        benchmark_prices, benchmark_returns = np.array([]), np.array([])
        if benchmark_asset:
            benchmark_prices, benchmark_returns = await cls.get_asset_returns(
                db, benchmark_asset.id
            )
            logger.info(
                f"Loaded benchmark index (SPX) returns: {len(benchmark_returns)} bars."
            )
        else:
            logger.warning(
                "Benchmark asset (SPX) not found in catalog. Sizing systematic metrics relative to equal index."
            )

        # 3. Calculate asset-level risk parameters
        asset_prices_dict: Dict[str, np.ndarray] = {}
        asset_returns_dict: Dict[str, np.ndarray] = {}
        asset_metrics_records: List[Dict[str, Any]] = []

        for asset in assets:
            logger.info(
                f"Computing risk and performance metrics for asset: {asset.ticker}..."
            )
            prices, returns = await cls.get_asset_returns(db, asset.id)

            # Save for aggregate calculations
            asset_prices_dict[asset.ticker] = prices
            asset_returns_dict[asset.ticker] = returns

            if len(returns) == 0:
                logger.warning(
                    f"No price history found for asset {asset.ticker}. Skipping risk calculation."
                )
                continue

            # Standard risk values
            var_95 = risk_calc.calculate_var_historical(returns, 0.95)
            var_99 = risk_calc.calculate_var_historical(returns, 0.99)
            es_95 = risk_calc.calculate_expected_shortfall(returns, 0.95)
            es_99 = risk_calc.calculate_expected_shortfall(returns, 0.99)
            max_dd = risk_calc.calculate_max_drawdown(prices)

            # Performance stats (annualized)
            mean_ret = np.mean(returns) * 252.0
            sharpe = risk_calc.calculate_sharpe_ratio(returns)
            sortino = risk_calc.calculate_sortino_ratio(returns)
            calmar = risk_calc.calculate_calmar_ratio(prices, mean_ret)

            # Systematic parameters relative to SPX benchmark
            if len(benchmark_returns) > 0 and len(returns) > 0:
                # Align return length
                min_len = min(len(returns), len(benchmark_returns))
                beta, alpha = risk_calc.calculate_beta_alpha(
                    returns[-min_len:], benchmark_returns[-min_len:]
                )
            else:
                beta, alpha = 1.0, 0.0

            asset_metrics_records.append(
                {
                    "asset_id": asset.id,
                    "ticker": asset.ticker,
                    "var_95": var_95,
                    "var_99": var_99,
                    "expected_shortfall_95": es_95,
                    "expected_shortfall_99": es_99,
                    "max_drawdown": max_dd,
                    "sharpe_ratio": sharpe,
                    "sortino_ratio": sortino,
                    "calmar_ratio": calmar,
                    "beta": beta,
                    "alpha": alpha,
                    "details": {
                        "annualized_return": round(mean_ret, 6),
                        "annualized_volatility": round(
                            np.std(returns) * np.sqrt(252.0), 6
                        ),
                        "parametric_var_95": round(
                            risk_calc.calculate_var_parametric(returns, 0.95), 6
                        ),
                        "sample_size_days": len(returns),
                    },
                }
            )

        # 4. Formulate portfolio weights from active trading signals
        active_signals_query = select(TradingSignal).where(
            TradingSignal.is_active
        )
        active_signals_res = await db.execute(active_signals_query)
        active_signals = active_signals_res.scalars().all()

        portfolio_equity = 100000.0  # Baseline USD capital base
        weights: Dict[str, float] = {}

        # If signals are open, calculate weights based on active position USD size
        active_size_usd = sum(float(sig.position_size_usd) for sig in active_signals)

        if active_size_usd > 0.0:
            for sig in active_signals:
                # Fetch asset ticker for mapping
                asset_res = await db.execute(
                    select(Asset).where(Asset.id == sig.asset_id)
                )
                as_obj = asset_res.scalar_one_or_none()
                if as_obj:
                    w = float(sig.position_size_usd) / active_size_usd
                    weights[as_obj.ticker] = weights.get(as_obj.ticker, 0.0) + w
            logger.info(
                f"Constructed dynamic active signals portfolio weights: {weights}"
            )
        else:
            # Fallback to equal weights across all active assets
            eq_w = 1.0 / len(assets)
            for asset in assets:
                weights[asset.ticker] = eq_w
            logger.info(
                f"No active positions found. Defaulting to equal portfolio weights: {weights}"
            )

        # 5. Formulate Historical Portfolio Returns
        # Find minimum length of available active assets returns
        tickers_with_data = [
            t for t, ret in asset_returns_dict.items() if len(ret) > 0 and t in weights
        ]

        portfolio_returns = np.array([])
        portfolio_prices = np.array([])

        if tickers_with_data:
            min_len = min(len(asset_returns_dict[t]) for t in tickers_with_data)

            if min_len > 0:
                aligned_returns_matrix = np.column_stack(
                    [asset_returns_dict[t][-min_len:] for t in tickers_with_data]
                )
                weights_vector = np.array([weights[t] for t in tickers_with_data])

                # Portfolio returns is the dot product of return matrix and weight vector
                portfolio_returns = np.dot(aligned_returns_matrix, weights_vector)

                # Reconstruct theoretical portfolio equity curve/prices starting from $100,000
                portfolio_prices = [portfolio_equity]
                for r in portfolio_returns:
                    portfolio_prices.append(portfolio_prices[-1] * (1.0 + r))
                portfolio_prices = np.array(portfolio_prices)

        # 6. Calculate Portfolio Risk Metrics
        if len(portfolio_returns) > 0:
            p_var_95 = risk_calc.calculate_var_historical(portfolio_returns, 0.95)
            p_var_99 = risk_calc.calculate_var_historical(portfolio_returns, 0.99)
            p_es_95 = risk_calc.calculate_expected_shortfall(portfolio_returns, 0.95)
            p_es_99 = risk_calc.calculate_expected_shortfall(portfolio_returns, 0.99)
            p_max_dd = risk_calc.calculate_max_drawdown(portfolio_prices)

            p_mean_ret = np.mean(portfolio_returns) * 252.0
            p_sharpe = risk_calc.calculate_sharpe_ratio(portfolio_returns)
            p_sortino = risk_calc.calculate_sortino_ratio(portfolio_returns)
            p_calmar = risk_calc.calculate_calmar_ratio(portfolio_prices, p_mean_ret)

            # Weighted average beta & alpha
            p_beta = float(
                sum(
                    weights.get(m["ticker"], 0.0) * m["beta"]
                    for m in asset_metrics_records
                )
            )
            p_alpha = float(
                sum(
                    weights.get(m["ticker"], 0.0) * m["alpha"]
                    for m in asset_metrics_records
                )
            )
        else:
            p_var_95 = p_var_99 = p_es_95 = p_es_99 = p_max_dd = 0.0
            p_sharpe = p_sortino = p_calmar = p_beta = p_alpha = 0.0

        # 7. Compute Correlation Matrix Grid
        correlation_grid = risk_calc.compute_correlation_matrix(
            {t: ret for t, ret in asset_returns_dict.items() if len(ret) > 0}
        )

        # 8. Portfolio stress testing shocks
        stress_results = risk_calc.run_portfolio_stress_test(weights, portfolio_equity)

        # 9. Relational Persistence Writes
        now = datetime.now(timezone.utc)

        # Save individual asset risk profiles
        saved_assets_res = []
        for am in asset_metrics_records:
            stmt = (
                insert(AssetRiskMetrics)
                .values(
                    asset_id=am["asset_id"],
                    timestamp=now,
                    var_95=am["var_95"],
                    var_99=am["var_99"],
                    expected_shortfall_95=am["expected_shortfall_95"],
                    expected_shortfall_99=am["expected_shortfall_99"],
                    max_drawdown=am["max_drawdown"],
                    sharpe_ratio=am["sharpe_ratio"],
                    sortino_ratio=am["sortino_ratio"],
                    calmar_ratio=am["calmar_ratio"],
                    beta=am["beta"],
                    alpha=am["alpha"],
                    details=am["details"],
                )
                .returning(AssetRiskMetrics)
            )

            res = await db.execute(stmt)
            saved_assets_res.append(res.scalar_one())

        # Save portfolio-level stats
        portfolio_stmt = (
            insert(PortfolioRiskMetrics)
            .values(
                timestamp=now,
                var_95=p_var_95,
                var_99=p_var_99,
                expected_shortfall_95=p_es_95,
                expected_shortfall_99=p_es_99,
                max_drawdown=p_max_dd,
                sharpe_ratio=p_sharpe,
                sortino_ratio=p_sortino,
                calmar_ratio=p_calmar,
                beta=p_beta,
                alpha=p_alpha,
                correlation_matrix=correlation_grid,
                stress_test_results=stress_results,
                details={
                    "portfolio_equity": portfolio_equity,
                    "weights_allocated": weights,
                    "parametric_var_95": round(
                        (
                            risk_calc.calculate_var_parametric(portfolio_returns, 0.95)
                            if len(portfolio_returns) > 0
                            else 0.0
                        ),
                        6,
                    ),
                },
            )
            .returning(PortfolioRiskMetrics)
        )

        p_res = await db.execute(portfolio_stmt)
        saved_portfolio = p_res.scalar_one()

        await db.commit()
        logger.info(
            "MSPE Risk Analytics evaluation successfully calculated and committed."
        )

        return {"portfolio": saved_portfolio, "assets_risk": saved_assets_res}
