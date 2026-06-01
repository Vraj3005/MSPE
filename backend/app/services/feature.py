import uuid
import numpy as np
import pandas as pd
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.dialects.postgresql import insert

from backend.app.core.logging import logger
from backend.app.models.market_data import MarketBar
from backend.app.models.feature import MarketFeature

class FeatureService:
    @classmethod
    def calculate_features_dataframe(cls, df: pd.DataFrame, resolution: str) -> pd.DataFrame:
        """Inputs a pandas DataFrame of raw price bars and appends 15 quantitative indicators.
        
        Input df columns: ['timestamp', 'open', 'high', 'low', 'close', 'volume']
        """
        if df.empty or len(df) == 0:
            return df

        # Ensure sorted chronologically
        df = df.sort_values("timestamp").reset_index(drop=True)

        # ----------------------------------------------------
        # 1. Statistical Features: Simple and Log Returns
        # ----------------------------------------------------
        df["returns_1d"] = df["close"].pct_change()
        df["log_returns"] = np.log(df["close"] / df["close"].shift(1))

        # ----------------------------------------------------
        # 2. Trend Features: SMA & EMA (20-period)
        # ----------------------------------------------------
        df["sma_20"] = df["close"].rolling(window=20).mean()
        df["ema_20"] = df["close"].ewm(span=20, adjust=False).mean()

        # MACD (12, 26, 9)
        ema_12 = df["close"].ewm(span=12, adjust=False).mean()
        ema_26 = df["close"].ewm(span=26, adjust=False).mean()
        df["macd"] = ema_12 - ema_26
        df["macd_signal"] = df["macd"].ewm(span=9, adjust=False).mean()
        df["macd_histogram"] = df["macd"] - df["macd_signal"]

        # RSI (14) using Wilder's smoothed technique
        delta = df["close"].diff()
        gain = delta.clip(lower=0)
        loss = -delta.clip(upper=0)
        avg_gain = gain.ewm(alpha=1/14, adjust=False).mean()
        avg_loss = loss.ewm(alpha=1/14, adjust=False).mean()
        # Prevent divide by zero
        rs = np.where(avg_loss == 0.0, 100.0, avg_gain / avg_loss)
        df["rsi_14"] = np.where(avg_loss == 0.0, 100.0, 100 - (100 / (1 + rs)))

        # ADX & ATR (14)
        up = df["high"].diff()
        down = -df["low"].diff()
        plus_dm = np.where((up > down) & (up > 0), up, 0.0)
        minus_dm = np.where((down > up) & (down > 0), down, 0.0)

        # True Range
        prev_close = df["close"].shift(1)
        tr = np.maximum(df["high"] - df["low"],
                        np.maximum(np.abs(df["high"] - prev_close),
                                   np.abs(df["low"] - prev_close)))
        
        # Wilder's Smoothing
        atr = pd.Series(tr).ewm(alpha=1/14, adjust=False).mean()
        df["atr_14"] = atr

        plus_di = 100 * pd.Series(plus_dm).ewm(alpha=1/14, adjust=False).mean() / np.where(atr == 0.0, 1e-9, atr)
        minus_di = 100 * pd.Series(minus_dm).ewm(alpha=1/14, adjust=False).mean() / np.where(atr == 0.0, 1e-9, atr)
        
        dx = 100 * np.abs(plus_di - minus_di) / np.where((plus_di + minus_di) == 0.0, 1e-9, plus_di + minus_di)
        df["adx_14"] = pd.Series(dx).ewm(alpha=1/14, adjust=False).mean()

        # ----------------------------------------------------
        # 3. Volatility Features: Annualized Historical and Parkinson
        # ----------------------------------------------------
        ann_factor = np.sqrt(252) if resolution == "1d" else np.sqrt(252 * 24)
        df["historical_volatility_30"] = df["log_returns"].rolling(window=30).std() * ann_factor

        # Parkinson Volatility (Rolling 30 High/Low estimator)
        hl_ratio_sq = (np.log(df["high"] / df["low"])) ** 2
        rolling_sum = hl_ratio_sq.rolling(window=30).sum()
        parkinson_constant = 4 * np.log(2)
        df["parkinson_volatility_30"] = np.sqrt(rolling_sum / (parkinson_constant * 30)) * ann_factor

        # ----------------------------------------------------
        # 4. Market Structure: Support, Resistance, Volume Profile
        # ----------------------------------------------------
        df["support_30"] = df["low"].rolling(window=30).min()
        df["resistance_30"] = df["high"].rolling(window=30).max()

        # Volume Profile calculation per row
        volume_profiles = []
        for i in range(len(df)):
            if i < 29:
                volume_profiles.append(None)
                continue
            
            sub = df.iloc[i-29:i+1]
            low_val = float(sub["low"].min())
            high_val = float(sub["high"].max())
            total_vol = float(sub["volume"].sum())
            
            if total_vol <= 0.0 or low_val == high_val:
                volume_profiles.append(None)
                continue

            price_bins = np.linspace(low_val, high_val, 11)
            bin_volume = np.zeros(10)
            
            for _, row in sub.iterrows():
                close_p = row["close"]
                vol_val = row["volume"]
                bin_idx = np.digitize(close_p, price_bins) - 1
                bin_idx = max(0, min(bin_idx, 9))
                bin_volume[bin_idx] += vol_val
                
            profile = []
            for b in range(10):
                mid_price = float((price_bins[b] + price_bins[b+1]) / 2.0)
                profile.append({
                    "price_bin": round(mid_price, 4),
                    "volume_weight": round(float(bin_volume[b] / total_vol), 4)
                })
            volume_profiles.append(profile)
        df["volume_profile"] = volume_profiles

        # ----------------------------------------------------
        # 5. Statistical Features: Rolling Close metrics
        # ----------------------------------------------------
        df["rolling_mean_30"] = df["close"].rolling(window=30).mean()
        df["rolling_variance_30"] = df["close"].rolling(window=30).var()
        df["rolling_skewness_30"] = df["close"].rolling(window=30).skew()
        df["rolling_kurtosis_30"] = df["close"].rolling(window=30).kurt()

        # Convert nan values to None to support clean DB insertion
        df = df.replace({np.nan: None, pd.NA: None})
        return df

    @classmethod
    async def compute_and_store_features(cls, db: AsyncSession, asset_id: uuid.UUID, resolution: str) -> None:
        """Loads historical price bars, calculates 15 quant indicators, and saves them to the DB."""
        logger.info(f"Computing engineered features for asset: {asset_id} ({resolution})...")

        # 1. Fetch raw bars from PostgreSQL
        query = select(MarketBar).where(
            and_(
                MarketBar.asset_id == asset_id,
                MarketBar.resolution == resolution
            )
        ).order_by(MarketBar.timestamp.asc())

        result = await db.execute(query)
        bars = result.scalars().all()

        if len(bars) < 30:
            logger.warning(f"Insufficient pricing history to calculate features for {asset_id} (found {len(bars)}/30 bars)")
            return

        # 2. Parse database rows into pandas DataFrame
        data = []
        for bar in bars:
            data.append({
                "timestamp": bar.timestamp,
                "open": float(bar.open),
                "high": float(bar.high),
                "low": float(bar.low),
                "close": float(bar.close),
                "volume": float(bar.volume)
            })

        df_prices = pd.DataFrame(data)

        # 3. Calculate features using vectorized equations
        df_features = cls.calculate_features_dataframe(df_prices, resolution)

        # 4. Upsert features to PostgreSQL in bulk
        logger.info(f"Saving {len(df_features)} computed feature records to the database...")
        values = []
        for _, row in df_features.iterrows():
            values.append({
                "timestamp": row["timestamp"],
                "asset_id": asset_id,
                "resolution": resolution,
                "sma_20": row["sma_20"],
                "ema_20": row["ema_20"],
                "macd": row["macd"],
                "macd_signal": row["macd_signal"],
                "macd_histogram": row["macd_histogram"],
                "rsi_14": row["rsi_14"],
                "adx_14": row["adx_14"],
                "atr_14": row["atr_14"],
                "historical_volatility_30": row["historical_volatility_30"],
                "parkinson_volatility_30": row["parkinson_volatility_30"],
                "support_30": row["support_30"],
                "resistance_30": row["resistance_30"],
                "volume_profile": row["volume_profile"],
                "returns_1d": row["returns_1d"],
                "log_returns": row["log_returns"],
                "rolling_mean_30": row["rolling_mean_30"],
                "rolling_variance_30": row["rolling_variance_30"],
                "rolling_skewness_30": row["rolling_skewness_30"],
                "rolling_kurtosis_30": row["rolling_kurtosis_30"]
            })

        if values:
            stmt = insert(MarketFeature).values(values)
            update_dict = {
                c.name: c for c in stmt.excluded 
                if c.name not in ["timestamp", "asset_id", "resolution"]
            }
            stmt = stmt.on_conflict_do_update(
                constraint="market_features_pkey",
                set_=update_dict
            )
            await db.execute(stmt)

        await db.commit()
        logger.info(f"Features computation and upsert completed successfully for {asset_id} ({resolution}).")
