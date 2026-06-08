import { useMemo, useState } from 'react';
import { ShieldAlert, AlertTriangle, AlertCircle, Info, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { getVendors, getPurchaseOrders, getVendorRatings } from '../lib/data';

interface RiskItem {
  vendorId: string;
  vendorName: string;
  category: string;
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
  riskScore: number;
  factors: string[];
  trend: 'up' | 'down' | 'stable';
}

const riskConfig = {
  critical: { icon: ShieldAlert, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20', badge: 'bg-red-500/20 text-red-400 border-red-500/30' },
  high: { icon: AlertTriangle, color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20', badge: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  medium: { icon: AlertCircle, color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20', badge: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  low: { icon: Info, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', badge: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
};

const trendIcons = { up: TrendingUp, down: TrendingDown, stable: Minus };
const trendColors = { up: 'text-red-400', down: 'text-emerald-400', stable: 'text-slate-400' };

function analyzeRisks(): RiskItem[] {
  const vendors = getVendors();
  const pos = getPurchaseOrders();
  const ratings = getVendorRatings();

  return vendors.map((v) => {
    const r = ratings.find((rt) => rt.vendorId === v.id);
    const vendorPOs = pos.filter((p) => p.vendorId === v.id);
    const overduePOs = vendorPOs.filter((p) => p.status === 'overdue').length;
    const factors: string[] = [];
    let riskScore = 0;

    if (v.score < 70) { factors.push('Low overall vendor score'); riskScore += 25; }
    else if (v.score < 80) { factors.push('Below-average vendor score'); riskScore += 10; }

    if (r && r.delivery < 75) { factors.push('Poor delivery reliability'); riskScore += 20; }
    if (r && r.quality < 75) { factors.push('Quality concerns detected'); riskScore += 20; }
    if (overduePOs > 0) { factors.push(`${overduePOs} overdue POs`); riskScore += 20; }

    if (v.status === 'inactive') { factors.push('Vendor account inactive'); riskScore += 15; }
    if (v.status === 'under-review') { factors.push('Vendor under review'); riskScore += 10; }

    const contractEnd = new Date(v.contractEnd);
    const daysLeft = Math.ceil((contractEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysLeft < 60) { factors.push('Contract expiring soon'); riskScore += 10; }

    if (factors.length === 0) { factors.push('No significant risks identified'); }

    riskScore = Math.min(100, riskScore);

    let riskLevel: RiskItem['riskLevel'];
    if (riskScore >= 60) riskLevel = 'critical';
    else if (riskScore >= 40) riskLevel = 'high';
    else if (riskScore >= 20) riskLevel = 'medium';
    else riskLevel = 'low';

    const trend: RiskItem['trend'] = riskScore >= 40 ? 'up' : riskScore >= 20 ? 'stable' : 'down';

    return { vendorId: v.id, vendorName: v.name, category: v.category, riskLevel, riskScore, factors, trend };
  }).sort((a, b) => b.riskScore - a.riskScore);
}

export default function AIRisk() {
  const risks = useMemo(() => analyzeRisks(), []);
  const [filter, setFilter] = useState<string>('all');

  const filtered = filter === 'all' ? risks : risks.filter((r) => r.riskLevel === filter);

  const summary = useMemo(() => ({
    critical: risks.filter((r) => r.riskLevel === 'critical').length,
    high: risks.filter((r) => r.riskLevel === 'high').length,
    medium: risks.filter((r) => r.riskLevel === 'medium').length,
    low: risks.filter((r) => r.riskLevel === 'low').length,
  }), [risks]);

  const avgRisk = risks.length ? Math.round(risks.reduce((s, r) => s + r.riskScore, 0) / risks.length) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">AI Risk Analysis</h1>
        <p className="text-slate-400 text-sm mt-1">Automated vendor risk assessment and early warning system</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="relative z-1 bg-navy-800 border border-blue-900/40 rounded-xl p-4 lg:col-span-1">
          <p className="text-xs text-slate-400">Average Risk Score</p>
          <p className="text-3xl font-bold text-white mt-1">{avgRisk}<span className="text-lg text-slate-500">/100</span></p>
        </div>
        {(['critical', 'high', 'medium', 'low'] as const).map((level) => {
          const cfg = riskConfig[level];
          return (
            <div key={level} className="relative z-1 bg-navy-800 border border-blue-900/40 rounded-xl p-4">
              <div className="flex items-center gap-2">
                <cfg.icon className={`w-4 h-4 ${cfg.color}`} />
                <span className="text-xs text-slate-400 capitalize">{level}</span>
              </div>
              <p className="text-2xl font-bold text-white mt-1">{summary[level]}</p>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {['all', 'critical', 'high', 'medium', 'low'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`relative z-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === f
                ? 'bg-blue-600 text-white'
                : 'bg-navy-700 text-slate-400 hover:text-white border border-blue-900/40'
            }`}
          >
            {f === 'all' ? 'All Risks' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {filtered.map((risk) => {
          const cfg = riskConfig[risk.riskLevel];
          const TrendIcon = trendIcons[risk.trend];
          return (
            <div
              key={risk.vendorId}
              className={`relative z-1 rounded-xl border p-5 ${cfg.bg}`}
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <cfg.icon className={`w-6 h-6 mt-0.5 flex-shrink-0 ${cfg.color}`} />
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-white font-semibold">{risk.vendorName}</h3>
                      <span className="text-xs text-blue-400">{risk.category}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.badge}`}>
                        {risk.riskLevel.charAt(0).toUpperCase() + risk.riskLevel.slice(1)}
                      </span>
                    </div>
                    <ul className="mt-2 space-y-1">
                      {risk.factors.map((f, i) => (
                        <li key={i} className="text-sm text-slate-400 flex items-center gap-1.5">
                          <span className="w-1 h-1 rounded-full bg-slate-500 flex-shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div className="flex items-center gap-4 sm:flex-col sm:items-end">
                  <div className="text-right">
                    <p className="text-xs text-slate-500">Risk Score</p>
                    <p className={`text-2xl font-bold ${cfg.color}`}>{risk.riskScore}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <TrendIcon className={`w-4 h-4 ${trendColors[risk.trend]}`} />
                    <span className={`text-xs ${trendColors[risk.trend]}`}>
                      {risk.trend === 'up' ? 'Increasing' : risk.trend === 'down' ? 'Decreasing' : 'Stable'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="relative z-1 text-center py-12 text-slate-500">
            <ShieldAlert className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No risks matching this filter</p>
          </div>
        )}
      </div>
    </div>
  );
}
