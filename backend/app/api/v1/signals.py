from typing import List
from fastapi import APIRouter, Depends, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.app.api.dependencies.db import get_db
from backend.app.core.logging import logger
from backend.app.models.signal import TradingSignal
from backend.app.schemas import signal as signal_schemas
from backend.app.services.signal import SignalService

router = APIRouter()


@router.get("/active", response_model=List[signal_schemas.TradingSignal])
async def list_active_signals(db: AsyncSession = Depends(get_db)):
    """Retrieves all active trade positions currently open in the portfolio, ordered by Rank Score."""
    query = (
        select(TradingSignal)
        .where(TradingSignal.is_active)
        .order_by(TradingSignal.rank_score.desc())
    )
    result = await db.execute(query)
    signals = result.scalars().all()
    return signals


@router.get("/exposure", response_model=signal_schemas.PortfolioExposureSummary)
async def get_portfolio_exposure_limits(db: AsyncSession = Depends(get_db)):
    """Summarizes current capital utilization and remaining risk capacity under the 5% portfolio cap."""
    summary = await SignalService.get_portfolio_exposure(db)
    return summary


@router.post("/evaluate")
async def trigger_signals_evaluation_scan(background_tasks: BackgroundTasks):
    """Triggers an off-thread background task to execute a full strategy signal scan across all assets."""

    async def run_scan_task():
        from backend.app.db.session import async_session_maker

        async with async_session_maker() as background_db:
            try:
                await SignalService.evaluate_signals(background_db)
            except Exception as e:
                logger.error(f"Background trading signal evaluation failed: {e}")

    background_tasks.add_task(run_scan_task)
    return {
        "status": "PROCESSING",
        "detail": "Portfolio-wide strategy signal scanning and risk allocations triggered in background",
    }
