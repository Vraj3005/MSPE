import asyncio
from backend.app.db.session import async_session_maker
from backend.app.services.backtest import BacktestService


async def test_backtest():
    async with async_session_maker() as db:
        try:
            res = await BacktestService.run_strategy_backtest(db, "BTCUSDT")
            print("SUCCESS! Keys:", res.keys())
        except Exception as e:
            print("ERROR TYPE:", type(e))
            print("ERROR MESSAGE:", str(e))


if __name__ == "__main__":
    asyncio.run(test_backtest())
