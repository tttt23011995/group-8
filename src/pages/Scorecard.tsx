import { useMemo, useState, useCallback } from 'react';
import { Chart } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import {
  ShieldAlert,
  Users,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Clock,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  Activity,
  Package,
  X,
} from 'lucide-react';
import {
  getPurchaseOrders,
  getDeliveryPerformance,
  getVendors,
  PurchaseOrder,
} from '../lib/data';
import {
  buildSupplierRiskData,
  SupplierRiskEntry,
  SupplierRisk,
} from '../lib/supplierRisk';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// ── Risk Configuration ────────────────────────────────────────────────────

function riskConfig(level: 'Low' | 'Medium' | 'High') {
  switch (level) {
    case 'High':
      return {
        badge: 'bg-red-500/20 text-red-400 border-red-500/30',
        bar: 'bg-red-500',
        text: 'text-red-400',
        bg: 'bg-red-500/10 border-red-500/25',
        icon: AlertTriangle,
      };
    case 'Medium':
      return {
        badge: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
        bar: 'bg-amber-500',
        text: 'text-amber-400',
        bg: 'bg-amber-500/10 border-amber-500/25',
        icon: TrendingDown,
      };
    case 'Low':
      return {
        badge: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
        bar: 'bg-emerald-500',
        text: 'text-emerald-400',
        bg: 'bg-emerald-500/10 border-emerald-500/25',
        icon: TrendingUp,
      };
  }
}

// ── KPI Data ──────────────────────────────────────────────────────────────

interface KPIData {
  totalVendors: number;
  highRiskVendors: number;
  lateDeliveryRate: number;
  avgRiskScore: number;
}

function computeKPIData(riskData: SupplierRiskEntry[], pos: PurchaseOrder[]): KPIData {
  const totalVendors = riskData.length;
  const highRiskVendors = riskData.filter(r => r.risk.riskLevel === 'High').length;

  const delivered = pos.filter(p => p.status === 'delivered' || p.status === 'invoiced');
  const perfMap = getDeliveryPerformance();
  let lateCount = 0;
  delivered.forEach(po => {
    const perf = perfMap[po.id];
    if (perf && !perf.onTime) lateCount++;
  });
  const lateDeliveryRate = delivered.length > 0 ? Math.round((lateCount / delivered.length) * 100) : 0;

  const avgRiskScore = riskData.length > 0
    ? Math.round(riskData.reduce((s, r) => s + r.risk.overallRiskScore, 0) / riskData.length)
    : 0;

  return { totalVendors, highRiskVendors, lateDeliveryRate, avgRiskScore };
}

// ── Components ────────────────────────────────────────────────────────────

