from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.api.dependencies.db import get_db
from backend.app.core.logging import logger
from backend.app.schemas import projection as proj_schemas
from backend.app.services.ingestion import IngestionService
from backend.app.services.projection import ProjectionService

router = APIRouter()


class RunProjectionRequest(BaseModel):
    num_paths: int = Field(10000, ge=100, le=100000)
    steps: int = Field(7, ge=1, le=30)


@router.get("/{ticker}/latest", response_model=proj_schemas.SurfaceProjectionResponse)
async def get_latest_probabilistic_surface(
    ticker: str, db: AsyncSession = Depends(get_db)
):
    """Retrieves the latest generated 3D surface grid and Bear/Base/Bull scenario bounds for an asset."""
    asset = await IngestionService.get_asset_by_ticker(db, ticker)
    if not asset:
        raise HTTPException(
            status_code=444, detail=f"Asset with ticker {ticker} not found in catalog"
        )

    response = await ProjectionService.get_latest_projection_response(db, ticker)
    if not response:
        raise HTTPException(
            status_code=444,
            detail=f"No completed projection runs found for {ticker}. Please trigger a run first.",
        )
    return response


@router.post("/{ticker}/run")
async def trigger_surface_projection(
    ticker: str,
    request: RunProjectionRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Triggers a 10,000-path Monte Carlo pathway simulation and solves continuous 3D densities in the background."""
    asset = await IngestionService.get_asset_by_ticker(db, ticker)
    if not asset:
        raise HTTPException(
            status_code=444, detail=f"Asset with ticker {ticker} not found in catalog"
        )

    async def run_projection_task():
        from backend.app.db.session import async_session_maker

        async with async_session_maker() as background_db:
            try:
                await ProjectionService.run_surface_projection(
                    db=background_db,
                    ticker=ticker,
                    num_paths=request.num_paths,
                    steps=request.steps,
                )
            except Exception as e:
                logger.error(
                    f"Background Monte Carlo simulation failed for {ticker}: {e}"
                )

    background_tasks.add_task(run_projection_task)
    return {
        "status": "RUNNING",
        "detail": f"Monte Carlo path simulations and probability density solver triggered for {ticker} ({request.num_paths} paths)",
    }
