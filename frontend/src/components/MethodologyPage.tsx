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
  Rocket,
  HelpCircle,
  Code
} from 'lucide-react';

interface MethodologyPageProps {
  theme?: 'light' | 'dark';
}

export default function MethodologyPage({ theme = 'light' }: MethodologyPageProps) {
  return (
    <div className={`space-y-8 min-h-screen p-6 rounded-2xl border transition-all duration-300 ${
      theme === 'light' 
        ? 'bg-slate-50 text-slate-800 border-slate-200' 
        : 'bg-[#151D30]/20 text-slate-100 border-[#1F2942]/60'
    }`}>
      {/* Page Header */}
      <div className={`border-b pb-5 ${theme === 'light' ? 'border-slate-200' : 'border-[#1F2942]/60'}`}>
        <h1 className={`text-3xl font-black tracking-tight ${theme === 'light' ? 'text-slate-900' : 'text-slate-100'}`}>
          How MSPE Works
        </h1>
        <p className={`text-sm mt-2 font-medium leading-relaxed max-w-3xl ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>
          A simple guide to Monte Carlo simulations, price projections, risk estimation, and mathematical validation.
        </p>
      </div>

      {/* 1. Simple Idea Banner */}
      <div className={`p-6 rounded-xl border leading-relaxed shadow-sm transition-all duration-300 ${
        theme === 'light' 
          ? 'bg-indigo-50 border-indigo-200 text-indigo-950' 
          : 'bg-indigo-500/5 border-indigo-500/10 text-indigo-300'
      }`}>
        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-500 block mb-1">
          Core Philosophy
        </span>
        <h2 className={`text-lg font-bold tracking-tight mb-2 ${theme === 'light' ? 'text-indigo-900' : 'text-indigo-200'}`}>
          “MSPE does not predict one exact future price. It estimates a range of possible outcomes.”
        </h2>
        <p className="text-xs font-semibold leading-relaxed text-slate-600 dark:text-slate-400">
          Financial markets are full of uncertainty. Instead of pretending to know the exact future price of an asset, 
          MSPE simulates 10,000 distinct price pathways. By looking at where these paths end up, the engine provides 
          a distribution of what could happen next, helping you quantify both potential rewards and tail-risk losses.
        </p>
      </div>

      {/* Grid Layout: Left (Steps) | Right (Tech & Roadmap) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* Left Column: Projections Pipeline (col-span-7) */}
        <div className="xl:col-span-7 space-y-6">
          <h2 className={`text-sm font-bold uppercase tracking-wider flex items-center gap-2 ${
            theme === 'light' ? 'text-slate-900 font-black' : 'text-slate-200'
          }`}>
            <Layers className="w-4 h-4 text-indigo-500" />
            The Step-by-Step Engine Pipeline
          </h2>

          <div className="space-y-4">
            {/* Step 1 — Collect market prices */}
            <div className={`p-5 rounded-xl border transition-all duration-300 ${
              theme === 'light' ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#151D30]/20 border-[#1F2942]/60'
            }`}>
              <h3 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${theme === 'light' ? 'text-slate-950' : 'text-slate-105'}`}>
                <Database className="w-4 h-4 text-indigo-500" />
                Step 1: Collect Market Prices
              </h3>
              <p className={`text-[11px] mt-2.5 leading-relaxed ${theme === 'light' ? 'text-slate-600 font-medium' : 'text-slate-400'}`}>
                The engine ingests daily price bars containing **OHLCV** parameters: **O**pen (starting price), **H**igh (peak price), 
                **L**ow (bottom price), **C**lose (ending price), and **V**olume (total activity). It registers the latest available close 
                price as the starting spot parameter for all future projections.
              </p>
            </div>

            {/* Step 2 — Estimate recent market behavior */}
            <div className={`p-5 rounded-xl border transition-all duration-300 ${
              theme === 'light' ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#151D30]/20 border-[#1F2942]/60'
            }`}>
              <h3 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${theme === 'light' ? 'text-slate-955' : 'text-slate-105'}`}>
                <Activity className="w-4 h-4 text-indigo-500" />
                Step 2: Estimate Recent Market Behavior
              </h3>
              <div className={`text-[11px] mt-2.5 leading-relaxed space-y-2 ${theme === 'light' ? 'text-slate-600 font-medium' : 'text-slate-400'}`}>
                <p>To calibrate the simulation, the system extracts four behavioral elements from recent history:</p>
                <ul className="list-disc pl-5 space-y-1.5 font-sans">
                  <li><strong>Returns:</strong> The daily percentage changes in price, indicating whether the asset has a positive or negative drift trend.</li>
                  <li><strong>Volatility:</strong> How widely the price swings. High volatility means wide potential outcomes; low volatility means tighter, stable trends.</li>
                  <li><strong>Trend:</strong> The overall direction (upward, downward, or flat) of recent market movement.</li>
                  <li><strong>Drawdown:</strong> The worst historical drop from peak to trough, mapping out typical correction scales.</li>
                </ul>
              </div>
            </div>

            {/* Step 3 — Simulate possible future paths */}
            <div className={`p-5 rounded-xl border transition-all duration-300 ${
              theme === 'light' ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#151D30]/20 border-[#1F2942]/60'
            }`}>
              <h3 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${theme === 'light' ? 'text-slate-950' : 'text-slate-105'}`}>
                <Cpu className="w-4 h-4 text-indigo-500" />
                Step 3: Simulate Possible Future Paths (Monte Carlo)
              </h3>
              <p className={`text-[11px] mt-2.5 leading-relaxed ${theme === 'light' ? 'text-slate-600 font-medium' : 'text-slate-400'}`}>
                MSPE runs a **Monte Carlo simulation**. In simple terms, this is like rolling dice thousands of times. The system starts at 
                the current close price, applies the calculated trend drift, and adds random price shocks scaled by the asset's active volatility. 
                This process is repeated day-by-day to build 10,000 distinct possible paths into the future.
              </p>
            </div>

            {/* Step 4 — Summarize scenarios */}
            <div className={`p-5 rounded-xl border transition-all duration-300 ${
              theme === 'light' ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#151D30]/20 border-[#1F2942]/60'
            }`}>
              <h3 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${theme === 'light' ? 'text-slate-950' : 'text-slate-105'}`}>
                <GitBranch className="w-4 h-4 text-indigo-500" />
                Step 4: Summarize Scenarios
              </h3>
              <div className={`text-[11px] mt-2.5 leading-relaxed space-y-2 ${theme === 'light' ? 'text-slate-600 font-medium' : 'text-slate-400'}`}>
                <p>After generating 10,000 final prices, MSPE sorts them and groups them into three scenario cases:</p>
                <ul className="list-disc pl-5 space-y-1.5">
                  <li><strong>Bear Case (P10):</strong> The conservative lower boundary. Historically, only 10% of simulations ended below this price.</li>
                  <li><strong>Base Case (P50):</strong> The median expected trajectory. It represents the 50th percentile trend and is the most likely path.</li>
                  <li><strong>Bull Case (P90):</strong> The optimistic upper boundary. Only 10% of simulations ended above this price level.</li>
                </ul>
              </div>
            </div>

            {/* Step 5 — Measure downside risk */}
            <div className={`p-5 rounded-xl border transition-all duration-300 ${
              theme === 'light' ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#151D30]/20 border-[#1F2942]/60'
            }`}>
              <h3 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${theme === 'light' ? 'text-slate-950' : 'text-slate-105'}`}>
                <ShieldAlert className="w-4 h-4 text-indigo-500" />
                Step 5: Measure Downside Risk
              </h3>
              <div className={`text-[11px] mt-2.5 leading-relaxed space-y-2 ${theme === 'light' ? 'text-slate-600 font-medium' : 'text-slate-400'}`}>
                <p>To prepare for worst-case outcomes, the engine evaluates downside risk across five metrics:</p>
                <ul className="list-disc pl-5 space-y-1.5">
                  <li><strong>Probability of Loss:</strong> The percentage of simulated paths that end up lower than today's starting price.</li>
                  <li><strong>Value at Risk (VaR 95%):</strong> The maximum loss expected under normal conditions at a 95% confidence level.</li>
                  <li><strong>Conditional VaR (CVaR 95%):</strong> The average loss in the worst-case 5% of outcomes, highlighting crash severity.</li>
                  <li><strong>Projected Volatility:</strong> The expected volatility over the forecast horizon based on simulation outcomes.</li>
                  <li><strong>Simulated Drawdown:</strong> The worst peak-to-trough drop observed across the simulated paths.</li>
                </ul>
              </div>
            </div>

            {/* Step 6 — Validate projections */}
            <div className={`p-5 rounded-xl border transition-all duration-300 ${
              theme === 'light' ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#151D30]/20 border-[#1F2942]/60'
            }`}>
              <h3 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${theme === 'light' ? 'text-slate-950' : 'text-slate-105'}`}>
                <CheckCircle className="w-4 h-4 text-indigo-500" />
                Step 6: Validate Projections
              </h3>
              <div className={`text-[11px] mt-2.5 leading-relaxed space-y-2 ${theme === 'light' ? 'text-slate-600 font-medium' : 'text-slate-400'}`}>
                <p>To verify the accuracy of MSPE projections, the system continuously audits historical projections using four criteria:</p>
                <ul className="list-disc pl-5 space-y-1.5">
                  <li><strong>Range Hit Rate:</strong> The percentage of time historical actual prices stayed inside the Bear-to-Bull boundaries.</li>
                  <li><strong>Base-Case Error (MAPE):</strong> The average percentage error between the median Base Case and actual price paths.</li>
                  <li><strong>Baseline Comparison:</strong> Evaluating MSPE performance against naive benchmarks (e.g. assuming tomorrow's price is identical to today's).</li>
                  <li><strong>VaR Breach Rate:</strong> The percentage of days actual losses exceeded the VaR limit (should theoretically be exactly 5%).</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Tech Details, Roadmap, Disclaimers (col-span-5) */}
        <div className="xl:col-span-5 space-y-6">
          
          {/* What MSPE is Not */}
          <h2 className={`text-sm font-bold uppercase tracking-wider flex items-center gap-2 ${
            theme === 'light' ? 'text-slate-900 font-black' : 'text-slate-200'
          }`}>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            What MSPE Is Not
          </h2>

          <div className={`p-5 rounded-xl border transition-all duration-300 bg-amber-500/5 border-amber-500/15 text-slate-800 dark:text-slate-200`}>
            <ul className="space-y-3 font-sans text-xs leading-relaxed">
              <li className="flex items-start gap-2.5">
                <span className="text-amber-500 font-bold">&raquo;</span>
                <div>
                  <strong>Not Financial Advice:</strong> This engine does not make buy, sell, or hold recommendations. It is a mathematical research tool.
                </div>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-amber-500 font-bold">&raquo;</span>
                <div>
                  <strong>Not a Guaranteed Prediction Engine:</strong> Projections represent probability scenarios. They do not claim to forecast the exact future.
                </div>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-amber-500 font-bold">&raquo;</span>
                <div>
                  <strong>Not an Automatic Trading Bot:</strong> MSPE cannot execute transactions on your behalf or connect to broker APIs.
                </div>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-amber-500 font-bold">&raquo;</span>
                <div>
                  <strong>Not a Hedge Fund Execution System:</strong> There are no high-frequency order placement pipelines or institutional trade routing setups.
                </div>
              </li>
            </ul>
          </div>

          {/* Technical Stack */}
          <h2 className={`text-sm font-bold uppercase tracking-wider flex items-center gap-2 pt-2 ${
            theme === 'light' ? 'text-slate-900 font-black' : 'text-slate-200'
          }`}>
            <Terminal className="w-4 h-4 text-indigo-500" />
            Technical Stack
          </h2>

          <div className={`p-5 rounded-xl border transition-all duration-300 ${
            theme === 'light' ? 'bg-white border-slate-200 shadow-sm text-slate-800' : 'glass-panel border-[#1F2942] bg-[#151D30]/30 text-slate-100'
          }`}>
            <div className="space-y-4 font-sans text-xs leading-relaxed">
              <div className="flex gap-3">
                <Server className="w-4 h-4 text-indigo-500 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-bold font-mono text-[11px] uppercase tracking-wide">FastAPI Backend (Python)</h4>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Serves data API endpoints for asset forecasts, validation ledgers, and stress tests.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <Cpu className="w-4 h-4 text-indigo-500 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-bold font-mono text-[11px] uppercase tracking-wide">Python Quant Library</h4>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Runs drift calibration, standard volatility estimation, and Euler-Maruyama Monte Carlo simulations using <strong>pandas</strong> and <strong>NumPy</strong>. Calculates ARIMA, GARCH, and EWMA statistics.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <Layers className="w-4 h-4 text-indigo-500 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-bold font-mono text-[11px] uppercase tracking-wide">Next.js & TypeScript</h4>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                    A type-safe dashboard layout using Next.js App Router structure and static asset parameters.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <Code className="w-4 h-4 text-indigo-500 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-bold font-mono text-[11px] uppercase tracking-wide">Plotly / Tailwind CSS</h4>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Renders interactive 2D pathway charts, probability density curves, and 3D projection surfaces. Responsive styling is handled via Tailwind CSS utility classes.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Future Roadmap */}
          <h2 className={`text-sm font-bold uppercase tracking-wider flex items-center gap-2 pt-2 ${
            theme === 'light' ? 'text-slate-900 font-black' : 'text-slate-200'
          }`}>
            <Rocket className="w-4 h-4 text-indigo-500" />
            Future Product Roadmap
          </h2>

          <div className={`p-5 rounded-xl border transition-all duration-300 bg-indigo-500/5 border-indigo-500/10 text-slate-800 dark:text-slate-200`}>
            <ul className="space-y-3 font-mono text-[10px] leading-relaxed">
              <li className="flex items-start gap-2.5">
                <span className="text-indigo-500 font-bold">&raquo;</span>
                <div>
                  <strong className={theme === 'light' ? 'text-slate-900' : 'text-slate-200'}>Real-Time Streaming:</strong>
                  <span className="block font-sans text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Adding **WebSockets** pipelines to push ticker updates to dashboard cards as they occur on global exchanges.
                  </span>
                </div>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-indigo-500 font-bold">&raquo;</span>
                <div>
                  <strong className={theme === 'light' ? 'text-slate-900' : 'text-slate-200'}>Asynchronous Task Queues:</strong>
                  <span className="block font-sans text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Integrating **Redis** and **Celery** workers to process simulations for thousands of assets in the background without blocking client requests.
                  </span>
                </div>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-indigo-500 font-bold">&raquo;</span>
                <div>
                  <strong className={theme === 'light' ? 'text-slate-900' : 'text-slate-200'}>Volatility Smiles:</strong>
                  <span className="block font-sans text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Calibrating implied option parameters to model volatility smiles instead of standard historical metrics.
                  </span>
                </div>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-indigo-500 font-bold">&raquo;</span>
                <div>
                  <strong className={theme === 'light' ? 'text-slate-900' : 'text-slate-200'}>Deep Learning Models:</strong>
                  <span className="block font-sans text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Training LSTM, Transformer, or neural networks to refine non-linear trend expectations.
                  </span>
                </div>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-indigo-500 font-bold">&raquo;</span>
                <div>
                  <strong className={theme === 'light' ? 'text-slate-900' : 'text-slate-200'}>Portfolio Optimizer:</strong>
                  <span className="block font-sans text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Adding Mean-Variance or Black-Litterman optimization bounds to dynamically adjust simulated asset allocations.
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
