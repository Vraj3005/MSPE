import uuid
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict

class ProjectionRunBase(BaseModel):
    status: str
    parameters: dict

class ProjectionRunCreate(ProjectionRunBase):
    asset_id: uuid.UUID
    model_id: uuid.UUID

class ProjectionRun(ProjectionRunBase):
    id: uuid.UUID
    asset_id: uuid.UUID
    model_id: uuid.UUID
    timestamp: datetime
    duration_seconds: Optional[float] = None

    model_config = ConfigDict(from_attributes=True)

class ProjectedSurfaceBase(BaseModel):
    projection_time: datetime
    price: float
    density: float
    p10_price: float
    p50_price: float
    p90_price: float

class ProjectedSurfaceCreate(ProjectedSurfaceBase):
    run_id: uuid.UUID

class ProjectedSurface(ProjectedSurfaceBase):
    id: uuid.UUID
    run_id: uuid.UUID

    model_config = ConfigDict(from_attributes=True)

class SurfaceProjectionResponse(BaseModel):
    """Aggregate response combining active scenarios and dense coordinates for UI rendering."""
    ticker: str
    run_id: uuid.UUID
    timestamp: datetime
    model_type: str
    
    # Standard quantile scenario paths
    bear_scenario: List[dict] # [{"time": datetime, "price": float}]
    base_scenario: List[dict] # [{"time": datetime, "price": float}]
    bull_scenario: List[dict] # [{"time": datetime, "price": float}]
    
    # 3D Grid coordinate points
    grid: List[ProjectedSurfaceBase]
