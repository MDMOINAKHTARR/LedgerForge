import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, Bell, ChevronDown, ArrowLeft, Home, 
  Check, CheckCheck, Trash2, X, AlertTriangle, 
  CheckCircle2, ShieldAlert, Sparkles, ExternalLink, Clock, FileText, RefreshCw
} from 'lucide-react';
import { getNotifications } from '../services/api';
import Banner from '@/components/ui/astryx-banner';
import { Theme } from '@astryxdesign/core/theme';
import { neutralTheme } from '@astryxdesign/theme-neutral/built';

export function TopHeader({ 
  searchTerm, 
  setSearchTerm, 
  onReturnHome,
  pendingExceptionsCount = 0,
  onNavigate,
  onOpenReport
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState('all'); // 'all', 'unread', 'alerts'
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const dropdownRef = useRef(null);


  // Fetch real-time dynamic notifications from live backend — no hardcoded fallbacks
  const fetchLiveNotifications = async () => {
    try {
      setIsLoading(true);
      setFetchError(false);
      const data = await getNotifications();
      // Backend already merges exceptions, batches & audit logs — just use what it returns
      setNotifications(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('Could not reach notification endpoint:', err);
      setFetchError(true);
      // Do NOT fall back to fake data — keep whatever was previously loaded
      // so the panel doesn't flash stale hardcoded content
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveNotifications();
    // Dynamic polling every 15 seconds for live reconciliation updates
    const interval = setInterval(fetchLiveNotifications, 15000);
    return () => clearInterval(interval);
  }, [pendingExceptionsCount]);


  // Click outside to close notification panel
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const unreadCount = notifications.filter(n => n.unread).length;

  const handleMarkAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, unread: false })));
  };

  const handleClearAll = () => {
    setNotifications([]);
  };

  const handleDismiss = (id, e) => {
    e.stopPropagation();
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const handleToggleRead = (id, e) => {
    e.stopPropagation();
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, unread: !n.unread } : n));
  };

  const handleActionClick = (notif) => {
    // Mark as read on action
    setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, unread: false } : n));
    setIsOpen(false);

    if (notif.targetAction === 'open_report' && onOpenReport) {
      onOpenReport();
    } else if (notif.targetTab && onNavigate) {
      onNavigate(notif.targetTab);
    }
  };

  const resolveBannerStatus = (notif) => {
    if (notif.status && ['success', 'warning', 'info', 'error'].includes(notif.status)) {
      return notif.status;
    }
    const type = String(notif.type || '').toLowerCase();
    if (type === 'alert' || type === 'warning' || type === 'error') return 'warning';
    if (type === 'success') return 'success';
    if (type === 'info') return 'info';
    
    const text = `${notif.title || ''} ${notif.message || ''}`.toLowerCase();
    if (text.includes('exception') || text.includes('warning') || text.includes('variance') || text.includes('maintenance')) {
      return 'warning';
    }
    if (text.includes('complete') || text.includes('reconciled') || text.includes('success')) {
      return 'success';
    }
    return 'info';
  };

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'unread') return n.unread;
    if (filter === 'alerts') return resolveBannerStatus(n) === 'warning' || n.type === 'alert';
    return true;
  });

  return (
    <header className="h-16 bg-white border-b border-slate-200/80 px-6 flex items-center justify-between sticky top-0 z-30">
      {/* Left: Home Return Button & Global Search Bar */}
      <div className="flex items-center space-x-4 flex-1 max-w-2xl">
        {onReturnHome && (
          <button
            onClick={onReturnHome}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full border border-slate-200 bg-[#FAFAF8] hover:bg-white text-xs font-semibold text-slate-700 transition-all shadow-2xs hover:shadow-xs shrink-0 cursor-pointer"
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
        
        {/* Notification Bell Container with Interactive Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button 
            id="notification-bell-btn"
            onClick={() => {
              setIsOpen(prev => {
                if (!prev) fetchLiveNotifications();
                return !prev;
              });
            }}
            aria-label="Open notifications"
            className={`relative p-2 rounded-full transition-all cursor-pointer ${
              isOpen 
                ? 'bg-slate-100 text-slate-900 ring-2 ring-slate-200' 
                : 'hover:bg-slate-100 text-slate-600 hover:text-slate-900'
            }`}
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white shadow-xs animate-pulse">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Dropdown Popover */}
          {isOpen && (
            <div className="absolute right-0 mt-3 w-88 sm:w-[440px] max-w-[92vw] bg-white rounded-2xl shadow-2xl border border-slate-200/90 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
              
              {/* Header */}
              <div className="px-4 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-slate-900 tracking-tight">Notifications</span>
                  {unreadCount > 0 ? (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-100">
                      {unreadCount} new
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-600 border border-emerald-100">
                      All caught up
                    </span>
                  )}
                </div>

                <div className="flex items-center space-x-1.5">
                  <button
                    onClick={fetchLiveNotifications}
                    className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                    title="Refresh live notifications from database"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-indigo-600' : ''}`} />
                  </button>
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllAsRead}
                      className="text-[11px] font-medium text-slate-500 hover:text-slate-800 flex items-center space-x-1 px-2 py-1 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
                      title="Mark all as read"
                    >
                      <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Mark read</span>
                    </button>
                  )}
                  {notifications.length > 0 && (
                    <button
                      onClick={handleClearAll}
                      className="text-[11px] font-medium text-slate-400 hover:text-rose-600 p-1 rounded-md hover:bg-rose-50 transition-colors cursor-pointer"
                      title="Clear all notifications"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Filter Tabs */}
              <div className="px-3 pt-2 pb-1 flex items-center space-x-1 border-b border-slate-100 bg-white">
                <button
                  onClick={() => setFilter('all')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    filter === 'all' 
                      ? 'bg-slate-900 text-white shadow-2xs' 
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                  }`}
                >
                  All ({notifications.length})
                </button>
                <button
                  onClick={() => setFilter('unread')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    filter === 'unread' 
                      ? 'bg-slate-900 text-white shadow-2xs' 
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                  }`}
                >
                  Unread ({unreadCount})
                </button>
                <button
                  onClick={() => setFilter('alerts')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    filter === 'alerts' 
                      ? 'bg-slate-900 text-white shadow-2xs' 
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                  }`}
                >
                  Alerts
                </button>
              </div>

              {/* Notification List Body with Astryx Alert Design */}
              <div className="astryx-notif-menu max-h-[420px] overflow-y-auto p-3.5 bg-slate-50/50">
                {filteredNotifications.length === 0 ? (
                  <div className="p-8 text-center bg-white rounded-xl border border-slate-100">
                    {fetchError ? (
                      <>
                        <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-500 flex items-center justify-center mx-auto mb-2.5 border border-amber-100">
                          <AlertTriangle className="w-5 h-5" />
                        </div>
                        <div className="text-xs font-bold text-slate-800">Backend unreachable</div>
                        <p className="text-[11px] text-slate-400 mt-0.5">Could not connect to the notification service. Check that the backend is running.</p>
                        <button
                          onClick={fetchLiveNotifications}
                          className="mt-3 text-[11px] font-semibold text-blue-600 hover:underline"
                        >
                          Retry
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-2.5 border border-emerald-100">
                          <CheckCircle2 className="w-5 h-5" />
                        </div>
                        <div className="text-xs font-bold text-slate-800">No notifications yet</div>
                        <p className="text-[11px] text-slate-400 mt-0.5">Notifications will appear here after your first reconciliation run.</p>
                      </>
                    )}
                  </div>
                ) : (
                  <Theme theme={neutralTheme}>
                    <div className="space-y-3">
                      {filteredNotifications.map((notif) => {
                        const bannerStatus = resolveBannerStatus(notif);

                        return (
                          <div key={notif.id} className="relative group transition-all">
                            <Banner
                              status={bannerStatus}
                              title={<span className="font-bold text-slate-950 text-[13px] tracking-tight">{notif.title}</span>}
                              description={
                                <div className="space-y-1.5 mt-0.5">
                                  <p className="text-xs leading-relaxed font-semibold text-slate-950">{notif.message}</p>
                                  {notif.time && (
                                    <div className="flex items-center gap-1 text-[10px] text-slate-700 font-mono font-medium">
                                      <Clock className="w-2.5 h-2.5 text-slate-700" />
                                      <span>{notif.time}</span>
                                    </div>
                                  )}
                                </div>
                              }
                              isDismissable
                              onDismiss={() => handleDismiss(notif.id)}
                              endContent={notif.actionLabel ? (
                                <button
                                  onClick={() => handleActionClick(notif)}
                                  className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-white/95 hover:bg-white text-slate-800 shadow-2xs border border-slate-200/80 transition-all cursor-pointer flex items-center gap-1 shrink-0"
                                >
                                  <span>{notif.actionLabel}</span>
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </button>
                              ) : undefined}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </Theme>
                )}
              </div>

              {/* Footer */}
              <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <div className="flex items-center space-x-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="font-medium">Live Audit Stream</span>
                </div>
                <span className="text-slate-400 font-mono text-[10px]">LedgerMind Core</span>
              </div>
            </div>
          )}
        </div>

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
