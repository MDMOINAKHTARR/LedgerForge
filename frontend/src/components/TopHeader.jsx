import { 
  Search, Bell, ChevronDown, ArrowLeft, Home, 
  Check, CheckCheck, Trash2, X, AlertTriangle, 
  CheckCircle2, ShieldAlert, Sparkles, ExternalLink, Clock, FileText, RefreshCw
} from 'lucide-react';
import { getNotifications } from '../services/api';

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
  const dropdownRef = useRef(null);

  // Fetch real-time dynamic notifications from live backend
  const fetchLiveNotifications = async () => {
    try {
      setIsLoading(true);
      const data = await getNotifications();
      if (Array.isArray(data) && data.length > 0) {
        setNotifications(data);
      } else if (pendingExceptionsCount > 0) {
        setNotifications([
          {
            id: `live-exc-${pendingExceptionsCount}`,
            title: `${pendingExceptionsCount} Pending Human Exceptions`,
            message: `${pendingExceptionsCount} transactions require human approval due to material variance or ambiguity.`,
            time: 'Active',
            type: 'alert',
            unread: true,
            actionLabel: 'Review Exceptions',
            targetTab: 'exceptions'
          },
          {
            id: 'live-agent-core',
            title: 'Autonomous Agent V3 Active',
            message: 'Continuous multi-tier matching engine loaded with CFO safety policies and precedent memory.',
            time: 'System',
            type: 'success',
            unread: false,
            actionLabel: 'Inspect Policies',
            targetTab: 'engineer'
          }
        ]);
      } else {
        setNotifications([
          {
            id: 'live-agent-core',
            title: 'Autonomous Agent V3 Active',
            message: 'Continuous multi-tier matching engine loaded with CFO safety policies and precedent memory.',
            time: 'System',
            type: 'success',
            unread: false,
            actionLabel: 'Inspect Policies',
            targetTab: 'engineer'
          }
        ]);
      }
    } catch (err) {
      console.warn('Could not fetch dynamic notifications:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveNotifications();
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

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'unread') return n.unread;
    if (filter === 'alerts') return n.type === 'alert';
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
            onClick={() => setIsOpen(prev => !prev)}
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
            <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-slate-200/90 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
              
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

              {/* Notification List Body */}
              <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                {filteredNotifications.length === 0 ? (
                  <div className="p-8 text-center">
                    <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-2.5 border border-emerald-100">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div className="text-xs font-bold text-slate-800">No notifications</div>
                    <p className="text-[11px] text-slate-400 mt-0.5">You're all caught up with your reconciliation alerts.</p>
                  </div>
                ) : (
                  filteredNotifications.map((notif) => (
                    <div
                      key={notif.id}
                      className={`p-3.5 transition-colors group relative ${
                        notif.unread ? 'bg-indigo-50/30 hover:bg-indigo-50/50' : 'bg-white hover:bg-slate-50/80'
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        {/* Icon by Type */}
                        <div className="mt-0.5 shrink-0">
                          {notif.type === 'alert' && (
                            <div className="w-7 h-7 rounded-lg bg-rose-50 border border-rose-200/80 text-rose-600 flex items-center justify-center">
                              <AlertTriangle className="w-3.5 h-3.5" />
                            </div>
                          )}
                          {notif.type === 'success' && (
                            <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-200/80 text-emerald-600 flex items-center justify-center">
                              <Sparkles className="w-3.5 h-3.5" />
                            </div>
                          )}
                          {notif.type === 'info' && (
                            <div className="w-7 h-7 rounded-lg bg-sky-50 border border-sky-200/80 text-sky-600 flex items-center justify-center">
                              <ShieldAlert className="w-3.5 h-3.5" />
                            </div>
                          )}
                          {notif.type === 'report' && (
                            <div className="w-7 h-7 rounded-lg bg-amber-50 border border-amber-200/80 text-amber-600 flex items-center justify-center">
                              <FileText className="w-3.5 h-3.5" />
                            </div>
                          )}
                        </div>

                        {/* Text Details */}
                        <div className="flex-1 min-w-0 pr-4">
                          <div className="flex items-center justify-between">
                            <h4 className={`text-xs font-semibold leading-tight truncate ${
                              notif.unread ? 'text-slate-900 font-bold' : 'text-slate-700'
                            }`}>
                              {notif.title}
                            </h4>
                            <span className="text-[10px] text-slate-400 font-mono ml-2 shrink-0">
                              {notif.time}
                            </span>
                          </div>

                          <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                            {notif.message}
                          </p>

                          {/* Quick Action Button */}
                          {notif.actionLabel && (
                            <button
                              onClick={() => handleActionClick(notif)}
                              className="mt-2.5 inline-flex items-center space-x-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50/70 hover:bg-indigo-100/70 px-2.5 py-1 rounded-md transition-colors cursor-pointer"
                            >
                              <span>{notif.actionLabel}</span>
                              <ExternalLink className="w-3 h-3" />
                            </button>
                          )}
                        </div>

                        {/* Actions (mark read / dismiss) */}
                        <div className="flex flex-col items-center space-y-1 shrink-0 pt-0.5">
                          <button
                            onClick={(e) => handleDismiss(notif.id, e)}
                            className="p-1 rounded text-slate-300 hover:text-slate-500 hover:bg-slate-200/60 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                            title="Dismiss notification"
                          >
                            <X className="w-3 h-3" />
                          </button>
                          {notif.unread && (
                            <span className="w-2 h-2 rounded-full bg-indigo-500" title="Unread" />
                          )}
                        </div>
                      </div>
                    </div>
                  ))
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
