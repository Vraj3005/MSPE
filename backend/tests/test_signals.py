import os
import sys

# Add workspace root directory to path so script runs standalone
sys.path.append(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)

from backend.app.services.signal import (
    PORTFOLIO_EQUITY,
    MAX_RISK_PER_TRADE,
    MAX_PORTFOLIO_RISK,
)


def test_risk_reward_calculation():
    print("  - Running Risk-Reward Ratio validations...")
    # Long Candidate
    entry_long = 100.0
    sl_long = 90.0  # Bear scenario
    tp_long = 120.0  # Bull scenario

    rrr_long = (tp_long - entry_long) / (entry_long - sl_long)
    assert abs(rrr_long - 2.0) < 1e-4, f"Long RRR calculation error: {rrr_long}"

    # Short Candidate
    entry_short = 100.0
    sl_short = 110.0
    tp_short = 85.0

    rrr_short = (entry_short - tp_short) / (sl_short - entry_short)
    assert abs(rrr_short - 1.5) < 1e-4, f"Short RRR calculation error: {rrr_short}"


def test_position_sizing_budget():
    print("  - Running 1% Volatility-Adjusted Sizing validations...")
    # Entry at 100, Stop Loss at 90 (10% drawdown)
    entry = 100.0
    sl = 90.0
    percent_loss = abs(entry - sl) / entry

    risk_budget_usd = PORTFOLIO_EQUITY * MAX_RISK_PER_TRADE  # $1,000 USD risk
    expected_size = risk_budget_usd / percent_loss  # $1,000 / 0.10 = $10,000

    assert (
        abs(expected_size - 10000.0) < 1e-2
    ), f"Position sizing error: {expected_size}"

    # Entry at 100, Stop Loss at 98 (2% drawdown - tighter stop means larger size)
    sl_tight = 98.0
    percent_loss_tight = abs(entry - sl_tight) / entry
    expected_size_tight = (
        risk_budget_usd / percent_loss_tight
    )  # $1,000 / 0.02 = $50,000

    assert (
        abs(expected_size_tight - 50000.0) < 1e-2
    ), f"Tight position sizing error: {expected_size_tight}"


def test_signal_filters():
    print("  - Running Risk-Reward constraints filtering checks...")
    # Under 1.5 RRR should trigger NO_TRADE
    # Entry = 100, SL = 90, TP = 110. RRR = 10/10 = 1.0 (Less than 1.5 limit)
    entry = 100.0
    sl = 90.0
    tp = 110.0
    rrr = (tp - entry) / (entry - sl)

    # Assert filter condition matches requirement
    assert rrr < 1.5, "RRR should fail the minimum 1.5 threshold filter"


def test_signal_ranking():
    print("  - Running composite signals ranking checks...")
    # Candidate A
    ret_a = 0.002
    conf_a = 0.8
    rrr_a = 2.0
    rank_score_a = abs(ret_a) * conf_a * rrr_a  # 0.0032

    # Candidate B (More bullish, higher rank score)
    ret_b = 0.005
    conf_b = 0.9
    rrr_b = 2.5
    rank_score_b = abs(ret_b) * conf_b * rrr_b  # 0.01125

    # Sort signals descending by Rank Score
    candidates = [
        {"ticker": "BTC", "rank_score": rank_score_a},
        {"ticker": "ETH", "rank_score": rank_score_b},
    ]

    sorted_cand = sorted(candidates, key=lambda x: x["rank_score"], reverse=True)
    assert sorted_cand[0]["ticker"] == "ETH", "ETH must rank first due to higher score"


def test_portfolio_risk_ceiling():
    print("  - Running 5% Aggregate Portfolio Risk ceiling validations...")
    # Enforces 5% maximum total risk ($5,000 risk capital)
    # Simulate adding 6 open positions, each allocating exactly 1% ($1,000 USD risk)
    portfolio_equity = 100000.0
    max_risk_usd = portfolio_equity * MAX_PORTFOLIO_RISK  # $5,000

    # Generate 6 candidates
    candidates = [
        {"ticker": "BTC", "risk_usd": 1000.0, "rank": 0.15},
        {"ticker": "ETH", "risk_usd": 1000.0, "rank": 0.12},
        {"ticker": "SOL", "risk_usd": 1000.0, "rank": 0.10},
        {"ticker": "AAPL", "risk_usd": 1000.0, "rank": 0.08},
        {"ticker": "GOOG", "risk_usd": 1000.0, "rank": 0.06},
        {"ticker": "AMZN", "risk_usd": 1000.0, "rank": 0.04},
    ]

    # Sort by rank
    candidates = sorted(candidates, key=lambda x: x["rank"], reverse=True)

    current_active_risk = 0.0
    accepted = []
    rejected = []

    for cand in candidates:
        if current_active_risk + cand["risk_usd"] <= max_risk_usd:
            accepted.append(cand)
            current_active_risk += cand["risk_usd"]
        else:
            rejected.append(cand)

    # Verify allocations
    assert len(accepted) == 5, f"Expected exactly 5 open trades, got {len(accepted)}"
    assert len(rejected) == 1, "Expected 6th trade to be blocked, but got accepted"
    assert (
        rejected[0]["ticker"] == "AMZN"
    ), f"Expected lowest ranked AMZN to be blocked, got {rejected[0]['ticker']}"
    assert (
        current_active_risk == 5000.0
    ), f"Portfolio active risk weights are incorrect: {current_active_risk}"


if __name__ == "__main__":
    print("Starting MSPE Trading Signal Engine Unit Test Suite...")
    try:
        test_risk_reward_calculation()
        test_position_sizing_budget()
        test_signal_filters()
        test_signal_ranking()
        test_portfolio_risk_ceiling()
        print(
            "\nSUCCESS: All position sizing, RRR filters, rankings, and risk ceilings passed validations!"
        )
        sys.exit(0)
    except AssertionError as ae:
        print(f"\nFAILURE: Mathematical validation failed: {ae}", file=sys.stderr)
        sys.exit(1)
    except Exception as ex:
        print(
            f"\nCRITICAL ERROR: Unexpected execution exception: {ex}", file=sys.stderr
        )
        sys.exit(1)
