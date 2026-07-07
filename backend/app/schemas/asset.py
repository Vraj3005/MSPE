import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class AssetBase(BaseModel):
    ticker: str
    name: str
    asset_class: str
    is_active: bool = True


class AssetCreate(AssetBase):
    pass


class AssetUpdate(BaseModel):
    name: Optional[str] = None
    asset_class: Optional[str] = None
    is_active: Optional[bool] = None


class AssetInDBBase(AssetBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class Asset(AssetInDBBase):
    pass
