import { useState, useEffect } from 'react';
import { Chart } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  BarController,
  LineElement,
  LineController,
  PointElement,
  ArcElement,
  DoughnutController,
  PieController,
  RadarController,
  RadialLinearScale,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Users, FileText, AlertTriangle, Star, TrendingUp, TrendingDown } from 'lucide-react';
import { getVendors, getPurchaseOrders, getChartData, Vendor, PurchaseOrder } from '../lib/data';
import { useAnimatedCounter } from '../lib/useAnimatedCounter';
import { useRefresh } from '../lib/RefreshContext';
import { useTheme } from '../lib/ThemeContext';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  BarController,
  LineElement,
  LineController,
  PointElement,
  ArcElement,
  DoughnutController,
  PieController,
  RadarController,
  RadialLinearScale,
  Title,
  Tooltip,
  Legend,
  Filler,
);

function isOverdue(po: PurchaseOrder): boolean {
  if (po.status === 'delivered' || po.status === 'invoiced') return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deliveryDate = new Date(po.deliveryDate);
  deliveryDate.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - deliveryDate.getTime()) / 86400000) > 0;
}

const statusColors: Record<string, string> = {
  Ordered: 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-500/30',
  pending: 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-300 dark:border-yellow-500/30',
  approved: 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-500/30',
  shipped: 'bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-400 border-cyan-300 dark:border-cyan-500/30',
  delivered: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-500/30',
  overdue: 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 border-red-300 dark:border-red-500/30',
};

type RangeOption = '3M' | '6M' | '12M';
const rangeMonths: Record<RangeOption, number> = { '3M': 3, '6M': 6, '12M': 12 };

interface KPICardProps {
  label: string;
  mobileLabel: string;
  value: number;
  icon: typeof Users;
  borderColor: string;
  trend: { direction: 'up' | 'down'; pct: number };
}

