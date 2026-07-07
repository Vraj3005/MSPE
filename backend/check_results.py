import asyncio
from backend.app.db.base import Base  # noqa
from backend.app.db.session import async_session_maker
from backend.app.models.signal import TradingSignal
from backend.app.models.risk import PortfolioRiskMetrics
from backend.app.models.asset import Asset
from sqlalchemy import select, desc


async def get_results():
    async with async_session_maker() as db:
        # Get active signals
        sig_query = (
            select(TradingSignal, Asset.ticker)
            .join(Asset)
            .order_by(desc(TradingSignal.timestamp))
            .limit(10)
        )
        sig_res = await db.execute(sig_query)
        signals = sig_res.all()

        print("=== SIGNALS ===")
        for s, ticker in signals:
            print(
                f"Asset: {ticker} | Type: {s.signal_type} | Entry: {s.entry_price} | SL: {s.stop_loss} | TP: {s.take_profit} | Size: ${s.position_size_usd} | Active: {s.is_active}"
            )

        # Get latest portfolio risk
        risk_query = (
            select(PortfolioRiskMetrics)
            .order_by(desc(PortfolioRiskMetrics.timestamp))
            .limit(1)
        )
        risk_res = await db.execute(risk_query)
        risk = risk_res.scalar_one_or_none()

        if risk:
            print("\n=== PORTFOLIO RISK ===")
            print(f"VaR 95%: {risk.var_95 * 100:.2f}%")
            print(f"Max Drawdown: {risk.max_drawdown * 100:.2f}%")
            print(f"Sharpe Ratio: {risk.sharpe_ratio:.2f}")


if __name__ == "__main__":
    asyncio.run(get_results())
