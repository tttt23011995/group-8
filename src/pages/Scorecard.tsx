import { useMemo, useState } from 'react';
import { Radar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';
import {
  BarChart3,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  X,
} from 'lucide-react';
import {
  getVendors,
  getVendorRatings,
  getPurchaseOrders,
  Vendor,
} from '../lib/data';

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

// ── Risk Data Model ──────────────────────────────────────────────────────

interface LegacySupplierRiskEntry {
  vendorId: string;
  vendorName: string;
  category: string;
  overallRiskScore: number;
  riskLevel: 'Low' | 'Medium' | 'High';
  dependencyRiskScore: number;
  costConcentrationRiskScore: number;
  performanceRiskScore: number;
  contractRiskScore: number;
}

function buildSupplierRiskData(): LegacySupplierRiskEntry[] {
  const vendors = getVendors();
  const pos = getPurchaseOrders();
  const ratings = getVendorRatings();

  return vendors.map((v) => {
    const r = ratings.find((rt) => rt.vendorId === v.id);
    const vendorPOs = pos.filter((p) => p.vendorId === v.id);
    const totalSpend = vendorPOs.reduce((s, p) => s + p.total, 0);
    const allSpend = pos.reduce((s, p) => s + p.total, 0);
    const spendShare = allSpend > 0 ? totalSpend / allSpend : 0;

    // Dependency risk: more alternative vendors in same category = lower risk
    const sameCategory = vendors.filter(
      (vr) => vr.category === v.category && vr.id !== v.id && vr.status === 'active'
    ).length;
    const dependencyRiskScore = sameCategory >= 3 ? 2 : sameCategory >= 2 ? 6 : sameCategory >= 1 ? 10 : 15;

    // Cost concentration risk: higher spend share = higher risk
    const costConcentrationRiskScore = Math.min(15, Math.round(spendShare * 50));

    // Performance risk: based on score and delivery
    let performanceRiskScore = 0;
    if (v.score < 60) performanceRiskScore += 20;
    else if (v.score < 70) performanceRiskScore += 15;
    else if (v.score < 80) performanceRiskScore += 8;
    else if (v.score < 90) performanceRiskScore += 3;

    if (r && r.delivery < 70) performanceRiskScore += 15;
    else if (r && r.delivery < 80) performanceRiskScore += 8;

    if (r && r.quality < 70) performanceRiskScore += 15;
    else if (r && r.quality < 80) performanceRiskScore += 8;
    performanceRiskScore = Math.min(35, performanceRiskScore);

    // Contract risk
    let contractRiskScore = 0;
    const contractEnd = new Date(v.contractEnd);
    const daysLeft = Math.ceil((contractEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysLeft < 0) contractRiskScore += 15;
    else if (daysLeft < 60) contractRiskScore += 12;
    else if (daysLeft < 180) contractRiskScore += 6;
    if (v.status === 'inactive') contractRiskScore += 15;
    else if (v.status === 'under-review') contractRiskScore += 8;
    contractRiskScore = Math.min(35, contractRiskScore);

    const overallRiskScore = dependencyRiskScore + costConcentrationRiskScore + performanceRiskScore + contractRiskScore;

    let riskLevel: LegacySupplierRiskEntry['riskLevel'];
    if (overallRiskScore >= 40) riskLevel = 'High';
    else if (overallRiskScore >= 20) riskLevel = 'Medium';
    else riskLevel = 'Low';

    return {
      vendorId: v.id,
      vendorName: v.name,
      category: v.category,
      overallRiskScore,
      riskLevel,
      dependencyRiskScore,
      costConcentrationRiskScore,
      performanceRiskScore,
      contractRiskScore,
    };
  });
}

// ── Helpers ──────────────────────────────────────────────────────────────

function scoreColor(score: number): { text: string; bg: string; bar: string } {
  if (score >= 85) return { text: 'text-emerald-400', bg: 'bg-emerald-500', bar: 'bg-emerald-500/30' };
  if (score >= 70) return { text: 'text-yellow-400', bg: 'bg-yellow-500', bar: 'bg-yellow-500/30' };
  return { text: 'text-red-400', bg: 'bg-red-500', bar: 'bg-red-500/30' };
}

function riskLevelConfig(level: LegacySupplierRiskEntry['riskLevel']) {
  switch (level) {
    case 'High':
      return { icon: AlertTriangle, color: 'text-red-400', badge: 'bg-red-500/20 text-red-400 border-red-500/30', bg: 'bg-red-500/10 border-red-500/20' };
    case 'Medium':
      return { icon: AlertCircle, color: 'text-yellow-400', badge: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', bg: 'bg-yellow-500/10 border-yellow-500/20' };
    case 'Low':
      return { icon: CheckCircle, color: 'text-emerald-400', badge: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', bg: 'bg-emerald-500/10 border-emerald-500/20' };
  }
}

// ── Risk Distribution Chart ──────────────────────────────────────────────

function RiskDistributionChart({ data }: { data: LegacySupplierRiskEntry[] }) {
  const counts = useMemo(() => {
    const c = { low: 0, medium: 0, high: 0 };
    data.forEach(({ riskLevel }) => {
      if (riskLevel === 'Low') c.low++;
      else if (riskLevel === 'Medium') c.medium++;
      else c.high++;
    });
    return c;
  }, [data]);

  return (
    <div className="grid grid-cols-3 gap-3">
      {(['Low', 'Medium', 'High'] as const).map((level) => {
        const cfg = riskLevelConfig(level);
        const Icon = cfg.icon;
        const count = level === 'Low' ? counts.low : level === 'Medium' ? counts.medium : counts.high;
        return (
          <div key={level} className={`relative z-1 rounded-xl border p-4 ${cfg.bg}`}>
            <div className="flex items-center gap-2 mb-2">
              <Icon className={`w-4 h-4 ${cfg.color}`} />
              <span className={`text-xs font-semibold ${cfg.color}`}>{level} Risk</span>
            </div>
            <p className="text-2xl font-bold text-white">{count}</p>
          </div>
        );
      })}
    </div>
  );
}

// ── Vendor Detail Panel ──────────────────────────────────────────────────

function VendorDetailPanel({
  vendor,
  risk,
  onClose,
}: {
  vendor: Vendor;
  risk: LegacySupplierRiskEntry;
  onClose: () => void;
}) {
  const ratings = useMemo(() => getVendorRatings(), []);
  const r = ratings.find((rt) => rt.vendorId === vendor.id);
  const c = scoreColor(vendor.score);

  const riskBreakdown = [
    { label: 'Dependency', score: risk.dependencyRiskScore, max: 15 },
    { label: 'Cost Concentration', score: risk.costConcentrationRiskScore, max: 15 },
    { label: 'Performance', score: risk.performanceRiskScore, max: 35 },
    { label: 'Contract', score: risk.contractRiskScore, max: 35 },
  ];

  const radarData = {
    labels: ['Quality', 'Delivery', 'Cost', 'Responsiveness'],
    datasets: [
      {
        label: vendor.name,
        data: r
          ? [r.quality, r.delivery, r.cost, r.responsiveness]
          : [vendor.score, vendor.score, vendor.score, vendor.score],
        backgroundColor: 'rgba(59, 130, 246, 0.15)',
        borderColor: 'rgba(59, 130, 246, 0.8)',
        borderWidth: 2,
        pointBackgroundColor: 'rgba(59, 130, 246, 1)',
        pointRadius: 3,
      },
    ],
  };

  const radarOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      r: {
        beginAtZero: true,
        max: 100,
        ticks: { stepSize: 20, color: '#64748b', backdropColor: 'transparent' },
        grid: { color: 'rgba(30, 58, 95, 0.5)' },
        pointLabels: { color: '#94a3b8', font: { size: 11 } },
        angleLines: { color: 'rgba(30, 58, 95, 0.5)' },
      },
    },
  };

  return (
    <div className="fixed inset-0 z-[200]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="absolute right-0 top-0 h-full w-[400px] bg-navy-800 border-l border-blue-900/40 shadow-2xl overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-navy-800 px-5 py-4 border-b border-blue-900/40 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white truncate pr-4">{vendor.name}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors flex-shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-6">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-blue-400">{vendor.category}</span>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${riskLevelConfig(risk.riskLevel).badge}`}>
              {risk.riskLevel} Risk
            </span>
          </div>

          <div className="h-44">
            <Radar data={radarData} options={radarOptions} />
          </div>

          <div className="text-center">
            <p className={`text-3xl font-bold ${c.text}`}>{vendor.score}</p>
            <p className="text-xs text-slate-500">Overall Score</p>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Risk Score Breakdown</h3>
            <div className="space-y-3">
              {riskBreakdown.map((item) => {
                const pct = Math.round((item.score / item.max) * 100);
                const riskColor = pct >= 70 ? 'text-red-400' : pct >= 40 ? 'text-yellow-400' : 'text-emerald-400';
                const riskBarColor = pct >= 70 ? 'bg-red-500' : pct >= 40 ? 'bg-yellow-500' : 'bg-emerald-500';
                const riskBarBg = pct >= 70 ? 'bg-red-500/30' : pct >= 40 ? 'bg-yellow-500/30' : 'bg-emerald-500/30';
                return (
                  <div key={item.label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-slate-400">{item.label}</span>
                      <span className={`text-sm font-semibold ${riskColor}`}>{item.score}/{item.max}</span>
                    </div>
                    <div className={`w-full h-1.5 rounded-full ${riskBarBg}`}>
                      <div
                        className={`h-full ${riskBarColor} rounded-full transition-all duration-500`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-blue-900/30">
              <span className="text-sm text-white font-semibold">Total Risk Score</span>
              <span className={`text-lg font-bold ${riskLevelConfig(risk.riskLevel).color}`}>
                {risk.overallRiskScore}/100
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── KPI Data ─────────────────────────────────────────────────────────────

function computeKPIData(riskData: LegacySupplierRiskEntry[]) {
  const totalVendors = riskData.length;
  const highRiskVendors = riskData.filter((r) => r.riskLevel === 'High').length;
  const avgRiskScore = totalVendors
    ? Math.round(riskData.reduce((s, r) => s + r.overallRiskScore, 0) / totalVendors)
    : 0;

  return { totalVendors, highRiskVendors, avgRiskScore };
}

// ── Main Component ───────────────────────────────────────────────────────

export default function Scorecard() {
  const vendors = useMemo(() => getVendors(), []);
  const ratings = useMemo(() => getVendorRatings(), []);
  const riskData = useMemo(() => buildSupplierRiskData(), []);

  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  const [riskFilter, setRiskFilter] = useState<string>('all');

  const enriched = useMemo(
    () =>
      vendors.map((v) => {
        const r = ratings.find((rt) => rt.vendorId === v.id);
        return {
          ...v,
          rating: r || { quality: v.score, delivery: v.score, cost: v.score, responsiveness: v.score, overall: v.score },
        };
      }),
    [vendors, ratings]
  );

  const kpi = useMemo(() => computeKPIData(riskData), [riskData]);

  const filtered = useMemo(() => {
    if (riskFilter === 'all') return enriched;
    const risk = riskData.filter((r) => r.riskLevel === riskFilter);
    const riskIds = new Set(risk.map((r) => r.vendorId));
    return enriched.filter((v) => riskIds.has(v.id));
  }, [enriched, riskData, riskFilter]);

  const selectedVendor = selectedVendorId
    ? vendors.find((v) => v.id === selectedVendorId)
    : null;
  const selectedRisk = selectedVendorId
    ? riskData.find((r) => r.vendorId === selectedVendorId)
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <BarChart3 className="w-7 h-7 text-blue-400" />
          Vendor Scorecard
        </h1>
        <p className="text-slate-400 text-sm mt-1">Performance metrics across quality, delivery, cost, and responsiveness</p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="relative z-1 bg-navy-800 border border-blue-900/40 rounded-xl p-4">
          <p className="text-xs text-slate-400">Total Vendors</p>
          <p className="text-2xl font-bold text-white mt-1">{kpi.totalVendors}</p>
        </div>
        <div className="relative z-1 bg-navy-800 border border-blue-900/40 rounded-xl p-4">
          <p className="text-xs text-slate-400">High Risk Vendors</p>
          <p className="text-2xl font-bold text-red-400 mt-1">{kpi.highRiskVendors}</p>
        </div>
        <div className="relative z-1 bg-navy-800 border border-blue-900/40 rounded-xl p-4">
          <p className="text-xs text-slate-400">Avg Risk Score</p>
          <p className="text-2xl font-bold text-white mt-1">{kpi.avgRiskScore}<span className="text-lg text-slate-500">/100</span></p>
        </div>
        <div className="relative z-1 bg-navy-800 border border-blue-900/40 rounded-xl p-4">
          <p className="text-xs text-slate-400">Risk Distribution</p>
          <RiskDistributionChart data={riskData} />
        </div>
      </div>

      {/* Risk Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        {['all', 'Low', 'Medium', 'High'].map((f) => (
          <button
            key={f}
            onClick={() => setRiskFilter(f)}
            className={`relative z-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              riskFilter === f
                ? 'bg-blue-600 text-white'
                : 'bg-navy-700 text-slate-400 hover:text-white border border-blue-900/40'
            }`}
          >
            {f === 'all' ? 'All Vendors' : `${f} Risk`}
          </button>
        ))}
      </div>

      {/* Vendor Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filtered.map((v) => {
          const r = v.rating;
          const risk = riskData.find((rd) => rd.vendorId === v.id);
          const metrics = [
            { label: 'Quality', value: r.quality },
            { label: 'Delivery', value: r.delivery },
            { label: 'Cost', value: r.cost },
            { label: 'Responsiveness', value: r.responsiveness },
          ];
          const c = scoreColor(v.score);
          const riskCfg = risk ? riskLevelConfig(risk.riskLevel) : null;

          const radarData = {
            labels: ['Quality', 'Delivery', 'Cost', 'Responsiveness'],
            datasets: [
              {
                label: v.name,
                data: [r.quality, r.delivery, r.cost, r.responsiveness],
                backgroundColor: 'rgba(59, 130, 246, 0.15)',
                borderColor: 'rgba(59, 130, 246, 0.8)',
                borderWidth: 2,
                pointBackgroundColor: 'rgba(59, 130, 246, 1)',
                pointRadius: 3,
              },
            ],
          };

          const radarOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              r: {
                beginAtZero: true,
                max: 100,
                ticks: { stepSize: 20, color: '#64748b', backdropColor: 'transparent' },
                grid: { color: 'rgba(30, 58, 95, 0.5)' },
                pointLabels: { color: '#94a3b8', font: { size: 11 } },
                angleLines: { color: 'rgba(30, 58, 95, 0.5)' },
              },
            },
          };

          return (
            <div
              key={v.id}
              className="relative z-1 bg-navy-800 border border-blue-900/40 rounded-xl p-6 transition-shadow duration-300 hover:shadow-lg hover:shadow-blue-900/20 cursor-pointer"
              onClick={() => setSelectedVendorId(v.id)}
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-white font-semibold text-lg">{v.name}</h3>
                  <p className="text-xs text-blue-400 mt-0.5">{v.category}</p>
                </div>
                <div className="flex items-center gap-3">
                  {riskCfg && risk && (
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${riskCfg.badge}`}>
                      {risk.riskLevel} Risk
                    </span>
                  )}
                  <div className="text-right">
                    <p className={`text-3xl font-bold ${c.text}`}>{v.score}</p>
                    <p className="text-xs text-slate-500">Overall Score</p>
                  </div>
                </div>
              </div>

              <div className="h-44 mb-4">
                {typeof ChartJS !== 'undefined' ? (
                  <Radar data={radarData} options={radarOptions} />
                ) : (
                  <div className="space-y-2">
                    {metrics.map((m) => (
                      <div key={m.label} className="flex items-center gap-2">
                        <span className="text-xs text-slate-400 w-28">{m.label}</span>
                        <div className="flex-1 h-2 bg-navy-700 rounded-full overflow-hidden">
                          <div className={`h-full ${c.bg} rounded-full`} style={{ width: `${m.value}%` }} />
                        </div>
                        <span className="text-xs text-slate-300 w-8">{m.value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-4 gap-2">
                {metrics.map((m) => {
                  const mc = scoreColor(m.value);
                  return (
                    <div key={m.label} className="text-center">
                      <div className={`w-full h-1.5 rounded-full ${mc.bar} mb-1.5`}>
                        <div
                          className={`h-full ${mc.bg} rounded-full transition-all duration-500`}
                          style={{ width: `${m.value}%` }}
                        />
                      </div>
                      <p className={`text-sm font-bold ${mc.text}`}>{m.value}</p>
                      <p className="text-[10px] text-slate-500">{m.label}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Vendor Detail Panel */}
      {selectedVendor && selectedRisk && (
        <VendorDetailPanel
          vendor={selectedVendor}
          risk={selectedRisk}
          onClose={() => setSelectedVendorId(null)}
        />
      )}
    </div>
  );
}
