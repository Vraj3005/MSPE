"""Final validation test — polls until ready and prints results."""
import httpx, time, sys

c = httpx.Client(timeout=15.0)
BASE = "http://127.0.0.1:8000"

print("Waiting for validation results...")
for i in range(25):
    try:
        r = c.get(f"{BASE}/api/v1/validation/summary")
        if r.status_code == 200:
            d = r.json()
            if d.get("status") == "ready":
                print(f"\n{'='*70}")
                print("OVERALL CONCLUSION:")
                print(d["overall_conclusion"])
                print(f"{'='*70}\n")
                for sym, ad in d["assets"].items():
                    um = ad.get("user_metrics", {})
                    print(f"  {sym}: accuracy={um.get('projection_accuracy','?')}  "
                          f"range={um.get('range_reliability','?')}  "
                          f"confidence={um.get('model_confidence','?')}")
                print("\nPASSED!")
                sys.exit(0)
            else:
                print(f"  [{i+1}] status={d.get('status')}")
    except Exception as e:
        print(f"  [{i+1}] waiting... ({e.__class__.__name__})")
    time.sleep(15)

print("TIMEOUT")
sys.exit(1)
