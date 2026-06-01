# Import all the models, so that Base has them before being imported by Alembic
from backend.app.db.base_class import Base  # noqa
from backend.app.models.asset import Asset  # noqa
from backend.app.models.market_data import MarketBar  # noqa
from backend.app.models.feature import MarketFeature  # noqa
from backend.app.models.forecast import ModelMetadata  # noqa
from backend.app.models.forecast import MarketForecast  # noqa
from backend.app.models.projection import ProjectionRun  # noqa
from backend.app.models.projection import ProjectedSurface  # noqa
from backend.app.models.signal import TradingSignal  # noqa
from backend.app.models.risk import AssetRiskMetrics, PortfolioRiskMetrics  # noqa
