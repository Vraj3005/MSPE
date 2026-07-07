import pandas as pd
from typing import Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from backend.app.models.market_data import MarketBar
from backend.app.models.feature import MarketFeature
from backend.app.services.ingestion import IngestionService


class BacktestService:
    @classmethod
    async def run_strategy_backtest(
        cls,
        db: AsyncSession,
        ticker: str,
        strategy_name: str = "SMA_CROSSOVER",
        initial_capital: float = 100000.0,
        resolution: str = "1d",
    ) -> Dict[str, Any]:
        """Runs a historical backtest for a selected asset and strategy using indicators in the database."""
        asset = await IngestionService.get_asset_by_ticker(db, ticker)
        if not asset:
            raise ValueError(f"Asset with ticker {ticker} not found in catalog")

        # 1. Fetch bars and features
        bar_query = (
            select(MarketBar)
            .where(
                and_(MarketBar.asset_id == asset.id, MarketBar.resolution == resolution)
            )
            .order_by(MarketBar.timestamp.asc())
        )
        bar_res = await db.execute(bar_query)
        bars = bar_res.scalars().all()

        feat_query = (
            select(MarketFeature)
            .where(
                and_(
                    MarketFeature.asset_id == asset.id,
                    MarketFeature.resolution == resolution,
                )
            )
            .order_by(MarketFeature.timestamp.asc())
        )
        feat_res = await db.execute(feat_query)
        features = feat_res.scalars().all()

        if len(bars) < 30:
            raise ValueError(
                f"Insufficient history ({len(bars)} bars) to run backtest."
            )

        # Map features by timestamp
        feat_map = {f.timestamp: f for f in features}

        # Aligned data
        aligned_data = []
        for bar in bars:
            f = feat_map.get(bar.timestamp)
            if not f:
                continue
            aligned_data.append(
                {
                    "timestamp": bar.timestamp,
                    "close": float(bar.close),
                    "sma_20": (
                        float(f.sma_20) if f.sma_20 is not None else float(bar.close)
                    ),
                    "ema_20": (
                        float(f.ema_20) if f.ema_20 is not None else float(bar.close)
                    ),
                    "rsi_14": float(f.rsi_14) if f.rsi_14 is not None else 50.0,
                }
            )

        df = pd.DataFrame(aligned_data)
        if df.empty:
            raise ValueError("No aligned features and bars found for backtesting.")

        # 2. Simulate Strategy
        capital = initial_capital
        position_size = 0.0  # units of asset
        position_type = None  # "LONG" or "SHORT" or None
        entry_price = 0.0
        entry_time = None

        trade_logs = []
        equity_curve = []

        # Add initial equity point
        equity_curve.append(
            {"timestamp": df.iloc[0]["timestamp"].isoformat(), "equity": capital}
        )

        for i in range(len(df)):
            row = df.iloc[i]
            current_time = row["timestamp"]
            current_close = row["close"]
            rsi = row["rsi_14"]
            sma = row["sma_20"]

            # Signal generation logic
            signal = "HOLD"
            if strategy_name == "SMA_CROSSOVER":
                if current_close > sma:
                    signal = "BUY_LONG"
                elif current_close < sma:
                    signal = "SELL_SHORT"
            elif strategy_name == "RSI_MEAN_REVERSION":
                if rsi < 30:
                    signal = "BUY_LONG"
                elif rsi > 70:
                    signal = "SELL_SHORT"
                elif position_type == "LONG" and rsi > 50:
                    signal = "EXIT"
                elif position_type == "SHORT" and rsi < 50:
                    signal = "EXIT"

            # Execute actions based on signal
            if position_type is None:
                # Open position
                if signal == "BUY_LONG":
                    position_type = "LONG"
                    entry_price = current_close
                    entry_time = current_time
                    position_size = capital / current_close
                elif signal == "SELL_SHORT":
                    position_type = "SHORT"
                    entry_price = current_close
                    entry_time = current_time
                    position_size = capital / current_close
            else:
                # We have an open position
                # Check for exits or flips
                should_exit = False

                if position_type == "LONG" and (
                    signal == "SELL_SHORT" or signal == "EXIT"
                ):
                    should_exit = True
                    pnl = (current_close - entry_price) * position_size
                elif position_type == "SHORT" and (
                    signal == "BUY_LONG" or signal == "EXIT"
                ):
                    should_exit = True
                    pnl = (entry_price - current_close) * position_size

                if should_exit:
                    capital += pnl
                    trade_logs.append(
                        {
                            "id": len(trade_logs) + 1,
                            "type": position_type,
                            "entry_time": entry_time.isoformat(),
                            "exit_time": current_time.isoformat(),
                            "entry_price": round(entry_price, 2),
                            "exit_price": round(current_close, 2),
                            "return_pct": round((pnl / (capital - pnl)) * 100, 2),
                            "pnl_usd": round(pnl, 2),
                            "capital_after": round(capital, 2),
                        }
                    )

                    # Flip or Clear
                    if signal == "BUY_LONG" or signal == "SELL_SHORT":
                        position_type = "LONG" if signal == "BUY_LONG" else "SHORT"
                        entry_price = current_close
                        entry_time = current_time
                        position_size = capital / current_close
                    else:
                        position_type = None
                        position_size = 0.0

            # Calculate daily portfolio equity
            if position_type == "LONG":
                current_equity = position_size * current_close
            elif position_type == "SHORT":
                current_equity = capital + (entry_price - current_close) * position_size
            else:
                current_equity = capital

            equity_curve.append(
                {
                    "timestamp": current_time.isoformat(),
                    "equity": round(current_equity, 2),
                }
            )

        # Close out any remaining open trade at the last price
        if position_type is not None:
            last_row = df.iloc[-1]
            last_close = last_row["close"]
            if position_type == "LONG":
                pnl = (last_close - entry_price) * position_size
            else:
                pnl = (entry_price - last_close) * position_size

            capital += pnl
            trade_logs.append(
                {
                    "id": len(trade_logs) + 1,
                    "type": position_type,
                    "entry_time": entry_time.isoformat(),
                    "exit_time": last_row["timestamp"].isoformat(),
                    "entry_price": round(entry_price, 2),
                    "exit_price": round(last_close, 2),
                    "return_pct": round((pnl / (capital - pnl)) * 100, 2),
                    "pnl_usd": round(pnl, 2),
                    "capital_after": round(capital, 2),
                }
            )

        # Calculate metrics
        total_trades = len(trade_logs)
        winning_trades = [t for t in trade_logs if t["pnl_usd"] > 0]
        win_rate = (
            (len(winning_trades) / total_trades * 100) if total_trades > 0 else 0.0
        )

        total_pnl = capital - initial_capital
        total_return_pct = (total_pnl / initial_capital) * 100

        gross_profit = sum(t["pnl_usd"] for t in winning_trades)
        gross_loss = abs(sum(t["pnl_usd"] for t in trade_logs if t["pnl_usd"] < 0))
        profit_factor = (
            (gross_profit / gross_loss)
            if gross_loss > 0
            else (gross_profit if gross_profit > 0 else 1.0)
        )

        # Calculate drawdown
        equities = [pt["equity"] for pt in equity_curve]
        peak = initial_capital
        max_dd = 0.0
        for eq in equities:
            if eq > peak:
                peak = eq
            dd = (peak - eq) / peak
            if dd > max_dd:
                max_dd = dd

        return {
            "strategy": strategy_name,
            "ticker": ticker,
            "total_return_pct": round(total_return_pct, 2),
            "total_pnl_usd": round(total_pnl, 2),
            "win_rate_pct": round(win_rate, 2),
            "total_trades": total_trades,
            "profit_factor": round(profit_factor, 2),
            "max_drawdown_pct": round(max_dd * 100, 2),
            "final_capital_usd": round(capital, 2),
            "equity_curve": equity_curve,
            "trade_logs": list(reversed(trade_logs)),  # return newest trades first
        }
