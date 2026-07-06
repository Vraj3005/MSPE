'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { api, BacktestResponse } from '../lib/api';
import { Play, TrendingUp, DollarSign, Activity, Percent, ShieldCheck, AlertTriangle, RefreshCw } from 'lucide-react';

const Plot = dynamic(() => import('react-plotly.js'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[380px] flex items-center justify-center bg-slate-100/50 rounded-xl border border-slate-200/50 animate-pulse">
      <div className="text-slate-400 font-mono text-xs flex items-center gap-2">
        <RefreshCw className="w-4 h-4 animate-spin" /> Loading Performance Charts...
      </div>
    </div>
  )
});

interface BacktestResultsProps {
  theme?: 'light' | 'dark';
}

export default function BacktestResults({ theme = 'light' }: BacktestResultsProps) {
  const [selectedTicker, setSelectedTicker] = useState<string>('BTCUSDT');
  const [strategy, setStrategy] = useState<string>('SMA_CROSSOVER');
  const [initialCapital, setInitialCapital] = useState<number>(100000);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<BacktestResponse | null>(null);

  const assetsList = ['BTCUSDT', 'ETHUSDT', 'SPX', 'XAU'];
  const strategiesList = [
    { value: 'SMA_CROSSOVER', label: '20-Day Simple Average Trend Following' },
    { value: 'RSI_MEAN_REVERSION', label: 'RSI Momentum Swing (14-Period)' }
  ];

  const runBacktest = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.runBacktest(selectedTicker, strategy, initialCapital);
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to execute strategy simulation');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runBacktest();
  }, [selectedTicker, strategy]);

  // Extract Plotly vectors
  const timestamps = data ? data.equity_curve.map(pt => new Date(pt.timestamp).toLocaleDateString()) : [];
  const equities = data ? data.equity_curve.map(pt => pt.equity) : [];

  return (
    <div className={`space-y-6 min-h-screen p-6 rounded-2xl border transition-all duration-300 ${
      theme === 'light' 
        ? 'bg-slate-50 text-slate-800 border-slate-200' 
        : 'bg-[#151D30]/20 text-slate-100 border-[#1F2942]/60'
    }`}>
      {/* Selector Header Segment */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className={`text-xl font-bold tracking-wider uppercase transition-colors duration-300 ${
            theme === 'light' ? 'text-slate-900' : 'text-slate-100'
          }`}>Strategy Backtester</h2>
          <p className={`text-xs mt-1 transition-colors duration-300 ${
            theme === 'light' ? 'text-slate-500' : 'text-slate-400'
          }`}>Simulate buying and selling rules over past prices to see historical performance</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Asset Selection */}
          <select
            value={selectedTicker}
            onChange={(e) => setSelectedTicker(e.target.value)}
            className={`rounded-lg px-4 py-2 text-xs font-mono font-bold outline-none border transition-all duration-300 ${
              theme === 'light' 
                ? 'bg-white border-slate-200 text-slate-850 focus:border-indigo-500' 
                : 'bg-[#151D30] border-[#1F2942] text-slate-200 focus:border-cyan-500/50'
            }`}
          >
            {assetsList.map(ticker => (
              <option key={ticker} value={ticker}>{ticker}</option>
            ))}
          </select>

          {/* Strategy Selection */}
          <select
            value={strategy}
            onChange={(e) => setStrategy(e.target.value)}
            className={`rounded-lg px-4 py-2 text-xs font-mono font-bold outline-none border transition-all duration-300 ${
              theme === 'light' 
                ? 'bg-white border-slate-200 text-slate-850 focus:border-indigo-500' 
                : 'bg-[#151D30] border-[#1F2942] text-slate-200 focus:border-cyan-500/50'
            }`}
          >
            {strategiesList.map(str => (
              <option key={str.value} value={str.value}>{str.label}</option>
            ))}
          </select>

          {/* Capital selector */}
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>Investment:</span>
            <input
              type="number"
              value={initialCapital}
              onChange={(e) => setInitialCapital(Number(e.target.value))}
              onBlur={runBacktest}
              className={`w-28 rounded-lg px-3 py-1.5 text-xs font-mono font-bold outline-none border transition-all duration-300 ${
                theme === 'light' 
                  ? 'bg-white border-slate-200 text-slate-850 focus:border-indigo-500' 
                  : 'bg-[#151D30] border-[#1F2942] text-slate-200 focus:border-cyan-500/50'
              }`}
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2.5 p-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium shadow-sm dark:bg-rose-950/30 dark:border-rose-900/40 dark:text-rose-400">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="w-full h-56 flex items-center justify-center bg-slate-100/50 rounded-xl border border-slate-200/50 animate-pulse">
          <div className="text-slate-400 font-mono text-xs flex items-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" /> Querying Engine Backtester...
          </div>
        </div>
      ) : data ? (
        <div className="space-y-6">
          {/* Key Simulation metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Total Return */}
            <div className={`rounded-xl p-4 border relative overflow-hidden transition-colors duration-300 ${
              theme === 'light' ? 'bg-white border-slate-200 shadow-sm text-slate-800' : 'glass-panel border-[#1F2942] bg-[#151D30]/30 text-slate-100'
            }`}>
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-mono uppercase tracking-wider ${theme === 'light' ? 'text-slate-500 font-bold' : 'text-slate-400'}`}>Total Return</span>
                <Percent className={`w-4 h-4 ${data.total_return_pct >= 0 ? (theme === 'light' ? 'text-emerald-600' : 'text-emerald-400') : (theme === 'light' ? 'text-rose-600' : 'text-rose-400')}`} />
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className={`text-2xl font-black font-mono tracking-tight ${
                  data.total_return_pct >= 0 
                    ? (theme === 'light' ? 'text-emerald-700' : 'text-emerald-400') 
                    : (theme === 'light' ? 'text-rose-700' : 'text-rose-400')
                }`}>
                  {data.total_return_pct >= 0 ? '+' : ''}{data.total_return_pct}%
                </span>
                <span className={`text-xs font-mono ${theme === 'light' ? 'text-slate-600' : 'text-slate-500'}`}>
                  (${data.total_pnl_usd.toLocaleString()})
                </span>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-blue-600" />
            </div>

            {/* Win Rate */}
            <div className={`rounded-xl p-4 border relative overflow-hidden transition-colors duration-300 ${
              theme === 'light' ? 'bg-white border-slate-200 shadow-sm text-slate-800' : 'glass-panel border-[#1F2942] bg-[#151D30]/30 text-slate-100'
            }`}>
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-mono uppercase tracking-wider ${theme === 'light' ? 'text-slate-500 font-bold' : 'text-slate-400'}`}>Win Rate</span>
                <ShieldCheck className={`w-4 h-4 ${theme === 'light' ? 'text-emerald-600' : 'text-emerald-400'}`} />
              </div>
              <div className="mt-3">
                <span className={`text-2xl font-black font-mono tracking-tight ${theme === 'light' ? 'text-slate-900' : 'text-slate-100'}`}>
                  {data.win_rate_pct}%
                </span>
                <div className={`text-xs font-mono mt-1 ${theme === 'light' ? 'text-slate-650' : 'text-slate-400'}`}>
                  {data.total_trades} trades executed
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
            </div>

            {/* Profit Factor */}
            <div className={`rounded-xl p-4 border relative overflow-hidden transition-colors duration-300 ${
              theme === 'light' ? 'bg-white border-slate-200 shadow-sm text-slate-800' : 'glass-panel border-[#1F2942] bg-[#151D30]/30 text-slate-100'
            }`}>
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-mono uppercase tracking-wider ${theme === 'light' ? 'text-slate-500 font-bold' : 'text-slate-400'}`}>Gains / Losses Ratio</span>
                <Activity className={`w-4 h-4 ${theme === 'light' ? 'text-indigo-600' : 'text-indigo-400'}`} />
              </div>
              <div className="mt-3">
                <span className={`text-2xl font-black font-mono tracking-tight ${theme === 'light' ? 'text-slate-900' : 'text-slate-100'}`}>
                  {data.profit_factor}x
                </span>
                <div className={`text-xs font-mono mt-1 ${theme === 'light' ? 'text-slate-650' : 'text-slate-400'}`}>
                  Ratio of gross gains vs gross losses
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-teal-500" />
            </div>

            {/* Worst Historical Drop */}
            <div className={`rounded-xl p-4 border relative overflow-hidden transition-colors duration-300 ${
              theme === 'light' ? 'bg-white border-slate-200 shadow-sm text-slate-800' : 'glass-panel border-[#1F2942] bg-[#151D30]/30 text-slate-100'
            }`}>
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-mono uppercase tracking-wider ${theme === 'light' ? 'text-slate-500 font-bold' : 'text-slate-400'}`}>Worst Historical Drop</span>
                <AlertTriangle className="w-4 h-4 text-amber-500" />
              </div>
              <div className="mt-3">
                <span className={`text-2xl font-black font-mono tracking-tight ${theme === 'light' ? 'text-rose-700 font-bold' : 'text-rose-450 font-bold'}`}>
                  -{data.max_drawdown_pct}%
                </span>
                <div className={`text-xs font-mono mt-1 ${theme === 'light' ? 'text-slate-650' : 'text-slate-400'}`}>
                  Peak-to-trough drop limit
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 to-amber-500" />
            </div>
          </div>

          {/* Equity Curve Chart */}
          <div className={`rounded-xl p-4 border transition-colors duration-300 ${
            theme === 'light' ? 'bg-white border-slate-200 shadow-sm' : 'glass-panel border-[#1F2942] bg-[#151D30]/30'
          }`}>
            <Plot
              data={[
                {
                  x: timestamps,
                  y: equities,
                  type: 'scatter',
                  mode: 'lines',
                  name: 'Equity Curve',
                  line: { color: '#4F46E5', width: 2.5 },
                  fill: 'tozeroy',
                  fillcolor: theme === 'light' ? 'rgba(79, 70, 229, 0.05)' : 'rgba(79, 70, 229, 0.02)'
                }
              ]}
              layout={{
                title: { 
                  text: `Equity Curve Simulation (Start: $${initialCapital.toLocaleString()} USD)`, 
                  font: { color: theme === 'light' ? '#0F172A' : '#F1F5F9', family: 'Inter', size: 13 } 
                },
                showlegend: false,
                xaxis: { 
                  gridcolor: theme === 'light' ? 'rgba(203,213,225,0.4)' : '#1F2942/20', 
                  tickfont: { color: theme === 'light' ? '#475569' : '#94A3B8', size: 10 }, 
                  linecolor: theme === 'light' ? '#CBD5E1' : '#1F2942' 
                },
                yaxis: { 
                  gridcolor: theme === 'light' ? 'rgba(203,213,225,0.4)' : '#1F2942/20', 
                  tickfont: { color: theme === 'light' ? '#475569' : '#94A3B8', size: 10 }, 
                  linecolor: theme === 'light' ? '#CBD5E1' : '#1F2942', 
                  autorange: true,
                  tickformat: '$,.0f'
                },
                paper_bgcolor: 'rgba(0,0,0,0)',
                plot_bgcolor: 'rgba(0,0,0,0)',
                margin: { l: 60, r: 20, t: 40, b: 40 }
              }}
              config={{ responsive: true, displayModeBar: false }}
              className="w-full h-[350px]"
            />
          </div>

          {/* Historical Trade Logs */}
          <div className={`rounded-xl border overflow-hidden transition-colors duration-300 ${
            theme === 'light' ? 'bg-white border-slate-200 shadow-sm' : 'glass-panel border-[#1F2942]'
          }`}>
            <div className={`px-4 py-3 border-b ${
              theme === 'light' 
                ? 'border-slate-100 bg-slate-50 text-slate-800' 
                : 'border-[#1F2942] bg-[#151D30]/40 text-slate-200'
            }`}>
              <h3 className="text-xs font-bold font-mono tracking-wider uppercase">Algorithmic Trade Log Registry</h3>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse font-mono text-xs">
                <thead>
                  <tr className={`border-b uppercase text-[9px] tracking-wider ${
                    theme === 'light' 
                      ? 'bg-slate-50/50 text-slate-400 border-slate-100' 
                      : 'bg-[#0B0F19]/60 border-[#1F2942] text-slate-500'
                  }`}>
                    <th className="px-4 py-2.5 text-center">ID</th>
                    <th className="px-4 py-2.5">Side</th>
                    <th className="px-4 py-2.5">Entry Time</th>
                    <th className="px-4 py-2.5">Exit Time</th>
                    <th className="px-4 py-2.5 text-right">Entry Price</th>
                    <th className="px-4 py-2.5 text-right">Exit Price</th>
                    <th className="px-4 py-2.5 text-right">Return %</th>
                    <th className="px-4 py-2.5 text-right">PnL (USD)</th>
                    <th className="px-4 py-2.5 text-right">Capital</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${
                  theme === 'light' 
                    ? 'divide-slate-100 text-slate-700' 
                    : 'divide-[#1F2942]/50 text-slate-350'
                }`}>
                  {data.trade_logs.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                        No trades executed by the strategy during the historical period.
                      </td>
                    </tr>
                  ) : (
                    data.trade_logs.map(trade => (
                      <tr key={trade.id} className={`transition-colors duration-200 ${
                        theme === 'light' ? 'hover:bg-slate-50/30' : 'hover:bg-[#151D30]/10'
                      }`}>
                        <td className="px-4 py-2.5 text-center text-slate-500">#{trade.id}</td>
                        <td className="px-4 py-2.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            trade.type === 'LONG' 
                              ? theme === 'light'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                              : theme === 'light'
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                          }`}>
                            {trade.type}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">{new Date(trade.entry_time).toLocaleDateString()}</td>
                        <td className="px-4 py-2.5">{new Date(trade.exit_time).toLocaleDateString()}</td>
                        <td className={`px-4 py-2.5 text-right font-bold ${theme === 'light' ? 'text-slate-900' : 'text-slate-100'}`}>${trade.entry_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className={`px-4 py-2.5 text-right font-bold ${theme === 'light' ? 'text-slate-900' : 'text-slate-100'}`}>${trade.exit_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className={`px-4 py-2.5 text-right font-bold ${
                          trade.return_pct >= 0 
                            ? theme === 'light' ? 'text-emerald-700 font-bold' : 'text-emerald-400 font-bold' 
                            : theme === 'light' ? 'text-rose-700 font-bold' : 'text-rose-400'
                        }`}>
                          {trade.return_pct >= 0 ? '+' : ''}{trade.return_pct}%
                        </td>
                        <td className={`px-4 py-2.5 text-right font-bold ${
                          trade.pnl_usd >= 0 
                            ? theme === 'light' ? 'text-emerald-700 font-bold' : 'text-emerald-400 font-bold' 
                            : theme === 'light' ? 'text-rose-700 font-bold' : 'text-rose-400'
                        }`}>
                          {trade.pnl_usd >= 0 ? '+' : ''}${trade.pnl_usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-2.5 text-right text-slate-550">${trade.capital_after.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
