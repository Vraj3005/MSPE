import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Numeric, DateTime, ForeignKey, Index, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.app.db.base_class import Base

class ProjectionRun(Base):
    __tablename__ = "projection_runs"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    asset_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("assets.id", ondelete="CASCADE"), nullable=False)
    model_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("model_metadata.id", ondelete="CASCADE"), nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    parameters: Mapped[dict] = mapped_column(JSON, nullable=False) # e.g. {"num_paths": 10000, "steps": 7}
    status: Mapped[str] = mapped_column(String(32), default="PENDING", nullable=False) # 'PENDING', 'RUNNING', 'COMPLETED', 'FAILED'
    duration_seconds: Mapped[Optional[float]] = mapped_column(Numeric(10, 2), nullable=True)

    # Relationships
    asset = relationship("Asset")
    model = relationship("ModelMetadata")
    projected_surfaces = relationship("ProjectedSurface", back_populates="run", cascade="all, delete-orphan")

class ProjectedSurface(Base):
    __tablename__ = "projected_surfaces"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    run_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projection_runs.id", ondelete="CASCADE"), nullable=False)
    
    projection_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False) # X-Axis (Time step)
    price: Mapped[float] = mapped_column(Numeric(18, 6), nullable=False)                      # Y-Axis (Price grid point)
    density: Mapped[float] = mapped_column(Numeric(18, 8), nullable=False)                    # Z-Axis (Probability Density)

    # Quantile scenario prices at this specific projection time step
    p10_price: Mapped[float] = mapped_column(Numeric(18, 6), nullable=False) # Bear price path value
    p50_price: Mapped[float] = mapped_column(Numeric(18, 6), nullable=False) # Base price path value
    p90_price: Mapped[float] = mapped_column(Numeric(18, 6), nullable=False) # Bull price path value

    # Relationship back to run
    run = relationship("ProjectionRun", back_populates="projected_surfaces")

    # Composite index for quick retrieval of coordinate meshes
    __table_args__ = (
        Index("idx_projected_surfaces_lookup", "run_id", "projection_time"),
    )
