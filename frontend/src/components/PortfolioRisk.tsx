'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { api, PortfolioRiskMetrics, StressTestSummary } from '../lib/api';
import { Briefcase, RefreshCw, BarChart2, ShieldAlert, ThermometerSnowflake } from 'lucide-react';

const Plot = dynamic(() => import('react-plotly.js'), { 
  ssr: false,
  loading: () => (
    <div className="w-full h-[250px] flex items-center justify-center bg-[#151D30]/30 rounded-xl border border-[#1F2942] animate-pulse">
      <div className="text-slate-400 font-mono text-xs flex items-center gap-2">
        <RefreshCw className="w-4 h-4 animate-spin" /> Rendering Advanced Matrix...
      </div>
    </div>
  )
});

export default function PortfolioRisk() {
  const [portfolioRisk, setPortfolioRisk] = useState<PortfolioRiskMetrics | null>(null);
  const [stressTest, setStressTest] = useState<StressTestSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

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

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load Portfolio Risk
      let fetchedPortfolio: PortfolioRiskMetrics | null = null;
      try {
        fetchedPortfolio = await api.getLatestPortfolioRisk();
      } catch {
        fetchedPortfolio = mockPortfolioRisk;
      }
      setPortfolioRisk(fetchedPortfolio || mockPortfolioRisk);

      // Load Stress Tests
      let fetchedStress: StressTestSummary | null = null;
      try {
        fetchedStress = await api.getStressTestSummary();
      } catch {
        fetchedStress = mockStressTest;
      }
      setStressTest(fetchedStress || mockStressTest);

    } catch (err: any) {
      setError(err.message || 'Failed to load portfolio analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Format Correlation Matrix Heatmap
  const getCorrelationMatrixData = (): any[] => {
    if (!portfolioRisk || !portfolioRisk.correlation_matrix) return [];
    const matrix = portfolioRisk.correlation_matrix;
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

  // Format Stress Test Shock Charts
  const getStressTestData = (): any[] => {
    if (!stressTest || !stressTest.scenarios) return [];
    
    const names = stressTest.scenarios.map(s => s.scenario_name.replace(/_/g, ' '));
    const returnShocks = stressTest.scenarios.map(s => s.portfolio_return_shock * 100.0); // pct

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
          <h2 className="text-xl font-bold tracking-wider text-slate-100 uppercase">Portfolio Analytics</h2>
          <p className="text-xs text-slate-400 font-mono mt-1">Weighted portfolio risk measures, returns correlation heatmaps, and macro stress tests</p>
        </div>
      </div>

      {loading ? (
        <div className="w-full h-40 flex items-center justify-center bg-[#151D30]/20 rounded-xl border border-[#1F2942] animate-pulse">
          <div className="text-slate-400 font-mono text-xs flex items-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" /> Aggregating Portfolio Analytics...
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Main Portfolio Indicators Card Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Aggregate VaR / ES */}
            <div className="glass-panel rounded-xl p-6 border border-[#1F2942]">
              <h4 className="text-slate-500 font-mono text-[10px] uppercase tracking-wider mb-3">Portfolio 1-Day VaR & ES</h4>
              <div className="space-y-2.5 font-mono text-sm">
                <div className="flex justify-between border-b border-[#1F2942]/40 pb-1.5">
                  <span className="text-slate-400">VaR (95%):</span>
                  <span className="text-slate-100 font-bold">{((portfolioRisk?.var_95 || 0.0) * 100.0).toFixed(2)}%</span>
                </div>
                <div className="flex justify-between border-b border-[#1F2942]/40 pb-1.5">
                  <span className="text-slate-400">VaR (99%):</span>
                  <span className="text-slate-100 font-bold">{((portfolioRisk?.var_99 || 0.0) * 100.0).toFixed(2)}%</span>
                </div>
                <div className="flex justify-between border-b border-[#1F2942]/40 pb-1.5">
                  <span className="text-slate-400">Expected Shortfall (95%):</span>
                  <span className="text-slate-100 font-bold">{((portfolioRisk?.expected_shortfall_95 || 0.0) * 100.0).toFixed(2)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Expected Shortfall (99%):</span>
                  <span className="text-slate-100 font-bold">{((portfolioRisk?.expected_shortfall_99 || 0.0) * 100.0).toFixed(2)}%</span>
                </div>
              </div>
            </div>

            {/* Performance Ratios */}
            <div className="glass-panel rounded-xl p-6 border border-[#1F2942]">
              <h4 className="text-slate-500 font-mono text-[10px] uppercase tracking-wider mb-3">Portfolio Performance Ratios</h4>
              <div className="space-y-2.5 font-mono text-sm">
                <div className="flex justify-between border-b border-[#1F2942]/40 pb-1.5">
                  <span className="text-slate-400">Sharpe Ratio (Annual):</span>
                  <span className="text-emerald-400 font-bold">{portfolioRisk?.sharpe_ratio.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-b border-[#1F2942]/40 pb-1.5">
                  <span className="text-slate-400">Sortino Ratio (Annual):</span>
                  <span className="text-emerald-400 font-bold">{portfolioRisk?.sortino_ratio.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-b border-[#1F2942]/40 pb-1.5">
                  <span className="text-slate-400">Calmar Ratio (Annual):</span>
                  <span className="text-emerald-400">{portfolioRisk?.calmar_ratio.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Max Drawdown:</span>
                  <span className="text-amber-400 font-bold">{((portfolioRisk?.max_drawdown || 0.0) * 100.0).toFixed(2)}%</span>
                </div>
              </div>
            </div>

            {/* Portfolio Allocations / Sensitivity */}
            <div className="glass-panel rounded-xl p-6 border border-[#1F2942] flex flex-col justify-between">
              <div>
                <h4 className="text-slate-500 font-mono text-[10px] uppercase tracking-wider mb-3">Active Allocations & Beta</h4>
                <div className="space-y-2.5 font-mono text-sm">
                  <div className="flex justify-between border-b border-[#1F2942]/40 pb-1.5">
                    <span className="text-slate-400">Portfolio SPX Beta:</span>
                    <span className="text-slate-100 font-bold">{portfolioRisk?.beta.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Jensen's Alpha:</span>
                    <span className="text-emerald-400 font-bold">{portfolioRisk?.alpha.toFixed(5)}</span>
                  </div>
                </div>
              </div>
              
              <div className="border-t border-[#1F2942]/40 pt-3 mt-4 text-[9px] font-mono text-slate-500 uppercase flex flex-wrap gap-2.5">
                {portfolioRisk && Object.entries(portfolioRisk.details.weights_allocated || {}).map(([ticker, w]) => (
                  <span key={ticker}>{ticker}: <strong className="text-slate-300">{(w as number * 100).toFixed(0)}%</strong></span>
                ))}
              </div>
            </div>
          </div>

          {/* Matrix & Stress Testing Charts Split */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Correlation Matrix Heatmap */}
            <div className="glass-panel rounded-xl p-4 border border-[#1F2942] h-[340px]">
              <h4 className="text-xs font-bold font-mono text-slate-400 mb-2 uppercase flex items-center gap-1.5">
                <BarChart2 className="w-4 h-4 text-cyan-400" /> Pearson Returns Correlation Matrix Heatmap
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

            {/* Macro Stress Testing returns shock bar chart */}
            <div className="glass-panel rounded-xl p-4 border border-[#1F2942] h-[340px]">
              <h4 className="text-xs font-bold font-mono text-slate-400 mb-2 uppercase flex items-center gap-1.5">
                <ThermometerSnowflake className="w-4 h-4 text-rose-400" /> Macro Stress Testing Returns shocks (%)
              </h4>
              <Plot
                data={getStressTestData()}
                layout={{
                  paper_bgcolor: 'rgba(0,0,0,0)',
                  plot_bgcolor: 'rgba(0,0,0,0)',
                  xaxis: { gridcolor: '#1F2942/20', tickfont: { color: '#94A3B8', size: 8 }, linecolor: '#1F2942' },
                  yaxis: { gridcolor: '#1F2942/20', tickfont: { color: '#94A3B8', size: 9 }, suffix: '%' },
                  margin: { l: 30, r: 10, t: 15, b: 50 },
                  showlegend: false
                }}
                config={{ responsive: true, displayModeBar: false }}
                className="w-full h-full"
              />
            </div>
          </div>

          {/* Macro USD Stress Shocks table */}
          <div className="glass-panel rounded-xl overflow-hidden border border-[#1F2942] font-mono text-xs">
            <div className="p-4 border-b border-[#1F2942]/60 flex items-center gap-2 text-slate-300 text-xs font-bold font-mono tracking-wider">
              <ShieldAlert className="w-4 h-4 text-rose-400" /> PORTFOLIO VALUATION IMPACT UNDER HISTORICAL STRESS REGIMES
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#0B0F19]/60 text-slate-500 uppercase text-[10px] tracking-wider border-b border-[#1F2942]/60">
                    <th className="py-4 px-6">Stress Scenario</th>
                    <th className="py-4 px-6">SPX Shock</th>
                    <th className="py-4 px-6">Portfolio Return Shock</th>
                    <th className="py-4 px-6">Capital Impact ($100k Baseline)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1F2942]/40 text-slate-300">
                  {stressTest?.scenarios.map((sc) => (
                    <tr key={sc.scenario_name} className="hover:bg-[#151D30]/20 transition-colors duration-200">
                      <td className="py-4 px-6 font-bold text-slate-100 uppercase">{sc.scenario_name.replace(/_/g, ' ')}</td>
                      <td className="py-4 px-6 text-rose-400">{(sc.spx_shock * 100.0).toFixed(1)}%</td>
                      <td className="py-4 px-6 text-rose-400">{(sc.portfolio_return_shock * 100.0).toFixed(2)}%</td>
                      <td className="py-4 px-6 text-rose-400 font-bold">${sc.portfolio_usd_impact.toLocaleString()}</td>
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
