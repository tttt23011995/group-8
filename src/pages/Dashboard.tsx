import { useMemo, useState, useEffect } from 'react';
import { Chart } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Users, FileText, AlertTriangle, Star, TrendingUp, TrendingDown } from 'lucide-react';
import { getVendors, getPurchaseOrders, getChartData, Vendor, PurchaseOrder } from '../lib/data';
import { useAnimatedCounter } from '../lib/useAnimatedCounter';
import { useRefresh } from '../lib/RefreshContext';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend);

const statusColors: Record<string, string> = {
  Ordered: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  approved: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  shipped: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  delivered: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  overdue: 'bg-red-500/20 text-red-400 border-red-500/30',
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
    <div className="kpi-card relative bg-navy-800 border border-blue-900/40 rounded-xl overflow-hidden transition-shadow duration-300 hover:shadow-lg hover:shadow-blue-900/20" style={{ borderLeft: '4px solid', borderLeftColor: borderColor }}>
      <div className="kpi-inner p-5 pl-6">
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1 pr-2">
            <p className="kpi-label text-sm text-slate-400 font-medium truncate md:hidden">{mobileLabel}</p>
            <p className="kpi-label text-sm text-slate-400 font-medium truncate hidden md:block">{label}</p>
            <p className="kpi-value text-3xl font-bold text-white mt-1">{animated}</p>
          </div>
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <div className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center">
              <Icon className="w-6 h-6 text-blue-400" />
            </div>
            <div className={`flex items-center gap-0.5 text-xs font-medium ${trend.direction === 'up' ? 'text-emerald-400' : 'text-red-400'}`}>
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
  const overdueDeliveries = pos.filter((p) => p.status === 'overdue').length;
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
        backgroundColor: 'rgba(59, 130, 246, 0.55)',
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
        backgroundColor: 'rgba(249, 115, 22, 0.12)',
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
          color: '#94a3b8',
          usePointStyle: true,
          pointStyle: 'circle' as const,
          font: { size: 11 },
          padding: 16,
        },
      },
      title: {
        display: true,
        text: 'Monthly PO Activity',
        color: '#fff',
        font: { size: 14, weight: 'bold' as const },
        padding: { bottom: 12 },
      },
      tooltip: {
        backgroundColor: '#0f2244',
        borderColor: 'rgba(59, 130, 246, 0.3)',
        borderWidth: 1,
        titleColor: '#e2e8f0',
        bodyColor: '#94a3b8',
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
        ticks: { color: '#64748b', maxTicksLimit: 6, maxRotation: 0, autoSkip: true },
        grid: { color: 'rgba(30, 58, 95, 0.5)' },
      },
      y: {
        beginAtZero: true,
        position: 'left' as const,
        ticks: { color: '#64748b', stepSize: 2 },
        grid: { color: 'rgba(30, 58, 95, 0.5)' },
        title: { display: true, text: 'PO Count', color: '#64748b', font: { size: 10 } },
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
          <tr className="border-b border-blue-900/40">
            <th className="px-4 py-2 text-left text-slate-400 font-medium">Month</th>
            <th className="px-4 py-2 text-right text-slate-400 font-medium">PO Count</th>
            <th className="px-4 py-2 text-right text-slate-400 font-medium">Total Spend</th>
          </tr>
        </thead>
        <tbody>
          {chartPayload.months.map((m, i) => (
            <tr key={m} className="border-b border-blue-900/20">
              <td className="px-4 py-2 text-slate-300">{m}</td>
              <td className="px-4 py-2 text-right text-white">{chartPayload.counts[i]}</td>
              <td className="px-4 py-2 text-right text-orange-400">${chartPayload.spends[i].toLocaleString()}</td>
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
        <div className="relative z-1 bg-navy-800 border border-blue-900/40 rounded-xl p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-1.5">
              {(['3M', '6M', '12M'] as RangeOption[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  style={{ minHeight: 32, fontSize: 12, position: 'relative', zIndex: 2, pointerEvents: 'auto' }}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                    range === r
                      ? 'bg-blue-600 text-white'
                      : 'bg-navy-700 text-slate-400 hover:text-white border border-blue-900/40'
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
                <h3 className="text-slate-400 font-bold text-sm mb-3">Monthly PO Activity</h3>
                {fallbackTable}
              </div>
            )}
          </div>
          {showAvailableNote && (
            <p className="text-center mt-2" style={{ fontSize: 11, color: '#94a3b8' }}>
              Showing available data only
            </p>
          )}
        </div>

        {/* Recent orders panel */}
        <div className="relative z-1 bg-navy-800 border border-blue-900/40 rounded-xl p-4 sm:p-6">
          <h3 className="text-sm font-bold text-slate-400 mb-4" style={{ fontSize: 15 }}>Recent Purchase Orders</h3>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-blue-900/40">
                  <th className="px-3 py-2 text-left text-slate-500 font-medium">PO Number</th>
                  <th className="px-3 py-2 text-left text-slate-500 font-medium">Vendor</th>
                  <th className="px-3 py-2 text-left text-slate-500 font-medium">Date</th>
                  <th className="px-3 py-2 text-right text-slate-500 font-medium">Total</th>
                  <th className="px-3 py-2 text-left text-slate-500 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {pos.map((po) => (
                  <tr key={po.id} className="border-b border-blue-900/20 hover:bg-white/[0.02]">
                    <td className="px-3 py-2.5 text-white font-mono text-xs whitespace-nowrap">{po.poNumber}</td>
                    <td className="px-3 py-2.5 text-slate-300">{po.vendorName}</td>
                    <td className="px-3 py-2.5 text-slate-400">{po.date}</td>
                    <td className="px-3 py-2.5 text-right text-slate-300">${po.total.toLocaleString()}</td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusColors[po.status] || 'bg-slate-500/20 text-slate-400 border-slate-500/30'}`}>
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
                style={{
                  background: '#0f2244',
                  borderRadius: 10,
                  padding: 14,
                  marginBottom: 10,
                  position: 'relative',
                  zIndex: 1,
                }}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span style={{ color: '#3b82f6', fontWeight: 700, fontSize: 13, fontFamily: 'monospace' }}>
                    {po.poNumber}
                  </span>
                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusColors[po.status] || 'bg-slate-500/20 text-slate-400 border-slate-500/30'}`}>
                    {po.status.charAt(0).toUpperCase() + po.status.slice(1)}
                  </span>
                </div>
                <p style={{ color: '#ffffff', fontSize: 14, fontWeight: 500, marginBottom: 6 }}>
                  {po.vendorName}
                </p>
                <div className="flex items-center justify-between">
                  <span style={{ color: '#94a3b8', fontSize: 12 }}>{po.date}</span>
                  <span style={{ color: '#ffffff', fontWeight: 600, fontSize: 13 }}>
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
