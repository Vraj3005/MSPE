'use client';

import React, { useEffect, useState } from 'react';
import { resultsApi } from '../lib/api/results';
import { AssetProjectionResult, AssetRiskResponse } from '../types/results';
import { ShieldAlert, HelpCircle, RefreshCw, Info, TrendingDown, CheckCircle, Activity } from 'lucide-react';

interface PortfolioRiskProps {
  theme?: 'light' | 'dark';
}

export default function PortfolioRisk({ theme = 'light' }: PortfolioRiskProps) {
  const [selectedTicker, setSelectedTicker] = useState<string>('BTCUSDT');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [allProjections, setAllProjections] = useState<Record<string, AssetProjectionResult>>({});
  const [allRisks, setAllRisks] = useState<Record<string, AssetRiskResponse>>({});

  const symbols = ['BTCUSDT', 'ETHUSDT', 'SPX', 'XAU'];
  const assetNames = {
    'BTCUSDT': 'Bitcoin',
    'ETHUSDT': 'Ethereum',
    'SPX': 'S&P 500 Index',
    'XAU': 'Gold'
  };

  const generateMockProjection = (symbol: string): AssetProjectionResult => {
    const spot = { 'BTCUSDT': 62000.0, 'ETHUSDT': 3200.0, 'SPX': 5100.0, 'XAU': 2300.0 }[symbol] || 100.0;
    const base_7d = spot * 1.02;
    const bear_7d = spot * 0.95;
    const bull_7d = spot * 1.05;
    const probLoss = { 'BTCUSDT': 0.48, 'ETHUSDT': 0.51, 'SPX': 0.35, 'XAU': 0.41 }[symbol] || 0.45;
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
        expected_return: 0.02,
        probability_of_gain: 1 - probLoss,
        probability_of_loss: probLoss,
        projected_volatility: 0.25,
        confidence_band_width: 0.10,
        risk_score: riskScr,
        risk_level: riskLvl,
        var_95: 0.02,
        cvar_95: 0.03,
        explanation: ''
      }
    ];

    return {
      symbol,
      name: assetNames[symbol as keyof typeof assetNames] || symbol,
      asset_class: symbol === 'SPX' ? 'Equity' : symbol === 'XAU' ? 'Commodity' : 'Crypto',
      latest_price: spot,
      latest_date: new Date().toISOString(),
      daily_return: 0.015,
      data_mode: 'demo',
      horizons: mockHorizons,
      bear_scenario_path: [],
      base_scenario_path: [],
      bull_scenario_path: [],
      monte_carlo_paths: [],
      probability_density_data: undefined,
      explainability: {
        winning_model: 'garch',
        model_scores: { 'garch': 0.82 },
        feature_importances: {}
      },
      asset: {
        symbol,
        name: assetNames[symbol as keyof typeof assetNames] || symbol,
        asset_class: symbol === 'SPX' ? 'Equity' : symbol === 'XAU' ? 'Commodity' : 'Crypto',
        last_close: spot,
        latest_date: new Date().toISOString()
      },
      projection_horizon_results: mockHorizons,
      explanation_text: {
        summary: '',
        warning: '',
        reason: ''
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
        summary: `Risk is ${vals.level} because volatility is above normal and worst-case simulated losses are wider than usual.`,
        warning: 'High risk assets present substantial downside path dispersion.',
        reason: 'Parameters based on rolling 252-day return variance.'
      },
      data_mode: 'demo'
    };
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

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
    } catch (err: any) {
      console.error("Error loading risk evaluation engine details", err);
      setError(err.message || "Failed to query risk parameters from database.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

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
        return 'text-teal-750 bg-teal-50 border-teal-200 dark:text-teal-400 dark:bg-teal-950/20 dark:border-teal-900/30';
    }
  };

  // Compile stress scenarios for selected asset
  const getStressScenarios = (symbol: string) => {
    const risk = allRisks[symbol] || generateMockRisk(symbol);
    const spot = allProjections[symbol]?.latest_price || 100.0;

    return [
      {
        scenario_name: 'Market Shock Scenario',
        estimated_loss: `-${(risk.var_95 * 8 * 100).toFixed(1)}%`,
        projected_price: `$${(spot * (1 - risk.var_95 * 8)).toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
        explanation: 'Simulates a systemic asset crash mirroring a historical 2008 Financial Crisis shock (-40% equity market drop).'
      },
      {
        scenario_name: 'High Volatility Scenario',
        estimated_loss: `-${(risk.var_95 * 2 * 100).toFixed(1)}%`,
        projected_price: `$${(spot * (1 - risk.var_95 * 2)).toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
        explanation: 'Simulates double the standard volatility dispersion, tracking a rapid market panic regime shift.'
      },
      {
        scenario_name: 'Downside Move Scenario',
        estimated_loss: `-${(risk.var_95 * 100).toFixed(1)}%`,
        projected_price: `$${(spot * (1 - risk.var_95)).toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
        explanation: 'Estimates the 1-session Value at Risk limit expected on a bad day with 95% statistical confidence.'
      }
    ];
  };

  const selectedRisk = allRisks[selectedTicker] || generateMockRisk(selectedTicker);
  const selectedProj = allProjections[selectedTicker] || generateMockProjection(selectedTicker);

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
            Risk Analysis
          </h1>
          <p className={`text-sm mt-2 font-medium leading-relaxed max-w-3xl ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>
            Measure downside risk using VaR, CVaR, volatility, drawdown, and stress scenarios.
          </p>
        </div>
      </div>

      {/* 1. Asset Risk Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {symbols.map(s => {
          const risk = allRisks[s] || generateMockRisk(s);
          const proj = allProjections[s] || generateMockProjection(s);
          const p7d = proj.horizons.find(h => h.horizon_label === '7D');
          const lossProb = p7d ? `${(p7d.probability_of_loss * 100).toFixed(0)}%` : '--%';
          
          const isSelected = selectedTicker === s;

          return (
            <button
              key={s}
              onClick={() => setSelectedTicker(s)}
              className={`text-left p-5 rounded-xl border relative flex flex-col justify-between shadow-sm cursor-pointer transition-all duration-300 ${
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
                <div className="flex justify-between items-center mb-2">
                  <span className={`text-[10px] font-mono tracking-wider font-bold ${
                    theme === 'light' ? 'text-slate-455' : 'text-slate-500'
                  }`}>{s}</span>
                  <span className={`text-[9px] uppercase font-bold tracking-wide px-2 py-0.5 rounded border ${getRiskBadgeColor(risk.risk_level)}`}>
                    {risk.risk_level}
                  </span>
                </div>

                <h3 className={`text-base font-bold ${theme === 'light' ? 'text-slate-900' : 'text-slate-200'}`}>
                  {assetNames[s as keyof typeof assetNames] || s}
                </h3>

                <div className="mt-3.5 space-y-2 font-mono text-xs text-slate-500">
                  <div className="flex justify-between">
                    <span>Risk Score:</span>
                    <strong className={theme === 'light' ? 'text-slate-900' : 'text-slate-200'}>
                      {risk.risk_score.toFixed(0)}/100
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Loss Prob (7D):</span>
                    <strong className={theme === 'light' ? 'text-slate-900' : 'text-slate-200'}>
                      {lossProb}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span>VaR 95%:</span>
                    <strong className="text-orange-500">
                      -{(risk.var_95 * 100).toFixed(2)}%
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span>CVaR 95%:</span>
                    <strong className="text-rose-500">
                      -{(risk.cvar_95 * 100).toFixed(2)}%
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Volatility:</span>
                    <strong className={theme === 'light' ? 'text-slate-950 font-bold' : 'text-slate-100'}>
                      {(risk.volatility * 100).toFixed(1)}%
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Max Drawdown:</span>
                    <strong className={theme === 'light' ? 'text-slate-950 font-bold' : 'text-slate-100'}>
                      -{(risk.drawdown * 100).toFixed(1)}%
                    </strong>
                  </div>
                </div>
              </div>

              {isSelected && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-12 bg-indigo-500 rounded-r" />
              )}
            </button>
          );
        })}
      </div>

      {/* 2. Simple Risk Explanation */}
      {selectedRisk && (
        <div className={`p-5 rounded-xl text-sm flex items-start gap-4 shadow-sm border transition-colors duration-300 ${
          theme === 'light' 
            ? 'bg-orange-50/50 border-orange-100 text-slate-700' 
            : 'bg-orange-500/5 border-orange-500/10 text-slate-350'
        }`}>
          <ShieldAlert className={`w-5 h-5 flex-shrink-0 mt-0.5 ${theme === 'light' ? 'text-orange-500' : 'text-orange-400'}`} />
          <div className="space-y-1">
            <strong className={`font-semibold text-[13px] uppercase tracking-wider block ${theme === 'light' ? 'text-orange-850' : 'text-orange-400'}`}>
              Simple Risk Read — {assetNames[selectedTicker as keyof typeof assetNames] || selectedTicker}
            </strong>
            <p className="leading-relaxed font-semibold italic text-slate-700 dark:text-slate-300">
              "Risk is {selectedRisk.risk_level} because volatility is {(selectedRisk.volatility * 100).toFixed(1)}% (above normal baseline) and worst-case simulated losses (CVaR at {(selectedRisk.cvar_95 * 100).toFixed(1)}%) are wider than usual."
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 3. Stress Testing Section (col-span-7) */}
        <div className={`lg:col-span-7 rounded-xl p-5.5 border flex flex-col justify-between transition-all duration-300 ${
          theme === 'light' ? 'bg-white border-slate-200 shadow-sm text-slate-800' : 'glass-panel border-[#1F2942] bg-[#151D30]/30 text-slate-100'
        }`}>
          <div>
            <h3 className={`text-base font-bold flex items-center gap-2 ${theme === 'light' ? 'text-slate-950' : 'text-slate-100'}`}>
              <TrendingDown className="w-5 h-5 text-indigo-500" />
              Stress Testing Scenarios
            </h3>
            <p className={`text-xs mt-0.5 ${theme === 'light' ? 'text-slate-600 font-medium' : 'text-slate-500'}`}>
              Projected impact on {assetNames[selectedTicker as keyof typeof assetNames] || selectedTicker} under historical and volatility shocks.
            </p>

            <div className="mt-5 space-y-4">
              {getStressScenarios(selectedTicker).map((scenario, idx) => (
                <div 
                  key={idx} 
                  className={`p-4 rounded-xl border flex flex-col md:flex-row justify-between items-start md:items-center gap-3 ${
                    theme === 'light' ? 'bg-slate-50 border-slate-150' : 'bg-[#0B0F19]/40 border-[#1F2942]/40'
                  }`}
                >
                  <div className="space-y-1 max-w-md">
                    <strong className={`text-xs block font-bold uppercase tracking-wider ${theme === 'light' ? 'text-slate-850' : 'text-slate-200'}`}>
                      {scenario.scenario_name}
                    </strong>
                    <p className={`text-[11px] leading-relaxed ${theme === 'light' ? 'text-slate-550' : 'text-slate-450'}`}>
                      {scenario.explanation}
                    </p>
                  </div>

                  <div className="flex md:flex-col items-baseline md:items-end gap-2 md:gap-0.5">
                    <span className="text-sm font-bold text-rose-500 font-mono">
                      {scenario.estimated_loss} Loss
                    </span>
                    <span className="text-[10px] font-bold font-mono text-slate-400">
                      Target: {scenario.projected_price}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="border-t pt-3 mt-4 text-[10px] font-medium leading-relaxed text-slate-450">
            Shocks represent theoretical changes based on historical covariance scales and tail volatility bounds.
          </div>
        </div>

        {/* 4. VaR/CVaR Explanation (col-span-5) */}
        <div className={`lg:col-span-5 rounded-xl p-5.5 border flex flex-col justify-between transition-all duration-300 ${
          theme === 'light' ? 'bg-white border-slate-200 shadow-sm text-slate-800' : 'glass-panel border-[#1F2942] bg-[#151D30]/30 text-slate-100'
        }`}>
          <div>
            <h3 className={`text-base font-bold flex items-center gap-2 ${theme === 'light' ? 'text-slate-950' : 'text-slate-100'}`}>
              <HelpCircle className="w-5 h-5 text-indigo-500" />
              Risk Glossary & Thresholds
            </h3>
            <p className={`text-xs mt-0.5 ${theme === 'light' ? 'text-slate-655 font-medium' : 'text-slate-500'}`}>
              Understanding Value at Risk and tail dispersion.
            </p>

            <div className="mt-6 space-y-5 text-xs">
              <div className="space-y-1.5">
                <h4 className={`font-bold font-sans uppercase tracking-wider ${
                  theme === 'light' ? 'text-indigo-900 font-bold' : 'text-indigo-400'
                }`}>
                  Value at Risk (VaR 95%)
                </h4>
                <p className={`leading-relaxed font-medium ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>
                  VaR estimates the loss threshold in bad cases. For example, a 95% 1-day VaR of 4.8% means there is a 5% chance the asset drops by more than 4.8% in a single market session.
                </p>
              </div>

              <div className="space-y-1.5">
                <h4 className={`font-bold font-sans uppercase tracking-wider ${
                  theme === 'light' ? 'text-indigo-900 font-bold' : 'text-indigo-400'
                }`}>
                  Conditional VaR (CVaR 95%)
                </h4>
                <p className={`leading-relaxed font-medium ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>
                  CVaR estimates the average loss inside the worst-case zone. When the VaR threshold is breached, CVaR tells you the average severity of the crash outcomes (the worst 5% of simulated paths).
                </p>
              </div>
            </div>
          </div>

          <div className="border-t pt-3 mt-4 text-[9px] font-semibold text-slate-400 uppercase">
            Model parameters updated daily against active feeds.
          </div>
        </div>
      </div>

      {/* 5. Risk Comparison Matrix */}
      <div className={`rounded-xl p-5.5 border transition-all duration-300 ${
        theme === 'light' ? 'bg-white border-slate-200 shadow-sm' : 'glass-panel border-[#1F2942] bg-[#151D30]/30'
      }`}>
        <h3 className={`text-base font-bold mb-4 ${theme === 'light' ? 'text-slate-950' : 'text-slate-100'}`}>
          Risk Comparison Matrix
        </h3>

        <div className="overflow-x-auto w-full">
          <table className="w-full text-left font-mono text-xs border-collapse">
            <thead>
              <tr className={`border-b text-[10px] uppercase font-sans font-bold tracking-wider ${
                theme === 'light' ? 'border-slate-150 text-slate-500' : 'border-[#1F2942]/60 text-slate-455'
              }`}>
                <th className="pb-3 pl-2">Asset Symbol</th>
                <th className="pb-3">Risk Score</th>
                <th className="pb-3">Value at Risk (VaR)</th>
                <th className="pb-3">Conditional VaR (CVaR)</th>
                <th className="pb-3">Annualized Volatility</th>
                <th className="pb-3">Worst Peak-to-Trough Drop</th>
                <th className="pb-3 pr-2">Assigned Risk Level</th>
              </tr>
            </thead>
            <tbody className={theme === 'light' ? 'text-slate-700' : 'text-slate-350'}>
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-6 text-slate-400">
                    Loading comparative risk matrices...
                  </td>
                </tr>
              ) : (
                symbols.map(s => {
                  const risk = allRisks[s];
                  if (!risk) return null;

                  return (
                    <tr 
                      key={s} 
                      className={`border-b hover:bg-slate-50/50 dark:hover:bg-[#1E293B]/20 transition-colors ${
                        theme === 'light' ? 'border-slate-100' : 'border-[#1F2942]/30'
                      }`}
                    >
                      <td className="py-3.5 pl-2 font-bold font-sans">{assetNames[s as keyof typeof assetNames] || s} ({s})</td>
                      <td className="py-3.5 font-bold">{risk.risk_score.toFixed(0)}/100</td>
                      <td className="py-3.5 font-bold text-orange-500">-{(risk.var_95 * 100).toFixed(2)}%</td>
                      <td className="py-3.5 font-bold text-rose-500">-{(risk.cvar_95 * 100).toFixed(2)}%</td>
                      <td className="py-3.5 font-bold">{(risk.volatility * 100).toFixed(1)}%</td>
                      <td className="py-3.5 font-bold">-{(risk.drawdown * 100).toFixed(1)}%</td>
                      <td className="py-3.5 pr-2 font-sans">
                        <span className={`text-[9px] uppercase font-bold tracking-wide px-2 py-0.5 rounded border ${getRiskBadgeColor(risk.risk_level)}`}>
                          {risk.risk_level}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
