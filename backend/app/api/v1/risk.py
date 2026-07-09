from typing import List
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from backend.app.api.dependencies.db import get_db
from backend.app.core.logging import logger
from backend.app.models.risk import AssetRiskMetrics, PortfolioRiskMetrics
from backend.app.models.asset import Asset
from backend.app.schemas import risk as risk_schemas
from backend.app.services.risk import RiskService

router = APIRouter()


@router.get(
    "/portfolio/latest", response_model=risk_schemas.PortfolioRiskMetricsResponse
)
async def get_latest_portfolio_risk(db: AsyncSession = Depends(get_db)):
    """Retrieves the most recent aggregate portfolio-level risk parameters, weights, and metrics."""
    query = (
        select(PortfolioRiskMetrics)
        .order_by(desc(PortfolioRiskMetrics.timestamp))
        .limit(1)
    )
    result = await db.execute(query)
    record = result.scalar_one_or_none()

    if not record:
        raise HTTPException(
            status_code=404,
            detail="No portfolio risk evaluations have been computed yet. Trigger evaluation at /api/v1/risk/evaluate",
        )

    return record


@router.get("/assets", response_model=List[risk_schemas.AssetRiskMetricsResponse])
async def list_assets_risk_metrics(db: AsyncSession = Depends(get_db)):
    """Retrieves risk profiles, alphas, and betas for all registered assets based on the latest calculation."""
    # First, get latest portfolio timestamp to ensure we query a synced snapshot
    latest_port_query = (
        select(PortfolioRiskMetrics.timestamp)
        .order_by(desc(PortfolioRiskMetrics.timestamp))
        .limit(1)
    )
    port_time_res = await db.execute(latest_port_query)
    latest_time = port_time_res.scalar()

    if not latest_time:
        raise HTTPException(
            status_code=404,
            detail="No risk evaluations have been computed yet. Trigger evaluation at /api/v1/risk/evaluate",
        )

    # Retrieve asset-level snapshots at that exact synchronized timestamp
    query = (
        select(AssetRiskMetrics, Asset.ticker)
        .join(Asset)
        .where(AssetRiskMetrics.timestamp == latest_time)
    )
    result = await db.execute(query)
    rows = result.all()

    response = []
    for asset_metric, ticker in rows:
        # Create response dict adding the tickers dynamically
        data = risk_schemas.AssetRiskMetricsResponse.model_validate(asset_metric)
        data.ticker = ticker
        response.append(data)

    return response


@router.get("/correlation", response_model=risk_schemas.CorrelationMatrixGrid)
async def get_assets_correlation_matrix(db: AsyncSession = Depends(get_db)):
    """Retrieves the Pearson product-moment returns correlation grid between assets."""
    query = (
        select(PortfolioRiskMetrics)
        .order_by(desc(PortfolioRiskMetrics.timestamp))
        .limit(1)
    )
    result = await db.execute(query)
    record = result.scalar_one_or_none()

    if not record:
        raise HTTPException(
            status_code=404,
            detail="No correlation metrics have been calculated. Trigger /api/v1/risk/evaluate",
        )

    matrix = record.correlation_matrix
    tickers = list(matrix.keys())

    # Compile nested dictionary into coordinate list-of-lists grid response
    grid = []
    for t1 in tickers:
        row = []
        for t2 in tickers:
            row.append(matrix[t1][t2])
        grid.append(row)

    return risk_schemas.CorrelationMatrixGrid(assets=tickers, matrix=grid)


@router.get("/stress-test", response_model=risk_schemas.StressTestSummary)
async def get_portfolio_stress_testing(db: AsyncSession = Depends(get_db)):
    """Retrieves returns and USD capital shocks computed under historical stress testing regimes."""
    query = (
        select(PortfolioRiskMetrics)
        .order_by(desc(PortfolioRiskMetrics.timestamp))
        .limit(1)
    )
    result = await db.execute(query)
    record = result.scalar_one_or_none()

    if not record:
        raise HTTPException(
            status_code=404,
            detail="No portfolio stress tests found. Trigger evaluation at /api/v1/risk/evaluate",
        )

    results = record.stress_test_results
    scenarios = []

    for name, s_data in results.items():
        # Scrape ticker level shocks from dictionary keys
        ticker_shocks = {
            k.replace("_shock", ""): v
            for k, v in s_data.items()
            if k.endswith("_shock")
        }

        scenarios.append(
            risk_schemas.StressScenarioResult(
                scenario_name=name,
                spx_shock=(
                    s_data.get("SPX_shock", 0.0)
                    if "SPX_shock" in s_data
                    else ticker_shocks.get("SPX", 0.0)
                ),
                asset_shocks=ticker_shocks,
                portfolio_return_shock=s_data["scenario_shock"],
                portfolio_usd_impact=s_data["usd_impact"],
            )
        )

    return risk_schemas.StressTestSummary(
        timestamp=record.timestamp, scenarios=scenarios
    )


@router.post("/evaluate")
async def trigger_risk_evaluations_scan(background_tasks: BackgroundTasks):
    """Triggers an off-thread background task to execute a full risk evaluation sweep and persist values."""

    async def run_risk_task():
        from backend.app.db.session import async_session_maker

        async with async_session_maker() as background_db:
            try:
                await RiskService.evaluate_risk_analytics(background_db)
            except Exception as e:
                logger.error(f"Background portfolio risk metrics sweep failed: {e}")

    background_tasks.add_task(run_risk_task)
    return {
        "status": "PROCESSING",
        "detail": "Portfolio and assets risk analytics calculations initiated in background thread",
    }
