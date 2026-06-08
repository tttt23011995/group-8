import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
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
} from 'lucide-react';
import { getVendors, Vendor } from '../lib/data';

// ── Types ────────────────────────────────────────────────────────────────

interface RiskCategory {
  level: 'High' | 'Medium' | 'Low';
  summary: string;
  factors: string[];
  mitigations: string[];
}

interface RiskAnalysis {
  supplyChain: RiskCategory;
  financial: RiskCategory;
  operational: RiskCategory;
}

interface SavedAnalysis {
  id: string;
  timestamp: string;
  vendorName: string;
  category: string;
  annualSpend: number;
  result: RiskAnalysis;
  demoMode: boolean;
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

const CATEGORIES = ['Electronics', 'Logistics', 'Raw Materials', 'Office Supplies', 'IT Services'] as const;
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

// ── Helpers ──────────────────────────────────────────────────────────────

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

function getApiKey(): string {
  return localStorage.getItem('apiKey') || '';
}

function levelConfig(level: RiskCategory['level']) {
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

function RiskCard({ title, data }: { title: string; data: RiskCategory }) {
  const cfg = levelConfig(data.level);
  const Icon = cfg.icon;

  return (
    <div className={`relative z-1 rounded-xl border overflow-hidden ${cfg.border} ${cfg.bg} transition-shadow duration-300 hover:shadow-lg hover:shadow-black/20`}>
      <div className={`${cfg.headerBg} border-b ${cfg.headerBorder} px-5 py-4 flex items-center justify-between`}>
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
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Risk Factors</h4>
          <ul className="space-y-1.5">
            {data.factors.map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-400">
                <span className={`w-1.5 h-1.5 rounded-full ${cfg.barFill} flex-shrink-0 mt-1.5`} />
                {f}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Mitigation Steps</h4>
          <ol className="space-y-1.5">
            {data.mitigations.map((m, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-slate-300">
                <span className={`w-5 h-5 rounded-full ${cfg.barBg} flex items-center justify-center text-[10px] font-bold ${cfg.color} flex-shrink-0`}>
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
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors">
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
                    {new Date(a.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  </span>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-blue-400">{a.category}</span>
                  <span className="text-xs text-slate-600">|</span>
                  <span className="text-xs text-slate-400">${a.annualSpend.toLocaleString()} annual</span>
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
                      <span key={key} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border ${cfg.badge}`}>
                        <Icon className="w-2.5 h-2.5" />
                        {a.result[key].level}
                      </span>
                    );
                  })}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(a.id); }}
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

// ── Main Component ───────────────────────────────────────────────────────

export default function AIRisk() {
  const vendors = useMemo(() => getVendors(), []);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [demoMode, setDemoMode] = useState(false);
  const [autoDemoBanner, setAutoDemoBanner] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [result, setResult] = useState<RiskAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<SavedAnalysis[]>(() => getSavedAnalyses());
  const loadingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-detect missing API key
  useEffect(() => {
    const key = getApiKey();
    if (!key) {
      setDemoMode(true);
      setAutoDemoBanner(true);
    }
  }, []);

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
      setForm({ ...form, vendorName: '' });
      return;
    }
    const v = vendors.find((vr: Vendor) => vr.id === vendorId);
    if (v) {
      setForm({
        ...form,
        vendorName: v.name,
        category: v.category,
        paymentTerms: v.paymentTerms || 'Net 30',
      });
    }
  }

  const handleAnalyze = useCallback(async () => {
    if (!form.vendorName.trim()) return;

    setError(null);
    setResult(null);
    setLoading(true);

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
      };
      saveAnalysis(analysis);
      setHistory(getSavedAnalyses());
      setResult(DEMO_RESULT);
      setLoading(false);
      return;
    }

    const apiKey = getApiKey();
    if (!apiKey) {
      setError('No API key configured. Please add your Anthropic API key in Settings.');
      setLoading(false);
      return;
    }

    const userPrompt = `Analyze procurement risk for:
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

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-20240307',
          max_tokens: 2048,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        }),
      });

      if (res.status === 401) {
        setError('Invalid API key. Please check your key in Settings.');
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
      const textBlock = data?.content?.find((c: { type: string }) => c.type === 'text');
      const rawText = textBlock?.text || '';

      let parsed: RiskAnalysis;
      try {
        const cleaned = rawText.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
        parsed = JSON.parse(cleaned);
      } catch (parseErr) {
        console.error('Raw AI response:', rawText);
        console.error('Parse error:', parseErr);
        setError('AI response was unreadable. Please try again.');
        setLoading(false);
        return;
      }

      if (!parsed.supplyChain?.level || !parsed.financial?.level || !parsed.operational?.level) {
        console.error('Malformed response:', parsed);
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
      };
      saveAnalysis(analysis);
      setHistory(getSavedAnalyses());
      setResult(parsed);
    } catch (err) {
      if (err instanceof TypeError && err.message.includes('fetch')) {
        setError('Connection failed. Check your internet and try again.');
      } else {
        console.error('Unexpected error:', err);
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [form, demoMode]);

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

  const vendorDropdown = (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
      <select
        value=""
        onChange={(e) => handleVendorSelect(e.target.value)}
        className="w-full pl-10 pr-10 py-2.5 bg-navy-700 border border-blue-900/40 rounded-lg text-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 appearance-none relative z-2"
      >
        <option value="">Load from vendor directory...</option>
        {vendors.map((v: Vendor) => (
          <option key={v.id} value={v.id}>{v.name} ({v.category})</option>
        ))}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ShieldAlert className="w-7 h-7 text-blue-400" />
            AI Risk Analyzer
          </h1>
          <p className="text-slate-400 text-sm mt-1">AI-powered procurement risk assessment with mitigation strategies</p>
        </div>
        <button
          onClick={() => setShowHistory(true)}
          className="relative z-2 flex items-center gap-1.5 px-4 py-2.5 bg-navy-700 hover:bg-navy-600 text-slate-300 text-sm font-semibold rounded-lg transition-colors border border-blue-900/40"
        >
          <History className="w-4 h-4" />
          History ({history.length})
        </button>
      </div>

      {/* API Key Banner */}
      {autoDemoBanner && (
        <div className="relative z-1 bg-yellow-500/10 border border-yellow-500/25 rounded-xl px-5 py-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-yellow-300 font-medium">No API key configured — running in Demo Mode</p>
            <p className="text-xs text-yellow-400/70 mt-1">
              Add your Anthropic API key to localStorage as "apiKey" to enable live AI analysis.
            </p>
          </div>
          <button onClick={() => setAutoDemoBanner(false)} className="text-yellow-400/50 hover:text-yellow-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Demo Mode Toggle */}
      <div className="relative z-1 bg-navy-800 border border-blue-900/40 rounded-xl px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${demoMode ? 'bg-yellow-500/15' : 'bg-blue-500/15'}`}>
            {demoMode ? (
              <AlertCircle className="w-4 h-4 text-yellow-400" />
            ) : (
              <ShieldAlert className="w-4 h-4 text-blue-400" />
            )}
          </div>
          <div>
            <p className="text-sm text-white font-medium">Demo Mode</p>
            <p className="text-xs text-slate-500">
              {demoMode ? 'Using example data — no API calls' : 'Live AI analysis via Anthropic API'}
            </p>
          </div>
        </div>
        <button
          onClick={() => setDemoMode(!demoMode)}
          className={`relative w-12 h-7 rounded-full transition-colors duration-200 flex-shrink-0 ${
            demoMode ? 'bg-yellow-500' : 'bg-blue-600'
          }`}
          role="switch"
          aria-checked={demoMode}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform duration-200 ${
              demoMode ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {/* Input Form */}
      <div className="relative z-1 bg-navy-800 border border-blue-900/40 rounded-xl p-5 sm:p-6">
        <h2 className="text-lg font-bold text-white mb-4">Risk Assessment Parameters</h2>

        {/* Vendor selector */}
        <div className="mb-5">
          <label className="block text-sm text-slate-400 mb-1.5">Quick Load from Directory</label>
          {vendorDropdown}
        </div>

        <div className="space-y-4">
          {/* Row 1: Vendor Name + Category */}
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
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Row 2: Spend + Suppliers + Delay */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Annual Spend (USD)</label>
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

          {/* Row 3: Quality + Payment Terms */}
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
                    <option key={pt} value={pt}>{pt}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Row 4: Notes */}
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
                const label = key === 'supplyChain' ? 'Supply Chain' : key === 'financial' ? 'Financial' : 'Operational';
                const cfg = levelConfig(result[key].level);
                const Icon = cfg.icon;
                return (
                  <span key={key} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.badge}`}>
                    <Icon className="w-3 h-3" />
                    {label}: {result[key].level}
                  </span>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <RiskCard title="Supply Chain Risk" data={result.supplyChain} />
            <RiskCard title="Financial Risk" data={result.financial} />
            <RiskCard title="Operational Risk" data={result.operational} />
          </div>

          {demoMode && (
            <p className="text-center text-xs text-slate-600 mt-2">
              Results generated in Demo Mode. Enable live analysis with a valid API key.
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
