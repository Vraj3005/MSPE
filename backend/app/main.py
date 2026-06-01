from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger

from backend.app.core.config import settings
from backend.app.core.logging import logger
from backend.app.api.router import api_router
from backend.app.db.session import async_session_maker
from backend.app.services.ingestion import IngestionService

# Keep track of active scheduler instance
scheduler = BackgroundScheduler()

async def run_incremental_sync_job():
    """Wrapper job executing sync loops inside scheduled intervals."""
    logger.info("Executing scheduled incremental price sync...")
    async with async_session_maker() as db:
        try:
            await IngestionService.sync_incremental(db, "1d")
            await IngestionService.sync_incremental(db, "1h")
        except Exception as e:
            logger.error(f"Error during scheduled database sync: {e}")

async def run_initial_sync():
    """Run initial sync asynchronously so we don't block server startup."""
    logger.info("Executing initial startup database sync in background...")
    async with async_session_maker() as db:
        try:
            await IngestionService.sync_incremental(db, "1d")
            await IngestionService.sync_incremental(db, "1h")
            logger.info("Initial startup database sync completed successfully.")
        except Exception as e:
            logger.error(f"Initial startup synchronization warning: {e}. Checking again on scheduled intervals.")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- STARTUP CYCLE ---
    logger.info(f"Starting Market Surface Projection Engine (MSPE) - Env: {settings.ENV}")
    
    # 1. Seed assets catalog in database if not present
    async with async_session_maker() as db:
        await IngestionService.seed_assets_if_empty(db)
        
    # 2. Trigger an immediate background sync on startup asynchronously to not block API startup
    import asyncio
    asyncio.create_task(run_initial_sync())

    # 3. Initialize and schedule background job
    scheduler.add_job(
        func=lambda: asyncio.run(run_incremental_sync_job()),
        trigger=IntervalTrigger(seconds=settings.INCREMENTAL_SYNC_INTERVAL_SECONDS),
        id="incremental_market_data_sync",
        name="Sync market data incrementally",
        replace_existing=True
    )
    scheduler.start()
    logger.info(f"Incremental Ingestion Scheduler successfully started with intervals of {settings.INCREMENTAL_SYNC_INTERVAL_SECONDS} seconds.")

    yield
    
    # --- SHUTDOWN CYCLE ---
    logger.info("Shutting down Market Surface Projection Engine...")
    scheduler.shutdown()
    logger.info("Ingestion scheduler successfully stopped.")

# Instantiate FastAPI application
app = FastAPI(
    title="Market Surface Projection Engine (MSPE)",
    description="Quantitative Finance and Algorithmic Trading Platform - Market Data Layer",
    version="1.0.0",
    lifespan=lifespan
)

# CORS Policy Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[str(origin) for origin in settings.CORS_ORIGINS] if isinstance(settings.CORS_ORIGINS, list) else [settings.CORS_ORIGINS],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API Routers
app.include_router(api_router, prefix="/api/v1")

@app.get("/")
def read_root():
    return {
        "engine": "Market Surface Projection Engine (MSPE)",
        "version": "1.0.0",
        "status": "ONLINE",
        "ingestion_scheduler": "ACTIVE",
        "documentation_endpoint": "/docs"
    }
