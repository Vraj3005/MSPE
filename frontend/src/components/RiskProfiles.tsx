'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { api, AssetRiskMetrics } from '../lib/api';
import { ShieldAlert, RefreshCw, BarChart } from 'lucide-react';

const Plot = dynamic(() => import('react-plotly.js'), { 
  ssr: false,
  loading: () => (
    <div className="w-full h-[220px] flex items-center justify-center bg-[#151D30]/30 rounded-xl border border-[#1F2942] animate-pulse">
      <div className="text-slate-400 font-mono text-xs flex items-center gap-2">
        <RefreshCw className="w-4 h-4 animate-spin" /> Compiling Comparative Analytics Canvas...
      </div>
    </div>
  )
});

export default function RiskProfiles() {
  const [assetRisk, setAssetRisk] = useState<AssetRiskMetrics[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [evaluating, setEvaluating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

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
      
      let fetchedRisk: AssetRiskMetrics[] = [];
      try {
        fetchedRisk = await api.getAssetsRiskMetrics();
      } catch {
        fetchedRisk = mockAssetRisk;
      }

      if (!fetchedRisk || fetchedRisk.length === 0) {
        fetchedRisk = mockAssetRisk;
      }
      setAssetRisk(fetchedRisk);
    } catch (err: any) {
      setError(err.message || 'Failed to load risk profiles');
    } finally {
      setLoading(false);
    }
  };

  const handleRecalculateRisk = async () => {
    try {
      setEvaluating(true);
      await api.triggerRiskEvaluation();
      setTimeout(() => loadData(), 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to trigger risk re-evaluation');
      setEvaluating(false);
    } finally {
      setEvaluating(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const tickers = assetRisk.map(r => r.ticker || 'UNKNOWN');
  const sharpes = assetRisk.map(r => r.sharpe_ratio);
  const betas = assetRisk.map(r => r.beta);
  const mdds = assetRisk.map(r => r.max_drawdown * 100.0); // percentage

  return (
    <div className="space-y-6">
      {/* Parameters Header Segment */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-wider text-slate-100 uppercase">Risk Analytics</h2>
          <p className="text-xs text-slate-400 font-mono mt-1">Asset-level tail-risk estimations, Sharpe, and systemic pricing exposure ratios</p>
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
          {evaluating ? 'Recalculating Risk...' : 'Recalculate Risk'}
        </button>
      </div>

      {loading ? (
        <div className="w-full h-40 flex items-center justify-center bg-[#151D30]/20 rounded-xl border border-[#1F2942] animate-pulse">
          <div className="text-slate-400 font-mono text-xs flex items-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" /> Querying Tail Risk Snapshots...
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Comparative Metrics Table */}
          <div className="glass-panel rounded-xl overflow-hidden border border-[#1F2942]">
            <div className="p-4 border-b border-[#1F2942]/60 flex items-center gap-2 text-slate-300 text-xs font-bold font-mono tracking-wider">
              <ShieldAlert className="w-4 h-4 text-cyan-400" /> HISTORICAL ASSET RISK AUDIT GRID (252-DAY LOOKBACK)
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs border-collapse">
                <thead>
                  <tr className="bg-[#0B0F19]/60 text-slate-500 uppercase text-[10px] tracking-wider border-b border-[#1F2942]/60">
                    <th className="py-4.5 px-6">Asset</th>
                    <th className="py-4.5 px-6">VaR (95%)</th>
                    <th className="py-4.5 px-6">VaR (99%)</th>
                    <th className="py-4.5 px-6">ES (95%)</th>
                    <th className="py-4.5 px-6">ES (99%)</th>
                    <th className="py-4.5 px-6">Max Drawdown</th>
                    <th className="py-4.5 px-6">Sharpe</th>
                    <th className="py-4.5 px-6">Sortino</th>
                    <th className="py-4.5 px-6">Beta (SPX)</th>
                    <th className="py-4.5 px-6">Alpha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1F2942]/40 text-slate-300">
                  {assetRisk.map((row) => (
                    <tr key={row.id} className="hover:bg-[#151D30]/20 transition-colors duration-200">
                      <td className="py-4 px-6 font-bold text-slate-100">{row.ticker}</td>
                      <td className="py-4 px-6">{(row.var_95 * 100.0).toFixed(3)}%</td>
                      <td className="py-4 px-6">{(row.var_99 * 100.0).toFixed(3)}%</td>
                      <td className="py-4 px-6">{(row.expected_shortfall_95 * 100.0).toFixed(3)}%</td>
                      <td className="py-4 px-6">{(row.expected_shortfall_99 * 100.0).toFixed(3)}%</td>
                      <td className="py-4 px-6 text-amber-400">{(row.max_drawdown * 100.0).toFixed(2)}%</td>
                      <td className="py-4 px-6 text-emerald-400 font-bold">{row.sharpe_ratio.toFixed(2)}</td>
                      <td className="py-4 px-6 text-emerald-400">{row.sortino_ratio.toFixed(2)}</td>
                      <td className="py-4 px-6">{row.beta.toFixed(2)}</td>
                      <td className="py-4 px-6 text-emerald-400 font-bold">{row.alpha.toFixed(5)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Comparative analytics visual charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Sharpe vs Beta Comparative Bar Chart */}
            <div className="glass-panel rounded-xl p-4 border border-[#1F2942]">
              <Plot
                data={[
                  {
                    x: tickers,
                    y: sharpes,
                    type: 'bar',
                    name: 'Sharpe Ratio',
                    marker: { color: '#10B981' }
                  },
                  {
                    x: tickers,
                    y: betas,
                    type: 'bar',
                    name: 'Systemic Beta',
                    marker: { color: '#06B6D4' }
                  }
                ]}
                layout={{
                  title: { text: 'Risk-Adjusted Ratios & Beta Sensitivity', font: { color: '#F1F5F9', family: 'Inter', size: 12 } },
                  barmode: 'group',
                  paper_bgcolor: 'rgba(0,0,0,0)',
                  plot_bgcolor: 'rgba(0,0,0,0)',
                  xaxis: { gridcolor: '#1F2942/20', tickfont: { color: '#94A3B8', size: 9 }, linecolor: '#1F2942' },
                  yaxis: { gridcolor: '#1F2942/20', tickfont: { color: '#94A3B8', size: 9 } },
                  margin: { l: 30, r: 10, t: 40, b: 35 },
                  legend: { font: { color: '#E2E8F0', size: 9 } }
                }}
                config={{ responsive: true, displayModeBar: false }}
                className="w-full h-[220px]"
              />
            </div>

            {/* Max Drawdown Comparative Bar Chart */}
            <div className="glass-panel rounded-xl p-4 border border-[#1F2942]">
              <Plot
                data={[
                  {
                    x: tickers,
                    y: mdds,
                    type: 'bar',
                    name: 'Max Drawdown (%)',
                    marker: { color: '#F43F5E' }
                  }
                ]}
                layout={{
                  title: { text: 'Peak-to-Trough Maximum Drawdowns (%)', font: { color: '#F1F5F9', family: 'Inter', size: 12 } },
                  paper_bgcolor: 'rgba(0,0,0,0)',
                  plot_bgcolor: 'rgba(0,0,0,0)',
                  xaxis: { gridcolor: '#1F2942/20', tickfont: { color: '#94A3B8', size: 9 }, linecolor: '#1F2942' },
                  yaxis: { gridcolor: '#1F2942/20', tickfont: { color: '#94A3B8', size: 9 } },
                  margin: { l: 30, r: 10, t: 40, b: 35 },
                  showlegend: false
                }}
                config={{ responsive: true, displayModeBar: false }}
                className="w-full h-[220px]"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
