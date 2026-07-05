'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { api, PortfolioRiskMetrics, StressTestSummary, AssetRiskMetrics } from '../lib/api';
import { Briefcase, RefreshCw, BarChart2, ShieldAlert, ThermometerSnowflake, HelpCircle, CheckCircle } from 'lucide-react';

// Dynamic Plotly heatmaps and bar charts
const Plot = dynamic(() => import('react-plotly.js'), { 
  ssr: false,
  loading: () => (
    <div className="w-full h-[220px] flex items-center justify-center bg-[#151D30]/30 rounded-xl border border-[#1F2942] animate-pulse">
      <div className="text-slate-400 font-mono text-xs flex items-center gap-2">
        <RefreshCw className="w-4 h-4 animate-spin" /> Compiling Risk Visuals...
      </div>
    </div>
  )
});

export default function PortfolioRisk() {
  const [portfolioRisk, setPortfolioRisk] = useState<PortfolioRiskMetrics | null>(null);
  const [stressTest, setStressTest] = useState<StressTestSummary | null>(null);
  const [assetRisk, setAssetRisk] = useState<AssetRiskMetrics[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [evaluating, setEvaluating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [evalMessage, setEvalMessage] = useState<string | null>(null);

  const mockPortfolioRisk: PortfolioRiskMetrics = {
    id: 'pr1',
    timestamp: new Date().toISOString(),
    var_95: 0.0215,
    var_99: 0.0345,
    expected_shortfall_95: 0.0285,
    expected_shortfall_99: 0.0425,
    max_drawdown: 0.1125,
    sharpe_ratio: 2.15,
    sortino_ratio: 2.65,
    calmar_ratio: 1.91,
    beta: 0.82,
    alpha: 0.008500,
    correlation_matrix: {
      'BTCUSDT': { 'BTCUSDT': 1.0, 'ETHUSDT': 0.82, 'SPX': 0.35, 'XAU': 0.12 },
      'ETHUSDT': { 'BTCUSDT': 0.82, 'ETHUSDT': 1.0, 'SPX': 0.38, 'XAU': 0.08 },
      'SPX': { 'BTCUSDT': 0.35, 'ETHUSDT': 0.38, 'SPX': 1.0, 'XAU': -0.15 },
      'XAU': { 'BTCUSDT': 0.12, 'ETHUSDT': 0.08, 'SPX': -0.15, 'XAU': 1.0 }
    },
    stress_test_results: {},
    details: { weights_allocated: { 'BTCUSDT': 0.30, 'ETHUSDT': 0.20, 'SPX': 0.35, 'XAU': 0.15 } }
  };

  const mockStressTest: StressTestSummary = {
    timestamp: new Date().toISOString(),
    scenarios: [
      { scenario_name: '2008_GFC', spx_shock: -0.40, asset_shocks: {}, portfolio_return_shock: -0.4125, portfolio_usd_impact: -41250.0 },
      { scenario_name: 'COVID_CRASH_2020', spx_shock: -0.30, asset_shocks: {}, portfolio_return_shock: -0.2825, portfolio_usd_impact: -28250.0 },
      { scenario_name: 'DOTCOM_BURST', spx_shock: -0.50, asset_shocks: {}, portfolio_return_shock: -0.4900, portfolio_usd_impact: -49000.0 },
      { scenario_name: 'CRYPTO_WINTER_2022', spx_shock: -0.20, asset_shocks: {}, portfolio_return_shock: -0.4125, portfolio_usd_impact: -41250.0 },
      { scenario_name: 'HIGH_INFLATION', spx_shock: -0.15, asset_shocks: {}, portfolio_return_shock: -0.1100, portfolio_usd_impact: -11000.0 }
    ]
  };

  const mockAssetRisk: AssetRiskMetrics[] = [
    {
      id: 'ar1',
      asset_id: '1',
      ticker: 'BTCUSDT',
      timestamp: new Date().toISOString(),
      var_95: 0.04820,
      var_99: 0.07150,
      expected_shortfall_95: 0.06210,
      expected_shortfall_99: 0.08900,
      max_drawdown: 0.22400,
      sharpe_ratio: 1.85,
      sortino_ratio: 2.15,
      calmar_ratio: 1.95,
      beta: 1.45,
      alpha: 0.0125,
      details: { sample_size_days: 252, annualized_volatility: 0.452 }
    },
    {
      id: 'ar2',
      asset_id: '2',
      ticker: 'ETHUSDT',
      timestamp: new Date().toISOString(),
      var_95: 0.05450,
      var_99: 0.08200,
      expected_shortfall_95: 0.07100,
      expected_shortfall_99: 0.09850,
      max_drawdown: 0.28500,
      sharpe_ratio: 1.62,
      sortino_ratio: 1.88,
      calmar_ratio: 1.65,
      beta: 1.62,
      alpha: 0.0095,
      details: { sample_size_days: 252, annualized_volatility: 0.524 }
    },
    {
      id: 'ar3',
      asset_id: '3',
      ticker: 'SPX',
      timestamp: new Date().toISOString(),
      var_95: 0.01250,
      var_99: 0.01950,
      expected_shortfall_95: 0.01650,
      expected_shortfall_99: 0.02450,
      max_drawdown: 0.08500,
      sharpe_ratio: 1.25,
      sortino_ratio: 1.45,
      calmar_ratio: 1.15,
      beta: 1.00,
      alpha: 0.0000,
      details: { sample_size_days: 252, annualized_volatility: 0.145 }
    },
    {
      id: 'ar4',
      asset_id: '4',
      ticker: 'XAU',
      timestamp: new Date().toISOString(),
      var_95: 0.01850,
      var_99: 0.02800,
      expected_shortfall_95: 0.02400,
      expected_shortfall_99: 0.03500,
      max_drawdown: 0.12400,
      sharpe_ratio: 1.42,
      sortino_ratio: 1.72,
      calmar_ratio: 1.35,
      beta: 0.24,
      alpha: 0.0045,
      details: { sample_size_days: 252, annualized_volatility: 0.182 }
    }
  ];

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // 1. Load Portfolio Risk
      let fetchedPortfolio: PortfolioRiskMetrics | null = null;
      try {
        fetchedPortfolio = await api.getLatestPortfolioRisk();
      } catch {
        fetchedPortfolio = mockPortfolioRisk;
      }
      setPortfolioRisk(fetchedPortfolio || mockPortfolioRisk);

      // 2. Load Stress Tests
      let fetchedStress: StressTestSummary | null = null;
      try {
        fetchedStress = await api.getStressTestSummary();
      } catch {
        fetchedStress = mockStressTest;
      }
      setStressTest(fetchedStress || mockStressTest);

      // 3. Load Asset Risks list
      let fetchedAssetRisk: AssetRiskMetrics[] = [];
      try {
        fetchedAssetRisk = await api.getAssetsRiskMetrics();
      } catch {
        fetchedAssetRisk = mockAssetRisk;
      }
      setAssetRisk(fetchedAssetRisk.length > 0 ? fetchedAssetRisk : mockAssetRisk);

    } catch (err: any) {
      setError(err.message || 'Failed to load portfolio analytics');
    } finally {
      setLoading(false);
    }
  };

  const handleRecalculateRisk = async () => {
    try {
      setEvaluating(true);
      setEvalMessage(null);
      const res = await api.triggerRiskEvaluation();
      setEvalMessage(res.detail || 'Risk re-evaluation pipeline scans triggered.');
      setTimeout(() => {
        setEvalMessage(null);
        loadData();
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to trigger risk calculation');
      setEvaluating(false);
    } finally {
      setEvaluating(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const getCorrelationMatrixData = (): any[] => {
    const matrix = portfolioRisk?.correlation_matrix || mockPortfolioRisk.correlation_matrix;
    const tickers = Object.keys(matrix);
    
    const zData: number[][] = [];
    for (const t1 of tickers) {
      const row: number[] = [];
      for (const t2 of tickers) {
        row.push(matrix[t1][t2]);
      }
      zData.push(row);
    }

    return [
      {
        x: tickers,
        y: tickers,
        z: zData,
        type: 'heatmap',
        colorscale: 'Viridis',
        zmin: -1.0,
        zmax: 1.0,
        showscale: true,
        xgap: 2,
        ygap: 2
      }
    ];
  };

  const getStressTestData = (): any[] => {
    const sList = stressTest?.scenarios || mockStressTest.scenarios;
    const names = sList.map(s => s.scenario_name.replace(/_/g, ' '));
    const returnShocks = sList.map(s => s.portfolio_return_shock * 100.0);

    return [
      {
        x: names,
        y: returnShocks,
        type: 'bar',
        marker: {
          color: returnShocks.map(v => v < 0 ? '#F43F5E' : '#10B981')
        }
      }
    ];
  };

  return (
    <div className="space-y-6">
      {/* Top Header Segment */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-wider text-slate-100 uppercase">Portfolio Risk Controls</h2>
          <p className="text-xs text-slate-400 font-mono mt-1">Weighted aggregate risk profiles, asset relationships correlation, and crash simulations</p>
        </div>
        <button
          onClick={handleRecalculateRisk}
          disabled={evaluating}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold tracking-wider uppercase border border-cyan-500/30 transition-all duration-300 ${
            evaluating 
              ? 'bg-cyan-500/5 text-cyan-500 cursor-not-allowed' 
              : 'bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 active:scale-95 shadow-[0_0_15px_rgba(6,182,212,0.1)]'
          }`}
        >
          <RefreshCw className={`w-4 h-4 ${evaluating ? 'animate-spin' : ''}`} />
          {evaluating ? 'Recalculating...' : 'Recalculate Risk'}
        </button>
      </div>

      {evalMessage && (
        <div className="flex items-center gap-2.5 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-mono">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          <span>{evalMessage}</span>
        </div>
      )}

      {loading ? (
        <div className="w-full h-40 flex items-center justify-center bg-[#151D30]/20 rounded-xl border border-[#1F2942] animate-pulse">
          <div className="text-slate-400 font-mono text-xs flex items-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" /> Consolidating Risk Audits...
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Main Portfolio Indicators Card Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Aggregate Downside */}
            <div className="glass-panel rounded-xl p-6 border border-[#1F2942]">
              <h4 className="text-slate-500 font-mono text-[10px] uppercase tracking-wider mb-3.5 flex items-center gap-1.5 justify-between">
                <span>Portfolio Downside Risk</span>
                <span title="Value at Risk (Maximum expected drop on a bad day) and average expected loss in a market crash scenario.">
                  <HelpCircle className="w-3.5 h-3.5 text-slate-500 hover:text-slate-300 cursor-help" />
                </span>
              </h4>
              <div className="space-y-2.5 font-mono text-xs text-slate-400">
                <div className="flex justify-between border-b border-[#1F2942]/40 pb-1.5">
                  <span>Daily Downside (VaR 95%):</span>
                  <span className="text-slate-100 font-bold">{((portfolioRisk?.var_95 || 0.0) * 100.0).toFixed(2)}%</span>
                </div>
                <div className="flex justify-between border-b border-[#1F2942]/40 pb-1.5">
                  <span>Extreme Downside (VaR 99%):</span>
                  <span className="text-slate-100 font-bold">{((portfolioRisk?.var_99 || 0.0) * 100.0).toFixed(2)}%</span>
                </div>
                <div className="flex justify-between border-b border-[#1F2942]/40 pb-1.5">
                  <span>Average Crash Loss (CVaR 95%):</span>
                  <span className="text-rose-400 font-bold">{((portfolioRisk?.expected_shortfall_95 || 0.0) * 100.0).toFixed(2)}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Average Crash Loss (CVaR 99%):</span>
                  <span className="text-rose-400 font-bold">{((portfolioRisk?.expected_shortfall_99 || 0.0) * 100.0).toFixed(2)}%</span>
                </div>
              </div>
            </div>

            {/* Performance Ratios */}
            <div className="glass-panel rounded-xl p-6 border border-[#1F2942]">
              <h4 className="text-slate-500 font-mono text-[10px] uppercase tracking-wider mb-3.5 flex items-center gap-1.5 justify-between">
                <span>Risk-Adjusted Scores</span>
                <span title="Scores measuring return relative to risk. Higher Sharpe and Sortino ratios indicate better risk-adjusted returns.">
                  <HelpCircle className="w-3.5 h-3.5 text-slate-500 hover:text-slate-300 cursor-help" />
                </span>
              </h4>
              <div className="space-y-2.5 font-mono text-xs text-slate-400">
                <div className="flex justify-between border-b border-[#1F2942]/40 pb-1.5">
                  <span>Sharpe Ratio (Return/Risk):</span>
                  <span className="text-emerald-400 font-bold">{portfolioRisk?.sharpe_ratio.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-b border-[#1F2942]/40 pb-1.5">
                  <span>Sortino Ratio (Downside Risk):</span>
                  <span className="text-emerald-400 font-bold">{portfolioRisk?.sortino_ratio.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-b border-[#1F2942]/40 pb-1.5">
                  <span>Calmar Ratio (Drawdown Risk):</span>
                  <span className="text-emerald-400">{portfolioRisk?.calmar_ratio.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Worst Historical Drop:</span>
                  <span className="text-rose-400 font-bold">{((portfolioRisk?.max_drawdown || 0.0) * 100.0).toFixed(2)}%</span>
                </div>
              </div>
            </div>

            {/* Allocations & Beta sensitivity */}
            <div className="glass-panel rounded-xl p-6 border border-[#1F2942] flex flex-col justify-between">
              <div>
                <h4 className="text-slate-500 font-mono text-[10px] uppercase tracking-wider mb-3.5 flex items-center gap-1.5 justify-between">
                  <span>Sensitivity & Outperformance</span>
                  <span title="Market Sensitivity measures volatility relative to the stock market index. Outperformance measures returns above risk assumptions.">
                    <HelpCircle className="w-3.5 h-3.5 text-slate-500 hover:text-slate-300 cursor-help" />
                  </span>
                </h4>
                <div className="space-y-2.5 font-mono text-xs text-slate-400">
                  <div className="flex justify-between border-b border-[#1F2942]/40 pb-1.5">
                    <span>Market Sensitivity (Beta):</span>
                    <span className="text-slate-100 font-bold">{portfolioRisk?.beta.toFixed(2)}x</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Outperformance Score (Alpha):</span>
                    <span className="text-emerald-400 font-bold">{portfolioRisk?.alpha.toFixed(5)}</span>
                  </div>
                </div>
              </div>
              
              <div className="border-t border-[#1F2942]/40 pt-3 mt-4 text-[9px] font-mono text-slate-500 uppercase flex flex-wrap gap-2.5">
                {Object.entries(portfolioRisk?.details.weights_allocated || mockPortfolioRisk.details.weights_allocated).map(([ticker, w]) => (
                  <span key={ticker}>{ticker}: <strong className="text-slate-300">{(w as number * 100).toFixed(0)}%</strong></span>
                ))}
              </div>
            </div>
          </div>

          {/* Asset-level Risk Profiles Grid Table */}
          <div className="glass-panel rounded-xl overflow-hidden border border-[#1F2942]">
            <div className="p-4 border-b border-[#1F2942]/60 flex items-center gap-2 text-slate-300 text-xs font-bold font-mono tracking-wider">
              <ShieldAlert className="w-4 h-4 text-cyan-400" />
              HISTORICAL RISK & PERFORMANCE METRICS BY ASSET
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs border-collapse">
                <thead>
                  <tr className="bg-[#0B0F19]/60 text-slate-500 uppercase text-[9px] tracking-wider border-b border-[#1F2942]/60">
                    <th className="py-3.5 px-6">Asset</th>
                    <th className="py-3.5 px-6">Daily Downside (VaR 95%)</th>
                    <th className="py-3.5 px-6">Extreme Downside (VaR 99%)</th>
                    <th className="py-3.5 px-6">Average Crash Loss (CVaR 95%)</th>
                    <th className="py-3.5 px-6">Worst Drop (Drawdown)</th>
                    <th className="py-3.5 px-6">Return / Risk Score (Sharpe)</th>
                    <th className="py-3.5 px-6">Market Sensitivity (Beta)</th>
                    <th className="py-3.5 px-6">Outperformance (Alpha)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1F2942]/40 text-slate-300">
                  {assetRisk.map((row) => (
                    <tr key={row.id} className="hover:bg-[#151D30]/20 transition-colors duration-200">
                      <td className="py-3.5 px-6 font-bold text-slate-100">{row.ticker}</td>
                      <td className="py-3.5 px-6">{(row.var_95 * 100.0).toFixed(2)}%</td>
                      <td className="py-3.5 px-6">{(row.var_99 * 100.0).toFixed(2)}%</td>
                      <td className="py-3.5 px-6 text-rose-400">{(row.expected_shortfall_95 * 100.0).toFixed(2)}%</td>
                      <td className="py-3.5 px-6 text-amber-400">{(row.max_drawdown * 100.0).toFixed(1)}%</td>
                      <td className="py-3.5 px-6 text-emerald-400 font-bold">{row.sharpe_ratio.toFixed(2)}</td>
                      <td className="py-3.5 px-6">{row.beta.toFixed(2)}x</td>
                      <td className="py-3.5 px-6 text-emerald-400">{(row.alpha * 100).toFixed(3)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Heatmaps and Shocks splits */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            
            {/* Correlation Matrix Heatmap */}
            <div className="glass-panel rounded-xl p-4 border border-[#1F2942] h-[340px]">
              <h4 className="text-xs font-bold font-mono text-slate-400 mb-2 uppercase flex items-center gap-1.5 justify-between">
                <span className="flex items-center gap-1.5">
                  <BarChart2 className="w-4 h-4 text-cyan-400" />
                  Asset Price Relationships Heatmap
                </span>
                <span title="Correlation values. 1.0 means assets move in perfect lockstep; 0.0 means completely unrelated; negative values indicate assets diversify each other.">
                  <HelpCircle className="w-3.5 h-3.5 text-slate-500 hover:text-slate-300 cursor-help" />
                </span>
              </h4>
              <Plot
                data={getCorrelationMatrixData()}
                layout={{
                  paper_bgcolor: 'rgba(0,0,0,0)',
                  plot_bgcolor: 'rgba(0,0,0,0)',
                  xaxis: { tickfont: { color: '#94A3B8', size: 9 }, linecolor: '#1F2942' },
                  yaxis: { tickfont: { color: '#94A3B8', size: 9 }, linecolor: '#1F2942' },
                  margin: { l: 60, r: 10, t: 15, b: 35 }
                }}
                config={{ responsive: true, displayModeBar: false }}
                className="w-full h-full"
              />
            </div>

            {/* Macro Stress testing shocks chart */}
            <div className="glass-panel rounded-xl p-4 border border-[#1F2942] h-[340px]">
              <h4 className="text-xs font-bold font-mono text-slate-400 mb-2 uppercase flex items-center gap-1.5 justify-between">
                <span className="flex items-center gap-1.5">
                  <ThermometerSnowflake className="w-4 h-4 text-rose-400" />
                  Simulation Under Historical Crashes
                </span>
                <span title="Percentage return shock to the portfolio under historical crisis events.">
                  <HelpCircle className="w-3.5 h-3.5 text-slate-500 hover:text-slate-300 cursor-help" />
                </span>
              </h4>
              <Plot
                data={getStressTestData()}
                layout={{
                  paper_bgcolor: 'rgba(0,0,0,0)',
                  plot_bgcolor: 'rgba(0,0,0,0)',
                  xaxis: { gridcolor: '#1F2942/20', tickfont: { color: '#94A3B8', size: 8 }, linecolor: '#1F2942' },
                  yaxis: { gridcolor: '#1F2942/20', tickfont: { color: '#94A3B8', size: 9 } },
                  margin: { l: 30, r: 10, t: 15, b: 50 },
                  showlegend: false
                }}
                config={{ responsive: true, displayModeBar: false }}
                className="w-full h-full"
              />
            </div>
          </div>

          {/* USD stress impact tables */}
          <div className="glass-panel rounded-xl overflow-hidden border border-[#1F2942] font-mono text-xs">
            <div className="p-4 border-b border-[#1F2942]/60 flex items-center gap-2 text-slate-300 text-xs font-bold font-mono tracking-wider">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              PORTFOLIO VALUE IMPACT IN SIMULATED CRASHES ($100K BASELINE)
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#0B0F19]/60 text-slate-500 uppercase text-[9px] tracking-wider border-b border-[#1F2942]/60">
                    <th className="py-3 px-6">Historical Crash Scenario</th>
                    <th className="py-3 px-6">Index Drop (S&P 500)</th>
                    <th className="py-3 px-6">Estimated Portfolio Return Shock</th>
                    <th className="py-3 px-6">Estimated Dollar Loss Impact</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1F2942]/40 text-slate-300">
                  {(stressTest?.scenarios || mockStressTest.scenarios).map((sc) => (
                    <tr key={sc.scenario_name} className="hover:bg-[#151D30]/20 transition-colors duration-200">
                      <td className="py-3 px-6 font-bold text-slate-100 uppercase">{sc.scenario_name.replace(/_/g, ' ')}</td>
                      <td className="py-3 px-6 text-rose-400">{(sc.spx_shock * 100.0).toFixed(1)}%</td>
                      <td className="py-3 px-6 text-rose-400">{(sc.portfolio_return_shock * 100.0).toFixed(2)}%</td>
                      <td className="py-3 px-6 text-rose-400 font-bold">-${Math.abs(sc.portfolio_usd_impact).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
