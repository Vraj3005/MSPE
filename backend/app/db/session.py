from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.app.core.config import settings

import ssl

# Async database engine setup for high-concurrency API calls
# statement_cache_size=0 is required for pgbouncer/Supabase compatibility
async_engine = create_async_engine(
    settings.ASYNC_DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    connect_args={
        "statement_cache_size": 0,
        "ssl": ssl._create_unverified_context(),
    },
)


async_session_maker = async_sessionmaker(
    bind=async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

# Synchronous engine for simple seeding scripts, test harnesses, or migrations
sync_engine = create_engine(settings.DATABASE_URL, echo=False, pool_pre_ping=True)

sync_session_maker = sessionmaker(bind=sync_engine, autocommit=False, autoflush=False)
