import uuid
from datetime import datetime
from sqlalchemy import String, Numeric, DateTime, ForeignKey, Index, JSON, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.app.db.base_class import Base


class TradingSignal(Base):
    __tablename__ = "trading_signals"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    asset_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("assets.id", ondelete="CASCADE"), nullable=False
    )
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, nullable=False
    )

    strategy_name: Mapped[str] = mapped_column(String(64), nullable=False)
    signal_type: Mapped[str] = mapped_column(
        String(16), nullable=False
    )  # 'LONG', 'SHORT', 'EXIT', 'NO_TRADE'

    entry_price: Mapped[float] = mapped_column(Numeric(18, 6), nullable=False)
    stop_loss: Mapped[float] = mapped_column(Numeric(18, 6), nullable=False)
    take_profit: Mapped[float] = mapped_column(Numeric(18, 6), nullable=False)
    risk_reward_ratio: Mapped[float] = mapped_column(Numeric(6, 2), nullable=False)

    position_size_usd: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)
    confidence_score: Mapped[float] = mapped_column(Numeric(5, 4), nullable=False)
    rank_score: Mapped[float] = mapped_column(Numeric(10, 6), nullable=False)

    details: Mapped[dict] = mapped_column(
        JSON, nullable=False
    )  # e.g. {"portfolio_risk_weight": 0.01, ...}
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    asset = relationship("Asset")

    # Composite index for quick retrieval of active signals
    __table_args__ = (Index("idx_trading_signals_lookup", "asset_id", "timestamp"),)
