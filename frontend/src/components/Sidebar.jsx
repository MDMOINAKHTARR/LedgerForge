import React from 'react';
import { 
  LayoutDashboard, 
  FileCheck2, 
  ListOrdered, 
  Users2, 
  AlertTriangle, 
  Cpu, 
  BarChart3, 
  Share2, 
  Settings,
  ShieldCheck,
  ArrowRight,
  Home
} from 'lucide-react';

export function Sidebar({ activeTab, setActiveTab, pendingExceptionsCount = 0, onReturnHome }) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'reconciliation', label: 'Reconciliation', icon: FileCheck2 },
    { id: 'transactions', label: 'Transactions', icon: ListOrdered },
    { id: 'human-queue', label: 'Human Queue', icon: Users2, badge: pendingExceptionsCount },
    { id: 'exceptions', label: 'Exceptions', icon: AlertTriangle },
    { id: 'agent-evolution', label: 'Agent Evolution', icon: Cpu },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    { id: 'integrations', label: 'Integrations', icon: Share2 },
    { id: 'settings', label: 'Policy & Safety', icon: ShieldCheck },
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200/80 flex flex-col justify-between shrink-0 min-h-screen sticky top-0 h-screen overflow-y-auto">
      <div className="p-5">
        {/* Brand Logo & Title (Clicking returns to Landing Page) */}
        <div 
          onClick={onReturnHome}
          className="flex items-center space-x-3 mb-7 cursor-pointer group"
          title="Return to Landing Page"
        >
          {/* Stacked isometric ledger logo */}
          <div className="w-10 h-10 rounded-xl bg-ink flex items-center justify-center shadow-xs text-white relative overflow-hidden group-hover:bg-black transition-colors">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-white">
              <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.8"/>
              <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.6"/>
            </svg>
          </div>
          <div>
            <div className="flex items-center space-x-1">
              <span className="font-serif font-bold text-lg text-ink tracking-tight group-hover:text-black">Ledger Forge</span>
            </div>
            <p className="text-[9px] font-mono tracking-widest text-ink-muted uppercase">
              Reconcile With Confidence
            </p>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all group ${
                  isActive
                    ? 'bg-pastel-yellow text-ink font-semibold shadow-xs'
                    : 'text-ink-secondary hover:text-ink hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Icon className={`w-4 h-4 transition-colors ${
                    isActive ? 'text-ink' : 'text-ink-muted group-hover:text-ink'
                  }`} />
                  <span className="text-[13px]">{item.label}</span>
                </div>

                {item.badge !== undefined && item.badge > 0 && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    isActive 
                      ? 'bg-rose-500 text-white' 
                      : 'bg-rose-500/10 text-rose-600'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Mascot Card: Forge */}
      <div className="p-4 m-4 rounded-2xl bg-pastel-yellow border border-pastel-yellow-border relative overflow-hidden flex flex-col items-center text-center shadow-xs">
        {/* Mascot Image */}
        <div className="w-24 h-24 mb-1 relative flex items-center justify-center">
          <img 
            src="/assets/forge_mascot.png" 
            alt="Forge AI Mascot" 
            className="w-full h-full object-contain drop-shadow-md transform hover:scale-105 transition-transform"
          />
        </div>

        {/* Handwritten script text */}
        <p className="font-script text-lg text-ink leading-tight mb-3">
          Smarter Reconciliation, <br />
          <span className="text-amber-800 font-semibold">Brighter Finance.</span>
        </p>

        {/* Upgrade Plan button */}
        <button className="w-full py-2 px-3 bg-ink hover:bg-black text-white text-xs font-semibold rounded-full flex items-center justify-center space-x-1.5 shadow-sm transition-all">
          <span>Upgrade Plan</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </aside>
  );
}
