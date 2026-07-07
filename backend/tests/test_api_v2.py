"""Quick dashboard endpoint test with long timeout."""
import httpx
import json

c = httpx.Client(timeout=httpx.Timeout(300.0))

print("Testing /api/v1/dashboard/results ...")
r = c.get("http://127.0.0.1:8000/api/v1/dashboard/results")
print(f"Status: {r.status_code}")

if r.status_code == 200:
    d = r.json()
    print(f"Mode: {d['data_mode']}")
    print(f"Engine: {d['engine_version']}")
    print(f"Assets: {list(d['assets'].keys())}")
    
    for sym, asset in d["assets"].items():
        print(f"\n--- {sym} ---")
        print(f"  Price: ${asset['latest_price']:,.2f}")
        print(f"  Model: {asset['model_selection']['selected_model']}")
        print(f"  Beaten baseline: {asset['model_selection']['baseline_beaten']}")
        print(f"  Calibration: {asset['model_selection']['validation_summary']['calibration_score']:.4f}")
        print(f"  Risk: {asset['risk']['risk_level']} ({asset['risk']['risk_score']})")
        for p in asset["projections"]:
            if p["horizon_days"] == 7:
                print(f"  7d: ${p['bear_price']:,.2f} — ${p['base_price']:,.2f} — ${p['bull_price']:,.2f}")
        print(f"  Explanation: {asset['explanation']['what_mspe_expects'][:100]}...")
    
    # Test legacy endpoints
    print("\n\nTesting legacy endpoints...")
    
    r2 = c.get("http://127.0.0.1:8000/api/dashboard/overview")
    print(f"  /api/dashboard/overview: {r2.status_code}")
    
    r3 = c.get("http://127.0.0.1:8000/api/assets")
    print(f"  /api/assets: {r3.status_code}")
    
    r4 = c.get("http://127.0.0.1:8000/api/assets/BTCUSDT/projection")
    print(f"  /api/assets/BTCUSDT/projection: {r4.status_code}")
    
    r5 = c.get("http://127.0.0.1:8000/api/assets/BTCUSDT/risk")
    print(f"  /api/assets/BTCUSDT/risk: {r5.status_code}")
    
    r6 = c.get("http://127.0.0.1:8000/api/methodology/simple")
    print(f"  /api/methodology/simple: {r6.status_code}")
    
    r7 = c.get("http://127.0.0.1:8000/api/assets/INVALID/projection")
    print(f"  /api/assets/INVALID/projection: {r7.status_code} (expect 404)")
    
    print("\nAll endpoints verified!")
else:
    print(f"FAILED: {r.text[:500]}")
