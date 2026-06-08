import { useMemo, useState, useEffect } from 'react';
import { Search, Plus, Mail, Clock, FileText, ChevronDown, CreditCard as Edit2, Trash2, X, AlertTriangle, Building2, Phone, MapPin, Calendar, Star, FileText as FileTextIcon, Download, StickyNote, Check, Scale, ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { getVendors, saveVendors, Vendor, generateVendorCode, getPurchaseOrders, getVendorRatings, PurchaseOrder } from '../lib/data';

async function getOpenPOCount(vendor: Vendor): Promise<number> {
  const pos = await getPurchaseOrders();
  const vendorId = vendor.id;
  const vendorNameNorm = vendor.name.trim().toLowerCase();

  return pos.filter((po) => {
    const statusNorm = po.status?.trim().toLowerCase() || '';
    if (statusNorm === 'invoiced' || statusNorm === 'delivered') {
      return false;
    }

    const poVendorId = (po as PurchaseOrder & { vendorId?: string }).vendorId;
    if (poVendorId && poVendorId === vendorId) {
      return true;
    }

    const poVendor = (po as PurchaseOrder & { vendor?: string; company?: string }).vendor;
    const poVendorName = po.vendorName;
    const poCompany = (po as PurchaseOrder & { vendor?: string; company?: string }).company;

    const poNames = [poVendor, poVendorName, poCompany].filter(Boolean).map((n) => n!.trim().toLowerCase());
    return poNames.includes(vendorNameNorm);
  }).length;
}

function HighlightText({ text, highlight }: { text: string; highlight: string }) {
  if (!highlight.trim()) {
    return <>{text}</>;
  }
  const regex = new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="bg-yellow-400/40 text-yellow-200 rounded px-0.5">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
}

const CATEGORIES = ['Electronics', 'Logistics', 'Raw Materials', 'Office Supplies', 'IT Services'] as const;
const PAYMENT_TERMS = ['Net 30', 'Net 60', 'Net 90'] as const;

const categoryColors: Record<string, string> = {
  Electronics: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  Logistics: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  'Raw Materials': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  'Office Supplies': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  'IT Services': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
};

const statusColors: Record<string, string> = {
  active: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  inactive: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
};

const categoryAvatarColors: Record<string, string> = {
  Electronics: 'bg-blue-500',
  Logistics: 'bg-emerald-500',
  'Raw Materials': 'bg-yellow-500',
  'Office Supplies': 'bg-purple-500',
  'IT Services': 'bg-orange-500',
};

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function parsePaymentDays(terms: string): number {
  const match = terms.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 30;
}

interface VendorFormData {
  name: string;
  contact: string;
  email: string;
  phone: string;
  category: string;
  paymentTerms: string;
  leadTime: string;
  status: 'active' | 'inactive';
  location: string;
  notes: string;
}

const emptyForm: VendorFormData = {
  name: '',
  contact: '',
  email: '',
  phone: '',
  category: 'Electronics',
  paymentTerms: 'Net 30',
  leadTime: '7',
  status: 'active',
  location: '',
  notes: '',
};

export default function Vendors() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    Promise.all([
      getVendors(),
      getPurchaseOrders(),
    ]).then(([v, p]) => {
      setVendors(v);
      setPos(p);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [deletingVendor, setDeletingVendor] = useState<Vendor | null>(null);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [form, setForm] = useState<VendorFormData>(emptyForm);
  const [formErrors, setFormErrors] = useState<{ name?: string; email?: string }>({});
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [maxSelectWarning, setMaxSelectWarning] = useState(false);

  function toggleCompare(id: string) {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) {
        setMaxSelectWarning(true);
        setTimeout(() => setMaxSelectWarning(false), 2500);
        return prev;
      }
      return [...prev, id];
    });
  }

  function clearSelection() {
    setCompareIds([]);
  }

  useEffect(() => {
    if (editingVendor) {
      setForm({
        name: editingVendor.name,
        contact: editingVendor.contact,
        email: editingVendor.email,
        phone: editingVendor.phone,
        category: editingVendor.category,
        paymentTerms: editingVendor.paymentTerms || 'Net 30',
        leadTime: String(editingVendor.leadTime || 7),
        status: editingVendor.status,
        location: editingVendor.location,
        notes: (editingVendor as Vendor & { notes?: string }).notes || '',
      });
      setShowAddModal(true);
    }
  }, [editingVendor]);

  const filtered = useMemo(() => {
    return vendors.filter((v) => {
      const matchSearch =
        v.name.toLowerCase().includes(search.toLowerCase()) ||
        v.category.toLowerCase().includes(search.toLowerCase()) ||
        v.location.toLowerCase().includes(search.toLowerCase()) ||
        v.contact.toLowerCase().includes(search.toLowerCase()) ||
        v.email.toLowerCase().includes(search.toLowerCase());
      const matchCategory = filterCategory === 'all' || v.category === filterCategory;
      const matchStatus = filterStatus === 'all' || v.status === filterStatus;
      return matchSearch && matchCategory && matchStatus;
    });
  }, [vendors, search, filterCategory, filterStatus]);

  function validateForm(): boolean {
    const errors: { name?: string; email?: string } = {};
    if (!form.name.trim()) errors.name = 'Company Name is required';
    if (!form.email.trim()) errors.email = 'Email is required';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSave() {
    if (!validateForm()) return;

    if (editingVendor) {
      const updated = vendors.map((v) =>
        v.id === editingVendor.id
          ? {
              ...v,
              name: form.name,
              contact: form.contact,
              email: form.email,
              phone: form.phone,
              category: form.category,
              paymentTerms: form.paymentTerms,
              leadTime: parseInt(form.leadTime, 10) || 7,
              status: form.status,
              location: form.location,
              notes: form.notes,
            }
          : v
      );
      setVendors(updated);
      saveVendors(updated);
    } else {
      const vendorCode = await generateVendorCode();
      const newVendor: Vendor & { notes?: string } = {
        id: Math.random().toString(36).substring(2, 11),
        vendorCode,
        name: form.name,
        contact: form.contact,
        email: form.email,
        phone: form.phone,
        category: form.category,
        paymentTerms: form.paymentTerms,
        leadTime: parseInt(form.leadTime, 10) || 7,
        status: form.status,
        location: form.location,
        score: 70 + Math.floor(Math.random() * 20),
        contractEnd: '2027-01-01',
        notes: form.notes,
      };
      const updated = [...vendors, newVendor];
      setVendors(updated);
      saveVendors(updated);
    }

    closeModal();
  }

  function closeModal() {
    setShowAddModal(false);
    setEditingVendor(null);
    setForm(emptyForm);
    setFormErrors({});
  }

  async function handleDelete(vendor: Vendor) {
    const openPOs = await getOpenPOCount(vendor);
    setDeletingVendor({ ...vendor, openPOCount: openPOs } as Vendor & { openPOCount: number });
  }

  function confirmDelete() {
    if (!deletingVendor) return;
    const updated = vendors.filter((v) => v.id !== deletingVendor.id);
    setVendors(updated);
    saveVendors(updated);
    setDeletingVendor(null);
  }

  function exportCSV() {
    if (vendors.length === 0) {
      alert('No vendors to export');
      return;
    }

    const headers = ['ID', 'Company', 'Category', 'Contact', 'Email', 'Phone', 'PaymentTerms', 'LeadTime', 'Status'];
    const rows = vendors.map((v) => [
      v.vendorCode,
      v.name,
      v.category,
      v.contact,
      v.email,
      v.phone,
      v.paymentTerms || 'Net 30',
      String(v.leadTime || 7),
      v.status,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'vendors.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Building2 className="w-7 h-7 text-blue-400" />
            Vendor Directory
          </h1>
          <p className="text-slate-400 text-sm mt-1">{vendors.length} vendors registered</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={exportCSV}
            className="relative z-2 flex items-center gap-1.5 px-4 py-2.5 bg-navy-700 hover:bg-navy-600 text-slate-300 text-sm font-semibold rounded-lg transition-colors border border-blue-900/40"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button
            onClick={() => {
              setEditingVendor(null);
              setForm(emptyForm);
              setShowAddModal(true);
            }}
            className="relative z-2 flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition-colors shadow-lg shadow-blue-900/20"
          >
            <Plus className="w-4 h-4" />
            Add Vendor
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        {/* Filter Panel */}
        <div className="lg:w-56 flex-shrink-0">
          <div className="relative z-1 bg-navy-800 border border-blue-900/40 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-400" />
              Filters
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-2">Category</label>
                <div className="relative">
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="w-full bg-navy-700 border border-blue-900/40 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 appearance-none relative z-2 pr-10"
                  >
                    <option value="all">All Categories</option>
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-2">Status</label>
                <div className="relative">
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="w-full bg-navy-700 border border-blue-900/40 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 appearance-none relative z-2 pr-10"
                  >
                    <option value="all">All Statuses</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                </div>
              </div>

              {(filterCategory !== 'all' || filterStatus !== 'all') && (
                <button
                  onClick={() => {
                    setFilterCategory('all');
                    setFilterStatus('all');
                  }}
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          {/* Search Bar */}
          <div className="relative mb-4">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
            <input
              type="text"
              placeholder="Search vendors by name, category, location, or contact..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-12 py-3 bg-navy-800 border border-blue-900/40 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 relative z-2"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Vendor Count */}
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-slate-400">
              Showing <span className="text-white font-medium">{filtered.length}</span> of <span className="text-white font-medium">{vendors.length}</span> vendors
            </p>
          </div>

          {/* Vendor Grid */}
          {filtered.length === 0 ? (
            <div className="relative z-1 bg-navy-800 border border-blue-900/40 rounded-xl p-12 text-center">
              <Building2 className="w-16 h-16 mx-auto mb-4 text-slate-600" />
              <p className="text-slate-400 font-medium">
                {search ? `No vendors match "${search}"` : 'No vendors found'}
              </p>
              <p className="text-slate-500 text-sm mt-1">Try adjusting your filters or search query</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map((v) => {
                const openPOCount = pos.filter((po) => {
                  const s = po.status?.trim().toLowerCase() || '';
                  if (s === 'invoiced' || s === 'delivered') return false;
                  return po.vendorId === v.id;
                }).length;
                const isSelected = compareIds.includes(v.id);
                return (
                  <div
                    key={v.id}
                    onClick={() => setSelectedVendor(v)}
                    className={`relative z-1 bg-navy-800 border rounded-xl p-5 transition-all duration-300 hover:shadow-lg hover:shadow-blue-900/20 hover:border-blue-800/60 group cursor-pointer ${isSelected ? 'border-blue-500 ring-1 ring-blue-500/40' : 'border-blue-900/40'}`}
                  >
                    {/* Compare checkbox */}
                    <div
                      className={`absolute top-3 right-3 z-10 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleCompare(v.id);
                      }}
                    >
                      <button
                        className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-colors ${isSelected ? 'bg-blue-600 border-blue-500 text-white' : 'bg-navy-700 border-blue-900/40 text-slate-500 hover:border-blue-500 hover:text-blue-400'}`}
                        title={isSelected ? 'Deselect' : 'Select to compare'}
                        style={{ minHeight: 44, minWidth: 44 }}
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex items-start gap-3 mb-3">
                      <div className="relative">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 ${categoryAvatarColors[v.category] || 'bg-slate-500'}`}>
                          {getInitials(v.name)}
                        </div>
                        {openPOCount > 0 && (
                          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-blue-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                            {openPOCount}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-mono text-slate-500">{v.vendorCode}</span>
                        </div>
                        <h3 className="text-white font-semibold truncate">
                          <HighlightText text={v.name} highlight={search} />
                        </h3>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${categoryColors[v.category] || 'bg-slate-500/20 text-slate-400 border-slate-500/30'}`}>
                            <HighlightText text={v.category} highlight={search} />
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${statusColors[v.status]}`}>
                            {v.status.charAt(0).toUpperCase() + v.status.slice(1)}
                          </span>
                        </div>
                      </div>
                    </div>

                  <div className="space-y-2 text-sm text-slate-400 mb-4">
                    <div className="flex items-center gap-2 min-w-0">
                      <Building2 className="w-4 h-4 text-slate-500 flex-shrink-0" />
                      <span className="truncate">
                        <HighlightText text={v.contact} highlight={search} />
                      </span>
                    </div>
                    <div className="flex items-center gap-2 min-w-0">
                      <Mail className="w-4 h-4 text-slate-500 flex-shrink-0" />
                      <span className="truncate">
                        <HighlightText text={v.email} highlight={search} />
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-slate-500 flex-shrink-0" />
                      <span>{v.leadTime || 7} days lead time</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-blue-900/30">
                    <span className="text-xs text-slate-500">{v.paymentTerms || 'Net 30'}</span>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedVendor(null);
                          setEditingVendor(v);
                        }}
                        className="p-2 rounded-lg bg-navy-700 hover:bg-blue-600/20 text-slate-400 hover:text-blue-400 transition-colors"
                        title="Edit vendor"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedVendor(null);
                          handleDelete(v);
                        }}
                        className="p-2 rounded-lg bg-navy-700 hover:bg-red-600/20 text-slate-400 hover:text-red-400 transition-colors"
                        title="Delete vendor"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Compare floating bar */}
      {compareIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[150] flex items-center gap-3 bg-navy-800 border border-blue-900/40 rounded-xl px-5 py-3 shadow-2xl shadow-black/40">
          <span className="text-sm text-slate-400">
            {compareIds.length} of 2 selected
          </span>
          <button
            onClick={clearSelection}
            className="px-3 py-1.5 bg-navy-700 hover:bg-navy-600 text-slate-400 hover:text-white text-xs font-medium rounded-lg transition-colors border border-blue-900/40"
          >
            Clear Selection
          </button>
          {compareIds.length === 2 ? (
            <button
              onClick={() => setShowCompareModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition-colors shadow-lg shadow-blue-900/20"
            >
              <Scale className="w-4 h-4" />
              Compare
            </button>
          ) : (
            <span className="text-xs text-slate-500">Select 1 more to compare</span>
          )}
        </div>
      )}

      {/* Max selection warning toast */}
      {maxSelectWarning && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[150] bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-medium px-4 py-2.5 rounded-lg animate-pulse">
          Maximum 2 vendors can be compared at once.
        </div>
      )}

      {/* Compare Modal */}
      {showCompareModal && compareIds.length === 2 && (
        <CompareModal
          vendorA={vendors.find((v) => v.id === compareIds[0])!}
          vendorB={vendors.find((v) => v.id === compareIds[1])!}
          onClose={() => setShowCompareModal(false)}
        />
      )}

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative z-10 bg-navy-800 border border-blue-900/40 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-navy-800 px-6 py-4 border-b border-blue-900/40 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">
                {editingVendor ? 'Edit Vendor' : 'Add New Vendor'}
              </h2>
              <button
                onClick={closeModal}
                className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">
                  Company Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => {
                    setForm({ ...form, name: e.target.value });
                    if (formErrors.name) setFormErrors({ ...formErrors, name: undefined });
                  }}
                  className={`w-full px-4 py-2.5 bg-navy-700 border rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 relative z-2 ${formErrors.name ? 'border-red-500' : 'border-blue-900/40'}`}
                  placeholder="Enter company name"
                />
                {formErrors.name && (
                  <p className="text-red-400 text-xs mt-1">{formErrors.name}</p>
                )}
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1.5">
                  Contact Person <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={form.contact}
                  onChange={(e) => setForm({ ...form, contact: e.target.value })}
                  className="w-full px-4 py-2.5 bg-navy-700 border border-blue-900/40 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 relative z-2"
                  placeholder="Enter contact name"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1.5">
                  Email <span className="text-red-400">*</span>
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => {
                    setForm({ ...form, email: e.target.value });
                    if (formErrors.email) setFormErrors({ ...formErrors, email: undefined });
                  }}
                  className={`w-full px-4 py-2.5 bg-navy-700 border rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 relative z-2 ${formErrors.email ? 'border-red-500' : 'border-blue-900/40'}`}
                  placeholder="Enter email address"
                />
                {formErrors.email && (
                  <p className="text-red-400 text-xs mt-1">{formErrors.email}</p>
                )}
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Phone</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full px-4 py-2.5 bg-navy-700 border border-blue-900/40 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 relative z-2"
                  placeholder="Enter phone number"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1.5">Category</label>
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1.5">Lead Time (days)</label>
                  <input
                    type="number"
                    value={form.leadTime}
                    onChange={(e) => setForm({ ...form, leadTime: e.target.value })}
                    className="w-full px-4 py-2.5 bg-navy-700 border border-blue-900/40 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 relative z-2"
                    min="0"
                    placeholder="7"
                  />
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-1.5">Status</label>
                  <div className="relative">
                    <select
                      value={form.status}
                      onChange={(e) => setForm({ ...form, status: e.target.value as 'active' | 'inactive' })}
                      className="w-full bg-navy-700 border border-blue-900/40 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 appearance-none relative z-2 pr-10"
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Location</label>
                <input
                  type="text"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  className="w-full px-4 py-2.5 bg-navy-700 border border-blue-900/40 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 relative z-2"
                  placeholder="City, State"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value.slice(0, 300) })}
                  className="w-full px-4 py-2.5 bg-navy-700 border border-blue-900/40 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 relative z-2 resize-none"
                  placeholder="Additional notes about this vendor..."
                  rows={3}
                />
                <p className="text-xs text-slate-500 mt-1 text-right">{form.notes.length} / 300</p>
              </div>
            </div>

            <div className="sticky bottom-0 bg-navy-800 px-6 py-4 border-t border-blue-900/40 flex justify-end gap-3">
              <button
                onClick={closeModal}
                className="px-5 py-2.5 bg-navy-700 hover:bg-navy-600 text-slate-300 text-sm font-medium rounded-lg transition-colors border border-blue-900/40"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {editingVendor ? 'Save Changes' : 'Add Vendor'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingVendor && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDeletingVendor(null)} />
          <div className="relative z-10 bg-navy-800 border border-blue-900/40 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-6">
              <div className="flex items-center justify-center w-14 h-14 mx-auto mb-4 rounded-full bg-red-500/10">
                <AlertTriangle className="w-7 h-7 text-red-400" />
              </div>
              <h2 className="text-lg font-bold text-white text-center mb-2">Delete Vendor</h2>
              <p className="text-slate-400 text-sm text-center mb-4">
                Are you sure you want to delete <span className="text-white font-medium">{deletingVendor.name}</span>?
              </p>

              {(deletingVendor as Vendor & { openPOCount?: number }).openPOCount ? (
                <div className="relative z-1 bg-orange-500/10 border border-orange-500/20 rounded-lg p-4 mb-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-orange-400 text-sm font-medium">Warning</p>
                      <p className="text-orange-300/80 text-xs mt-1">
                        This vendor has {(deletingVendor as Vendor & { openPOCount?: number }).openPOCount} open order(s).
                        Deleting may affect order tracking.
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="flex gap-3">
                <button
                  onClick={() => setDeletingVendor(null)}
                  className="flex-1 px-4 py-2.5 bg-navy-700 hover:bg-navy-600 text-slate-300 text-sm font-medium rounded-lg transition-colors border border-blue-900/40"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Vendor Detail Panel */}
      {selectedVendor && (
        <VendorDetailPanel
          vendor={selectedVendor}
          onClose={() => setSelectedVendor(null)}
          onEdit={(v) => {
            setSelectedVendor(null);
            setEditingVendor(v);
          }}
          onDelete={(v) => {
            setSelectedVendor(null);
            handleDelete(v);
          }}
        />
      )}
    </div>
  );
}

function CompareModal({
  vendorA,
  vendorB,
  onClose,
}: {
  vendorA: Vendor;
  vendorB: Vendor;
  onClose: () => void;
}) {
  const [ratings, setRatings] = useState<Awaited<ReturnType<typeof getVendorRatings>>>([]);
  const [openPOsA, setOpenPOsA] = useState(0);
  const [openPOsB, setOpenPOsB] = useState(0);

  useEffect(() => {
    getVendorRatings().then(setRatings).catch(() => {});
    getOpenPOCount(vendorA).then(setOpenPOsA).catch(() => {});
    getOpenPOCount(vendorB).then(setOpenPOsB).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorA.id, vendorB.id]);

  const ratingA = ratings.find((r) => r.vendorId === vendorA.id);
  const ratingB = ratings.find((r) => r.vendorId === vendorB.id);

  const avgA = ratingA
    ? Math.round((ratingA.quality + ratingA.delivery + ratingA.cost + ratingA.responsiveness) / 4)
    : null;
  const avgB = ratingB
    ? Math.round((ratingB.quality + ratingB.delivery + ratingB.cost + ratingB.responsiveness) / 4)
    : null;

  const leadA = vendorA.leadTime || 7;
  const leadB = vendorB.leadTime || 7;

  const payDaysA = parsePaymentDays(vendorA.paymentTerms || 'Net 30');
  const payDaysB = parsePaymentDays(vendorB.paymentTerms || 'Net 30');

  type Cmp = 'better' | 'worse' | 'neutral';

  function cmpLower(a: number, b: number): [Cmp, Cmp] {
    if (a < b) return ['better', 'worse'];
    if (a > b) return ['worse', 'better'];
    return ['neutral', 'neutral'];
  }

  function cmpHigher(a: number | null, b: number | null): [Cmp, Cmp] {
    if (a === null && b === null) return ['neutral', 'neutral'];
    if (a === null) return ['worse', 'better'];
    if (b === null) return ['better', 'worse'];
    if (a > b) return ['better', 'worse'];
    if (a < b) return ['worse', 'better'];
    return ['neutral', 'neutral'];
  }

  const leadCmp = cmpLower(leadA, leadB);
  const payCmp = cmpHigher(payDaysA, payDaysB);
  const scoreCmp = cmpHigher(avgA, avgB);
  const poCmp = cmpLower(openPOsA, openPOsB);

  const cmpColor: Record<Cmp, string> = {
    better: 'text-emerald-400',
    worse: 'text-red-400',
    neutral: 'text-slate-400',
  };

  const cmpBg: Record<Cmp, string> = {
    better: 'bg-emerald-500/10 border-emerald-500/20',
    worse: 'bg-red-500/10 border-red-500/20',
    neutral: 'bg-navy-700/50 border-blue-900/40',
  };

  const CmpIcon = ({ val }: { val: Cmp }) => {
    if (val === 'better') return <ArrowUp className="w-4 h-4 text-emerald-400" />;
    if (val === 'worse') return <ArrowDown className="w-4 h-4 text-red-400" />;
    return <Minus className="w-4 h-4 text-slate-500" />;
  };

  const metrics = [
    { label: 'Lead Time', a: `${leadA} days`, b: `${leadB} days`, cmpA: leadCmp[0], cmpB: leadCmp[1], note: 'Lower is better' },
    { label: 'Payment Terms', a: vendorA.paymentTerms || 'Net 30', b: vendorB.paymentTerms || 'Net 30', cmpA: payCmp[0], cmpB: payCmp[1], note: 'Longer is better' },
    { label: 'Avg Score', a: avgA !== null ? `${avgA}/100` : 'Not rated yet', b: avgB !== null ? `${avgB}/100` : 'Not rated yet', cmpA: scoreCmp[0], cmpB: scoreCmp[1], note: 'Higher is better' },
    { label: 'Open POs', a: String(openPOsA), b: String(openPOsB), cmpA: poCmp[0], cmpB: poCmp[1], note: 'Lower is better' },
  ];

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 bg-navy-800 border border-blue-900/40 rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="px-6 py-4 border-b border-blue-900/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scale className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-bold text-white">Vendor Comparison</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Vendor headers */}
        <div className="grid grid-cols-2 gap-4 px-6 py-3 border-b border-blue-900/20">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs ${categoryAvatarColors[vendorA.category] || 'bg-slate-500'}`}>
              {getInitials(vendorA.name)}
            </div>
            <div className="min-w-0">
              <p className="text-white font-semibold text-sm truncate">{vendorA.name}</p>
              <p className="text-xs text-slate-500">{vendorA.vendorCode}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs ${categoryAvatarColors[vendorB.category] || 'bg-slate-500'}`}>
              {getInitials(vendorB.name)}
            </div>
            <div className="min-w-0">
              <p className="text-white font-semibold text-sm truncate">{vendorB.name}</p>
              <p className="text-xs text-slate-500">{vendorB.vendorCode}</p>
            </div>
          </div>
        </div>

        {/* Metrics comparison */}
        <div className="px-6 py-4 space-y-3 max-h-[60vh] overflow-y-auto">
          {metrics.map((m) => (
            <div key={m.label}>
              <p className="text-xs text-slate-500 font-medium mb-1.5">{m.label} <span className="text-slate-600">({m.note})</span></p>
              <div className="grid grid-cols-2 gap-3">
                <div className={`rounded-lg border p-3 flex items-center justify-between ${cmpBg[m.cmpA]}`}>
                  <span className={`text-sm font-semibold ${cmpColor[m.cmpA]}`}>{m.a}</span>
                  <CmpIcon val={m.cmpA} />
                </div>
                <div className={`rounded-lg border p-3 flex items-center justify-between ${cmpBg[m.cmpB]}`}>
                  <span className={`text-sm font-semibold ${cmpColor[m.cmpB]}`}>{m.b}</span>
                  <CmpIcon val={m.cmpB} />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="px-6 py-4 border-t border-blue-900/40 flex justify-end">
          <button onClick={onClose} className="px-5 py-2.5 bg-navy-700 hover:bg-navy-600 text-slate-300 text-sm font-medium rounded-lg transition-colors border border-blue-900/40">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function VendorDetailPanel({
  vendor,
  onClose,
  onEdit,
  onDelete,
}: {
  vendor: Vendor;
  onClose: () => void;
  onEdit: (v: Vendor) => void;
  onDelete: (v: Vendor) => void;
}) {
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [ratings, setRatings] = useState<Awaited<ReturnType<typeof getVendorRatings>>>([]);

  useEffect(() => {
    getPurchaseOrders().then(setPos).catch(() => {});
    getVendorRatings().then(setRatings).catch(() => {});
  }, []);

  const vendorPOs = pos.filter((po) => po.vendorId === vendor.id);
  const totalPOCount = vendorPOs.length;

  const vendorRating = ratings.find((r) => r.vendorId === vendor.id);
  const avgRating = vendorRating
    ? Math.round((vendorRating.quality + vendorRating.delivery + vendorRating.cost + vendorRating.responsiveness) / 4)
    : null;

  const lastOrderDate = vendorPOs.length > 0
    ? vendorPOs.reduce((latest, po) => {
        const d = new Date(po.date);
        return d > latest ? d : latest;
      }, new Date(0))
    : null;

  return (
    <div className="fixed inset-0 z-[200]" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Panel */}
      <div
        className="absolute right-0 top-0 h-full w-[360px] bg-navy-800 border-l border-blue-900/40 shadow-2xl overflow-y-auto animate-slide-in"
        onClick={(e) => e.stopPropagation()}
        style={{
          animation: 'slideIn 0.3s ease-out forwards',
        }}
      >
        <style>{`
          @keyframes slideIn {
            from { transform: translateX(100%); }
            to { transform: translateX(0); }
          }
        `}</style>

        {/* Header */}
        <div className="sticky top-0 bg-navy-800 px-5 py-4 border-b border-blue-900/40 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white truncate pr-4">{vendor.name}</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-6">
          {/* Status & Category */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`px-3 py-1 rounded-full text-xs font-medium border ${categoryColors[vendor.category] || 'bg-slate-500/20 text-slate-400 border-slate-500/30'}`}>
              {vendor.category}
            </span>
            <span className={`px-3 py-1 rounded-full text-xs font-medium border ${statusColors[vendor.status]}`}>
              {vendor.status.charAt(0).toUpperCase() + vendor.status.slice(1)}
            </span>
          </div>

          {/* Vendor ID */}
          <div className="text-xs text-slate-500 font-mono">{vendor.vendorCode}</div>

          {/* Contact Info */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Contact Information</h3>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                <Building2 className="w-4 h-4 text-blue-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-slate-500">Contact Person</p>
                <p className="text-sm text-white truncate">{vendor.contact || '-'}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                <Mail className="w-4 h-4 text-blue-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-slate-500">Email</p>
                <p className="text-sm text-white truncate">{vendor.email || '-'}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                <Phone className="w-4 h-4 text-blue-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-slate-500">Phone</p>
                <p className="text-sm text-white truncate">{vendor.phone || '-'}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                <MapPin className="w-4 h-4 text-blue-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-slate-500">Location</p>
                <p className="text-sm text-white truncate">{vendor.location || '-'}</p>
              </div>
            </div>
          </div>

          {/* Vendor Details */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Vendor Details</h3>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                <Clock className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-slate-500">Lead Time</p>
                <p className="text-sm text-white">{vendor.leadTime || 7} days</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                <FileTextIcon className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-slate-500">Payment Terms</p>
                <p className="text-sm text-white">{vendor.paymentTerms || 'Net 30'}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                <Calendar className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-slate-500">Contract End</p>
                <p className="text-sm text-white">{vendor.contractEnd || '-'}</p>
              </div>
            </div>
          </div>

          {/* Notes */}
          {(vendor as Vendor & { notes?: string }).notes && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Notes</h3>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                  <StickyNote className="w-4 h-4 text-blue-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-white whitespace-pre-wrap">{(vendor as Vendor & { notes?: string }).notes}</p>
                </div>
              </div>
            </div>
          )}

          {/* Statistics */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Statistics</h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-navy-700/50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <FileTextIcon className="w-4 h-4 text-blue-400" />
                  <span className="text-xs text-slate-500">Total POs</span>
                </div>
                <p className="text-2xl font-bold text-white">
                  {totalPOCount === 0 ? 'No orders yet' : totalPOCount}
                </p>
              </div>

              <div className="bg-navy-700/50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Star className="w-4 h-4 text-yellow-400" />
                  <span className="text-xs text-slate-500">Avg Rating</span>
                </div>
                <p className="text-2xl font-bold text-white">
                  {avgRating !== null ? `${avgRating}/100` : 'Not rated yet'}
                </p>
              </div>
            </div>

            <div className="bg-navy-700/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-4 h-4 text-orange-400" />
                <span className="text-xs text-slate-500">Last Order</span>
              </div>
              <p className="text-sm text-white">
                {lastOrderDate ? lastOrderDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'No orders yet'}
              </p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 bg-navy-800 px-5 py-4 border-t border-blue-900/40 flex gap-3">
          <button
            onClick={() => onEdit(vendor)}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Edit2 className="w-4 h-4" />
            Edit
          </button>
          <button
            onClick={() => onDelete(vendor)}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-navy-700 hover:bg-red-600/20 text-slate-300 hover:text-red-400 text-sm font-medium rounded-lg transition-colors border border-blue-900/40"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