function KPICard({ label, mobileLabel, value, icon: Icon, borderColor, trend }: KPICardProps) {
  const animated = useAnimatedCounter(value);

  return (
    <div className="kpi-card theme-card overflow-hidden transition-shadow duration-300 hover:shadow-lg" style={{ borderLeft: '4px solid', borderLeftColor: borderColor }}>
      <div className="kpi-inner p-5 pl-6">
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1 pr-2">
            <p className="kpi-label text-sm theme-muted font-medium truncate md:hidden">{mobileLabel}</p>
            <p className="kpi-label text-sm theme-muted font-medium truncate hidden md:block">{label}</p>
            <p className="kpi-value text-3xl font-bold theme-title mt-1">{animated}</p>
          </div>
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <div className="w-12 h-12 rounded-lg bg-surface flex items-center justify-center">
              <Icon className="w-6 h-6 text-accent" />
            </div>
            <div className={`flex items-center gap-0.5 text-xs font-medium ${trend.direction === 'up' ? 'text-success' : 'text-danger'}`}>
              {trend.direction === 'up' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              <span>{trend.direction === 'up' ? '+' : '-'}{trend.pct}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [range, setRange] = useState<RangeOption>('6M');
  const [chartPayload, setChartPayload] = useState<{ months: string[]; counts: number[]; spends: number[]; availableMonths: number }>({ months: [], counts: [], spends: [], availableMonths: 0 });
  const { refreshKey } = useRefresh();
  const { theme } = useTheme();

  useEffect(() => {
    getVendors().then(setVendors).catch(() => {});
    getPurchaseOrders().then(setPos).catch(() => {});
  }, [refreshKey]);

  useEffect(() => {
    getChartData(rangeMonths[range]).then(setChartPayload).catch(() => {});
  }, [range, refreshKey]);
  const showAvailableNote = chartPayload.availableMonths < rangeMonths[range];

  const totalVendors = vendors.length;
  const openPOs = pos.filter((p) => p.status !== 'delivered').length;
  const overdueDeliveries = pos.filter(isOverdue).length;
  const avgScore = vendors.length
    ? Math.round(vendors.reduce((sum, v) => sum + v.score, 0) / vendors.length)
    : 0;

  const kpis: KPICardProps[] = [
    { label: 'Total Vendors', mobileLabel: 'Vendors', value: totalVendors, icon: Users, borderColor: '#3b82f6', trend: { direction: 'up', pct: 12 } },
    { label: 'Open Purchase Orders', mobileLabel: 'Open POs', value: openPOs, icon: FileText, borderColor: '#22c55e', trend: { direction: 'up', pct: 8 } },
    { label: 'Overdue Deliveries', mobileLabel: 'Overdue', value: overdueDeliveries, icon: AlertTriangle, borderColor: '#ef4444', trend: { direction: 'down', pct: 5 } },
    { label: 'Avg Vendor Score', mobileLabel: 'Avg Score', value: avgScore, icon: Star, borderColor: '#f97316', trend: { direction: 'up', pct: 3 } },
  ];

  const chartData = {
    labels: chartPayload.months,
    datasets: [
      {
        type: 'bar' as const,
        label: 'PO Count',
        data: chartPayload.counts,
        backgroundColor: theme === 'dark' ? 'rgba(59, 130, 246, 0.55)' : 'rgba(59, 130, 246, 0.7)',
        borderColor: 'rgba(59, 130, 246, 1)',
        borderWidth: 1,
        borderRadius: 6,
        barPercentage: 0.6,
        categoryPercentage: 0.8,
        yAxisID: 'y',
      },
      {
        type: 'line' as const,
        label: 'Total Spend ($)',
        data: chartPayload.spends,
        borderColor: '#f97316',
        backgroundColor: theme === 'dark' ? 'rgba(249, 115, 22, 0.12)' : 'rgba(249, 115, 22, 0.15)',
        borderWidth: 2,
        pointBackgroundColor: '#f97316',
        pointRadius: 4,
        pointHoverRadius: 6,
        tension: 0.35,
        fill: false,
        yAxisID: 'y1',
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
    plugins: {
      legend: {
        display: true,
        labels: {
          color: theme === 'dark' ? '#94a3b8' : '#64748b',
          usePointStyle: true,
          pointStyle: 'circle' as const,
          font: { size: 11 },
          padding: 16,
        },
      },
      title: {
        display: true,
        text: 'Monthly PO Activity',
        color: theme === 'dark' ? '#fff' : '#0f172a',
        font: { size: 14, weight: 'bold' as const },
        padding: { bottom: 12 },
      },
      tooltip: {
        backgroundColor: theme === 'dark' ? '#0f2244' : '#ffffff',
        borderColor: theme === 'dark' ? 'rgba(59, 130, 246, 0.3)' : 'rgba(59, 130, 246, 0.2)',
        borderWidth: 1,
        titleColor: theme === 'dark' ? '#e2e8f0' : '#0f172a',
        bodyColor: theme === 'dark' ? '#94a3b8' : '#64748b',
        padding: 10,
        callbacks: {
          label: (ctx: { dataset: { label?: string }; parsed: { y: number | null } }) => {
            const yVal = ctx.parsed.y ?? 0;
            if (ctx.dataset.label === 'Total Spend ($)') {
              return ` Spend: $${yVal.toLocaleString()}`;
            }
            return ` PO Count: ${yVal}`;
          },
        },
      },
    },
    scales: {
      x: {
        ticks: { color: theme === 'dark' ? '#64748b' : '#94a3b8', maxTicksLimit: 6, maxRotation: 0, autoSkip: true },
        grid: { color: theme === 'dark' ? 'rgba(30, 58, 95, 0.5)' : 'rgba(148, 163, 184, 0.3)' },
      },
      y: {
        beginAtZero: true,
        position: 'left' as const,
        ticks: { color: theme === 'dark' ? '#64748b' : '#94a3b8', stepSize: 2 },
        grid: { color: theme === 'dark' ? 'rgba(30, 58, 95, 0.5)' : 'rgba(148, 163, 184, 0.3)' },
        title: { display: true, text: 'PO Count', color: theme === 'dark' ? '#64748b' : '#94a3b8', font: { size: 10 } },
      },
      y1: {
        beginAtZero: true,
        position: 'right' as const,
        ticks: {
          color: '#f97316',
          callback: (value: number | string) => `$${Number(value).toLocaleString()}`,
        },
        grid: { drawOnChartArea: false },
        title: { display: true, text: 'Spend ($)', color: '#f97316', font: { size: 10 } },
      },
    },
  };

  const fallbackTable = (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-themed">
            <th className="px-4 py-2 text-left theme-muted font-medium">Month</th>
            <th className="px-4 py-2 text-right theme-muted font-medium">PO Count</th>
            <th className="px-4 py-2 text-right theme-muted font-medium">Total Spend</th>
          </tr>
        </thead>
        <tbody>
          {chartPayload.months.map((m, i) => (
            <tr key={m} className="border-b border-themed">
              <td className="px-4 py-2 theme-text">{m}</td>
              <td className="px-4 py-2 text-right theme-title">{chartPayload.counts[i]}</td>
              <td className="px-4 py-2 text-right text-orange-500">${chartPayload.spends[i].toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* KPI grid: 2-col on mobile, 4-col on lg */}
      <div className="kpi-grid grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {kpis.map((kpi) => (
          <KPICard key={kpi.label} {...kpi} />
        ))}
      </div>

      <div className="flex flex-col gap-6">
        {/* Chart panel */}
        <div className="relative z-1 theme-card p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-1.5">
              {(['3M', '6M', '12M'] as RangeOption[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  style={{ minHeight: 32, fontSize: 12, position: 'relative', zIndex: 2, pointerEvents: 'auto' }}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                    range === r
                      ? 'bg-accent text-white'
                      : 'bg-surface theme-muted hover:theme-text border border-themed'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          {/* chart-wrapper: overflow-hidden prevents horizontal bleed */}
          <div className="chart-wrapper w-full overflow-hidden md:h-[320px]">
            {typeof ChartJS !== 'undefined' ? (
              <Chart type="bar" data={chartData} options={chartOptions} />
            ) : (
              <div>
                <h3 className="theme-muted font-bold text-sm mb-3">Monthly PO Activity</h3>
                {fallbackTable}
              </div>
            )}
          </div>
          {showAvailableNote && (
            <p className="text-center mt-2 text-xs theme-muted">
              Showing available data only
            </p>
          )}
        </div>

        {/* Recent orders panel */}
        <div className="relative z-1 theme-card p-4 sm:p-6">
          <h3 className="text-sm font-bold theme-muted mb-4" style={{ fontSize: 15 }}>Recent Purchase Orders</h3>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-themed">
                  <th className="px-3 py-2 text-left theme-muted font-medium">PO Number</th>
                  <th className="px-3 py-2 text-left theme-muted font-medium">Vendor</th>
                  <th className="px-3 py-2 text-left theme-muted font-medium">Date</th>
                  <th className="px-3 py-2 text-right theme-muted font-medium">Total</th>
                  <th className="px-3 py-2 text-left theme-muted font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {pos.map((po) => (
                  <tr key={po.id} className="border-b border-themed hover:bg-surface">
                    <td className="px-3 py-2.5 theme-title font-mono text-xs whitespace-nowrap">{po.poNumber}</td>
                    <td className="px-3 py-2.5 theme-text">{po.vendorName}</td>
                    <td className="px-3 py-2.5 theme-muted">{po.date}</td>
                    <td className="px-3 py-2.5 text-right theme-text">${po.total.toLocaleString()}</td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusColors[po.status] || 'bg-slate-100 dark:bg-slate-500/20 text-slate-700 dark:text-slate-400 border-slate-300 dark:border-slate-500/30'}`}>
                        {po.status.charAt(0).toUpperCase() + po.status.slice(1)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <div className="block md:hidden space-y-0">
            {pos.map((po) => (
              <div
                key={po.id}
                className="theme-panel p-3.5 mb-2.5"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-accent font-bold text-[13px] font-mono">
                    {po.poNumber}
                  </span>
                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusColors[po.status] || 'bg-slate-100 dark:bg-slate-500/20 text-slate-700 dark:text-slate-400 border-slate-300 dark:border-slate-500/30'}`}>
                    {po.status.charAt(0).toUpperCase() + po.status.slice(1)}
                  </span>
                </div>
                <p className="theme-title text-sm font-medium mb-1.5">
                  {po.vendorName}
                </p>
                <div className="flex items-center justify-between">
                  <span className="theme-muted text-xs">{po.date}</span>
                  <span className="theme-title font-semibold text-[13px]">
                    ${po.total.toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
