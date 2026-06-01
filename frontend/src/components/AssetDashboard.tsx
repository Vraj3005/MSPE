'use client';

import React, { useEffect, useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import { api, Asset, MarketBar, MarketFeature } from '../lib/api';
import { BarChart, Activity, Shield, RefreshCw } from 'lucide-react';

// Dynamic Import for Plotly Chart to completely prevent Server Side Rendering (SSR) errors in Next.js
const Plot = dynamic(() => import('react-plotly.js'), { 
  ssr: false,
  loading: () => (
    <div className="w-full h-[500px] flex items-center justify-center bg-[#151D30]/30 rounded-xl border border-[#1F2942] animate-pulse">
      <div className="text-slate-400 font-mono text-xs flex items-center gap-2">
        <RefreshCw className="w-4 h-4 animate-spin" /> Loading Interactive Canvas...
      </div>
    </div>
  )
});

export default function AssetDashboard() {
  const [selectedTicker, setSelectedTicker] = useState<string>('BTCUSDT');
  const [resolution, setResolution] = useState<string>('1d');
  const [bars, setBars] = useState<MarketBar[]>([]);
  const [features, setFeatures] = useState<MarketFeature[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [computing, setComputing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const assetsList = ['BTCUSDT', 'ETHUSDT', 'SPX', 'XAU'];

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

      // Load features
      let fetchedFeatures: MarketFeature[] = [];
      try {
        fetchedFeatures = await api.getFeatures(selectedTicker, resolution);
      } catch {
        // Formulate mock features
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

  useEffect(() => {
    loadData();
  }, [selectedTicker, resolution]);

  // Extract chart vectors
  const timestamps = bars.map(b => new Date(b.timestamp).toLocaleDateString());
  const opens = bars.map(b => b.open);
  const highs = bars.map(b => b.high);
  const lows = bars.map(b => b.low);
  const closes = bars.map(b => b.close);
  const volumes = bars.map(b => b.volume);

  const sma = features.map(f => f.sma_20 || null);
  const ema = features.map(f => f.ema_20 || null);
  const support = features.map(f => f.support_30 || null);
  const resistance = features.map(f => f.resistance_30 || null);
  
  const rsi = features.map(f => f.rsi_14 || null);
  const macd = features.map(f => f.macd || null);
  const parkinsonVol = features.map(f => (f.parkinson_volatility_30 || 0.0) * 100.0); // as percentage

  return (
    <div className="space-y-6">
      {/* Selector Header Segment */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-wider text-slate-100 uppercase">Asset Dashboard</h2>
          <p className="text-xs text-slate-400 font-mono mt-1">Candlesticks, technical overlays, and continuous rolling indicators</p>
        </div>
        
        <div className="flex items-center gap-3">
          <select
            value={selectedTicker}
            onChange={(e) => setSelectedTicker(e.target.value)}
            className="bg-[#151D30] border border-[#1F2942] rounded-lg px-4 py-2 text-xs font-mono font-bold text-slate-200 outline-none focus:border-cyan-500/50"
          >
            {assetsList.map(ticker => (
              <option key={ticker} value={ticker}>{ticker}</option>
            ))}
          </select>

          <button
            onClick={handleComputeFeatures}
            disabled={computing}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold tracking-wider uppercase border border-cyan-500/30 transition-all duration-300 ${
              computing 
                ? 'bg-cyan-500/5 text-cyan-500 cursor-not-allowed' 
                : 'bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 active:scale-95'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${computing ? 'animate-spin' : ''}`} />
            {computing ? 'Computing...' : 'Recalculate Features'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="w-full h-[500px] flex items-center justify-center bg-[#151D30]/20 rounded-xl border border-[#1F2942] animate-pulse">
          <div className="text-slate-400 font-mono text-xs flex items-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" /> Querying Time-Series Catalog...
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {/* Main Candlestick Chart with overlays */}
          <div className="glass-panel rounded-xl p-4 border border-[#1F2942]">
            <Plot
              data={[
                // 1. Candlesticks
                {
                  x: timestamps,
                  open: opens,
                  high: highs,
                  low: lows,
                  close: closes,
                  type: 'candlestick',
                  name: selectedTicker,
                  increasing: { line: { color: '#10B981' } },
                  decreasing: { line: { color: '#F43F5E' } }
                },
                // 2. SMA Overlay
                {
                  x: timestamps,
                  y: sma,
                  type: 'scatter',
                  mode: 'lines',
                  name: 'SMA (20)',
                  line: { color: '#06B6D4', width: 1.5 }
                },
                // 3. EMA Overlay
                {
                  x: timestamps,
                  y: ema,
                  type: 'scatter',
                  mode: 'lines',
                  name: 'EMA (20)',
                  line: { color: '#F59E0B', width: 1.5, dash: 'dash' }
                },
                // 4. Support
                {
                  x: timestamps,
                  y: support,
                  type: 'scatter',
                  mode: 'lines',
                  name: 'Support',
                  line: { color: '#84CC16', width: 1, dash: 'dot' }
                },
                // 5. Resistance
                {
                  x: timestamps,
                  y: resistance,
                  type: 'scatter',
                  mode: 'lines',
                  name: 'Resistance',
                  line: { color: '#EF4444', width: 1, dash: 'dot' }
                }
              ]}
              layout={{
                title: { text: `${selectedTicker} - Pricing & Volatility Overlays`, font: { color: '#F1F5F9', family: 'Inter', size: 13 } },
                dragmode: 'zoom',
                showlegend: true,
                xaxis: {
                  rangeslider: { visible: false },
                  gridcolor: '#1F2942/30',
                  tickfont: { color: '#94A3B8', size: 10 },
                  linecolor: '#1F2942'
                },
                yaxis: {
                  gridcolor: '#1F2942/30',
                  tickfont: { color: '#94A3B8', size: 10 },
                  linecolor: '#1F2942',
                  autorange: true
                },
                paper_bgcolor: 'rgba(0,0,0,0)',
                plot_bgcolor: 'rgba(0,0,0,0)',
                margin: { l: 50, r: 30, t: 40, b: 40 },
                legend: { font: { color: '#E2E8F0', size: 10 } }
              }}
              config={{ responsive: true, displayModeBar: false }}
              className="w-full h-[380px]"
            />
          </div>

          {/* Subplots Indicators Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* 1. RSI Indicator */}
            <div className="glass-panel rounded-xl p-4 border border-[#1F2942]">
              <h4 className="text-xs font-bold font-mono text-slate-400 mb-2 uppercase flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-cyan-400" /> RSI (14) Oscillator
              </h4>
              <Plot
                data={[
                  {
                    x: timestamps,
                    y: rsi,
                    type: 'scatter',
                    mode: 'lines',
                    line: { color: '#38BDF8', width: 1.5 }
                  },
                  // 70 line
                  {
                    x: [timestamps[0], timestamps[timestamps.length - 1]],
                    y: [70, 70],
                    type: 'scatter',
                    mode: 'lines',
                    line: { color: '#EF4444', width: 1, dash: 'dash' },
                    showlegend: false
                  },
                  // 30 line
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
                  xaxis: { gridcolor: '#1F2942/20', tickfont: { color: '#64748B', size: 9 }, linecolor: '#1F2942' },
                  yaxis: { gridcolor: '#1F2942/20', tickfont: { color: '#64748B', size: 9 }, range: [10, 90] },
                  paper_bgcolor: 'rgba(0,0,0,0)',
                  plot_bgcolor: 'rgba(0,0,0,0)',
                  margin: { l: 30, r: 10, t: 10, b: 30 }
                }}
                config={{ responsive: true, displayModeBar: false }}
                className="w-full h-[180px]"
              />
            </div>

            {/* 2. MACD Histogram */}
            <div className="glass-panel rounded-xl p-4 border border-[#1F2942]">
              <h4 className="text-xs font-bold font-mono text-slate-400 mb-2 uppercase flex items-center gap-1.5">
                <BarChart className="w-3.5 h-3.5 text-purple-400" /> MACD Returns Trend
              </h4>
              <Plot
                data={[
                  {
                    x: timestamps,
                    y: macd,
                    type: 'bar',
                    marker: {
                      color: macd.map(val => (val && val >= 0) ? '#10B981' : '#F43F5E')
                    }
                  }
                ]}
                layout={{
                  showlegend: false,
                  xaxis: { gridcolor: '#1F2942/20', tickfont: { color: '#64748B', size: 9 }, linecolor: '#1F2942' },
                  yaxis: { gridcolor: '#1F2942/20', tickfont: { color: '#64748B', size: 9 } },
                  paper_bgcolor: 'rgba(0,0,0,0)',
                  plot_bgcolor: 'rgba(0,0,0,0)',
                  margin: { l: 30, r: 10, t: 10, b: 30 }
                }}
                config={{ responsive: true, displayModeBar: false }}
                className="w-full h-[180px]"
              />
            </div>

            {/* 3. Volatility Indicator */}
            <div className="glass-panel rounded-xl p-4 border border-[#1F2942]">
              <h4 className="text-xs font-bold font-mono text-slate-400 mb-2 uppercase flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-amber-400" /> Parkinson Volatility (%)
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
                  xaxis: { gridcolor: '#1F2942/20', tickfont: { color: '#64748B', size: 9 }, linecolor: '#1F2942' },
                  yaxis: { gridcolor: '#1F2942/20', tickfont: { color: '#64748B', size: 9 } },
                  paper_bgcolor: 'rgba(0,0,0,0)',
                  plot_bgcolor: 'rgba(0,0,0,0)',
                  margin: { l: 30, r: 10, t: 10, b: 30 }
                }}
                config={{ responsive: true, displayModeBar: false }}
                className="w-full h-[180px]"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
