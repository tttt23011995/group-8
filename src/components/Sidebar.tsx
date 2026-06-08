import { useState, useEffect } from 'react';
import { Truck, LayoutDashboard, Users, FileText, TruckIcon, BarChart3, ShieldAlert, Menu, X } from 'lucide-react';

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, emoji: '\uD83D\uDCCA' },
  { id: 'vendors', label: 'Vendors', icon: Users, emoji: '\uD83C\uDFE2' },
  { id: 'purchase-orders', label: 'Purchase Orders', icon: FileText, emoji: '\uD83D\uDCDD' },
  { id: 'delivery', label: 'Delivery', icon: TruckIcon, emoji: '\uD83D\uDE9A' },
  { id: 'scorecard', label: 'Scorecard', icon: BarChart3, emoji: '\uD83C\uDFAF' },
  { id: 'ai-risk', label: 'AI Risk', icon: ShieldAlert, emoji: '\uD83D\uDEE1\uFE0F' },
];

export default function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  function handleNav(page: string) {
    onNavigate(page);
    setMobileOpen(false);
  }

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  return (
    <>
      {/* Mobile top bar */}
      <div className="fixed top-0 left-0 right-0 h-12 bg-[#0a1628] z-[200] flex items-center px-4 md:hidden border-b border-blue-900/40">
        <button
          onClick={() => setMobileOpen(true)}
          className="relative z-2 text-slate-300 hover:text-white transition-colors"
          aria-label="Open navigation"
        >
          <Menu className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-2 ml-4">
          <Truck className="w-5 h-5 text-blue-400" />
          <span className="text-base font-bold text-white tracking-tight">
            <span className="text-blue-400">Procure</span>AI
          </span>
        </div>
      </div>

      {/* Overlay */}
      <div
        className={`fixed inset-0 bg-black/60 z-[150] md:hidden transition-opacity duration-300 ${
          mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setMobileOpen(false)}
      />

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-screen w-[220px] bg-[#0a1628] border-r border-blue-900/40 z-[100] flex flex-col transition-transform duration-300 ease-in-out ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-5 h-16 border-b border-blue-900/40">
          <div className="flex items-center gap-2">
            <Truck className="w-7 h-7 text-blue-400" />
            <span className="text-xl font-bold text-white tracking-tight">
              <span className="text-blue-400">Procure</span>AI
            </span>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="relative z-2 text-slate-400 hover:text-white md:hidden transition-colors"
            aria-label="Close navigation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const active = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNav(item.id)}
                className={`relative z-2 w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
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
