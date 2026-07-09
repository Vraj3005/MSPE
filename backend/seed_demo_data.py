"""Trigger and execute the entire quantitative pipeline for all active assets.

This computes features, trains forecasting models, generates Monte Carlo surface projections,
evaluates trading signals with risk controls, and computes portfolio/asset risk metrics.
"""

import asyncio
from backend.app.db.session import async_session_maker, async_engine
from backend.app.models.asset import Asset
from backend.app.services.feature import FeatureService
from backend.app.services.forecast import ForecastingService
from backend.app.services.projection import ProjectionService
from backend.app.services.signal import SignalService
from backend.app.services.risk import RiskService
from sqlalchemy import select


async def run_pipeline():
    print("Connecting to Supabase PostgreSQL database...")
    async with async_session_maker() as db:
        # 1. Fetch active assets
        print("Querying active assets...")
        result = await db.execute(select(Asset).where(Asset.is_active))
        assets = result.scalars().all()

        if not assets:
            print(
                "No active assets found. Please run the ingestion service or check database."
            )
            return

        print(f"Found {len(assets)} active assets: {[a.ticker for a in assets]}")

        # 2. Compute Features, Forecasts, and Projections for each asset
        for asset in assets:
            print("\n==================================================")
            print(f"Processing asset: {asset.ticker}")
            print("==================================================")

            # Step A: Compute technical indicators / features
            print(f"[{asset.ticker}] Step 1/3: Computing features...")
            try:
                await FeatureService.compute_and_store_features(db, asset.id, "1d")
                print(f"[{asset.ticker}] Features successfully calculated!")
            except Exception as e:
                print(f"[{asset.ticker}] Features computation failed: {e}")
                continue

            # Step B: Train forecast model (e.g. ARIMA) and create forecast expectations
            print(f"[{asset.ticker}] Step 2/3: Training forecasting model (ARIMA)...")
            try:
                # We use ARIMA as the fast baseline for demo data population
                await ForecastingService.train_and_persist_model(
                    db=db,
                    ticker=asset.ticker,
                    model_type="ARIMA",
                    resolution="1d",
                    version="v1.0.0",
                    hyperparameters={"p": 1, "d": 1, "q": 1},
                    validation_steps=5,
                )
                print(
                    f"[{asset.ticker}] Forecasting model trained and forecasts registered!"
                )
            except Exception as e:
                print(f"[{asset.ticker}] Model training failed: {e}")

            # Step C: Run Monte Carlo simulations and build the 3D surface
            print(
                f"[{asset.ticker}] Step 3/3: Running Monte Carlo surface projections..."
            )
            try:
                await ProjectionService.run_surface_projection(
                    db=db,
                    ticker=asset.ticker,
                    num_paths=5000,  # 5k paths for rapid seeding
                    steps=7,
                )
                print(
                    f"[{asset.ticker}] Monte Carlo projection surface built and saved!"
                )
            except Exception as e:
                print(f"[{asset.ticker}] Projection run failed: {e}")

        # 3. Evaluate portfolio-wide trading signals
        print("\n==================================================")
        print("Step 4/5: Generating Portfolio Trading Signals...")
        print("==================================================")
        try:
            signals = await SignalService.evaluate_signals(db)
            active_sigs = [s for s in signals if s.is_active]
            print(
                f"Signals evaluation complete! Created {len(signals)} total signals ({len(active_sigs)} active trades)."
            )
        except Exception as e:
            print(f"Signals evaluation failed: {e}")

        # 4. Run portfolio and asset risk analytics
        print("\n==================================================")
        print("Step 5/5: Running Risk Analytics and Stress Tests...")
        print("==================================================")
        try:
            await RiskService.evaluate_risk_analytics(db)
            print(
                "Risk analytics evaluation successfully calculated and committed to DB!"
            )
        except Exception as e:
            print(f"Risk evaluation failed: {e}")

    print("\nPipeline execution complete! Disposing database connections...")
    await async_engine.dispose()
    print("Database connections clean up successful.")


if __name__ == "__main__":
    asyncio.run(run_pipeline())
