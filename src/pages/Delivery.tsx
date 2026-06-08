import { useMemo, useState } from 'react';
import { Package, Clock, CheckCircle, AlertTriangle, TruckIcon } from 'lucide-react';
import { getPurchaseOrders } from '../lib/data';

const statusIcons: Record<string, typeof Package> = {
  pending: Clock,
  approved: Clock,
  shipped: TruckIcon,
  delivered: CheckCircle,
  overdue: AlertTriangle,
};

const statusColors: Record<string, string> = {
  pending: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  approved: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  shipped: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
  delivered: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  overdue: 'text-red-400 bg-red-500/10 border-red-500/20',
};

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const now = new Date();
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export default function Delivery() {
  const pos = useMemo(() => getPurchaseOrders(), []);
  const [filter, setFilter] = useState<string>('all');

  const deliveries = pos
    .filter((po) => po.status !== 'delivered')
    .map((po) => ({
      ...po,
      daysLeft: daysUntil(po.deliveryDate),
    }))
    .sort((a, b) => a.daysLeft - b.daysLeft);

  const filtered = filter === 'all' ? deliveries : deliveries.filter((d) => d.status === filter);

  const stats = useMemo(() => {
    const shipped = pos.filter((p) => p.status === 'shipped').length;
    const overdue = pos.filter((p) => p.status === 'overdue').length;
    const pending = pos.filter((p) => p.status === 'pending' || p.status === 'approved').length;
    const delivered = pos.filter((p) => p.status === 'delivered').length;
    return { shipped, overdue, pending, delivered };
  }, [pos]);

  const statCards = [
    { label: 'In Transit', value: stats.shipped, icon: TruckIcon, color: 'text-cyan-400' },
    { label: 'Overdue', value: stats.overdue, icon: AlertTriangle, color: 'text-red-400' },
    { label: 'Pending', value: stats.pending, icon: Clock, color: 'text-yellow-400' },
    { label: 'Delivered', value: stats.delivered, icon: CheckCircle, color: 'text-emerald-400' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Delivery Tracking</h1>
        <p className="text-slate-400 text-sm mt-1">Track and manage incoming deliveries</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.label}
              className="relative z-1 bg-navy-800 border border-blue-900/40 rounded-xl p-4 flex items-center gap-3"
            >
              <Icon className={`w-8 h-8 ${s.color}`} />
              <div>
                <p className="text-2xl font-bold text-white">{s.value}</p>
                <p className="text-xs text-slate-400">{s.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        {['all', 'pending', 'approved', 'shipped', 'overdue'].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`relative z-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === s
                ? 'bg-blue-600 text-white'
                : 'bg-navy-700 text-slate-400 hover:text-white border border-blue-900/40'
            }`}
          >
            {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map((d) => {
          const Icon = statusIcons[d.status] || Package;
          const color = statusColors[d.status] || 'text-slate-400 bg-slate-500/10 border-slate-500/20';
          const isOverdue = d.daysLeft < 0;
          return (
            <div
              key={d.id}
              className={`relative z-1 rounded-xl p-5 border ${color}`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <Icon className="w-5 h-5 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-white font-semibold">{d.poNumber}</span>
                      <span className="text-sm opacity-70">{d.vendorName}</span>
                    </div>
                    <p className="text-xs opacity-60 mt-1">{d.items}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <div className="text-right">
                    <p className="opacity-60 text-xs">Delivery Date</p>
                    <p className="font-medium">{d.deliveryDate}</p>
                  </div>
                  <div className="text-right min-w-[80px]">
                    <p className="opacity-60 text-xs">{isOverdue ? 'Overdue by' : 'ETA'}</p>
                    <p className={`font-bold ${isOverdue ? 'text-red-300' : ''}`}>
                      {isOverdue ? `${Math.abs(d.daysLeft)}d` : `${d.daysLeft}d`}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="relative z-1 text-center py-12 text-slate-500">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No deliveries matching this filter</p>
          </div>
        )}
      </div>
    </div>
  );
}
