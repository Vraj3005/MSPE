import os
import sys
import numpy as np

# Add workspace root directory to path so script runs standalone
sys.path.append(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)

from backend.quant.simulation.monte_carlo import MonteCarloSimulator


def test_path_generation():
    print("  - Running Monte Carlo paths generation verification...")
    spot = 100.0
    drift = 0.05
    vol = 0.20
    num_paths = 10000
    steps = 7

    simulator = MonteCarloSimulator(
        spot=spot, drift=drift, volatility=vol, num_paths=num_paths, steps=steps
    )
    paths = simulator.generate_paths()

    # 1. Assert shape
    assert paths.shape == (
        num_paths,
        steps + 1,
    ), f"Unexpected shape of paths matrix: {paths.shape}"

    # 2. Assert initial spot bounds
    assert np.allclose(paths[:, 0], spot), "Initial step price must match spot exactly"

    # 3. Assert paths contain valid positive price coordinates
    assert np.all(paths > 0.0), "Price simulation paths must strictly exceed 0.0"


def test_quantile_scenarios():
    print("  - Running confidence quantile scenarios validation...")
    spot = 100.0
    simulator = MonteCarloSimulator(
        spot=spot, drift=0.05, volatility=0.20, num_paths=10000, steps=7
    )
    paths = simulator.generate_paths()

    scenarios = simulator.extract_scenarios(paths)

    bear = scenarios["bear_scenario"]
    base = scenarios["base_scenario"]
    bull = scenarios["bull_scenario"]

    # Assert dimensions
    assert len(bear) == 8
    assert len(base) == 8
    assert len(bull) == 8

    # Assert start constraints
    assert bear[0] == spot
    assert base[0] == spot
    assert bull[0] == spot

    # Assert strict scenario inequalities: Bear (p10) < Base (p50) < Bull (p90)
    for t in range(1, 8):
        assert bear[t] < base[t], f"Bear path exceeded Base path at step {t}"
        assert base[t] < bull[t], f"Base path exceeded Bull path at step {t}"


def test_kde_density_mesh():
    print("  - Running 3D density solver and Scipy KDE grid validation...")
    simulator = MonteCarloSimulator(
        spot=100.0, drift=0.05, volatility=0.20, num_paths=10000, steps=7
    )
    paths = simulator.generate_paths()

    critical_steps = [1, 3, 7]
    grids = simulator.calculate_density_grid(
        paths, step_indices=critical_steps, grid_points=20
    )

    assert len(grids) == 3, f"Expected 3 steps density grids, got {len(grids)}"

    for grid in grids:
        assert grid["step"] in critical_steps
        prices = grid["prices"]
        densities = grid["densities"]

        # Verify Price coordinate grids
        assert len(prices) == 20
        assert len(densities) == 20

        # Verify density values are positive
        assert np.all(densities >= 0.0), "PDF density evaluations must be non-negative"

        # Verify quantiles bounds are successfully mapped
        assert grid["p10_price"] < grid["p50_price"]
        assert grid["p50_price"] < grid["p90_price"]


if __name__ == "__main__":
    print("Starting MSPE Surface Projection Unit Test Suite...")
    try:
        test_path_generation()
        test_quantile_scenarios()
        test_kde_density_mesh()
        print(
            "\nSUCCESS: All Monte Carlo simulation and continuous 3D density calculations passed validations!"
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
