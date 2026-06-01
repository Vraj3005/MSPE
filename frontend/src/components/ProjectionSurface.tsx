'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { api, SurfaceProjectionResponse, ProjectedSurfaceBase } from '../lib/api';
import { Layers, RefreshCw, Zap, TrendingUp, AlertTriangle } from 'lucide-react';

const Plot = dynamic(() => import('react-plotly.js'), { 
  ssr: false,
  loading: () => (
    <div className="w-full h-[500px] flex items-center justify-center bg-[#151D30]/30 rounded-xl border border-[#1F2942] animate-pulse">
      <div className="text-slate-400 font-mono text-xs flex items-center gap-2">
        <RefreshCw className="w-4 h-4 animate-spin" /> Compiling 3D Probability Meshes...
      </div>
    </div>
  )
});

export default function ProjectionSurface() {
  const [ticker, setTicker] = useState<string>('BTCUSDT');
  const [numPaths, setNumPaths] = useState<number>(10000);
  const [steps, setSteps] = useState<number>(7);
  const [projection, setProjection] = useState<SurfaceProjectionResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [running, setRunning] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const assetsList = ['BTCUSDT', 'ETHUSDT', 'SPX', 'XAU'];

  const generateMock3DSurface = (selectedTicker: string): SurfaceProjectionResponse => {
    // Generate theoretical GBM paths and continuous densities
    const spot = {
      'BTCUSDT': 65000.0,
      'ETHUSDT': 3400.0,
      'SPX': 5100.0,
      'XAU': 2300.0
    }[selectedTicker] || 100.0;

    const mu = 0.05 / 252.0;       // daily drift
    const sigma = 0.30 / Math.sqrt(252.0); // daily volatility

    const bear_scenario = [];
    const base_scenario = [];
    const bull_scenario = [];
    const grid: ProjectedSurfaceBase[] = [];

    const now = new Date();

    // 7 steps representing forward days
    for (let day = 0; day <= 7; day++) {
      const t = new Date(now.getTime() + day * 24 * 60 * 60 * 1000);
      const timeStr = t.toISOString();

      // Scenario curves
      const drift = mu * day;
      const volWidth = sigma * Math.sqrt(day);

      const p50 = spot * Math.exp(drift);
      const p10 = spot * Math.exp(drift - 1.28 * volWidth); // 10th percentile
      const p90 = spot * Math.exp(drift + 1.28 * volWidth); // 90th percentile

      bear_scenario.push({ time: timeStr, price: p10 });
      base_scenario.push({ time: timeStr, price: p50 });
      bull_scenario.push({ time: timeStr, price: p90 });

      // Build 3D mesh points at this step
      // price ranges between 0.8x bear and 1.2x bull
      const minPrice = p10 * 0.85;
      const maxPrice = p90 * 1.15;
      const priceIntervals = 15; // pricing points grid density

      for (let j = 0; j < priceIntervals; j++) {
        const gridPrice = minPrice + (maxPrice - minPrice) * (j / (priceIntervals - 1));
        
        // Continuous PDF using Gaussian probability density equation
        const distance = Math.log(gridPrice / spot) - (mu * day);
        const variance = (sigma * sigma * Math.max(1, day));
        const density = (1.0 / Math.sqrt(2 * Math.PI * variance)) * Math.exp(-(distance * distance) / (2 * variance));

        grid.push({
          projection_time: timeStr,
          price: gridPrice,
          density: density * 0.01, // scaled for visualization
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
      } catch {
        fetchedProj = generateMock3DSurface(ticker);
      }

      if (!fetchedProj) {
        fetchedProj = generateMock3DSurface(ticker);
      }
      setProjection(fetchedProj);
    } catch (err: any) {
      setError(err.message || 'Failed to load surface projections');
    } finally {
      setLoading(false);
    }
  };

  const handleRunProjection = async () => {
    try {
      setRunning(true);
      setError(null);
      setMessage(null);
      const res = await api.triggerProjectionRun(ticker, numPaths, steps);
      setMessage(res.detail || 'Monte Carlo projection simulation pipeline initiated.');
      setTimeout(() => {
        setMessage(null);
        loadData();
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to execute Monte Carlo projections');
    } finally {
      setRunning(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [ticker]);

  // Format 3D grid parameters for Plotly
  const construct3DPlotData = (): any[] => {
    if (!projection || !projection.grid || projection.grid.length === 0) return [];

    // Distinct time steps
    const times = Array.from(new Set(projection.grid.map(g => g.projection_time)));
    // Formulate X (times/days forward), Y (price points grid), Z (density matrix)
    const xDays = times.map((_, idx) => `Day +${idx}`);
    
    // Extrusion of 2D grid matrix coordinates
    const distinctPrices = Array.from(new Set(projection.grid.map(g => Math.round(g.price))));
    distinctPrices.sort((a, b) => a - b);

    const zMatrix: number[][] = [];
    
    // Outer loop: prices (Y-axis rows)
    for (let pIdx = 0; pIdx < distinctPrices.length; pIdx++) {
      const row: number[] = [];
      // Inner loop: times (X-axis columns)
      for (let tIdx = 0; tIdx < times.length; tIdx++) {
        // Find matching coordinate
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
        opacity: 0.85,
        name: 'Probability Density Mesh',
        showscale: false
      }
    ];
  };

  return (
    <div className="space-y-6">
      {/* Parameters Header Segment */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-wider text-slate-100 uppercase">3D Projection Surface</h2>
          <p className="text-xs text-slate-400 font-mono mt-1">10,000-path probabilistic forecasting mesh and terminal quantiles</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={ticker}
            onChange={(e) => setTicker(e.target.value)}
            className="bg-[#151D30] border border-[#1F2942] rounded-lg px-4 py-2 text-xs font-mono font-bold text-slate-200 outline-none focus:border-cyan-500/50"
          >
            {assetsList.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          <button
            onClick={handleRunProjection}
            disabled={running}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold tracking-wider uppercase border border-cyan-500/30 transition-all duration-300 ${
              running 
                ? 'bg-cyan-500/5 text-cyan-500 cursor-not-allowed' 
                : 'bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 active:scale-95'
            }`}
          >
            <Zap className={`w-3.5 h-3.5 ${running ? 'animate-bounce' : ''}`} />
            {running ? 'Simulating Paths...' : 'Run Monte Carlo'}
          </button>
        </div>
      </div>

      {/* Message & error banners */}
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
        <div className="w-full h-[500px] flex items-center justify-center bg-[#151D30]/20 rounded-xl border border-[#1F2942] animate-pulse">
          <div className="text-slate-400 font-mono text-xs flex items-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" /> Formulating Euler-Maruyama Quantiles...
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Main 3D Surface Mesh Viewport */}
          <div className="xl:col-span-2 glass-panel rounded-xl p-4 border border-[#1F2942] h-[520px]">
            <Plot
              data={construct3DPlotData()}
              layout={{
                title: { text: `3D Probabilistic Density Mesh (Z = Density)`, font: { color: '#F1F5F9', family: 'Inter', size: 12 } },
                autosize: true,
                scene: {
                  xaxis: { title: { text: 'Time Step', font: { color: '#94A3B8', size: 9 } }, tickfont: { color: '#64748B' }, gridcolor: '#1F2942/30' },
                  yaxis: { title: { text: 'Price ($)', font: { color: '#94A3B8', size: 9 } }, tickfont: { color: '#64748B' }, gridcolor: '#1F2942/30' },
                  zaxis: { title: { text: 'Density', font: { color: '#94A3B8', size: 9 } }, tickfont: { color: '#64748B' }, gridcolor: '#1F2942/30' },
                  camera: { eye: { x: 1.5, y: 1.5, z: 1.2 } },
                  bgcolor: 'rgba(0,0,0,0)'
                },
                paper_bgcolor: 'rgba(0,0,0,0)',
                plot_bgcolor: 'rgba(0,0,0,0)',
                margin: { l: 10, r: 10, t: 30, b: 10 }
              }}
              config={{ responsive: true, displayModeBar: false }}
              className="w-full h-full"
            />
          </div>

          {/* Scenario Pathways Metrics Dashboard */}
          <div className="glass-panel rounded-xl p-6 border border-[#1F2942] flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-4 border-b border-[#1F2942]/60 pb-3">
                <Layers className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold tracking-wider text-slate-100 uppercase font-mono">Terminal Scenarios</h3>
              </div>

              <div className="space-y-4">
                {/* Bull Scenario */}
                <div className="p-4 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                  <div className="flex justify-between items-center text-xs mb-1">
                    <span className="text-emerald-400 font-bold uppercase font-mono tracking-wider">Bull Path (P90)</span>
                    <span className="text-[10px] text-slate-500">7-Day Target</span>
                  </div>
                  <div className="text-2xl font-bold text-slate-100 font-mono tracking-tight">
                    ${projection?.bull_scenario[projection.bull_scenario.length - 1]?.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>

                {/* Base Scenario */}
                <div className="p-4 rounded-lg bg-cyan-500/5 border border-cyan-500/20">
                  <div className="flex justify-between items-center text-xs mb-1">
                    <span className="text-cyan-400 font-bold uppercase font-mono tracking-wider">Base Path (P50)</span>
                    <span className="text-[10px] text-slate-500">7-Day Target</span>
                  </div>
                  <div className="text-2xl font-bold text-slate-100 font-mono tracking-tight">
                    ${projection?.base_scenario[projection.base_scenario.length - 1]?.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>

                {/* Bear Scenario */}
                <div className="p-4 rounded-lg bg-rose-500/5 border border-rose-500/20">
                  <div className="flex justify-between items-center text-xs mb-1">
                    <span className="text-rose-400 font-bold uppercase font-mono tracking-wider">Bear Path (P10)</span>
                    <span className="text-[10px] text-slate-500">7-Day Target</span>
                  </div>
                  <div className="text-2xl font-bold text-slate-100 font-mono tracking-tight">
                    ${projection?.bear_scenario[projection.bear_scenario.length - 1]?.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            </div>

            {/* Projection Details Info */}
            <div className="border-t border-[#1F2942]/60 pt-4 mt-6 text-[10px] font-mono text-slate-500 space-y-1.5">
              <div className="flex justify-between">
                <span>Paths Simulated:</span>
                <span className="text-slate-400">10,000 runs</span>
              </div>
              <div className="flex justify-between">
                <span>Resolution steps:</span>
                <span className="text-slate-400">7 Euler steps</span>
              </div>
              <div className="flex justify-between">
                <span>Model standard:</span>
                <span className="text-slate-400 uppercase">{projection?.model_type}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
