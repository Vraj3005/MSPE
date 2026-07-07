export interface GlossaryItem {
  term: string;
  definition: string;
}

export const glossary: Record<string, GlossaryItem> = {
  bearCase: {
    term: "Bear Case (Downside)",
    definition: "The downside boundary (typically the 10th percentile of simulated paths) representing a pessimistic but statistically plausible target. There is only a 10% chance of the price dropping below this limit."
  },
  baseCase: {
    term: "Base Case (Median)",
    definition: "The median pathway of all simulations (50th percentile), representing the most likely expected price trajectory under current drift and volatility conditions."
  },
  bullCase: {
    term: "Bull Case (Upside)",
    definition: "The upside boundary (typically the 90th percentile of simulated paths) representing an optimistic target. There is only a 10% chance of the price rising above this limit."
  },
  probabilityOfLoss: {
    term: "Probability of Loss",
    definition: "The percentage of simulated future price paths that end below the current spot price, measuring the likelihood of a negative return."
  },
  var: {
    term: "Value at Risk (VaR)",
    definition: "The estimated maximum loss threshold expected over a 1-day horizon at a 95% confidence level. For example, a 95% VaR of 2% means there is a 5% chance of daily losses exceeding 2%."
  },
  cvar: {
    term: "Conditional Value at Risk (CVaR)",
    definition: "Also known as Expected Shortfall, CVaR measures the average loss expected in the worst-case tail scenarios (the bottom 5% of simulated paths), quantifying the severity of extreme crashes."
  },
  volatility: {
    term: "Volatility",
    definition: "A statistical measure of the dispersion of returns, reflecting how much and how quickly the asset's price fluctuates. Higher volatility indicates wider potential price ranges."
  },
  projectionRange: {
    term: "Projection Range",
    definition: "The interval between the bear and bull scenarios, capturing the statistical spread of future possible price levels at a given horizon."
  },
  monteCarlo: {
    term: "Monte Carlo Simulation",
    definition: "A computational algorithm that generates thousands of random future price paths based on historical returns and volatility to simulate and map the distribution of outcomes."
  },
  modelReliability: {
    term: "Model Reliability",
    definition: "An assessment (High, Medium, Low) of how well the forecasting model performed in walk-forward backtesting, based on interval coverage and calibration scores."
  }
};
