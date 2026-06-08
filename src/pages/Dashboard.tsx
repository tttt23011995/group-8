import { useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Users, FileText, AlertTriangle, Star, TrendingUp, TrendingDown } from 'lucide-react';
import { getVendors, getPurchaseOrders, getMonthlyPOData } from '../lib/data';
import { useAnimatedCounter } from '../lib/useAnimatedCounter';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  approved: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  shipped: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  delivered: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  overdue: 'bg-red-500/20 text-red-400 border-red-500/30',
};

interface KPICardProps {
  label: string;
  value: number;
  icon: typeof Users;
  gradient: string;
  trend: { direction: 'up' | 'down'; pct: number };
}

function KPICard({ label, value, icon: Icon, gradient, trend }: KPICardProps) {
  const animated = useAnimatedCounter(value);

  return (
    <div
      className="relative z-1 bg-navy-800 border border-blue-900/40 rounded-xl overflow-hidden transition-shadow duration-300 hover:shadow-lg hover:shadow-blue-900/20"
    >
      <div className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${gradient}`} />
      <div className="p-5 pl-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-400 font-medium">{label}</p>
            <p className="text-3xl font-bold text-white mt-1">{animated}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center">
              <Icon className="w-6 h-6 text-blue-400" />
            </div>
            <div className={`flex items-center gap-0.5 text-xs font-medium ${trend.direction === 'up' ? 'text-emerald-400' : 'text-red-400'}`}>
              {trend.direction === 'up' ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              <span>{trend.direction === 'up' ? '+' : '-'}{trend.pct}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const vendors = useMemo(() => getVendors(), []);
  const pos = useMemo(() => getPurchaseOrders(), []);
  const monthlyData = useMemo(() => getMonthlyPOData(), []);

  const totalVendors = vendors.length;
  const openPOs = pos.filter((p) => p.status !== 'delivered').length;
  const overdueDeliveries = pos.filter((p) => p.status === 'overdue').length;
  const avgScore = vendors.length
    ? Math.round(vendors.reduce((sum, v) => sum + v.score, 0) / vendors.length)
    : 0;

  const kpis: KPICardProps[] = [
    { label: 'Total Vendors', value: totalVendors, icon: Users, gradient: 'from-blue-400 to-blue-600', trend: { direction: 'up', pct: 12 } },
    { label: 'Open Purchase Orders', value: openPOs, icon: FileText, gradient: 'from-emerald-400 to-emerald-600', trend: { direction: 'up', pct: 8 } },
    { label: 'Overdue Deliveries', value: overdueDeliveries, icon: AlertTriangle, gradient: 'from-red-400 to-red-600', trend: { direction: 'down', pct: 5 } },
    { label: 'Avg Vendor Score', value: avgScore, icon: Star, gradient: 'from-orange-400 to-orange-600', trend: { direction: 'up', pct: 3 } },
  ];

  const chartData = {
    labels: monthlyData.months,
    datasets: [
      {
        label: 'PO Count',
        data: monthlyData.counts,
        backgroundColor: 'rgba(59, 130, 246, 0.6)',
        borderColor: 'rgba(59, 130, 246, 1)',
        borderWidth: 1,
        borderRadius: 6,
        barPercentage: 0.6,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: {
        display: true,
        text: 'Monthly PO Count',
        color: '#94a3b8',
        font: { size: 14, weight: 'bold' as const },
        padding: { bottom: 16 },
      },
    },
    scales: {
      x: {
        ticks: { color: '#64748b' },
        grid: { color: 'rgba(30, 58, 95, 0.5)' },
      },
      y: {
        beginAtZero: true,
        ticks: { color: '#64748b', stepSize: 2 },
        grid: { color: 'rgba(30, 58, 95, 0.5)' },
      },
    },
  };

  const chartFallback = (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-blue-900/40">
            {monthlyData.months.map((m) => (
              <th key={m} className="px-4 py-2 text-left text-slate-400 font-medium">{m}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {monthlyData.counts.map((c, i) => (
              <td key={i} className="px-4 py-2 text-white">{c}</td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <KPICard key={kpi.label} {...kpi} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="relative z-1 bg-navy-800 border border-blue-900/40 rounded-xl p-6">
          <div className="h-72">
            {typeof ChartJS !== 'undefined' ? (
              <Bar data={chartData} options={chartOptions} />
            ) : (
              <div>
                <h3 className="text-slate-400 font-bold text-sm mb-3">Monthly PO Count</h3>
                {chartFallback}
              </div>
            )}
          </div>
        </div>

        <div className="relative z-1 bg-navy-800 border border-blue-900/40 rounded-xl p-6">
          <h3 className="text-sm font-bold text-slate-400 mb-4">Recent Purchase Orders</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-blue-900/40">
                  <th className="px-3 py-2 text-left text-slate-500 font-medium">PO Number</th>
                  <th className="px-3 py-2 text-left text-slate-500 font-medium">Vendor</th>
                  <th className="px-3 py-2 text-left text-slate-500 font-medium hidden sm:table-cell">Date</th>
                  <th className="px-3 py-2 text-right text-slate-500 font-medium">Total</th>
                  <th className="px-3 py-2 text-left text-slate-500 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {pos.map((po) => (
                  <tr key={po.id} className="border-b border-blue-900/20 hover:bg-white/[0.02]">
                    <td className="px-3 py-2.5 text-white font-mono text-xs">{po.poNumber}</td>
                    <td className="px-3 py-2.5 text-slate-300">{po.vendorName}</td>
                    <td className="px-3 py-2.5 text-slate-400 hidden sm:table-cell">{po.date}</td>
                    <td className="px-3 py-2.5 text-right text-slate-300">
                      ${po.total.toLocaleString()}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusColors[po.status] || 'bg-slate-500/20 text-slate-400 border-slate-500/30'}`}
                      >
                        {po.status.charAt(0).toUpperCase() + po.status.slice(1)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
