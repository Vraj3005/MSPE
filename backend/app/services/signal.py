from datetime import datetime, timezone
from typing import List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, desc
from sqlalchemy.dialects.postgresql import insert

from backend.app.core.logging import logger
from backend.app.models.asset import Asset
from backend.app.models.market_data import MarketBar
from backend.app.models.forecast import MarketForecast, ModelMetadata
from backend.app.models.projection import ProjectionRun, ProjectedSurface
from backend.app.models.signal import TradingSignal

PORTFOLIO_EQUITY = 100000.0  # Baseline USD capital base
MAX_RISK_PER_TRADE = 0.01  # 1% per trade risk budget ($1,000 USD risk)
MAX_PORTFOLIO_RISK = (
    0.05  # 5% maximum aggregate portfolio risk ceiling ($5,000 USD risk)
)


class SignalService:
    @classmethod
    async def get_portfolio_exposure(cls, db: AsyncSession) -> Dict[str, float]:
        """Calculates current active aggregate exposure and risk parameters."""
        # Query active open signals
        query = select(TradingSignal).where(TradingSignal.is_active == True)
        result = await db.execute(query)
        active_signals = result.scalars().all()

        total_risk_usd = 0.0

        for sig in active_signals:
            # Risk per trade is the cash loss if stopped out
            percent_loss = abs(sig.entry_price - sig.stop_loss) / sig.entry_price
            trade_risk = sig.position_size_usd * percent_loss
            total_risk_usd += trade_risk

        total_risk_pct = (total_risk_usd / PORTFOLIO_EQUITY) * 100.0
        remaining_risk_usd = (PORTFOLIO_EQUITY * MAX_PORTFOLIO_RISK) - total_risk_usd

        return {
            "total_equity_usd": PORTFOLIO_EQUITY,
            "total_active_risk_usd": round(total_risk_usd, 2),
            "total_active_risk_pct": round(total_risk_pct, 4),
            "remaining_risk_capacity_usd": round(max(0.0, remaining_risk_usd), 2),
            "active_positions_count": len(active_signals),
        }

    @classmethod
    async def evaluate_signals(cls, db: AsyncSession) -> List[TradingSignal]:
        """Scans all registered assets, evaluates return/volatility forecasts, applies risk filters,

        calculates dynamic position sizes, ranks opportunities, and commits open trades under the 5% portfolio risk ceiling.
        """
        logger.info("Executing trading signal scan...")

        active_assets = await db.execute(select(Asset).where(Asset.is_active == True))
        assets = active_assets.scalars().all()

        raw_signals: List[Dict[str, Any]] = []

        for asset in assets:
            logger.info(f"Scanning metrics for asset: {asset.ticker}...")

            # 1. Fetch latest spot close price
            spot_query = (
                select(MarketBar)
                .where(MarketBar.asset_id == asset.id)
                .order_by(desc(MarketBar.timestamp))
                .limit(1)
            )

            spot_result = await db.execute(spot_query)
            latest_bar = spot_result.scalar_one_or_none()
            if not latest_bar:
                continue

            spot_price = float(latest_bar.close)

            # 2. Fetch latest active forecast return expectations
            forecast_query = (
                select(MarketForecast, ModelMetadata)
                .join(ModelMetadata)
                .where(
                    and_(
                        MarketForecast.asset_id == asset.id,
                        ModelMetadata.is_active == True,
                    )
                )
                .order_by(desc(MarketForecast.timestamp))
                .limit(3)
            )

            fc_result = await db.execute(forecast_query)
            fc_rows = fc_result.all()
            if not fc_rows:
                continue

            forecasts = [r[0] for r in fc_rows]

            # Pull 1-day forecast return and volatility parameters
            one_day_fc = next(
                (f for f in forecasts if f.horizon_days == 1), forecasts[0]
            )
            expected_return = float(one_day_fc.expected_return)
            confidence_score = float(one_day_fc.confidence_score)

            # 3. Fetch latest completed Monte Carlo 7-day quantile pricing bands
            run_query = (
                select(ProjectionRun)
                .where(
                    and_(
                        ProjectionRun.asset_id == asset.id,
                        ProjectionRun.status == "COMPLETED",
                    )
                )
                .order_by(desc(ProjectionRun.timestamp))
                .limit(1)
            )

            run_res = await db.execute(run_query)
            latest_run = run_res.scalar_one_or_none()
            if not latest_run:
                continue

            # Fetch step 7 projected surface record (represents the 7-day terminal bands)
            surf_query = (
                select(ProjectedSurface)
                .where(ProjectedSurface.run_id == latest_run.id)
                .order_by(desc(ProjectedSurface.projection_time))
                .limit(1)
            )  # terminal step

            surf_res = await db.execute(surf_query)
            terminal_surface = surf_res.scalar_one_or_none()
            if not terminal_surface:
                continue

            p10_bear = float(terminal_surface.p10_price)
            p50_base = float(terminal_surface.p50_price)
            p90_bull = float(terminal_surface.p90_price)

            # 4. Signal Trigger Logic
            sig_type = "NO_TRADE"
            entry = spot_price
            stop_loss = 0.0
            take_profit = 0.0
            rrr = 0.0

            if expected_return > 0.0005:  # Bullish threshold filter
                # Potential LONG
                sig_type = "LONG"
                stop_loss = p10_bear
                take_profit = p90_bull

                # Math checks to prevent invalid negative bounds
                if stop_loss >= entry or take_profit <= entry:
                    sig_type = "NO_TRADE"
                else:
                    rrr = (take_profit - entry) / (entry - stop_loss)

            elif expected_return < -0.0005:  # Bearish threshold filter
                # Potential SHORT
                sig_type = "SHORT"
                stop_loss = p90_bull
                take_profit = p10_bear

                if stop_loss <= entry or take_profit >= entry:
                    sig_type = "NO_TRADE"
                else:
                    rrr = (entry - take_profit) / (stop_loss - entry)

            if sig_type == "NO_TRADE":
                # Create standard blank NO_TRADE record
                raw_signals.append(
                    {
                        "asset_id": asset.id,
                        "ticker": asset.ticker,
                        "signal_type": "NO_TRADE",
                        "entry_price": entry,
                        "stop_loss": entry,
                        "take_profit": entry,
                        "rrr": 0.0,
                        "position_size": 0.0,
                        "confidence_score": confidence_score,
                        "rank_score": 0.0,
                        "details": {
                            "reason": "Return threshold or barrier convergence constraints not satisfied"
                        },
                    }
                )
                continue

            # 5. Risk Filter: Assert Risk-Reward Ratio constraint (RRR >= 1.5)
            if rrr < 1.5:
                raw_signals.append(
                    {
                        "asset_id": asset.id,
                        "ticker": asset.ticker,
                        "signal_type": "NO_TRADE",
                        "entry_price": entry,
                        "stop_loss": stop_loss,
                        "take_profit": take_profit,
                        "rrr": rrr,
                        "position_size": 0.0,
                        "confidence_score": confidence_score,
                        "rank_score": 0.0,
                        "details": {
                            "reason": f"Risk-Reward Ratio {rrr:.2f} was less than standard minimum 1.5 filter"
                        },
                    }
                )
                continue

            # 6. Dynamic Position Sizing (1% Maximum Risk budget)
            percent_loss = abs(entry - stop_loss) / entry
            risk_budget_usd = PORTFOLIO_EQUITY * MAX_RISK_PER_TRADE  # $1,000 USD risk
            position_size_usd = risk_budget_usd / percent_loss

            # Enforce capital budget maximum ceiling
            position_size_usd = min(
                PORTFOLIO_EQUITY * 0.5, position_size_usd
            )  # Max size 50% equity for single trade

            # Calculate composite Rank Score
            rank_score = abs(expected_return) * confidence_score * rrr

            raw_signals.append(
                {
                    "asset_id": asset.id,
                    "ticker": asset.ticker,
                    "signal_type": sig_type,
                    "entry_price": entry,
                    "stop_loss": stop_loss,
                    "take_profit": take_profit,
                    "rrr": rrr,
                    "position_size": position_size_usd,
                    "confidence_score": confidence_score,
                    "rank_score": rank_score,
                    "details": {
                        "reason": f"Fitted expectations model is bullish with positive RRR: {rrr:.2f}",
                        "volatility_target": float(one_day_fc.expected_volatility),
                        "portfolio_risk_budget_usd": risk_budget_usd,
                    },
                }
            )

        # 7. Portfolio Exposure Check & Signal Ranking Sorting
        # Extract potential active trades (LONG/SHORT)
        active_candidates = [
            s for s in raw_signals if s["signal_type"] in ["LONG", "SHORT"]
        ]
        # Sort candidates in descending order based on composite Rank Score
        active_candidates = sorted(
            active_candidates, key=lambda x: x["rank_score"], reverse=True
        )

        # Load current aggregate portfolio risk
        exposure = await cls.get_portfolio_exposure(db)
        current_risk_usd = exposure["total_active_risk_usd"]
        max_allowed_risk_usd = PORTFOLIO_EQUITY * MAX_PORTFOLIO_RISK  # $5,000 USD risk

        saved_signals: List[TradingSignal] = []

        # Process ranked signals and allocate weights safely
        for cand in active_candidates:
            # Each open trade allocates exactly $1,000 (1%) to risk budget
            percent_loss = (
                abs(cand["entry_price"] - cand["stop_loss"]) / cand["entry_price"]
            )
            trade_risk = cand["position_size"] * percent_loss

            is_active = False
            details = cand["details"]

            if current_risk_usd + trade_risk <= max_allowed_risk_usd:
                # Aggregate ceiling is clear, execute trade signal
                is_active = True
                current_risk_usd += trade_risk
                details["risk_status"] = "ACCEPTED_EXPOSURE_OK"
                logger.info(
                    f"Signal executed for {cand['ticker']} with size ${cand['position_size']:.2f}"
                )
            else:
                # Cap is breached, reject signal to protect portfolio equity
                details["risk_status"] = "REJECTED_PORTFOLIO_RISK_CEILING_BREACHED"
                logger.warning(
                    f"Rejected signal for {cand['ticker']} due to aggregate portfolio risk limit reached."
                )

            stmt = (
                insert(TradingSignal)
                .values(
                    asset_id=cand["asset_id"],
                    timestamp=datetime.now(timezone.utc),
                    strategy_name="SURFACE_DRIFT",
                    signal_type=cand["signal_type"],
                    entry_price=cand["entry_price"],
                    stop_loss=cand["stop_loss"],
                    take_profit=cand["take_profit"],
                    risk_reward_ratio=cand["rrr"],
                    position_size_usd=cand["position_size"],
                    confidence_score=cand["confidence_score"],
                    rank_score=cand["rank_score"],
                    details=details,
                    is_active=is_active,
                )
                .returning(TradingSignal)
            )

            result = await db.execute(stmt)
            saved_signals.append(result.scalar_one())

        # Persist NO_TRADE records for tracking audit trail
        no_trades = [s for s in raw_signals if s["signal_type"] == "NO_TRADE"]
        for nt in no_trades:
            stmt = (
                insert(TradingSignal)
                .values(
                    asset_id=nt["asset_id"],
                    timestamp=datetime.now(timezone.utc),
                    strategy_name="SURFACE_DRIFT",
                    signal_type="NO_TRADE",
                    entry_price=nt["entry_price"],
                    stop_loss=nt["stop_loss"],
                    take_profit=nt["take_profit"],
                    risk_reward_ratio=0.0,
                    position_size_usd=0.0,
                    confidence_score=nt["confidence_score"],
                    rank_score=0.0,
                    details=nt["details"],
                    is_active=False,
                )
                .returning(TradingSignal)
            )

            result = await db.execute(stmt)
            saved_signals.append(result.scalar_one())

        await db.commit()
        logger.info(
            f"Trading signals evaluation successfully committed. Open active signals count: {len([s for s in saved_signals if s.is_active])}"
        )
        return saved_signals
