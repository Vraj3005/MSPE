'use client';

import React from 'react';
import { 
  TrendingUp, 
  BarChart2, 
  ShieldAlert, 
  Activity,
  History,
  Info
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  theme?: 'light' | 'dark';
}

export default function Sidebar({ activeTab, setActiveTab, theme = 'light' }: SidebarProps) {
  const navigationItems = [
    { id: 'MARKET', name: 'Market Projections', icon: TrendingUp },
    { id: 'ASSET', name: 'Technical Detail', icon: BarChart2 },
    { id: 'BACKTEST', name: 'Strategy Backtester', icon: History },
    { id: 'RISK', name: 'Portfolio Risks', icon: ShieldAlert },
    { id: 'METHODOLOGY', name: 'How It Works', icon: Info },
  ];

  return (
    <aside className={`w-64 border-r h-screen fixed left-0 top-0 flex flex-col z-20 transition-all duration-300 ${
      theme === 'light' 
        ? 'bg-white border-slate-200 shadow-sm text-slate-800' 
        : 'bg-[#0B0F19] border-[#1F2942] text-slate-100'
    }`}>
      {/* Brand Logo Segment */}
      <div className={`p-6 border-b flex items-center gap-3 transition-colors duration-300 ${
        theme === 'light' ? 'border-slate-200' : 'border-[#1F2942]/60'
      }`}>
        <div className={`relative flex items-center justify-center w-9 h-9 rounded-lg border transition-all duration-300 ${
          theme === 'light'
            ? 'bg-cyan-50 border-cyan-200 text-cyan-600'
            : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
        }`}>
          <Activity className="w-5 h-5 animate-pulse" />
          {theme === 'dark' && (
            <div className="absolute inset-0 w-9 h-9 rounded-lg bg-cyan-400/20 blur-sm scale-110 pointer-events-none -z-10" />
          )}
        </div>
        <div>
          <h1 className={`font-bold text-base tracking-wider transition-colors duration-300 ${
            theme === 'light' ? 'text-slate-900' : 'text-slate-100'
          }`}>MSPE</h1>
          <p className={`text-[10px] font-mono tracking-widest uppercase transition-colors duration-300 ${
            theme === 'light' ? 'text-cyan-600' : 'text-cyan-400'
          }`}>Quant Portal</p>
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
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-lg text-sm font-medium tracking-wide transition-all duration-300 group relative border ${
                isActive 
                  ? theme === 'light'
                    ? 'bg-cyan-50 text-cyan-700 border-cyan-300 shadow-sm'
                    : 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                  : theme === 'light'
                    ? 'text-slate-600 hover:text-slate-950 hover:bg-slate-50 border-transparent'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#151D30]/40 border-transparent'
              }`}
            >
              <Icon className={`w-4.5 h-4.5 transition-colors duration-300 ${
                isActive 
                  ? theme === 'light' ? 'text-cyan-600' : 'text-cyan-400'
                  : theme === 'light' ? 'text-slate-400 group-hover:text-slate-600' : 'text-slate-400 group-hover:text-slate-200'
              }`} />
              <span>{item.name}</span>
              
              {/* Glowing Active Border Line Indicator */}
              {isActive && (
                <div className={`absolute left-0 w-1 h-6 rounded-r ${
                  theme === 'light' ? 'bg-cyan-500' : 'bg-cyan-400'
                }`} />
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer Info Segment */}
      <div className={`p-4 border-t font-mono text-[10px] flex flex-col gap-1.5 transition-all duration-300 ${
        theme === 'light' 
          ? 'border-slate-200 bg-slate-50 text-slate-500' 
          : 'border-[#1F2942]/60 bg-[#0B0F19]/60 text-slate-500'
      }`}>
        <div className="flex justify-between">
          <span>Engine Status:</span>
          <span className={`flex items-center gap-1 ${
            theme === 'light' ? 'text-emerald-600 font-bold' : 'text-emerald-400'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full animate-ping ${
              theme === 'light' ? 'bg-emerald-600' : 'bg-emerald-400'
            }`} /> ONLINE
          </span>
        </div>
        <div className="flex justify-between">
          <span>Version:</span>
          <span className={theme === 'light' ? 'text-slate-700 font-bold' : 'text-slate-400'}>v1.0.0</span>
        </div>
        <div className="flex justify-between">
          <span>System Environment:</span>
          <span className={theme === 'light' ? 'text-slate-700 font-bold' : 'text-slate-400'}>PROD</span>
        </div>
      </div>
    </aside>
  );
}
