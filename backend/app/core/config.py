import os
from typing import List, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    ENV: str = "development"
    PORT: int = 8000
    LOG_LEVEL: str = "INFO"
    SECRET_KEY: str = "9a1f28b7e61a29f8c6e28a502cd8ff82a1768222b918f0fcd6be841b9e28acab"

    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/mspe"
    ASYNC_DATABASE_URL: str = (
        "postgresql+asyncpg://postgres:postgres@localhost:5432/mspe"
    )
    REDIS_URL: str = "redis://localhost:6379/0"

    INCREMENTAL_SYNC_INTERVAL_SECONDS: int = 3600
    BACKFILL_DAYS: int = 365

    CORS_ORIGINS: Union[List[str], str] = ["http://localhost:3000"]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> Union[List[str], str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        return v

    # Standard configuration mapping
    model_config = SettingsConfigDict(
        env_file=os.path.join(
            os.path.dirname(
                os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            ),
            ".env",
        ),
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
