from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.api.dependencies.db import get_db
from backend.app.schemas.results import DashboardResultsResponse as V2Response
from backend.app.services.result_engine import ResultEngineService
from backend.app.core.logging import logger

router = APIRouter()


@router.get("/results")
async def get_dashboard_consolidated_results(db: AsyncSession = Depends(get_db)):
    """
    Retrieves MSPE v2.0 validated projections, risk ratings, model selection info,
    and plain-English explanations for all tracked assets.
    """
    try:
        results = await ResultEngineService.get_dashboard_results(db)
        return results
    except Exception as e:
        logger.error(f"Error compiling dashboard consolidated results: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to compile dashboard consolidated results: {str(e)}",
        )
