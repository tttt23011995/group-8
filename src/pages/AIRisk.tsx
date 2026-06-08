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
} from 'lucide-react';
import { getVendors, Vendor } from '../lib/data';
import {
  buildSupplierRiskData,
  RiskCategory,
  LegacySupplierMetrics,
  LegacySupplierRisk,
  LegacySupplierRiskEntry,
} from '../lib/supplierRisk';

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
  vendorName: string;
  category: string;
  location: string;
  status: string;
  contractEnd: string;
  paymentTerms: string;
  leadTime: number;
  totalOrders: number;
  lateOrders: number;
  lateDeliveryRate: number;
  currentOverdueOrders: number;
  averageDelayDays: number;
  onTimeDeliveryRate: number;
  averageLeadTime: number;
  openPOCount: number;
  supplierSpend: number;
  supplierSpendShare: number;
  vendorRatingOverall: number | null;
  vendorRatingDelivery: number | null;
  vendorRatingQuality: number | null;
  vendorRatingCost: number | null;
  overallRiskScore: number;
  riskLevel: string;
  deliveryDelayRiskScore: number;
  leadTimeRiskScore: number;
  supplierDependencyRiskScore: number;
  costConcentrationRiskScore: number;
  supplierPerformanceRiskScore: number;
  detectedRisks: RiskCategory[];
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
const SESSION_KEY = 'groq_session_key';

// ── Key helpers — never touch React state ────────────────────────────────

