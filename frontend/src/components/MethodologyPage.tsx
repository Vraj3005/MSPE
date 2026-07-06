'use client';

import React from 'react';
import { 
  Info, 
  Database, 
  TrendingUp, 
  Activity, 
  ShieldAlert, 
  CheckCircle, 
  AlertTriangle, 
  Cpu, 
  GitBranch, 
  Terminal, 
  Server, 
  Layers, 
  FileSpreadsheet,
  Rocket
} from 'lucide-react';

interface MethodologyPageProps {
  theme?: 'light' | 'dark';
}

export default function MethodologyPage({ theme = 'light' }: MethodologyPageProps) {
  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className={`p-6 rounded-xl border transition-all duration-300 ${
        theme === 'light' 
          ? 'bg-white border-slate-200 shadow-sm text-slate-800' 
          : 'glass-panel border-[#1F2942] bg-[#151D30]/30 text-slate-100'
      }`}>
        <h1 className={`text-2xl font-black tracking-tight ${theme === 'light' ? 'text-slate-900' : 'text-slate-100'}`}>
          How MSPE Works
        </h1>
        <p className={`text-xs mt-1 leading-relaxed ${theme === 'light' ? 'text-slate-550' : 'text-slate-400'}`}>
          A comprehensive overview of the Market Surface Projection Engine models, technical architecture, and validation framework.
        </p>
      </div>

      {/* 1. Simple User-Facing Idea Card */}
      <div className={`p-6 rounded-xl border leading-relaxed transition-all duration-300 ${
        theme === 'light' 
          ? 'bg-indigo-50/50 border-indigo-200/80 text-indigo-950' 
          : 'bg-indigo-500/5 border-indigo-500/10 text-indigo-300'
      }`}>
        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-500 block mb-1">
          Core Projection Philosophy
        </span>
        <h2 className={`text-lg font-bold tracking-tight mb-2 ${theme === 'light' ? 'text-indigo-900' : 'text-indigo-200'}`}>
          Estimating range of outcomes, not one exact price.
        </h2>
        <p className="text-sm font-medium">
          Instead of predicting a single deterministic price, MSPE simulates thousands of possible future pathways. 
          By looking at where these paths end up, the engine provides statistical boundaries of what can happen, 
          allowing investors to frame upside potential against downside tail risks.
        </p>
      </div>

      {/* Grid: Left Column (Methodology Steps) | Right Column (Tech & Roadmap) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* Left Column: User-Facing Methodology Steps (col-span-7) */}
        <div className="xl:col-span-7 space-y-6">
          <h2 className={`text-sm font-bold uppercase tracking-wider flex items-center gap-2 ${
            theme === 'light' ? 'text-slate-900 font-black' : 'text-slate-200'
          }`}>
            <Layers className="w-4 h-4 text-indigo-500" />
            Step-by-Step Methodology
          </h2>

          <div className="space-y-4">
            {/* Step 1 */}
            <div className={`p-5 rounded-xl border transition-all duration-300 ${
              theme === 'light' ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#151D30]/20 border-[#1F2942]/60'
            }`}>
              <h3 className={`text-sm font-bold flex items-center gap-2 ${theme === 'light' ? 'text-slate-900 font-bold' : 'text-slate-100'}`}>
                <Database className="w-4.5 h-4.5 text-indigo-500" />
                Step 1: Collect Market Data
              </h3>
              <p className={`text-xs mt-2.5 leading-relaxed ${theme === 'light' ? 'text-slate-650' : 'text-slate-400'}`}>
                The engine ingests daily price bars containing Open, High, Low, Close, and Volume (OHLCV) metrics from active exchanges. 
                These raw prices are converted into percentage daily changes (log returns) to normalize price action across lookback intervals.
              </p>
            </div>

            {/* Step 2 */}
            <div className={`p-5 rounded-xl border transition-all duration-300 ${
              theme === 'light' ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#151D30]/20 border-[#1F2942]/60'
            }`}>
              <h3 className={`text-sm font-bold flex items-center gap-2 ${theme === 'light' ? 'text-slate-900 font-bold' : 'text-slate-100'}`}>
                <Activity className="w-4.5 h-4.5 text-indigo-500" />
                Step 2: Estimate Volatility
              </h3>
              <p className={`text-xs mt-2.5 leading-relaxed ${theme === 'light' ? 'text-slate-655' : 'text-slate-400'}`}>
                Volatility represents how widely price swings over time. MSPE calculates historical standard deviation (rolling 30-day volatility) 
                and Parkinson high-low volatility estimators to gauge the active noise levels in the market.
              </p>
            </div>

            {/* Step 3 */}
            <div className={`p-5 rounded-xl border transition-all duration-300 ${
              theme === 'light' ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#151D30]/20 border-[#1F2942]/60'
            }`}>
              <h3 className={`text-sm font-bold flex items-center gap-2 ${theme === 'light' ? 'text-slate-900 font-bold' : 'text-slate-100'}`}>
                <Cpu className="w-4.5 h-4.5 text-indigo-500" />
                Step 3: Simulate Future Paths
              </h3>
              <p className={`text-xs mt-2.5 leading-relaxed ${theme === 'light' ? 'text-slate-655' : 'text-slate-400'}`}>
                Using standard Euler-Maruyama discretization of Geometric Brownian Motion (GBM), the engine simulates 10,000 distinct price pathways. 
                At each step forward, random shocks are applied scaled by the volatility estimate.
              </p>
            </div>

            {/* Step 4 */}
            <div className={`p-5 rounded-xl border transition-all duration-300 ${
              theme === 'light' ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#151D30]/20 border-[#1F2942]/60'
            }`}>
              <h3 className={`text-sm font-bold flex items-center gap-2 ${theme === 'light' ? 'text-slate-900 font-bold' : 'text-slate-100'}`}>
                <GitBranch className="w-4.5 h-4.5 text-indigo-500" />
                Step 4: Summarize Scenarios
              </h3>
              <p className={`text-xs mt-2.5 leading-relaxed ${theme === 'light' ? 'text-slate-655' : 'text-slate-400'}`}>
                All 10,000 simulated final prices are sorted by value. The P50 (median) path represents the most likely **Base Case**. 
                The P10 (bottom 10%) represents the **Bear Case** (downside boundary), and P90 (top 10%) represents the **Bull Case** (upside boundary).
              </p>
            </div>

            {/* Step 5 */}
            <div className={`p-5 rounded-xl border transition-all duration-300 ${
              theme === 'light' ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#151D30]/20 border-[#1F2942]/60'
            }`}>
              <h3 className={`text-sm font-bold flex items-center gap-2 ${theme === 'light' ? 'text-slate-900 font-bold' : 'text-slate-100'}`}>
                <ShieldAlert className="w-4.5 h-4.5 text-indigo-500" />
                Step 5: Measure Downside Risk
              </h3>
              <p className={`text-xs mt-2.5 leading-relaxed ${theme === 'light' ? 'text-slate-655' : 'text-slate-400'}`}>
                We calculate **Value at Risk (VaR)** to estimate the maximum expected loss on a bad day with 95% confidence. 
                **Conditional VaR (CVaR)** estimates the average loss *if* the price breaches the VaR threshold (the average of the worst 5% of outcomes).
              </p>
            </div>

            {/* Step 6 */}
            <div className={`p-5 rounded-xl border transition-all duration-300 ${
              theme === 'light' ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#151D30]/20 border-[#1F2942]/60'
            }`}>
              <h3 className={`text-sm font-bold flex items-center gap-2 ${theme === 'light' ? 'text-slate-900 font-bold' : 'text-slate-100'}`}>
                <CheckCircle className="w-4.5 h-4.5 text-indigo-500" />
                Step 6: Validate Results
              </h3>
              <p className={`text-xs mt-2.5 leading-relaxed ${theme === 'light' ? 'text-slate-655' : 'text-slate-400'}`}>
                We perform rolling backtesting by training the engine only on past slices of history and checking if future actual prices 
                fell inside the predicted intervals. This outputs the audited **Range Coverage (Hit Rate)** and **Base Error** metrics.
              </p>
            </div>
          </div>

          {/* Model Limitations Card */}
          <div className={`p-5 rounded-xl border transition-all duration-300 ${
            theme === 'light' ? 'bg-amber-50/20 border-amber-200 shadow-sm' : 'bg-[#151D30]/20 border-[#1F2942]/60'
          }`}>
            <h3 className="text-xs uppercase font-bold tracking-wider mb-3.5 flex items-center gap-2 text-amber-600">
              <AlertTriangle className="w-4.5 h-4.5" /> Engine Limitations & Disclaimers
            </h3>
            <ul className={`list-disc pl-5 text-xs space-y-2 leading-relaxed ${theme === 'light' ? 'text-slate-650' : 'text-slate-400'}`}>
              <li><strong>Not financial advice</strong>: This portal is a mathematical research demonstration, not a brokerage or investment recommender.</li>
              <li><strong>Projections are uncertain</strong>: Markets are highly stochastic; simulations establish probability limits, not exact targets.</li>
              <li><strong>Regime changes</strong>: Models assume parameter stationarity and cannot forecast sudden black swan regulatory or macroeconomic shocks.</li>
              <li><strong>Demo Mode vs Live Mode</strong>: Cache/offline demo metrics scale parameters based on fixed seed parameters when connection pools are throttled.</li>
            </ul>
          </div>
        </div>

        {/* Right Column: Technical Details & Roadmap (col-span-5) */}
        <div className="xl:col-span-5 space-y-6">
          <h2 className={`text-sm font-bold uppercase tracking-wider flex items-center gap-2 ${
            theme === 'light' ? 'text-slate-900 font-black' : 'text-slate-200'
          }`}>
            <Terminal className="w-4 h-4 text-indigo-500" />
            Technical Architecture
          </h2>

          <div className={`p-5 rounded-xl border transition-all duration-300 ${
            theme === 'light' ? 'bg-white border-slate-200 shadow-sm text-slate-800' : 'bg-[#151D30]/20 border-[#1F2942]/60 text-slate-100'
          }`}>
            <div className="space-y-4">
              <div className="flex gap-3.5">
                <Server className="w-5 h-5 text-indigo-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold font-mono uppercase tracking-wider">FastAPI Backend</h4>
                  <p className={`text-[11px] leading-relaxed mt-1 ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>
                    RESTful API endpoints written in Python utilizing FastAPI, serving dashboard metrics, scenario paths, correlation matrices, and stress test shocks.
                  </p>
                </div>
              </div>

              <div className="flex gap-3.5">
                <Layers className="w-5 h-5 text-indigo-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold font-mono uppercase tracking-wider">Next.js Frontend</h4>
                  <p className={`text-[11px] leading-relaxed mt-1 ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>
                    Tailwind-styled dashboard built on Next.js App Router, rendering dynamic asset routes, light/dark SaaS themes, and interactive Plotly layouts.
                  </p>
                </div>
              </div>

              <div className="flex gap-3.5">
                <Cpu className="w-5 h-5 text-indigo-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold font-mono uppercase tracking-wider">Python Quant Engine</h4>
                  <p className={`text-[11px] leading-relaxed mt-1 ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>
                    Runs drift calibration, standard volatility estimation, and Euler-Maruyama Monte Carlo simulations inside a NumPy-driven pipeline.
                  </p>
                </div>
              </div>

              <div className="flex gap-3.5">
                <FileSpreadsheet className="w-5 h-5 text-indigo-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold font-mono uppercase tracking-wider">Validation framework</h4>
                  <p className={`text-[11px] leading-relaxed mt-1 ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>
                    Generates CSV summaries and markdown validation logs in the backend to audit model projection coverage and Value at Risk (VaR) breach ratios.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Future Roadmap Section */}
          <h2 className={`text-sm font-bold uppercase tracking-wider flex items-center gap-2 pt-2 ${
            theme === 'light' ? 'text-slate-900 font-black' : 'text-slate-200'
          }`}>
            <Rocket className="w-4 h-4 text-indigo-500" />
            Future Product Roadmap
          </h2>

          <div className={`p-5 rounded-xl border transition-all duration-300 ${
            theme === 'light' ? 'bg-indigo-50/20 border-indigo-200/50 shadow-sm text-slate-800' : 'bg-indigo-950/10 border-indigo-900/30 text-slate-100'
          }`}>
            <p className={`text-[11px] leading-relaxed mb-4 ${theme === 'light' ? 'text-slate-655 font-medium' : 'text-slate-400'}`}>
              The following features represent future quantitative and structural integrations designed to expand MSPE functionality beyond simple historical projections.
            </p>

            <ul className="space-y-3 font-mono text-[11px]">
              <li className="flex items-start gap-2.5">
                <span className="text-indigo-500 font-bold">&raquo;</span>
                <div>
                  <strong className={theme === 'light' ? 'text-slate-900 font-bold' : 'text-slate-200'}>Real-Time Streaming</strong>
                  <span className={`block text-[10px] mt-0.5 font-sans leading-relaxed ${theme === 'light' ? 'text-slate-600' : 'text-slate-450'}`}>
                    WebSocket pipelines push trade updates to clients from live cryptocurrency and equities exchanges.
                  </span>
                </div>
              </li>
              
              <li className="flex items-start gap-2.5">
                <span className="text-indigo-500 font-bold">&raquo;</span>
                <div>
                  <strong className={theme === 'light' ? 'text-slate-900 font-bold' : 'text-slate-200'}>Asynchronous Task Queues</strong>
                  <span className={`block text-[10px] mt-0.5 font-sans leading-relaxed ${theme === 'light' ? 'text-slate-600' : 'text-slate-455'}`}>
                    Worker tasks managed via Redis and Celery to run heavy simulations and models without blocking server threads.
                  </span>
                </div>
              </li>

              <li className="flex items-start gap-2.5">
                <span className="text-indigo-500 font-bold">&raquo;</span>
                <div>
                  <strong className={theme === 'light' ? 'text-slate-900 font-bold' : 'text-slate-200'}>Implied Volatility Smiles</strong>
                  <span className={`block text-[10px] mt-0.5 font-sans leading-relaxed ${theme === 'light' ? 'text-slate-600' : 'text-slate-455'}`}>
                    Option chain implied distributions to calibrate volatility smiles and surface matrices instead of standard historic deviations.
                  </span>
                </div>
              </li>

              <li className="flex items-start gap-2.5">
                <span className="text-indigo-500 font-bold">&raquo;</span>
                <div>
                  <strong className={theme === 'light' ? 'text-slate-900 font-bold' : 'text-slate-200'}>Deep Learning Forecasts</strong>
                  <span className={`block text-[10px] mt-0.5 font-sans leading-relaxed ${theme === 'light' ? 'text-slate-600' : 'text-slate-455'}`}>
                    LSTM or Transformer neural expectation networks to forecast nonlinear return expectations.
                  </span>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
