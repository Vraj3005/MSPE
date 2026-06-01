import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Numeric, DateTime, ForeignKey, Index, JSON, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.app.db.base_class import Base

class ModelMetadata(Base):
    __tablename__ = "model_metadata"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    model_name: Mapped[str] = mapped_column(String(128), nullable=False)
    model_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True) # e.g. 'ARIMA', 'LSTM', 'XGBOOST'
    version: Mapped[str] = mapped_column(String(32), nullable=False)
    hyperparameters: Mapped[dict] = mapped_column(JSON, nullable=False) # e.g. {"p": 1, "d": 1, "q": 1}
    metrics: Mapped[dict] = mapped_column(JSON, nullable=False) # e.g. {"rmse": 0.012, "mae": 0.009}
    file_path: Mapped[str] = mapped_column(String(512), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    trained_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

class MarketForecast(Base):
    __tablename__ = "market_forecasts"

    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), primary_key=True, nullable=False)
    asset_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("assets.id", ondelete="CASCADE"), primary_key=True, nullable=False)
    model_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("model_metadata.id", ondelete="CASCADE"), primary_key=True, nullable=False)
    horizon_days: Mapped[int] = mapped_column(primary_key=True, nullable=False) # 1, 3, 7

    expected_return: Mapped[float] = mapped_column(Numeric(10, 6), nullable=False)
    expected_volatility: Mapped[float] = mapped_column(Numeric(10, 6), nullable=False)
    confidence_score: Mapped[float] = mapped_column(Numeric(5, 4), nullable=False) # between 0.0000 and 1.0000

    # Relationships
    asset = relationship("Asset")
    model = relationship("ModelMetadata")

    # Add custom index for fast chronological lookups
    __table_args__ = (
        Index("idx_market_forecasts_lookup", "asset_id", "timestamp"),
    )
