from datetime import datetime, timedelta, timezone
from typing import List, Optional
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from backend.app.api.dependencies.db import get_db
from backend.app.core.logging import logger
from backend.app.models.asset import Asset
from backend.app.models.market_data import MarketBar
from backend.app.schemas import asset as asset_schemas
from backend.app.schemas import market_data as bar_schemas
from backend.app.services.ingestion import IngestionService

router = APIRouter()

@router.get("/", response_model=List[asset_schemas.Asset])
async def list_assets(db: AsyncSession = Depends(get_db)):
    """Retrieves all tracked assets from the system catalog."""
    query = select(Asset).where(Asset.is_active == True)
    result = await db.execute(query)
    assets = result.scalars().all()
    return assets

@router.get("/{ticker}/bars", response_model=List[bar_schemas.MarketBar])
async def get_historical_bars(
    ticker: str,
    resolution: str = Query("1d", pattern="^(1d|1h|1m)$"),
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    db: AsyncSession = Depends(get_db)
):
    """Retrieves historical timezone-aware price bars for the specified ticker."""
    asset = await IngestionService.get_asset_by_ticker(db, ticker)
    if not asset:
        raise HTTPException(status_code=444, detail=f"Asset with ticker {ticker} not found in catalog")

    # Set default time boundaries if not provided
    if not end_time:
        end_time = datetime.now(timezone.utc)
    if not start_time:
        start_time = end_time - timedelta(days=30)

    # Force inputs into timezone-aware datetimes
    if start_time.tzinfo is None:
        start_time = start_time.replace(tzinfo=timezone.utc)
    if end_time.tzinfo is None:
        end_time = end_time.replace(tzinfo=timezone.utc)

    query = select(MarketBar).where(
        and_(
            MarketBar.asset_id == asset.id,
            MarketBar.resolution == resolution,
            MarketBar.timestamp >= start_time,
            MarketBar.timestamp <= end_time
        )
    ).order_by(MarketBar.timestamp.asc())

    result = await db.execute(query)
    bars = result.scalars().all()
    return bars

@router.post("/sync")
async def trigger_sync(background_tasks: BackgroundTasks, db: AsyncSession = Depends(get_db)):
    """Manually triggers incremental synchronization for all registered assets as a background task."""
    # Ensure assets catalog is seeded
    await IngestionService.seed_assets_if_empty(db)
    
    async def run_sync_task():
        # Open separate session to prevent crossing db transactions in background thread
        from backend.app.db.session import async_session_maker
        async with async_session_maker() as background_db:
            try:
                await IngestionService.sync_incremental(background_db, "1d")
                await IngestionService.sync_incremental(background_db, "1h")
            except Exception as e:
                logger.error(f"Error during manual background sync: {e}")

    background_tasks.add_task(run_sync_task)
    return {"status": "SYNCING", "detail": "Incremental synchronization initiated in background"}
