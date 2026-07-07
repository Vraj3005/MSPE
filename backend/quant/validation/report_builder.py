"""
Report builder for MSPE validation results.

Generates:
- model_comparison.csv: All models × all horizons × all metrics
- asset_validation_summary.csv: One row per asset with user-facing metrics
- MSPE_MODEL_VALIDATION.md: Recruiter-readable validation report
"""

import csv
import io
from datetime import datetime, timezone
from typing import Dict, List

from backend.quant.validation.comparison import (
    FullComparisonResult,
    AssetComparisonResult,
    HorizonComparisonResult,
)


# ============================================================
# CSV builders
# ============================================================


def build_model_comparison_csv(result: FullComparisonResult) -> str:
    """Builds CSV with all models × all horizons × all assets.

    Columns: asset, horizon, model, mae, rmse, directional_accuracy,
             interval_coverage, var_breach_rate, band_width, calibration_score,
             is_selected, is_baseline
    """
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "asset", "horizon", "model", "mae", "rmse",
        "directional_accuracy", "interval_coverage", "var_breach_rate",
        "band_width", "calibration_score", "is_selected", "is_baseline",
    ])

    for sym, acr in result.assets.items():
        for label, hcr in acr.horizons.items():
            for mr in hcr.model_rankings:
                writer.writerow([
                    sym,
                    label,
                    mr.model_name,
                    f"{mr.mae:.6f}",
                    f"{mr.rmse:.6f}",
                    f"{mr.directional_accuracy:.4f}",
                    f"{mr.interval_coverage:.4f}",
                    f"{mr.var_breach_rate:.4f}",
                    f"{mr.band_width:.4f}",
                    f"{mr.calibration_score:.4f}",
                    "TRUE" if mr.model_name == hcr.best_model else "FALSE",
                    "TRUE" if mr.model_name in {
                        "last_price_baseline", "historical_mean_baseline",
                        "rolling_mean_baseline", "rolling_vol_baseline",
                    } else "FALSE",
                ])

    return output.getvalue()


def build_asset_summary_csv(result: FullComparisonResult) -> str:
    """Builds CSV with one row per asset showing user-facing metrics."""
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "asset", "projection_accuracy", "range_reliability",
        "risk_warning_quality", "baseline_improvement",
        "model_confidence", "horizons_tested", "horizons_beating_baseline",
        "overall_conclusion",
    ])

    for sym, acr in result.assets.items():
        um = acr.user_metrics
        horizons_beaten = sum(1 for h in acr.horizons.values() if h.baseline_beaten)

        writer.writerow([
            sym,
            um.projection_accuracy if um else "N/A",
            um.range_reliability if um else "N/A",
            um.risk_warning_quality if um else "N/A",
            um.baseline_improvement if um else "N/A",
            um.model_confidence if um else "Low",
            len(acr.horizons),
            horizons_beaten,
            acr.overall_conclusion[:200],
        ])

    return output.getvalue()


# ============================================================
# Markdown report builder
# ============================================================


