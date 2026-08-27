from fastapi import APIRouter
from backend.app.api.v1 import assets
from backend.app.api.v1 import features
from backend.app.api.v1 import forecasts
from backend.app.api.v1 import projections
from backend.app.api.v1 import risk
from backend.app.api.v1 import dashboard
from backend.app.api.v1 import validation

api_router = APIRouter()
api_router.include_router(
    assets.router, prefix="/assets", tags=["Assets & Historical Data"]
)
api_router.include_router(
    features.router, prefix="/features", tags=["Quantitative Features"]
)
api_router.include_router(
    forecasts.router, prefix="/forecasts", tags=["Forecasting Engine"]
)
api_router.include_router(
    projections.router, prefix="/projections", tags=["Surface Projections"]
)
# api_router.include_router(signals.router, prefix="/signals", tags=["Trading Signals"])
api_router.include_router(risk.router, prefix="/risk", tags=["Risk Analytics Layer"])
# api_router.include_router(
#     backtest.router, prefix="/backtest", tags=["Backtest Simulation Engine"]
# )
api_router.include_router(
    dashboard.router, prefix="/dashboard", tags=["Dashboard Results Engine"]
)
api_router.include_router(
    validation.router, prefix="/validation", tags=["Model Validation"]
)
