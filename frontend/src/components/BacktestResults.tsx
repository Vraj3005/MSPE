'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { api, BacktestResponse } from '../lib/api';
import { Play, TrendingUp, DollarSign, Activity, Percent, ShieldCheck, AlertTriangle, RefreshCw } from 'lucide-react';

const Plot = dynamic(() => import('react-plotly.js'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[380px] flex items-center justify-center bg-[#151D30]/30 rounded-xl border border-[#1F2942] animate-pulse">
      <div className="text-slate-400 font-mono text-xs flex items-center gap-2">
        <RefreshCw className="w-4 h-4 animate-spin" /> Loading Performance Charts...
      </div>
    </div>
  )
});

export default function BacktestResults() {
  const [selectedTicker, setSelectedTicker] = useState<string>('BTCUSDT');
  const [strategy, setStrategy] = useState<string>('SMA_CROSSOVER');
  const [initialCapital, setInitialCapital] = useState<number>(100000);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<BacktestResponse | null>(null);

  const assetsList = ['BTCUSDT', 'ETHUSDT', 'SPX', 'XAU'];
  const strategiesList = [
    { value: 'SMA_CROSSOVER', label: '20-Day SMA Trend Following' },
    { value: 'RSI_MEAN_REVERSION', label: 'RSI Mean Reversion (14-Period)' }
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

  const timestamps = data ? data.equity_curve.map(node => new Date(node.timestamp).toLocaleDateString()) : [];
  const equities = data ? data.equity_curve.map(node => node.equity) : [];

  return (
    <div className="space-y-6">
      {/* Simulation Header and Control Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#151D30]/40 border border-[#1F2942] rounded-xl p-4">
        <div>
          <h2 className="text-xl font-bold tracking-wider text-slate-100 uppercase">Strategy Backtester</h2>
          <p className="text-xs text-slate-400 font-mono mt-1">Simulate algorithmic strategies on historical database prices</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Ticker Select */}
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-500 font-mono uppercase mb-1">Asset</span>
            <select
              value={selectedTicker}
              onChange={(e) => setSelectedTicker(e.target.value)}
              className="bg-[#0B0F19] border border-[#1F2942] rounded-lg px-3 py-1.5 text-xs font-mono font-bold text-slate-200 outline-none focus:border-cyan-500/50"
            >
              {assetsList.map(ticker => (
                <option key={ticker} value={ticker}>{ticker}</option>
              ))}
            </select>
          </div>

          {/* Strategy Select */}
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-500 font-mono uppercase mb-1">Algorithmic Model</span>
            <select
              value={strategy}
              onChange={(e) => setStrategy(e.target.value)}
              className="bg-[#0B0F19] border border-[#1F2942] rounded-lg px-3 py-1.5 text-xs font-mono font-bold text-slate-200 outline-none focus:border-cyan-500/50"
            >
              {strategiesList.map(strat => (
                <option key={strat.value} value={strat.value}>{strat.label}</option>
              ))}
            </select>
          </div>

          {/* Action Trigger */}
          <div className="flex flex-col justify-end pt-4">
            <button
              onClick={runBacktest}
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold tracking-wider uppercase bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 active:scale-95 transition-all duration-200"
            >
              <Play className="w-3.5 h-3.5 fill-emerald-400/20" /> Run Simulation
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="w-full h-[500px] flex items-center justify-center bg-[#151D30]/20 rounded-xl border border-[#1F2942] animate-pulse">
          <div className="text-slate-400 font-mono text-xs flex items-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" /> Simulating historical execution models...
          </div>
        </div>
      ) : error ? (
        <div className="glass-panel border-rose-500/20 bg-rose-500/5 text-rose-400 rounded-xl p-6 flex flex-col items-center justify-center gap-3">
          <AlertTriangle className="w-12 h-12 text-rose-500 animate-bounce" />
          <h4 className="font-bold text-sm">Simulation Engine Error</h4>
          <p className="text-xs font-mono max-w-md text-center">{error}</p>
        </div>
      ) : data ? (
        <div className="space-y-6">
          {/* High-level performance cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Return */}
            <div className="glass-panel rounded-xl p-4 border border-[#1F2942] relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Total Return</span>
                <Percent className={`w-4 h-4 ${data.total_return_pct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`} />
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className={`text-2xl font-black font-mono tracking-tight ${data.total_return_pct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {data.total_return_pct >= 0 ? '+' : ''}{data.total_return_pct}%
                </span>
                <span className="text-xs text-slate-500 font-mono">
                  (${data.total_pnl_usd.toLocaleString()})
                </span>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 to-blue-600" />
            </div>

            {/* Win Rate */}
            <div className="glass-panel rounded-xl p-4 border border-[#1F2942] relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Win Rate</span>
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="mt-3">
                <span className="text-2xl font-black font-mono tracking-tight text-slate-100">
                  {data.win_rate_pct}%
                </span>
                <div className="text-xs text-slate-400 font-mono mt-1">
                  {data.total_trades} trades executed
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
            </div>

            {/* Profit Factor */}
            <div className="glass-panel rounded-xl p-4 border border-[#1F2942] relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Gains / Losses Ratio</span>
                <Activity className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="mt-3">
                <span className="text-2xl font-black font-mono tracking-tight text-slate-100">
                  {data.profit_factor}x
                </span>
                <div className="text-xs text-slate-400 font-mono mt-1">
                  Ratio of gross gains vs gross losses
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 to-teal-500" />
            </div>

            {/* Worst Historical Drop */}
            <div className="glass-panel rounded-xl p-4 border border-[#1F2942] relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Worst Historical Drop</span>
                <AlertTriangle className="w-4 h-4 text-amber-500" />
              </div>
              <div className="mt-3">
                <span className="text-2xl font-black font-mono tracking-tight text-rose-400">
                  -{data.max_drawdown_pct}%
                </span>
                <div className="text-xs text-slate-400 font-mono mt-1">
                  Peak-to-trough drop limit
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 to-amber-500" />
            </div>
          </div>

          {/* Equity Curve Chart */}
          <div className="glass-panel rounded-xl p-4 border border-[#1F2942]">
            <Plot
              data={[
                {
                  x: timestamps,
                  y: equities,
                  type: 'scatter',
                  mode: 'lines',
                  name: 'Equity Curve',
                  line: { color: '#10B981', width: 2 },
                  fill: 'tozeroy',
                  fillcolor: 'rgba(16, 185, 129, 0.03)'
                }
              ]}
              layout={{
                title: { text: `Equity Curve Simulation (Start: $100,000 USD)`, font: { color: '#F1F5F9', family: 'Inter', size: 13 } },
                showlegend: false,
                xaxis: { gridcolor: '#1F2942/20', tickfont: { color: '#94A3B8', size: 10 }, linecolor: '#1F2942' },
                yaxis: { gridcolor: '#1F2942/20', tickfont: { color: '#94A3B8', size: 10 }, linecolor: '#1F2942', autorange: true },
                paper_bgcolor: 'rgba(0,0,0,0)',
                plot_bgcolor: 'rgba(0,0,0,0)',
                margin: { l: 60, r: 20, t: 40, b: 40 }
              }}
              config={{ responsive: true, displayModeBar: false }}
              className="w-full h-[350px]"
            />
          </div>

          {/* Historical Trade Logs */}
          <div className="glass-panel rounded-xl border border-[#1F2942] overflow-hidden">
            <div className="bg-[#151D30]/40 px-4 py-3 border-b border-[#1F2942]">
              <h3 className="text-xs font-bold font-mono tracking-wider text-slate-200 uppercase">Algorithmic Trade Log Registry</h3>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse font-mono text-xs">
                <thead>
                  <tr className="bg-[#0B0F19]/60 border-b border-[#1F2942] text-slate-400">
                    <th className="px-4 py-2 text-center">ID</th>
                    <th className="px-4 py-2">Side</th>
                    <th className="px-4 py-2">Entry Time</th>
                    <th className="px-4 py-2">Exit Time</th>
                    <th className="px-4 py-2 text-right">Entry Price</th>
                    <th className="px-4 py-2 text-right">Exit Price</th>
                    <th className="px-4 py-2 text-right">Return %</th>
                    <th className="px-4 py-2 text-right">PnL (USD)</th>
                    <th className="px-4 py-2 text-right">Capital</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1F2942]/50 text-slate-300">
                  {data.trade_logs.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                        No trades executed by the strategy during the historical period.
                      </td>
                    </tr>
                  ) : (
                    data.trade_logs.map(trade => (
                      <tr key={trade.id} className="hover:bg-[#151D30]/10 transition-colors">
                        <td className="px-4 py-2.5 text-center text-slate-500">#{trade.id}</td>
                        <td className="px-4 py-2.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            trade.type === 'LONG' 
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}>
                            {trade.type}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-slate-400">{new Date(trade.entry_time).toLocaleDateString()}</td>
                        <td className="px-4 py-2.5 text-slate-400">{new Date(trade.exit_time).toLocaleDateString()}</td>
                        <td className="px-4 py-2.5 text-right font-bold">${trade.entry_price.toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-right font-bold">${trade.exit_price.toLocaleString()}</td>
                        <td className={`px-4 py-2.5 text-right font-bold ${trade.return_pct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {trade.return_pct >= 0 ? '+' : ''}{trade.return_pct}%
                        </td>
                        <td className={`px-4 py-2.5 text-right font-bold ${trade.pnl_usd >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {trade.pnl_usd >= 0 ? '+' : ''}${trade.pnl_usd.toLocaleString()}
                        </td>
                        <td className="px-4 py-2.5 text-right text-slate-400">${trade.capital_after.toLocaleString()}</td>
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
