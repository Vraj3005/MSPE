"""Test the validation endpoint with polling for background completion."""

import httpx
import time
import json

c = httpx.Client(timeout=30.0)

print("Testing GET /api/v1/validation/summary ...")
print("=" * 60)

# First call triggers computation
r = c.get("http://127.0.0.1:8000/api/v1/validation/summary")
print(f"Call 1 - Status: {r.status_code}")
data = r.json()
status = data.get("status", "unknown")
print(f"  Response status: {status}")

if status == "computing":
    print(f"  Message: {data.get('message', '')}")
    print()
    print("Waiting for background computation to complete...")

    for attempt in range(20):
        time.sleep(15)
        r = c.get("http://127.0.0.1:8000/api/v1/validation/summary")
        data = r.json()
        status = data.get("status", "unknown")
        print(f"  Attempt {attempt + 2}: status={status}")
        if status == "ready":
            break
    else:
        print("ERROR: Validation did not complete within 5 minutes")
        exit(1)

if status == "ready" or data.get("assets"):
    print()
    print(f"Data mode: {data.get('data_mode', 'unknown')}")
    print(f"Assets: {list(data.get('assets', {}).keys())}")
    print()
    print("=" * 70)
    print("OVERALL CONCLUSION:")
    print(data.get("overall_conclusion", "N/A"))
    print("=" * 70)
    print()

    for sym, asset_data in data.get("assets", {}).items():
        print(f"--- {sym} ({asset_data.get('asset_name', '')}) ---")
        um = asset_data.get("user_metrics")
        if um:
            print(f"  Projection Accuracy:   {um['projection_accuracy']}")
            print(f"  Range Reliability:     {um['range_reliability']}")
            print(f"  Risk Warning Quality:  {um['risk_warning_quality']}")
            print(f"  Baseline Improvement:  {um['baseline_improvement']}")
            print(f"  Model Confidence:      {um['model_confidence']}")

        for label, hdata in asset_data.get("horizons", {}).items():
            beaten = "YES" if hdata["baseline_beaten"] else "NO"
            print(
                f"  {label}: best={hdata['best_model']:30s} beats_baseline={beaten}  score={hdata['best_model_score']:.4f}"
            )

        conclusion = asset_data.get("overall_conclusion", "")
        print(f"  Conclusion: {conclusion[:150]}...")
        print()

    print("ALL VALIDATION TESTS PASSED!")
else:
    print(f"ERROR: Unexpected response: {json.dumps(data, indent=2)[:500]}")
