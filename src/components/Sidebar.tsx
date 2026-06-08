import { useState, useEffect, useRef, useMemo } from 'react';
import { Truck, LayoutDashboard, Users, FileText, Truck as TruckIcon, BarChart3, ShieldAlert, Menu, Bell, AlertTriangle, Star, Clock } from 'lucide-react';
import { getVendors, getPurchaseOrders } from '../lib/data';

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

interface Alert {
  id: string;
  icon: typeof Bell;
  iconColor: string;
  description: string;
  page: string;
}

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, emoji: '\uD83D\uDCCA' },
  { id: 'vendors', label: 'Vendors', icon: Users, emoji: '\uD83C\uDFE2' },
  { id: 'purchase-orders', label: 'Purchase Orders', icon: FileText, emoji: '\uD83D\uDCDD' },
  { id: 'delivery', label: 'Delivery', icon: TruckIcon, emoji: '\uD83D\uDE9A' },
  { id: 'scorecard', label: 'Scorecard', icon: BarChart3, emoji: '\uD83C\uDFAF' },
  { id: 'ai-risk', label: 'AI Risk', icon: ShieldAlert, emoji: '\uD83D\uDEE1\uFE0F' },
];

function buildAlerts(): Alert[] {
  const vendors = getVendors();
  const pos = getPurchaseOrders();
  const alerts: Alert[] = [];
  const now = Date.now();

  pos.filter((p) => p.status === 'overdue').forEach((po) => {
    alerts.push({
      id: `overdue-${po.id}`,
      icon: AlertTriangle,
      iconColor: 'text-red-400',
      description: `${po.poNumber} from ${po.vendorName} is overdue`,
      page: 'delivery',
    });
  });

  vendors.filter((v) => v.score < 60).forEach((v) => {
    alerts.push({
      id: `score-${v.id}`,
      icon: Star,
      iconColor: 'text-orange-400',
      description: `${v.name} has a low score (${v.score}/100)`,
      page: 'scorecard',
    });
  });

  pos
    .filter((p) => {
      if (p.status !== 'pending' && p.status !== 'approved' && p.status !== 'Ordered') return false;
      return (now - new Date(p.date).getTime()) / (1000 * 60 * 60 * 24) >= 7;
    })
    .forEach((po) => {
      const days = Math.floor((now - new Date(po.date).getTime()) / (1000 * 60 * 60 * 24));
      alerts.push({
        id: `stuck-${po.id}`,
        icon: Clock,
        iconColor: 'text-yellow-400',
        description: `${po.poNumber} stuck in "${po.status}" for ${days}d`,
        page: 'purchase-orders',
      });
    });

  return alerts;
}

export default function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);

  const alerts = useMemo(() => buildAlerts(), []);
  const badgeCount = alerts.length;
  const badgeLabel = badgeCount > 9 ? '9+' : String(badgeCount);

  function handleNav(page: string) {
    onNavigate(page);
    setMobileOpen(false);
    setBellOpen(false);
  }

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setBellOpen(false);
      }
    }
    if (bellOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [bellOpen]);

  // Sync sidebar-open class on <html> for CSS-driven overlay
  useEffect(() => {
    if (mobileOpen) {
      document.documentElement.classList.add('sidebar-open');
      document.body.style.overflow = 'hidden';
    } else {
      document.documentElement.classList.remove('sidebar-open');
      document.body.style.overflow = '';
    }
    return () => {
      document.documentElement.classList.remove('sidebar-open');
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  const bellButton = (
    <div ref={bellRef} className="relative">
      <button
        onClick={() => setBellOpen((v) => !v)}
        className="relative flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
        aria-label="Notifications"
        style={{ minHeight: 44, minWidth: 44 }}
      >
        <Bell className="w-5 h-5" />
        {badgeCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-[3px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
            {badgeLabel}
          </span>
        )}
      </button>

      {bellOpen && (
        <div className="absolute left-0 top-10 w-72 bg-[#0f2244] border border-blue-900/50 rounded-xl shadow-2xl shadow-black/40 z-[300] overflow-hidden">
          <div className="px-4 py-3 border-b border-blue-900/40">
            <p className="text-sm font-semibold text-white">Alerts</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {badgeCount} active notification{badgeCount !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {alerts.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <Bell className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                <p className="text-sm text-slate-500">No alerts right now</p>
              </div>
            ) : (
              alerts.map((alert) => {
                const Icon = alert.icon;
                return (
                  <button
                    key={alert.id}
                    onClick={() => handleNav(alert.page)}
                    className="w-full flex items-start gap-3 px-4 py-3 hover:bg-white/5 transition-colors border-b border-blue-900/20 last:border-0 text-left"
                    style={{ minHeight: 44, position: 'relative', zIndex: 2, pointerEvents: 'auto' }}
                  >
                    <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${alert.iconColor}`} />
                    <span className="text-xs text-slate-300 leading-snug">{alert.description}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="mobile-topbar fixed top-0 left-0 right-0 h-14 bg-[#0a1628] z-[200] flex items-center px-4 md:hidden border-b border-blue-900/40">
        <button
          onClick={() => setMobileOpen(true)}
          className="text-slate-300 hover:text-white transition-colors"
          aria-label="Open navigation"
          style={{ minHeight: 44, minWidth: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 2, pointerEvents: 'auto' }}
        >
          <Menu className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-2 ml-2">
          <Truck className="w-5 h-5 text-blue-400" />
          <span className="text-base font-bold text-white tracking-tight">
            <span className="text-blue-400">Procure</span>AI
          </span>
        </div>
      </div>

      {/* Overlay — CSS-driven via sidebar-open class, never uses opacity/visibility */}
      <div
        className="mobile-overlay"
        onClick={() => setMobileOpen(false)}
      />

      {/* Sidebar */}
      <aside className="sidebar fixed left-0 top-0 h-screen w-[220px] bg-[#0a1628] border-r border-blue-900/40 z-[100] flex flex-col">
        {/* Logo + bell */}
        <div className="flex items-center justify-between px-5 h-16 border-b border-blue-900/40">
          <div className="flex items-center gap-2">
            <Truck className="w-7 h-7 text-blue-400" />
            <span className="text-xl font-bold text-white tracking-tight">
              <span className="text-blue-400">Procure</span>AI
            </span>
          </div>
          <div className="flex items-center gap-1">
            {bellButton}
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const active = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNav(item.id)}
                style={{ minHeight: 44, position: 'relative', zIndex: 101, pointerEvents: 'auto' }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  active
                    ? 'bg-blue-600/10 text-blue-400 border-l-[3px] border-[#3b82f6] -ml-[3px] pl-[18px]'
                    : 'text-slate-400 hover:text-white hover:bg-white/5 border-l-[3px] border-transparent -ml-[3px] pl-[18px]'
                }`}
              >
                <span className="text-lg leading-none">{item.emoji}</span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-blue-900/40">
          <p className="text-xs text-slate-600">ProcureAI v1.0</p>
        </div>
      </aside>
    </>
  );
}
