from datetime import datetime, timedelta, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from backend.app.api.dependencies.db import get_db
from backend.app.core.logging import logger
from backend.app.models.feature import MarketFeature
from backend.app.schemas import feature as feature_schemas
from backend.app.services.ingestion import IngestionService
from backend.app.services.feature import FeatureService

router = APIRouter()

@router.get("/{ticker}", response_model=List[feature_schemas.MarketFeature])
async def get_asset_features(
    ticker: str,
    resolution: str = Query("1d", pattern="^(1d|1h|1m)$"),
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    db: AsyncSession = Depends(get_db)
):
    """Retrieves a chronological list of calculated quantitative features for the specified asset."""
    asset = await IngestionService.get_asset_by_ticker(db, ticker)
    if not asset:
        raise HTTPException(status_code=444, detail=f"Asset with ticker {ticker} not found in catalog")

    # Set default time bounds if not provided
    if not end_time:
        end_time = datetime.now(timezone.utc)
    if not start_time:
        start_time = end_time - timedelta(days=30)

    # Force timezone-aware inputs
    if start_time.tzinfo is None:
        start_time = start_time.replace(tzinfo=timezone.utc)
    if end_time.tzinfo is None:
        end_time = end_time.replace(tzinfo=timezone.utc)

    query = select(MarketFeature).where(
        and_(
            MarketFeature.asset_id == asset.id,
            MarketFeature.resolution == resolution,
            MarketFeature.timestamp >= start_time,
            MarketFeature.timestamp <= end_time
        )
    ).order_by(MarketFeature.timestamp.asc())

    result = await db.execute(query)
    features = result.scalars().all()
    return features

@router.post("/{ticker}/compute")
async def force_compute_features(
    ticker: str,
    background_tasks: BackgroundTasks,
    resolution: str = Query("1d", pattern="^(1d|1h|1m)$"),
    db: AsyncSession = Depends(get_db)
):
    """Triggers an off-thread background re-computation of engineered features for the asset."""
    asset = await IngestionService.get_asset_by_ticker(db, ticker)
    if not asset:
        raise HTTPException(status_code=444, detail=f"Asset with ticker {ticker} not found in catalog")

    async def run_feature_task():
        from backend.app.db.session import async_session_maker
        async with async_session_maker() as background_db:
            try:
                await FeatureService.compute_and_store_features(background_db, asset.id, resolution)
            except Exception as e:
                logger.error(f"Error during background features calculation for {ticker}: {e}")

    background_tasks.add_task(run_feature_task)
    return {"status": "COMPUTING", "detail": f"Feature computation initiated for {ticker} ({resolution})"}
