from pydantic import BaseModel

class ExplainabilityLayer(BaseModel):
    """Explainability layer mapping technical model results to plain-English visitor questions.
    
    Answers four core questions:
    1. What does this number mean? (summary)
    2. Why did the model produce it? (model_reason)
    3. How risky/reliable is it? (risk_reason / reliability_label)
    4. Why is it better than a simple guess? (baseline_comparison)
    """
    summary: str
    model_reason: str
    risk_reason: str
    baseline_comparison: str
    reliability_label: str  # "High" / "Medium" / "Low"
