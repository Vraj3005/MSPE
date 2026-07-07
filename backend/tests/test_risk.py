import os
import sys
import numpy as np

# Add workspace root directory to path so script runs standalone
sys.path.append(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)

from backend.quant.risk import analytics as risk_calc


def test_returns_computation():
    print("  - Running daily returns computation validations...")
    prices = np.array([100.0, 105.0, 102.9, 108.045])
    expected_returns = np.array([0.05, -0.02, 0.05])
    calculated_returns = risk_calc.compute_daily_returns(prices)
    assert np.allclose(
        calculated_returns, expected_returns
    ), f"Returns calculation error: {calculated_returns}"


def test_var_and_expected_shortfall():
    print("  - Running Value at Risk (VaR) and Expected Shortfall (ES) validations...")
    # Formulate a returns sequence (20 trading days)
    # Quantiles for 95% confidence will correspond to the worst returns
    returns = np.array(
        [
            0.01,
            0.02,
            -0.01,
            -0.02,
            0.03,
            -0.04,
            0.01,
            0.02,
            -0.03,
            0.04,
            -0.05,
            0.02,
            0.01,
            -0.01,
            -0.02,
            0.03,
            -0.06,
            0.01,
            0.02,
            -0.07,
        ]
    )

    # Worst losses: -0.07, -0.06, -0.05, -0.04, -0.03, -0.02, -0.02, -0.01, -0.01

    # 95% Historical VaR:
    # 1.0 - 0.95 = 0.05. Empirical percentile(returns, 5) -> worst 5% percentile
    var_95_hist = risk_calc.calculate_var_historical(returns, 0.95)
    # Check value is reasonable and non-negative
    assert var_95_hist > 0.04, f"Historical 95% VaR too small: {var_95_hist}"
    assert var_95_hist <= 0.07, f"Historical 95% VaR too large: {var_95_hist}"

    # 95% Expected Shortfall: average of returns worse than negative VaR
    es_95 = risk_calc.calculate_expected_shortfall(returns, 0.95)
    assert (
        es_95 >= var_95_hist
    ), f"Expected Shortfall {es_95} must be greater than or equal to VaR {var_95_hist}"

    # Parametric VaR
    var_95_param = risk_calc.calculate_var_parametric(returns, 0.95)
    assert var_95_param > 0.0, f"Parametric 95% VaR is invalid: {var_95_param}"


def test_maximum_drawdown():
    print("  - Running Maximum Drawdown validations...")
    prices = np.array([100.0, 110.0, 104.5, 115.0, 92.0, 105.0])
    # Peak is 115.0, subsequent trough is 92.0
    # Drawdown = (115 - 92) / 115 = 23 / 115 = 0.20 (20% drawdown)
    mdd = risk_calc.calculate_max_drawdown(prices)
    assert abs(mdd - 0.20) < 1e-4, f"Maximum Drawdown calculation error: {mdd}"


def test_sharpe_and_sortino():
    print("  - Running Sharpe and Sortino ratio validations...")
    # Constant 1% daily return (huge performance, zero volatility)
    returns_const = np.array([0.01] * 20)
    sharpe = risk_calc.calculate_sharpe_ratio(returns_const, risk_free_rate_annual=0.0)
    # Standard deviation is 0.0, Sharpe must handle it gracefully or resolve to 0.0
    assert abs(sharpe) < 1e-4, f"Zero-volatility Sharpe should be 0.0: {sharpe}"

    # Normal returns vector
    np.random.seed(42)
    normal_returns = np.random.normal(
        loc=0.0005, scale=0.01, size=252
    )  # Mean annualized return approx 12.6%
    sharpe_normal = risk_calc.calculate_sharpe_ratio(
        normal_returns, risk_free_rate_annual=0.02
    )
    sortino_normal = risk_calc.calculate_sortino_ratio(
        normal_returns, risk_free_rate_annual=0.02
    )

    assert sharpe_normal != 0.0, "Sharpe ratio should not be zero"
    assert sortino_normal != 0.0, "Sortino ratio should not be zero"


def test_systemic_beta_alpha():
    print("  - Running Beta and Jensen's Alpha validations...")
    # Asset is a leveraged version of the benchmark + tracking error
    benchmark = np.array([0.01, -0.02, 0.015, -0.01, 0.03, -0.02, 0.01])
    asset = 1.5 * benchmark + np.random.normal(0, 0.001, len(benchmark))

    beta, alpha = risk_calc.calculate_beta_alpha(
        asset, benchmark, risk_free_rate_annual=0.02
    )
    # Beta should be close to 1.5
    assert abs(beta - 1.5) < 0.1, f"Beta calculation error: {beta}"
    assert isinstance(alpha, float), "Jensen's Alpha must be a float value"


def test_correlation_matrix():
    print("  - Running correlation matrix validations...")
    # High correlation assets
    np.random.seed(42)
    x = np.random.normal(0, 0.01, 100)
    y = x + np.random.normal(0, 0.002, 100)
    z = -x + np.random.normal(0, 0.002, 100)

    corr_grid = risk_calc.compute_correlation_matrix({"X": x, "Y": y, "Z": z})

    assert (
        corr_grid["X"]["Y"] > 0.8
    ), f"X and Y should be highly correlated: {corr_grid['X']['Y']}"
    assert (
        corr_grid["X"]["Z"] < -0.8
    ), f"X and Z should be highly negatively correlated: {corr_grid['X']['Z']}"
    assert abs(corr_grid["X"]["X"] - 1.0) < 1e-4, "Self correlation must be exactly 1.0"


def test_stress_testing():
    print("  - Running stress testing validations...")
    # Allocate equal weights (25% each) across BTC, ETH, SPX, XAU
    weights = {"BTCUSDT": 0.25, "ETHUSDT": 0.25, "SPX": 0.25, "XAU": 0.25}

    portfolio_equity = 100000.0
    stress_results = risk_calc.run_portfolio_stress_test(weights, portfolio_equity)

    # Verify scenarios exist and are calculated correctly
    assert "2008_GFC" in stress_results, "2008_GFC scenario is missing"
    assert "COVID_CRASH_2020" in stress_results, "COVID_CRASH_2020 scenario is missing"

    # Calculate GFC returns: 0.25 * (-0.65) + 0.25 * (-0.70) + 0.25 * (-0.40) + 0.25 * (0.10)
    # Return = 0.25 * (-0.65 - 0.70 - 0.40 + 0.10) = 0.25 * (-1.65) = -0.4125 (-41.25%)
    expected_gfc_return = -0.4125
    expected_gfc_usd = -41250.0

    assert (
        abs(stress_results["2008_GFC"]["scenario_shock"] - expected_gfc_return) < 1e-4
    ), f"GFC stress returns error: {stress_results['2008_GFC']['scenario_shock']}"
    assert (
        abs(stress_results["2008_GFC"]["usd_impact"] - expected_gfc_usd) < 1.0
    ), f"GFC USD impact error: {stress_results['2008_GFC']['usd_impact']}"


if __name__ == "__main__":
    print("Starting MSPE Risk Analytics Layer Unit Test Suite...")
    try:
        test_returns_computation()
        test_var_and_expected_shortfall()
        test_maximum_drawdown()
        test_sharpe_and_sortino()
        test_systemic_beta_alpha()
        test_correlation_matrix()
        test_stress_testing()
        print(
            "\nSUCCESS: All quantitative risk calculations, ratios, systemic indices, and stress test shocks passed validations!"
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
