'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { resultsApi } from '../../../lib/api/results';
import { copy } from '../../../content/copy';
import { 
  AssetProjectionResponse, 
  AssetRiskResponse, 
  MethodologyResponse 
} from '../../../types/results';
import { 
  ArrowLeft, 
  TrendingUp, 
  Shield, 
  Activity, 
  Info, 
  AlertTriangle, 
  HelpCircle, 
  RefreshCw, 
  Sun, 
  Moon, 
  Wifi, 
  WifiOff,
  CheckCircle,
  FileText,
  ChevronUp,
  ChevronDown
} from 'lucide-react';

// Dynamic Plotly component to bypass Next.js SSR build checks
const Plot = dynamic(() => import('react-plotly.js'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[320px] flex items-center justify-center bg-slate-100/50 rounded-xl border border-slate-200/50 animate-pulse">
      <div className="text-slate-400 font-mono text-xs flex items-center gap-2">
        <RefreshCw className="w-4 h-4 animate-spin" /> Assembling Charts...
      </div>
    </div>
  )
});

export default function AssetDetailPage() {
  const params = useParams();
  const symbol = (params?.symbol as string) || 'BTCUSDT';
  
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [projection, setProjection] = useState<AssetProjectionResponse | null>(null);
  const [risk, setRisk] = useState<AssetRiskResponse | null>(null);
  const [methodology, setMethodology] = useState<MethodologyResponse | null>(null);
  
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  const [methodologyExpanded, setMethodologyExpanded] = useState<boolean>(false);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const projData = await resultsApi.getAssetProjection(symbol);
      const riskData = await resultsApi.getAssetRisk(symbol);
      const methData = await resultsApi.getMethodology();
      
      setProjection(projData);
      setRisk(riskData);
      setMethodology(methData);
    } catch (err: any) {
      console.error("Error loading asset detail metrics", err);
      setError(err.message || "Failed to query detailed asset reports.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    
    // Check if parent window has dark preference (safeguard)
    if (typeof window !== 'undefined') {
      const storedTheme = localStorage.getItem('mspe-theme') as 'light' | 'dark' | null;
      if (storedTheme) setTheme(storedTheme);
    }
  }, [symbol]);

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    if (typeof window !== 'undefined') {
      localStorage.setItem('mspe-theme', nextTheme);
    }
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center font-mono text-xs transition-colors duration-300 ${
        theme === 'light' ? 'bg-slate-100 text-slate-500' : 'bg-[#0B0F19] text-slate-400'
      }`}>
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
          <span className="font-bold uppercase tracking-wider">Assembling Asset Analytics Report...</span>
        </div>
      </div>
    );
  }

  if (error || !projection || !risk) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center font-mono text-xs gap-5 transition-colors duration-300 ${
        theme === 'light' ? 'bg-slate-100 text-slate-500' : 'bg-[#0B0F19] text-slate-400'
      }`}>
        <AlertTriangle className="w-10 h-10 text-rose-500 animate-bounce" />
        <span className="font-bold uppercase">{error || "Asset profile could not be assembled."}</span>
        <a 
          href="/" 
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider border transition-colors ${
            theme === 'light' 
              ? 'bg-white border-slate-200 hover:bg-slate-50 text-slate-800' 
              : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/20'
          }`}
        >
          <ArrowLeft className="w-4 h-4" /> Return to Dashboard
        </a>
      </div>
    );
  }

  // Extract variables
  const plotTimestamps = ['Current', '1d Out', '3d Out', '7d Out', '30d Out'];
  const bearPrices = projection.bear_scenario_path;
  const basePrices = projection.base_scenario_path;
  const bullPrices = projection.bull_scenario_path;

  // Retrieve 7d base case min and max for summary sentence
  const case7d = projection.projection_horizon_results.find(h => h.horizon_days === 7);
  const bear7d = case7d ? case7d.bear_price : bearPrices[3];
  const bull7d = case7d ? case7d.bull_price : bullPrices[3];
  const loss7d = case7d ? case7d.probability_of_loss : 0.45;

  return (
    <div className={`min-h-screen transition-colors duration-300 p-6 md:p-8 font-sans ${
      theme === 'light' ? 'bg-slate-100 text-slate-800' : 'bg-[#0B0F19] text-slate-100'
    }`}>
      
      {/* 1. Header Navigation Card */}
      <div className={`rounded-xl p-5 mb-6 border transition-all duration-300 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${
        theme === 'light' ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#151D30]/30 border-[#1F2942]'
      }`}>
        <div className="flex flex-col gap-2">
          <a 
            href="/" 
            className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-indigo-500 hover:text-indigo-650 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </a>
          
          <div className="flex flex-wrap items-baseline gap-2.5 mt-1.5">
            <h1 className={`text-2xl font-black tracking-tight ${theme === 'light' ? 'text-slate-900' : 'text-slate-100'}`}>
              {projection.asset.symbol}
            </h1>
            <span className={`text-base font-semibold ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
              {projection.asset.name}
            </span>
            <span className={`text-[10px] uppercase font-mono tracking-widest px-2.5 py-0.5 rounded-full border ${
              projection.data_mode === 'live' 
                ? 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/20 dark:border-emerald-900/30' 
                : 'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950/20 dark:border-amber-900/30'
            }`}>
              {projection.data_mode} Mode
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <span className={`text-[10px] uppercase tracking-wider font-mono block ${theme === 'light' ? 'text-slate-500' : 'text-slate-500'}`}>
              Latest Close
            </span>
            <strong className={`text-xl font-mono tracking-tight block ${theme === 'light' ? 'text-slate-900 font-bold' : 'text-slate-100'}`}>
              ${projection.asset.last_close.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </strong>
          </div>

          <button
            onClick={toggleTheme}
            className={`p-2.5 rounded-lg border transition-colors ${
              theme === 'light' 
                ? 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-600' 
                : 'bg-[#151D30]/60 border-[#1F2942] hover:bg-[#151D30] text-slate-300'
            }`}
            title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
          >
            {theme === 'light' ? <Moon className="w-4.5 h-4.5" /> : <Sun className="w-4.5 h-4.5" />}
          </button>
        </div>
      </div>

      {/* 2. Plain English Simple Summary */}
      <div className={`p-6 rounded-xl border font-medium text-sm leading-relaxed mb-6 transition-all duration-300 ${
        theme === 'light' 
          ? 'bg-white border-slate-200 text-slate-800 shadow-sm' 
          : 'bg-[#151D30]/20 border-[#1F2942]/60 text-slate-350'
      }`}>
        <h4 className={`text-xs uppercase font-bold tracking-wider mb-2 flex items-center gap-1.5 ${
          theme === 'light' ? 'text-slate-550' : 'text-slate-400'
        }`}>
          <FileText className="w-4 h-4 text-indigo-500" /> Executive Analytics Summary
        </h4>
        <p className="text-base font-normal">
          MSPE currently projects a base-case 7-day range of{" "}
          <strong className="text-indigo-500">${bear7d.toLocaleString(undefined, { maximumFractionDigits: 0 })} to ${bull7d.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong>{" "}
          with a downside risk of{" "}
          <strong className={theme === 'light' ? 'text-slate-900 font-bold' : 'text-slate-100 font-bold'}>{(risk.var_95 * 100.0).toFixed(2)}%</strong>.{" "}
          The model sees risk as{" "}
          <span className="underline decoration-indigo-500 decoration-2 font-bold uppercase">{risk.risk_level}</span>{" "}
          because volatility is{" "}
          <strong className={theme === 'light' ? 'text-slate-900 font-bold' : 'text-slate-100 font-bold'}>{(risk.volatility * 100.0).toFixed(1)}%</strong>.
        </p>
      </div>

      {/* 3. Multi-Horizon Projections Grid */}
      <div className="space-y-3 mb-6">
        <h2 className={`text-base font-bold uppercase tracking-wider flex items-center gap-2 ${
          theme === 'light' ? 'text-slate-900' : 'text-slate-200'
        }`}>
          <TrendingUp className="w-4 h-4 text-indigo-500" />
          Projections Summary Across Horizons
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {projection.projection_horizon_results.map((horizon) => (
            <div key={horizon.horizon_days} className={`rounded-xl p-5 border transition-all duration-300 ${
              theme === 'light' ? 'bg-white border-slate-200 shadow-sm text-slate-800' : 'bg-[#151D30]/20 border-[#1F2942]/60 text-slate-100'
            }`}>
              <div className="flex justify-between items-center mb-3">
                <span className={`text-[10px] uppercase font-bold tracking-wider font-mono px-2 py-0.5 rounded border ${
                  theme === 'light' ? 'bg-slate-100 border-slate-200 text-slate-600' : 'bg-[#0B0F19]/40 border-[#1F2942]/60 text-slate-400'
                }`}>
                  {horizon.horizon_days}-Day Forecast
                </span>
                <span className={`text-[10px] font-mono font-bold uppercase ${
                  horizon.expected_return >= 0 
                    ? theme === 'light' ? 'text-emerald-700' : 'text-emerald-400'
                    : theme === 'light' ? 'text-rose-700' : 'text-rose-400'
                }`}>
                  {horizon.expected_return >= 0 ? '+' : ''}{(horizon.expected_return * 100).toFixed(2)}% Return
                </span>
              </div>
              
              <div className="space-y-2 font-mono text-xs mt-3.5">
                <div className={`flex justify-between border-b pb-1.5 ${theme === 'light' ? 'border-slate-100' : 'border-[#1F2942]/30'}`}>
                  <span className={theme === 'light' ? 'text-slate-500 font-medium' : 'text-slate-500'}>Bear Case (P10):</span>
                  <strong className={theme === 'light' ? 'text-slate-900 font-bold' : 'text-slate-100'}>
                    ${horizon.bear_price.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </strong>
                </div>
                <div className={`flex justify-between border-b pb-1.5 ${theme === 'light' ? 'border-slate-100' : 'border-[#1F2942]/30'}`}>
                  <span className={theme === 'light' ? 'text-slate-500 font-medium' : 'text-slate-500'}>Base Case (P50):</span>
                  <strong className="text-indigo-500">
                    ${horizon.base_price.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </strong>
                </div>
                <div className={`flex justify-between border-b pb-1.5 ${theme === 'light' ? 'border-slate-100' : 'border-[#1F2942]/30'}`}>
                  <span className={theme === 'light' ? 'text-slate-500 font-medium' : 'text-slate-500'}>Bull Case (P90):</span>
                  <strong className={theme === 'light' ? 'text-slate-900 font-bold' : 'text-slate-100'}>
                    ${horizon.bull_price.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </strong>
                </div>
                <div className="flex justify-between text-[11px] font-semibold text-slate-500">
                  <span>Chance of Loss:</span>
                  <span className={horizon.probability_of_loss > 0.5 ? 'text-amber-500' : ''}>
                    {(horizon.probability_of_loss * 100.0).toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4 & 5. Projections and Monte Carlo Interactive Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
        {/* Scenario price outlook card */}
        <div className={`rounded-xl p-5 border transition-all duration-300 ${
          theme === 'light' ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#151D30]/20 border-[#1F2942]/65'
        }`}>
          <div>
            <h3 className={`text-base font-bold flex items-center gap-2 ${
              theme === 'light' ? 'text-slate-950 font-bold' : 'text-slate-100'
            }`}>
              <TrendingUp className="w-5 h-5 text-indigo-500" />
              Scenario Price Outlook & Confidence Band
            </h3>
            <p className={`text-xs mt-0.5 ${
              theme === 'light' ? 'text-slate-550' : 'text-slate-500'
            }`}>Estimated Bear, Base, and Bull boundaries based on historical variance</p>
          </div>

          <div className="min-h-[300px] mt-4">
            <Plot
              data={[
                // Upper boundary for fill
                {
                  x: plotTimestamps,
                  y: bullPrices,
                  type: 'scatter' as const,
                  mode: 'lines' as const,
                  line: { color: 'transparent' },
                  showlegend: false
                },
                // Lower boundary with confidence band fill
                {
                  x: plotTimestamps,
                  y: bearPrices,
                  type: 'scatter' as const,
                  mode: 'lines' as const,
                  fill: 'tonexty' as const,
                  fillcolor: theme === 'light' ? 'rgba(99, 102, 241, 0.05)' : 'rgba(99, 102, 241, 0.03)',
                  line: { color: 'transparent' },
                  name: '90% Confidence Interval',
                  showlegend: true
                },
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
                uirevision: symbol,
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
          </div>
        </div>

        {/* Monte Carlo Simulated Paths Card */}
        <div className={`rounded-xl p-5 border transition-all duration-300 ${
          theme === 'light' ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#151D30]/20 border-[#1F2942]/65'
        }`}>
          <div>
            <h3 className={`text-base font-bold flex items-center gap-2 ${
              theme === 'light' ? 'text-slate-950 font-bold' : 'text-slate-100'
            }`}>
              <Activity className="w-5 h-5 text-indigo-500" />
              Monte Carlo Simulation Pathways
            </h3>
            <p className={`text-xs mt-0.5 ${
              theme === 'light' ? 'text-slate-555' : 'text-slate-500'
            }`}>
              5 sample path simulations drawn from the model's volatility parameters
            </p>
          </div>

          <div className="min-h-[260px] mt-4">
            <Plot
              data={[
                ...(projection.monte_carlo_paths || []).map((path, idx) => ({
                  x: plotTimestamps,
                  y: [
                    projection.asset.last_close,
                    path[1],
                    path[3],
                    path[7],
                    path[30]
                  ],
                  type: 'scatter' as const,
                  mode: 'lines' as const,
                  name: `Sim Path ${idx + 1}`,
                  line: { 
                    color: theme === 'light' ? `rgba(99, 102, 241, 0.22)` : `rgba(99, 102, 241, 0.12)`, 
                    width: 1.5, 
                    shape: 'spline' as const 
                  },
                  showlegend: false
                })),
                {
                  x: plotTimestamps,
                  y: basePrices,
                  type: 'scatter' as const,
                  mode: 'lines' as const,
                  name: 'Base Pathway',
                  line: { color: theme === 'light' ? '#4F46E5' : '#818CF8', width: 2.5 }
                }
              ]}
              layout={{
                autosize: true,
                uirevision: symbol,
                showlegend: false,
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
              className="w-full h-[250px]"
            />
          </div>

          <div className={`mt-3 p-3 rounded-lg border text-[11px] text-center font-mono leading-relaxed transition-colors duration-300 ${
            theme === 'light' ? 'bg-indigo-50/40 border-indigo-100 text-indigo-700' : 'bg-indigo-500/5 border-indigo-500/20 text-indigo-400'
          }`}>
            "These paths are simulations, not guaranteed predictions."
          </div>
        </div>
      </div>

      {/* 6. Tail Risk Cards Grid */}
      <div className="space-y-3 mb-6">
        <h2 className={`text-base font-bold uppercase tracking-wider flex items-center gap-2 ${
          theme === 'light' ? 'text-slate-900' : 'text-slate-200'
        }`}>
          <Shield className="w-4 h-4 text-indigo-500" />
          Asset Risk Metrics
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6">
          {/* Volatility Card */}
          <div className={`rounded-xl p-5 border relative transition-all duration-300 ${
            theme === 'light' ? 'bg-white border-slate-200 shadow-sm text-slate-800' : 'bg-[#151D30]/20 border-[#1F2942]/60 text-slate-100'
          }`}>
            <span className="text-[9px] uppercase tracking-wider font-mono text-slate-500 flex justify-between items-center">
              Volatility
              <span title={copy.tooltips.volatilityRating}>
                <HelpCircle className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600 cursor-help" />
              </span>
            </span>
            <strong className={`text-xl font-mono block mt-2.5 font-black ${theme === 'light' ? 'text-slate-950 font-bold' : 'text-slate-100'}`}>
              {(risk.volatility * 100.0).toFixed(1)}%
            </strong>
            <p className="text-[10px] text-slate-500 mt-1.5 uppercase font-bold font-mono tracking-wide">{risk.risk_level} LEVEL</p>
          </div>

          {/* Risk Score */}
          <div className={`rounded-xl p-5 border relative transition-all duration-300 ${
            theme === 'light' ? 'bg-white border-slate-200 shadow-sm text-slate-800' : 'bg-[#151D30]/20 border-[#1F2942]/60 text-slate-100'
          }`}>
            <span className="text-[9px] uppercase tracking-wider font-mono text-slate-500 flex justify-between items-center">
              Risk Score
              <span title={copy.tooltips.volatilityRating}>
                <HelpCircle className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600 cursor-help" />
              </span>
            </span>
            <strong className={`text-xl font-mono block mt-2.5 font-black ${theme === 'light' ? 'text-slate-950 font-bold' : 'text-slate-100'}`}>
              {risk.risk_score.toFixed(0)} / 100
            </strong>
            <p className="text-[10px] text-slate-500 mt-1.5 uppercase font-bold font-mono tracking-wide">Aggregate Index</p>
          </div>

          {/* Prob of Loss */}
          <div className={`rounded-xl p-5 border relative transition-all duration-300 ${
            theme === 'light' ? 'bg-white border-slate-200 shadow-sm text-slate-800' : 'bg-[#151D30]/20 border-[#1F2942]/60 text-slate-100'
          }`}>
            <span className="text-[9px] uppercase tracking-wider font-mono text-slate-500 flex justify-between items-center">
              Loss Probability
              <span title="The probability that the price drops below the current close after 7 days.">
                <HelpCircle className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600 cursor-help" />
              </span>
            </span>
            <strong className={`text-xl font-mono block mt-2.5 font-black ${theme === 'light' ? 'text-slate-950 font-bold' : 'text-slate-100'}`}>
              {(loss7d * 100.0).toFixed(0)}%
            </strong>
            <p className="text-[10px] text-slate-500 mt-1.5 uppercase font-bold font-mono tracking-wide">7-Day Horizon</p>
          </div>

          {/* VaR */}
          <div className={`rounded-xl p-5 border relative transition-all duration-300 ${
            theme === 'light' ? 'bg-white border-slate-200 shadow-sm text-slate-800' : 'bg-[#151D30]/20 border-[#1F2942]/60 text-slate-100'
          }`}>
            <span className="text-[9px] uppercase tracking-wider font-mono text-slate-500 flex justify-between items-center">
              VaR (95%)
              <span title={copy.tooltips.dailyDownside}>
                <HelpCircle className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600 cursor-help" />
              </span>
            </span>
            <strong className={`text-xl font-mono block mt-2.5 font-black ${theme === 'light' ? 'text-slate-950 font-bold' : 'text-slate-100'}`}>
              {(risk.var_95 * 100.0).toFixed(2)}%
            </strong>
            <p className="text-[10px] text-slate-500 mt-1.5 uppercase font-bold font-mono tracking-wide">1-Day Limit</p>
          </div>

          {/* CVaR */}
          <div className={`rounded-xl p-5 border relative transition-all duration-300 ${
            theme === 'light' ? 'bg-white border-slate-200 shadow-sm text-slate-800' : 'bg-[#151D30]/20 border-[#1F2942]/60 text-slate-100'
          }`}>
            <span className="text-[9px] uppercase tracking-wider font-mono text-slate-500 flex justify-between items-center">
              CVaR (95%)
              <span title={copy.tooltips.averageCrash}>
                <HelpCircle className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600 cursor-help" />
              </span>
            </span>
            <strong className={`text-xl font-mono block mt-2.5 font-black ${theme === 'light' ? 'text-slate-950' : 'text-slate-100'}`}>
              {(risk.cvar_95 * 100.0).toFixed(2)}%
            </strong>
            <p className="text-[10px] text-slate-500 mt-1.5 uppercase font-bold font-mono tracking-wide">Worst 5% Avg</p>
          </div>

          {/* Drawdown */}
          <div className={`rounded-xl p-5 border relative transition-all duration-300 ${
            theme === 'light' ? 'bg-white border-slate-200 shadow-sm text-slate-800' : 'bg-[#151D30]/20 border-[#1F2942]/60 text-slate-100'
          }`}>
            <span className="text-[9px] uppercase tracking-wider font-mono text-slate-500 flex justify-between items-center">
              Max Drawdown
              <span title={copy.tooltips.worstDrop}>
                <HelpCircle className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600 cursor-help" />
              </span>
            </span>
            <strong className={`text-xl font-mono block mt-2.5 font-black ${theme === 'light' ? 'text-slate-950 font-bold' : 'text-slate-100'}`}>
              {(risk.drawdown * 100.0).toFixed(1)}%
            </strong>
            <p className="text-[10px] text-slate-500 mt-1.5 uppercase font-bold font-mono tracking-wide">Historical Floor</p>
          </div>
        </div>
      </div>

      {/* 7. Stress Testing table */}
      <div className={`rounded-xl overflow-hidden border shadow-sm transition-all duration-300 mb-6 ${
        theme === 'light' ? 'bg-white border-slate-200' : 'glass-panel border-[#1F2942] bg-[#151D30]/30'
      }`}>
        <div className={`p-4 border-b flex items-center gap-2 text-xs font-bold font-mono tracking-wider uppercase ${
          theme === 'light' 
            ? 'border-slate-100 bg-slate-50 text-slate-800' 
            : 'border-[#1F2942]/60 bg-[#151D30]/50 text-slate-200'
        }`}>
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          Crisis Stress Test: Simulated Performance shocks
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs border-collapse">
            <thead>
              <tr className={`uppercase text-[9px] tracking-wider border-b ${
                theme === 'light' 
                  ? 'bg-slate-50/50 text-slate-400 border-slate-100' 
                  : 'bg-[#0B0F19]/60 border-[#1F2942]/60 text-slate-500'
              }`}>
                <th className="py-3 px-6">Historical Crash Regime</th>
                <th className="py-3 px-6">Index Shock (S&P 500)</th>
                <th className="py-3 px-6">Estimated Asset Shock</th>
                <th className="py-3 px-6">Estimated Dollar Value Change ($100k Base)</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${
              theme === 'light' 
                ? 'divide-slate-100 text-slate-700' 
                : 'divide-[#1F2942]/30 text-slate-355'
            }`}>
              {risk.stress_test_summary.map((sc, idx) => (
                <tr key={idx} className={`transition-colors duration-200 ${
                  theme === 'light' ? 'hover:bg-slate-50/30' : 'hover:bg-[#151D30]/10'
                }`}>
                  <td className={`py-3 px-6 font-bold ${
                    theme === 'light' ? 'text-slate-900' : 'text-slate-100'
                  }`}>{sc.scenario_name.replace(/_/g, ' ')}</td>
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

      {/* 8. Expandable Methodology accordions */}
      <div className={`rounded-xl overflow-hidden border transition-all duration-300 mb-6 ${
        theme === 'light' ? 'bg-white border-slate-200 shadow-sm' : 'glass-panel border-[#1F2942] bg-[#151D30]/30'
      }`}>
        <button
          onClick={() => setMethodologyExpanded(!methodologyExpanded)}
          className={`w-full px-6 py-4 flex justify-between items-center transition-colors ${
            theme === 'light' 
              ? 'bg-slate-100 hover:bg-slate-200/60' 
              : 'bg-[#151D30]/20 hover:bg-[#151D30]/40'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <Info className="w-4 h-4 text-indigo-500" />
            <span className={`text-sm font-bold tracking-wider uppercase font-mono ${
              theme === 'light' ? 'text-slate-900' : 'text-slate-100'
            }`}>
              How It Works: Quantitative Methodology
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-slate-500 font-mono hidden sm:inline">
              {methodologyExpanded ? 'CLICK TO COLLAPSE' : 'CLICK TO EXPAND'}
            </span>
            {methodologyExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </div>
        </button>

        {methodologyExpanded && (
          <div className={`p-6 border-t space-y-6 ${
            theme === 'light' ? 'border-slate-100 bg-slate-50' : 'border-[#1F2942]/60 bg-[#0B0F19]/40'
          }`}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs leading-relaxed text-slate-600">
              <div className="space-y-1.5">
                <h4 className={`font-bold font-mono text-[10px] tracking-wider uppercase ${
                  theme === 'light' ? 'text-slate-900 font-bold' : 'text-slate-200'
                }`}>01 // Projections Data Used</h4>
                <p className={theme === 'light' ? 'text-slate-700 font-medium' : 'text-slate-400'}>
                  {methodology?.projections_calculation || "Historical daily close prices queried from active database feeds with a 252-day lookback window."}
                </p>
              </div>

              <div className="space-y-1.5">
                <h4 className={`font-bold font-mono text-[10px] tracking-wider uppercase ${
                  theme === 'light' ? 'text-slate-900 font-bold' : 'text-slate-200'
                }`}>02 // Simulation Method</h4>
                <p className={theme === 'light' ? 'text-slate-700 font-medium' : 'text-slate-400'}>
                  {methodology?.monte_carlo_definition || "Euler-Maruyama discretized Geometric Brownian Motion (GBM) running 10,000 parallel paths."}
                </p>
              </div>

              <div className="space-y-1.5">
                <h4 className={`font-bold font-mono text-[10px] tracking-wider uppercase ${
                  theme === 'light' ? 'text-slate-900 font-bold' : 'text-slate-200'
                }`}>03 // Downside VaR Calculations</h4>
                <p className={theme === 'light' ? 'text-slate-700 font-medium' : 'text-slate-400'}>
                  {methodology?.var_definition || "Value at Risk levels derived by sorting final-state terminal quantiles of the forecast distribution."}
                </p>
              </div>
            </div>

            <div className={`border-t pt-4 ${theme === 'light' ? 'border-slate-200' : 'border-[#1F2942]/40'}`}>
              <h5 className={`text-[10px] font-bold font-mono tracking-wider uppercase mb-1.5 ${
                theme === 'light' ? 'text-slate-900' : 'text-slate-200'
              }`}>Model Engine Limitations</h5>
              <ul className={`list-disc pl-5 text-xs space-y-1.5 ${
                theme === 'light' ? 'text-slate-650' : 'text-slate-400'
              }`}>
                {methodology?.limitations.map((limit, idx) => (
                  <li key={idx}>{limit}</li>
                )) || (
                  <>
                    <li>Model parameters remain stationary and do not predict dynamic regime shifts.</li>
                    <li>VaR models assume normal or empirical return distributions without fat-tail adjustments.</li>
                    <li>Calculations do not account for external transaction fees or sudden liquidity outages.</li>
                  </>
                )}
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* 9. Disclaimer Footer */}
      <footer className="mt-12 text-center text-[10px] font-mono tracking-wider text-slate-500 uppercase">
        "This is a research dashboard, not financial advice."
      </footer>
    </div>
  );
}
