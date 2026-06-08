import { useMemo, useState, useCallback, useEffect } from 'react';
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
import {
  Package,
  Clock,
  Truck as TruckIcon,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  FileText,
  Search,
  ChevronDown,
  Check,
  X as XIcon,
  MessageSquare,
} from 'lucide-react';
import {
  getPurchaseOrders,
  upsertPurchaseOrder,
  getDeliveryPerformance,
  saveDeliveryPerformance,
  PurchaseOrder,
  DeliveryPerformance,
  DeliveryNote,
} from '../lib/data';
import { useRefresh } from '../lib/RefreshContext';



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
      <div className="relative z-1 theme-card rounded-xl p-8 text-center">
        <p className="theme-muted text-sm">Not enough data for timeline chart</p>
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
    <div className="relative z-1 theme-card rounded-xl p-4 sm:p-6">
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
    <div className="mt-4 pt-4 border-t border-themed">
      <div className="space-y-2 mb-3">
        {notes.length === 0 ? (
          <p className="text-xs theme-muted italic">No notes yet</p>
        ) : (
          notes.map((note, i) => (
            <div key={i} className="bg-surface-strong rounded-lg p-3">
              <p className="text-[10px] theme-muted mb-1">{formatNoteTimestamp(note.timestamp)}</p>
              <p className="text-sm theme-muted">{note.text}</p>
            </div>
          ))
        )}
      </div>
      <div className="flex gap-2">
        <textarea
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          placeholder="Add a delivery note..."
          className="flex-1 px-3 py-2 theme-input border border-themed rounded-lg theme-text placeholder-muted text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-none"
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

// ── Main Component ────────────────────────────────────────────────────────

export default function Delivery({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('earliest');
  const [perf, setPerf] = useState<Record<string, DeliveryPerformance>>({});
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
  const { refreshKey, triggerRefresh } = useRefresh();

  useEffect(() => {
    Promise.all([getPurchaseOrders(), getDeliveryPerformance()]).then(([p, d]) => {
      setPos(p);
      setPerf(d);
    }).catch(() => {});
  }, [refreshKey]);

  const isDeliveredOrLater = (po: PurchaseOrder) =>
    STATUS_ORDER.indexOf(po.status) >= STATUS_ORDER.indexOf('delivered');

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

  const handleSaveNote = useCallback(async (poId: string, notes: DeliveryNote[]) => {
    const updatedPO = pos.find((po) => po.id === poId);
    if (!updatedPO) return;
    const withNotes = { ...updatedPO, deliveryNotes: notes };
    setPos((prev) => prev.map((po) => po.id === poId ? withNotes : po));
    await upsertPurchaseOrder(withNotes);
    triggerRefresh();
  }, [pos, triggerRefresh]);

  function toggleNotes(poId: string) {
    setExpandedNotes((prev) => {
      const next = new Set(prev);
      if (next.has(poId)) next.delete(poId);
      else next.add(poId);
      return next;
    });
  }

  const advanceStatus = useCallback(async (poId: string) => {
    const updated = pos.map((po) => {
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

    setPos(updated);
    const changedPO = updated.find((po) => po.id === poId);
    if (changedPO) await upsertPurchaseOrder(changedPO);

    const newPerf = { ...perf };
    let changed = false;
    updated.forEach((po) => {
      const extended = po as PurchaseOrder & { actualDeliveryDate?: string };
      if (perf[po.id]) return;
      const perfResult = calcDeliveryPerformance(extended);
      if (perfResult) {
        newPerf[po.id] = perfResult;
        changed = true;
      }
    });
    if (changed) {
      setPerf(newPerf);
      await saveDeliveryPerformance(newPerf);
    }
    triggerRefresh();
  }, [pos, perf, triggerRefresh]);

  const revertStatus = useCallback(async (poId: string) => {
    const updated = pos.map((po) => {
      if (po.id !== poId) return po;
      const idx = STATUS_ORDER.indexOf(po.status);
      if (idx <= 0) return po;
      const prevStatus = STATUS_ORDER[idx - 1];
      const updatedPo: PurchaseOrder & { actualDeliveryDate?: string } = { ...po, status: prevStatus };
      if (po.status === 'delivered') {
        delete (updatedPo as Record<string, unknown>).actualDeliveryDate;
      }
      return updatedPo;
    });

    setPos(updated);
    const changedPO = updated.find((po) => po.id === poId);
    if (changedPO) await upsertPurchaseOrder(changedPO);

    const newPerf = { ...perf };
    let changed = false;
    updated.forEach((po) => {
      if (po.status !== 'delivered' && po.status !== 'invoiced' && perf[po.id]) {
        delete newPerf[po.id];
        changed = true;
      }
    });
    if (changed) {
      setPerf(newPerf);
      await saveDeliveryPerformance(newPerf);
    }
    triggerRefresh();
  }, [pos, perf, triggerRefresh]);

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
          <h1 className="text-2xl font-bold theme-title flex items-center gap-2">
            <Package className="w-7 h-7 text-blue-400" />
            Delivery Tracking
          </h1>
          <p className="theme-muted text-sm mt-1">Track and manage incoming deliveries</p>
        </div>
        <div className="relative z-1 theme-card rounded-xl p-16 text-center">
          <Package className="w-16 h-16 mx-auto mb-4 theme-muted opacity-30" />
          <p className="theme-text font-medium text-lg">No purchase orders yet</p>
          <p className="theme-muted text-sm mt-2">Create one in the Orders page to start tracking deliveries</p>
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
        <h1 className="text-2xl font-bold theme-title flex items-center gap-2">
          <Package className="w-7 h-7 text-blue-400" />
          Delivery Tracking
        </h1>
        <p className="theme-muted text-sm mt-1">Track and manage incoming deliveries</p>
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
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 theme-muted" />
          <input
            type="text"
            placeholder="Search by PO number or vendor name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-10 py-2.5 bg-surface border border-themed rounded-lg theme-text placeholder-muted text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 relative z-2"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 theme-muted hover:theme-title transition-colors"
            >
              <XIcon className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="relative flex items-center gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="theme-select border border-themed rounded-lg px-3 py-2.5 theme-text text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 appearance-none relative z-2 pr-8"
          >
            {(Object.keys(sortLabels) as SortOption[]).map((key) => (
              <option key={key} value={key}>{sortLabels[key]}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 theme-muted pointer-events-none" />
        </div>
      </div>

      {/* Gantt Timeline Chart - Already has theme styling in component */}
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

                  {/* Status Action Buttons */}
                  <div className="flex items-center gap-2">
                    {po.status !== 'ordered' && (
                      <button
                        onClick={() => revertStatus(po.id)}
                        className="relative z-2 flex items-center gap-1.5 px-3.5 py-2 bg-navy-700 hover:bg-navy-600 border border-blue-900/40 text-slate-300 hover:text-white text-xs font-semibold rounded-lg transition-colors"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        Revert
                      </button>
                    )}
                    {po.status !== 'invoiced' && (
                      <button
                        onClick={() => advanceStatus(po.id)}
                        className="relative z-2 flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition-colors shadow-lg shadow-blue-900/20"
                      >
                        <ArrowRight className="w-3.5 h-3.5" />
                        Advance
                      </button>
                    )}
                  </div>

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
          <div className="relative z-1 theme-card rounded-xl p-16 text-center">
            <Package className="w-16 h-16 mx-auto mb-4 theme-muted opacity-30" />
            <p className="theme-text font-medium">
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
    </div>
  );
}
