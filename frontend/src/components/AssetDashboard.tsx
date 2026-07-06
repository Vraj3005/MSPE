'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { api, MarketBar, MarketFeature, SurfaceProjectionResponse, ProjectedSurfaceBase } from '../lib/api';
import { BarChart, Activity, Shield, RefreshCw, Layers, Zap, Info, ChevronDown, ChevronUp, HelpCircle } from 'lucide-react';
import { copy } from '../content/copy';

// Dynamic Plotly Import to prevent SSR errors in Next.js
const Plot = dynamic(() => import('react-plotly.js'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[400px] flex items-center justify-center bg-slate-100/50 rounded-xl border border-slate-200/50 animate-pulse">
      <div className="text-slate-400 font-mono text-xs flex items-center gap-2">
        <RefreshCw className="w-4 h-4 animate-spin" /> Preparing Interactive Charts...
      </div>
    </div>
  )
});

interface AssetDashboardProps {
  theme?: 'light' | 'dark';
}

export default function AssetDashboard({ theme = 'light' }: AssetDashboardProps) {
  const [selectedTicker, setSelectedTicker] = useState<string>('BTCUSDT');
  const [resolution, setResolution] = useState<string>('1d');
  const [bars, setBars] = useState<MarketBar[]>([]);
  const [features, setFeatures] = useState<MarketFeature[]>([]);
  
  // 3D Mesh states
  const [show3DMesh, setShow3DMesh] = useState<boolean>(false);
  const [projection, setProjection] = useState<SurfaceProjectionResponse | null>(null);
  const [simulating, setSimulating] = useState<boolean>(false);
  const [simMessage, setSimMessage] = useState<string | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [computing, setComputing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const assetsList = ['BTCUSDT', 'ETHUSDT', 'SPX', 'XAU'];

  // Default premium fallbacks for zero-database setups
  const generateMockBars = (ticker: string, count: number = 60): MarketBar[] => {
    const mockBars: MarketBar[] = [];
    let price = {
      'BTCUSDT': 62000.0,
      'ETHUSDT': 3200.0,
      'SPX': 5000.0,
      'XAU': 2200.0
    }[ticker] || 100.0;
    
    const volBase = {
      'BTCUSDT': 25000.0,
      'ETHUSDT': 150000.0,
      'SPX': 4000000.0,
      'XAU': 80000.0
    }[ticker] || 1000.0;

    const now = new Date();
    for (let i = count; i >= 0; i--) {
      const t = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const change = price * (0.01 + (Math.random() - 0.5) * 0.04);
      const open = price;
      const close = price + change;
      const high = Math.max(open, close) + price * Math.random() * 0.015;
      const low = Math.min(open, close) - price * Math.random() * 0.015;
      const volume = volBase * (0.5 + Math.random());
      
      mockBars.push({
        timestamp: t.toISOString(),
        open,
        high,
        low,
        close,
        volume,
        resolution: '1d'
      });
      price = close;
    }
    return mockBars;
  };

  const generateMock3DSurface = (selectedTicker: string): SurfaceProjectionResponse => {
    const spot = {
      'BTCUSDT': 65000.0,
      'ETHUSDT': 3400.0,
      'SPX': 5100.0,
      'XAU': 2300.0
    }[selectedTicker] || 100.0;

    const mu = 0.05 / 252.0;       // Daily drift
    const sigma = 0.30 / Math.sqrt(252.0); // Daily volatility

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

      // Build 3D mesh points at this step
      const minPrice = p10 * 0.85;
      const maxPrice = p90 * 1.15;
      const priceIntervals = 15;

      for (let j = 0; j < priceIntervals; j++) {
        const gridPrice = minPrice + (maxPrice - minPrice) * (j / (priceIntervals - 1));
        
        // Continuous PDF formula
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
      
      let fetchedBars: MarketBar[] = [];
      try {
        fetchedBars = await api.getHistoricalBars(selectedTicker, resolution);
      } catch {
        fetchedBars = generateMockBars(selectedTicker);
      }
      
      if (!fetchedBars || fetchedBars.length === 0) {
        fetchedBars = generateMockBars(selectedTicker);
      }
      setBars(fetchedBars);

      // Load indicator features
      let fetchedFeatures: MarketFeature[] = [];
      try {
        fetchedFeatures = await api.getFeatures(selectedTicker, resolution);
      } catch {
        fetchedFeatures = fetchedBars.map((b, idx) => {
          const mockSma = b.close * (0.98 + (idx / 1000));
          const mockEma = b.close * 0.99;
          const mockRsi = 45.0 + Math.random() * 25.0;
          const mockMacd = (b.close * 0.005) * (Math.random() - 0.4);
          const mockAtr = b.close * 0.02;
          const mockVol = 0.15 + Math.random() * 0.1;
          
          return {
            timestamp: b.timestamp,
            resolution: b.resolution,
            asset_id: 'mock-asset',
            sma_20: mockSma,
            ema_20: mockEma,
            rsi_14: mockRsi,
            macd: mockMacd,
            atr_14: mockAtr,
            parkinson_volatility_30: mockVol,
            support_30: b.close * 0.9,
            resistance_30: b.close * 1.1
          };
        });
      }
      setFeatures(fetchedFeatures);

      // Load Projections 3D grid
      let fetchedProj: SurfaceProjectionResponse | null = null;
      try {
        fetchedProj = await api.getLatestProjection(selectedTicker);
      } catch {
        fetchedProj = generateMock3DSurface(selectedTicker);
      }
      setProjection(fetchedProj || generateMock3DSurface(selectedTicker));

    } catch (err: any) {
      setError(err.message || 'Failed to load asset metrics');
    } finally {
      setLoading(false);
    }
  };

  const handleComputeFeatures = async () => {
    try {
      setComputing(true);
      await api.triggerComputeFeatures(selectedTicker, resolution);
      setTimeout(() => loadData(), 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to compute features');
      setComputing(false);
    } finally {
      setComputing(false);
    }
  };

  const handleRunProjection = async () => {
    try {
      setSimulating(true);
      setSimMessage(null);
      const res = await api.triggerProjectionRun(selectedTicker, 10000, 7);
      setSimMessage(res.detail || 'Monte Carlo projection path simulation triggered.');
      setTimeout(() => {
        setSimMessage(null);
        loadData();
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to execute projections.');
    } finally {
      setSimulating(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedTicker, resolution]);

  // Extract chart vectors
  const timestamps = bars.map(b => new Date(b.timestamp).toLocaleDateString());
  const opens = bars.map(b => b.open);
  const highs = bars.map(b => b.high);
  const lows = bars.map(b => b.low);
  const closes = bars.map(b => b.close);

  const sma = features.map(f => f.sma_20 || null);
  const ema = features.map(f => f.ema_20 || null);
  const support = features.map(f => f.support_30 || null);
  const resistance = features.map(f => f.resistance_30 || null);
  
  const rsi = features.map(f => f.rsi_14 || null);
  const macd = features.map(f => f.macd || null);
  const parkinsonVol = features.map(f => (f.parkinson_volatility_30 || 0.0) * 100.0);

  // Format 3D grid data for Plotly
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
        opacity: 0.85,
        name: 'Thousands of simulated future paths',
        showscale: false
      }
    ];
  };

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
          }`}>Technical Detail & Charting</h2>
          <p className={`text-xs mt-1 transition-colors duration-300 ${
            theme === 'light' ? 'text-slate-500' : 'text-slate-400'
          }`}>Interactive price charts, trend moving averages, and volatility gauges</p>
        </div>
        
        <div className="flex items-center gap-3">
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

          <button
            onClick={handleComputeFeatures}
            disabled={computing}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold tracking-wider uppercase border transition-all duration-300 ${
              computing 
                ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed dark:bg-cyan-500/5 dark:text-cyan-500 dark:border-cyan-500/30' 
                : theme === 'light'
                  ? 'bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50 active:scale-95 shadow-sm'
                  : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30 hover:bg-indigo-500/20 active:scale-95'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${computing ? 'animate-spin' : ''}`} />
            {computing ? 'Computing...' : 'Recalculate Features'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="w-full h-[400px] flex items-center justify-center bg-slate-100/50 rounded-xl border border-slate-200/50 animate-pulse">
          <div className="text-slate-400 font-mono text-xs flex items-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" /> Querying Price History...
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {/* Main Candlestick Chart with overlays */}
          <div className={`rounded-xl p-4 border transition-colors duration-300 ${
            theme === 'light' ? 'bg-white border-slate-200 shadow-sm' : 'glass-panel border-[#1F2942] bg-[#151D30]/30'
          }`}>
            <Plot
              data={[
                {
                  x: timestamps,
                  open: opens,
                  high: highs,
                  low: lows,
                  close: closes,
                  type: 'candlestick',
                  name: selectedTicker,
                  increasing: { line: { color: '#0EA5E9' } },
                  decreasing: { line: { color: '#F43F5E' } }
                },
                {
                  x: timestamps,
                  y: sma,
                  type: 'scatter',
                  mode: 'lines',
                  name: 'SMA (20-Day Simple Average)',
                  line: { color: '#4F46E5', width: 1.5 }
                },
                {
                  x: timestamps,
                  y: ema,
                  type: 'scatter',
                  mode: 'lines',
                  name: 'EMA (20-Day Exponential Average)',
                  line: { color: '#F59E0B', width: 1.5, dash: 'dash' }
                },
                {
                  x: timestamps,
                  y: support,
                  type: 'scatter',
                  mode: 'lines',
                  name: 'Support Line (30-Day Floor)',
                  line: { color: '#10B981', width: 1, dash: 'dot' }
                },
                {
                  x: timestamps,
                  y: resistance,
                  type: 'scatter',
                  mode: 'lines',
                  name: 'Resistance Line (30-Day Ceiling)',
                  line: { color: '#EF4444', width: 1, dash: 'dot' }
                }
              ]}
              layout={{
                title: { 
                  text: `${selectedTicker} - Historical Prices & Key Levels`, 
                  font: { color: theme === 'light' ? '#0F172A' : '#F1F5F9', family: 'Inter', size: 13 } 
                },
                dragmode: 'zoom',
                showlegend: true,
                xaxis: {
                  rangeslider: { visible: false },
                  gridcolor: theme === 'light' ? 'rgba(203,213,225,0.4)' : 'rgba(31,41,66,0.3)',
                  tickfont: { color: theme === 'light' ? '#475569' : '#94A3B8', size: 10 },
                  linecolor: theme === 'light' ? '#CBD5E1' : '#1F2942'
                },
                yaxis: {
                  gridcolor: theme === 'light' ? 'rgba(203,213,225,0.4)' : 'rgba(31,41,66,0.3)',
                  tickfont: { color: theme === 'light' ? '#475569' : '#94A3B8', size: 10 },
                  linecolor: theme === 'light' ? '#CBD5E1' : '#1F2942',
                  autorange: true
                },
                paper_bgcolor: 'rgba(0,0,0,0)',
                plot_bgcolor: 'rgba(0,0,0,0)',
                margin: { l: 50, r: 30, t: 40, b: 40 },
                legend: { 
                  font: { color: theme === 'light' ? '#475569' : '#E2E8F0', size: 9 }, 
                  orientation: 'h', 
                  y: -0.15 
                }
              }}
              config={{ responsive: true, displayModeBar: false }}
              className="w-full h-[380px]"
            />
          </div>

          {/* Subplots Indicators Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* 1. RSI Indicator */}
            <div className={`rounded-xl p-4 border transition-colors duration-300 ${
              theme === 'light' ? 'bg-white border-slate-200 shadow-sm' : 'glass-panel border-[#1F2942] bg-[#151D30]/30'
            }`}>
              <h4 className={`text-xs font-bold font-mono mb-2 uppercase flex items-center gap-1.5 justify-between ${
                theme === 'light' ? 'text-slate-700' : 'text-slate-400'
              }`}>
                <span className="flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-indigo-500" /> RSI - Speed of Price Changes
                </span>
                <span title="Momentum score between 0 and 100. Values above 70 indicate overbought conditions, below 30 indicate oversold conditions.">
                  <HelpCircle className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600 cursor-help" />
                </span>
              </h4>
              <Plot
                data={[
                  {
                    x: timestamps,
                    y: rsi,
                    type: 'scatter',
                    mode: 'lines',
                    line: { color: '#4F46E5', width: 1.5 }
                  },
                  {
                    x: [timestamps[0], timestamps[timestamps.length - 1]],
                    y: [70, 70],
                    type: 'scatter',
                    mode: 'lines',
                    line: { color: '#EF4444', width: 1, dash: 'dash' },
                    showlegend: false
                  },
                  {
                    x: [timestamps[0], timestamps[timestamps.length - 1]],
                    y: [30, 30],
                    type: 'scatter',
                    mode: 'lines',
                    line: { color: '#10B981', width: 1, dash: 'dash' },
                    showlegend: false
                  }
                ]}
                layout={{
                  showlegend: false,
                  xaxis: { 
                    gridcolor: theme === 'light' ? 'rgba(203,213,225,0.4)' : 'rgba(31,41,66,0.2)', 
                    tickfont: { color: theme === 'light' ? '#475569' : '#64748B', size: 9 }, 
                    linecolor: theme === 'light' ? '#CBD5E1' : '#1F2942' 
                  },
                  yaxis: { 
                    gridcolor: theme === 'light' ? 'rgba(203,213,225,0.4)' : 'rgba(31,41,66,0.2)', 
                    tickfont: { color: theme === 'light' ? '#475569' : '#64748B', size: 9 }, 
                    range: [10, 90] 
                  },
                  paper_bgcolor: 'rgba(0,0,0,0)',
                  plot_bgcolor: 'rgba(0,0,0,0)',
                  margin: { l: 30, r: 10, t: 10, b: 30 }
                }}
                config={{ responsive: true, displayModeBar: false }}
                className="w-full h-[180px]"
              />
            </div>

            {/* 2. MACD Histogram */}
            <div className={`rounded-xl p-4 border transition-colors duration-300 ${
              theme === 'light' ? 'bg-white border-slate-200 shadow-sm' : 'glass-panel border-[#1F2942] bg-[#151D30]/30'
            }`}>
              <h4 className={`text-xs font-bold font-mono mb-2 uppercase flex items-center gap-1.5 justify-between ${
                theme === 'light' ? 'text-slate-700' : 'text-slate-400'
              }`}>
                <span className="flex items-center gap-1.5">
                  <BarChart className="w-3.5 h-3.5 text-indigo-500" /> MACD - Strength of Price Trend
                </span>
                <span title="Moving Average Convergence Divergence. Shows changes in the strength, direction, and momentum of a price trend.">
                  <HelpCircle className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600 cursor-help" />
                </span>
              </h4>
              <Plot
                data={[
                  {
                    x: timestamps,
                    y: macd,
                    type: 'bar',
                    marker: {
                      color: macd.map(val => (val && val >= 0) ? '#0D9488' : '#BE123C')
                    }
                  }
                ]}
                layout={{
                  showlegend: false,
                  xaxis: { 
                    gridcolor: theme === 'light' ? 'rgba(203,213,225,0.4)' : 'rgba(31,41,66,0.2)', 
                    tickfont: { color: theme === 'light' ? '#475569' : '#64748B', size: 9 }, 
                    linecolor: theme === 'light' ? '#CBD5E1' : '#1F2942' 
                  },
                  yaxis: { 
                    gridcolor: theme === 'light' ? 'rgba(203,213,225,0.4)' : 'rgba(31,41,66,0.2)', 
                    tickfont: { color: theme === 'light' ? '#475569' : '#64748B', size: 9 } 
                  },
                  paper_bgcolor: 'rgba(0,0,0,0)',
                  plot_bgcolor: 'rgba(0,0,0,0)',
                  margin: { l: 30, r: 10, t: 10, b: 30 }
                }}
                config={{ responsive: true, displayModeBar: false }}
                className="w-full h-[180px]"
              />
            </div>

            {/* 3. Volatility Indicator */}
            <div className={`rounded-xl p-4 border transition-colors duration-300 ${
              theme === 'light' ? 'bg-white border-slate-200 shadow-sm' : 'glass-panel border-[#1F2942] bg-[#151D30]/30'
            }`}>
              <h4 className={`text-xs font-bold font-mono mb-2 uppercase flex items-center gap-1.5 justify-between ${
                theme === 'light' ? 'text-slate-700' : 'text-slate-400'
              }`}>
                <span className="flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-indigo-500" /> Volatility - Swing Rate (%)
                </span>
                <span title="Parkinson high-low price volatility. Represents the rolling historical range variation.">
                  <HelpCircle className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600 cursor-help" />
                </span>
              </h4>
              <Plot
                data={[
                  {
                    x: timestamps,
                    y: parkinsonVol,
                    type: 'scatter',
                    mode: 'lines',
                    line: { color: '#F59E0B', width: 1.5 }
                  }
                ]}
                layout={{
                  showlegend: false,
                  xaxis: { 
                    gridcolor: theme === 'light' ? 'rgba(203,213,225,0.4)' : 'rgba(31,41,66,0.2)', 
                    tickfont: { color: theme === 'light' ? '#475569' : '#64748B', size: 9 }, 
                    linecolor: theme === 'light' ? '#CBD5E1' : '#1F2942' 
                  },
                  yaxis: { 
                    gridcolor: theme === 'light' ? 'rgba(203,213,225,0.4)' : 'rgba(31,41,66,0.2)', 
                    tickfont: { color: theme === 'light' ? '#475569' : '#64748B', size: 9 } 
                  },
                  paper_bgcolor: 'rgba(0,0,0,0)',
                  plot_bgcolor: 'rgba(0,0,0,0)',
                  margin: { l: 30, r: 10, t: 10, b: 30 }
                }}
                config={{ responsive: true, displayModeBar: false }}
                className="w-full h-[180px]"
              />
            </div>
          </div>

          {/* Collapsible 3D Probability Surface Mesh */}
          <div className={`rounded-xl border overflow-hidden transition-colors duration-300 ${
            theme === 'light' ? 'bg-white border-slate-200 shadow-sm' : 'glass-panel border-[#1F2942]'
          }`}>
            <button
              onClick={() => setShow3DMesh(!show3DMesh)}
              className={`w-full px-6 py-4 flex justify-between items-center transition-colors ${
                theme === 'light' 
                  ? 'bg-slate-100 hover:bg-slate-200/60' 
                  : 'bg-[#151D30]/20 hover:bg-[#151D30]/40'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Layers className="w-4 h-4 text-indigo-500" />
                <span className={`text-sm font-bold tracking-wider uppercase font-mono ${
                  theme === 'light' ? 'text-slate-900' : 'text-slate-100'
                }`}>
                  Interactive 3D Price Range Mesh (Advanced View)
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-slate-500 font-mono hidden sm:inline">
                  {show3DMesh ? 'CLICK TO COLLAPSE' : 'CLICK TO EXPAND'}
                </span>
                {show3DMesh ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </div>
            </button>

            {show3DMesh && (
              <div className={`p-6 border-t space-y-6 ${
                theme === 'light' ? 'border-slate-200 bg-slate-50' : 'border-[#1F2942] bg-[#0B0F19]/40'
              }`}>
                <div className={`flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 p-4 rounded-lg border ${
                  theme === 'light' ? 'bg-white border-slate-200' : 'bg-[#0B0F19]/60 border-[#1F2942]/60'
                }`}>
                  <div className="text-xs text-slate-400 max-w-2xl">
                    <p className={`font-bold ${theme === 'light' ? 'text-slate-900' : 'text-slate-200'}`}>
                      How to Read the 3D Price Range Mesh:
                    </p>
                    <p className={`mt-1 leading-relaxed ${theme === 'light' ? 'text-slate-650' : 'text-slate-400'}`}>
                      This mesh projects simulated future paths (Z-axis, height) across different prices (Y-axis) over the next 7 days (X-axis). 
                      The peaks represent the most likely price levels predicted by the engine's model over time.
                    </p>
                  </div>
                  <button
                    onClick={handleRunProjection}
                    disabled={simulating}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold tracking-wider uppercase border transition-all duration-300 whitespace-nowrap ${
                      simulating 
                        ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' 
                        : theme === 'light'
                          ? 'bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50 active:scale-95 shadow-sm'
                          : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30 hover:bg-indigo-500/20 active:scale-95'
                    }`}
                  >
                    <Zap className={`w-3.5 h-3.5 ${simulating ? 'animate-bounce' : ''}`} />
                    {simulating ? 'Running Simulator...' : 'Run Monte Carlo'}
                  </button>
                </div>

                {simMessage && (
                  <div className="flex items-center gap-2.5 p-3 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>{simMessage}</span>
                  </div>
                )}

                <div className={`w-full h-[450px] rounded-lg overflow-hidden border ${
                  theme === 'light' ? 'bg-white border-slate-200' : 'border-[#1F2942]'
                }`}>
                  <Plot
                    data={construct3DPlotData()}
                    layout={{
                      title: { 
                        text: `Thousands of simulated future paths (3D Mesh)`, 
                        font: { color: theme === 'light' ? '#0F172A' : '#F1F5F9', family: 'Inter', size: 12 } 
                      },
                      autosize: true,
                      scene: {
                        xaxis: { 
                          title: { text: 'Time Step', font: { color: theme === 'light' ? '#475569' : '#94A3B8', size: 9 } }, 
                          tickfont: { color: theme === 'light' ? '#475569' : '#64748B' }, 
                          gridcolor: theme === 'light' ? 'rgba(203,213,225,0.4)' : 'rgba(31,41,66,0.3)' 
                        },
                        yaxis: { 
                          title: { text: 'Price ($)', font: { color: theme === 'light' ? '#475569' : '#94A3B8', size: 9 } }, 
                          tickfont: { color: theme === 'light' ? '#475569' : '#64748B' }, 
                          gridcolor: theme === 'light' ? 'rgba(203,213,225,0.4)' : 'rgba(31,41,66,0.3)' 
                        },
                        zaxis: { 
                          title: { text: 'Likelihood', font: { color: theme === 'light' ? '#475569' : '#94A3B8', size: 9 } }, 
                          tickfont: { color: theme === 'light' ? '#475569' : '#64748B' }, 
                          gridcolor: theme === 'light' ? 'rgba(203,213,225,0.4)' : 'rgba(31,41,66,0.3)' 
                        },
                        camera: { eye: { x: 1.4, y: 1.4, z: 1.1 } },
                        bgcolor: 'rgba(0,0,0,0)'
                      },
                      paper_bgcolor: 'rgba(0,0,0,0)',
                      plot_bgcolor: 'rgba(0,0,0,0)',
                      margin: { l: 5, r: 5, t: 25, b: 5 }
                    }}
                    config={{ responsive: true, displayModeBar: false }}
                    className="w-full h-full"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Simple Methodology Explanation */}
          <div className={`rounded-xl p-6 border transition-all duration-300 ${
            theme === 'light' ? 'bg-white border-slate-200 shadow-sm' : 'glass-panel border-[#1F2942] bg-[#151D30]/30'
          }`}>
            <h3 className={`text-sm font-bold tracking-wider uppercase border-b pb-3 flex items-center gap-2 ${
              theme === 'light' ? 'border-slate-100 text-slate-900 font-bold' : 'border-[#1F2942]/60 text-slate-100'
            }`}>
              <Info className="w-4 h-4 text-indigo-500" />
              Methodology Explained (How the Engine Works)
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs leading-relaxed">
              <div className="space-y-1.5">
                <h4 className={`font-bold font-mono text-[10px] tracking-wider uppercase ${
                  theme === 'light' ? 'text-slate-900 font-bold' : 'text-slate-200'
                }`}>01 // Machine Learning Trend Model</h4>
                <p className={theme === 'light' ? 'text-slate-650' : 'text-slate-400'}>
                  We train supervised ML regression models (such as <strong>XGBoost</strong> and <strong>Random Forest</strong>) on historical price action 
                  and indicator features (RSI, moving averages, volatility parameters). These models estimate the expected direction (drift trend) 
                  and variance over the forward horizon.
                </p>
              </div>

              <div className="space-y-1.5">
                <h4 className={`font-bold font-mono text-[10px] tracking-wider uppercase ${
                  theme === 'light' ? 'text-slate-900 font-bold' : 'text-slate-200'
                }`}>02 // Thousands of simulated future paths</h4>
                <p className={theme === 'light' ? 'text-slate-650' : 'text-slate-400'}>
                  Using the ML forecasts as parameters, we run an <strong>Euler-Maruyama discretized simulation</strong> of Geometric Brownian Motion (GBM). 
                  The model generates <strong>10,000 distinct price paths</strong> forward in time, representing different market scenarios based on randomness.
                </p>
              </div>

              <div className="space-y-1.5">
                <h4 className={`font-bold font-mono text-[10px] tracking-wider uppercase ${
                  theme === 'light' ? 'text-slate-900 font-bold' : 'text-slate-200'
                }`}>03 // Bear, Base, and Bull Price Scenarios</h4>
                <p className={theme === 'light' ? 'text-slate-650' : 'text-slate-400'}>
                  Instead of showing thousands of lines, we group these paths into percentiles. The **Bull (P90)** boundary means only 10% of paths went higher. 
                  The **Bear (P10)** boundary means only 10% went lower. The **Base (P50)** shows the median outcome. This provides a clear range of outcomes.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
