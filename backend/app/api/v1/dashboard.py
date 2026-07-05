from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.api.dependencies.db import get_db
from backend.app.schemas.dashboard import DashboardResultsResponse
from backend.app.services.result_engine import ResultEngineService
from backend.app.core.logging import logger

router = APIRouter()

@router.get("/results", response_model=DashboardResultsResponse)
async def get_dashboard_consolidated_results(db: AsyncSession = Depends(get_db)):
    """
    Retrieves the consolidated quantitative projections, risk ratings,
    and market reads for all active assets (BTCUSDT, ETHUSDT, SPX, XAU).
    """
    try:
        results = await ResultEngineService.get_dashboard_results(db)
        return results
    except Exception as e:
        logger.error(f"Error compiling dashboard consolidated results: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to compile dashboard consolidated results: {str(e)}"
        )
