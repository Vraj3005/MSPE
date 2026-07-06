'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { api, PortfolioRiskMetrics, StressTestSummary, AssetRiskMetrics } from '../lib/api';
import { Briefcase, RefreshCw, BarChart2, ShieldAlert, ThermometerSnowflake, HelpCircle, CheckCircle } from 'lucide-react';
import { copy } from '../content/copy';

// Dynamic Plotly heatmaps and bar charts
const Plot = dynamic(() => import('react-plotly.js'), { 
  ssr: false,
  loading: () => (
    <div className="w-full h-[220px] flex items-center justify-center bg-slate-100/50 rounded-xl border border-slate-200/50 animate-pulse">
      <div className="text-slate-400 font-mono text-xs flex items-center gap-2">
        <RefreshCw className="w-4 h-4 animate-spin" /> Compiling Risk Visuals...
      </div>
    </div>
  )
});

interface PortfolioRiskProps {
  theme?: 'light' | 'dark';
}

export default function PortfolioRisk({ theme = 'light' }: PortfolioRiskProps) {
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

      // 3. Load Asset Risks
      let fetchedAssets: AssetRiskMetrics[] = [];
      try {
        fetchedAssets = await api.getAssetsRiskMetrics();
      } catch {
        fetchedAssets = mockAssetRisk;
      }
      if (!fetchedAssets || fetchedAssets.length === 0) {
        fetchedAssets = mockAssetRisk;
      }
      setAssetRisk(fetchedAssets);

    } catch (err: any) {
      console.error('Error fetching risk reports', err);
      setError(err.message || 'Failed to sync risk matrices');
    } finally {
      setLoading(false);
    }
  };

  const handleRecalculateRisk = async () => {
    try {
      setEvaluating(true);
      setEvalMessage(null);
      const res = await api.triggerRiskEvaluation();
      setEvalMessage(res.detail || 'Portfolio variance matrices and Value at Risk levels successfully updated.');
      setTimeout(() => {
        setEvalMessage(null);
        loadData();
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to recalculate risk reports.');
    } finally {
      setEvaluating(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const getCorrelationMatrixData = (): any[] => {
    const dataObj = portfolioRisk || mockPortfolioRisk;
    const assets = Object.keys(dataObj.correlation_matrix);
    const zData: number[][] = [];
    
    for (const a1 of assets) {
      const row = [];
      for (const a2 of assets) {
        row.push(dataObj.correlation_matrix[a1][a2]);
      }
      zData.push(row);
    }

    return [
      {
        x: assets,
        y: assets,
        z: zData,
        type: 'heatmap',
        colorscale: 'RdBu',
        reversescale: true,
        zmin: -1.0,
        zmax: 1.0,
        showscale: true,
        colorbar: {
          tickfont: { color: theme === 'light' ? '#475569' : '#94A3B8', size: 9 }
        }
      }
    ];
  };

  const getStressTestData = (): any[] => {
    const dataObj = stressTest || mockStressTest;
    const labels = dataObj.scenarios.map(s => s.scenario_name.replace(/_/g, ' '));
    const values = dataObj.scenarios.map(s => s.portfolio_return_shock * 100.0);

    return [
      {
        x: labels,
        y: values,
        type: 'bar',
        marker: {
          color: values.map(v => '#BE123C')
        }
      }
    ];
  };

  return (
    <div className={`space-y-6 min-h-screen p-6 rounded-2xl border transition-all duration-300 ${
      theme === 'light' 
        ? 'bg-slate-50 text-slate-800 border-slate-200' 
        : 'bg-[#151D30]/20 text-slate-100 border-[#1F2942]/60'
    }`}>
      {/* Risk Metrics Header Segment */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className={`text-xl font-bold tracking-wider uppercase transition-colors duration-300 ${
            theme === 'light' ? 'text-slate-900' : 'text-slate-100'
          }`}>Portfolio Risks & Shocks</h2>
          <p className={`text-xs mt-1 transition-colors duration-300 ${
            theme === 'light' ? 'text-slate-500' : 'text-slate-400'
          }`}>Downside loss thresholds, asset relationships, and simulated macro stress scenarios</p>
        </div>

        <button
          onClick={handleRecalculateRisk}
          disabled={evaluating}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold tracking-wider uppercase border transition-all duration-300 ${
            evaluating 
              ? 'bg-slate-100 text-slate-450 border-slate-200 cursor-not-allowed' 
              : theme === 'light'
                ? 'bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50 active:scale-95 shadow-sm'
                : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30 hover:bg-indigo-500/20 active:scale-95 shadow-[0_0_15px_rgba(99,102,241,0.1)]'
          }`}
        >
          <RefreshCw className={`w-4 h-4 ${evaluating ? 'animate-spin' : ''}`} />
          {evaluating ? 'Recalculating...' : 'Recalculate Risk'}
        </button>
      </div>

      {evalMessage && (
        <div className="flex items-center gap-2.5 p-4 rounded-lg bg-emerald-50 border border-emerald-250 text-emerald-800 text-xs font-mono dark:bg-emerald-950/30 dark:border-emerald-900/40 dark:text-emerald-400">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          <span>{evalMessage}</span>
        </div>
      )}

      {loading ? (
        <div className="w-full h-40 flex items-center justify-center bg-slate-100/50 rounded-xl border border-slate-200/50 animate-pulse">
          <div className="text-slate-400 font-mono text-xs flex items-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" /> Consolidating Risk Audits...
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Main Portfolio Indicators Card Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Aggregate Downside */}
            <div className={`rounded-xl p-6 border transition-colors duration-300 ${
              theme === 'light' ? 'bg-white border-slate-200 shadow-sm text-slate-800' : 'glass-panel border-[#1F2942] bg-[#151D30]/30 text-slate-100'
            }`}>
              <h4 className={`font-mono text-[10px] uppercase tracking-wider mb-3.5 flex items-center gap-1.5 justify-between ${
                theme === 'light' ? 'text-slate-500 font-bold' : 'text-slate-500'
              }`}>
                <span>Portfolio Downside Risk</span>
                <span title="Value at Risk (Maximum expected drop on a bad day) and average expected loss in a market crash scenario.">
                  <HelpCircle className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600 cursor-help" />
                </span>
              </h4>
              <div className={`space-y-2.5 font-mono text-xs ${theme === 'light' ? 'text-slate-700' : 'text-slate-400'}`}>
                <div className={`flex justify-between border-b pb-1.5 ${theme === 'light' ? 'border-slate-100' : 'border-[#1F2942]/40'}`}>
                  <span>{copy.glossary.var.name} (95%):</span>
                  <span className={`font-bold ${theme === 'light' ? 'text-slate-900' : 'text-slate-100'}`}>
                    {((portfolioRisk?.var_95 || 0.0) * 100.0).toFixed(2)}%
                  </span>
                </div>
                <div className={`flex justify-between border-b pb-1.5 ${theme === 'light' ? 'border-slate-100' : 'border-[#1F2942]/40'}`}>
                  <span>Extreme Downside Threshold (VaR 99%):</span>
                  <span className={`font-bold ${theme === 'light' ? 'text-slate-900' : 'text-slate-100'}`}>
                    {((portfolioRisk?.var_99 || 0.0) * 100.0).toFixed(2)}%
                  </span>
                </div>
                <div className={`flex justify-between border-b pb-1.5 ${theme === 'light' ? 'border-slate-100' : 'border-[#1F2942]/40'}`}>
                  <span>{copy.glossary.cvar.name} (95%):</span>
                  <span className={`font-bold ${theme === 'light' ? 'text-slate-900' : 'text-slate-100'}`}>
                    {((portfolioRisk?.expected_shortfall_95 || 0.0) * 100.0).toFixed(2)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Extreme Crash Loss (CVaR 99%):</span>
                  <span className={`font-bold ${theme === 'light' ? 'text-slate-900' : 'text-slate-100'}`}>
                    {((portfolioRisk?.expected_shortfall_99 || 0.0) * 100.0).toFixed(2)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Performance Ratios */}
            <div className={`rounded-xl p-6 border transition-colors duration-300 ${
              theme === 'light' ? 'bg-white border-slate-200 shadow-sm text-slate-800' : 'glass-panel border-[#1F2942] bg-[#151D30]/30 text-slate-100'
            }`}>
              <h4 className={`font-mono text-[10px] uppercase tracking-wider mb-3.5 flex items-center gap-1.5 justify-between ${
                theme === 'light' ? 'text-slate-500 font-bold' : 'text-slate-500'
              }`}>
                <span>Risk-Adjusted return (Sharpe)</span>
                <span title="Scores measuring return relative to risk. Higher Sharpe and Sortino ratios indicate better risk-adjusted returns.">
                  <HelpCircle className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600 cursor-help" />
                </span>
              </h4>
              <div className={`space-y-2.5 font-mono text-xs ${theme === 'light' ? 'text-slate-700' : 'text-slate-400'}`}>
                <div className={`flex justify-between border-b pb-1.5 ${theme === 'light' ? 'border-slate-100' : 'border-[#1F2942]/40'}`}>
                  <span>Sharpe Ratio (Return/Risk):</span>
                  <span className={`font-bold ${theme === 'light' ? 'text-slate-900' : 'text-emerald-400'}`}>
                    {portfolioRisk?.sharpe_ratio.toFixed(2)}
                  </span>
                </div>
                <div className={`flex justify-between border-b pb-1.5 ${theme === 'light' ? 'border-slate-100' : 'border-[#1F2942]/40'}`}>
                  <span>Sortino Ratio (Downside Risk):</span>
                  <span className={`font-bold ${theme === 'light' ? 'text-slate-900' : 'text-emerald-400'}`}>
                    {portfolioRisk?.sortino_ratio.toFixed(2)}
                  </span>
                </div>
                <div className={`flex justify-between border-b pb-1.5 ${theme === 'light' ? 'border-slate-100' : 'border-[#1F2942]/40'}`}>
                  <span>Calmar Ratio (Drawdown Risk):</span>
                  <span className={`font-bold ${theme === 'light' ? 'text-slate-900' : 'text-emerald-450'}`}>
                    {portfolioRisk?.calmar_ratio.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>{copy.glossary.drawdown.name}:</span>
                  <span className={`font-bold ${theme === 'light' ? 'text-slate-900' : 'text-rose-400'}`}>
                    {((portfolioRisk?.max_drawdown || 0.0) * 100.0).toFixed(2)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Allocations & Beta sensitivity */}
            <div className={`rounded-xl p-6 border flex flex-col justify-between transition-colors duration-300 ${
              theme === 'light' ? 'bg-white border-slate-200 shadow-sm text-slate-800' : 'glass-panel border-[#1F2942] bg-[#151D30]/30 text-slate-100'
            }`}>
              <div>
                <h4 className={`font-mono text-[10px] uppercase tracking-wider mb-3.5 flex items-center gap-1.5 justify-between ${
                  theme === 'light' ? 'text-slate-500 font-bold' : 'text-slate-500'
                }`}>
                  <span>Sensitivity & Outperformance</span>
                  <span title="Market Sensitivity measures volatility relative to the stock market index. Outperformance measures returns above risk assumptions.">
                    <HelpCircle className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600 cursor-help" />
                  </span>
                </h4>
                <div className={`space-y-2.5 font-mono text-xs ${theme === 'light' ? 'text-slate-700' : 'text-slate-400'}`}>
                  <div className={`flex justify-between border-b pb-1.5 ${theme === 'light' ? 'border-slate-100' : 'border-[#1F2942]/40'}`}>
                    <span>Market Sensitivity (Beta):</span>
                    <span className={`font-bold ${theme === 'light' ? 'text-slate-900' : 'text-slate-100'}`}>
                      {portfolioRisk?.beta.toFixed(2)}x
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Extra Return (Alpha):</span>
                    <span className={`font-bold ${theme === 'light' ? 'text-slate-900' : 'text-emerald-400'}`}>
                      {portfolioRisk?.alpha.toFixed(5)}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className={`border-t pt-3 mt-4 text-[9px] font-mono uppercase flex flex-wrap gap-2.5 ${
                theme === 'light' ? 'border-slate-100 text-slate-400' : 'border-[#1F2942]/40 text-slate-500'
              }`}>
                {Object.entries(portfolioRisk?.details.weights_allocated || mockPortfolioRisk.details.weights_allocated).map(([ticker, w]) => (
                  <span key={ticker}>{ticker}: <strong className={theme === 'light' ? 'text-slate-800 font-bold' : 'text-slate-350'}>{(w as number * 100).toFixed(0)}%</strong></span>
                ))}
              </div>
            </div>
          </div>

          {/* Asset-level Risk Profiles Grid Table */}
          <div className={`rounded-xl overflow-hidden border transition-colors duration-300 ${
            theme === 'light' ? 'bg-white border-slate-200 shadow-sm' : 'glass-panel border-[#1F2942]'
          }`}>
            <div className={`p-4 border-b flex items-center gap-2 text-xs font-bold font-mono tracking-wider ${
              theme === 'light' 
                ? 'border-slate-100 bg-slate-50 text-slate-800' 
                : 'border-[#1F2942]/60 bg-[#151D30]/50 text-slate-200'
            }`}>
              <ShieldAlert className="w-4 h-4 text-indigo-500" />
              HISTORICAL RISK & PERFORMANCE METRICS BY ASSET
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs border-collapse">
                <thead>
                  <tr className={`uppercase text-[9px] tracking-wider border-b ${
                    theme === 'light' 
                      ? 'bg-slate-50/50 text-slate-400 border-slate-100' 
                      : 'bg-[#0B0F19]/60 border-[#1F2942]/60 text-slate-500'
                  }`}>
                    <th className="py-3.5 px-6">Asset</th>
                    <th className="py-3.5 px-6">Daily Downside (VaR)</th>
                    <th className="py-3.5 px-6">Severe Downside (VaR 99%)</th>
                    <th className="py-3.5 px-6">Average Crash Loss (CVaR)</th>
                    <th className="py-3.5 px-6">Worst Drop (Drawdown)</th>
                    <th className="py-3.5 px-6">Return / Risk (Sharpe)</th>
                    <th className="py-3.5 px-6">Market Sensitivity (Beta)</th>
                    <th className="py-3.5 px-6">Extra Return (Alpha)</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${
                  theme === 'light' 
                    ? 'divide-slate-100 text-slate-700' 
                    : 'divide-[#1F2942]/40 text-slate-300'
                }`}>
                  {assetRisk.map((row) => (
                    <tr key={row.id} className={`transition-colors duration-200 ${
                      theme === 'light' ? 'hover:bg-slate-50/30' : 'hover:bg-[#151D30]/20'
                    }`}>
                      <td className={`py-3.5 px-6 font-bold ${theme === 'light' ? 'text-slate-900' : 'text-slate-100'}`}>{row.ticker}</td>
                      <td className="py-3.5 px-6">{(row.var_95 * 100.0).toFixed(2)}%</td>
                      <td className="py-3.5 px-6">{(row.var_99 * 100.0).toFixed(2)}%</td>
                      <td className={`py-3.5 px-6 font-bold ${theme === 'light' ? 'text-slate-900' : 'text-rose-400'}`}>
                        {(row.expected_shortfall_95 * 100.0).toFixed(2)}%
                      </td>
                      <td className={`py-3.5 px-6 font-bold ${theme === 'light' ? 'text-slate-900' : 'text-amber-400'}`}>
                        {(row.max_drawdown * 100.0).toFixed(1)}%
                      </td>
                      <td className={`py-3.5 px-6 font-bold ${theme === 'light' ? 'text-slate-900 font-bold' : 'text-emerald-400 font-bold'}`}>
                        {row.sharpe_ratio.toFixed(2)}
                      </td>
                      <td className="py-3.5 px-6">{row.beta.toFixed(2)}x</td>
                      <td className={`py-3.5 px-6 font-bold ${theme === 'light' ? 'text-slate-900' : 'text-emerald-400'}`}>
                        {(row.alpha * 100).toFixed(3)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Heatmaps and Shocks splits */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            
            {/* Correlation Matrix Heatmap */}
            <div className={`rounded-xl p-4 border h-[340px] transition-colors duration-300 ${
              theme === 'light' ? 'bg-white border-slate-200 shadow-sm' : 'glass-panel border-[#1F2942] bg-[#151D30]/30'
            }`}>
              <h4 className={`text-xs font-bold font-mono mb-2 uppercase flex items-center gap-1.5 justify-between ${
                theme === 'light' ? 'text-slate-700' : 'text-slate-400'
              }`}>
                <span className="flex items-center gap-1.5">
                  <BarChart2 className="w-4 h-4 text-indigo-500" />
                  Asset Price Relationships Heatmap
                </span>
                <span title="Correlation values. 1.0 means assets move in perfect lockstep; 0.0 means completely unrelated; negative values indicate assets diversify each other.">
                  <HelpCircle className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600 cursor-help" />
                </span>
              </h4>
              <Plot
                data={getCorrelationMatrixData()}
                layout={{
                  paper_bgcolor: 'rgba(0,0,0,0)',
                  plot_bgcolor: 'rgba(0,0,0,0)',
                  xaxis: { 
                    tickfont: { color: theme === 'light' ? '#475569' : '#94A3B8', size: 9 }, 
                    linecolor: theme === 'light' ? '#CBD5E1' : '#1F2942' 
                  },
                  yaxis: { 
                    tickfont: { color: theme === 'light' ? '#475569' : '#94A3B8', size: 9 }, 
                    linecolor: theme === 'light' ? '#CBD5E1' : '#1F2942' 
                  },
                  margin: { l: 60, r: 10, t: 15, b: 35 }
                }}
                config={{ responsive: true, displayModeBar: false }}
                className="w-full h-full"
              />
            </div>

            {/* Macro Stress testing shocks chart */}
            <div className={`rounded-xl p-4 border h-[340px] transition-colors duration-300 ${
              theme === 'light' ? 'bg-white border-slate-200 shadow-sm' : 'glass-panel border-[#1F2942] bg-[#151D30]/30'
            }`}>
              <h4 className={`text-xs font-bold font-mono mb-2 uppercase flex items-center gap-1.5 justify-between ${
                theme === 'light' ? 'text-slate-700' : 'text-slate-400'
              }`}>
                <span className="flex items-center gap-1.5">
                  <ThermometerSnowflake className="w-4 h-4 text-indigo-500" />
                  Simulation Under Historical Crashes
                </span>
                <span title="Percentage return shock to the portfolio under historical crisis events.">
                  <HelpCircle className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600 cursor-help" />
                </span>
              </h4>
              <Plot
                data={getStressTestData()}
                layout={{
                  paper_bgcolor: 'rgba(0,0,0,0)',
                  plot_bgcolor: 'rgba(0,0,0,0)',
                  xaxis: { 
                    gridcolor: theme === 'light' ? 'rgba(203,213,225,0.4)' : '#1F2942/20', 
                    tickfont: { color: theme === 'light' ? '#475569' : '#94A3B8', size: 8 }, 
                    linecolor: theme === 'light' ? '#CBD5E1' : '#1F2942' 
                  },
                  yaxis: { 
                    gridcolor: theme === 'light' ? 'rgba(203,213,225,0.4)' : '#1F2942/20', 
                    tickfont: { color: theme === 'light' ? '#475569' : '#94A3B8', size: 9 } 
                  },
                  margin: { l: 30, r: 10, t: 15, b: 50 },
                  showlegend: false
                }}
                config={{ responsive: true, displayModeBar: false }}
                className="w-full h-full"
              />
            </div>
          </div>

          {/* USD stress impact tables */}
          <div className={`rounded-xl overflow-hidden border transition-colors duration-300 ${
            theme === 'light' ? 'bg-white border-slate-200 shadow-sm font-mono text-xs' : 'glass-panel border-[#1F2942] font-mono text-xs'
          }`}>
            <div className={`p-4 border-b flex items-center gap-2 text-xs font-bold font-mono tracking-wider ${
              theme === 'light' 
                ? 'border-slate-100 bg-slate-50 text-slate-800' 
                : 'border-[#1F2942]/60 bg-[#151D30]/50 text-slate-200'
            }`}>
              <ShieldAlert className="w-4 h-4 text-indigo-500" />
              PORTFOLIO VALUE IMPACT IN SIMULATED CRASHES ($100K BASELINE)
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className={`uppercase text-[9px] tracking-wider border-b ${
                    theme === 'light' 
                      ? 'bg-slate-50/50 text-slate-400 border-slate-100' 
                      : 'bg-[#0B0F19]/60 border-[#1F2942]/60 text-slate-500'
                  }`}>
                    <th className="py-3 px-6">Historical Crash Scenario</th>
                    <th className="py-3 px-6">Index Drop (S&P 500)</th>
                    <th className="py-3 px-6">Estimated Portfolio Return Shock</th>
                    <th className="py-3 px-6">Estimated Dollar Loss Impact</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${
                  theme === 'light' 
                    ? 'divide-slate-100 text-slate-700' 
                    : 'divide-[#1F2942]/40 text-slate-300'
                }`}>
                  {(stressTest?.scenarios || mockStressTest.scenarios).map((sc) => (
                    <tr key={sc.scenario_name} className={`transition-colors duration-200 ${
                      theme === 'light' ? 'hover:bg-slate-50/30' : 'hover:bg-[#151D30]/20'
                    }`}>
                      <td className={`py-3 px-6 font-bold uppercase ${theme === 'light' ? 'text-slate-900 font-bold' : 'text-slate-100'}`}>{sc.scenario_name.replace(/_/g, ' ')}</td>
                      <td className="py-3 px-6 font-bold">{(sc.spx_shock * 100.0).toFixed(1)}%</td>
                      <td className="py-3 px-6 font-bold">{(sc.portfolio_return_shock * 100.0).toFixed(2)}%</td>
                      <td className="py-3 px-6 font-black">-${Math.abs(sc.portfolio_usd_impact).toLocaleString()}</td>
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
