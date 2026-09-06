import React from 'react';
import { Search, Bell, ChevronDown, ArrowLeft, Home } from 'lucide-react';

export function TopHeader({ searchTerm, setSearchTerm, onReturnHome }) {
  return (
    <header className="h-16 bg-white border-b border-slate-200/80 px-6 flex items-center justify-between sticky top-0 z-30">
      {/* Left: Home Return Button & Global Search Bar */}
      <div className="flex items-center space-x-4 flex-1 max-w-2xl">
        {onReturnHome && (
          <button
            onClick={onReturnHome}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full border border-slate-200 bg-[#FAFAF8] hover:bg-white text-xs font-semibold text-slate-700 transition-all shadow-2xs hover:shadow-xs shrink-0"
            title="Return to Landing Page"
          >
            <Home className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Home</span>
          </button>
        )}

        {/* Global Search */}
        <div className="relative flex items-center flex-1">
          <Search className="w-4 h-4 absolute left-3.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search transactions, invoices, or anything..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#FAFAF8] border border-slate-200 rounded-full pl-10 pr-16 py-2 text-xs text-ink placeholder-slate-400 focus:outline-none focus:border-slate-400 focus:bg-white transition-all"
          />
          <div className="absolute right-3 px-1.5 py-0.5 rounded bg-white border border-slate-200 text-[10px] font-mono font-medium text-slate-400 shadow-2xs">
            Ctrl K
          </div>
        </div>
      </div>

      {/* Right Side: Notification & User Profile */}
      <div className="flex items-center space-x-4 pl-4 shrink-0">
        {/* Notification Bell */}
        <button className="relative p-2 rounded-full hover:bg-slate-100 text-slate-600 transition-colors">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white" />
        </button>

        {/* User Info */}
        <div className="flex items-center space-x-3 cursor-pointer pl-2 border-l border-slate-200/60 hover:opacity-90 transition-opacity">
          <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center font-bold text-xs text-slate-700">
            MA
          </div>
          <div className="text-left hidden sm:block">
            <div className="text-xs font-bold text-ink leading-tight">Mohd Asad</div>
            <div className="text-[10px] text-slate-400 font-medium">Pro Plan</div>
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
        </div>
      </div>
    </header>
  );
}
