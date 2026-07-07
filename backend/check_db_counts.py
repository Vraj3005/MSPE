import asyncio
from backend.app.db.session import async_session_maker
from backend.app.models.market_data import MarketBar
from backend.app.models.feature import MarketFeature
from backend.app.models.asset import Asset
from sqlalchemy import select, func


async def check_db():
    async with async_session_maker() as db:
        assets = (await db.execute(select(Asset))).scalars().all()
        for a in assets:
            bars_count = (
                await db.execute(
                    select(func.count(MarketBar.timestamp)).where(
                        MarketBar.asset_id == a.id
                    )
                )
            ).scalar()
            feats_count = (
                await db.execute(
                    select(func.count(MarketFeature.timestamp)).where(
                        MarketFeature.asset_id == a.id
                    )
                )
            ).scalar()
            print(
                f"Asset: {a.ticker} (id: {a.id}) | Bars: {bars_count} | Features: {feats_count}"
            )


if __name__ == "__main__":
    asyncio.run(check_db())
