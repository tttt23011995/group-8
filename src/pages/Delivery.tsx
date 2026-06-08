import { useMemo, useState, useCallback } from 'react';
import { Chart } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  LineElement,
  PointElement,
  Filler,
  ArcElement,
} from 'chart.js';
import {
  Package,
  Clock,
  Truck as TruckIcon,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  FileText,
  Search,
  ChevronDown,
  Check,
  X as XIcon,
  MessageSquare,
  ShieldAlert,
  TrendingUp,
  TrendingDown,
  Users,
  Lightbulb,
  Target,
  Info,
  Activity,
} from 'lucide-react';
import {
  getPurchaseOrders,
  savePurchaseOrders,
  getDeliveryPerformance,
  saveDeliveryPerformance,
  PurchaseOrder,
  DeliveryPerformance,
  DeliveryNote,
} from '../lib/data';
import {
  buildSupplierRiskData,
  SupplierMetrics,
  SupplierRisk,
  SupplierRiskEntry,
} from '../lib/supplierRisk';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend, Filler, ArcElement);

const STATUS_ORDER: PurchaseOrder['status'][] = [
  'ordered',
  'confirmed',
  'in-transit',
  'delivered',
  'invoiced',
];

const statusMeta: Record<string, { label: string; icon: typeof Clock; color: string; bg: string; dot: string }> = {
  ordered:      { label: 'Ordered',    icon: Clock,      color: 'text-blue-400',    bg: 'bg-blue-500/15 border-blue-500/25',    dot: 'bg-blue-400' },
  confirmed:    { label: 'Confirmed',  icon: CheckCircle, color: 'text-violet-400', bg: 'bg-violet-500/15 border-violet-500/25', dot: 'bg-violet-400' },
  'in-transit': { label: 'In Transit', icon: TruckIcon,  color: 'text-amber-400',  bg: 'bg-amber-500/15 border-amber-500/25',  dot: 'bg-amber-400' },
  delivered:    { label: 'Delivered',   icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/15 border-emerald-500/25', dot: 'bg-emerald-400' },
  invoiced:     { label: 'Invoiced',   icon: FileText,    color: 'text-slate-400',   bg: 'bg-slate-500/15 border-slate-500/25',   dot: 'bg-slate-400' },
};

const ganttStatusColors: Record<string, string> = {
  ordered:    'rgba(148, 163, 184, 0.7)',   // grey
  confirmed:  'rgba(59, 130, 246, 0.7)',    // blue
  'in-transit': 'rgba(234, 179, 8, 0.7)',   // yellow
  delivered:  'rgba(34, 197, 94, 0.7)',     // green
  overdue:    'rgba(239, 68, 68, 0.7)',     // red
};

const ganttBorderColors: Record<string, string> = {
  ordered:    'rgba(148, 163, 184, 1)',
  confirmed:  'rgba(59, 130, 246, 1)',
  'in-transit': 'rgba(234, 179, 8, 1)',
  delivered:  'rgba(34, 197, 94, 1)',
  overdue:    'rgba(239, 68, 68, 1)',
};

function formatNoteTimestamp(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

type SortOption = 'earliest' | 'overdue' | 'vendor' | 'status';

const sortLabels: Record<SortOption, string> = {
  earliest: 'Earliest Expected Date',
  overdue: 'Most Overdue First',
  vendor: 'Vendor A-Z',
  status: 'Status',
};

function isOverdue(po: PurchaseOrder): boolean {
  const idx = STATUS_ORDER.indexOf(po.status);
  if (idx >= STATUS_ORDER.indexOf('delivered')) return false;
  const deliveryDate = new Date(po.deliveryDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  deliveryDate.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - deliveryDate.getTime()) / 86400000) > 0;
}

function daysOverdue(po: PurchaseOrder): number {
  const deliveryDate = new Date(po.deliveryDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  deliveryDate.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - deliveryDate.getTime()) / 86400000);
}

function daysUntilDelivery(po: PurchaseOrder): number {
  const deliveryDate = new Date(po.deliveryDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  deliveryDate.setHours(0, 0, 0, 0);
  return Math.ceil((deliveryDate.getTime() - today.getTime()) / 86400000);
}

function calcDeliveryPerformance(po: PurchaseOrder & { actualDeliveryDate?: string }): DeliveryPerformance | null {
  const idx = STATUS_ORDER.indexOf(po.status);
  if (idx < STATUS_ORDER.indexOf('delivered')) return null;
  if (!po.actualDeliveryDate) return null;
  const actual = new Date(po.actualDeliveryDate);
  const expected = new Date(po.deliveryDate);
  actual.setHours(0, 0, 0, 0);
  expected.setHours(0, 0, 0, 0);
  const diff = Math.floor((actual.getTime() - expected.getTime()) / 86400000);
  return { onTime: diff <= 0, daysDifference: diff };
}

function GanttTimeline({ pos }: { pos: PurchaseOrder[] }) {
  if (pos.length < 2) {
    return (
      <div className="relative z-1 bg-navy-800 border border-blue-900/40 rounded-xl p-8 text-center">
        <p className="text-slate-500 text-sm">Not enough data for timeline chart</p>
      </div>
    );
  }

  const recent = [...pos]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 10);

  const labels = recent.map((po) => `${po.poNumber} — ${po.vendorName}`);

  const allDates = recent.flatMap((po) => [new Date(po.date), new Date(po.deliveryDate)]);
  const minDate = new Date(Math.min(...allDates.map((d) => d.getTime())));
  const maxDate = new Date(Math.max(...allDates.map((d) => d.getTime())));
  minDate.setDate(minDate.getDate() - 2);
  maxDate.setDate(maxDate.getDate() + 2);
  const minMs = minDate.getTime();
  const maxMs = maxDate.getTime();
  const rangeMs = maxMs - minMs || 1;

  const barData = recent.map((po) => {
    const start = new Date(po.date).getTime();
    const end = new Date(po.deliveryDate).getTime();
    const barStart = ((start - minMs) / rangeMs) * 100;
    const barWidth = ((end - start) / rangeMs) * 100;
    const isOd = isOverdue(po);
    const colorKey = isOd ? 'overdue' : po.status;
    return { barStart, barWidth, colorKey };
  });

  const datasets = [
    {
      label: 'Delivery Window',
      data: barData.map((b) => [b.barStart, b.barStart + b.barWidth]),
      backgroundColor: barData.map((b) => ganttStatusColors[b.colorKey]),
      borderColor: barData.map((b) => ganttBorderColors[b.colorKey]),
      borderWidth: 1,
      borderRadius: 4,
      barPercentage: 0.7,
      categoryPercentage: 0.85,
    },
  ];

  const todayPct = ((Date.now() - minMs) / rangeMs) * 100;

  const chartData = { labels, datasets };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const todayLinePlugin: any = {
    id: 'todayLine',
    afterDraw(chart: any) {
      const ctx = chart.ctx;
      const xScale = chart.scales.x;
      const xPx = xScale.getPixelForValue(todayPct);
      const { top, bottom } = chart.chartArea;
      ctx.save();
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.8)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 3]);
      ctx.beginPath();
      ctx.moveTo(xPx, top);
      ctx.lineTo(xPx, bottom);
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
      ctx.font = 'bold 10px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Today', xPx, top - 4);
      ctx.restore();
    },
  };

  const options = {
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: {
        display: true,
        text: 'Delivery Timeline — Last 10 Orders',
        color: '#fff',
        font: { size: 14, weight: 'bold' as const },
        padding: { bottom: 16 },
      },
      tooltip: {
        backgroundColor: '#0f2244',
        borderColor: 'rgba(59, 130, 246, 0.3)',
        borderWidth: 1,
        titleColor: '#e2e8f0',
        bodyColor: '#94a3b8',
        callbacks: {
          label: (ctx: { raw: number[]; label?: string }) => {
            const [startPct, endPct] = ctx.raw;
            const startMs = minMs + (startPct / 100) * rangeMs;
            const endMs = minMs + (endPct / 100) * rangeMs;
            const startStr = new Date(startMs).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const endStr = new Date(endMs).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            return ` ${startStr} → ${endStr}`;
          },
        },
      },
    },
    scales: {
      x: {
        min: 0,
        max: 100,
        ticks: {
          callback: (value: number | string) => {
            const ms = minMs + (Number(value) / 100) * rangeMs;
            return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          },
          color: '#64748b',
          maxTicksLimit: 8,
        },
        grid: { color: 'rgba(30, 58, 95, 0.5)' },
      },
      y: {
        ticks: { color: '#94a3b8', font: { size: 11 } },
        grid: { display: false },
      },
    },
  };

  return (
    <div className="relative z-1 bg-navy-800 border border-blue-900/40 rounded-xl p-4 sm:p-6">
      <div className="h-[280px] sm:h-[340px]">
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <Chart type="bar" data={chartData as any} options={options as any} plugins={[todayLinePlugin]} />
      </div>
    </div>
  );
}

