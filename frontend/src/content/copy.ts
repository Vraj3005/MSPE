export const copy = {
  // Global Header
  portalHeader: "Market Surface Projection Engine",
  
  // Hero Dashboard
  heroTitle: "Market Surface Projection Engine",
  heroSubtitle: "A full-stack market projection dashboard that shows possible future price ranges, downside risk, and bear/base/bull scenarios using Python forecasting, Monte Carlo simulation, and risk analytics.",
  
  // Explanation card
  explanationTitle: "What is MSPE?",
  explanationBody: "Instead of predicting one exact price, MSPE simulates many possible future paths and summarizes them into simple scenarios: Bear Case (downside limit), Base Case (most likely trend), and Bull Case (upside target).",
  
  // Pipeline steps
  pipelineTitle: "How MSPE analyzes the market",
  pipelineStep1: "Step 1: Collect market prices",
  pipelineStep1Desc: "Queries active pricing feeds for cryptocurrency, equity indices, and gold benchmarks.",
  pipelineStep2: "Step 2: Estimate possible future price ranges",
  pipelineStep2Desc: "Uses historical averages and forecasting models to project Bear, Base, and Bull boundaries.",
  pipelineStep3: "Step 3: Measure downside risk",
  pipelineStep3Desc: "Runs historical Value at Risk (VaR) and Conditional VaR (CVaR) simulations to estimate worst-case crash scenarios.",
  
  // Glossary Definitions (1-2 simple sentences)
  glossary: {
    monteCarlo: {
      name: "Monte Carlo Simulation",
      definition: "A mathematical simulation method that generates thousands of random future price paths to calculate the likelihood of different outcomes."
    },
    bearCase: {
      name: "Bear Case (Downside)",
      definition: "The downside scenario representing a bad market outcome, where there is only a 10% chance that the price will drop below this level."
    },
    baseCase: {
      name: "Base Case (Median)",
      definition: "The median or most likely price scenario, representing the middle pathway of all simulated outcomes."
    },
    bullCase: {
      name: "Bull Case (Upside)",
      definition: "The upside scenario representing a very positive market outcome, where there is only a 10% chance that the price will rise above this level."
    },
    var: {
      name: "VaR — estimated worst-case loss threshold",
      definition: "The maximum estimated loss threshold you can expect to experience on a bad day at a 95% confidence level."
    },
    cvar: {
      name: "CVaR — average loss in the worst-case zone",
      definition: "The average estimated loss in the worst-case zone (the bottom 5% of outcomes), representing the severity of a true market crash."
    },
    volatility: {
      name: "Volatility",
      definition: "A measure of how much an asset's price fluctuates up and down over time, indicating the stability or riskiness of the market."
    },
    drawdown: {
      name: "Worst Historical Drop (Drawdown)",
      definition: "The percentage drop from an asset's peak price to its lowest point, representing the worst historical peak-to-trough decline."
    },
    riskScore: {
      name: "Risk Score (0 - 100)",
      definition: "A simplified rating from 0 to 100 that combines volatility and drawdown to help you compare the risk levels of different assets."
    },
    probabilityOfLoss: {
      name: "Probability of Loss",
      definition: "The calculated chance that the asset's price will end up lower than its current close at the end of the simulation horizon."
    }
  },

  // Tooltips & Helpers
  tooltips: {
    volatilityRating: "A score combining standard deviation and drawdown, graded from Low to Extreme.",
    dailyDownside: "The estimated maximum drop you could expect on a bad day with 95% confidence (1-Day Value at Risk).",
    averageCrash: "The average expected loss in the worst 5% of market sessions (Conditional Value at Risk).",
    worstDrop: "The worst peak-to-trough historical drop recorded for this asset over the lookback window.",
    marketRead: "A plain-language read of the asset's current trend and volatility parameters.",
    howStrong: "How strong this reading is: derived from return drift relative to historical lookbacks."
  },

  // Asset Cards & Layout Titles
  titles: {
    comparisonGrid: "Markets Analyzed & Scenarios (Select Asset to View Details)",
    outlooksChart: "30-Day Scenario Price Outlook & Monte Carlo Pathways",
    outlooksChartDesc: "Statistical boundaries and 5 sample path simulations",
    tailRiskControls: "Tail Risk Controls",
    stressShocks: "Estimated Asset Performance Shocks in Market Crashes ($100K Baseline)",
    methodologyTitle: "How Projections & Risks Are Calculated",
    methodologyProjections: "1. Projections Calculation",
    methodologyMonteCarlo: "2. Monte Carlo Definition",
    methodologyVaR: "3. Value at Risk (VaR)",
    limitationsTitle: "Engine Modeling Limitations"
  }
};
