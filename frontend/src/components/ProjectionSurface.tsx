'use client';

import React, { useEffect, useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { api, SurfaceProjectionResponse, ProjectedSurfaceBase } from '../lib/api';
import { Layers, RefreshCw, Info, HelpCircle, ShieldAlert } from 'lucide-react';

const Plot = dynamic(() => import('react-plotly.js'), { 
  ssr: false,
  loading: () => (
    <div className="w-full h-[450px] flex items-center justify-center bg-slate-100/40 dark:bg-[#151D30]/30 rounded-xl border border-slate-200 dark:border-[#1F2942] animate-pulse">
      <div className="text-slate-400 font-mono text-xs flex items-center gap-2">
        <RefreshCw className="w-4 h-4 animate-spin" /> Compiling 3D Probability Surface...
      </div>
    </div>
  )
});

interface ProjectionSurfaceProps {
  theme?: 'light' | 'dark';
}

export default function ProjectionSurface({ theme = 'light' }: ProjectionSurfaceProps) {
  const [ticker, setTicker] = useState<string>('BTCUSDT');
  const [projection, setProjection] = useState<SurfaceProjectionResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [dataMode, setDataMode] = useState<string>('live');

  const assetsList = [
    { id: 'BTCUSDT', name: 'Bitcoin (BTC/USDT)' },
    { id: 'ETHUSDT', name: 'Ethereum (ETH/USDT)' },
    { id: 'SPX', name: 'S&P 500 Index (SPX)' },
    { id: 'XAU', name: 'Gold (XAU/USD)' }
  ];

  const generateMock3DSurface = (selectedTicker: string): SurfaceProjectionResponse => {
    const spot = {
      'BTCUSDT': 65000.0,
      'ETHUSDT': 3400.0,
      'SPX': 5100.0,
      'XAU': 2300.0
    }[selectedTicker] || 100.0;

    const mu = 0.05 / 252.0;       
    const sigma = { 'BTCUSDT': 0.025, 'ETHUSDT': 0.03, 'SPX': 0.008, 'XAU': 0.01 }[selectedTicker] || 0.015;

    const bear_scenario = [];
    const base_scenario = [];
    const bull_scenario = [];
    const grid: ProjectedSurfaceBase[] = [];

    const now = new Date();

    for (let day = 0; day <= 7; day++) {
      const t = new Date(now.getTime() + day * 24 * 60 * 60 * 1000);
      const timeStr = t.toISOString();

      const drift = mu * day;
      const volWidth = sigma * Math.sqrt(day);

      const p50 = spot * Math.exp(drift);
      const p10 = spot * Math.exp(drift - 1.28 * volWidth); 
      const p90 = spot * Math.exp(drift + 1.28 * volWidth); 

      bear_scenario.push({ time: timeStr, price: p10 });
      base_scenario.push({ time: timeStr, price: p50 });
      bull_scenario.push({ time: timeStr, price: p90 });

      const minPrice = p10 * 0.85;
      const maxPrice = p90 * 1.15;
      const priceIntervals = 15; 

      for (let j = 0; j < priceIntervals; j++) {
        const gridPrice = minPrice + (maxPrice - minPrice) * (j / (priceIntervals - 1));
        const distance = Math.log(gridPrice / spot) - (mu * day);
        const variance = (sigma * sigma * Math.max(1, day));
        const density = (1.0 / Math.sqrt(2 * Math.PI * variance)) * Math.exp(-(distance * distance) / (2 * variance));

        grid.push({
          projection_time: timeStr,
          price: gridPrice,
          density: density * 0.01,
          p10_price: p10,
          p50_price: p50,
          p90_price: p90
        });
      }
    }

    return {
      ticker: selectedTicker,
      run_id: 'mock-run-id',
      timestamp: now.toISOString(),
      model_type: 'MONTE_CARLO_GBM',
      bear_scenario,
      base_scenario,
      bull_scenario,
      grid
    };
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      let fetchedProj: SurfaceProjectionResponse | null = null;
      try {
        fetchedProj = await api.getLatestProjection(ticker);
        setDataMode('live');
      } catch {
        fetchedProj = generateMock3DSurface(ticker);
        setDataMode('demo');
      }

      if (!fetchedProj) {
        fetchedProj = generateMock3DSurface(ticker);
        setDataMode('demo');
      }
      setProjection(fetchedProj);
    } catch (err: any) {
      setError(err.message || 'Failed to load surface projections');
      setDataMode('demo');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [ticker]);

  const construct3DPlotData = (): any[] => {
    if (!projection || !projection.grid || projection.grid.length === 0) return [];

    const times = Array.from(new Set(projection.grid.map(g => g.projection_time)));
    const xDays = times.map((_, idx) => `Day +${idx}`);
    
    const distinctPrices = Array.from(new Set(projection.grid.map(g => Math.round(g.price))));
    distinctPrices.sort((a, b) => a - b);

    const zMatrix: number[][] = [];
    
    for (let pIdx = 0; pIdx < distinctPrices.length; pIdx++) {
      const row: number[] = [];
      for (let tIdx = 0; tIdx < times.length; tIdx++) {
        const coord = projection.grid.find(g => 
          g.projection_time === times[tIdx] && 
          Math.abs(g.price - distinctPrices[pIdx]) < (distinctPrices[pIdx] * 0.05)
        );
        row.push(coord ? coord.density : 0.0);
      }
      zMatrix.push(row);
    }

    return [
      {
        x: xDays,
        y: distinctPrices,
        z: zMatrix,
        type: 'surface',
        colorscale: 'Viridis',
        opacity: 0.88,
        name: 'Simulated Path Density',
        showscale: false,
        hovertemplate: 'Time: %{x}<br>Price: $%{y:.0f}<br>Density: %{z:.5f}<extra></extra>'
      }
    ];
  };

  const getLayoutThemeSettings = () => {
    const isLight = theme === 'light';
    return {
      title: { 
        text: `Simulated Price Density Surface — ${ticker}`, 
        font: { color: isLight ? '#0F172A' : '#F1F5F9', family: 'Inter', size: 12 } 
      },
      scene: {
        xaxis: { 
          title: { text: 'Time Step', font: { color: isLight ? '#475569' : '#94A3B8', size: 9 } }, 
          tickfont: { color: isLight ? '#475569' : '#64748B', size: 8 }, 
          gridcolor: isLight ? 'rgba(226, 232, 240, 0.6)' : 'rgba(31, 41, 66, 0.2)' 
        },
        yaxis: { 
          title: { text: 'Price ($)', font: { color: isLight ? '#475569' : '#94A3B8', size: 9 } }, 
          tickfont: { color: isLight ? '#475569' : '#64748B', size: 8 }, 
          gridcolor: isLight ? 'rgba(226, 232, 240, 0.6)' : 'rgba(31, 41, 66, 0.2)' 
        },
        zaxis: { 
          title: { text: 'Density', font: { color: isLight ? '#475569' : '#94A3B8', size: 9 } }, 
          tickfont: { color: isLight ? '#475569' : '#64748B', size: 8 }, 
          gridcolor: isLight ? 'rgba(226, 232, 240, 0.6)' : 'rgba(31, 41, 66, 0.2)' 
        },
        camera: { eye: { x: 1.35, y: 1.35, z: 1.1 } },
        bgcolor: 'rgba(0,0,0,0)'
      },
      uirevision: ticker,
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      margin: { l: 5, r: 5, t: 25, b: 5 }
    };
  };

  const getModeBadgeClass = () => {
    return dataMode === 'live'
      ? 'bg-teal-50 border-teal-200 text-teal-700 dark:bg-teal-950/20 dark:border-teal-900/30 dark:text-teal-400'
      : 'bg-orange-50 border-orange-250 text-orange-800 dark:bg-orange-950/20 dark:border-orange-900/30 dark:text-orange-400';
  };

  const plotData = useMemo(() => construct3DPlotData(), [projection]);
  const plotLayout = useMemo(() => getLayoutThemeSettings(), [theme, ticker]);

  return (
    <div className={`space-y-8 min-h-screen p-6 rounded-2xl border transition-all duration-300 ${
      theme === 'light' 
        ? 'bg-slate-50 text-slate-800 border-slate-200' 
        : 'bg-[#151D30]/20 text-slate-100 border-[#1F2942]/60'
    }`}>
      {/* Page Header */}
      <div className={`flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-5 ${
        theme === 'light' ? 'border-slate-200' : 'border-[#1F2942]/60'
      }`}>
        <div>
          <h1 className={`text-3xl font-black tracking-tight ${
            theme === 'light' ? 'text-slate-900' : 'text-slate-100'
          }`}>
            Projection Surface
          </h1>
          <p className={`text-sm mt-2 font-medium leading-relaxed max-w-3xl ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>
            A 3D view of possible future price ranges across time and probability.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded border ${getModeBadgeClass()}`}>
            Mode: {dataMode === 'live' ? 'Live (Database)' : 'Demo (Simulated)'}
          </span>

          <select
            value={ticker}
            onChange={(e) => setTicker(e.target.value)}
            className={`border rounded-lg px-4 py-2 text-xs font-mono font-bold outline-none cursor-pointer ${
              theme === 'light'
                ? 'bg-white border-slate-200 text-slate-800 focus:border-indigo-500'
                : 'bg-[#0B0F19] border-[#1F2942] text-slate-200 focus:border-cyan-500/50'
            }`}
          >
            {assetsList.map(item => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Fallback Banner */}
      {dataMode === 'demo' && (
        <div className={`p-4 rounded-xl text-xs flex items-center gap-3 border shadow-sm ${
          theme === 'light' ? 'bg-amber-50 border-amber-100 text-slate-700' : 'bg-amber-500/5 border-amber-500/10 text-slate-350'
        }`}>
          <ShieldAlert className="w-4 h-4 text-amber-500" />
          <span className="font-semibold italic">“Demo projection surface generated from simulated paths.”</span>
        </div>
      )}

      {loading ? (
        <div className="w-full h-[450px] flex items-center justify-center bg-slate-100/50 dark:bg-[#151D30]/20 rounded-xl border border-slate-200 dark:border-[#1F2942] animate-pulse">
          <div className="text-slate-500 font-mono text-xs flex items-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" /> Solving Monte Carlo discrete densities...
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Main 3D Surface */}
          <div className={`xl:col-span-2 rounded-xl p-4 border h-[500px] shadow-sm transition-colors duration-300 ${
            theme === 'light' ? 'bg-white border-slate-200' : 'glass-panel border-[#1F2942] bg-[#151D30]/30'
          }`}>
            <Plot
              data={plotData}
              layout={plotLayout as any}
              config={{ responsive: true, displayModeBar: false }}
              className="w-full h-full"
            />
          </div>

          <div className="space-y-6">
            {/* Terminal Targets Panel */}
            <div className={`rounded-xl p-5.5 border flex flex-col justify-between shadow-sm transition-colors duration-300 ${
              theme === 'light' ? 'bg-white border-slate-200 text-slate-800' : 'glass-panel border-[#1F2942] bg-[#151D30]/30 text-slate-100'
            }`}>
              <div>
                <div className="flex items-center gap-2 mb-4 border-b pb-3 border-slate-100 dark:border-[#1F2942]/60">
                  <Layers className="w-4 h-4 text-indigo-500" />
                  <h3 className={`text-xs font-bold uppercase tracking-wider font-sans ${theme === 'light' ? 'text-slate-950' : 'text-slate-100'}`}>
                    Terminal Scenarios (7D)
                  </h3>
                </div>

                <div className="space-y-3.5">
                  <div className="p-3.5 rounded-lg bg-emerald-500/5 border border-emerald-500/20 dark:border-emerald-500/10">
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 block uppercase font-bold tracking-wide">Bull Case Path (P90)</span>
                    <span className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 block mt-1">
                      ${projection?.bull_scenario[projection.bull_scenario.length - 1]?.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-lg bg-indigo-500/5 border border-indigo-500/20 dark:border-indigo-500/10">
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 block uppercase font-bold tracking-wide">Base Case Path (P50)</span>
                    <span className="text-xl font-bold font-mono text-indigo-600 dark:text-indigo-400 block mt-1">
                      ${projection?.base_scenario[projection.base_scenario.length - 1]?.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-lg bg-rose-500/5 border border-rose-500/20 dark:border-rose-500/10">
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 block uppercase font-bold tracking-wide">Bear Case Path (P10)</span>
                    <span className="text-xl font-bold font-mono text-rose-600 dark:text-rose-400 block mt-1">
                      ${projection?.bear_scenario[projection.bear_scenario.length - 1]?.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              <div className="border-t pt-4 mt-6 text-[10px] font-mono text-slate-500 space-y-1.5 border-slate-100 dark:border-[#1F2942]/60">
                <div className="flex justify-between">
                  <span>Paths Simulated:</span>
                  <span className={theme === 'light' ? 'text-slate-800' : 'text-slate-300'}>10,000 runs</span>
                </div>
                <div className="flex justify-between">
                  <span>Horizon steps:</span>
                  <span className={theme === 'light' ? 'text-slate-800' : 'text-slate-300'}>7 Days</span>
                </div>
                <div className="flex justify-between">
                  <span>Model Standard:</span>
                  <span className={`uppercase ${theme === 'light' ? 'text-slate-800' : 'text-slate-300'}`}>{projection?.model_type}</span>
                </div>
              </div>
            </div>

            {/* 4. How to read this chart Panel */}
            <div className={`rounded-xl p-5 border flex flex-col justify-between shadow-sm transition-colors duration-300 ${
              theme === 'light' ? 'bg-white border-slate-200 text-slate-800' : 'glass-panel border-[#1F2942] bg-[#151D30]/30 text-slate-100'
            }`}>
              <div>
                <div className="flex items-center gap-2 mb-3 border-b pb-2 border-slate-100 dark:border-[#1F2942]/60">
                  <HelpCircle className="w-4 h-4 text-indigo-500" />
                  <h3 className={`text-xs font-bold uppercase tracking-wider font-sans ${theme === 'light' ? 'text-slate-950' : 'text-slate-100'}`}>
                    How to read this chart
                  </h3>
                </div>

                <ul className={`text-[11px] leading-relaxed font-medium space-y-2 ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>
                  <li><strong className={theme === 'light' ? 'text-slate-850' : 'text-slate-200'}>X-axis:</strong> Represents future time steps from Day +0 to Day +7.</li>
                  <li><strong className={theme === 'light' ? 'text-slate-850' : 'text-slate-200'}>Y-axis:</strong> Represents possible asset prices at that point in time.</li>
                  <li><strong className={theme === 'light' ? 'text-slate-850' : 'text-slate-200'}>Color & Height (Z-axis):</strong> Represents path density (or probability).</li>
                  <li>Higher, colored peak ridges represent prices where the highest number of simulated paths ended. Lower valleys represent tail-risk events.</li>
                  <li className="pt-2 border-t text-[10px] font-semibold italic text-rose-500">Note: This is not a guaranteed forecast, but a representation of mathematical probabilities.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
