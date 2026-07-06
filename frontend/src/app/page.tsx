'use client';

import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import MarketOverview from '../components/MarketOverview';
import AssetDashboard from '../components/AssetDashboard';
import PortfolioRisk from '../components/PortfolioRisk';
import BacktestResults from '../components/BacktestResults';
import { Calendar, Sun, Moon } from 'lucide-react';
import { copy } from '../content/copy';

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<string>('MARKET');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [currentTime, setCurrentTime] = useState<string>('');
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
    // Sync live system quantitative clock
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit', 
        hour12: false,
        timeZoneName: 'short' 
      }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const renderActiveView = () => {
    switch (activeTab) {
      case 'MARKET':
        return <MarketOverview theme={theme} />;
      case 'ASSET':
        return <AssetDashboard theme={theme} />;
      case 'BACKTEST':
        return <BacktestResults theme={theme} />;
      case 'RISK':
        return <PortfolioRisk theme={theme} />;
      default:
        return <MarketOverview theme={theme} />;
    }
  };

  return (
    <div className={`min-h-screen flex transition-colors duration-300 ${
      theme === 'light' ? 'bg-slate-100 text-slate-800' : 'bg-[#0B0F19] text-slate-100'
    }`}>
      {/* Persistant Navigation Sidebar */}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} theme={theme} />

      {/* Main Dashboard Screen Area */}
      <main className="flex-1 ml-64 min-h-screen p-8 flex flex-col gap-6 overflow-x-hidden">
        {/* Top Quantitative Header Panel */}
        <header className={`px-6 py-4 flex justify-between items-center rounded-xl border transition-all duration-300 ${
          theme === 'light' 
            ? 'bg-white border-slate-200 shadow-sm text-slate-800' 
            : 'glass-panel border-[#1F2942] bg-[#151D30]/30 text-slate-100'
        }`}>
          <div className="flex items-center gap-3">
            <span className={`w-2.5 h-2.5 rounded-full shadow-[0_0_10px_rgba(6,182,212,0.6)] ${
              theme === 'light' ? 'bg-cyan-500' : 'bg-cyan-400'
            }`} />
            <h2 className={`text-xs font-bold font-mono tracking-widest uppercase ${
              theme === 'light' ? 'text-slate-700 font-bold' : 'text-slate-400'
            }`}>
              {copy.portalHeader}
            </h2>
          </div>
          
          <div className="flex items-center gap-4 text-xs font-mono">
            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className={`p-2 rounded-lg border transition-all duration-300 flex items-center justify-center hover:scale-105 active:scale-95 ${
                theme === 'light'
                  ? 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                  : 'bg-[#0B0F19]/60 border-[#1F2942]/60 text-slate-300 hover:bg-[#151D30]/40'
              }`}
              title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
            >
              {theme === 'light' ? (
                <Moon className="w-4 h-4 text-indigo-600" />
              ) : (
                <Sun className="w-4 h-4 text-amber-400" />
              )}
            </button>

            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${
              theme === 'light'
                ? 'bg-slate-100 border-slate-200 text-slate-700 font-medium'
                : 'bg-[#0B0F19]/60 border-[#1F2942]/60 text-slate-400'
            }`}>
              <Calendar className={`w-3.5 h-3.5 ${theme === 'light' ? 'text-cyan-600' : 'text-cyan-400'}`} />
              <span>{mounted ? new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: '2-digit' }) : '---'}</span>
            </div>
            
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-bold ${
              theme === 'light'
                ? 'bg-slate-100 border-slate-200 text-slate-900'
                : 'bg-[#0B0F19]/60 border-[#1F2942]/60 text-slate-300'
            }`}>
              <span>{mounted ? (currentTime || 'SYNCHRONIZING...') : 'SYNCHRONIZING...'}</span>
            </div>
          </div>
        </header>

        {/* Dynamic Inner Subcomponent viewport */}
        <section className="flex-1">
          {renderActiveView()}
        </section>
      </main>
    </div>
  );
}
