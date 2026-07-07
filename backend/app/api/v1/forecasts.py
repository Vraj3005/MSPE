from datetime import datetime, timedelta, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from backend.app.api.dependencies.db import get_db
from backend.app.core.logging import logger
from backend.app.models.forecast import MarketForecast, ModelMetadata
from backend.app.schemas import forecast as forecast_schemas
from backend.app.services.ingestion import IngestionService
from backend.app.services.forecast import ForecastingService

router = APIRouter()


class ModelTrainRequest(BaseModel):
    model_type: str = Field(..., pattern="^(ARIMA|SARIMA|GARCH|XGBOOST|RF|LSTM)$")
    version: str = "v1.0.0"
    hyperparameters: Optional[dict] = None
    validation_steps: int = 10


@router.get("/{ticker}", response_model=List[forecast_schemas.MarketForecast])
async def get_historical_forecasts(
    ticker: str,
    model_type: Optional[str] = None,
    horizon_days: Optional[int] = Query(None, ge=1, le=7),
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    db: AsyncSession = Depends(get_db),
):
    """Retrieves a chronological list of historical predictions for the specified asset."""
    asset = await IngestionService.get_asset_by_ticker(db, ticker)
    if not asset:
        raise HTTPException(
            status_code=444, detail=f"Asset with ticker {ticker} not found in catalog"
        )

    # Set default time bounds
    if not end_time:
        end_time = datetime.now(timezone.utc)
    if not start_time:
        start_time = end_time - timedelta(days=30)

    # Force offset-aware datetimes
    if start_time.tzinfo is None:
        start_time = start_time.replace(tzinfo=timezone.utc)
    if end_time.tzinfo is None:
        end_time = end_time.replace(tzinfo=timezone.utc)

    # Base filter criteria
    filters = [
        MarketForecast.asset_id == asset.id,
        MarketForecast.timestamp >= start_time,
        MarketForecast.timestamp <= end_time,
    ]

    if horizon_days:
        filters.append(MarketForecast.horizon_days == horizon_days)

    query = select(MarketForecast).join(ModelMetadata).where(and_(*filters))

    if model_type:
        query = query.where(ModelMetadata.model_type == model_type.upper())

    query = query.order_by(MarketForecast.timestamp.asc())
    result = await db.execute(query)
    forecasts = result.scalars().all()
    return forecasts


@router.post("/{ticker}/train")
async def trigger_model_training(
    ticker: str,
    request: ModelTrainRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Triggers an off-thread background task to execute model training, walk-forward validation, and predictions."""
    asset = await IngestionService.get_asset_by_ticker(db, ticker)
    if not asset:
        raise HTTPException(
            status_code=444, detail=f"Asset with ticker {ticker} not found in catalog"
        )

    async def run_training_task():
        from backend.app.db.session import async_session_maker

        async with async_session_maker() as background_db:
            try:
                await ForecastingService.train_and_persist_model(
                    db=background_db,
                    ticker=ticker,
                    model_type=request.model_type,
                    resolution="1d",
                    version=request.version,
                    hyperparameters=request.hyperparameters,
                    validation_steps=request.validation_steps,
                )
            except Exception as e:
                logger.error(
                    f"Background training pipeline failed for {ticker} ({request.model_type}): {e}"
                )

    background_tasks.add_task(run_training_task)
    return {
        "status": "TRAINING",
        "detail": f"Model training loops and projections triggered for {ticker} ({request.model_type})",
    }
