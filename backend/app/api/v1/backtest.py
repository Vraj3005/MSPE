from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.api.dependencies.db import get_db
from backend.app.schemas import backtest as backtest_schemas
from backend.app.services.backtest import BacktestService

router = APIRouter()

@router.get("/{ticker}", response_model=backtest_schemas.BacktestResponse)
async def run_backtest(
    ticker: str,
    strategy_name: str = Query("SMA_CROSSOVER", pattern="^(SMA_CROSSOVER|RSI_MEAN_REVERSION)$"),
    initial_capital: float = Query(100000.0, ge=1000.0),
    db: AsyncSession = Depends(get_db)
):
    """Executes a historical strategy backtest using pricing bars and calculated indicators in the database."""
    try:
        results = await BacktestService.run_strategy_backtest(
            db=db,
            ticker=ticker,
            strategy_name=strategy_name,
            initial_capital=initial_capital,
            resolution="1d"
        )
        return results
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal backtest engine crash: {str(e)}")
