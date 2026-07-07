import uuid
from datetime import datetime
from sqlalchemy import String, Numeric, DateTime, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.app.db.base_class import Base


class MarketBar(Base):
    # Tablename will automatically resolve to marketbars, but let's override for exact mapping
    __tablename__ = "market_bars"

    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), primary_key=True, nullable=False
    )
    asset_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("assets.id", ondelete="RESTRICT"), primary_key=True, nullable=False
    )
    open: Mapped[float] = mapped_column(Numeric(18, 6), nullable=False)
    high: Mapped[float] = mapped_column(Numeric(18, 6), nullable=False)
    low: Mapped[float] = mapped_column(Numeric(18, 6), nullable=False)
    close: Mapped[float] = mapped_column(Numeric(18, 6), nullable=False)
    volume: Mapped[float] = mapped_column(Numeric(24, 6), nullable=False)
    resolution: Mapped[str] = mapped_column(
        String(8), primary_key=True, nullable=False
    )  # '1d', '1h', '1m'

    # Relationship back to Asset
    asset = relationship("Asset", back_populates="market_bars")

    # Add custom indexes for high-speed time-series queries
    __table_args__ = (
        Index("idx_market_bars_asset_time", "asset_id", "resolution", "timestamp"),
    )
