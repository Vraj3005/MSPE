from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from backend.app.api.dependencies.db import get_db
from backend.app.services.result_engine import ResultEngineService
from backend.app.schemas.dashboard import (
    DashboardOverviewResult,
    AssetProjectionResult,
    AssetRiskResponse,
    MethodologyResponse,
)
from backend.app.core.logging import logger

router = APIRouter()


@router.get("/dashboard/overview", response_model=DashboardOverviewResult)
async def get_dashboard_overview(db: AsyncSession = Depends(get_db)):
    """GET /api/dashboard/overview: Returns high-level dashboard aggregate performance details."""
    try:
        return await ResultEngineService.get_dashboard_overview(db)
    except Exception as e:
        logger.error(f"Error serving overview API: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to serve dashboard overview: {str(e)}"
        )


@router.get("/assets", response_model=List[AssetProjectionResult])
async def get_assets_list(db: AsyncSession = Depends(get_db)):
    """GET /api/assets: Returns a detailed projection-horizon snapshot for all active tracked assets."""
    try:
        return await ResultEngineService.get_assets_summary(db)
    except Exception as e:
        logger.error(f"Error serving assets list API: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to serve assets summary list: {str(e)}"
        )


@router.get("/assets/{symbol}/projection", response_model=AssetProjectionResult)
async def get_asset_projection(symbol: str, db: AsyncSession = Depends(get_db)):
    """GET /api/assets/{symbol}/projection: Returns projection ranges, volatility bands, and scenario paths."""
    try:
        return await ResultEngineService.get_asset_projection(db, symbol.upper())
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error serving projection API for {symbol}: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to serve asset projection: {str(e)}"
        )


@router.get("/assets/{symbol}/risk", response_model=AssetRiskResponse)
async def get_asset_risk(symbol: str, db: AsyncSession = Depends(get_db)):
    """GET /api/assets/{symbol}/risk: Returns tail risks (VaR, CVaR), drawdowns, and historical crash stress outputs."""
    try:
        return await ResultEngineService.get_asset_risk(db, symbol.upper())
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error serving risk API for {symbol}: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to serve asset risk details: {str(e)}"
        )


@router.get("/methodology/simple", response_model=MethodologyResponse)
def get_methodology():
    """GET /api/methodology/simple: Returns simple prose explaining mathematical methodologies and boundaries."""
    try:
        return ResultEngineService.get_simple_methodology()
    except Exception as e:
        logger.error(f"Error serving methodology API: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to serve methodology guidelines: {str(e)}"
        )
