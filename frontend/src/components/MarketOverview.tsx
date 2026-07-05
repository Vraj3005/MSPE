'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { api } from '../lib/api';
import { resultsApi } from '../lib/api/results';
import { 
  DashboardOverviewResponse, 
  AssetProjectionResponse, 
  AssetRiskResponse, 
  MethodologyResponse
} from '../types/results';
import { RefreshCw, AlertTriangle, Shield, TrendingUp, HelpCircle, Activity, Info, Wifi, WifiOff, CheckCircle } from 'lucide-react';

// Dynamic Plotly import to prevent Server Side Rendering (SSR) issues in Next.js
const Plot = dynamic(() => import('react-plotly.js'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[320px] flex items-center justify-center bg-slate-100/50 rounded-xl border border-slate-200/50 animate-pulse">
      <div className="text-slate-400 font-mono text-xs flex items-center gap-2">
        <RefreshCw className="w-4 h-4 animate-spin" /> Compiling Forecast Paths...
      </div>
    </div>
  )
});

interface MarketOverviewProps {
  theme?: 'light' | 'dark';
}

export default function MarketOverview({ theme = 'light' }: MarketOverviewProps) {
  const [overview, setOverview] = useState<DashboardOverviewResponse | null>(null);
  const [projection, setProjection] = useState<AssetProjectionResponse | null>(null);
  const [risk, setRisk] = useState<AssetRiskResponse | null>(null);
  const [methodology, setMethodology] = useState<MethodologyResponse | null>(null);
  
  const [selectedTicker, setSelectedTicker] = useState<string>('BTCUSDT');
  const [loading, setLoading] = useState<boolean>(true);
  const [detailsLoading, setDetailsLoading] = useState<boolean>(false);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // Load baseline aggregates
  const loadOverviewData = async (initialLoad: boolean = false) => {
    try {
      if (initialLoad) setLoading(true);
      setError(null);
      
      const overviewRes = await resultsApi.getDashboardOverview();
      setOverview(overviewRes);
      
      const methRes = await resultsApi.getMethodology();
      setMethodology(methRes);
      
      // Default to best risk/reward asset on startup
      const defaultTicker = overviewRes.best_risk_reward_asset || 'BTCUSDT';
      if (initialLoad) {
        setSelectedTicker(defaultTicker);
        await loadAssetDetails(defaultTicker);
      } else {
        await loadAssetDetails(selectedTicker);
      }
    } catch (err: any) {
      console.error('Error loading overview results', err);
      setError(err.message || 'Failed to connect to the MSPE backend API.');
    } finally {
      if (initialLoad) setLoading(false);
    }
  };

  // Load detailed analytics for selected asset
  const loadAssetDetails = async (ticker: string) => {
    try {
      setDetailsLoading(true);
      const projRes = await resultsApi.getAssetProjection(ticker);
      setProjection(projRes);
      
      const riskRes = await resultsApi.getAssetRisk(ticker);
      setRisk(riskRes);
    } catch (err: any) {
      console.error(`Error loading asset details for ${ticker}`, err);
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      setSyncMessage(null);
      const res = await api.triggerIngestionSync();
      setSyncMessage(res.detail || 'Ingestion sync completed successfully.');
      setTimeout(() => setSyncMessage(null), 5000);
      await loadOverviewData(false);
    } catch (err: any) {
      setError(err.message || 'Failed to sync market data.');
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    loadOverviewData(true);
  }, []);

  const handleAssetSelect = async (ticker: string) => {
    setSelectedTicker(ticker);
    await loadAssetDetails(ticker);
  };

  // Premium, curated color palette for risk badges
  const getRiskBadgeStyle = (level: string) => {
    switch (level.toUpperCase()) {
      case 'EXTREME':
        return theme === 'light'
          ? 'text-rose-700 bg-rose-50 border-rose-200/60 font-bold'
          : 'text-rose-400 bg-rose-950/20 border-rose-900/30 font-bold';
      case 'HIGH':
        return theme === 'light'
          ? 'text-orange-700 bg-orange-50 border-orange-200/60 font-bold'
          : 'text-orange-400 bg-orange-950/20 border-orange-900/30 font-bold';
      case 'MEDIUM':
        return theme === 'light'
          ? 'text-amber-800 bg-amber-50/50 border-amber-200 font-bold'
          : 'text-amber-400 bg-amber-950/20 border-amber-900/30 font-bold';
      case 'LOW':
      default:
        return theme === 'light'
          ? 'text-teal-700 bg-teal-50 border-teal-200 font-bold'
          : 'text-teal-400 bg-teal-950/20 border-teal-900/30 font-bold';
    }
  };

  // Plotly chart ranges
  const plotTimestamps = ['Current', '1d Out', '3d Out', '7d Out', '30d Out'];
  const bearPrices = projection ? projection.bear_scenario_path : [0, 0, 0, 0, 0];
  const basePrices = projection ? projection.base_scenario_path : [0, 0, 0, 0, 0];
  const bullPrices = projection ? projection.bull_scenario_path : [0, 0, 0, 0, 0];

  return (
    <div className={`space-y-6 min-h-screen p-6 rounded-2xl border transition-all duration-300 ${
      theme === 'light' 
        ? 'bg-slate-50 text-slate-800 border-slate-200' 
        : 'bg-[#151D30]/20 text-slate-100 border-[#1F2942]/60'
    }`}>
      
      {/* Title Segment */}
      <div className={`flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-5 ${
        theme === 'light' ? 'border-slate-200' : 'border-[#1F2942]/60'
      }`}>
        <div>
          <div className="flex items-center gap-3">
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
                    <Wifi className="w-3.5 h-3.5" /> LIVE COMPUTED DATA
                  </>
                ) : (
                  <>
                    <WifiOff className="w-3.5 h-3.5" /> OFFLINE DEMO MODE
                  </>
                )}
              </span>
            )}
          </div>
          <p className={`text-sm mt-1.5 ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
            A full-stack market projection dashboard that shows possible future price ranges, downside risk, and bear/base/bull scenarios using Python forecasting, Monte Carlo simulation, and risk analytics.
          </p>
        </div>
        
        <button
          onClick={handleSync}
          disabled={syncing}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold tracking-wider uppercase border transition-all duration-300 ${
            syncing 
              ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed dark:bg-[#151D30]/20 dark:border-[#1F2942]' 
              : theme === 'light'
                ? 'bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50 active:scale-95 shadow-sm'
                : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30 hover:bg-indigo-500/20 active:scale-95 shadow-[0_0_15px_rgba(99,102,241,0.1)]'
          }`}
        >
          <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing...' : 'Sync Market Feeds'}
        </button>
      </div>

      {/* Top Explanation Card */}
      <div className={`p-5 rounded-xl text-sm flex items-start gap-4 shadow-sm border transition-colors duration-300 ${
        theme === 'light' 
          ? 'bg-indigo-50/40 border-indigo-100 text-slate-700' 
          : 'bg-indigo-500/5 border-indigo-500/20 text-slate-300'
      }`}>
        <Info className={`w-5 h-5 flex-shrink-0 mt-0.5 ${theme === 'light' ? 'text-indigo-500' : 'text-indigo-400'}`} />
        <div>
          <h4 className={`font-bold text-base ${theme === 'light' ? 'text-slate-900' : 'text-slate-200'}`}>What is MSPE?</h4>
          <p className={`leading-relaxed mt-1 ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>
            Instead of predicting one exact price, MSPE simulates many possible future paths and summarizes them into simple scenarios: 
            <strong> Bear Case (downside limit)</strong>, <strong>Base Case (most likely trend)</strong>, and <strong>Bull Case (upside target)</strong>.
          </p>
        </div>
      </div>

      {syncMessage && (
        <div className="flex items-center gap-2.5 p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium shadow-sm dark:bg-emerald-950/30 dark:border-emerald-900/40 dark:text-emerald-400">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          <span>{syncMessage}</span>
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2.5 p-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium shadow-sm dark:bg-rose-950/30 dark:border-rose-900/40 dark:text-rose-400">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Top KPI Cards Grid */}
      {overview && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {overview.top_cards.map((card, idx) => (
            <div key={idx} className={`rounded-xl p-5 shadow-sm border transition-all duration-300 ${
              theme === 'light' 
                ? 'bg-white border-slate-200 shadow-sm' 
                : 'glass-panel border-[#1F2942] bg-[#151D30]/30'
            }`}>
              <span className={`text-[10px] uppercase font-mono tracking-wider block ${
                theme === 'light' ? 'text-slate-500 font-bold' : 'text-slate-500'
              }`}>{card.title}</span>
              <span className={`text-2xl font-black block mt-1 tracking-tight ${
                theme === 'light' ? 'text-slate-900' : 'text-slate-200'
              }`}>{card.value}</span>
              <span className={`text-[11px] mt-1 block ${
                theme === 'light' ? 'text-slate-600' : 'text-slate-400'
              }`}>{card.description}</span>
            </div>
          ))}
        </div>
      )}

      {/* Asset Cards Grid - Rich Comparative Selector */}
      <div>
        <h2 className={`text-lg font-bold mb-3.5 tracking-tight flex items-center gap-2 ${
          theme === 'light' ? 'text-slate-800' : 'text-slate-200'
        }`}>
          <Activity className="w-5 h-5 text-indigo-500" />
          Markets Analyzed & Scenarios (Select Asset to View Details)
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={`rounded-xl p-5 h-52 animate-pulse shadow-sm border ${
                theme === 'light' ? 'bg-white border-slate-200' : 'bg-[#151D30]/10 border-[#1F2942]/40'
              }`} />
            ))
          ) : (
            overview?.asset_cards.map((card) => {
              const isSelected = selectedTicker === card.symbol;
              return (
                <button
                  key={card.symbol}
                  onClick={() => handleAssetSelect(card.symbol)}
                  className={`text-left transition-all duration-300 w-full relative p-5 rounded-xl flex flex-col justify-between shadow-sm cursor-pointer select-none border ${
                    isSelected 
                      ? theme === 'light'
                        ? 'bg-white border-indigo-500 ring-2 ring-indigo-500/10 shadow-md transform -translate-y-0.5' 
                        : 'border-indigo-500 ring-2 ring-indigo-400/20 bg-[#151D30]/40 shadow-md transform -translate-y-0.5'
                      : theme === 'light'
                        ? 'bg-white border-slate-200 hover:border-slate-300 hover:shadow'
                        : 'glass-panel border-[#1F2942] hover:border-indigo-500/40 bg-[#151D30]/10 hover:shadow'
                  }`}
                >
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className={`text-xs font-black tracking-tight ${
                        theme === 'light' ? 'text-slate-950 font-black' : 'text-slate-200'
                      }`}>{card.symbol}</span>
                      <span className={`text-[9px] tracking-wide px-2.5 py-0.5 rounded-full border uppercase font-bold ${getRiskBadgeStyle(card.risk_level)}`}>
                        {card.risk_level}
                      </span>
                    </div>
                    
                    <h3 className={`text-sm font-bold line-clamp-1 ${
                      theme === 'light' ? 'text-slate-900 font-bold' : 'text-slate-300'
                    }`}>{card.name}</h3>
                    
                    <div className={`mt-3.5 space-y-1.5 font-mono text-xs ${
                      theme === 'light' ? 'text-slate-700' : 'text-slate-400'
                    }`}>
                      <div className={`flex justify-between border-b pb-1 ${
                        theme === 'light' ? 'border-slate-100' : 'border-[#1F2942]/40'
                      }`}>
                        <span>Latest Close:</span>
                        <strong className={theme === 'light' ? 'text-slate-900 font-bold' : 'text-slate-100'}>
                          ${card.last_close.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </strong>
                      </div>
                      <div className={`flex justify-between border-b pb-1 ${
                        theme === 'light' ? 'border-slate-100' : 'border-[#1F2942]/40'
                      }`}>
                        <span>7D Base Case:</span>
                        <strong className="text-indigo-600">${card.base_case_7d.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</strong>
                      </div>
                      <div className={`flex justify-between text-[11px] ${
                        theme === 'light' ? 'text-slate-500 font-semibold' : 'text-slate-500'
                      }`}>
                        <span>Bear / Bull:</span>
                        <span>${card.base_case_7d * 0.95 > 0 ? (card.base_case_7d * 0.95).toFixed(0) : '--'} / ${(card.base_case_7d * 1.05).toFixed(0)}</span>
                      </div>
                    </div>
                  </div>

                  <div className={`mt-4 pt-3 border-t ${
                    theme === 'light' ? 'border-slate-100' : 'border-[#1F2942]/40'
                  }`}>
                    <span className={`text-[10px] block uppercase tracking-wider font-mono ${
                      theme === 'light' ? 'text-slate-500' : 'text-slate-500'
                    }`}>Market Read</span>
                    <p className={`text-[11px] mt-0.5 leading-relaxed line-clamp-2 italic ${
                      theme === 'light' ? 'text-slate-800 font-medium' : 'text-slate-400'
                    }`}>
                      "{card.market_read}"
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

      {/* Dynamic Projections & Risk Detail Sections */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Plotly Scenario Ranges */}
        <div className={`rounded-xl p-5 shadow-sm flex flex-col justify-between border transition-all duration-300 ${
          theme === 'light' 
            ? 'bg-white border-slate-200' 
            : 'glass-panel border-[#1F2942] bg-[#151D30]/30'
        }`}>
          <div className={`flex justify-between items-start border-b pb-3.5 mb-4 ${
            theme === 'light' ? 'border-slate-100' : 'border-[#1F2942]/40'
          }`}>
            <div>
              <h3 className={`text-base font-bold flex items-center gap-2 ${
                theme === 'light' ? 'text-slate-950' : 'text-slate-100'
              }`}>
                <TrendingUp className="w-5 h-5 text-indigo-500" />
                30-Day Scenario Price Outlook & Monte Carlo Pathways
              </h3>
              <p className={`text-xs mt-0.5 ${
                theme === 'light' ? 'text-slate-600 font-medium' : 'text-slate-500'
              }`}>Statistical boundaries and 5 sample path simulations for {selectedTicker}</p>
            </div>
            
            <span className={`text-[11px] border rounded px-2.5 py-1 font-mono font-bold uppercase ${
              theme === 'light' 
                ? 'bg-slate-100 border-slate-200 text-slate-500' 
                : 'bg-[#0B0F19]/60 border-[#1F2942]/60 text-slate-400'
            }`}>
              Days Horizon: 30
            </span>
          </div>

          <div className="flex-1 min-h-[300px]">
            {detailsLoading ? (
              <div className="w-full h-full flex items-center justify-center text-slate-400 font-mono text-xs animate-pulse">
                Recalculating Monte Carlo paths...
              </div>
            ) : (
              <Plot
                data={[
                  // Overlay 5 sample paths
                  ...(projection?.monte_carlo_paths || []).map((path, idx) => ({
                    x: plotTimestamps,
                    y: [
                      projection?.asset.last_close || 0,
                      path[1],
                      path[3],
                      path[7],
                      path[30]
                    ],
                    type: 'scatter' as const,
                    mode: 'lines' as const,
                    name: `Sim Path ${idx + 1}`,
                    line: { 
                      color: theme === 'light' ? 'rgba(148, 163, 184, 0.25)' : 'rgba(148, 163, 184, 0.12)', 
                      width: 1.5, 
                      shape: 'spline' as const 
                    },
                    showlegend: false
                  })),
                  // Scenario lines
                  {
                    x: plotTimestamps,
                    y: bullPrices,
                    type: 'scatter' as const,
                    mode: 'lines+markers' as const,
                    name: 'Bull Case (P90)',
                    line: { color: theme === 'light' ? '#0D9488' : '#14B8A6', width: 3 }
                  },
                  {
                    x: plotTimestamps,
                    y: basePrices,
                    type: 'scatter' as const,
                    mode: 'lines+markers' as const,
                    name: 'Base Case (P50)',
                    line: { color: theme === 'light' ? '#4F46E5' : '#818CF8', width: 2.5 }
                  },
                  {
                    x: plotTimestamps,
                    y: bearPrices,
                    type: 'scatter' as const,
                    mode: 'lines+markers' as const,
                    name: 'Bear Case (P10)',
                    line: { color: theme === 'light' ? '#BE123C' : '#FB7185', width: 3 }
                  }
                ]}
                layout={{
                  autosize: true,
                  showlegend: true,
                  legend: { 
                    font: { color: theme === 'light' ? '#475569' : '#94A3B8', size: 9 }, 
                    orientation: 'h', 
                    y: -0.2 
                  },
                  margin: { l: 55, r: 15, t: 15, b: 30 },
                  paper_bgcolor: 'rgba(0,0,0,0)',
                  plot_bgcolor: 'rgba(0,0,0,0)',
                  xaxis: {
                    gridcolor: theme === 'light' ? 'rgba(203, 213, 225, 0.5)' : 'rgba(31, 41, 66, 0.2)',
                    tickfont: { color: theme === 'light' ? '#475569' : '#94A3B8', size: 9 },
                    linecolor: theme === 'light' ? '#CBD5E1' : '#1F2942'
                  },
                  yaxis: {
                    gridcolor: theme === 'light' ? 'rgba(203, 213, 225, 0.5)' : 'rgba(31, 41, 66, 0.2)',
                    tickfont: { color: theme === 'light' ? '#475569' : '#94A3B8', size: 9 },
                    linecolor: theme === 'light' ? '#CBD5E1' : '#1F2942',
                    autorange: true,
                    tickformat: '$,.2f'
                  }
                }}
                config={{ responsive: true, displayModeBar: false }}
                className="w-full h-[280px]"
              />
            )}
          </div>

          <div className={`border-t pt-3 mt-4 text-[10px] font-mono flex justify-between ${
            theme === 'light' ? 'border-slate-100 text-slate-400' : 'border-[#1F2942]/40 text-slate-500'
          }`}>
            <span>Simulator model: Stochastic Euler-Maruyama (GBM)</span>
            <span>Path count: 5,000 runs fit</span>
          </div>
        </div>

        {/* Risk & Downside Stats Card */}
        <div className={`rounded-xl p-5 shadow-sm flex flex-col justify-between gap-5 border transition-all duration-300 ${
          theme === 'light' 
            ? 'bg-white border-slate-200' 
            : 'glass-panel border-[#1F2942] bg-[#151D30]/30'
        }`}>
          <div>
            <h3 className={`text-sm font-bold uppercase border-b pb-3 mb-4 flex items-center gap-2 ${
              theme === 'light' ? 'border-slate-100 text-slate-950' : 'border-[#1F2942]/40 text-slate-100'
            }`}>
              <Shield className="w-4 h-4 text-indigo-500" />
              Tail Risk Controls ({selectedTicker})
            </h3>
            
            {detailsLoading ? (
              <div className="space-y-4 animate-pulse">
                <div className="h-6 bg-slate-100/50 rounded w-2/3" />
                <div className="h-16 bg-slate-100/50 rounded" />
                <div className="h-20 bg-slate-100/50 rounded" />
              </div>
            ) : risk ? (
              <div className="space-y-4">
                {/* Risk score pill - Premium Neutral Background */}
                <div className={`flex gap-4 items-center p-3 rounded-lg border ${
                  theme === 'light' ? 'bg-slate-100/50 border-slate-200' : 'bg-[#0B0F19]/40 border-[#1F2942]/40'
                }`}>
                  <div className={`p-3 rounded-lg border flex flex-col items-center justify-center font-mono ${
                    theme === 'light' ? 'bg-slate-200/50 border-slate-350 text-slate-800' : 'bg-[#0B0F19]/80 border-[#1F2942] text-slate-100'
                  }`}>
                    <span className="text-xl font-black">{risk.risk_score.toFixed(0)}</span>
                    <span className="text-[8px] uppercase font-bold mt-0.5">Score</span>
                  </div>
                  <div>
                    <span className={`text-xs font-bold ${
                      theme === 'light' ? 'text-slate-900 font-bold' : 'text-slate-200'
                    }`}>{risk.risk_level} Volatility Rating</span>
                    <p className={`text-[10px] mt-0.5 leading-relaxed ${
                      theme === 'light' ? 'text-slate-700' : 'text-slate-400'
                    }`}>
                      Volatility is ranked at the {risk.volatility > 0.30 ? 'high' : 'moderate'} end compared to historical asset returns.
                    </p>
                  </div>
                </div>

                {/* Risk grid parameters - Premium Slate Highlights */}
                <div className={`space-y-2 font-mono text-xs ${
                  theme === 'light' ? 'text-slate-700' : 'text-slate-400'
                }`}>
                  <div className={`flex justify-between border-b pb-1.5 ${
                    theme === 'light' ? 'border-slate-100' : 'border-[#1F2942]/40'
                  }`}>
                    <span className={`flex items-center gap-1 ${
                      theme === 'light' ? 'text-slate-700 font-medium' : 'text-slate-500'
                    }`}>
                      Daily Downside (VaR 95%)
                      <span title="Maximum expected loss on a bad day at 95% confidence level.">
                        <HelpCircle className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600 cursor-help" />
                      </span>
                    </span>
                    <strong className={theme === 'light' ? 'text-slate-900 font-bold' : 'text-slate-100'}>
                      {(risk.var_95 * 100.0).toFixed(2)}%
                    </strong>
                  </div>
                  <div className={`flex justify-between border-b pb-1.5 ${
                    theme === 'light' ? 'border-slate-100' : 'border-[#1F2942]/40'
                  }`}>
                    <span className={`flex items-center gap-1 ${
                      theme === 'light' ? 'text-slate-700 font-medium' : 'text-slate-500'
                    }`}>
                      Average Crash Loss (CVaR)
                      <span title="Average expected loss in the worst 5% of trading sessions.">
                        <HelpCircle className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600 cursor-help" />
                      </span>
                    </span>
                    <strong className={theme === 'light' ? 'text-slate-900 font-bold' : 'text-slate-100'}>
                      {(risk.cvar_95 * 100.0).toFixed(2)}%
                    </strong>
                  </div>
                  <div className={`flex justify-between border-b pb-1.5 ${
                    theme === 'light' ? 'border-slate-100' : 'border-[#1F2942]/40'
                  }`}>
                    <span className={theme === 'light' ? 'text-slate-700 font-medium' : 'text-slate-500'}>Annualized Volatility:</span>
                    <strong className={theme === 'light' ? 'text-slate-900 font-bold' : 'text-slate-100'}>
                      {(risk.volatility * 100.0).toFixed(1)}%
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className={theme === 'light' ? 'text-slate-700 font-medium' : 'text-slate-500'}>Worst Historical Drop:</span>
                    <strong className={theme === 'light' ? 'text-slate-900 font-bold' : 'text-slate-100'}>
                      {(risk.drawdown * 100.0).toFixed(1)}%
                    </strong>
                  </div>
                </div>

                {/* Dynamic explanations */}
                <div className={`p-3 rounded-lg border text-[11px] leading-relaxed space-y-1.5 ${
                  theme === 'light' 
                    ? 'bg-slate-100/50 border-slate-200 text-slate-700 font-medium' 
                    : 'bg-[#0B0F19]/40 border-[#1F2942]/40 text-slate-400'
                }`}>
                  <p>
                    <strong className={theme === 'light' ? 'text-slate-800' : 'text-slate-200'}>Summary: </strong> 
                    {risk.plain_language_explanation.summary}
                  </p>
                  <p>
                    <strong className="text-orange-600 font-semibold">Warning: </strong> 
                    {risk.plain_language_explanation.warning}
                  </p>
                  <p>
                    <strong className="text-slate-500">Reasoning: </strong> 
                    {risk.plain_language_explanation.reason}
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-400 italic text-center py-10">No risk stats available.</div>
            )}
          </div>
        </div>
      </div>

      {/* Stress scenarios Shocks table */}
      {risk && (
        <div className={`rounded-xl overflow-hidden border shadow-sm transition-all duration-300 ${
          theme === 'light' ? 'bg-white border-slate-200' : 'glass-panel border-[#1F2942] bg-[#151D30]/30'
        }`}>
          <div className={`p-4 border-b flex items-center gap-2 text-xs font-bold font-mono tracking-wider uppercase ${
            theme === 'light' 
              ? 'border-slate-100 bg-slate-50 text-slate-800' 
              : 'border-[#1F2942]/40 bg-[#151D30]/50 text-slate-200'
          }`}>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            Estimated Asset Performance Shocks in Market Crashes ($100K Baseline)
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs border-collapse">
              <thead>
                <tr className={`uppercase text-[9px] tracking-wider border-b ${
                  theme === 'light' 
                    ? 'bg-slate-50/50 text-slate-400 border-slate-100' 
                    : 'bg-[#151D30]/20 text-slate-500 border-[#1F2942]/40'
                }`}>
                  <th className="py-3 px-6">Simulated Crisis Regime</th>
                  <th className="py-3 px-6">Index Shock (S&P 500)</th>
                  <th className="py-3 px-6">Estimated Portfolio Return Impact</th>
                  <th className="py-3 px-6">Estimated Dollar Value Change</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${
                theme === 'light' 
                  ? 'divide-slate-100 text-slate-700' 
                  : 'divide-[#1F2942]/30 text-slate-300'
              }`}>
                {risk.stress_test_summary.map((sc, idx) => (
                  <tr key={idx} className={`transition-colors duration-200 ${
                    theme === 'light' ? 'hover:bg-slate-50/30' : 'hover:bg-[#151D30]/10'
                  }`}>
                    <td className={`py-3 px-6 font-bold ${
                      theme === 'light' ? 'text-slate-900' : 'text-slate-100'
                    }`}>{sc.scenario_name}</td>
                    <td className={theme === 'light' ? 'text-slate-500' : 'text-slate-400'}>
                      {(sc.spx_shock * 100.0).toFixed(1)}%
                    </td>
                    <td className={`py-3 px-6 font-bold ${theme === 'light' ? 'text-slate-900' : 'text-slate-100'}`}>
                      {(sc.portfolio_return_shock * 100.0).toFixed(2)}%
                    </td>
                    <td className={`py-3 px-6 font-black ${theme === 'light' ? 'text-slate-900' : 'text-slate-100'}`}>
                      -${Math.abs(sc.portfolio_usd_impact).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Methodology Section */}
      {methodology && (
        <div className={`rounded-xl p-5 shadow-sm space-y-4 border transition-all duration-300 ${
          theme === 'light' ? 'bg-white border-slate-200' : 'glass-panel border-[#1F2942] bg-[#151D30]/30'
        }`}>
          <div className={`flex items-center gap-2 border-b pb-3 ${
            theme === 'light' ? 'border-slate-100 text-slate-950' : 'border-[#1F2942]/40 text-slate-100'
          }`}>
            <Info className="w-5 h-5 text-indigo-500" />
            <h3 className="text-sm font-bold uppercase">How Projections & Risks Are Calculated</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs leading-relaxed text-slate-600">
            <div className="space-y-1.5">
              <h4 className={`font-bold uppercase tracking-wider text-[10px] font-mono ${
                theme === 'light' ? 'text-slate-900 font-bold' : 'text-slate-200'
              }`}>1. Projections Calculation</h4>
              <p className={theme === 'light' ? 'text-slate-700' : 'text-slate-400'}>
                {methodology.projections_calculation}
              </p>
            </div>
            
            <div className="space-y-1.5">
              <h4 className={`font-bold uppercase tracking-wider text-[10px] font-mono ${
                theme === 'light' ? 'text-slate-900 font-bold' : 'text-slate-200'
              }`}>2. Monte Carlo Definition</h4>
              <p className={theme === 'light' ? 'text-slate-700' : 'text-slate-400'}>
                {methodology.monte_carlo_definition}
              </p>
            </div>
            
            <div className="space-y-1.5">
              <h4 className={`font-bold uppercase tracking-wider text-[10px] font-mono ${
                theme === 'light' ? 'text-slate-900 font-bold' : 'text-slate-200'
              }`}>3. Value at Risk (VaR)</h4>
              <p className={theme === 'light' ? 'text-slate-700' : 'text-slate-400'}>
                {methodology.var_definition}
              </p>
            </div>
          </div>

          <div className={`border-t pt-3.5 mt-3 ${
            theme === 'light' ? 'border-slate-100' : 'border-[#1F2942]/40'
          }`}>
            <h4 className={`font-bold uppercase tracking-wider text-[10px] font-mono mb-2 ${
              theme === 'light' ? 'text-slate-900 font-bold' : 'text-slate-200'
            }`}>Engine Modeling Limitations</h4>
            <ul className={`list-disc pl-5 text-xs space-y-1 ${
              theme === 'light' ? 'text-slate-600 font-medium' : 'text-slate-400'
            }`}>
              {methodology.limitations.map((limit, idx) => (
                <li key={idx}>{limit}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
