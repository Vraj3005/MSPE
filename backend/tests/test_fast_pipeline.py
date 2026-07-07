"""Quick test of the fast pipeline — should complete in < 2 seconds."""

import sys
import time

sys.path.insert(0, r"c:\Desktop\MSPE_PR")

from backend.app.services.result_engine import (
    run_asset_pipeline_fast,
    generate_synthetic_prices,
    TRACKED_ASSETS,
)
from datetime import datetime, timezone

print("Testing fast pipeline for all assets...")
print("=" * 50)

total_start = time.time()
for symbol, meta in TRACKED_ASSETS.items():
    t0 = time.time()
    prices = generate_synthetic_prices(
        spot=meta["default_spot"],
        vol=meta["default_vol"],
        drift=meta["default_drift"],
        days=252,
    )
    result = run_asset_pipeline_fast(
        symbol=symbol,
        name=meta["name"],
        asset_class=meta["asset_class"],
        prices=prices,
        latest_date=datetime.now(timezone.utc),
        is_demo=True,
    )
    elapsed = time.time() - t0
    print(
        f"  {symbol:10s} {elapsed:.2f}s  price=${result.latest_price:,.2f}  risk={result.risk.risk_level}"
    )

    # Print 7d projection
    for p in result.projections:
        if p.horizon_days == 7:
            print(
                f"    7d: ${p.bear_price:,.2f} — ${p.base_price:,.2f} — ${p.bull_price:,.2f}  ({p.expected_return:+.2%})"
            )

total = time.time() - total_start
print(f"\nTotal: {total:.2f}s for {len(TRACKED_ASSETS)} assets")
print("PASSED!" if total < 5.0 else "TOO SLOW!")
