'use client';

import React from 'react';
import { 
  TrendingUp, 
  BarChart2, 
  Layers, 
  Zap, 
  ShieldAlert, 
  Briefcase, 
  Activity,
  History
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function Sidebar({ activeTab, setActiveTab }: SidebarProps) {
  const navigationItems = [
    { id: 'MARKET', name: 'Market Overview', icon: TrendingUp },
    { id: 'ASSET', name: 'Asset Dashboard', icon: BarChart2 },
    { id: 'SURFACE', name: 'Projection Surface', icon: Layers },
    { id: 'SIGNALS', name: 'Trading Signals', icon: Zap },
    { id: 'BACKTEST', name: 'Backtest Results', icon: History },
    { id: 'RISK', name: 'Risk Analytics', icon: ShieldAlert },
    { id: 'PORTFOLIO', name: 'Portfolio Analytics', icon: Briefcase },
  ];

  return (
    <aside className="w-64 glass-panel border-r border-[#1F2942] h-screen fixed left-0 top-0 flex flex-col z-20">
      {/* Brand Logo Segment */}
      <div className="p-6 border-b border-[#1F2942]/60 flex items-center gap-3">
        <div className="relative flex items-center justify-center w-9 h-9 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
          <Activity className="w-5 h-5 animate-pulse" />
          <div className="absolute inset-0 w-9 h-9 rounded-lg bg-cyan-400/20 blur-sm scale-110 pointer-events-none -z-10" />
        </div>
        <div>
          <h1 className="font-bold text-base tracking-wider text-slate-100 uppercase">MSPE</h1>
          <p className="text-[10px] text-cyan-400 font-mono tracking-widest uppercase">Quant Portal</p>
        </div>
      </div>

      {/* Nav Link List */}
      <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-lg text-sm font-medium tracking-wide transition-all duration-300 group relative ${
                isActive 
                  ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.15)]' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#151D30]/40 border border-transparent'
              }`}
            >
              <Icon className={`w-4.5 h-4.5 transition-colors duration-300 ${
                isActive ? 'text-cyan-400' : 'text-slate-400 group-hover:text-slate-200'
              }`} />
              <span>{item.name}</span>
              
              {/* Glowing Active Border Line Indicator */}
              {isActive && (
                <div className="absolute left-0 w-1 h-6 rounded-r bg-cyan-400" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer Info Segment */}
      <div className="p-4 border-t border-[#1F2942]/60 bg-[#0B0F19]/60 font-mono text-[10px] text-slate-500 flex flex-col gap-1">
        <div className="flex justify-between">
          <span>Engine Status:</span>
          <span className="text-emerald-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" /> ONLINE
          </span>
        </div>
        <div className="flex justify-between">
          <span>Version:</span>
          <span>v1.0.0</span>
        </div>
        <div className="flex justify-between">
          <span>System Environment:</span>
          <span className="text-slate-400">PROD</span>
        </div>
      </div>
    </aside>
  );
}
