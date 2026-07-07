'use client';

import React, { useEffect, useState } from 'react';
import { api, TradingSignal, PortfolioExposureSummary } from '../../lib/api';
import { Zap, ShieldCheck, TrendingUp, TrendingDown, RefreshCw, AlertTriangle, AlertOctagon } from 'lucide-react';

export default function SignalsBoard() {
  const [signals, setSignals] = useState<TradingSignal[]>([]);
  const [exposure, setExposure] = useState<PortfolioExposureSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [scanning, setScanning] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const mockSignals: TradingSignal[] = [
    {
      id: 's1',
      asset_id: '1',
      ticker: 'BTCUSDT',
      timestamp: new Date().toISOString(),
      strategy_name: 'SURFACE_DRIFT',
      signal_type: 'LONG',
      entry_price: 65000.0,
      stop_loss: 61000.0,
      take_profit: 74000.0,
      risk_reward_ratio: 2.25,
      position_size_usd: 16250.0,
      confidence_score: 0.85,
      rank_score: 0.005,
      details: { risk_status: 'ACCEPTED_EXPOSURE_OK', reason: 'Fitted return expectations exceed long barrier bounds.' },
      is_active: true
    },
    {
      id: 's2',
      asset_id: '2',
      ticker: 'ETHUSDT',
      timestamp: new Date().toISOString(),
      strategy_name: 'SURFACE_DRIFT',
      signal_type: 'SHORT',
      entry_price: 3400.0,
      stop_loss: 3650.0,
      take_profit: 2900.0,
      risk_reward_ratio: 2.0,
      position_size_usd: 13600.0,
      confidence_score: 0.78,
      rank_score: 0.0035,
      details: { risk_status: 'ACCEPTED_EXPOSURE_OK', reason: 'Fitted expectations are bearish with negative drift.' },
      is_active: true
    },
    {
      id: 's3',
      asset_id: '4',
      ticker: 'XAU',
      timestamp: new Date().toISOString(),
      strategy_name: 'SURFACE_DRIFT',
      signal_type: 'LONG',
      entry_price: 2300.0,
      stop_loss: 2220.0,
      take_profit: 2450.0,
      risk_reward_ratio: 1.88,
      position_size_usd: 28750.0,
      confidence_score: 0.82,
      rank_score: 0.004,
      details: { risk_status: 'REJECTED_PORTFOLIO_RISK_CEILING_BREACHED', reason: 'Blocked to protect portfolio limits.' },
      is_active: false
    }
  ];

  const mockExposure: PortfolioExposureSummary = {
    total_equity_usd: 100000.0,
    total_active_risk_usd: 2000.0,  // BTC risk ($1,000) + ETH risk ($1,000)
    total_active_risk_pct: 2.000,
    remaining_risk_capacity_usd: 3000.0,
    active_positions_count: 2
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch Exposure Summary
      let fetchedExposure: PortfolioExposureSummary | null = null;
      try {
        fetchedExposure = await api.getPortfolioExposure();
      } catch {
        fetchedExposure = mockExposure;
      }
      setExposure(fetchedExposure || mockExposure);

      // Fetch Active Signals
      let fetchedSignals: TradingSignal[] = [];
      try {
        fetchedSignals = await api.getActiveSignals();
        // Resolve tickers if missing in DB ORM mapping
        for (const sig of fetchedSignals) {
          if (!sig.ticker) {
            const assets = await api.getAssets();
            const matchingAsset = assets.find(a => a.id === sig.asset_id);
            sig.ticker = matchingAsset ? matchingAsset.ticker : 'UNKNOWN';
          }
        }
      } catch {
        fetchedSignals = mockSignals;
      }

      if (!fetchedSignals || fetchedSignals.length === 0) {
        fetchedSignals = mockSignals;
      }
      setSignals(fetchedSignals);
    } catch (err: any) {
      setError(err.message || 'Failed to load signals board data');
    } finally {
      setLoading(false);
    }
  };

  const handleScan = async () => {
    try {
      setScanning(true);
      setError(null);
      setMessage(null);
      const res = await api.triggerSignalsEvaluation();
      setMessage(res.detail || 'Portfolio-wide strategy scanning triggered.');
      setTimeout(() => {
        setMessage(null);
        loadData();
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to scan strategy signals');
    } finally {
      setScanning(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-6">
      {/* Selector Header Segment */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-wider text-slate-100 uppercase">Trading Signals</h2>
          <p className="text-xs text-slate-400 font-mono mt-1">Real-time signals ranking, stop targets, and portfolio exposure limits</p>
        </div>

        <button
          onClick={handleScan}
          disabled={scanning}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold tracking-wider uppercase border border-cyan-500/30 transition-all duration-300 ${
            scanning 
              ? 'bg-cyan-500/5 text-cyan-500 cursor-not-allowed' 
              : 'bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 active:scale-95 shadow-[0_0_15px_rgba(6,182,212,0.1)]'
          }`}
        >
          <RefreshCw className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} />
          {scanning ? 'Evaluating Strategy...' : 'Evaluate Signals'}
        </button>
      </div>

      {/* Messages banners */}
      {message && (
        <div className="flex items-center gap-2.5 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-mono">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span>{message}</span>
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2.5 p-4 rounded-lg bg-rose-500/10 border border-rose-500/25 text-rose-400 text-xs font-mono">
          <AlertTriangle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="w-full h-40 flex items-center justify-center bg-[#151D30]/20 rounded-xl border border-[#1F2942] animate-pulse">
          <div className="text-slate-400 font-mono text-xs flex items-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" /> Loading Strategy Signal Board...
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Active Signals List (Left side - takes 2 cols) */}
          <div className="xl:col-span-2 space-y-4">
            <div className="flex items-center gap-2 text-slate-400 text-xs font-bold font-mono tracking-wider mb-2">
              <Zap className="w-4 h-4 text-cyan-400" /> STRATEGIC SIGNALS AUDIT BOARD
            </div>

            {signals.map((sig) => {
              const isLong = sig.signal_type.toUpperCase() === 'LONG';
              const isShort = sig.signal_type.toUpperCase() === 'SHORT';
              const isActive = sig.is_active;

              return (
                <div
                  key={sig.id}
                  className={`glass-panel rounded-xl p-5 border transition-all duration-300 relative ${
                    isActive 
                      ? isLong 
                        ? 'border-emerald-500/30 hover:border-emerald-500/60 shadow-[0_0_15px_rgba(16,185,129,0.02)]' 
                        : 'border-rose-500/30 hover:border-rose-500/60 shadow-[0_0_15px_rgba(244,63,94,0.02)]'
                      : 'border-[#1F2942] opacity-75 hover:opacity-90'
                  }`}
                >
                  <div className="flex flex-wrap justify-between items-start gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-bold tracking-wider font-mono uppercase ${
                        isLong 
                          ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20' 
                          : isShort
                            ? 'text-rose-400 bg-rose-500/10 border border-rose-500/20'
                            : 'text-slate-400 bg-slate-500/10 border border-slate-500/20'
                      }`}>
                        {isLong ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                        {sig.signal_type}
                      </div>

                      <h3 className="text-base font-bold text-slate-100 font-mono tracking-tight uppercase">
                        {sig.ticker || 'UNKNOWN'}
                      </h3>
                      
                      <span className="text-[10px] text-slate-500 font-mono">
                        {sig.strategy_name}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-mono text-slate-500">
                        {new Date(sig.timestamp).toLocaleTimeString()}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-mono border ${
                        isActive
                          ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                          : 'text-rose-400 bg-rose-500/10 border-rose-500/20'
                      }`}>
                        {isActive ? 'PORTFOLIO_ACTIVE' : 'BLOCKED_RISK_LIMIT'}
                      </span>
                    </div>
                  </div>

                  {/* Sizing Details Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5 border-t border-[#1F2942]/40 pt-4 font-mono text-xs">
                    <div>
                      <div className="text-slate-500 text-[10px] uppercase">Entry Spot</div>
                      <div className="text-slate-200 font-bold mt-0.5">${sig.entry_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                    </div>
                    <div>
                      <div className="text-slate-500 text-[10px] uppercase">Target (TP)</div>
                      <div className="text-slate-200 font-bold mt-0.5">${sig.take_profit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                    </div>
                    <div>
                      <div className="text-slate-500 text-[10px] uppercase">Stop Loss (SL)</div>
                      <div className="text-slate-200 font-bold mt-0.5">${sig.stop_loss.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                    </div>
                    <div>
                      <div className="text-slate-500 text-[10px] uppercase">Risk Sizing (USD)</div>
                      <div className="text-cyan-400 font-bold mt-0.5">${sig.position_size_usd.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                    </div>
                  </div>

                  {/* RRR and descriptions */}
                  <div className="mt-4 flex flex-col md:flex-row md:justify-between items-start md:items-center gap-2 bg-[#0B0F19]/50 p-3 rounded-lg border border-[#1F2942]/60 font-mono text-[10px] text-slate-400">
                    <div className="flex items-center gap-4">
                      <span>RRR: <strong className="text-slate-200">{sig.risk_reward_ratio.toFixed(2)}x</strong></span>
                      <span>Confidence: <strong className="text-slate-200">{(sig.confidence_score * 100).toFixed(0)}%</strong></span>
                      <span>Rank Score: <strong className="text-slate-200">{sig.rank_score.toFixed(5)}</strong></span>
                    </div>
                    <div className="text-slate-500 italic max-w-md truncate">
                      {sig.details.reason || sig.details.risk_status}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Exposure Ceiling Tracker (Right side - takes 1 col) */}
          <div className="space-y-6">
            <div className="flex items-center gap-2 text-slate-400 text-xs font-bold font-mono tracking-wider">
              <ShieldCheck className="w-4 h-4 text-cyan-400" /> RISK CONTROLS PANEL
            </div>

            {exposure && (
              <div className="glass-panel rounded-xl p-6 border border-[#1F2942] space-y-6">
                {/* Total Capital */}
                <div>
                  <div className="text-slate-500 text-[10px] uppercase font-mono tracking-wider">Baseline Capital Base</div>
                  <div className="text-3xl font-bold text-slate-100 font-mono tracking-tight mt-1">
                    ${exposure.total_equity_usd.toLocaleString()}
                  </div>
                </div>

                {/* Active Risk Sizing Gauge */}
                <div className="space-y-2 border-t border-[#1F2942]/50 pt-4">
                  <div className="flex justify-between items-baseline font-mono text-xs">
                    <span className="text-slate-500 uppercase text-[10px]">Active Sizing Risk</span>
                    <span className={`font-bold ${exposure.total_active_risk_pct >= 5.0 ? 'text-rose-400' : 'text-cyan-400'}`}>
                      {exposure.total_active_risk_pct.toFixed(2)}% / 5.00%
                    </span>
                  </div>
                  
                  {/* Visual Sizing Bar */}
                  <div className="w-full bg-[#0B0F19] h-2.5 rounded-full overflow-hidden border border-[#1F2942]">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(6,182,212,0.2)] ${
                        exposure.total_active_risk_pct >= 5.0 
                          ? 'bg-rose-500' 
                          : exposure.total_active_risk_pct >= 4.0 
                            ? 'bg-amber-500' 
                            : 'bg-cyan-500'
                      }`}
                      style={{ width: `${(exposure.total_active_risk_pct / 5.0) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Capacity breakdown */}
                <div className="grid grid-cols-2 gap-4 border-t border-[#1F2942]/50 pt-4 font-mono text-xs">
                  <div>
                    <div className="text-slate-500 text-[10px] uppercase">Active Risk</div>
                    <div className="text-slate-200 font-bold mt-1">${exposure.total_active_risk_usd.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-slate-500 text-[10px] uppercase">Active Trades</div>
                    <div className="text-slate-200 font-bold mt-1">{exposure.active_positions_count} open</div>
                  </div>
                </div>

                {/* Remaining Capacity */}
                <div className="p-4 rounded-lg bg-[#0B0F19]/60 border border-[#1F2942]/80 font-mono text-xs flex justify-between items-center">
                  <span className="text-slate-500 uppercase text-[10px]">Capacity Remaining:</span>
                  <span className="text-emerald-400 font-bold">${exposure.remaining_risk_capacity_usd.toLocaleString()}</span>
                </div>

                {/* Limit status note */}
                <div className="flex gap-2 p-3 rounded bg-cyan-500/5 border border-cyan-500/10 font-mono text-[9px] text-slate-400">
                  <AlertOctagon className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                  <span>The Risk Controller strictly blocks new signals if the aggregate active risk breaches the 5% portfolio risk ceiling ($5,000).</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