function DeliveryNotesPanel({
  po,
  onSave,
}: {
  po: PurchaseOrder;
  onSave: (poId: string, notes: DeliveryNote[]) => void;
}) {
  const [noteText, setNoteText] = useState('');
  const notes = po.deliveryNotes || [];

  function handleSave() {
    const trimmed = noteText.trim();
    if (!trimmed) return;
    const newNotes: DeliveryNote[] = [...notes, { timestamp: new Date().toISOString(), text: trimmed }];
    onSave(po.id, newNotes);
    setNoteText('');
  }

  return (
    <div className="mt-4 pt-4 border-t border-blue-900/30">
      <div className="space-y-2 mb-3">
        {notes.length === 0 ? (
          <p className="text-xs text-slate-600 italic">No notes yet</p>
        ) : (
          notes.map((note, i) => (
            <div key={i} className="bg-navy-700/50 rounded-lg p-3">
              <p className="text-[10px] text-slate-500 mb-1">{formatNoteTimestamp(note.timestamp)}</p>
              <p className="text-sm text-slate-300">{note.text}</p>
            </div>
          ))
        )}
      </div>
      <div className="flex gap-2">
        <textarea
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          placeholder="Add a delivery note..."
          className="flex-1 px-3 py-2 bg-navy-700 border border-blue-900/40 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-none"
          rows={2}
        />
        <button
          onClick={handleSave}
          disabled={!noteText.trim()}
          className="relative z-2 self-end px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg transition-colors"
        >
          Save Note
        </button>
      </div>
    </div>
  );
}

// ── Risk helpers ──────────────────────────────────────────────────────────

function riskConfig(level: 'Low' | 'Medium' | 'High') {
  switch (level) {
    case 'High':
      return {
        bg: 'bg-red-500/10 border-red-500/25',
        badgeBg: 'bg-red-500/20 text-red-400 border-red-500/30',
        bar: 'bg-red-500',
        barTrack: 'bg-red-500/20',
        text: 'text-red-400',
        headerBg: 'bg-red-500/10 border-red-500/20',
        icon: AlertTriangle,
      };
    case 'Medium':
      return {
        bg: 'bg-yellow-500/10 border-yellow-500/25',
        badgeBg: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
        bar: 'bg-yellow-500',
        barTrack: 'bg-yellow-500/20',
        text: 'text-yellow-400',
        headerBg: 'bg-yellow-500/10 border-yellow-500/20',
        icon: TrendingDown,
      };
    case 'Low':
      return {
        bg: 'bg-emerald-500/10 border-emerald-500/25',
        badgeBg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
        bar: 'bg-emerald-500',
        barTrack: 'bg-emerald-500/20',
        text: 'text-emerald-400',
        headerBg: 'bg-emerald-500/10 border-emerald-500/20',
        icon: TrendingUp,
      };
  }
}

