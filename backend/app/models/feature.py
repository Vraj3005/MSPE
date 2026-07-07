import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Numeric, DateTime, ForeignKey, Index, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.app.db.base_class import Base


class MarketFeature(Base):
    __tablename__ = "market_features"

    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), primary_key=True, nullable=False
    )
    asset_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("assets.id", ondelete="CASCADE"), primary_key=True, nullable=False
    )
    resolution: Mapped[str] = mapped_column(
        String(8), primary_key=True, nullable=False
    )  # '1d', '1h', '1m'

    # Trend Features
    sma_20: Mapped[Optional[float]] = mapped_column(Numeric(18, 6), nullable=True)
    ema_20: Mapped[Optional[float]] = mapped_column(Numeric(18, 6), nullable=True)
    macd: Mapped[Optional[float]] = mapped_column(Numeric(18, 6), nullable=True)
    macd_signal: Mapped[Optional[float]] = mapped_column(Numeric(18, 6), nullable=True)
    macd_histogram: Mapped[Optional[float]] = mapped_column(
        Numeric(18, 6), nullable=True
    )
    rsi_14: Mapped[Optional[float]] = mapped_column(Numeric(6, 3), nullable=True)
    adx_14: Mapped[Optional[float]] = mapped_column(Numeric(6, 3), nullable=True)

    # Volatility Features
    atr_14: Mapped[Optional[float]] = mapped_column(Numeric(18, 6), nullable=True)
    historical_volatility_30: Mapped[Optional[float]] = mapped_column(
        Numeric(10, 6), nullable=True
    )
    parkinson_volatility_30: Mapped[Optional[float]] = mapped_column(
        Numeric(10, 6), nullable=True
    )

    # Market Structure Features
    support_30: Mapped[Optional[float]] = mapped_column(Numeric(18, 6), nullable=True)
    resistance_30: Mapped[Optional[float]] = mapped_column(
        Numeric(18, 6), nullable=True
    )
    volume_profile: Mapped[Optional[dict]] = mapped_column(
        JSON, nullable=True
    )  # stores: [{"price_bin": float, "volume_weight": float}, ...]

    # Statistical Features
    returns_1d: Mapped[Optional[float]] = mapped_column(
        Numeric(10, 6), nullable=True
    )  # return since last bar
    log_returns: Mapped[Optional[float]] = mapped_column(Numeric(10, 6), nullable=True)
    rolling_mean_30: Mapped[Optional[float]] = mapped_column(
        Numeric(18, 6), nullable=True
    )
    rolling_variance_30: Mapped[Optional[float]] = mapped_column(
        Numeric(18, 6), nullable=True
    )
    rolling_skewness_30: Mapped[Optional[float]] = mapped_column(
        Numeric(8, 4), nullable=True
    )
    rolling_kurtosis_30: Mapped[Optional[float]] = mapped_column(
        Numeric(8, 4), nullable=True
    )

    # Relationship back to Asset
    asset = relationship("Asset")

    # Add custom indexes for high-speed feature lookups
    __table_args__ = (
        Index("idx_market_features_asset_time", "asset_id", "resolution", "timestamp"),
    )
