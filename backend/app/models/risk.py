import uuid
from datetime import datetime
from sqlalchemy import Numeric, DateTime, ForeignKey, Index, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.app.db.base_class import Base


class AssetRiskMetrics(Base):
    __tablename__ = "asset_risk_metrics"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    asset_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("assets.id", ondelete="CASCADE"), nullable=False
    )
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, nullable=False
    )

    var_95: Mapped[float] = mapped_column(Numeric(18, 6), nullable=False)
    var_99: Mapped[float] = mapped_column(Numeric(18, 6), nullable=False)
    expected_shortfall_95: Mapped[float] = mapped_column(Numeric(18, 6), nullable=False)
    expected_shortfall_99: Mapped[float] = mapped_column(Numeric(18, 6), nullable=False)
    max_drawdown: Mapped[float] = mapped_column(Numeric(18, 6), nullable=False)

    sharpe_ratio: Mapped[float] = mapped_column(Numeric(10, 4), nullable=False)
    sortino_ratio: Mapped[float] = mapped_column(Numeric(10, 4), nullable=False)
    calmar_ratio: Mapped[float] = mapped_column(Numeric(10, 4), nullable=False)

    beta: Mapped[float] = mapped_column(Numeric(10, 4), nullable=False)
    alpha: Mapped[float] = mapped_column(Numeric(10, 6), nullable=False)

    details: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)

    # Relationships
    asset = relationship("Asset")

    __table_args__ = (Index("idx_asset_risk_metrics_lookup", "asset_id", "timestamp"),)


class PortfolioRiskMetrics(Base):
    __tablename__ = "portfolio_risk_metrics"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, nullable=False
    )

    var_95: Mapped[float] = mapped_column(Numeric(18, 6), nullable=False)
    var_99: Mapped[float] = mapped_column(Numeric(18, 6), nullable=False)
    expected_shortfall_95: Mapped[float] = mapped_column(Numeric(18, 6), nullable=False)
    expected_shortfall_99: Mapped[float] = mapped_column(Numeric(18, 6), nullable=False)
    max_drawdown: Mapped[float] = mapped_column(Numeric(18, 6), nullable=False)

    sharpe_ratio: Mapped[float] = mapped_column(Numeric(10, 4), nullable=False)
    sortino_ratio: Mapped[float] = mapped_column(Numeric(10, 4), nullable=False)
    calmar_ratio: Mapped[float] = mapped_column(Numeric(10, 4), nullable=False)

    beta: Mapped[float] = mapped_column(Numeric(10, 4), nullable=False)
    alpha: Mapped[float] = mapped_column(Numeric(10, 6), nullable=False)

    correlation_matrix: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    stress_test_results: Mapped[dict] = mapped_column(
        JSON, nullable=False, default=dict
    )
    details: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)

    __table_args__ = (Index("idx_portfolio_risk_metrics_timestamp", "timestamp"),)
