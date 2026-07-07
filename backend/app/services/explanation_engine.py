from backend.app.schemas.explanations import ExplainabilityLayer

class ExplanationEngine:
    """Quantitative explanation engine to convert technical model results and risks
    into recruiter-friendly, plain-English explanations.
    """
    
    @staticmethod
    def generate_explainability_layer(
        symbol: str,
        expected_return_7d: float,
        base_price_7d: float,
        bear_price_7d: float,
        bull_price_7d: float,
        probability_of_loss_7d: float,
        selected_model: str,
        calibration_score: float,
        interval_coverage: float,
        directional_accuracy: float,
        baseline_beaten: bool,
        volatility: float,
        risk_score: float,
        risk_level: str,
        var_95: float,
        cvar_95: float,
        drawdown: float,
    ) -> ExplainabilityLayer:
        """Generates an explainability layer containing answers to four key user questions."""
        
        # 1. Summary: What does this number mean?
        direction = "positive" if expected_return_7d >= 0 else "negative"
        ret_pct = expected_return_7d * 100
        vol_level = "elevated" if volatility > 0.30 else "moderate" if volatility > 0.15 else "low"
        
        summary = (
            f"{symbol}'s 7-day base case is {direction} at ${base_price_7d:,.2f} ({ret_pct:+.1f}%), "
            f"but the probability of loss remains at {probability_of_loss_7d:.0%} because "
            f"annualized volatility ({volatility:.1%}) is {vol_level}."
        )
        
        # 2. Model Reason: Why did the model produce it?
        model_key = selected_model.lower()
        if "xgboost" in model_key:
            model_reason = (
                "MSPE selected XGBoost because recent non-linear relationships between "
                "lagged returns and volatility features proved more predictive than "
                "simple linear or historical averages in walk-forward test periods."
            )
        elif "arima" in model_key:
            model_reason = (
                "MSPE selected ARIMA because historical momentum and autoregressive price "
                "dependencies were dominant over noise in recent test periods."
            )
        elif "garch" in model_key:
            model_reason = (
                "MSPE selected GARCH Monte Carlo because recent volatility clustering "
                "made volatility-based simulation more reliable than simple historical averages."
            )
        elif "ewma" in model_key:
            model_reason = (
                "MSPE selected EWMA because it weighs recent observations more heavily, "
                "allowing rapid adaptation to recent volatility shocks."
            )
        elif "last_price_baseline" in model_key:
            model_reason = (
                "MSPE fell back to the naive Last Price Baseline because the asset's daily path "
                "resembles a random walk, making spot price tracking the most robust choice."
            )
        else:
            model_reason = (
                f"MSPE selected {selected_model} because it produced the lowest forecast "
                f"error and best out-of-sample calibration during recent walk-forward testing."
            )
            
        # 3. Risk Reason: How risky is it?
        risk_reason = (
            f"Risk is classified as {risk_level} (score {risk_score:.0f}/100) because "
            f"the 1-day Value at Risk (VaR) is {var_95:.1%}, meaning there is a 5% chance of daily losses "
            f"exceeding this amount, while the Conditional VaR (CVaR) shows the average crash depth is {cvar_95:.1%}."
        )
        
        # 4. Baseline Comparison: Why is it better than a simple guess?
        if baseline_beaten:
            baseline_comparison = (
                f"Compared with a simple last-price baseline, MSPE's selected model "
                f"produced better interval coverage ({interval_coverage:.0%}) in recent walk-forward "
                f"backtests, proving that its dynamic projections capture trend shifts better than a naive guess."
            )
        else:
            baseline_comparison = (
                f"At this horizon, naive baseline models performed at least as well as advanced methods. "
                f"However, MSPE still provides a structured range projection (capturing actual prices "
                f"{interval_coverage:.0%} of the time) that a single last-price guess cannot offer."
            )
            
        # 5. Reliability Label
        if calibration_score >= 0.75 and interval_coverage >= 0.75:
            reliability_label = "High"
        elif calibration_score >= 0.50 and interval_coverage >= 0.60:
            reliability_label = "Medium"
        else:
            reliability_label = "Low"
            
        return ExplainabilityLayer(
            summary=summary,
            model_reason=model_reason,
            risk_reason=risk_reason,
            baseline_comparison=baseline_comparison,
            reliability_label=reliability_label,
        )
