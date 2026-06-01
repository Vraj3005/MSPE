'use client';

import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import MarketOverview from '../components/MarketOverview';
import AssetDashboard from '../components/AssetDashboard';
import ProjectionSurface from '../components/ProjectionSurface';
import SignalsBoard from '../components/SignalsBoard';
import RiskProfiles from '../components/RiskProfiles';
import PortfolioRisk from '../components/PortfolioRisk';
import BacktestResults from '../components/BacktestResults';
import { Calendar, ShieldAlert } from 'lucide-react';

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<string>('MARKET');
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

  const renderActiveView = () => {
    switch (activeTab) {
      case 'MARKET':
        return <MarketOverview />;
      case 'ASSET':
        return <AssetDashboard />;
      case 'SURFACE':
        return <ProjectionSurface />;
      case 'SIGNALS':
        return <SignalsBoard />;
      case 'BACKTEST':
        return <BacktestResults />;
      case 'RISK':
        return <RiskProfiles />;
      case 'PORTFOLIO':
        return <PortfolioRisk />;
      default:
        return <MarketOverview />;
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-100 flex">
      {/* Persistant Navigation Sidebar */}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Dashboard Screen Area */}
      <main className="flex-1 ml-64 min-h-screen p-8 flex flex-col gap-6 overflow-x-hidden">
        {/* Top Quantitative Header Panel */}
        <header className="glass-panel border border-[#1F2942] rounded-xl px-6 py-4 flex justify-between items-center bg-[#151D30]/30">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.6)]" />
            <h2 className="text-xs font-bold font-mono tracking-widest text-slate-400 uppercase">
              MSPE SYSTEM PORTAL // MAIN NET
            </h2>
          </div>
          
          <div className="flex items-center gap-4 text-xs font-mono text-slate-400">
            <div className="flex items-center gap-1.5 bg-[#0B0F19]/60 px-3 py-1.5 rounded-lg border border-[#1F2942]/60">
              <Calendar className="w-3.5 h-3.5 text-cyan-400" />
              <span>{mounted ? new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: '2-digit' }) : '---'}</span>
            </div>
            
            <div className="flex items-center gap-1.5 bg-[#0B0F19]/60 px-3 py-1.5 rounded-lg border border-[#1F2942]/60 text-slate-300 font-bold">
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