function getRuntimeKey(): string {
  return sessionStorage.getItem(SESSION_KEY) || localStorage.getItem('apiKey') || '';
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

  return {
    vendorName: m.vendorName,
    category: m.vendor.category,
    location: m.vendor.location,
    status: m.vendor.status,
    contractEnd: m.vendor.contractEnd,
    paymentTerms: m.vendor.paymentTerms,
    leadTime: m.vendorLeadTime,
    totalOrders: m.totalOrders,
    lateOrders: m.lateOrders,
    lateDeliveryRate:
      m.lateOrders > 0 && m.totalOrders > 0
        ? (m.lateOrders / m.totalOrders) * 100
        : 0,
    currentOverdueOrders: m.currentOverdueOrders,
    averageDelayDays: m.averageDelayDays,
    onTimeDeliveryRate: m.onTimeDeliveryRate,
    averageLeadTime: m.averageLeadTime,
    openPOCount:
      m.supplierOrderShare > 0
        ? Math.round((m.totalOrders * m.supplierOrderShare) / 100)
        : m.totalOrders,
    supplierSpend: m.supplierSpend,
    supplierSpendShare: m.supplierSpendShare,
    vendorRatingOverall: m.vendorRatingOverall,
    vendorRatingDelivery: m.vendorRatingDelivery,
    vendorRatingQuality: m.vendorRatingQuality,
    vendorRatingCost: m.vendorRatingCost,
    overallRiskScore: r.overallRiskScore,
    riskLevel: r.riskLevel,
    deliveryDelayRiskScore: r.deliveryDelayRiskScore,
    leadTimeRiskScore: r.leadTimeRiskScore,
    supplierDependencyRiskScore: r.supplierDependencyRiskScore,
    costConcentrationRiskScore: r.costConcentrationRiskScore,
    supplierPerformanceRiskScore: r.supplierPerformanceRiskScore,
    detectedRisks: r.detectedRiskTypes.map((type) => ({
      type,
      severity: type.includes('Delay') || type.includes('Performance')
        ? ('high' as const)
        : ('medium' as const),
      scoreImpact: 0,
      message: type,
    })),
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

// ── Supplier Context Badge ────────────────────────────────────────────────

function SupplierContextBadge({ ctx }: { ctx: SupplierContext }) {
  const riskLevelLower = ctx.riskLevel.toLowerCase() as 'low' | 'medium' | 'high';
  const colorMap = {
    low: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/25',
    medium: 'text-yellow-400 bg-yellow-500/15 border-yellow-500/25',
    high: 'text-red-400 bg-red-500/15 border-red-500/25',
  };
  const cls = colorMap[riskLevelLower] ?? colorMap.medium;

  return (
    <div className="relative z-1 bg-navy-800 border border-blue-900/40 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white">Live Vendor Data Loaded</h3>
        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${cls}`}>
          {ctx.riskLevel} Risk ({ctx.overallRiskScore}/100)
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div>
          <span className="text-slate-500">Status</span>
          <p
            className={`font-semibold ${
              ctx.status === 'active' ? 'text-emerald-400' : 'text-slate-400'
            }`}
          >
            {ctx.status}
          </p>
        </div>
        <div>
          <span className="text-slate-500">On-Time Rate</span>
          <p
            className={`font-semibold ${
              ctx.onTimeDeliveryRate >= 90
                ? 'text-emerald-400'
                : ctx.onTimeDeliveryRate >= 70
                ? 'text-yellow-400'
                : 'text-red-400'
            }`}
          >
            {ctx.onTimeDeliveryRate}%
          </p>
        </div>
        <div>
          <span className="text-slate-500">Total Spend</span>
          <p className="font-semibold text-white">${ctx.supplierSpend.toLocaleString()}</p>
        </div>
        <div>
          <span className="text-slate-500">Late Orders</span>
          <p
            className={`font-semibold ${
              ctx.lateOrders > 0 ? 'text-red-400' : 'text-emerald-400'
            }`}
          >
            {ctx.lateOrders}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {ctx.detectedRisks.map((r, i) => (
          <span
            key={i}
            className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-500/10 text-red-400 border border-red-500/20"
          >
            {r.type}
          </span>
        ))}
        {ctx.detectedRisks.length === 0 && (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            No risk flags detected
          </span>
        )}
      </div>
    </div>
  );
}

// ── API Key Manager (inside Demo Mode card) ───────────────────────────────

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
  const [demoMode, setDemoMode] = useState(() => !getRuntimeKey());
  const [autoDemoBanner, setAutoDemoBanner] = useState(() => !getRuntimeKey());
  const [loading, setLoading] = useState(false);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [result, setResult] = useState<RiskAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<SavedAnalysis[]>(() => getSavedAnalyses());
  const loadingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Called whenever the session key state changes
  function handleKeyChange() {
    const hasKey = !!getRuntimeKey();
    if (hasKey) {
      setDemoMode(false);
      setAutoDemoBanner(false);
    } else {
      setDemoMode(true);
      setAutoDemoBanner(true);
    }
  }

  // Loading message cycling
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
            ? String(Math.round(ctx.vendorRatingQuality / 20))
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

  const handleAnalyze = useCallback(async () => {
    if (!form.vendorName.trim()) return;

    setError(null);
    setResult(null);
    setLoading(true);

    // Build prompts
    const userPrompt =
      selectedVendorId && supplierCtx
        ? `You are analyzing procurement risk for a vendor with the following LIVE DATA pulled from our procurement system.

=== VENDOR PROFILE ===
Name: ${supplierCtx.vendorName}
Category: ${supplierCtx.category}
Location: ${supplierCtx.location}
Status: ${supplierCtx.status}
Contract Expiry: ${supplierCtx.contractEnd}
Payment Terms: ${supplierCtx.paymentTerms}
Declared Lead Time: ${supplierCtx.leadTime} days

=== HISTORICAL PERFORMANCE (from order history) ===
Total Orders Placed: ${supplierCtx.totalOrders}
Late Orders: ${supplierCtx.lateOrders} (${supplierCtx.lateDeliveryRate.toFixed(1)}% late rate)
Currently Overdue POs: ${supplierCtx.currentOverdueOrders}
Average Delay When Late: ${supplierCtx.averageDelayDays} days
On-Time Delivery Rate: ${supplierCtx.onTimeDeliveryRate}%
Actual Average Lead Time: ${supplierCtx.averageLeadTime} days
Open (Unfulfilled) POs: ${supplierCtx.openPOCount}

=== FINANCIAL EXPOSURE ===
Annual Spend with this Vendor: $${supplierCtx.supplierSpend.toLocaleString()}
Spend Share of Total Procurement: ${supplierCtx.supplierSpendShare}%
Manually Provided Annual Spend Override: ${
            form.annualSpend &&
            form.annualSpend !== String(Math.round(supplierCtx.supplierSpend))
              ? '$' + parseInt(form.annualSpend).toLocaleString()
              : 'None'
          }

=== VENDOR RATINGS (1-100 scale) ===
Overall: ${supplierCtx.vendorRatingOverall ?? 'Not rated'}
Delivery: ${supplierCtx.vendorRatingDelivery ?? 'Not rated'}
Quality: ${supplierCtx.vendorRatingQuality ?? 'Not rated'}
Cost: ${supplierCtx.vendorRatingCost ?? 'Not rated'}

=== SYSTEM-COMPUTED RISK SCORES ===
Overall Risk Score: ${supplierCtx.overallRiskScore}/100 (${supplierCtx.riskLevel} Risk)
  - Delivery Delay Risk: ${supplierCtx.deliveryDelayRiskScore}/30
  - Lead Time Risk: ${supplierCtx.leadTimeRiskScore}/20
  - Supplier Dependency Risk: ${supplierCtx.supplierDependencyRiskScore}/20
  - Cost Concentration Risk: ${supplierCtx.costConcentrationRiskScore}/15
  - Performance Risk: ${supplierCtx.supplierPerformanceRiskScore}/15

=== DETECTED RISK FLAGS ===
${
  supplierCtx.detectedRisks.length > 0
    ? supplierCtx.detectedRisks
        .map((r) => `[${r.severity.toUpperCase()}] ${r.type}: ${r.message}`)
        .join('\n')
    : 'No risk flags detected'
}

=== ALTERNATIVE SUPPLIERS ===
Known Alternative Suppliers: ${form.alternativeSuppliers} (0 = sole source dependency)

=== ADDITIONAL CONTEXT ===
${form.notes || 'No additional notes provided.'}

Based on ALL of the above real procurement data, provide a comprehensive risk assessment
with specific, data-driven observations. Reference actual numbers from the data above
(e.g., mention the specific late rate, the spend share percentage, the risk scores).
Do NOT give generic advice — tailor every factor and mitigation to this vendor's actual data.`
        : `Analyze procurement risk for:
Vendor: ${form.vendorName}
Product Category: ${form.category}
Annual Spend: $${parseInt(form.annualSpend) || 0}
Alternative Suppliers: ${form.alternativeSuppliers} (0 = sole source)
Average Delivery Delay: ${form.avgDeliveryDelay} days
Average Quality Score: ${form.avgQualityScore}/5
Payment Terms: ${form.paymentTerms}
Recent Issues: ${form.notes || 'None reported'}`;

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
        annualSpend: parseInt(form.annualSpend) || 0,
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

    // Read key fresh — never from state
    const runtimeKey =
      sessionStorage.getItem(SESSION_KEY) || localStorage.getItem('apiKey') || '';

    if (!runtimeKey) {
      // Auto-fallback to demo mode rather than throwing
      setDemoMode(true);
      await new Promise((r) => setTimeout(r, 1800));
      const analysis: SavedAnalysis = {
        id: Math.random().toString(36).substring(2, 11),
        timestamp: new Date().toISOString(),
        vendorName: form.vendorName,
        category: form.category,
        annualSpend: parseInt(form.annualSpend) || 0,
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
      const content = data?.choices?.[0]?.message?.content ?? '';

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
        annualSpend: parseInt(form.annualSpend) || 0,
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
            AI-powered procurement risk assessment with mitigation strategies
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
        <h2 className="text-lg font-bold text-white mb-4">Risk Assessment Parameters</h2>

        {/* Vendor selector */}
        <div className="mb-5">
          <label className="block text-sm text-slate-400 mb-1.5">Load from Vendor Directory</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <select
                value={selectedVendorId || ''}
                onChange={(e) => handleVendorSelect(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 bg-navy-700 border border-blue-900/40 rounded-lg text-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 appearance-none relative z-2"
              >
                <option value="">Select a vendor...</option>
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

        {supplierCtx && <SupplierContextBadge ctx={supplierCtx} />}

        <div className="space-y-4 mt-5">
          {/* Row 1 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">
                Vendor Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={form.vendorName}
                onChange={(e) => setForm({ ...form, vendorName: e.target.value })}
                className="w-full px-4 py-2.5 bg-navy-700 border border-blue-900/40 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 relative z-2"
                placeholder="Enter vendor name"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Product Category</label>
              <div className="relative">
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
              </div>
            </div>
          </div>

          {/* Row 2 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">
                Annual Spend (USD)
                {supplierCtx &&
                  form.annualSpend !== String(Math.round(supplierCtx.supplierSpend)) && (
                    <span className="text-blue-400 ml-1 text-xs">(override)</span>
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
              <label className="block text-sm text-slate-400 mb-1.5">Avg Delivery Delay (days)</label>
              <input
                type="number"
                value={form.avgDeliveryDelay}
                onChange={(e) => setForm({ ...form, avgDeliveryDelay: e.target.value })}
                className="w-full px-4 py-2.5 bg-navy-700 border border-blue-900/40 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 relative z-2"
                min="0"
              />
            </div>
          </div>

          {/* Row 3 */}
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

          {/* Row 4 */}
          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Recent Issues or Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full px-4 py-2.5 bg-navy-700 border border-blue-900/40 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 relative z-2 resize-none"
              placeholder="Describe any recent issues, delays, quality problems, or concerns..."
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
                Analyze Risk
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
              Analyzing live data for{' '}
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
                (Overall Risk: {supplierCtx.overallRiskScore}/100, {supplierCtx.riskLevel} Risk)
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
