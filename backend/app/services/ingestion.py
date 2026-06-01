import asyncio
from datetime import datetime, timedelta, timezone
import httpx
import yfinance as yf
import pandas as pd
import numpy as np
import uuid
from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from sqlalchemy.dialects.postgresql import insert

from backend.app.core.logging import logger
from backend.app.models.asset import Asset
from backend.app.models.market_data import MarketBar
from backend.app.services.feature import FeatureService

# Core assets metadata setup
DEFAULT_ASSETS = [
    {"ticker": "BTCUSDT", "name": "Bitcoin / Tether USDT", "asset_class": "CRYPTO", "source": "BINANCE", "external_symbol": "BTCUSDT"},
    {"ticker": "ETHUSDT", "name": "Ethereum / Tether USDT", "asset_class": "CRYPTO", "source": "BINANCE", "external_symbol": "ETHUSDT"},
    {"ticker": "SPX", "name": "S&P 500 Index", "asset_class": "INDEX", "source": "YFINANCE", "external_symbol": "^GSPC"},
    {"ticker": "XAU", "name": "Gold Commodity", "asset_class": "COMMODITY", "source": "YFINANCE", "external_symbol": "GC=F"}
]

class IngestionService:
    @staticmethod
    async def seed_assets_if_empty(db: AsyncSession) -> None:
        """Seeds the standard tracked assets into the database if not already present."""
        logger.info("Verifying asset catalog seeding...")
        for asset_data in DEFAULT_ASSETS:
            query = select(Asset).where(Asset.ticker == asset_data["ticker"])
            result = await db.execute(query)
            existing = result.scalar_one_or_none()
            if not existing:
                new_asset = Asset(
                    ticker=asset_data["ticker"],
                    name=asset_data["name"],
                    asset_class=asset_data["asset_class"],
                    is_active=True
                )
                db.add(new_asset)
                logger.info(f"Seeded asset: {asset_data['ticker']}")
        await db.commit()

    @classmethod
    async def get_asset_by_ticker(cls, db: AsyncSession, ticker: str) -> Optional[Asset]:
        query = select(Asset).where(Asset.ticker == ticker)
        result = await db.execute(query)
        return result.scalar_one_or_none()

    @classmethod
    async def fetch_historical_data(
        cls, ticker: str, source: str, external_symbol: str, start_time: datetime, end_time: datetime, resolution: str
    ) -> List[Dict[str, Any]]:
        """Downloads historical bars from the designated source (Binance or yfinance)."""
        if source == "BINANCE":
            return await cls._fetch_binance_klines(external_symbol, start_time, end_time, resolution)
        elif source == "YFINANCE":
            return await cls._fetch_yfinance_history(external_symbol, start_time, end_time, resolution)
        else:
            raise ValueError(f"Unsupported feed source: {source}")

    @classmethod
    async def _fetch_binance_klines(
        cls, symbol: str, start_time: datetime, end_time: datetime, resolution: str
    ) -> List[Dict[str, Any]]:
        """Queries Binance Klines endpoint using httpx async calls."""
        # Map resolution to Binance intervals
        interval_map = {"1d": "1d", "1h": "1h", "1m": "1m"}
        interval = interval_map.get(resolution, "1d")

        # Convert datetimes to millisecond timestamps
        start_ms = int(start_time.timestamp() * 1000)
        end_ms = int(end_time.timestamp() * 1000)

        url = "https://api.binance.com/api/v3/klines"
        params = {
            "symbol": symbol,
            "interval": interval,
            "startTime": start_ms,
            "endTime": end_ms,
            "limit": 1000
        }

        logger.info(f"Querying Binance klines for {symbol} ({resolution})...")
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(url, params=params)
            response.raise_for_status()
            data = response.json()

        bars = []
        for raw in data:
            # Binance raw indexes: 0=open time, 1=open, 2=high, 3=low, 4=close, 5=volume
            timestamp = datetime.fromtimestamp(raw[0] / 1000.0, tz=timezone.utc)
            bars.append({
                "timestamp": timestamp,
                "open": float(raw[1]),
                "high": float(raw[2]),
                "low": float(raw[3]),
                "close": float(raw[4]),
                "volume": float(raw[5])
            })
        return bars

    @classmethod
    async def _fetch_yfinance_history(
        cls, symbol: str, start_time: datetime, end_time: datetime, resolution: str
    ) -> List[Dict[str, Any]]:
        """Wrapper utilizing asyncio.to_thread to run blocking yfinance synchronous queries in thread pools."""
        # Map resolution to yfinance intervals
        interval_map = {"1d": "1d", "1h": "1h", "1m": "1m"}
        interval = interval_map.get(resolution, "1d")

        # Dates formatted as string parameters
        start_str = start_time.strftime("%Y-%m-%d")
        end_str = (end_time + timedelta(days=1)).strftime("%Y-%m-%d")

        def _fetch():
            ticker_obj = yf.Ticker(symbol)
            return ticker_obj.history(start=start_str, end=end_str, interval=interval)

        logger.info(f"Querying Yahoo Finance for {symbol} ({resolution})...")
        df = await asyncio.to_thread(_fetch)
        
        bars = []
        if df.empty:
            logger.warning(f"Yahoo Finance returned empty set for {symbol}")
            return bars

        for idx, row in df.iterrows():
            # Check for pandas native timezone indexes or localize to UTC
            if isinstance(idx, pd.Timestamp):
                ts = idx.to_pydatetime()
                if ts.tzinfo is None:
                    ts = ts.replace(tzinfo=timezone.utc)
                else:
                    ts = ts.astimezone(timezone.utc)
            else:
                continue

            # Skip empty rows that yfinance sometimes provides on holidays
            if pd.isna(row["Open"]) or pd.isna(row["Close"]) or row["Open"] <= 0:
                continue

            bars.append({
                "timestamp": ts,
                "open": float(row["Open"]),
                "high": float(row["High"]),
                "low": float(row["Low"]),
                "close": float(row["Close"]),
                "volume": float(row["Volume"])
            })
        return bars

    @classmethod
    def validate_and_clean_bars(cls, raw_bars: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Audits bar elements against physical bounds and corrects pricing anomalies."""
        cleaned = []
        for bar in raw_bars:
            open_p, high_p, low_p, close_p, vol = bar["open"], bar["high"], bar["low"], bar["close"], bar["volume"]
            ts = bar["timestamp"]

            # 1. Price negativity checks
            if open_p <= 0.0 or high_p <= 0.0 or low_p <= 0.0 or close_p <= 0.0 or vol < 0.0:
                logger.warning(f"Dropped bar at {ts} due to invalid non-positive prices or volume: {bar}")
                continue

            # 2. Consistency constraints auditing: High must be maximum, Low must be minimum
            if not (high_p >= low_p):
                logger.warning(f"Corrected anomaly at {ts}: High ({high_p}) was less than Low ({low_p}). Swapping bounds.")
                high_p, low_p = low_p, high_p

            if open_p > high_p:
                high_p = open_p
            if close_p > high_p:
                high_p = close_p
            if open_p < low_p:
                low_p = open_p
            if close_p < low_p:
                low_p = close_p

            cleaned.append({
                "timestamp": ts,
                "open": open_p,
                "high": high_p,
                "low": low_p,
                "close": close_p,
                "volume": vol
            })
        return cleaned

    @classmethod
    def handle_missing_values(cls, bars: List[Dict[str, Any]], asset_class: str, resolution: str) -> List[Dict[str, Any]]:
        """Handles gap filling via forward-fill padding for continuous indices."""
        if not bars:
            return []

        # Sort bars chronologically
        bars = sorted(bars, key=lambda x: x["timestamp"])

        if asset_class != "CRYPTO":
            # Traditional markets have normal holidays/weekends, so we don't pad gaps on closed dates
            return bars

        # Map resolution to step increments
        step_map = {"1d": timedelta(days=1), "1h": timedelta(hours=1), "1m": timedelta(minutes=1)}
        step = step_map.get(resolution, timedelta(days=1))

        filled = []
        last_bar = None

        for bar in bars:
            if last_bar is not None:
                expected_ts = last_bar["timestamp"] + step
                # Fill missing bars if gap exceeds the expected step size
                while expected_ts < bar["timestamp"]:
                    # Create forward-filled bar
                    filled.append({
                        "timestamp": expected_ts,
                        "open": last_bar["close"],
                        "high": last_bar["close"],
                        "low": last_bar["close"],
                        "close": last_bar["close"],
                        "volume": 0.0
                    })
                    expected_ts += step
            filled.append(bar)
            last_bar = bar

        return filled

    @classmethod
    async def backfill_asset(cls, db: AsyncSession, ticker: str, days: int = 365, resolution: str = "1d") -> None:
        """Backfills historical data for a specific asset and upserts records to the database."""
        # Find default metadata mapping
        meta = next((item for item in DEFAULT_ASSETS if item["ticker"] == ticker), None)
        if not meta:
            raise ValueError(f"Asset metadata not registered for ticker: {ticker}")

        asset = await cls.get_asset_by_ticker(db, ticker)
        if not asset:
            raise ValueError(f"Asset does not exist in DB: {ticker}. Please ensure catalog is seeded.")

        end_time = datetime.now(timezone.utc)
        start_time = end_time - timedelta(days=days)

        logger.info(f"Executing historical backfill for {ticker} ({days} days at {resolution})...")
        
        # 1. Fetch
        raw_bars = await cls.fetch_historical_data(
            ticker=ticker,
            source=meta["source"],
            external_symbol=meta["external_symbol"],
            start_time=start_time,
            end_time=end_time,
            resolution=resolution
        )

        # 2. Validate
        valid_bars = cls.validate_and_clean_bars(raw_bars)

        # 3. Missing gaps handling
        processed_bars = cls.handle_missing_values(valid_bars, meta["asset_class"], resolution)

        if not processed_bars:
            logger.warning(f"No valid bars compiled for backfill: {ticker}")
            return

        # 4. PostgreSQL Upsert execution
        logger.info(f"Upserting {len(processed_bars)} bars for {ticker} to DB...")
        
        for bar in processed_bars:
            stmt = insert(MarketBar).values(
                timestamp=bar["timestamp"],
                asset_id=asset.id,
                open=bar["open"],
                high=bar["high"],
                low=bar["low"],
                close=bar["close"],
                volume=bar["volume"],
                resolution=resolution
            ).on_conflict_do_update(
                constraint="market_bars_pkey",
                set_={
                    "open": bar["open"],
                    "high": bar["high"],
                    "low": bar["low"],
                    "close": bar["close"],
                    "volume": bar["volume"]
                }
            )
            await db.execute(stmt)
        
        await db.commit()
        logger.info(f"Backfill successfully completed for {ticker} ({resolution}).")

        # Trigger dynamic feature calculation
        try:
            await FeatureService.compute_and_store_features(db, asset.id, resolution)
        except Exception as e:
            logger.error(f"Failed to calculate features for {ticker} post-backfill: {e}")

    @classmethod
    async def sync_incremental(cls, db: AsyncSession, resolution: str = "1d") -> None:
        """Determines the latest stored timestamp for all assets, then queries incremental differences."""
        logger.info("Executing incremental time-series synchronization...")
        for meta in DEFAULT_ASSETS:
            asset = await cls.get_asset_by_ticker(db, meta["ticker"])
            if not asset:
                continue

            # Query the latest bar timestamp in the database for this asset and resolution
            query = select(MarketBar).where(
                MarketBar.asset_id == asset.id,
                MarketBar.resolution == resolution
            ).order_by(desc(MarketBar.timestamp)).limit(1)
            
            result = await db.execute(query)
            latest_bar = result.scalar_one_or_none()

            # If no data exists, initiate backfill instead
            if not latest_bar:
                logger.info(f"No existing records found for {meta['ticker']}. Redirecting to backfill...")
                await cls.backfill_asset(db, meta["ticker"], days=365, resolution=resolution)
                continue

            start_time = latest_bar.timestamp
            end_time = datetime.now(timezone.utc)

            # Avoid hitting data feeds if difference is too small (e.g. within same hour/day resolution)
            min_delta = timedelta(days=1) if resolution == "1d" else timedelta(hours=1)
            if end_time - start_time < min_delta:
                logger.info(f"Asset {meta['ticker']} is already synchronized up to {start_time}")
                continue

            logger.info(f"Syncing {meta['ticker']} incrementally since {start_time}...")
            
            raw_bars = await cls.fetch_historical_data(
                ticker=meta["ticker"],
                source=meta["source"],
                external_symbol=meta["external_symbol"],
                start_time=start_time,
                end_time=end_time,
                resolution=resolution
            )

            valid_bars = cls.validate_and_clean_bars(raw_bars)
            processed_bars = cls.handle_missing_values(valid_bars, meta["asset_class"], resolution)

            if not processed_bars:
                continue

            for bar in processed_bars:
                stmt = insert(MarketBar).values(
                    timestamp=bar["timestamp"],
                    asset_id=asset.id,
                    open=bar["open"],
                    high=bar["high"],
                    low=bar["low"],
                    close=bar["close"],
                    volume=bar["volume"],
                    resolution=resolution
                ).on_conflict_do_update(
                    constraint="market_bars_pkey",
                    set_={
                        "open": bar["open"],
                        "high": bar["high"],
                        "low": bar["low"],
                        "close": bar["close"],
                        "volume": bar["volume"]
                    }
                )
                await db.execute(stmt)

            await db.commit()
            logger.info(f"Incremental sync successful for {meta['ticker']}")

            # Trigger dynamic feature calculation
            try:
                await FeatureService.compute_and_store_features(db, asset.id, resolution)
            except Exception as e:
                logger.error(f"Failed to calculate features for {meta['ticker']} post-sync: {e}")
