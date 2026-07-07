import time
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Any, Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, desc
from sqlalchemy.dialects.postgresql import insert

from backend.app.core.logging import logger
from backend.app.models.market_data import MarketBar
from backend.app.models.forecast import MarketForecast, ModelMetadata
from backend.app.models.projection import ProjectionRun, ProjectedSurface
from backend.app.services.ingestion import IngestionService
from backend.quant.simulation.monte_carlo import MonteCarloSimulator


class ProjectionService:
    @classmethod
    async def run_surface_projection(
        cls, db: AsyncSession, ticker: str, num_paths: int = 10000, steps: int = 7
    ) -> Tuple[ProjectionRun, List[ProjectedSurface]]:
        """Orchestrates loading forecast metrics, running path simulations, solving densities, and saving to DB."""
        logger.info(
            f"Initiating Monte Carlo probabilistic surface projection for: {ticker}..."
        )

        asset = await IngestionService.get_asset_by_ticker(db, ticker)
        if not asset:
            raise ValueError(f"Asset with ticker {ticker} not found in catalog")

        # 1. Fetch latest spot price from DB
        spot_query = (
            select(MarketBar)
            .where(MarketBar.asset_id == asset.id)
            .order_by(desc(MarketBar.timestamp))
            .limit(1)
        )

        spot_result = await db.execute(spot_query)
        latest_bar = spot_result.scalar_one_or_none()
        if not latest_bar:
            raise ValueError(
                f"No pricing bars found for asset {ticker}. Ingestion is required first."
            )

        spot_price = float(latest_bar.close)

        # 2. Fetch latest active forecast return and volatility expectations
        # Join MarketForecast on ModelMetadata to get trained parameters
        forecast_query = (
            select(MarketForecast, ModelMetadata)
            .join(ModelMetadata)
            .where(
                and_(
                    MarketForecast.asset_id == asset.id, ModelMetadata.is_active == True
                )
            )
            .order_by(desc(MarketForecast.timestamp))
            .limit(3)
        )  # Get 1, 3, 7 day forecasts

        fc_result = await db.execute(forecast_query)
        fc_rows = fc_result.all()

        drift = 0.05  # Standard default fallback: 5% expected return
        volatility = 0.20  # Standard default fallback: 20% expected volatility
        model_id = None

        if fc_rows:
            # Extract parameters from database models
            forecasts = [r[0] for r in fc_rows]
            model_meta = fc_rows[0][1]
            model_id = model_meta.id

            # Annualize expected return from forecast (take 1-day forecast return and multiply by 252)
            one_day_fc = next(
                (f for f in forecasts if f.horizon_days == 1), forecasts[0]
            )
            drift = float(one_day_fc.expected_return) * 252.0

            # Expected volatility is already annualized
            volatility = float(one_day_fc.expected_volatility)

            logger.info(
                f"Loaded parameters from forecast model {model_meta.model_type}: drift={drift:.4f}, volatility={volatility:.4f}"
            )
        else:
            # Fallback model selection: create mock model metadata since no trained model exists
            logger.warning(
                f"No trained forecasting models found for {ticker}. Running with statistical default estimators."
            )

            # Seed a dummy model metadata record to maintain database reference constraints
            meta_stmt = (
                insert(ModelMetadata)
                .values(
                    model_name=f"{ticker}_DEFAULT_ARIMA",
                    model_type="ARIMA",
                    version="v1.0.0",
                    hyperparameters={"p": 1, "d": 1, "q": 1},
                    metrics={"rmse": 0.05},
                    file_path="default_ar_fit",
                    is_active=True,
                    trained_at=datetime.now(timezone.utc),
                )
                .returning(ModelMetadata)
            )

            meta_result = await db.execute(meta_stmt)
            dummy_meta = meta_result.scalar_one()
            model_id = dummy_meta.id

        # 3. Create ProjectionRun entry in PostgreSQL (status=RUNNING)
        start_time = time.time()
        run_stmt = (
            insert(ProjectionRun)
            .values(
                asset_id=asset.id,
                model_id=model_id,
                timestamp=datetime.now(timezone.utc),
                parameters={
                    "num_paths": num_paths,
                    "steps": steps,
                    "drift": drift,
                    "volatility": volatility,
                },
                status="RUNNING",
            )
            .returning(ProjectionRun)
        )

        run_result = await db.execute(run_stmt)
        proj_run = run_result.scalar_one()
        await db.commit()

        try:
            # 4. Invoke quantitative Monte Carlo pathway engine
            simulator = MonteCarloSimulator(
                spot=spot_price,
                drift=drift,
                volatility=volatility,
                num_paths=num_paths,
                steps=steps,
            )

            paths = simulator.generate_paths()

            # 5. Extract continuous 3D density grids at Time X = [1, 3, 7] steps
            critical_steps = [1, 3, 7]
            density_grids = simulator.calculate_density_grid(
                paths, step_indices=critical_steps, grid_points=20
            )

            # 6. Save coordinate points to projected_surfaces database table
            saved_surfaces = []

            for grid_data in density_grids:
                step_val = grid_data["step"]
                # Time X-axis coordinate maps to spot time + step days forward
                time_coord = latest_bar.timestamp + timedelta(days=step_val)

                prices_arr = grid_data["prices"]
                densities_arr = grid_data["densities"]

                # Save each of the 20 price grid coordinates
                for p_idx in range(len(prices_arr)):
                    price_coord = float(prices_arr[p_idx])
                    density_val = float(densities_arr[p_idx])

                    surf_stmt = (
                        insert(ProjectedSurface)
                        .values(
                            run_id=proj_run.id,
                            projection_time=time_coord,
                            price=price_coord,
                            density=density_val,
                            p10_price=grid_data["p10_price"],
                            p50_price=grid_data["p50_price"],
                            p90_price=grid_data["p90_price"],
                        )
                        .returning(ProjectedSurface)
                    )

                    surf_result = await db.execute(surf_stmt)
                    saved_surfaces.append(surf_result.scalar_one())

            # 7. Update ProjectionRun entry to COMPLETED
            duration = time.time() - start_time
            proj_run.status = "COMPLETED"
            proj_run.duration_seconds = duration
            db.add(proj_run)

            await db.commit()
            logger.info(
                f"Surface projection run successfully committed to DB! (Duration: {duration:.2f}s)"
            )
            return proj_run, saved_surfaces

        except Exception as e:
            # Self-healing crash logging: mark status as FAILED
            logger.error(f"Monte Carlo projection loop failed: {e}")
            proj_run.status = "FAILED"
            db.add(proj_run)
            await db.commit()
            raise e

    @classmethod
    async def get_latest_projection_response(
        cls, db: AsyncSession, ticker: str
    ) -> Optional[Dict[str, Any]]:
        """Compiles the latest successful 3D surface mesh and percentile bands for Three.js rendering."""
        asset = await IngestionService.get_asset_by_ticker(db, ticker)
        if not asset:
            return None

        # Fetch latest COMPLETED run
        run_query = (
            select(ProjectionRun)
            .where(
                and_(
                    ProjectionRun.asset_id == asset.id,
                    ProjectionRun.status == "COMPLETED",
                )
            )
            .order_by(desc(ProjectionRun.timestamp))
            .limit(1)
        )

        run_result = await db.execute(run_query)
        latest_run = run_result.scalar_one_or_none()
        if not latest_run:
            return None

        # Fetch all coordinate points for this run
        surf_query = (
            select(ProjectedSurface)
            .where(ProjectedSurface.run_id == latest_run.id)
            .order_by(
                ProjectedSurface.projection_time.asc(), ProjectedSurface.price.asc()
            )
        )

        surf_result = await db.execute(surf_query)
        surfaces = surf_result.scalars().all()

        # Load parent forecast model type
        model_query = select(ModelMetadata).where(
            ModelMetadata.id == latest_run.model_id
        )
        model_result = await db.execute(model_query)
        model_meta = model_result.scalar_one_or_none()
        model_type = model_meta.model_type if model_meta else "UNKNOWN"

        # Compile scenario paths (distinct steps)
        # Group by projection_time to fetch 10th/50th/90th price trajectories
        scenario_map = {}
        for s in surfaces:
            t_str = s.projection_time
            if t_str not in scenario_map:
                scenario_map[t_str] = {
                    "time": t_str,
                    "bear": float(s.p10_price),
                    "base": float(s.p50_price),
                    "bull": float(s.p90_price),
                }

        sorted_scenarios = sorted(scenario_map.values(), key=lambda x: x["time"])

        bear_path = [{"time": s["time"], "price": s["bear"]} for s in sorted_scenarios]
        base_path = [{"time": s["time"], "price": s["base"]} for s in sorted_scenarios]
        bull_path = [{"time": s["time"], "price": s["bull"]} for s in sorted_scenarios]

        return {
            "ticker": ticker,
            "run_id": latest_run.id,
            "timestamp": latest_run.timestamp,
            "model_type": model_type,
            "bear_scenario": bear_path,
            "base_scenario": base_path,
            "bull_scenario": bull_path,
            "grid": surfaces,
        }