function RiskTypeBadge({ label }: { label: string }) {
  const colorMap: Record<string, string> = {
    'Delivery Delay Risk': 'bg-red-500/15 text-red-400 border-red-500/25',
    'Lead Time Risk': 'bg-orange-500/15 text-orange-400 border-orange-500/25',
    'Supplier Dependency Risk': 'bg-violet-500/15 text-violet-400 border-violet-500/25',
    'Cost Concentration Risk': 'bg-amber-500/15 text-amber-400 border-amber-500/25',
    'Supplier Performance Risk': 'bg-blue-500/15 text-blue-400 border-blue-500/25',
  };
  const cls = colorMap[label] ?? 'bg-slate-500/15 text-slate-400 border-slate-500/25';
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold border ${cls}`}>
      {label}
    </span>
  );
}

// ── Supplier Risk Dashboard Components ─────────────────────────────────────

interface RiskDashboardData {
  totalVendors: number;
  highRiskVendors: number;
  mediumRiskVendors: number;
  lowRiskVendors: number;
  avgRiskScore: number;
  lateDeliveryRate: number;
  overduePOs: number;
}

function computeRiskDashboardData(
  riskData: SupplierRiskEntry[],
  pos: PurchaseOrder[]
): RiskDashboardData {
  const totalVendors = riskData.length;
  const highRiskVendors = riskData.filter(r => r.risk.overallRiskScore >= 70).length;
  const mediumRiskVendors = riskData.filter(r => r.risk.overallRiskScore >= 40 && r.risk.overallRiskScore < 70).length;
  const lowRiskVendors = riskData.filter(r => r.risk.overallRiskScore < 40).length;

  const avgRiskScore = riskData.length > 0
    ? Math.round(riskData.reduce((s, r) => s + r.risk.overallRiskScore, 0) / riskData.length)
    : 0;

  const delivered = pos.filter(p => p.status === 'delivered' || p.status === 'invoiced');
  const perfMap = getDeliveryPerformance();
  let lateCount = 0;
  delivered.forEach(po => {
    const perf = perfMap[po.id];
    if (perf && !perf.onTime) lateCount++;
  });
  const lateDeliveryRate = delivered.length > 0 ? Math.round((lateCount / delivered.length) * 100) : 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const overduePOs = pos.filter(po => {
    if (po.status === 'delivered' || po.status === 'invoiced') return false;
    const deliveryDate = new Date(po.deliveryDate);
    deliveryDate.setHours(0, 0, 0, 0);
    return deliveryDate < today;
  }).length;

  return {
    totalVendors,
    highRiskVendors,
    mediumRiskVendors,
    lowRiskVendors,
    avgRiskScore,
    lateDeliveryRate,
    overduePOs
  };
}

// 1. KPI Cards Component
function RiskKPICards({ data }: { data: RiskDashboardData }) {
  const kpis = [
    {
      label: 'Total Vendors',
      mobileLabel: 'Vendors',
      value: data.totalVendors,
      icon: Users,
      borderColor: '#3b82f6',
    },
    {
      label: 'High Risk Vendors',
      mobileLabel: 'High Risk',
      value: data.highRiskVendors,
      icon: AlertTriangle,
      borderColor: '#ef4444',
    },
    {
      label: 'Late Delivery Rate',
      mobileLabel: 'Late Rate',
      value: data.lateDeliveryRate,
      suffix: '%',
      icon: Clock,
      borderColor: '#f97316',
    },
    {
      label: 'Avg Risk Score',
      mobileLabel: 'Avg Score',
      value: data.avgRiskScore,
      suffix: '/100',
      icon: ShieldAlert,
      borderColor: '#8b5cf6',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {kpis.map((kpi) => {
        const Icon = kpi.icon;
        return (
          <div
            key={kpi.label}
            className="relative z-1 bg-navy-800 border border-blue-900/40 rounded-xl overflow-hidden transition-shadow duration-300 hover:shadow-lg hover:shadow-blue-900/20"
            style={{ borderLeft: '4px solid', borderLeftColor: kpi.borderColor }}
          >
            <div className="p-4 sm:p-5 pl-5">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1 pr-2">
                  <p className="text-xs sm:text-sm text-slate-400 font-medium truncate md:hidden">{kpi.mobileLabel}</p>
                  <p className="text-xs sm:text-sm text-slate-400 font-medium truncate hidden md:block">{kpi.label}</p>
                  <p className="text-xl sm:text-2xl font-bold text-white mt-1">
                    {kpi.value}{kpi.suffix || ''}
                  </p>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400" />
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// 2. Risk Distribution Chart (Donut)
function RiskDistributionChart({ data }: { data: SupplierRiskEntry[] }) {
  const counts = { low: 0, medium: 0, high: 0 };
  data.forEach(({ risk }) => {
    if (risk.overallRiskScore < 40) counts.low++;
    else if (risk.overallRiskScore < 70) counts.medium++;
    else counts.high++;
  });

  const chartData = {
    labels: ['Low Risk', 'Medium Risk', 'High Risk'],
    datasets: [{
      data: [counts.low, counts.medium, counts.high],
      backgroundColor: ['rgba(34, 197, 94, 0.8)', 'rgba(251, 146, 60, 0.8)', 'rgba(239, 68, 68, 0.8)'],
      borderColor: ['rgba(34, 197, 94, 1)', 'rgba(251, 146, 60, 1)', 'rgba(239, 68, 68, 1)'],
      borderWidth: 2,
    }]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right' as const,
        labels: {
          color: '#94a3b8',
          font: { size: 11 },
          usePointStyle: true,
          padding: 16,
        }
      },
      tooltip: {
        backgroundColor: '#0f2244',
        borderColor: 'rgba(59, 130, 246, 0.3)',
        borderWidth: 1,
        titleColor: '#e2e8f0',
        bodyColor: '#94a3b8',
        callbacks: {
          label: (ctx: { label: string; raw: number }) => ` ${ctx.label}: ${ctx.raw} vendors`
        }
      }
    }
  };

  const total = counts.low + counts.medium + counts.high;

  return (
    <div className="relative z-1 bg-navy-800 border border-blue-900/40 rounded-xl p-4 sm:p-5">
      <h3 className="text-sm font-bold text-white mb-4">Risk Distribution</h3>
      <div className="h-[200px]">
        {total > 0 ? (
          <Chart type="doughnut" data={chartData} options={options as never} />
        ) : (
          <div className="h-full flex items-center justify-center text-slate-500 text-sm">
            No vendor data available
          </div>
        )}
      </div>
      <div className="flex justify-center gap-4 mt-4 text-xs">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          Low: {counts.low}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-orange-400" />
          Medium: {counts.medium}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-red-500" />
          High: {counts.high}
        </span>
      </div>
    </div>
  );
}

// 3. Vendor Ranking Table
function VendorRankingTable({
  data,
  selectedVendorId,
  onSelect
}: {
  data: SupplierRiskEntry[];
  selectedVendorId: string | null;
  onSelect: (vendorId: string) => void;
}) {
  function getMainRiskCategory(risk: SupplierRisk): string {
    const scores = [
      { label: 'Delivery Delay', score: risk.deliveryDelayRiskScore },
      { label: 'Lead Time', score: risk.leadTimeRiskScore },
      { label: 'Dependency', score: risk.supplierDependencyRiskScore },
      { label: 'Performance', score: risk.supplierPerformanceRiskScore },
    ];
    const max = scores.reduce((a, b) => a.score > b.score ? a : b);
    return max.score > 0 ? max.label : 'None';
  }

  return (
    <div className="relative z-1 bg-navy-800 border border-blue-900/40 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-blue-900/40">
        <h3 className="text-sm font-bold text-white">Vendor Risk Ranking</h3>
        <p className="text-xs text-slate-500 mt-0.5">Sorted by risk score — click to view details</p>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-navy-800 border-b border-blue-900/30">
            <tr>
              <th className="px-4 py-3 text-left text-slate-500 font-medium">Vendor</th>
              <th className="px-4 py-3 text-center text-slate-500 font-medium">Risk Score</th>
              <th className="px-4 py-3 text-center text-slate-500 font-medium">Level</th>
              <th className="px-4 py-3 text-left text-slate-500 font-medium">Main Risk</th>
            </tr>
          </thead>
          <tbody>
            {data.map(({ metrics, risk }) => {
              const cfg = riskConfig(risk.riskLevel);
              const isSelected = selectedVendorId === risk.vendorId;
              return (
                <tr
                  key={risk.vendorId}
                  onClick={() => onSelect(risk.vendorId)}
                  className={`border-b border-blue-900/20 cursor-pointer transition-colors ${
                    isSelected ? 'bg-blue-600/20' : 'hover:bg-white/[0.02]'
                  }`}
                >
                  <td className="px-4 py-3">
                    <span className="text-white font-medium">{metrics.vendorName}</span>
                    <p className="text-xs text-slate-500">{metrics.vendor.category}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <span className={`text-lg font-bold ${cfg.text}`}>{risk.overallRiskScore}</span>
                      <span className="text-xs text-slate-600">/100</span>
                      <div className="w-16 h-1.5 bg-navy-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${cfg.bar} rounded-full`}
                          style={{ width: `${risk.overallRiskScore}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.badgeBg}`}>
                      {risk.riskLevel}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-slate-400">{getMainRiskCategory(risk)}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="block md:hidden divide-y divide-blue-900/20">
        {data.map(({ metrics, risk }) => {
          const cfg = riskConfig(risk.riskLevel);
          const isSelected = selectedVendorId === risk.vendorId;
          return (
            <div
              key={risk.vendorId}
              onClick={() => onSelect(risk.vendorId)}
              className={`px-4 py-4 cursor-pointer ${isSelected ? 'bg-blue-600/20' : 'hover:bg-white/[0.02]'}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-white font-medium text-sm">{metrics.vendorName}</span>
                <div className="flex items-center gap-2">
                  <span className={`text-lg font-bold ${cfg.text}`}>{risk.overallRiskScore}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${cfg.badgeBg}`}>
                    {risk.riskLevel}
                  </span>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-1">{getMainRiskCategory(risk)}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// 4. Delivery Trend Chart
function DeliveryTrendChart({ pos }: { pos: PurchaseOrder[] }) {
  const perfMap = getDeliveryPerformance();

  // Group by month
  const monthlyData: Record<string, { total: number; onTime: number }> = {};
  pos.filter(p => p.status === 'delivered' || p.status === 'invoiced').forEach(po => {
    const month = new Date(po.date).toLocaleString('en-US', { month: 'short', year: '2-digit' });
    if (!monthlyData[month]) monthlyData[month] = { total: 0, onTime: 0 };
    monthlyData[month].total++;
    const perf = perfMap[po.id];
    if (!perf || perf.onTime) monthlyData[month].onTime++;
  });

  const months = Object.keys(monthlyData).slice(-6);
  const rates = months.map(m => {
    const d = monthlyData[m];
    return d.total > 0 ? Math.round((d.onTime / d.total) * 100) : 100;
  });

  const chartData = {
    labels: months,
    datasets: [{
      label: 'On-Time Delivery %',
      data: rates,
      borderColor: 'rgba(59, 130, 246, 1)',
      backgroundColor: 'rgba(59, 130, 246, 0.15)',
      fill: true,
      tension: 0.4,
      pointRadius: 4,
      pointBackgroundColor: 'rgba(59, 130, 246, 1)',
    }]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#0f2244',
        borderColor: 'rgba(59, 130, 246, 0.3)',
        borderWidth: 1,
        callbacks: {
          label: (ctx: { parsed: { y: number } }) => ` ${ctx.parsed.y}% on-time`
        }
      }
    },
    scales: {
      x: {
        ticks: { color: '#64748b' },
        grid: { color: 'rgba(30, 58, 95, 0.5)' }
      },
      y: {
        min: 0,
        max: 100,
        ticks: { color: '#64748b', callback: (v: number | string) => `${v}%` },
        grid: { color: 'rgba(30, 58, 95, 0.5)' }
      }
    }
  };

  return (
    <div className="relative z-1 bg-navy-800 border border-blue-900/40 rounded-xl p-4 sm:p-5">
      <h3 className="text-sm font-bold text-white mb-4">Delivery Reliability Trend</h3>
      <div className="h-[200px]">
        {months.length > 0 ? (
          <Chart type="line" data={chartData} options={options as never} />
        ) : (
          <div className="h-full flex items-center justify-center text-slate-500 text-sm">
            No delivery data available
          </div>
        )}
      </div>
    </div>
  );
}

// 5. Risk Breakdown Chart
function RiskBreakdownChart({ data }: { data: SupplierRiskEntry[] }) {
  if (data.length === 0) {
    return (
      <div className="relative z-1 bg-navy-800 border border-blue-900/40 rounded-xl p-4 sm:p-5">
        <h3 className="text-sm font-bold text-white mb-4">Risk Composition</h3>
        <div className="h-[200px] flex items-center justify-center text-slate-500 text-sm">
          No data available
        </div>
      </div>
    );
  }

  const avgDelivery = data.reduce((s, r) => s + r.risk.deliveryDelayRiskScore, 0) / data.length;
  const avgLeadTime = data.reduce((s, r) => s + r.risk.leadTimeRiskScore, 0) / data.length;
  const avgDependency = data.reduce((s, r) => s + r.risk.supplierDependencyRiskScore, 0) / data.length;
  const avgPerformance = data.reduce((s, r) => s + r.risk.supplierPerformanceRiskScore, 0) / data.length;

  const chartData = {
    labels: ['Delivery Delay', 'Lead Time', 'Dependency', 'Performance'],
    datasets: [{
      label: 'Avg Score',
      data: [avgDelivery, avgLeadTime, avgDependency, avgPerformance],
      backgroundColor: [
        'rgba(239, 68, 68, 0.7)',
        'rgba(249, 115, 22, 0.7)',
        'rgba(139, 92, 246, 0.7)',
        'rgba(59, 130, 246, 0.7)',
      ],
      borderColor: [
        'rgba(239, 68, 68, 1)',
        'rgba(249, 115, 22, 1)',
        'rgba(139, 92, 246, 1)',
        'rgba(59, 130, 246, 1)',
      ],
      borderWidth: 1.5,
      borderRadius: 4,
    }]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#0f2244',
        callbacks: {
          label: (ctx: { label: string; parsed: { y: number } }) => ` ${ctx.label}: ${ctx.parsed.y.toFixed(1)} pts`
        }
      }
    },
    scales: {
      x: { ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { color: 'rgba(30, 58, 95, 0.5)' } },
      y: { ticks: { color: '#64748b' }, grid: { color: 'rgba(30, 58, 95, 0.5)' } }
    }
  };

  return (
    <div className="relative z-1 bg-navy-800 border border-blue-900/40 rounded-xl p-4 sm:p-5">
      <h3 className="text-sm font-bold text-white mb-4">Risk Composition (Avg)</h3>
      <div className="h-[200px]">
        <Chart type="bar" data={chartData} options={options as never} />
      </div>
    </div>
  );
}

// 6. Vendor Detail Panel with Risk Explanation
function generateRiskExplanation(
  metrics: SupplierMetrics,
  risk: SupplierRisk
): { heading: string; explanation: string; implications: string[] } {
  const issues: string[] = [];
  const implications: string[] = [];

  if (risk.deliveryDelayRiskScore >= 15) {
    issues.push(`${metrics.currentOverdueOrders} overdue order(s)`);
    implications.push('Production schedules may be disrupted');
  }
  if (metrics.onTimeDeliveryRate < 80) {
    issues.push(`only ${metrics.onTimeDeliveryRate}% on-time rate`);
    implications.push('Consider safety stock or alternative suppliers');
  }
  if (risk.supplierDependencyRiskScore >= 10) {
    issues.push(`${metrics.supplierSpendShare}% spend concentration`);
    implications.push('Diversify supplier base to reduce single-point-of-failure');
  }
  if (risk.leadTimeRiskScore >= 10) {
    issues.push(`extended lead time of ${metrics.averageLeadTime} days`);
    implications.push('Plan orders further in advance');
  }
  if (risk.supplierPerformanceRiskScore >= 8) {
    issues.push('below-average performance metrics');
    implications.push('Issue performance improvement notice');
  }

  const heading = risk.riskLevel === 'High'
    ? 'Critical Risk Detected'
    : risk.riskLevel === 'Medium'
    ? 'Moderate Risk Factors Identified'
    : 'Low Risk Profile';

  const explanation = issues.length > 0
    ? `This vendor shows ${issues.join(', ')}.`
    : 'This vendor meets performance expectations across all categories.';

  return { heading, explanation, implications };
}

function VendorDetailPanel({
  entry,
  pos
}: {
  entry: SupplierRiskEntry | null;
  pos: PurchaseOrder[];
}) {
  if (!entry) {
    return (
      <div className="relative z-1 bg-navy-800 border border-blue-900/40 rounded-xl p-6 text-center">
        <ShieldAlert className="w-10 h-10 mx-auto mb-3 text-slate-600" />
        <p className="text-slate-500 text-sm">Select a vendor to view details</p>
      </div>
    );
  }

  const { metrics, risk } = entry;
  const cfg = riskConfig(risk.riskLevel);
  const RiskIcon = cfg.icon;
  const analysis = generateRiskExplanation(metrics, risk);

  // Get vendor POs
  const vendorPOs = pos.filter(p => p.vendorId === metrics.vendorId);
  const perfMap = getDeliveryPerformance();

  return (
    <div className="relative z-1 bg-navy-800 border border-blue-900/40 rounded-xl overflow-hidden">
      {/* Header */}
      <div className={`${cfg.bg} px-5 py-4 border-b border-current/30`}>
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <h3 className="text-white font-bold text-lg truncate">{metrics.vendorName}</h3>
            <p className="text-xs text-slate-400 mt-0.5">{metrics.vendor.category}</p>
          </div>
          <div className="flex flex-col items-end gap-1 flex-shrink-0 ml-4">
            <div className="flex items-center gap-1">
              <span className={`text-3xl font-bold ${cfg.text}`}>{risk.overallRiskScore}</span>
              <span className="text-xs text-slate-600">/100</span>
            </div>
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.badgeBg}`}>
              <RiskIcon className="w-3 h-3" />
              {risk.riskLevel} Risk
            </span>
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="p-5 grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="bg-navy-700/50 rounded-lg p-3">
          <p className="text-[10px] text-slate-500 uppercase tracking-wide">Status</p>
          <p className={`text-sm font-semibold ${metrics.vendor.status === 'active' ? 'text-emerald-400' : 'text-slate-400'}`}>
            {metrics.vendor.status}
          </p>
        </div>
        <div className="bg-navy-700/50 rounded-lg p-3">
          <p className="text-[10px] text-slate-500 uppercase tracking-wide">Lead Time</p>
          <p className="text-sm font-semibold text-white">{metrics.vendorLeadTime} days</p>
        </div>
        <div className="bg-navy-700/50 rounded-lg p-3">
          <p className="text-[10px] text-slate-500 uppercase tracking-wide">Total Orders</p>
          <p className="text-sm font-semibold text-white">{metrics.totalOrders}</p>
        </div>
        <div className="bg-navy-700/50 rounded-lg p-3">
          <p className="text-[10px] text-slate-500 uppercase tracking-wide">Total Spend</p>
          <p className="text-sm font-semibold text-white">${metrics.supplierSpend.toLocaleString()}</p>
        </div>
        <div className="bg-navy-700/50 rounded-lg p-3">
          <p className="text-[10px] text-slate-500 uppercase tracking-wide">Spend Share</p>
          <p className="text-sm font-semibold text-white">{metrics.supplierSpendShare}%</p>
        </div>
        <div className="bg-navy-700/50 rounded-lg p-3">
          <p className="text-[10px] text-slate-500 uppercase tracking-wide">On-Time Rate</p>
          <p className={`text-sm font-semibold ${metrics.onTimeDeliveryRate >= 90 ? 'text-emerald-400' : metrics.onTimeDeliveryRate >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>
            {metrics.onTimeDeliveryRate}%
          </p>
        </div>
      </div>

      {/* Risk Tags */}
      {risk.detectedRiskTypes.length > 0 && (
        <div className="px-5 pb-4">
          <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-2">Detected Risks</p>
          <div className="flex flex-wrap gap-1.5">
            {risk.detectedRiskTypes.map((t) => (
              <RiskTypeBadge key={t} label={t} />
            ))}
          </div>
        </div>
      )}

      {/* Risk Explanation */}
      <div className={`mx-5 mb-5 p-4 rounded-lg border ${cfg.bg}`}>
        <p className={`text-xs font-semibold mb-2 ${cfg.text}`}>{analysis.heading}</p>
        <p className="text-xs text-slate-300 leading-relaxed">{analysis.explanation}</p>
        {analysis.implications.length > 0 && (
          <ul className="mt-2 space-y-1">
            {analysis.implications.map((imp, i) => (
              <li key={i} className="text-xs text-slate-400 flex items-start gap-1.5">
                <ArrowRight className="w-3 h-3 mt-0.5 flex-shrink-0" />
                {imp}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* PO History */}
      <div className="border-t border-blue-900/40">
        <div className="px-5 py-3 border-b border-blue-900/20">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Purchase Order History</p>
        </div>
        {vendorPOs.length === 0 ? (
          <div className="px-5 py-6 text-center text-sm text-slate-500">No orders</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-blue-900/20">
                <tr>
                  <th className="px-4 py-2 text-left text-slate-500 font-medium">PO</th>
                  <th className="px-4 py-2 text-left text-slate-500 font-medium">Date</th>
                  <th className="px-4 py-2 text-left text-slate-500 font-medium">Expected</th>
                  <th className="px-4 py-2 text-left text-slate-500 font-medium">Status</th>
                  <th className="px-4 py-2 text-right text-slate-500 font-medium">Delay</th>
                </tr>
              </thead>
              <tbody>
                {vendorPOs.map((po, idx) => {
                  const ext = po as PurchaseOrder & { actualDeliveryDate?: string };
                  const perf = perfMap[po.id];
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const deliveryDate = new Date(po.deliveryDate);
                  deliveryDate.setHours(0, 0, 0, 0);

                  let delayDays = 0;
                  if (po.status === 'delivered' || po.status === 'invoiced') {
                    if (ext.actualDeliveryDate) {
                      const actual = new Date(ext.actualDeliveryDate);
                      actual.setHours(0, 0, 0, 0);
                      delayDays = Math.floor((actual.getTime() - deliveryDate.getTime()) / 86400000);
                    } else if (perf) {
                      delayDays = perf.daysDifference;
                    }
                  } else if (deliveryDate < today) {
                    delayDays = Math.floor((today.getTime() - deliveryDate.getTime()) / 86400000);
                  }

                  const statusColors: Record<string, string> = {
                    ordered: 'text-blue-400',
                    confirmed: 'text-violet-400',
                    'in-transit': 'text-amber-400',
                    delivered: 'text-emerald-400',
                    invoiced: 'text-slate-400'
                  };

                  return (
                    <tr key={po.id || idx} className="border-b border-blue-900/10 hover:bg-white/[0.01]">
                      <td className="px-4 py-2.5 text-white font-mono">{po.poNumber}</td>
                      <td className="px-4 py-2.5 text-slate-400">{po.date}</td>
                      <td className="px-4 py-2.5 text-slate-400">{po.deliveryDate}</td>
                      <td className="px-4 py-2.5">
                        <span className={`${statusColors[po.status] || 'text-slate-400'} font-medium`}>
                          {po.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {delayDays > 0 ? (
                          <span className="text-red-400 font-semibold">+{delayDays}d</span>
                        ) : delayDays < 0 ? (
                          <span className="text-emerald-400">{delayDays}d</span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// 8. Procurement Insights
function ProcurementInsights({ data }: { data: SupplierRiskEntry[] }) {
  const insights: { icon: typeof Lightbulb; text: string; type: 'warning' | 'info' | 'success' }[] = [];

  // High concentration
  const highConcentration = data.filter(d => d.risk.supplierDependencyRiskScore >= 15);
  if (highConcentration.length > 0) {
    insights.push({
      icon: AlertTriangle,
      text: `High supplier concentration detected — ${highConcentration.length} vendor(s) exceed 35% spend share`,
      type: 'warning'
    });
  }

  // Declining delivery
  const poorDelivery = data.filter(d => d.metrics.onTimeDeliveryRate < 80);
  if (poorDelivery.length > 0) {
    insights.push({
      icon: TrendingDown,
      text: `Delivery reliability concern — ${poorDelivery.length} vendor(s) with on-time rate below 80%`,
      type: 'warning'
    });
  }

  // Lead time instability
  const longLeadTime = data.filter(d => d.risk.leadTimeRiskScore >= 10);
  if (longLeadTime.length > 0) {
    insights.push({
      icon: Clock,
      text: `Lead time instability — ${longLeadTime.length} vendor(s) with extended lead times`,
      type: 'info'
    });
  }

  // Performance issues
  const lowPerformers = data.filter(d => d.risk.supplierPerformanceRiskScore >= 8);
  if (lowPerformers.length > 0) {
    insights.push({
      icon: Activity,
      text: `Performance gaps — ${lowPerformers.length} vendor(s) with below-average scores`,
      type: 'info'
    });
  }

  // Positive insight
  const lowRisk = data.filter(d => d.risk.overallRiskScore < 40);
  if (lowRisk.length === data.length && data.length > 0) {
    insights.push({
      icon: CheckCircle,
      text: 'All suppliers operating within acceptable risk parameters',
      type: 'success'
    });
  }

  if (insights.length === 0) {
    insights.push({
      icon: Info,
      text: 'Insufficient data — add more purchase orders for analysis',
      type: 'info'
    });
  }

  return (
    <div className="relative z-1 bg-navy-800 border border-blue-900/40 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Lightbulb className="w-5 h-5 text-amber-400" />
        <h3 className="text-sm font-bold text-white">Procurement Insights</h3>
      </div>
      <div className="space-y-3">
        {insights.map((insight, i) => {
          const Icon = insight.icon;
          const colors = {
            warning: 'bg-amber-500/10 border-amber-500/25 text-amber-400',
            info: 'bg-blue-500/10 border-blue-500/25 text-blue-400',
            success: 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
          };
          return (
            <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${colors[insight.type]}`}>
              <Icon className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-slate-300 leading-relaxed">{insight.text}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// 9. Mitigation Actions
function MitigationActions({ data }: { data: SupplierRiskEntry[] }) {
  const actions: { priority: 'high' | 'medium' | 'low'; text: string; vendor?: string }[] = [];

  // High risk vendors
  data.filter(d => d.risk.overallRiskScore >= 70).forEach(({ metrics, risk }) => {
    if (risk.detectedRiskTypes.includes('Supplier Dependency Risk')) {
      actions.push({
        priority: 'high',
        text: 'Diversify sourcing — qualify alternative suppliers immediately',
        vendor: metrics.vendorName
      });
    }
    if (risk.deliveryDelayRiskScore >= 20) {
      actions.push({
        priority: 'high',
        text: 'Escalate delivery performance — issue formal improvement notice',
        vendor: metrics.vendorName
      });
    }
    actions.push({
      priority: 'high',
      text: 'Schedule executive review — critical supplier risk identified',
      vendor: metrics.vendorName
    });
  });

  // Medium risk vendors
  data.filter(d => d.risk.overallRiskScore >= 40 && d.risk.overallRiskScore < 70).forEach(({ metrics }) => {
    actions.push({
      priority: 'medium',
      text: 'Increase monitoring frequency — weekly performance tracking',
      vendor: metrics.vendorName
    });
  });

  // Low risk vendors
  const lowRiskCount = data.filter(d => d.risk.overallRiskScore < 40).length;
  if (lowRiskCount > 0) {
    actions.push({
      priority: 'low',
      text: `Maintain standard review cadence for ${lowRiskCount} low-risk vendor(s)`
    });
  }

  if (actions.length === 0) {
    actions.push({
      priority: 'low',
      text: 'Continue regular supplier monitoring program'
    });
  }

  const priorityColors = {
    high: 'bg-red-500/15 text-red-400 border-red-500/30',
    medium: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    low: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
  };

  return (
    <div className="relative z-1 bg-navy-800 border border-blue-900/40 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Target className="w-5 h-5 text-blue-400" />
        <h3 className="text-sm font-bold text-white">Recommended Actions</h3>
      </div>
      <div className="space-y-3">
        {actions.slice(0, 6).map((action, i) => (
          <div key={i} className="flex items-start gap-3 p-3 bg-navy-700/50 rounded-lg">
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${priorityColors[action.priority]}`}>
              {action.priority}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-300 leading-snug">{action.text}</p>
              {action.vendor && (
                <p className="text-[10px] text-slate-500 mt-0.5">{action.vendor}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────

export default function Delivery({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const [pos, setPos] = useState<PurchaseOrder[]>(() => getPurchaseOrders());
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('earliest');
  const [perf, setPerf] = useState<Record<string, DeliveryPerformance>>(() => getDeliveryPerformance());
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
  const [riskData, setRiskData] = useState(() => buildSupplierRiskData());
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(() => {
    const data = buildSupplierRiskData();
    return data.length > 0 ? data[0].risk.vendorId : null;
  });

  const isDeliveredOrLater = (po: PurchaseOrder) =>
    STATUS_ORDER.indexOf(po.status) >= STATUS_ORDER.indexOf('delivered');

  // Computed dashboard data
  const dashboardData = useMemo(() => computeRiskDashboardData(riskData, pos), [riskData, pos]);
  const selectedVendorEntry = useMemo(
    () => riskData.find(d => d.risk.vendorId === selectedVendorId) || null,
    [riskData, selectedVendorId]
  );

  const enriched = useMemo(() => {
    return pos.map((po) => {
      const extended = po as PurchaseOrder & { actualDeliveryDate?: string };
      const pastDelivery = isDeliveredOrLater(po);
      return {
        ...po,
        actualDeliveryDate: extended.actualDeliveryDate,
        overdue: !pastDelivery && isOverdue(po),
        daysOverdue: !pastDelivery && isOverdue(po) ? daysOverdue(po) : 0,
        daysUntil: !pastDelivery && !isOverdue(po) ? daysUntilDelivery(po) : 0,
      };
    });
  }, [pos]);

  const counts = useMemo(() => ({
    ordered:       enriched.filter((p) => p.status === 'ordered').length,
    'in-transit':  enriched.filter((p) => p.status === 'in-transit').length,
    delivered:     enriched.filter((p) => p.status === 'delivered').length,
    overdue:       enriched.filter((p) => p.overdue).length,
  }), [enriched]);

  // Pipeline: filter -> search -> sort
  const filtered = useMemo(() => {
    // Step 1: badge filter
    let result = enriched;
    if (activeFilter) {
      if (activeFilter === 'overdue') {
        result = result.filter((p) => p.overdue);
      } else {
        result = result.filter((p) => p.status === activeFilter);
      }
    }

    // Step 2: search
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (p) => p.poNumber.toLowerCase().includes(q) || p.vendorName.toLowerCase().includes(q)
      );
    }

    // Step 3: sort
    const sorted = [...result];
    if (sortBy === 'earliest') {
      sorted.sort((a, b) => a.deliveryDate.localeCompare(b.deliveryDate));
    } else if (sortBy === 'overdue') {
      sorted.sort((a, b) => {
        const aOverdue = a.overdue ? a.daysOverdue : 0;
        const bOverdue = b.overdue ? b.daysOverdue : 0;
        if (aOverdue !== bOverdue) return bOverdue - aOverdue;
        return a.deliveryDate.localeCompare(b.deliveryDate);
      });
    } else if (sortBy === 'vendor') {
      sorted.sort((a, b) => a.vendorName.localeCompare(b.vendorName));
    } else if (sortBy === 'status') {
      sorted.sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status));
    }

    return sorted;
  }, [enriched, activeFilter, search, sortBy]);

  const handleFilterClick = useCallback((key: string) => {
    setActiveFilter((prev) => (prev === key ? null : key));
  }, []);

  const handleSaveNote = useCallback((poId: string, notes: DeliveryNote[]) => {
    setPos((prev) => {
      const updated = prev.map((po) =>
        po.id === poId ? { ...po, deliveryNotes: notes } : po
      );
      savePurchaseOrders(updated);
      return updated;
    });
  }, []);

  function toggleNotes(poId: string) {
    setExpandedNotes((prev) => {
      const next = new Set(prev);
      if (next.has(poId)) next.delete(poId);
      else next.add(poId);
      return next;
    });
  }

  const advanceStatus = useCallback((poId: string) => {
    setPos((prev) => {
      const updated = prev.map((po) => {
        if (po.id !== poId) return po;
        const idx = STATUS_ORDER.indexOf(po.status);
        if (idx >= STATUS_ORDER.length - 1) return po;
        const nextStatus = STATUS_ORDER[idx + 1];
        const extended = po as PurchaseOrder & { actualDeliveryDate?: string };
        const updatedPo: PurchaseOrder & { actualDeliveryDate?: string } = { ...po, status: nextStatus };
        if (nextStatus === 'delivered' && !extended.actualDeliveryDate) {
          updatedPo.actualDeliveryDate = new Date().toISOString().slice(0, 10);
        }
        return updatedPo;
      });

      savePurchaseOrders(updated);

      // Update delivery performance for newly delivered/invoiced POs
      setPerf((prevPerf) => {
        const newPerf = { ...prevPerf };
        let changed = false;
        updated.forEach((po) => {
          const extended = po as PurchaseOrder & { actualDeliveryDate?: string };
          const existing = prevPerf[po.id];
          if (existing) return; // never overwrite
          const perfResult = calcDeliveryPerformance(extended);
          if (perfResult) {
            newPerf[po.id] = perfResult;
            changed = true;
          }
        });
        if (changed) {
          saveDeliveryPerformance(newPerf);
        }
        return changed ? newPerf : prevPerf;
      });

      setRiskData(buildSupplierRiskData());

      return updated;
    });
  }, []);

  const handleSelectVendor = useCallback((vendorId: string) => {
    setSelectedVendorId(vendorId);
  }, []);

  const badgeItems: { key: string; label: string; count: number; color: string; bg: string; activeBg: string; pulse: boolean }[] = [
    { key: 'ordered',     label: 'Ordered',    count: counts.ordered,       color: 'text-blue-400',    bg: 'bg-blue-500/10 border-blue-500/20',    activeBg: 'bg-blue-600/30 border-blue-500/50',    pulse: false },
    { key: 'in-transit',  label: 'In Transit', count: counts['in-transit'], color: 'text-amber-400',  bg: 'bg-amber-500/10 border-amber-500/20',  activeBg: 'bg-amber-600/30 border-amber-500/50',  pulse: false },
    { key: 'delivered',   label: 'Delivered',  count: counts.delivered,     color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', activeBg: 'bg-emerald-600/30 border-emerald-500/50', pulse: false },
    { key: 'overdue',     label: 'Overdue',     count: counts.overdue,      color: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/20',      activeBg: 'bg-red-600/30 border-red-500/50',      pulse: true },
  ];

  // Empty state
  if (pos.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Package className="w-7 h-7 text-blue-400" />
            Delivery Tracking
          </h1>
          <p className="text-slate-400 text-sm mt-1">Track and manage incoming deliveries</p>
        </div>
        <div className="relative z-1 bg-navy-800 border border-blue-900/40 rounded-xl p-16 text-center">
          <Package className="w-16 h-16 mx-auto mb-4 text-slate-600" />
          <p className="text-slate-400 font-medium text-lg">No purchase orders yet</p>
          <p className="text-slate-500 text-sm mt-2">Create one in the Orders page to start tracking deliveries</p>
          <button
            onClick={() => onNavigate?.('purchase-orders')}
            className="relative z-2 mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition-colors shadow-lg shadow-blue-900/20"
          >
            <FileText className="w-4 h-4" />
            Go to Orders
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Package className="w-7 h-7 text-blue-400" />
          Delivery Tracking
        </h1>
        <p className="text-slate-400 text-sm mt-1">Track and manage incoming deliveries</p>
      </div>

      {/* Summary Status Badges */}
      <div className="flex flex-wrap gap-3">
        {badgeItems.map((b) => (
          <button
            key={b.key}
            onClick={() => handleFilterClick(b.key)}
            className={`relative z-2 flex items-center gap-2.5 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all duration-200 ${
              activeFilter === b.key ? b.activeBg : b.bg
            } ${b.color}`}
          >
            <span className={`w-2 h-2 rounded-full ${b.pulse ? 'animate-pulse' : ''} ${
              b.key === 'overdue' ? 'bg-red-400' :
              b.key === 'ordered' ? 'bg-blue-400' :
              b.key === 'in-transit' ? 'bg-amber-400' :
              'bg-emerald-400'
            }`} />
            <span className="font-bold">{b.count}</span>
            <span>{b.label}</span>
          </button>
        ))}
      </div>

      {/* Search + Sort Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search by PO number or vendor name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-10 py-2.5 bg-navy-800 border border-blue-900/40 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 relative z-2"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
            >
              <XIcon className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="relative flex items-center gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="bg-navy-700 border border-blue-900/40 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 appearance-none relative z-2 pr-8"
          >
            {(Object.keys(sortLabels) as SortOption[]).map((key) => (
              <option key={key} value={key}>{sortLabels[key]}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
        </div>
      </div>

      {/* Gantt Timeline Chart */}
      <GanttTimeline pos={pos} />

      {/* Delivery Cards */}
      <div className="space-y-4">
        {filtered.map((po) => {
          const meta = statusMeta[po.status] || statusMeta.ordered;
          const statusIdx = STATUS_ORDER.indexOf(po.status);
          const overdue = po.overdue;
          const MetaIcon = meta.icon;
          const isFinal = po.status === 'invoiced';
          const poPerf = perf[po.id];
          const extended = po as typeof po & { actualDeliveryDate?: string };

          return (
            <div
              key={po.id}
              className={`relative z-1 rounded-xl border p-5 transition-all duration-300 ${
                overdue
                  ? 'bg-red-500/5 border-red-500/25 shadow-[0_0_24px_-6px_rgba(239,68,68,0.15)]'
                  : 'bg-navy-800 border-blue-900/40 hover:border-blue-800/60'
              }`}
              style={overdue ? { borderLeft: '4px solid #ef4444' } : undefined}
            >
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                {/* Left: PO info */}
                <div className="flex items-start gap-4 min-w-0 flex-1">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    overdue ? 'bg-red-500/15' : 'bg-blue-500/10'
                  }`}>
                    <MetaIcon className={`w-5 h-5 ${overdue ? 'text-red-400' : meta.color}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-white font-semibold font-mono text-sm">{po.poNumber}</span>
                      <span className="text-slate-400 text-sm">{po.vendorName}</span>
                      {/* On-time delivery badge */}
                      {poPerf && (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${
                          poPerf.onTime
                            ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                            : 'bg-red-500/15 border-red-500/30 text-red-400'
                        }`}>
                          {poPerf.onTime ? (
                            <>
                              <Check className="w-3 h-3" />
                              {poPerf.daysDifference === 0 ? 'On Time' : `${Math.abs(poPerf.daysDifference)}d early`}
                            </>
                          ) : (
                            <>
                              <XIcon className="w-3 h-3" />
                              {poPerf.daysDifference}d late
                            </>
                          )}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{po.items}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Expected: <span className={overdue ? 'text-red-400 font-medium' : 'text-slate-400'}>{po.deliveryDate}</span>
                      {extended.actualDeliveryDate && (
                        <span className="text-emerald-400 ml-2">
                          Delivered: {extended.actualDeliveryDate}
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Right: Status progress + timing + advance */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
                  {/* Enhanced Status Progress Dots */}
                  <div className="flex flex-col items-center gap-1.5">
                    <div className="flex items-center gap-1">
                      {STATUS_ORDER.map((s, i) => {
                        const isCompleted = i < statusIdx;
                        const isActive = i === statusIdx;
                        const sm = statusMeta[s];
                        return (
                          <div key={s} className="flex items-center gap-1">
                            {i > 0 && (
                              <div
                                className={`w-3 h-0.5 rounded-full transition-colors duration-500 ${
                                  isCompleted || isActive ? sm.dot : 'bg-slate-700'
                                }`}
                              />
                            )}
                            <div
                              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] transition-all duration-500 ${
                                isFinal
                                  ? `${sm.dot} text-white`
                                  : isActive
                                    ? `${sm.dot} text-white animate-[pulse_2s_ease-in-out_infinite]`
                                    : isCompleted
                                      ? `${sm.dot} text-white`
                                      : 'bg-slate-700/50 border border-slate-600 text-slate-600'
                              }`}
                            >
                              {(isCompleted || isFinal) && !isActive ? (
                                <Check className="w-3 h-3" />
                              ) : isActive ? (
                                <span className="w-1.5 h-1.5 rounded-full bg-white" />
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <span className="text-[10px] text-slate-500">
                      Step {statusIdx + 1} of 5: {meta.label}
                    </span>
                  </div>

                  {/* Status Badge */}
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${meta.bg} ${meta.color}`}>
                    <MetaIcon className="w-3 h-3" />
                    {meta.label}
                  </span>

                  {/* Timing */}
                  <div className="min-w-[100px] text-right">
                    {statusIdx >= STATUS_ORDER.indexOf('delivered') ? (
                      poPerf ? (
                        poPerf.onTime ? (
                          <span className="text-emerald-400 font-medium text-sm flex items-center gap-1 justify-end">
                            <Check className="w-4 h-4 flex-shrink-0" />
                            {poPerf.daysDifference === 0 ? 'On Time' : `${Math.abs(poPerf.daysDifference)}d early`}
                          </span>
                        ) : (
                          <span className="text-red-400 font-medium text-sm flex items-center gap-1 justify-end">
                            <XIcon className="w-4 h-4 flex-shrink-0" />
                            {poPerf.daysDifference}d late
                          </span>
                        )
                      ) : (
                        <span className="text-emerald-400 font-medium text-sm">Delivered</span>
                      )
                    ) : overdue ? (
                      <div className="flex items-center gap-1.5 justify-end">
                        <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                        <span className="text-red-400 font-bold text-sm">{po.daysOverdue}d overdue</span>
                      </div>
                    ) : (
                      <span className="text-emerald-400 font-medium text-sm">{po.daysUntil}d until delivery</span>
                    )}
                  </div>

                  {/* Advance Status Button */}
                  {po.status !== 'invoiced' && (
                    <button
                      onClick={() => advanceStatus(po.id)}
                      className="relative z-2 flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition-colors shadow-lg shadow-blue-900/20"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                      Advance Status
                    </button>
                  )}

                  {/* Notes Toggle Button */}
                  <button
                    onClick={() => toggleNotes(po.id)}
                    className={`relative z-2 flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors border ${
                      expandedNotes.has(po.id)
                        ? 'bg-blue-600/20 border-blue-500/40 text-blue-400'
                        : 'bg-navy-700 border-blue-900/40 text-slate-400 hover:text-white hover:border-blue-800/60'
                    }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    Notes{po.deliveryNotes && po.deliveryNotes.length > 0 ? ` (${po.deliveryNotes.length})` : ''}
                  </button>
                </div>
              </div>

              {/* Inline Notes Panel */}
              {expandedNotes.has(po.id) && (
                <DeliveryNotesPanel po={po} onSave={handleSaveNote} />
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="relative z-1 bg-navy-800 border border-blue-900/40 rounded-xl p-16 text-center">
            <Package className="w-16 h-16 mx-auto mb-4 text-slate-600" />
            <p className="text-slate-400 font-medium">
              {search.trim() ? 'No deliveries match your search.' : 'No deliveries matching this filter'}
            </p>
            <button
              onClick={() => { setActiveFilter(null); setSearch(''); }}
              className="relative z-2 mt-4 text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      {/* Pulse keyframe animation */}
      <style>{`
        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.2); }
          100% { transform: scale(1); }
        }
      `}</style>

      {/* ── Supplier Risk Dashboard ────────────────────────────────── */}
      <div className="border-t border-blue-900/40 pt-8 mt-8">
        <div className="flex items-center gap-2 mb-6">
          <ShieldAlert className="w-6 h-6 text-blue-400" />
          <h2 className="text-xl font-bold text-white">Supplier Risk Dashboard</h2>
        </div>

        {riskData.length > 0 ? (
          <>
            {/* 1. KPI Cards */}
            <RiskKPICards data={dashboardData} />

            {/* 2. Risk Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-6">
              <RiskDistributionChart data={riskData} />
              <DeliveryTrendChart pos={pos} />
              <RiskBreakdownChart data={riskData} />
            </div>

            {/* 3. Vendor Ranking + Detail Panel */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-6">
              <VendorRankingTable
                data={riskData}
                selectedVendorId={selectedVendorId}
                onSelect={handleSelectVendor}
              />
              <VendorDetailPanel entry={selectedVendorEntry} pos={pos} />
            </div>

            {/* 4. Insights + Mitigation */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
              <ProcurementInsights data={riskData} />
              <MitigationActions data={riskData} />
            </div>
          </>
        ) : (
          <div className="relative z-1 bg-navy-800 border border-blue-900/40 rounded-xl p-10 text-center">
            <ShieldAlert className="w-12 h-12 mx-auto mb-3 text-slate-600" />
            <p className="text-slate-500 text-sm">No supplier risk data available yet.</p>
            <p className="text-slate-600 text-xs mt-2">Create purchase orders to generate risk analytics.</p>
          </div>
        )}
      </div>
    </div>
  );
}
