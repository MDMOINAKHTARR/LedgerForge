import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronDown, 
  Menu, 
  X, 
  Scale, 
  Users, 
  Database, 
  RefreshCw,
  ArrowRight, 
  ShieldCheck, 
  FileText, 
  CreditCard,
  Layers,
  FileCheck,
  BookOpen,
  Cpu
} from 'lucide-react';

export function MarketingNavbar({ 
  activePage = 'landing', 
  onNavigate, 
  onEnterDashboard 
}) {
  const [openMenu, setOpenMenu] = useState(null);
  const [isHover, setIsHover] = useState(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navContainerRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (navContainerRef.current && !navContainerRef.current.contains(event.target)) {
        setOpenMenu(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close dropdown and mobile menu on Escape
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setOpenMenu(null);
        setIsMobileMenuOpen(false);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleProductSelect = (sectionId) => {
    setOpenMenu(null);
    setIsMobileMenuOpen(false);
    if (onNavigate) {
      onNavigate('products', sectionId);
    }
  };

  const handlePageSelect = (pageName) => {
    setOpenMenu(null);
    setIsMobileMenuOpen(false);
    if (onNavigate) {
      onNavigate(pageName);
    }
  };

  // Original Pages and Capabilities with DropdownNavigation multi-column submenus
  const navItems = [
    {
      id: 'products',
      label: 'Products',
      subMenus: [
        {
          title: 'Deterministic Core',
          items: [
            {
              label: 'Reconciliation Engine',
              description: '$0.00 delta rule matching',
              icon: Scale,
              onClick: () => handleProductSelect('engine')
            },
            {
              label: 'Safety Guardrails',
              description: 'Hard lockouts & CFO boundaries',
              icon: ShieldCheck,
              onClick: () => handleProductSelect('safety')
            }
          ]
        },
        {
          title: 'Governance & Review',
          items: [
            {
              label: 'Accountant Review',
              description: 'Human-in-the-loop audit queue',
              icon: Users,
              onClick: () => handleProductSelect('exceptions')
            },
            {
              label: 'Policy Lineage',
              description: 'Offline eval & shadow testing',
              icon: RefreshCw,
              onClick: () => handleProductSelect('evolution')
            }
          ]
        },
        {
          title: 'Platform Proof',
          items: [
            {
              label: 'Cryptographic Audit',
              description: 'SHA-256 decision envelopes',
              icon: FileText,
              onClick: () => handleProductSelect('audit')
            },
            {
              label: 'Reconciliation Memory',
              description: 'Historical audit precedents',
              icon: Database,
              onClick: () => handleProductSelect('memory')
            }
          ]
        }
      ]
    },
    {
      id: 'how-it-works',
      label: 'How It Works',
      subMenus: [
        {
          title: 'Architecture Guide',
          items: [
            {
              label: '6-Stage Control Flow',
              description: 'End-to-end reconciliation pipeline',
              icon: Layers,
              onClick: () => handlePageSelect('how-it-works')
            },
            {
              label: 'Invariants & Security',
              description: 'Non-negotiable CFO guardrails',
              icon: ShieldCheck,
              onClick: () => handlePageSelect('how-it-works')
            }
          ]
        },
        {
          title: 'Deep Dives',
          items: [
            {
              label: 'Deterministic Matching',
              description: 'Zero hallucination risk',
              icon: Cpu,
              onClick: () => handlePageSelect('how-it-works')
            },
            {
              label: 'Exception Review UX',
              description: '11 structured audit resolutions',
              icon: FileCheck,
              onClick: () => handlePageSelect('how-it-works')
            }
          ]
        }
      ]
    },
    {
      id: 'security',
      label: 'Security',
      onClick: () => handlePageSelect('security')
    },
    {
      id: 'resources',
      label: 'Resources',
      subMenus: [
        {
          title: 'Knowledge Base',
          items: [
            {
              label: 'Accounting Concept Primer',
              description: 'Timing differences & variance guides',
              icon: BookOpen,
              onClick: () => handlePageSelect('resources')
            },
            {
              label: 'Reconciliation FAQ',
              description: 'Answers for finance & audit teams',
              icon: FileText,
              onClick: () => handlePageSelect('resources')
            }
          ]
        },
        {
          title: 'Sample Data',
          items: [
            {
              label: 'Benchmark CSV Datasets',
              description: 'MT940, CAMT.053, ERP GL samples',
              icon: Database,
              onClick: () => handlePageSelect('resources')
            }
          ]
        }
      ]
    },
    {
      id: 'pricing',
      label: 'Pricing',
      onClick: () => handlePageSelect('pricing')
    }
  ];

  return (
    <header 
      ref={navContainerRef}
      className="w-full max-w-[1240px] mx-auto px-4 sm:px-6 h-18 py-4 flex items-center justify-between z-40 shrink-0 relative"
    >
      {/* Brand Logo */}
      <div 
        className="flex items-center space-x-3 cursor-pointer group" 
        onClick={() => handlePageSelect('landing')}
        title="Return to Home"
      >
        <div className="w-9 h-9 rounded-xl bg-black flex items-center justify-center text-white shadow-xs group-hover:scale-102 transition-transform">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.8"/>
            <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.6"/>
          </svg>
        </div>
        <div>
          <div className="font-sans font-bold text-lg text-black tracking-tight leading-none">
            Ledger Forge
          </div>
          <p className="text-[8px] font-mono tracking-widest text-slate-400 uppercase mt-0.5 font-semibold">
            RECONCILE WITH CONFIDENCE
          </p>
        </div>
      </div>

      {/* Center Nav Links with Animated Floating Hover & Rich Dropdowns */}
      <nav className="hidden md:flex items-center space-x-0 relative">
        <ul className="relative flex items-center space-x-0">
          {navItems.map((navItem) => (
            <li
              key={navItem.id}
              className="relative"
              onMouseEnter={() => setOpenMenu(navItem.id)}
              onMouseLeave={() => setOpenMenu(null)}
            >
              <button
                type="button"
                onClick={() => {
                  if (navItem.onClick) {
                    navItem.onClick();
                  } else if (navItem.id) {
                    handlePageSelect(navItem.id);
                  }
                }}
                className={`text-xs py-2 px-3.5 flex cursor-pointer group transition-colors duration-300 items-center justify-center gap-1 relative font-semibold ${
                  activePage === navItem.id
                    ? 'text-black font-bold'
                    : 'text-slate-600 hover:text-black'
                }`}
                onMouseEnter={() => setIsHover(navItem.id)}
                onMouseLeave={() => setIsHover(null)}
              >
                <span>{navItem.label}</span>
                {navItem.subMenus && (
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform duration-300 ${
                      openMenu === navItem.id ? 'rotate-180 text-black' : 'text-slate-400'
                    }`}
                  />
                )}
                {(isHover === navItem.id || openMenu === navItem.id || activePage === navItem.id) && (
                  <motion.div
                    layoutId="navbar-hover-bg"
                    className={`absolute inset-0 size-full ${
                      activePage === navItem.id ? 'bg-black/[0.07]' : 'bg-slate-200/60'
                    }`}
                    style={{ borderRadius: 99 }}
                    transition={{ type: 'spring', bounce: 0.15, duration: 0.25 }}
                  />
                )}
              </button>

              <AnimatePresence>
                {openMenu === navItem.id && navItem.subMenus && (
                  <div 
                    className={`w-auto absolute top-full pt-2 z-50 ${
                      navItem.id === 'resources' || navItem.id === 'pricing'
                        ? 'right-0'
                        : 'left-1/2 -translate-x-1/2'
                    }`}
                  >
                    <motion.div
                      className="bg-white border border-slate-200 p-5 w-max shadow-2xl"
                      style={{ borderRadius: 16 }}
                      layoutId="navbar-menu"
                      initial={{ opacity: 0, y: 8, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 6, scale: 0.98 }}
                      transition={{ duration: 0.18 }}
                    >
                      <div className="w-fit shrink-0 flex space-x-8 overflow-hidden">
                        {navItem.subMenus.map((sub) => (
                          <motion.div layout className="w-60" key={sub.title}>
                            <h3 className="mb-3 text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-500">
                              {sub.title}
                            </h3>
                            <ul className="space-y-4">
                              {sub.items.map((item) => {
                                const Icon = item.icon;
                                return (
                                  <li key={item.label}>
                                    <div
                                      onClick={() => {
                                        setOpenMenu(null);
                                        if (item.onClick) item.onClick();
                                      }}
                                      className="flex items-start space-x-3 group cursor-pointer p-1.5 -m-1.5 rounded-lg hover:bg-slate-50 transition-colors duration-200"
                                    >
                                      <div className="border border-slate-200 text-slate-700 rounded-md flex items-center justify-center size-8 shrink-0 mt-0.5 group-hover:bg-slate-100 group-hover:text-slate-900 transition-colors duration-300">
                                        <Icon className="h-4 w-4 flex-none" />
                                      </div>
                                      <div className="leading-5 w-max">
                                        <p className="text-xs font-semibold text-slate-800 shrink-0 group-hover:text-black transition-colors">
                                          {item.label}
                                        </p>
                                        <p className="text-[11px] text-slate-500 shrink-0 group-hover:text-slate-700 transition-colors duration-300">
                                          {item.description}
                                        </p>
                                      </div>
                                    </div>
                                  </li>
                                );
                              })}
                            </ul>
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>
            </li>
          ))}
        </ul>
      </nav>

      {/* Right Actions (Desktop) */}
      <div className="hidden md:flex items-center space-x-3">
        <button 
          type="button"
          onClick={onEnterDashboard}
          className="text-xs font-semibold text-slate-700 hover:text-black transition-colors px-3 py-1.5 rounded-full hover:bg-slate-100 cursor-pointer"
        >
          Sign In
        </button>
        <button 
          type="button"
          onClick={onEnterDashboard}
          className="bg-black hover:bg-zinc-800 text-white font-semibold text-xs py-2 px-5 rounded-full shadow-xs hover:shadow transition-all cursor-pointer flex items-center space-x-1.5 group"
        >
          <span>Launch Dashboard</span>
          <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 group-hover:text-white transition-all" />
        </button>
      </div>

      {/* Mobile Hamburger Toggle */}
      <div className="flex items-center space-x-2 md:hidden">
        <button
          type="button"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 rounded-xl text-slate-700 hover:text-black hover:bg-slate-100 transition-colors cursor-pointer"
          aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
          aria-expanded={isMobileMenuOpen}
        >
          {isMobileMenuOpen ? (
            <X className="w-5 h-5" />
          ) : (
            <Menu className="w-5 h-5" />
          )}
        </button>
      </div>

      {/* Mobile Menu Drawer */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-x-4 top-20 bg-background/98 backdrop-blur-lg border border-border rounded-3xl p-5 shadow-2xl z-50 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Navigation Links */}
          <div className="space-y-1">
            <div className="px-3 py-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-bold">
              Navigation
            </div>
            
            {/* Products Accordion / Direct Link */}
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => handlePageSelect('products')}
                className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-between ${
                  activePage === 'products' ? 'bg-muted text-foreground' : 'text-foreground/80 hover:bg-muted/50'
                }`}
              >
                <span>Products</span>
                <span className="text-[10px] font-mono text-muted-foreground uppercase">4 Modules</span>
              </button>
              
              <div className="pl-4 pr-1 py-1 space-y-1 border-l-2 border-border ml-3">
                <button
                  type="button"
                  onClick={() => handleProductSelect('engine')}
                  className="w-full text-left px-2 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 flex items-center justify-between"
                >
                  <span>Reconciliation Engine</span>
                  <ArrowRight className="w-3 h-3 text-muted-foreground" />
                </button>
                <button
                  type="button"
                  onClick={() => handleProductSelect('safety')}
                  className="w-full text-left px-2 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 flex items-center justify-between"
                >
                  <span>Safety Guardrails</span>
                  <ArrowRight className="w-3 h-3 text-muted-foreground" />
                </button>
                <button
                  type="button"
                  onClick={() => handleProductSelect('exceptions')}
                  className="w-full text-left px-2 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 flex items-center justify-between"
                >
                  <span>Accountant Review</span>
                  <ArrowRight className="w-3 h-3 text-muted-foreground" />
                </button>
                <button
                  type="button"
                  onClick={() => handleProductSelect('evolution')}
                  className="w-full text-left px-2 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 flex items-center justify-between"
                >
                  <span>Policy Lineage</span>
                  <ArrowRight className="w-3 h-3 text-muted-foreground" />
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handlePageSelect('how-it-works')}
              className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-between ${
                activePage === 'how-it-works' ? 'bg-muted text-foreground' : 'text-foreground/80 hover:bg-muted/50'
              }`}
            >
              <span>How It Works</span>
              <span className="text-[10px] font-mono text-emerald-600 font-bold">Architecture</span>
            </button>

            <button
              type="button"
              onClick={() => handlePageSelect('security')}
              className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-between ${
                activePage === 'security' ? 'bg-muted text-foreground' : 'text-foreground/80 hover:bg-muted/50'
              }`}
            >
              <span>Security &amp; Governance</span>
              <ShieldCheck className="w-4 h-4 text-muted-foreground" />
            </button>

            <button
              type="button"
              onClick={() => handlePageSelect('resources')}
              className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-between ${
                activePage === 'resources' ? 'bg-muted text-foreground' : 'text-foreground/80 hover:bg-muted/50'
              }`}
            >
              <span>Resources &amp; Data</span>
              <FileText className="w-4 h-4 text-muted-foreground" />
            </button>

            <button
              type="button"
              onClick={() => handlePageSelect('pricing')}
              className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-between ${
                activePage === 'pricing' ? 'bg-muted text-foreground' : 'text-foreground/80 hover:bg-muted/50'
              }`}
            >
              <span>Pricing</span>
              <CreditCard className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          <hr className="border-border" />

          {/* Mobile Actions */}
          <div className="pt-1 space-y-2">
            <button
              type="button"
              onClick={() => {
                setIsMobileMenuOpen(false);
                onEnterDashboard();
              }}
              className="w-full bg-black hover:bg-zinc-800 text-white font-semibold text-xs py-3 px-5 rounded-full shadow-xs flex items-center justify-center space-x-2"
            >
              <span>Launch Dashboard</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => {
                setIsMobileMenuOpen(false);
                onEnterDashboard();
              }}
              className="w-full bg-muted hover:bg-muted/80 text-foreground font-semibold text-xs py-2.5 px-5 rounded-full flex items-center justify-center"
            >
              <span>Sign In</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
}

export default MarketingNavbar;
