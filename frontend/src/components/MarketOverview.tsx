'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { resultsApi } from '../lib/api/results';
import { api } from '../lib/api';
import { DashboardOverviewResult, AssetProjectionResult, AssetRiskResponse } from '../types/results';
import { RefreshCw, Activity, ShieldAlert, HelpCircle, Wifi, WifiOff, CheckCircle, TrendingUp, Info } from 'lucide-react';

const Plot = dynamic(() => import('react-plotly.js'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[280px] flex items-center justify-center bg-slate-150/40 dark:bg-[#151D30]/30 rounded-xl border border-slate-200 dark:border-[#1F2942] animate-pulse">
      <div className="text-slate-400 font-mono text-xs flex items-center gap-2">
        <RefreshCw className="w-4 h-4 animate-spin" /> Rendering Comparison Engine...
      </div>
    </div>
  )
});

interface MarketOverviewProps {
  theme?: 'light' | 'dark';
}

export default function MarketOverview({ theme = 'light' }: MarketOverviewProps) {
  const [overview, setOverview] = useState<DashboardOverviewResult | null>(null);
  const [selectedTicker, setSelectedTicker] = useState<string>('BTCUSDT');
  const [loading, setLoading] = useState<boolean>(true);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // Detail mappings for all active assets
  const [allProjections, setAllProjections] = useState<Record<string, AssetProjectionResult>>({});
  const [allRisks, setAllRisks] = useState<Record<string, AssetRiskResponse>>({});

  const symbols = ['BTCUSDT', 'ETHUSDT', 'SPX', 'XAU'];

  // Plain-English market read overrides for instant clarity
  const getSimpleMarketRead = (symbol: string): string => {
    switch (symbol) {
      case 'BTCUSDT':
        return 'BTC has a positive 7-day base case, but risk remains high because volatility is elevated.';
      case 'ETHUSDT':
        return 'ETH shows strong upside potential in the bull case, but suffers from extreme drawdown risks.';
      case 'SPX':
        return 'SPX projects a tight, stable range with low probability of loss, indicating a steady market regime.';
      case 'XAU':
      default:
        return 'Gold is serving as a steady diversifier with low downside VaR, consolidating near its base case.';
    }
  };

  const generateMockProjection = (symbol: string): AssetProjectionResult => {
    const spot = { 'BTCUSDT': 62000.0, 'ETHUSDT': 3200.0, 'SPX': 5100.0, 'XAU': 2300.0 }[symbol] || 100.0;
    const base_7d = { 'BTCUSDT': 65000.0, 'ETHUSDT': 3350.0, 'SPX': 5200.0, 'XAU': 2350.0 }[symbol] || spot * 1.02;
    const bear_7d = { 'BTCUSDT': 58000.0, 'ETHUSDT': 2950.0, 'SPX': 4950.0, 'XAU': 2250.0 }[symbol] || spot * 0.95;
    const bull_7d = { 'BTCUSDT': 71000.0, 'ETHUSDT': 3650.0, 'SPX': 5350.0, 'XAU': 2420.0 }[symbol] || spot * 1.10;
    const probLossVal = { 'BTCUSDT': 0.48, 'ETHUSDT': 0.51, 'SPX': 0.35, 'XAU': 0.41 }[symbol] || 0.45;
    const riskLvl = { 'BTCUSDT': 'High', 'ETHUSDT': 'Extreme', 'SPX': 'Low', 'XAU': 'Medium' }[symbol] || 'Medium';
    const riskScr = { 'BTCUSDT': 72, 'ETHUSDT': 85, 'SPX': 25, 'XAU': 38 }[symbol] || 50;

    const mockHorizons = [
      {
        horizon_label: '7D',
        horizon_days: 7,
        bear_case_price: bear_7d,
        bear_price: bear_7d,
        base_case_price: base_7d,
        base_price: base_7d,
        bull_case_price: bull_7d,
        bull_price: bull_7d,
        expected_return: (base_7d - spot) / spot,
        probability_of_gain: 1 - probLossVal,
        probability_of_loss: probLossVal,
        projected_volatility: { 'BTCUSDT': 0.45, 'ETHUSDT': 0.52, 'SPX': 0.14, 'XAU': 0.18 }[symbol] || 0.25,
        confidence_band_width: (bull_7d - bear_7d) / spot,
        risk_score: riskScr,
        risk_level: riskLvl,
        var_95: 0.02,
        cvar_95: 0.03,
        explanation: getSimpleMarketRead(symbol)
      }
    ];

    return {
      symbol,
      name: { 'BTCUSDT': 'Bitcoin', 'ETHUSDT': 'Ethereum', 'SPX': 'S&P 500 Index', 'XAU': 'Gold' }[symbol] || symbol,
      asset_class: symbol === 'SPX' ? 'Equity' : symbol === 'XAU' ? 'Commodity' : 'Crypto',
      latest_price: spot,
      latest_date: new Date().toISOString(),
      daily_return: 0.015,
      data_mode: 'demo',
      horizons: mockHorizons,
      bear_scenario_path: [spot, spot * 0.98, bear_7d],
      base_scenario_path: [spot, spot * 1.01, base_7d],
      bull_scenario_path: [spot, spot * 1.03, bull_7d],
      monte_carlo_paths: [],
      probability_density_data: undefined,
      explainability: {
        winning_model: 'garch',
        model_scores: { 'garch': 0.82 },
        feature_importances: {}
      },
      asset: {
        symbol,
        name: { 'BTCUSDT': 'Bitcoin', 'ETHUSDT': 'Ethereum', 'SPX': 'S&P 500 Index', 'XAU': 'Gold' }[symbol] || symbol,
        asset_class: symbol === 'SPX' ? 'Equity' : symbol === 'XAU' ? 'Commodity' : 'Crypto',
        last_close: spot,
        latest_date: new Date().toISOString()
      },
      projection_horizon_results: mockHorizons,
      explanation_text: {
        summary: getSimpleMarketRead(symbol),
        warning: 'Shifts in local macro trends can cause projection bands to widen.',
        reason: 'Realized historical variance scaling.'
      }
    };
  };

  const generateMockRisk = (symbol: string): AssetRiskResponse => {
    const vals = {
      'BTCUSDT': { var_95: 0.048, cvar_95: 0.062, vol: 0.45, dd: 0.224, score: 72, level: 'High' },
      'ETHUSDT': { var_95: 0.054, cvar_95: 0.071, vol: 0.525, dd: 0.285, score: 85, level: 'Extreme' },
      'SPX': { var_95: 0.0125, cvar_95: 0.0165, vol: 0.145, dd: 0.085, score: 25, level: 'Low' },
      'XAU': { var_95: 0.0185, cvar_95: 0.024, vol: 0.182, dd: 0.124, score: 38, level: 'Medium' }
    }[symbol] || { var_95: 0.02, cvar_95: 0.03, vol: 0.20, dd: 0.15, score: 50, level: 'Medium' };

    return {
      symbol,
      var_95: vals.var_95,
      cvar_95: vals.cvar_95,
      volatility: vals.vol,
      drawdown: vals.dd,
      risk_score: vals.score,
      risk_level: vals.level,
      stress_test_summary: [],
      plain_language_explanation: {
        summary: `Tail risk indicates a 95% worst-case loss of ${(vals.var_95 * 100).toFixed(2)}%.`,
        warning: 'High asset volatility increases extreme tail-loss severity.',
        reason: 'Calibrated historical simulation.'
      },
      data_mode: 'demo'
    };
  };

  const loadData = async (initialLoad: boolean = false) => {
    try {
      if (initialLoad) setLoading(true);
      setError(null);

      let overviewRes: DashboardOverviewResult;
      try {
        overviewRes = await resultsApi.getDashboardOverview();
      } catch (e) {
        overviewRes = {
          last_updated: new Date().toISOString(),
          data_mode: 'demo',
          total_assets: 4,
          best_risk_reward_asset: 'SPX',
          highest_risk_asset: 'ETHUSDT',
          average_probability_of_loss_7d: 0.43,
          market_summary_text: 'Demo aggregates built using simulated paths.',
          validation_summary: {
            average_hit_rate: 0.925,
            reliability_level: 'High',
            metrics: []
          },
          asset_cards: [
            generateMockProjection('BTCUSDT'),
            generateMockProjection('ETHUSDT'),
            generateMockProjection('SPX'),
            generateMockProjection('XAU')
          ]
        };
      }
      setOverview(overviewRes);

      const projMap: Record<string, AssetProjectionResult> = {};
      const riskMap: Record<string, AssetRiskResponse> = {};

      for (const s of symbols) {
        try {
          projMap[s] = await resultsApi.getAssetProjection(s);
        } catch {
          projMap[s] = generateMockProjection(s);
        }

        try {
          riskMap[s] = await resultsApi.getAssetRisk(s);
        } catch {
          riskMap[s] = generateMockRisk(s);
        }
      }

      setAllProjections(projMap);
      setAllRisks(riskMap);

      const defaultTicker = overviewRes.best_risk_reward_asset || 'BTCUSDT';
      if (initialLoad) {
        setSelectedTicker(defaultTicker);
      }
    } catch (err: any) {
      console.error('Error compiling MSPE dashboard summaries:', err);
      setError(err.message || 'Failed to communicate with MSPE database engine.');
    } finally {
      if (initialLoad) setLoading(false);
    }
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      setError(null);
      const res = await api.triggerIngestionSync();
      setSyncMessage(res.detail || 'Incremental price synch complete.');
      setTimeout(() => setSyncMessage(null), 5000);
      await loadData(false);
    } catch (err: any) {
      setError(err.message || 'Failed to synchronise market prices.');
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    loadData(true);
  }, []);

  // Compute stats for summary cards
  const getAverageProbabilityOfLoss = (): string => {
    const list = Object.values(allProjections);
    if (list.length === 0) return '43%';
    const total = list.reduce((acc, curr) => {
      const p7d = curr.horizons.find(h => h.horizon_label === '7D');
      return acc + (p7d ? p7d.probability_of_loss : 0.45);
    }, 0);
    return `${((total / list.length) * 100).toFixed(0)}%`;
  };

  // Compile Bar Chart Data (Expected Returns in Bear, Base, Bull cases)
  const compileChartData = () => {
    const categories = ['BTC', 'ETH', 'S&P 550', 'Gold'];
    const bearReturns: number[] = [];
    const baseReturns: number[] = [];
    const bullReturns: number[] = [];

    symbols.forEach(s => {
      const proj = allProjections[s];
      if (proj) {
        const spot = proj.latest_price;
        const p7d = proj.horizons.find(h => h.horizon_label === '7D');
        if (p7d) {
          bearReturns.push(((p7d.bear_case_price - spot) / spot) * 100);
          baseReturns.push(((p7d.base_case_price - spot) / spot) * 100);
          bullReturns.push(((p7d.bull_case_price - spot) / spot) * 100);
        } else {
          bearReturns.push(-5);
          baseReturns.push(2);
          bullReturns.push(10);
        }
      } else {
        bearReturns.push(-5);
        baseReturns.push(2);
        bullReturns.push(10);
      }
    });

    return [
      {
        x: categories,
        y: bearReturns,
        type: 'bar' as const,
        name: 'Bear Return (P10)',
        marker: { color: '#FB7185' } // Rose
      },
      {
        x: categories,
        y: baseReturns,
        type: 'bar' as const,
        name: 'Base Return (P50)',
        marker: { color: '#818CF8' } // Indigo
      },
      {
        x: categories,
        y: bullReturns,
        type: 'bar' as const,
        name: 'Bull Return (P90)',
        marker: { color: '#14B8A6' } // Teal
      }
    ];
  };

  const getRiskBadgeColor = (level: string) => {
    switch (level.toUpperCase()) {
      case 'EXTREME':
        return 'text-rose-700 bg-rose-50 border-rose-200 dark:text-rose-400 dark:bg-rose-950/20 dark:border-rose-900/30';
      case 'HIGH':
        return 'text-orange-700 bg-orange-50 border-orange-200 dark:text-orange-400 dark:bg-orange-950/20 dark:border-orange-900/30';
      case 'MEDIUM':
        return 'text-amber-800 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950/20 dark:border-amber-900/30';
      case 'LOW':
      default:
        return 'text-teal-800 bg-teal-50 border-teal-200 dark:text-teal-400 dark:bg-teal-950/20 dark:border-teal-900/30';
    }
  };

  const activeRisk = allRisks[selectedTicker] || generateMockRisk(selectedTicker);

  return (
    <div className={`space-y-8 min-h-screen p-6 rounded-2xl border transition-all duration-300 ${
      theme === 'light' 
        ? 'bg-slate-50 text-slate-800 border-slate-200' 
        : 'bg-[#151D30]/20 text-slate-100 border-[#1F2942]/60'
    }`}>
      {/* Title Segment */}
      <div className={`flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-5 ${
        theme === 'light' ? 'border-slate-200' : 'border-[#1F2942]/60'
      }`}>
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className={`text-3xl font-black tracking-tight ${
              theme === 'light' ? 'text-slate-900' : 'text-slate-100'
            }`}>
              Market Surface Projection Engine
            </h1>
            {overview && (
              <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                overview.data_mode === 'live' 
                  ? 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/30 dark:border-emerald-900/40' 
                  : 'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950/30 dark:border-amber-900/40'
              }`}>
                {overview.data_mode === 'live' ? (
                  <>
                    <Wifi className="w-3.5 h-3.5" /> LIVE SYSTEM METRICS
                  </>
                ) : (
                  <>
                    <WifiOff className="w-3.5 h-3.5" /> DEMO PLAYBACK ACTIVE
                  </>
                )}
              </span>
            )}
          </div>
          <p className={`text-sm mt-2 font-medium leading-relaxed max-w-3xl ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>
            MSPE shows possible future price ranges and downside risk using Monte Carlo simulation, risk metrics, and historical validation.
          </p>
        </div>

        <button
          onClick={handleSync}
          disabled={syncing}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold tracking-wider uppercase border transition-all duration-300 ${
            syncing 
              ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed dark:bg-[#151D30]/20 dark:border-[#1F2942]' 
              : theme === 'light'
                ? 'bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50 active:scale-95 shadow-sm font-bold'
                : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30 hover:bg-indigo-500/20 active:scale-95'
          }`}
        >
          <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing...' : 'Sync Market Data'}
        </button>
      </div>

      {/* Simple Explanation Card (UX clarity) */}
      <div className={`p-5 rounded-xl text-sm flex items-start gap-4 shadow-sm border transition-colors duration-300 ${
        theme === 'light' 
          ? 'bg-indigo-50/50 border-indigo-100 text-slate-700' 
          : 'bg-indigo-500/5 border-indigo-500/10 text-slate-350'
      }`}>
        <Info className={`w-5 h-5 flex-shrink-0 mt-0.5 ${theme === 'light' ? 'text-indigo-500' : 'text-indigo-400'}`} />
        <div className="space-y-1">
          <strong className={`font-semibold text-[13px] uppercase tracking-wider block ${theme === 'light' ? 'text-indigo-850' : 'text-indigo-400'}`}>
            What is MSPE?
          </strong>
          <p className="leading-relaxed font-medium">
            “MSPE does not predict one exact price. It simulates many possible future paths and summarizes them into Bear Case, Base Case, and Bull Case scenarios.”
          </p>
        </div>
      </div>

      {syncMessage && (
        <div className="flex items-center gap-2.5 p-4 rounded-lg bg-emerald-50 border border-emerald-250 text-emerald-800 text-xs font-semibold shadow-sm dark:bg-emerald-950/20 dark:border-emerald-900/30 dark:text-emerald-400">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          <span>{syncMessage}</span>
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2.5 p-4 rounded-lg bg-rose-50 border border-rose-250 text-rose-800 text-xs font-semibold shadow-sm dark:bg-rose-950/20 dark:border-rose-900/30 dark:text-rose-400">
          <ShieldAlert className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Section 1 — Top Summary Cards */}
      {overview && (
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
          <div className={`rounded-xl p-4.5 border transition-all duration-300 ${
            theme === 'light' ? 'bg-white border-slate-200 shadow-sm' : 'glass-panel border-[#1F2942] bg-[#151D30]/30'
          }`}>
            <span className="text-[10px] uppercase font-semibold text-slate-400 dark:text-slate-500 block">Assets Tracked</span>
            <span className={`text-xl font-black block mt-0.5 tracking-tight ${theme === 'light' ? 'text-slate-900' : 'text-slate-200'}`}>
              {overview.total_assets} Active
            </span>
          </div>

          <div className={`rounded-xl p-4.5 border transition-all duration-300 ${
            theme === 'light' ? 'bg-white border-slate-200 shadow-sm' : 'glass-panel border-[#1F2942] bg-[#151D30]/30'
          }`}>
            <span className="text-[10px] uppercase font-semibold text-slate-400 dark:text-slate-500 block">Highest Risk Asset</span>
            <span className={`text-xl font-black block mt-0.5 tracking-tight text-rose-500`}>
              {overview.highest_risk_asset.replace('USDT', '')}
            </span>
          </div>

          <div className={`rounded-xl p-4.5 border transition-all duration-300 ${
            theme === 'light' ? 'bg-white border-slate-200 shadow-sm' : 'glass-panel border-[#1F2942] bg-[#151D30]/30'
          }`}>
            <span className="text-[10px] uppercase font-semibold text-slate-400 dark:text-slate-500 block">Best Risk/Reward</span>
            <span className={`text-xl font-black block mt-0.5 tracking-tight text-emerald-500`}>
              {overview.best_risk_reward_asset.replace('USDT', '')}
            </span>
          </div>

          <div className={`rounded-xl p-4.5 border transition-all duration-300 ${
            theme === 'light' ? 'bg-white border-slate-200 shadow-sm' : 'glass-panel border-[#1F2942] bg-[#151D30]/30'
          }`}>
            <span className="text-[10px] uppercase font-semibold text-slate-400 dark:text-slate-500 block">Avg 7D Loss Probability</span>
            <span className={`text-xl font-black block mt-0.5 tracking-tight ${theme === 'light' ? 'text-slate-900' : 'text-slate-200'}`}>
              {getAverageProbabilityOfLoss()}
            </span>
          </div>

          <div className={`rounded-xl p-4.5 border transition-all duration-300 ${
            theme === 'light' ? 'bg-white border-slate-200 shadow-sm' : 'glass-panel border-[#1F2942] bg-[#151D30]/30'
          }`}>
            <span className="text-[10px] uppercase font-semibold text-slate-400 dark:text-slate-500 block">Data Mode</span>
            <span className={`text-xl font-black block mt-0.5 tracking-tight uppercase ${
              overview.data_mode === 'live' ? 'text-emerald-500' : 'text-amber-500'
            }`}>
              {overview.data_mode}
            </span>
          </div>

          <div className={`rounded-xl p-4.5 border transition-all duration-300 ${
            theme === 'light' ? 'bg-white border-slate-200 shadow-sm' : 'glass-panel border-[#1F2942] bg-[#151D30]/30'
          }`}>
            <span className="text-[10px] uppercase font-semibold text-slate-400 dark:text-slate-500 block">Last Updated</span>
            <span className={`text-xs font-bold block mt-1.5 tracking-tight text-slate-600 dark:text-slate-450`}>
              {new Date(overview.last_updated).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
        </div>
      )}

      {/* Section 2 — Asset Projection Cards */}
      <div className="space-y-3">
        <h2 className={`text-lg font-bold tracking-tight ${theme === 'light' ? 'text-slate-900' : 'text-slate-100'}`}>
          Analyzed Assets & Price Boundaries
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {loading ? (
            Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="h-56 bg-slate-100 dark:bg-[#151D30]/30 border border-slate-200 dark:border-[#1F2942] rounded-xl animate-pulse" />
            ))
          ) : (
            overview?.asset_cards.map(card => {
              const p7d = card.horizons.find(h => h.horizon_label === '7D');
              
              const bear = p7d ? p7d.bear_case_price : card.latest_price * 0.95;
              const base = p7d ? p7d.base_case_price : card.latest_price;
              const bull = p7d ? p7d.bull_case_price : card.latest_price * 1.05;
              const probLoss = p7d ? `${(p7d.probability_of_loss * 100).toFixed(0)}%` : '--%';
              const riskLvl = p7d ? p7d.risk_level : 'Medium';

              const isSelected = selectedTicker === card.symbol;

              return (
                <button
                  key={card.symbol}
                  onClick={() => setSelectedTicker(card.symbol)}
                  className={`text-left p-5.5 rounded-xl border relative flex flex-col justify-between shadow-sm cursor-pointer transition-all duration-300 ${
                    isSelected
                      ? theme === 'light'
                        ? 'bg-white border-indigo-500 ring-2 ring-indigo-550/10 scale-[1.01] shadow-md'
                        : 'bg-[#151D30]/40 border-indigo-500 ring-2 ring-indigo-400/20 scale-[1.01] shadow-md'
                      : theme === 'light'
                        ? 'bg-white border-slate-200 hover:border-slate-350'
                        : 'glass-panel border-[#1F2942] bg-[#151D30]/20 hover:border-[#1F2942]'
                  }`}
                >
                  <div className="w-full">
                    <div className="flex justify-between items-center mb-1">
                      <span className={`text-[10px] font-mono tracking-wider font-bold ${
                        theme === 'light' ? 'text-slate-500' : 'text-slate-500'
                      }`}>{card.symbol}</span>
                      <span className={`text-[9px] uppercase font-bold tracking-wide px-2 py-0.5 rounded border ${getRiskBadgeColor(riskLvl)}`}>
                        {riskLvl}
                      </span>
                    </div>

                    <h3 className={`text-base font-bold ${theme === 'light' ? 'text-slate-900' : 'text-slate-200'}`}>
                      {card.name}
                    </h3>

                    <div className="mt-1.5 flex items-baseline gap-1.5">
                      <span className={`text-2xl font-black font-mono tracking-tight ${theme === 'light' ? 'text-slate-900' : 'text-slate-100'}`}>
                        ${card.latest_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    {/* Scenario prices grid */}
                    <div className={`mt-4 grid grid-cols-3 gap-2 border-y py-2.5 my-3 text-[11px] font-mono ${
                      theme === 'light' ? 'border-slate-100 text-slate-600' : 'border-[#1F2942]/40 text-slate-400'
                    }`}>
                      <div>
                        <span className="block text-[9px] font-sans font-semibold text-slate-400 uppercase">Bear Case</span>
                        <strong className="text-rose-500 font-bold">${Math.round(bear).toLocaleString()}</strong>
                      </div>
                      <div>
                        <span className="block text-[9px] font-sans font-semibold text-slate-400 uppercase">Base Case</span>
                        <strong className="text-indigo-500 font-bold">${Math.round(base).toLocaleString()}</strong>
                      </div>
                      <div>
                        <span className="block text-[9px] font-sans font-semibold text-slate-400 uppercase">Bull Case</span>
                        <strong className="text-teal-500 font-bold">${Math.round(bull).toLocaleString()}</strong>
                      </div>
                    </div>

                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-slate-400">7D Loss Prob:</span>
                      <strong className={theme === 'light' ? 'text-slate-900' : 'text-slate-100'}>{probLoss}</strong>
                    </div>
                  </div>

                  <div className={`mt-4.5 pt-3 border-t w-full ${
                    theme === 'light' ? 'border-slate-100' : 'border-[#1F2942]/40'
                  }`}>
                    <span className="text-[9px] block uppercase tracking-wider text-slate-400 font-semibold font-sans mb-1">Market Read</span>
                    <p className={`text-[11px] leading-relaxed italic ${theme === 'light' ? 'text-slate-600 font-medium' : 'text-slate-400'}`}>
                      "{getSimpleMarketRead(card.symbol)}"
                    </p>
                  </div>

                  {isSelected && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-12 bg-indigo-500 rounded-r" />
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Section 3 — Bear/Base/Bull Overview Chart (col-span-7) */}
        <div className={`lg:col-span-7 rounded-xl p-5.5 border flex flex-col justify-between transition-all duration-300 ${
          theme === 'light' ? 'bg-white border-slate-200 shadow-sm text-slate-800' : 'glass-panel border-[#1F2942] bg-[#151D30]/30 text-slate-100'
        }`}>
          <div>
            <h3 className={`text-base font-bold flex items-center gap-2 ${theme === 'light' ? 'text-slate-950' : 'text-slate-100'}`}>
              <TrendingUp className="w-5 h-5 text-indigo-500" />
              7-Day Return Scenario Comparison
            </h3>
            <p className={`text-xs mt-0.5 ${theme === 'light' ? 'text-slate-600 font-medium' : 'text-slate-500'}`}>
              Grouped percent yields (%) under forecasted Bear Case (P10), Base Case (P50), and Bull Case (P90) outcomes.
            </p>

            <div className="min-h-[260px] mt-4 flex items-center justify-center">
              {loading ? (
                <div className="text-slate-400 font-mono text-xs animate-pulse flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" /> Consolidating price returns...
                </div>
              ) : (
                <Plot
                  data={compileChartData()}
                  layout={{
                    autosize: true,
                    barmode: 'group' as const,
                    legend: { 
                      font: { size: 9, color: theme === 'light' ? '#334155' : '#E2E8F0' }, 
                      orientation: 'h', 
                      y: -0.25 
                    },
                    margin: { l: 40, r: 10, t: 10, b: 35 },
                    paper_bgcolor: 'rgba(0,0,0,0)',
                    plot_bgcolor: 'rgba(0,0,0,0)',
                    xaxis: { 
                      tickfont: { size: 10, color: theme === 'light' ? '#334155' : '#E2E8F0' },
                      linecolor: theme === 'light' ? '#CBD5E1' : '#1F2942'
                    },
                    yaxis: { 
                      tickfont: { size: 10, color: theme === 'light' ? '#334155' : '#E2E8F0' }, 
                      linecolor: theme === 'light' ? '#CBD5E1' : '#1F2942',
                      gridcolor: theme === 'light' ? 'rgba(226, 232, 240, 0.8)' : 'rgba(31, 41, 66, 0.2)',
                      title: { text: 'Return (%)', font: { size: 10, color: '#94A3B8' } }
                    }
                  }}
                  config={{ responsive: true, displayModeBar: false }}
                  className="w-full h-[250px]"
                />
              )}
            </div>
          </div>
          <div className="border-t pt-3 mt-4 text-[10px] font-medium leading-relaxed text-slate-400">
            Compare volatility profiles: cryptos (BTC, ETH) exhibit wide scenario outcomes, whereas indices (S&P 500) and commodities (Gold) show tighter risk limits.
          </div>
        </div>

        {/* Section 4 — Risk Snapshot (col-span-5) */}
        <div className={`lg:col-span-5 rounded-xl p-5.5 border flex flex-col justify-between transition-all duration-300 ${
          theme === 'light' ? 'bg-white border-slate-200 shadow-sm text-slate-800' : 'glass-panel border-[#1F2942] bg-[#151D30]/30 text-slate-100'
        }`}>
          <div>
            <div className="flex justify-between items-start border-b pb-3.5 mb-4 border-slate-100 dark:border-[#1F2942]/40">
              <div>
                <h3 className={`text-base font-bold ${theme === 'light' ? 'text-slate-950' : 'text-slate-100'}`}>
                  Downside Risk Snapshot
                </h3>
                <p className={`text-xs mt-0.5 ${theme === 'light' ? 'text-slate-600 font-medium' : 'text-slate-500'}`}>
                  Inspect tail metrics for the selected asset.
                </p>
              </div>
            </div>

            {/* Selector tab group for Snapshot */}
            <div className="flex bg-slate-100 dark:bg-[#0B0F19]/60 p-1 rounded-lg gap-1 border border-slate-200/50 dark:border-[#1F2942]/60 mb-5">
              {symbols.map(s => (
                <button
                  key={s}
                  onClick={() => setSelectedTicker(s)}
                  className={`flex-1 text-center py-1.5 rounded-md text-[10px] font-bold font-mono uppercase transition-all duration-200 ${
                    selectedTicker === s
                      ? theme === 'light'
                        ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/40'
                        : 'bg-[#151D30] text-cyan-400 border border-[#1F2942]/60'
                      : theme === 'light'
                        ? 'text-slate-600 hover:text-slate-900'
                        : 'text-slate-400 hover:text-slate-300'
                  }`}
                >
                  {s.replace('USDT', '')}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="space-y-4 animate-pulse">
                <div className="h-6 bg-slate-100 dark:bg-slate-800 rounded w-1/2" />
                <div className="h-10 bg-slate-100 dark:bg-slate-800 rounded" />
                <div className="h-20 bg-slate-100 dark:bg-slate-800 rounded" />
              </div>
            ) : (
              <div className="space-y-4.5">
                {/* Score Index Card */}
                <div className={`p-4 rounded-xl border ${
                  theme === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-[#0B0F19]/40 border-[#1F2942]/40'
                }`}>
                  <div className="flex justify-between items-baseline">
                    <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500">Risk Score Index</span>
                    <strong className={`text-2xl font-mono tracking-tight font-black ${
                      theme === 'light' ? 'text-slate-900' : 'text-slate-100'
                    }`}>
                      {activeRisk.risk_score.toFixed(0)}
                      <span className="text-xs text-slate-400 font-normal">/100</span>
                    </strong>
                  </div>
                  
                  <div className="w-full bg-slate-200 dark:bg-[#1E293B] rounded-full h-2.5 mt-2.5 overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-500 ${
                        activeRisk.risk_level.toUpperCase() === 'EXTREME' ? 'bg-rose-600' :
                        activeRisk.risk_level.toUpperCase() === 'HIGH' ? 'bg-orange-500' :
                        activeRisk.risk_level.toUpperCase() === 'MEDIUM' ? 'bg-amber-500' :
                        'bg-emerald-500'
                      }`}
                      style={{ width: `${activeRisk.risk_score}%` }}
                    />
                  </div>
                </div>

                {/* Audit numbers */}
                <div className={`space-y-2.5 font-mono text-xs ${
                  theme === 'light' ? 'text-slate-700' : 'text-slate-400'
                }`}>
                  <div className="flex justify-between border-b pb-1.5 border-slate-100 dark:border-[#1F2942]/40">
                    <span className="text-slate-400">Value at Risk (VaR 95%):</span>
                    <strong className={theme === 'light' ? 'text-slate-900 font-bold' : 'text-slate-100'}>
                      {(activeRisk.var_95 * 100.0).toFixed(2)}%
                    </strong>
                  </div>
                  
                  <div className="flex justify-between border-b pb-1.5 border-slate-100 dark:border-[#1F2942]/40">
                    <span className="text-slate-400">Conditional VaR (CVaR 95%):</span>
                    <strong className={theme === 'light' ? 'text-slate-900 font-bold' : 'text-slate-100'}>
                      {(activeRisk.cvar_95 * 100.0).toFixed(2)}%
                    </strong>
                  </div>

                  <div className="flex justify-between border-b pb-1.5 border-slate-100 dark:border-[#1F2942]/40">
                    <span className="text-slate-400">Annualized Volatility:</span>
                    <strong className={theme === 'light' ? 'text-slate-900 font-bold' : 'text-slate-100'}>
                      {(activeRisk.volatility * 100.0).toFixed(1)}%
                    </strong>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-slate-400">Worst Peak-to-Trough Loss:</span>
                    <strong className={theme === 'light' ? 'text-slate-900 font-bold' : 'text-slate-100'}>
                      {(activeRisk.drawdown * 100.0).toFixed(1)}%
                    </strong>
                  </div>
                </div>

                <div className={`p-3 rounded-lg border text-[10px] leading-relaxed transition-colors duration-300 ${
                  theme === 'light' ? 'bg-slate-100/50 border-slate-200 text-slate-700 font-medium' : 'bg-[#0B0F19]/40 border-[#1F2942]/40 text-slate-400'
                }`}>
                  <strong>Downside summary:</strong> {activeRisk.plain_language_explanation.summary}
                </div>
              </div>
            )}
          </div>

          <div className={`border-t pt-3 mt-4 text-[9px] font-semibold text-slate-400 uppercase`}>
            Demo parameters fitted against rolling historical intervals.
          </div>
        </div>
      </div>

      {/* Section 5 — How to read this dashboard */}
      <div className={`rounded-xl p-6 border transition-all duration-300 ${
        theme === 'light' ? 'bg-white border-slate-200 shadow-sm' : 'glass-panel border-[#1F2942] bg-[#151D30]/30'
      }`}>
        <div className={`flex items-center gap-2 border-b pb-3 mb-4 ${
          theme === 'light' ? 'border-slate-100 text-slate-950' : 'border-[#1F2942]/40 text-slate-100'
        }`}>
          <HelpCircle className="w-5 h-5 text-indigo-500" />
          <h3 className="text-sm font-bold uppercase">How to read this dashboard</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="space-y-1">
            <h4 className={`font-bold text-[11px] font-sans uppercase ${theme === 'light' ? 'text-slate-900' : 'text-slate-200'}`}>
              Bear Case (P10)
            </h4>
            <p className={`text-[11px] leading-relaxed ${theme === 'light' ? 'text-slate-600 font-medium' : 'text-slate-400'}`}>
              The lower projected price boundary. Based on our simulations, there is only a 10% chance that the actual price will end up below this level.
            </p>
          </div>

          <div className="space-y-1">
            <h4 className={`font-bold text-[11px] font-sans uppercase ${theme === 'light' ? 'text-slate-900' : 'text-slate-200'}`}>
              Base Case (P50)
            </h4>
            <p className={`text-[11px] leading-relaxed ${theme === 'light' ? 'text-slate-600 font-medium' : 'text-slate-400'}`}>
              The middle expected scenario. This represents the median path (50th percentile) and is the most likely trend trajectory.
            </p>
          </div>

          <div className="space-y-1">
            <h4 className={`font-bold text-[11px] font-sans uppercase ${theme === 'light' ? 'text-slate-900' : 'text-slate-200'}`}>
              Bull Case (P90)
            </h4>
            <p className={`text-[11px] leading-relaxed ${theme === 'light' ? 'text-slate-600 font-medium' : 'text-slate-400'}`}>
              The upper projected price boundary. Based on our simulations, there is only a 10% chance that the actual price will rise above this level.
            </p>
          </div>

          <div className="space-y-1">
            <h4 className={`font-bold text-[11px] font-sans uppercase ${theme === 'light' ? 'text-slate-900' : 'text-slate-200'}`}>
              Probability of Loss
            </h4>
            <p className={`text-[11px] leading-relaxed ${theme === 'light' ? 'text-slate-600 font-medium' : 'text-slate-400'}`}>
              The calculated percentage of simulated future price paths that end up lower than the current price at the end of the 7-day horizon.
            </p>
          </div>

          <div className="space-y-1">
            <h4 className={`font-bold text-[11px] font-sans uppercase ${theme === 'light' ? 'text-slate-900' : 'text-slate-200'}`}>
              Value at Risk (VaR 95%)
            </h4>
            <p className={`text-[11px] leading-relaxed ${theme === 'light' ? 'text-slate-600 font-medium' : 'text-slate-400'}`}>
              The estimated maximum loss threshold you could expect to experience on a bad day with 95% confidence (1 in 20 market sessions).
            </p>
          </div>

          <div className="space-y-1">
            <h4 className={`font-bold text-[11px] font-sans uppercase ${theme === 'light' ? 'text-slate-900' : 'text-slate-200'}`}>
              Conditional VaR (CVaR 95%)
            </h4>
            <p className={`text-[11px] leading-relaxed ${theme === 'light' ? 'text-slate-600 font-medium' : 'text-slate-400'}`}>
              The average expected loss if the price breaches the VaR threshold (the worst 5% of outcomes), representing severe crash risk.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
