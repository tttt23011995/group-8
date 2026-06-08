import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  Search,
  ChevronDown,
  Loader2,
  RotateCcw,
  ChevronRight,
  History,
  X,
  Info,
  Eye,
  EyeOff,
  Lock,
  Key,
  Database,
} from 'lucide-react';
import { getVendors, Vendor, getPurchaseOrders, getVendorRatings, getDeliveryPerformance, getOpenPOCountForVendor } from '../lib/data';
import {
  buildSupplierRiskData,
  RiskCategory,
  LegacySupplierMetrics,
  LegacySupplierRisk,
  LegacySupplierRiskEntry,
  getSupplierRisk,
} from '../lib/supplierRisk';

// ── Safe math helpers ─────────────────────────────────────────────────────

function safeNumber(v: unknown, fallback = 0): number {
  const n = Number(v);
  return isFinite(n) ? n : fallback;
}

function safeDivide(a: number, b: number): number {
  if (!isFinite(b) || b === 0) return 0;
  const r = a / b;
  return isFinite(r) ? r : 0;
}

function safeAverage(arr: number[]): number {
  if (!arr.length) return 0;
  const sum = arr.reduce((s, v) => s + safeNumber(v), 0);
  return safeDivide(sum, arr.length);
}

// ── Types ────────────────────────────────────────────────────────────────

interface RiskSubCategory {
  level: 'High' | 'Medium' | 'Low';
  summary: string;
  factors: string[];
  mitigations: string[];
}

interface RiskAnalysis {
  supplyChain: RiskSubCategory;
  financial: RiskSubCategory;
  operational: RiskSubCategory;
}

interface SavedAnalysis {
  id: string;
  timestamp: string;
  vendorName: string;
  category: string;
  annualSpend: number;
  result: RiskAnalysis;
  demoMode: boolean;
  selectedVendorId: string | null;
}

interface SupplierContext {
  vendorId: string;
  vendorName: string;
  category: string;
  location: string;
  status: 'active' | 'inactive';
  contractEnd: string;
  paymentTerms: string;
  leadTime: number;
  vendorScore: number;

  totalOrders: number;
  lateOrders: number;
  currentOverdueOrders: number;
  averageDelayDays: number;
  onTimeDeliveryRate: number;
  averageLeadTime: number;
  supplierSpend: number;
  supplierSpendShare: number;

  vendorRatingOverall: number | null;
  vendorRatingDelivery: number | null;
  vendorRatingQuality: number | null;
  vendorRatingCost: number | null;

  deliveryDelayRiskScore: number;
  leadTimeRiskScore: number;
  supplierDependencyRiskScore: number;
  costConcentrationRiskScore: number;
  supplierPerformanceRiskScore: number;
  overallRiskScore: number;
  riskLevel: 'Low' | 'Medium' | 'High';
  detectedRiskTypes: string[];

  openPOCount: number;
  lateDeliveryRate: number;

  detectedRisks: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high';
    scoreImpact: number;
    message: string;
  }>;
}

interface FormData {
  vendorName: string;
  category: string;
  annualSpend: string;
  alternativeSuppliers: string;
  avgDeliveryDelay: string;
  avgQualityScore: string;
  paymentTerms: string;
  notes: string;
}

const CATEGORIES = ['Electronics', 'Logistics', 'Raw Materials', 'Office Supplies', 'IT Services', 'Packaging', 'Chemicals'] as const;
const PAYMENT_TERMS = ['Net 30', 'Net 60', 'Net 90'] as const;

const emptyForm: FormData = {
  vendorName: '',
  category: 'Electronics',
  annualSpend: '',
  alternativeSuppliers: '0',
  avgDeliveryDelay: '0',
  avgQualityScore: '3',
  paymentTerms: 'Net 30',
  notes: '',
};

const DEMO_RESULT: RiskAnalysis = {
  supplyChain: {
    level: 'High',
    summary:
      'This vendor represents a significant supply chain vulnerability. With zero alternative suppliers and a critical product category, any disruption would halt operations entirely. The 5-day average delivery delay compounds the risk, suggesting unreliable logistics.',
    factors: [
      'Sole source dependency — no alternative suppliers available',
      'Product category is critical to core operations',
      'Consistent delivery delays averaging 5 days',
      'Geographic concentration risk in a single region',
    ],
    mitigations: [
      'Qualify at least 2 alternative suppliers within 90 days',
      'Negotiate safety stock provisions in the vendor contract',
      'Establish dual-sourcing for critical components',
      'Request a supply chain resilience plan from the vendor',
    ],
  },
  financial: {
    level: 'Medium',
    summary:
      'The $500K annual spend represents moderate financial exposure. Net 60 payment terms extend the cash flow cycle, and the lack of competitive pricing benchmarks makes cost optimization difficult without alternative suppliers.',
    factors: [
      'Annual spend of $500,000 creates moderate exposure',
      'Net 60 payment terms tie up working capital',
      'No competitive pricing benchmarks available',
      'Sole-source position weakens negotiating leverage',
    ],
    mitigations: [
      'Negotiate volume-based pricing tiers',
      'Request quarterly financial health reports from vendor',
      'Explore early payment discounts (e.g., 2/10 Net 60)',
      'Establish a cost benchmarking cadence with procurement',
    ],
  },
  operational: {
    level: 'Medium',
    summary:
      'Operational risks stem primarily from delivery unreliability and average product quality. The 3/5 quality score indicates room for improvement, and the delivery delays could cascade into production schedule disruptions.',
    factors: [
      'Average quality score of 3/5 requires improvement',
      '5-day average delivery delay impacts production scheduling',
      'No redundancy in the supply pipeline',
      'Limited visibility into vendor capacity constraints',
    ],
    mitigations: [
      'Implement a vendor scorecard with monthly reviews',
      'Set up automated delivery tracking and alerting',
      'Establish quality gates with incoming inspection criteria',
      'Request capacity commitment letters quarterly',
    ],
  },
};

