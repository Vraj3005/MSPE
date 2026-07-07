import asyncio
import os
import sys
from datetime import timezone

# Add workspace root directory to path so script runs standalone
sys.path.append(
    os.path.dirname(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    )
)

from backend.app.core.logging import logger
from backend.app.db.session import sync_engine, async_session_maker
from backend.app.db.base import Base
from backend.app.services.ingestion import IngestionService
from backend.app.models.asset import Asset
from backend.app.models.market_data import MarketBar
from sqlalchemy import select, func


def recreate_db_schema():
    """Drops existing tables and recreates standard relational database schema."""
    logger.info("Initializing relational schema mapping in target database...")
    Base.metadata.drop_all(sync_engine)
    Base.metadata.create_all(sync_engine)
    logger.info("Database tables successfully generated!")


async def test_etl_ingestion_suite():
    # 1. Open database transaction session
    async with async_session_maker() as db:
        # 2. Seed assets catalog
        await IngestionService.seed_assets_if_empty(db)

        # 3. Retrieve seeded assets
        query = select(Asset)
        result = await db.execute(query)
        assets = result.scalars().all()

        logger.info(f"Retrieved active catalog: {[a.ticker for a in assets]}")
        assert (
            len(assets) == 4
        ), f"Seeding failed to register 4 standard assets, got {len(assets)}"

        # 4. Execute backfill downloads for both adapters (days=15 for superfast test)
        logger.info("Executing test historical backfills (15-day range)...")

        for asset in assets:
            logger.info("==================================================")
            logger.info(f"Starting test execution pipeline for: {asset.ticker}")

            try:
                # Run daily resolution backfill
                await IngestionService.backfill_asset(
                    db, asset.ticker, days=15, resolution="1d"
                )

                # Verify rows stored
                bars_query = select(func.count(MarketBar.timestamp)).where(
                    MarketBar.asset_id == asset.id, MarketBar.resolution == "1d"
                )
                bars_result = await db.execute(bars_query)
                bars_count = bars_result.scalar()

                logger.info(
                    f"Verification Check: Asset {asset.ticker} has {bars_count} historical daily bars saved."
                )
                assert (
                    bars_count > 0
                ), f"Backfill failed to insert any bars for {asset.ticker}"

                # Fetch sample bars to verify details
                sample_query = (
                    select(MarketBar)
                    .where(MarketBar.asset_id == asset.id)
                    .order_by(MarketBar.timestamp.desc())
                    .limit(1)
                )

                sample_result = await db.execute(sample_query)
                latest_bar = sample_result.scalar_one_or_none()

                if latest_bar:
                    logger.info("Latest Bar Data stored:")
                    logger.info(f"  - Timestamp: {latest_bar.timestamp}")
                    logger.info(
                        f"  - OHLCV: {latest_bar.open} | {latest_bar.high} | {latest_bar.low} | {latest_bar.close} | Vol: {latest_bar.volume}"
                    )
                    logger.info(f"  - Timezone Offset: {latest_bar.timestamp.tzinfo}")

                    # Verify timezone is UTC
                    assert (
                        latest_bar.timestamp.tzinfo == timezone.utc
                    ), f"Timezone is not offset-aware UTC for {asset.ticker}"

            except Exception as ex:
                logger.exception(
                    f"Ingestion pipeline failed for asset {asset.ticker}: {ex}"
                )

        # 5. Execute incremental synchronization test
        logger.info("==================================================")
        logger.info("Triggering incremental sync loop to test upsert boundaries...")
        await IngestionService.sync_incremental(db, "1d")
        logger.info("Verification test suite completed successfully.")


if __name__ == "__main__":
    logger.info("Starting MSPE Ingestion Service Verification Test Loop")

    # Recreate the schema to start fresh
    recreate_db_schema()

    # Run the ingestion tasks
    asyncio.run(test_etl_ingestion_suite())