def build_validation_markdown(result: FullComparisonResult) -> str:
    """Builds a recruiter-readable validation report in Markdown."""
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    lines = []

    lines.append("# MSPE Model Validation Report")
    lines.append(f"\n*Generated: {now}*")
    lines.append(f"\n*Data mode: {result.data_mode}*")
    lines.append("")
    lines.append("## What This Report Shows")
    lines.append("")
    lines.append("This report compares MSPE's projection engine against simple baselines")
    lines.append("to prove (or honestly admit) where the engine adds value.")
    lines.append("")
    lines.append("> **Key question**: Is MSPE better than just guessing the last price?")
    lines.append("")

    # Overall conclusion
    lines.append("## Overall Conclusion")
    lines.append("")
    lines.append(result.overall_conclusion)
    lines.append("")

    # User-facing metrics summary
    lines.append("## Validation Summary")
    lines.append("")
    lines.append("| Asset | Projection Accuracy | Range Reliability | Risk Warning | Baseline Improvement | Confidence |")
    lines.append("|:------|:-------------------:|:-----------------:|:------------:|:--------------------:|:----------:|")

    for sym, acr in result.assets.items():
        um = acr.user_metrics
        if um:
            lines.append(
                f"| **{sym}** | {um.projection_accuracy} | {um.range_reliability} "
                f"| {um.risk_warning_quality} | {um.baseline_improvement} | {um.model_confidence} |"
            )
        else:
            lines.append(f"| **{sym}** | N/A | N/A | N/A | N/A | Low |")

    lines.append("")

    # How to read these metrics
    lines.append("### What These Metrics Mean")
    lines.append("")
    lines.append("- **Projection Accuracy**: How close was the base-case projection to the actual price historically?")
    lines.append("- **Range Reliability**: How often did the actual price stay inside the projected bear–bull range?")
    lines.append("- **Risk Warning Quality**: How well did VaR warnings match actual large moves? (Good = VaR breaches close to expected 5%)")
    lines.append("- **Baseline Improvement**: How much better is MSPE vs. simply using the last known price?")
    lines.append("- **Confidence**: High/Medium/Low based on overall validation score.")
    lines.append("")

    # Per-asset details
    for sym, acr in result.assets.items():
        lines.append(f"---")
        lines.append(f"")
        lines.append(f"## {sym} — {acr.asset_name}")
        lines.append(f"")
        lines.append(f"### Conclusion")
        lines.append(f"")
        lines.append(acr.overall_conclusion)
        lines.append(f"")

        # Horizon comparison table
        lines.append(f"### Model Comparison by Horizon")
        lines.append(f"")
        lines.append("| Horizon | Best Model | Beats Baseline? | Calibration | Coverage | Direction | MAE |")
        lines.append("|:--------|:-----------|:---------------:|:-----------:|:--------:|:---------:|:---:|")

        for label, hcr in acr.horizons.items():
            if hcr.model_rankings:
                best = hcr.model_rankings[0]
                beaten = "✅ Yes" if hcr.baseline_beaten else "❌ No"
                lines.append(
                    f"| {label} | {hcr.best_model} | {beaten} "
                    f"| {best.calibration_score:.1%} | {best.interval_coverage:.0%} "
                    f"| {best.directional_accuracy:.0%} | {best.mae:.4f} |"
                )

        lines.append(f"")

        # Per-horizon conclusions
        for label, hcr in acr.horizons.items():
            lines.append(f"**{label}**: {hcr.conclusion}")
            lines.append(f"")

        # Full model ranking for 7D (most important)
        h7d = acr.horizons.get("7D")
        if h7d and len(h7d.model_rankings) > 1:
            lines.append(f"### Full Model Ranking (7-Day Horizon)")
            lines.append(f"")
            lines.append("| Rank | Model | Calibration | Coverage | Direction | MAE | Band Width |")
            lines.append("|:----:|:------|:-----------:|:--------:|:---------:|:---:|:----------:|")
            for i, mr in enumerate(h7d.model_rankings, 1):
                marker = " ⭐" if i == 1 else ""
                lines.append(
                    f"| {i} | {mr.model_name}{marker} | {mr.calibration_score:.1%} "
                    f"| {mr.interval_coverage:.0%} | {mr.directional_accuracy:.0%} "
                    f"| {mr.mae:.4f} | {mr.band_width:.1%} |"
                )
            lines.append(f"")

    # Limitations
    lines.append("---")
    lines.append("")
    lines.append("## Limitations")
    lines.append("")
    lines.append("- These results are from walk-forward backtesting on historical or synthetic data.")
    lines.append("- Past performance does not guarantee future results.")
    lines.append("- MSPE does not predict exact prices — it estimates ranges of possible outcomes.")
    lines.append("- When baselines perform better, we report it honestly.")
    lines.append("- Validation uses expanding-window methodology to prevent lookahead bias.")
    lines.append("- This is not financial advice.")
    lines.append("")

    return "\n".join(lines)


def build_plain_language_conclusion(result: FullComparisonResult) -> str:
    """Builds a single-paragraph plain-language conclusion."""
    return result.overall_conclusion