function KPICards({ data }: { data: KPIData }) {
  const kpis = [
    { label: 'Total Vendors', value: data.totalVendors, icon: Users, color: '#3b82f6' },
    { label: 'High Risk Vendors', value: data.highRiskVendors, icon: AlertTriangle, color: '#ef4444' },
    { label: 'Late Delivery Rate', value: `${data.lateDeliveryRate}%`, icon: Clock, color: '#f97316' },
    { label: 'Avg Risk Score', value: `${data.avgRiskScore}/100`, icon: ShieldAlert, color: '#8b5cf6' },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {kpis.map((kpi) => {
        const Icon = kpi.icon;
        return (
          <div
            key={kpi.label}
            className="relative z-1 bg-navy-800 border border-blue-900/40 rounded-xl overflow-hidden transition-shadow duration-300 hover:shadow-lg hover:shadow-blue-900/20"
            style={{ borderLeft: '4px solid', borderLeftColor: kpi.color }}
          >
            <div className="p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-slate-400 font-medium">{kpi.label}</p>
                  <p className="text-xl sm:text-2xl font-bold text-white mt-1">{kpi.value}</p>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-white/5 flex items-center justify-center">
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

function RiskDistributionChart({ data }: { data: SupplierRiskEntry[] }) {
  const counts = { low: 0, medium: 0, high: 0 };
  data.forEach(({ risk }) => {
    if (risk.riskLevel === 'Low') counts.low++;
    else if (risk.riskLevel === 'Medium') counts.medium++;
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
        labels: { color: '#94a3b8', font: { size: 11 }, usePointStyle: true, padding: 16 }
      },
      tooltip: {
        backgroundColor: '#0f2244',
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
          <Chart type="pie" data={chartData} options={options as never} />
        ) : (
          <div className="h-full flex items-center justify-center text-slate-500 text-sm">
            No vendor data available
          </div>
        )}
      </div>
    </div>
  );
}

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

function VendorRankingTable({
  data,
  selectedVendorId,
  onSelect
}: {
  data: SupplierRiskEntry[];
  selectedVendorId: string | null;
  onSelect: (vendorId: string) => void;
}) {
  // Sort by risk score descending
  const sorted = [...data].sort((a, b) => b.risk.overallRiskScore - a.risk.overallRiskScore);

  return (
    <div className="relative z-1 bg-navy-800 border border-blue-900/40 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-blue-900/40">
        <h3 className="text-sm font-bold text-white">Vendor Risk Ranking</h3>
        <p className="text-xs text-slate-500 mt-0.5">Click to view vendor details</p>
      </div>

      {/* Desktop */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-navy-800 border-b border-blue-900/30">
            <tr>
              <th className="px-4 py-3 text-left text-slate-500 font-medium">Vendor</th>
              <th className="px-4 py-3 text-center text-slate-500 font-medium">Risk Score</th>
              <th className="px-4 py-3 text-center text-slate-500 font-medium">Risk Level</th>
              <th className="px-4 py-3 text-left text-slate-500 font-medium">Main Risk Category</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(({ metrics, risk }) => {
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
                        <div className={`h-full ${cfg.bar} rounded-full`} style={{ width: `${risk.overallRiskScore}%` }} />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.badge}`}>
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

      {/* Mobile */}
      <div className="block md:hidden divide-y divide-blue-900/20">
        {sorted.map(({ metrics, risk }) => {
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
                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${cfg.badge}`}>
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

function DeliveryTrendChart({ pos }: { pos: PurchaseOrder[] }) {
  const perfMap = getDeliveryPerformance();

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
        callbacks: {
          label: (ctx: { parsed: { y: number } }) => ` ${ctx.parsed.y}% on-time`
        }
      }
    },
    scales: {
      x: { ticks: { color: '#64748b' }, grid: { color: 'rgba(30, 58, 95, 0.5)' } },
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
      <h3 className="text-sm font-bold text-white mb-4">Delivery Performance Trend</h3>
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

function RiskBreakdownChart({ data }: { data: SupplierRiskEntry[] }) {
  if (data.length === 0) {
    return (
      <div className="relative z-1 bg-navy-800 border border-blue-900/40 rounded-xl p-4 sm:p-5">
        <h3 className="text-sm font-bold text-white mb-4">Risk Breakdown</h3>
        <div className="h-[200px] flex items-center justify-center text-slate-500 text-sm">
          No data available
        </div>
      </div>
    );
  }

  const avgDeliveryDelay = data.reduce((s, r) => s + r.risk.deliveryDelayRiskScore, 0) / data.length;
  const avgLeadTime = data.reduce((s, r) => s + r.risk.leadTimeRiskScore, 0) / data.length;
  const avgDependency = data.reduce((s, r) => s + r.risk.supplierDependencyRiskScore, 0) / data.length;
  const avgPerformance = data.reduce((s, r) => s + r.risk.supplierPerformanceRiskScore, 0) / data.length;

  const chartData = {
    labels: ['Delivery Delay', 'Lead Time Variability', 'Dependency Risk', 'Performance Deterioration'],
    datasets: [{
      label: 'Avg Score',
      data: [avgDeliveryDelay, avgLeadTime, avgDependency, avgPerformance],
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
      x: { ticks: { color: '#94a3b8', font: { size: 9 } }, grid: { color: 'rgba(30, 58, 95, 0.5)' } },
      y: { ticks: { color: '#64748b' }, grid: { color: 'rgba(30, 58, 95, 0.5)' } }
    }
  };

  return (
    <div className="relative z-1 bg-navy-800 border border-blue-900/40 rounded-xl p-4 sm:p-5">
      <h3 className="text-sm font-bold text-white mb-4">Risk Breakdown</h3>
      <div className="h-[200px]">
        <Chart type="bar" data={chartData} options={options as never} />
      </div>
    </div>
  );
}

function VendorDetailPanel({
  entry,
  onClose,
}: {
  entry: SupplierRiskEntry | null;
  onClose: () => void;
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
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.badge}`}>
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

      {/* Detected Risks */}
      {risk.detectedRiskTypes.length > 0 && (
        <div className="px-5 pb-4">
          <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-2">Detected Risks</p>
          <div className="flex flex-wrap gap-1.5">
            {risk.detectedRiskTypes.map((t) => {
              const colorMap: Record<string, string> = {
                'Delivery Delay Risk': 'bg-red-500/15 text-red-400 border-red-500/25',
                'Lead Time Risk': 'bg-orange-500/15 text-orange-400 border-orange-500/25',
                'Supplier Dependency Risk': 'bg-violet-500/15 text-violet-400 border-violet-500/25',
                'Cost Concentration Risk': 'bg-amber-500/15 text-amber-400 border-amber-500/25',
                'Supplier Performance Risk': 'bg-blue-500/15 text-blue-400 border-blue-500/25',
              };
              const cls = colorMap[t] ?? 'bg-slate-500/15 text-slate-400 border-slate-500/25';
              return (
                <span key={t} className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold border ${cls}`}>
                  {t}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Risk Score Breakdown */}
      <div className="px-5 pb-5 space-y-3">
        <p className="text-[10px] text-slate-500 uppercase tracking-wide">Risk Score Breakdown</p>
        {[
          { label: 'Delivery Delay', score: risk.deliveryDelayRiskScore, max: 30 },
          { label: 'Lead Time', score: risk.leadTimeRiskScore, max: 20 },
          { label: 'Dependency', score: risk.supplierDependencyRiskScore, max: 20 },
          { label: 'Cost Concentration', score: risk.costConcentrationRiskScore, max: 15 },
          { label: 'Performance', score: risk.supplierPerformanceRiskScore, max: 15 },
        ].map((rb) => (
          <div key={rb.label}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-slate-400">{rb.label}</span>
              <span className="text-xs font-bold text-white">{rb.score}/{rb.max}</span>
            </div>
            <div className="w-full h-1.5 bg-navy-700 rounded-full overflow-hidden">
              <div
                className={`h-full ${cfg.bar} rounded-full transition-all duration-700`}
                style={{ width: `${(rb.score / rb.max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────

export default function Scorecard() {
  const vendors = useMemo(() => getVendors(), []);
  const pos = useMemo(() => getPurchaseOrders(), []);
  const riskData = useMemo(() => buildSupplierRiskData(), []);
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(() => {
    return riskData.length > 0 ? riskData[0].risk.vendorId : null;
  });

  const kpiData = useMemo(() => computeKPIData(riskData, pos), [riskData, pos]);
  const selectedEntry = useMemo(
    () => riskData.find(d => d.risk.vendorId === selectedVendorId) || null,
    [riskData, selectedVendorId]
  );

  const handleSelectVendor = useCallback((vendorId: string) => {
    setSelectedVendorId(vendorId);
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <ShieldAlert className="w-7 h-7 text-blue-400" />
          Vendor Risk Scorecard
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Monitor supplier risk levels and performance metrics
        </p>
      </div>

      {/* 1. KPI Cards */}
      <KPICards data={kpiData} />

      {/* 2. Risk Distribution + Delivery Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RiskDistributionChart data={riskData} />
        <DeliveryTrendChart pos={pos} />
      </div>

      {/* 3. Vendor Ranking + Detail Panel */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <VendorRankingTable
          data={riskData}
          selectedVendorId={selectedVendorId}
          onSelect={handleSelectVendor}
        />
        <VendorDetailPanel entry={selectedEntry} onClose={() => setSelectedVendorId(null)} />
      </div>

      {/* 5. Risk Breakdown Chart */}
      <RiskBreakdownChart data={riskData} />

      {/* Empty state */}
      {riskData.length === 0 && (
        <div className="relative z-1 bg-navy-800 border border-blue-900/40 rounded-xl p-10 text-center">
          <Package className="w-12 h-12 mx-auto mb-3 text-slate-600" />
          <p className="text-slate-500 text-sm">No vendor risk data available yet.</p>
          <p className="text-slate-600 text-xs mt-2">Add purchase orders to generate risk analytics.</p>
        </div>
      )}
    </div>
  );
}