const LOADING_MESSAGES = [
  'Analyzing supply chain risks...',
  'Evaluating financial exposure...',
  'Generating mitigation strategies...',
];

const STORAGE_KEY = 'riskAnalyses';
const SESSION_KEY = 'anthropic_session_key';

// ── Key helpers — never touch React state ────────────────────────────────

function getRuntimeApiKey(): string | null {
  const key = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem('apiKey') || '';
  return key || null;
}

function hasSessionKey(): boolean {
  return !!sessionStorage.getItem(SESSION_KEY);
}

// ── Storage helpers ───────────────────────────────────────────────────────

function getSavedAnalyses(): SavedAnalysis[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveAnalysis(analysis: SavedAnalysis): void {
  const existing = getSavedAnalyses();
  localStorage.setItem(STORAGE_KEY, JSON.stringify([analysis, ...existing]));
}

// ── Supplier context builder ──────────────────────────────────────────────

function buildSupplierContext(entry: LegacySupplierRiskEntry): SupplierContext {
  const m: LegacySupplierMetrics = entry.metrics;
  const r: LegacySupplierRisk = entry.risk;

  const totalOrders = safeNumber(m.totalOrders);
  const lateOrders = safeNumber(m.lateOrders);
  const lateDeliveryRate = safeDivide(lateOrders, totalOrders) * 100;

  // Use new risk engine for richer detectedRisks if available
  const newRisk = getSupplierRisk(m.vendorId);

  const detectedRisks: SupplierContext['detectedRisks'] = newRisk
    ? newRisk.detectedRisks.map((dr) => ({
        type: dr.type,
        severity: dr.severity,
        scoreImpact: dr.scoreImpact,
        message: dr.message,
      }))
    : r.detectedRiskTypes.map((type) => ({
        type,
        severity: (type.includes('Delay') || type.includes('Performance')
          ? 'high'
          : 'medium') as 'low' | 'medium' | 'high',
        scoreImpact: 0,
        message: type,
      }));

  const openPOCount = getOpenPOCountForVendor(m.vendorId);

  return {
    vendorId: m.vendorId,
    vendorName: m.vendorName,
    category: m.vendor.category,
    location: m.vendor.location,
    status: m.vendor.status,
    contractEnd: m.vendor.contractEnd,
    paymentTerms: m.vendor.paymentTerms,
    leadTime: safeNumber(m.vendorLeadTime),
    vendorScore: safeNumber(m.vendorScore),

    totalOrders,
    lateOrders,
    currentOverdueOrders: safeNumber(m.currentOverdueOrders),
    averageDelayDays: safeNumber(m.averageDelayDays),
    onTimeDeliveryRate: safeNumber(m.onTimeDeliveryRate),
    averageLeadTime: safeNumber(m.averageLeadTime),
    supplierSpend: safeNumber(m.supplierSpend),
    supplierSpendShare: safeNumber(m.supplierSpendShare),

    vendorRatingOverall: m.vendorRatingOverall,
    vendorRatingDelivery: m.vendorRatingDelivery,
    vendorRatingQuality: m.vendorRatingQuality,
    vendorRatingCost: m.vendorRatingCost,

    deliveryDelayRiskScore: safeNumber(r.deliveryDelayRiskScore),
    leadTimeRiskScore: safeNumber(r.leadTimeRiskScore),
    supplierDependencyRiskScore: safeNumber(r.supplierDependencyRiskScore),
    costConcentrationRiskScore: safeNumber(r.costConcentrationRiskScore),
    supplierPerformanceRiskScore: safeNumber(r.supplierPerformanceRiskScore),
    overallRiskScore: safeNumber(r.overallRiskScore),
    riskLevel: r.riskLevel,
    detectedRiskTypes: r.detectedRiskTypes,

    openPOCount,
    lateDeliveryRate: parseFloat(lateDeliveryRate.toFixed(1)),

    detectedRisks,
  };
}

// ── Level config ──────────────────────────────────────────────────────────

function levelConfig(level: RiskSubCategory['level']) {
  switch (level) {
    case 'High':
      return {
        icon: AlertTriangle,
        color: 'text-red-400',
        bg: 'bg-red-500/10',
        border: 'border-red-500/25',
        headerBg: 'bg-red-500/15',
        headerBorder: 'border-red-500/30',
        badge: 'bg-red-500/20 text-red-400 border-red-500/30',
        barBg: 'bg-red-500/30',
        barFill: 'bg-red-500',
      };
    case 'Medium':
      return {
        icon: AlertCircle,
        color: 'text-yellow-400',
        bg: 'bg-yellow-500/10',
        border: 'border-yellow-500/25',
        headerBg: 'bg-yellow-500/15',
        headerBorder: 'border-yellow-500/30',
        badge: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
        barBg: 'bg-yellow-500/30',
        barFill: 'bg-yellow-500',
      };
    case 'Low':
      return {
        icon: CheckCircle,
        color: 'text-emerald-400',
        bg: 'bg-emerald-500/10',
        border: 'border-emerald-500/25',
        headerBg: 'bg-emerald-500/15',
        headerBorder: 'border-emerald-500/30',
        badge: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
        barBg: 'bg-emerald-500/30',
        barFill: 'bg-emerald-500',
      };
  }
}

// ── Risk Card ────────────────────────────────────────────────────────────

function RiskCard({ title, data }: { title: string; data: RiskSubCategory }) {
  const cfg = levelConfig(data.level);
  const Icon = cfg.icon;

  return (
    <div
      className={`relative z-1 rounded-xl border overflow-hidden ${cfg.border} ${cfg.bg} transition-shadow duration-300 hover:shadow-lg hover:shadow-black/20`}
    >
      <div
        className={`${cfg.headerBg} border-b ${cfg.headerBorder} px-5 py-4 flex items-center justify-between`}
      >
        <div className="flex items-center gap-3">
          <Icon className={`w-5 h-5 ${cfg.color}`} />
          <h3 className="text-white font-semibold">{title}</h3>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${cfg.badge}`}>
          {data.level} Risk
        </span>
      </div>

      <div className="p-5 space-y-4">
        <p className="text-sm text-slate-300 leading-relaxed">{data.summary}</p>

        <div>
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Risk Factors
          </h4>
          <ul className="space-y-1.5">
            {data.factors.map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-400">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${cfg.barFill} flex-shrink-0 mt-1.5`}
                />
                {f}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Mitigation Steps
          </h4>
          <ol className="space-y-1.5">
            {data.mitigations.map((m, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-slate-300">
                <span
                  className={`w-5 h-5 rounded-full ${cfg.barBg} flex items-center justify-center text-[10px] font-bold ${cfg.color} flex-shrink-0`}
                >
                  {i + 1}
                </span>
                {m}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

// ── History Panel ────────────────────────────────────────────────────────

function HistoryPanel({
  analyses,
  onSelect,
  onDelete,
  onClose,
}: {
  analyses: SavedAnalysis[];
  onSelect: (a: SavedAnalysis) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center p-4 pt-[5vh]">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 bg-navy-800 border border-blue-900/40 rounded-2xl w-full max-w-lg max-h-[80vh] overflow-hidden shadow-2xl">
        <div className="px-6 py-4 border-b border-blue-900/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-bold text-white">Analysis History</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto max-h-[calc(80vh-64px)]">
          {analyses.length === 0 ? (
            <div className="p-12 text-center">
              <History className="w-12 h-12 mx-auto mb-3 text-slate-600" />
              <p className="text-slate-500">No saved analyses yet</p>
            </div>
          ) : (
            analyses.map((a) => (
              <div
                key={a.id}
                className="px-6 py-4 border-b border-blue-900/20 hover:bg-white/[0.02] cursor-pointer transition-colors"
                onClick={() => onSelect(a)}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-white font-medium text-sm">{a.vendorName}</span>
                  <span className="text-xs text-slate-500">
                    {new Date(a.timestamp).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-blue-400">{a.category}</span>
                  <span className="text-xs text-slate-600">|</span>
                  <span className="text-xs text-slate-400">
                    ${a.annualSpend.toLocaleString()} annual
                  </span>
                  {a.demoMode && (
                    <>
                      <span className="text-xs text-slate-600">|</span>
                      <span className="text-xs text-yellow-500">Demo</span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {(['supplyChain', 'financial', 'operational'] as const).map((key) => {
                    const cfg = levelConfig(a.result[key].level);
                    const Icon = cfg.icon;
                    return (
                      <span
                        key={key}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border ${cfg.badge}`}
                      >
                        <Icon className="w-2.5 h-2.5" />
                        {a.result[key].level}
                      </span>
                    );
                  })}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(a.id);
                  }}
                  className="mt-2 text-xs text-slate-600 hover:text-red-400 transition-colors"
                >
                  Delete
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ── Metric Tile ───────────────────────────────────────────────────────────

function MetricTile({
  label,
  value,
  colorClass = 'text-white',
}: {
  label: string;
  value: string | number;
  colorClass?: string;
}) {
  return (
    <div className="bg-navy-700/50 rounded-lg p-3">
      <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-0.5">{label}</p>
      <p className={`text-sm font-semibold ${colorClass}`}>{value}</p>
    </div>
  );
}

// ── Loaded Data Preview ───────────────────────────────────────────────────

function LoadedDataPreview({ ctx }: { ctx: SupplierContext }) {
  const riskLevelLower = ctx.riskLevel.toLowerCase() as 'low' | 'medium' | 'high';
  const riskColorMap = {
    low: 'text-emerald-400',
    medium: 'text-yellow-400',
    high: 'text-red-400',
  };
  const riskColor = riskColorMap[riskLevelLower] ?? 'text-yellow-400';

  const onTimeColor =
    ctx.onTimeDeliveryRate >= 90
      ? 'text-emerald-400'
      : ctx.onTimeDeliveryRate >= 70
      ? 'text-yellow-400'
      : 'text-red-400';

  const spendShareColor =
    ctx.supplierSpendShare > 35
      ? 'text-red-400'
      : ctx.supplierSpendShare > 20
      ? 'text-yellow-400'
      : 'text-emerald-400';

  const overdueColor = ctx.currentOverdueOrders > 0 ? 'text-red-400' : 'text-emerald-400';
  const lateColor = ctx.lateOrders > 0 ? 'text-red-400' : 'text-emerald-400';

  const overallRatingColor =
    ctx.vendorRatingOverall === null
      ? 'text-slate-500'
      : ctx.vendorRatingOverall >= 85
      ? 'text-emerald-400'
      : ctx.vendorRatingOverall >= 70
      ? 'text-yellow-400'
      : 'text-red-400';

  const delivRatingColor =
    ctx.vendorRatingDelivery === null
      ? 'text-slate-500'
      : ctx.vendorRatingDelivery >= 85
      ? 'text-emerald-400'
      : ctx.vendorRatingDelivery >= 70
      ? 'text-yellow-400'
      : 'text-red-400';

  const qualRatingColor =
    ctx.vendorRatingQuality === null
      ? 'text-slate-500'
      : ctx.vendorRatingQuality >= 85
      ? 'text-emerald-400'
      : ctx.vendorRatingQuality >= 70
      ? 'text-yellow-400'
      : 'text-red-400';

  const severityColors = {
    high: 'bg-red-500/15 text-red-400 border-red-500/30',
    medium: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
    low: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  };

  return (
    <div className="mt-4 rounded-xl border border-blue-900/40 bg-navy-700/30 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-blue-900/30 flex items-center gap-2">
        <Database className="w-4 h-4 text-blue-400" />
        <h3 className="text-sm font-bold text-white">Loaded Data Preview</h3>
        <span className="ml-auto text-[10px] text-slate-500 uppercase tracking-wide">
          Live from procurement system
        </span>
      </div>

      <div className="p-4 space-y-4">
        {/* Row 1 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetricTile
            label="Overall Risk Score"
            value={`${ctx.overallRiskScore}/100`}
            colorClass={riskColor}
          />
          <MetricTile
            label="Risk Level"
            value={ctx.riskLevel}
            colorClass={riskColor}
          />
          <MetricTile
            label="On-Time Rate"
            value={`${ctx.onTimeDeliveryRate}%`}
            colorClass={onTimeColor}
          />
          <MetricTile
            label="Spend Share"
            value={`${ctx.supplierSpendShare}%`}
            colorClass={spendShareColor}
          />
        </div>

        {/* Row 2 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetricTile label="Total Orders" value={ctx.totalOrders} />
          <MetricTile
            label="Late Orders"
            value={ctx.lateOrders}
            colorClass={lateColor}
          />
          <MetricTile
            label="Overdue POs"
            value={ctx.currentOverdueOrders}
            colorClass={overdueColor}
          />
          <MetricTile
            label="Avg Delay"
            value={ctx.averageDelayDays > 0 ? `${ctx.averageDelayDays}d` : 'None'}
            colorClass={ctx.averageDelayDays > 0 ? 'text-yellow-400' : 'text-emerald-400'}
          />
        </div>

        {/* Row 3 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetricTile
            label="Overall Rating"
            value={ctx.vendorRatingOverall !== null ? `${ctx.vendorRatingOverall}/100` : 'N/A'}
            colorClass={overallRatingColor}
          />
          <MetricTile
            label="Delivery Rating"
            value={ctx.vendorRatingDelivery !== null ? `${ctx.vendorRatingDelivery}/100` : 'N/A'}
            colorClass={delivRatingColor}
          />
          <MetricTile
            label="Quality Rating"
            value={ctx.vendorRatingQuality !== null ? `${ctx.vendorRatingQuality}/100` : 'N/A'}
            colorClass={qualRatingColor}
          />
          <MetricTile
            label="Lead Time"
            value={`${ctx.leadTime}d declared / ${ctx.averageLeadTime}d avg`}
          />
        </div>

        {/* Detected Risk Flags */}
        {ctx.detectedRisks.length > 0 && (
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-2">
              System-Detected Risk Flags
            </p>
            <div className="flex flex-wrap gap-1.5">
              {ctx.detectedRisks.map((r, i) => (
                <span
                  key={i}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border ${
                    severityColors[r.severity]
                  }`}
                >
                  <span className="uppercase text-[9px] opacity-70">{r.severity[0]}</span>
                  {r.type}
                </span>
              ))}
            </div>
          </div>
        )}

        {ctx.detectedRisks.length === 0 && (
          <div className="flex items-center gap-2">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
            <p className="text-xs text-emerald-400">No risk flags detected by procurement system</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── API Key Manager ───────────────────────────────────────────────────────

function ApiKeyManager({ onKeyChange }: { onKeyChange: () => void }) {
  const [inputValue, setInputValue] = useState('');
  const [showInput, setShowInput] = useState(false);
  const [keyLoaded, setKeyLoaded] = useState(() => hasSessionKey());

  function handleSave() {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    sessionStorage.setItem(SESSION_KEY, trimmed);
    setInputValue('');
    setKeyLoaded(true);
    onKeyChange();
  }

  function handleClear() {
    sessionStorage.removeItem(SESSION_KEY);
    setInputValue('');
    setKeyLoaded(false);
    onKeyChange();
  }

  return (
    <div className="mt-4 pt-4 border-t border-blue-900/30 space-y-3">
      <div className="flex items-center gap-2">
        <Key className="w-4 h-4 text-blue-400 flex-shrink-0" />
        <p className="text-xs font-semibold text-slate-300">Groq API Key</p>
        <span
          className={`ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
            keyLoaded
              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
              : 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30'
          }`}
        >
          <Lock className="w-2.5 h-2.5" />
          {keyLoaded ? 'Key loaded (session only)' : 'No key — Demo Mode active'}
        </span>
      </div>

      {!keyLoaded && (
        <div className="space-y-2">
          <div className="relative">
            <input
              type={showInput ? 'text' : 'password'}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              placeholder="Paste your Groq API key (gsk_...)"
              className="w-full px-3 py-2 pr-10 bg-navy-700 border border-blue-900/40 rounded-lg text-white placeholder-slate-600 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              autoComplete="off"
              spellCheck={false}
            />
            <button
              type="button"
              onClick={() => setShowInput((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
            >
              {showInput ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={!inputValue.trim()}
              className="flex-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg transition-colors"
            >
              Save for session
            </button>
          </div>
        </div>
      )}

      {keyLoaded && (
        <button
          onClick={handleClear}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold rounded-lg transition-colors border border-red-500/20"
        >
          <X className="w-3 h-3" />
          Clear key
        </button>
      )}

      <p className="text-[10px] text-slate-600 leading-relaxed">
        Your key is stored in sessionStorage only and cleared when you close this tab.
        It is never written to disk or localStorage.
      </p>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────

export default function AIRisk() {
  const vendors = useMemo(() => getVendors(), []);
  const riskEntries = useMemo(() => buildSupplierRiskData(), []);

  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  const [supplierCtx, setSupplierCtx] = useState<SupplierContext | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [demoMode, setDemoMode] = useState(() => !getRuntimeApiKey());
  const [autoDemoBanner, setAutoDemoBanner] = useState(() => !getRuntimeApiKey());
  const [loading, setLoading] = useState(false);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [result, setResult] = useState<RiskAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<SavedAnalysis[]>(() => getSavedAnalyses());
  const loadingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function handleKeyChange() {
    const hasKey = !!getRuntimeApiKey();
    if (hasKey) {
      setDemoMode(false);
      setAutoDemoBanner(false);
    } else {
      setDemoMode(true);
      setAutoDemoBanner(true);
    }
  }

  useEffect(() => {
    if (loading) {
      loadingTimerRef.current = setInterval(() => {
        setLoadingMsgIdx((prev) => (prev + 1) % LOADING_MESSAGES.length);
      }, 2200);
    } else {
      if (loadingTimerRef.current) clearInterval(loadingTimerRef.current);
      setLoadingMsgIdx(0);
    }
    return () => {
      if (loadingTimerRef.current) clearInterval(loadingTimerRef.current);
    };
  }, [loading]);

  function handleVendorSelect(vendorId: string) {
    if (!vendorId) {
      setSelectedVendorId(null);
      setSupplierCtx(null);
      setForm(emptyForm);
      return;
    }

    setSelectedVendorId(vendorId);

    const entry = riskEntries.find((e) => e.risk.vendorId === vendorId);
    if (entry) {
      const ctx = buildSupplierContext(entry);
      setSupplierCtx(ctx);
      setForm({
        vendorName: ctx.vendorName,
        category: ctx.category,
        annualSpend: String(Math.round(ctx.supplierSpend)),
        alternativeSuppliers: '0',
        avgDeliveryDelay: String(ctx.averageDelayDays),
        avgQualityScore:
          ctx.vendorRatingQuality !== null
            ? String(Math.min(5, Math.max(1, Math.round(ctx.vendorRatingQuality / 20))))
            : '3',
        paymentTerms: ctx.paymentTerms || 'Net 30',
        notes: '',
      });
    } else {
      const v = vendors.find((vr: Vendor) => vr.id === vendorId);
      if (v) {
        setSupplierCtx(null);
        setForm({
          ...emptyForm,
          vendorName: v.name,
          category: v.category,
          paymentTerms: v.paymentTerms || 'Net 30',
        });
      }
    }
  }

  function clearVendorSelection() {
    setSelectedVendorId(null);
    setSupplierCtx(null);
    setForm(emptyForm);
  }

  // Build the enriched vendor prompt using live SupplierContext
  function buildVendorPrompt(ctx: SupplierContext): string {
    const spendOverride =
      form.annualSpend && form.annualSpend !== String(Math.round(ctx.supplierSpend))
        ? `$${parseInt(form.annualSpend, 10).toLocaleString()} (manual override)`
        : `$${ctx.supplierSpend.toLocaleString()} (from procurement records)`;

    const riskEvidence =
      ctx.detectedRisks.length > 0
        ? ctx.detectedRisks
            .map(
              (r) =>
                `  [${r.severity.toUpperCase()}] ${r.type} (+${r.scoreImpact} pts): ${r.message}`
            )
            .join('\n')
        : '  No risk flags detected by the procurement system.';

    return `You are analyzing procurement risk for a LIVE vendor from our procurement system.
The application has already calculated ALL risk scores and detected all risk flags.
Your job is ONLY to explain and recommend — do NOT recalculate, re-score, or invent data.
If data is not provided, say "Insufficient supporting procurement data available."

=== VENDOR PROFILE ===
Name: ${ctx.vendorName}
Category: ${ctx.category}
Location: ${ctx.location}
Status: ${ctx.status}
Contract Expiry: ${ctx.contractEnd}
Payment Terms: ${ctx.paymentTerms}
Declared Lead Time: ${ctx.leadTime} days

=== HISTORICAL PROCUREMENT PERFORMANCE ===
Total Orders Placed: ${ctx.totalOrders}
Late Orders: ${ctx.lateOrders} (${ctx.lateDeliveryRate.toFixed(1)}% late rate)
Currently Overdue POs: ${ctx.currentOverdueOrders}
Open (Unfulfilled) POs: ${ctx.openPOCount}
Average Delay When Late: ${ctx.averageDelayDays} days
On-Time Delivery Rate: ${ctx.onTimeDeliveryRate}%
Actual Average Lead Time: ${ctx.averageLeadTime} days

=== FINANCIAL EXPOSURE ===
Annual Spend: ${spendOverride}
Spend Share of Total Procurement: ${ctx.supplierSpendShare}%
Alternative Suppliers Known: ${form.alternativeSuppliers} (0 = sole source dependency)

=== VENDOR RATINGS (0–100 scale) ===
Overall: ${ctx.vendorRatingOverall !== null ? ctx.vendorRatingOverall : 'Not rated'}
Delivery: ${ctx.vendorRatingDelivery !== null ? ctx.vendorRatingDelivery : 'Not rated'}
Quality: ${ctx.vendorRatingQuality !== null ? ctx.vendorRatingQuality : 'Not rated'}
Cost: ${ctx.vendorRatingCost !== null ? ctx.vendorRatingCost : 'Not rated'}

=== SYSTEM-COMPUTED RISK SCORES (pre-calculated — do NOT recalculate) ===
Overall Risk Score: ${ctx.overallRiskScore}/100 → ${ctx.riskLevel} Risk
  Delivery Delay Risk:       ${ctx.deliveryDelayRiskScore}/30
  Lead Time Risk:            ${ctx.leadTimeRiskScore}/20
  Supplier Dependency Risk:  ${ctx.supplierDependencyRiskScore}/20
  Cost Concentration Risk:   ${ctx.costConcentrationRiskScore}/15
  Performance Risk:          ${ctx.supplierPerformanceRiskScore}/15

=== DETECTED RISK FLAGS (system-generated evidence) ===
${riskEvidence}

=== ADDITIONAL NOTES ===
${form.notes || 'No additional notes provided.'}

INSTRUCTIONS:
- Reference REAL numbers from the data above in every section.
- For supplyChain: focus on delivery reliability, lead times, alternative supplier count, overdue PO impact.
- For financial: focus on spend share, payment terms, contract status, cost concentration.
- For operational: focus on ratings, quality, delivery consistency, open PO backlog.
- Every mitigation must name a specific metric target or timeframe (e.g., "until on-time rate exceeds 85%").
- When currentOverdueOrders > 0, include an immediate escalation action in operational mitigations.
- Do NOT give generic advice like "improve communication" or "monitor closely" without specifics.`;
  }

  // Build the manual entry prompt (unchanged from prior behavior)
  function buildManualPrompt(): string {
    return `Analyze procurement risk for:
Vendor: ${form.vendorName}
Product Category: ${form.category}
Annual Spend: $${safeNumber(parseInt(form.annualSpend, 10))}
Alternative Suppliers: ${form.alternativeSuppliers} (0 = sole source)
Average Delivery Delay: ${form.avgDeliveryDelay} days
Average Quality Score: ${form.avgQualityScore}/5
Payment Terms: ${form.paymentTerms}
Recent Issues: ${form.notes || 'None reported'}`;
  }

  const handleAnalyze = useCallback(async () => {
    if (!form.vendorName.trim()) return;

    setError(null);
    setResult(null);
    setLoading(true);

    const userPrompt =
      selectedVendorId && supplierCtx
        ? buildVendorPrompt(supplierCtx)
        : buildManualPrompt();

    const systemPrompt = `You are a procurement risk analyst. Respond ONLY with a valid JSON object (no markdown, no extra text, no code fences) with this exact structure:
{
  "supplyChain": {
    "level": "High" | "Medium" | "Low",
    "summary": "string",
    "factors": ["string"],
    "mitigations": ["string"]
  },
  "financial": {
    "level": "High" | "Medium" | "Low",
    "summary": "string",
    "factors": ["string"],
    "mitigations": ["string"]
  },
  "operational": {
    "level": "High" | "Medium" | "Low",
    "summary": "string",
    "factors": ["string"],
    "mitigations": ["string"]
  }
}`;

    // Demo mode path
    if (demoMode) {
      await new Promise((r) => setTimeout(r, 1800));
      const analysis: SavedAnalysis = {
        id: Math.random().toString(36).substring(2, 11),
        timestamp: new Date().toISOString(),
        vendorName: form.vendorName,
        category: form.category,
        annualSpend: safeNumber(parseInt(form.annualSpend, 10)),
        result: DEMO_RESULT,
        demoMode: true,
        selectedVendorId,
      };
      saveAnalysis(analysis);
      setHistory(getSavedAnalyses());
      setResult(DEMO_RESULT);
      setLoading(false);
      return;
    }

    // Read key fresh at request time — never from state
    const runtimeKey = getRuntimeApiKey();

    if (!runtimeKey) {
      setDemoMode(true);
      await new Promise((r) => setTimeout(r, 1800));
      const analysis: SavedAnalysis = {
        id: Math.random().toString(36).substring(2, 11),
        timestamp: new Date().toISOString(),
        vendorName: form.vendorName,
        category: form.category,
        annualSpend: safeNumber(parseInt(form.annualSpend, 10)),
        result: DEMO_RESULT,
        demoMode: true,
        selectedVendorId,
      };
      saveAnalysis(analysis);
      setHistory(getSavedAnalyses());
      setResult(DEMO_RESULT);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${runtimeKey}`,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          temperature: 0.2,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        }),
      });

      if (res.status === 401) {
        setError('Invalid API key. Please check your Groq key and try again.');
        setLoading(false);
        return;
      }

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        setError(`API error (${res.status}). ${body || 'Please try again.'}`);
        setLoading(false);
        return;
      }

      const data = await res.json();
      const content: string = data?.choices?.[0]?.message?.content ?? '';

      let parsed: RiskAnalysis;
      try {
        parsed = JSON.parse(content);
      } catch {
        setError('AI response was unreadable. Please try again.');
        setLoading(false);
        return;
      }

      if (
        !parsed.supplyChain?.level ||
        !parsed.financial?.level ||
        !parsed.operational?.level
      ) {
        setError('AI response was unreadable. Please try again.');
        setLoading(false);
        return;
      }

      const analysis: SavedAnalysis = {
        id: Math.random().toString(36).substring(2, 11),
        timestamp: new Date().toISOString(),
        vendorName: form.vendorName,
        category: form.category,
        annualSpend: safeNumber(parseInt(form.annualSpend, 10)),
        result: parsed,
        demoMode: false,
        selectedVendorId,
      };
      saveAnalysis(analysis);
      setHistory(getSavedAnalyses());
      setResult(parsed);
    } catch (err) {
      if (err instanceof TypeError && err.message.includes('fetch')) {
        setError('Connection failed. Check your internet and try again.');
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, demoMode, selectedVendorId, supplierCtx]);

  function handleRetry() {
    setError(null);
    handleAnalyze();
  }

  function handleSelectHistory(analysis: SavedAnalysis) {
    setResult(analysis.result);
    setForm({
      vendorName: analysis.vendorName,
      category: analysis.category,
      annualSpend: String(analysis.annualSpend),
      alternativeSuppliers: '0',
      avgDeliveryDelay: '0',
      avgQualityScore: '3',
      paymentTerms: 'Net 30',
      notes: '',
    });
    setShowHistory(false);
  }

  function handleDeleteHistory(id: string) {
    const updated = history.filter((a) => a.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setHistory(updated);
  }

  const isVendorMode = !!selectedVendorId && !!supplierCtx;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ShieldAlert className="w-7 h-7 text-blue-400" />
            AI Risk Analyzer
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Procurement-aware AI risk assessment with data-driven mitigation strategies
          </p>
        </div>
        <button
          onClick={() => setShowHistory(true)}
          className="relative z-2 flex items-center gap-1.5 px-4 py-2.5 bg-navy-700 hover:bg-navy-600 text-slate-300 text-sm font-semibold rounded-lg transition-colors border border-blue-900/40"
        >
          <History className="w-4 h-4" />
          History ({history.length})
        </button>
      </div>

      {/* Auto Demo Banner */}
      {autoDemoBanner && (
        <div className="relative z-1 bg-yellow-500/10 border border-yellow-500/25 rounded-xl px-5 py-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-yellow-300 font-medium">
              No Groq API key found — running in Demo Mode
            </p>
            <p className="text-xs text-yellow-400/70 mt-1">
              Paste your Groq key in the panel below to enable live AI analysis.
            </p>
          </div>
          <button
            onClick={() => setAutoDemoBanner(false)}
            className="text-yellow-400/50 hover:text-yellow-400 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Demo Mode Toggle + API Key Manager */}
      <div className="relative z-1 bg-navy-800 border border-blue-900/40 rounded-xl px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                demoMode ? 'bg-yellow-500/15' : 'bg-blue-500/15'
              }`}
            >
              {demoMode ? (
                <AlertCircle className="w-4 h-4 text-yellow-400" />
              ) : (
                <ShieldAlert className="w-4 h-4 text-blue-400" />
              )}
            </div>
            <div>
              <p className="text-sm text-white font-medium">Demo Mode</p>
              <p className="text-xs text-slate-500">
                {demoMode
                  ? 'Using example data — no API calls'
                  : 'Live AI analysis via Groq (llama-3.3-70b-versatile)'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setDemoMode((v) => !v)}
            className={`relative w-12 h-7 rounded-full transition-colors duration-200 flex-shrink-0 ${
              demoMode ? 'bg-yellow-500' : 'bg-blue-600'
            }`}
            role="switch"
            aria-checked={!demoMode}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform duration-200 ${
                demoMode ? 'translate-x-0' : 'translate-x-5'
              }`}
            />
          </button>
        </div>

        <ApiKeyManager onKeyChange={handleKeyChange} />
      </div>

      {/* Input Form */}
      <div className="relative z-1 bg-navy-800 border border-blue-900/40 rounded-xl p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">Risk Assessment Parameters</h2>
          {isVendorMode && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/25">
              <Database className="w-3 h-3" />
              Vendor-Selected Mode
            </span>
          )}
        </div>

        {/* Vendor Selector */}
        <div className="mb-4">
          <label className="block text-sm text-slate-400 mb-1.5">
            Load from Vendor Directory
            <span className="text-slate-600 ml-1">(optional — auto-fills all procurement data)</span>
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <select
                value={selectedVendorId || ''}
                onChange={(e) => handleVendorSelect(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 bg-navy-700 border border-blue-900/40 rounded-lg text-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 appearance-none relative z-2"
              >
                <option value="">Select a vendor to load live data...</option>
                {vendors.map((v: Vendor) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.category})
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
            </div>
            {selectedVendorId && (
              <button
                onClick={clearVendorSelection}
                className="relative z-2 px-3 py-2.5 bg-navy-700 border border-blue-900/40 rounded-lg text-slate-400 hover:text-white transition-colors"
                title="Clear selection"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Loaded Data Preview — only in vendor mode */}
        {isVendorMode && supplierCtx && (
          <LoadedDataPreview ctx={supplierCtx} />
        )}

        {/* Supplementary / Manual inputs */}
        <div className="space-y-4 mt-5">
          {/* Vendor Name + Category — read-only in vendor mode */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">
                Vendor Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={form.vendorName}
                onChange={(e) => !isVendorMode && setForm({ ...form, vendorName: e.target.value })}
                readOnly={isVendorMode}
                className={`w-full px-4 py-2.5 bg-navy-700 border border-blue-900/40 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 relative z-2 ${
                  isVendorMode ? 'opacity-60 cursor-default' : ''
                }`}
                placeholder="Enter vendor name"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Product Category</label>
              <div className="relative">
                {isVendorMode ? (
                  <input
                    type="text"
                    value={form.category}
                    readOnly
                    className="w-full px-4 py-2.5 bg-navy-700 border border-blue-900/40 rounded-lg text-white text-sm opacity-60 cursor-default relative z-2"
                  />
                ) : (
                  <>
                    <select
                      value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value })}
                      className="w-full bg-navy-700 border border-blue-900/40 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 appearance-none relative z-2 pr-10"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Spend + Alt Suppliers + Delay */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">
                Annual Spend (USD)
                {isVendorMode && (
                  <span className="text-blue-400 ml-1 text-xs">
                    {form.annualSpend !== String(Math.round(supplierCtx?.supplierSpend ?? 0))
                      ? '(override)'
                      : '(from system)'}
                  </span>
                )}
              </label>
              <input
                type="number"
                value={form.annualSpend}
                onChange={(e) => setForm({ ...form, annualSpend: e.target.value })}
                className="w-full px-4 py-2.5 bg-navy-700 border border-blue-900/40 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 relative z-2"
                placeholder="500000"
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">
                Alternative Suppliers
                <span className="text-slate-600 ml-1">(0 = sole source)</span>
              </label>
              <input
                type="number"
                value={form.alternativeSuppliers}
                onChange={(e) => setForm({ ...form, alternativeSuppliers: e.target.value })}
                className="w-full px-4 py-2.5 bg-navy-700 border border-blue-900/40 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 relative z-2"
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">
                Avg Delivery Delay (days)
                {isVendorMode && (
                  <span className="text-slate-500 ml-1 text-xs">(from system)</span>
                )}
              </label>
              <input
                type="number"
                value={form.avgDeliveryDelay}
                onChange={(e) => !isVendorMode && setForm({ ...form, avgDeliveryDelay: e.target.value })}
                readOnly={isVendorMode}
                className={`w-full px-4 py-2.5 bg-navy-700 border border-blue-900/40 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 relative z-2 ${
                  isVendorMode ? 'opacity-60 cursor-default' : ''
                }`}
                min="0"
              />
            </div>
          </div>

          {/* Quality + Payment Terms — read-only in vendor mode */}
          {!isVendorMode && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">
                  Avg Quality Score <span className="text-slate-600">(1-5)</span>
                </label>
                <input
                  type="number"
                  value={form.avgQualityScore}
                  onChange={(e) => {
                    const val = Math.min(5, Math.max(1, parseInt(e.target.value) || 1));
                    setForm({ ...form, avgQualityScore: String(val) });
                  }}
                  className="w-full px-4 py-2.5 bg-navy-700 border border-blue-900/40 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 relative z-2"
                  min="1"
                  max="5"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Payment Terms</label>
                <div className="relative">
                  <select
                    value={form.paymentTerms}
                    onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })}
                    className="w-full bg-navy-700 border border-blue-900/40 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 appearance-none relative z-2 pr-10"
                  >
                    {PAYMENT_TERMS.map((pt) => (
                      <option key={pt} value={pt}>
                        {pt}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                </div>
              </div>
            </div>
          )}

          {/* Recent Issues / Notes */}
          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Recent Issues or Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full px-4 py-2.5 bg-navy-700 border border-blue-900/40 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 relative z-2 resize-none"
              placeholder={
                isVendorMode
                  ? 'Add any recent issues or observations not captured in the system...'
                  : 'Describe any recent issues, delays, quality problems, or concerns...'
              }
              rows={3}
            />
          </div>

          {/* Analyze Button */}
          <button
            onClick={handleAnalyze}
            disabled={loading || !form.vendorName.trim()}
            className="relative z-2 w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold rounded-lg transition-colors shadow-lg shadow-blue-900/20"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {LOADING_MESSAGES[loadingMsgIdx]}
              </>
            ) : (
              <>
                <ChevronRight className="w-4 h-4" />
                {isVendorMode ? 'Analyze with Live Procurement Data' : 'Analyze Risk'}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Loading Animation */}
      {loading && (
        <div className="relative z-1 bg-navy-800 border border-blue-900/40 rounded-xl p-8 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
            <span className="text-white font-semibold">{LOADING_MESSAGES[loadingMsgIdx]}</span>
          </div>
          <div className="w-48 mx-auto h-1 bg-navy-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-700"
              style={{ width: `${((loadingMsgIdx + 1) / LOADING_MESSAGES.length) * 100}%` }}
            />
          </div>
          {supplierCtx && (
            <p className="text-xs text-slate-500 mt-3">
              Analyzing live procurement data for{' '}
              <span className="text-blue-400">{supplierCtx.vendorName}</span>
            </p>
          )}
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="relative z-1 bg-red-500/10 border border-red-500/25 rounded-xl px-5 py-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-red-300 font-medium">{error}</p>
            </div>
            <button
              onClick={handleRetry}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 text-xs font-semibold rounded-lg transition-colors border border-red-500/30"
            >
              <RotateCcw className="w-3 h-3" />
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Results */}
      {result && !loading && !error && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-lg font-bold text-white">Risk Assessment Results</h2>
            <div className="flex items-center gap-2 flex-wrap">
              {(['supplyChain', 'financial', 'operational'] as const).map((key) => {
                const label =
                  key === 'supplyChain'
                    ? 'Supply Chain'
                    : key === 'financial'
                    ? 'Financial'
                    : 'Operational';
                const cfg = levelConfig(result[key].level);
                const Icon = cfg.icon;
                return (
                  <span
                    key={key}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.badge}`}
                  >
                    <Icon className="w-3 h-3" />
                    {label}: {result[key].level}
                  </span>
                );
              })}
            </div>
          </div>

          {supplierCtx && (
            <div className="relative z-1 bg-navy-800 border border-blue-900/40 rounded-xl px-5 py-3 flex items-center gap-2">
              <Info className="w-4 h-4 text-blue-400" />
              <p className="text-xs text-slate-400">
                Analysis based on live procurement data for{' '}
                <span className="text-blue-400 font-medium">{supplierCtx.vendorName}</span>{' '}
                — Overall Risk Score: {supplierCtx.overallRiskScore}/100 ({supplierCtx.riskLevel} Risk),{' '}
                {supplierCtx.lateOrders} late order{supplierCtx.lateOrders !== 1 ? 's' : ''},{' '}
                {supplierCtx.currentOverdueOrders} overdue PO{supplierCtx.currentOverdueOrders !== 1 ? 's' : ''}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <RiskCard title="Supply Chain Risk" data={result.supplyChain} />
            <RiskCard title="Financial Risk" data={result.financial} />
            <RiskCard title="Operational Risk" data={result.operational} />
          </div>

          {demoMode && (
            <p className="text-center text-xs text-slate-600 mt-2">
              Results generated in Demo Mode. Add a Groq API key above to enable live analysis.
            </p>
          )}
        </div>
      )}

      {/* History Modal */}
      {showHistory && (
        <HistoryPanel
          analyses={history}
          onSelect={handleSelectHistory}
          onDelete={handleDeleteHistory}
          onClose={() => setShowHistory(false)}
        />
      )}
    </div>
  );
}
