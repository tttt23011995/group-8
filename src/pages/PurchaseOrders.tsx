import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { Search, Plus, Filter, Trash2, Eye, CreditCard as Edit2, X, FileText, ChevronDown, AlertTriangle, Printer, Truck, Copy, CheckSquare, Square, TrendingUp, DollarSign, Building2 } from 'lucide-react';
import {
  getPurchaseOrders,
  getVendors,
  PurchaseOrder,
  LineItem,
  generatePONumber,
  CATALOG_ITEMS,
  Vendor,
  upsertPurchaseOrder,
  deletePurchaseOrderById,
} from '../lib/data';
import { useRefresh } from '../lib/RefreshContext';

const statusColors: Record<string, string> = {
  ordered: 'bg-blue-500 text-white',
  confirmed: 'bg-purple-500 text-white',
  'in-transit': 'bg-amber-500 text-white',
  delivered: 'bg-emerald-500 text-white',
  invoiced: 'bg-gray-500 text-white',
};

const statusOptions: PurchaseOrder['status'][] = [
  'ordered',
  'confirmed',
  'in-transit',
  'delivered',
  'invoiced',
];

interface LineItemForm {
  id: string;
  name: string;
  quantity: string;
  unitPrice: string;
}

const emptyLineItem = (): LineItemForm => ({
  id: Math.random().toString(36).substring(2, 11),
  name: '',
  quantity: '',
  unitPrice: '',
});

interface POFormData {
  vendorId: string;
  deliveryDate: string;
  lineItems: LineItemForm[];
}

const emptyForm = (): POFormData => ({
  vendorId: '',
  deliveryDate: '',
  lineItems: [emptyLineItem()],
});

function calcLineTotal(item: LineItemForm): number {
  const qty = parseFloat(item.quantity) || 0;
  const price = parseFloat(item.unitPrice) || 0;
  return qty * price;
}

function calcSubtotal(items: LineItemForm[]): number {
  return items.reduce((sum, item) => sum + calcLineTotal(item), 0);
}

function calcTax(subtotal: number): number {
  return Math.round(subtotal * 0.1 * 100) / 100;
}

function calcGrandTotal(subtotal: number): number {
  return subtotal + calcTax(subtotal);
}

function lineItemsToString(items: LineItemForm[]): string {
  return items
    .filter((i) => i.name.trim())
    .map((i) => `${i.name} x${i.quantity || 0}`)
    .join(', ');
}

function lineItemsFromPO(po: PurchaseOrder): LineItemForm[] {
  if (po.lineItems && po.lineItems.length > 0) {
    return po.lineItems.map((li) => ({
      id: li.id,
      name: li.name,
      quantity: String(li.quantity),
      unitPrice: String(li.unitPrice),
    }));
  }
  return [emptyLineItem()];
}

function formatMoney(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function PurchaseOrders() {
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterVendor, setFilterVendor] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('date-desc');
  const [showForm, setShowForm] = useState(false);
  const [editingPO, setEditingPO] = useState<PurchaseOrder | null>(null);
  const [viewingPO, setViewingPO] = useState<PurchaseOrder | null>(null);
  const [deletingPO, setDeletingPO] = useState<PurchaseOrder | null>(null);
  const [form, setForm] = useState<POFormData>(emptyForm());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [autocompleteOpen, setAutocompleteOpen] = useState<string | null>(null);
  const [pendingPONumber, setPendingPONumber] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { refreshKey, triggerRefresh } = useRefresh();

  useEffect(() => {
    Promise.all([getPurchaseOrders(), getVendors()]).then(([p, v]) => {
      setPos(p);
      setVendors(v);
    }).catch(() => {});
  }, [refreshKey]);

  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const setInputRef = useCallback((id: string, field: string, el: HTMLInputElement | null) => {
    const key = `${id}-${field}`;
    if (el) inputRefs.current.set(key, el);
    else inputRefs.current.delete(key);
  }, []);

  function focusInput(id: string, field: string) {
    const key = `${id}-${field}`;
    const el = inputRefs.current.get(key);
    if (el) {
      el.focus();
      el.select();
    }
  }

  function handleLineItemKeyDown(
    e: React.KeyboardEvent<HTMLInputElement>,
    itemId: string,
    field: keyof LineItemForm,
    index: number
  ) {
    if (e.key !== 'Tab' || e.shiftKey) return;

    e.preventDefault();

    if (field === 'name') {
      focusInput(itemId, 'quantity');
    } else if (field === 'quantity') {
      focusInput(itemId, 'unitPrice');
    } else if (field === 'unitPrice') {
      const nextItem = form.lineItems[index + 1];
      if (nextItem) {
        focusInput(nextItem.id, 'name');
      } else {
        const addBtn = document.getElementById('add-line-item-btn');
        addBtn?.focus();
      }
    }
  }

  function validateForm(): boolean {
    const errors: Record<string, string> = {};
    let valid = true;

    if (!form.vendorId) {
      errors.vendor = 'Vendor is required';
      valid = false;
    }

    const today = new Date().toISOString().split('T')[0];
    if (!form.deliveryDate) {
      errors.deliveryDate = 'Delivery date is required';
      valid = false;
    } else if (form.deliveryDate < today) {
      errors.deliveryDate = 'Delivery date must be today or in the future';
      valid = false;
    }

    const namedItems = form.lineItems.filter((i) => i.name.trim());
    if (namedItems.length === 0) {
      errors.lineItems = 'At least one line item with a name is required';
      valid = false;
    }

    form.lineItems.forEach((item) => {
      if (!item.name.trim()) {
        errors[`${item.id}-name`] = 'Item name is required';
        valid = false;
      }
      const qty = parseInt(item.quantity, 10);
      if (!item.quantity || isNaN(qty) || qty < 1) {
        errors[`${item.id}-qty`] = 'Min 1';
        valid = false;
      }
      const price = parseFloat(item.unitPrice);
      if (!item.unitPrice || isNaN(price) || price <= 0) {
        errors[`${item.id}-price`] = 'Required';
        valid = false;
      }
    });

    setValidationErrors(errors);
    return valid;
  }

  const filtered = useMemo(() => {
    let result = pos.filter((po) => {
      const matchSearch =
        po.poNumber.toLowerCase().includes(search.toLowerCase()) ||
        po.vendorName.toLowerCase().includes(search.toLowerCase());
      const matchStatus = filterStatus === 'all' || po.status === filterStatus;
      const matchVendor = filterVendor === 'all' || po.vendorId === filterVendor;
      return matchSearch && matchStatus && matchVendor;
    });

    if (sortBy === 'date-desc') {
      result = [...result].sort((a, b) => b.date.localeCompare(a.date));
    } else if (sortBy === 'date-asc') {
      result = [...result].sort((a, b) => a.date.localeCompare(b.date));
    } else if (sortBy === 'total-desc') {
      result = [...result].sort((a, b) => b.total - a.total);
    } else if (sortBy === 'status') {
      const order = ['ordered', 'confirmed', 'in-transit', 'delivered', 'invoiced'];
      result = [...result].sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));
    }

    return result;
  }, [pos, search, filterStatus, filterVendor, sortBy]);

  useEffect(() => {
    if (editingPO) {
      setForm({
        vendorId: editingPO.vendorId,
        deliveryDate: editingPO.deliveryDate,
        lineItems: lineItemsFromPO(editingPO),
      });
      setShowForm(true);
    }
  }, [editingPO]);

  function closeForm() {
    setShowForm(false);
    setEditingPO(null);
    setForm(emptyForm());
    setValidationErrors({});
    setPendingPONumber('');
  }

  function addLineItem() {
    setForm({ ...form, lineItems: [...form.lineItems, emptyLineItem()] });
  }

  function removeLineItem(id: string) {
    if (form.lineItems.length <= 1) return;
    setForm({ ...form, lineItems: form.lineItems.filter((i) => i.id !== id) });
    setValidationErrors((prev) => {
      const next = { ...prev };
      delete next[`${id}-name`];
      delete next[`${id}-qty`];
      delete next[`${id}-price`];
      return next;
    });
  }

  function clearError(key: string) {
    setValidationErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function updateLineItem(id: string, field: keyof LineItemForm, value: string) {
    setForm({
      ...form,
      lineItems: form.lineItems.map((i) => (i.id === id ? { ...i, [field]: value } : i)),
    });

    if (field === 'name' && value.trim()) {
      clearError(`${id}-name`);
      setValidationErrors((prev) => {
        const namedCount = form.lineItems.filter(
          (i) => i.id !== id ? i.name.trim() : value.trim()
        ).length;
        if (namedCount > 0 && 'lineItems' in prev) {
          const next = { ...prev };
          delete next.lineItems;
          return next;
        }
        return prev;
      });
    }
    if (field === 'quantity') {
      const qty = parseInt(value, 10);
      if (!isNaN(qty) && qty >= 1) clearError(`${id}-qty`);
    }
    if (field === 'unitPrice') {
      const price = parseFloat(value);
      if (!isNaN(price) && price > 0) clearError(`${id}-price`);
    }
  }

  async function handleSave() {
    if (!validateForm()) return;

    const validItems = form.lineItems.filter(
      (i) => i.name.trim() && parseInt(i.quantity, 10) >= 1 && parseFloat(i.unitPrice) > 0
    );

    const vendor = vendors.find((v) => v.id === form.vendorId);
    if (!vendor) return;

    const subtotal = calcSubtotal(validItems);
    const tax = calcTax(subtotal);
    const grandTotal = calcGrandTotal(subtotal);

    const lineItems: LineItem[] = validItems.map((i) => ({
      id: i.id,
      name: i.name.trim(),
      quantity: parseInt(i.quantity, 10),
      unitPrice: parseFloat(i.unitPrice),
      lineTotal: calcLineTotal(i),
    }));

    setIsSaving(true);
    try {
      if (editingPO) {
        const updatedPO: PurchaseOrder = {
          ...editingPO,
          vendorId: form.vendorId,
          vendorName: vendor.name,
          deliveryDate: form.deliveryDate,
          items: lineItemsToString(validItems),
          lineItems,
          subtotal,
          tax,
          total: grandTotal,
        };
        setPos((prev) => prev.map((po) => po.id === editingPO.id ? updatedPO : po));
        await upsertPurchaseOrder(updatedPO);
      } else {
        const poNumber = pendingPONumber || await generatePONumber();
        const newPO: PurchaseOrder = {
          id: Math.random().toString(36).substring(2, 11),
          poNumber,
          vendorId: form.vendorId,
          vendorName: vendor.name,
          date: new Date().toISOString().slice(0, 10),
          total: grandTotal,
          status: 'ordered',
          items: lineItemsToString(validItems),
          deliveryDate: form.deliveryDate,
          lineItems,
          subtotal,
          tax,
        };
        setPos((prev) => [...prev, newPO]);
        await upsertPurchaseOrder(newPO);
      }
      triggerRefresh();
    } finally {
      setIsSaving(false);
    }

    closeForm();
  }

  async function confirmDelete() {
    if (!deletingPO) return;
    const id = deletingPO.id;
    setPos((prev) => prev.filter((p) => p.id !== id));
    setDeletingPO(null);
    await deletePurchaseOrderById(id);
    triggerRefresh();
  }

  const subtotal = calcSubtotal(form.lineItems);
  const tax = calcTax(subtotal);
  const grandTotal = calcGrandTotal(subtotal);

  const totalValue = filtered.reduce((sum, po) => sum + po.total, 0);

  // Stats calculations
  const stats = useMemo(() => {
    // Most ordered vendor (by PO count and total value)
    const vendorStats: Record<string, { count: number; total: number; name: string }> = {};
    pos.forEach((po) => {
      if (!vendorStats[po.vendorId]) {
        vendorStats[po.vendorId] = { count: 0, total: 0, name: po.vendorName };
      }
      vendorStats[po.vendorId].count++;
      vendorStats[po.vendorId].total += po.total;
    });
    const mostOrderedVendor = Object.values(vendorStats).sort((a, b) => b.count - a.count || b.total - a.total)[0];

    // Average PO value
    const avgPOValue = pos.length > 0 ? pos.reduce((sum, po) => sum + po.total, 0) / pos.length : 0;

    // This month's total spend
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonthSpend = pos
      .filter((po) => new Date(po.date) >= thisMonthStart)
      .reduce((sum, po) => sum + po.total, 0);

    return {
      mostOrderedVendor: mostOrderedVendor ? { name: mostOrderedVendor.name, count: mostOrderedVendor.count } : null,
      avgPOValue,
      thisMonthSpend,
    };
  }, [pos]);

  async function handleDuplicatePO(po: PurchaseOrder) {
    const poNumber = await generatePONumber();
    const newPO: PurchaseOrder = {
      id: Math.random().toString(36).substring(2, 11),
      poNumber,
      vendorId: po.vendorId,
      vendorName: po.vendorName,
      date: new Date().toISOString().slice(0, 10),
      total: po.total,
      status: 'ordered',
      items: po.items,
      deliveryDate: po.deliveryDate,
      lineItems: po.lineItems?.map((li) => ({
        ...li,
        id: Math.random().toString(36).substring(2, 11),
      })),
      subtotal: po.subtotal,
      tax: po.tax,
    };
    setPos((prev) => [...prev, newPO]);
    await upsertPurchaseOrder(newPO);
    triggerRefresh();
  }

  function toggleSelectAll() {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((po) => po.id)));
    }
  }

  function toggleSelect(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  }

  async function confirmBulkDelete() {
    const ids = [...selectedIds];
    setPos((prev) => prev.filter((p) => !selectedIds.has(p.id)));
    setSelectedIds(new Set());
    setShowBulkDeleteConfirm(false);
    await Promise.all(ids.map((id) => deletePurchaseOrderById(id)));
    triggerRefresh();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold theme-title flex items-center gap-2">
            <FileText className="w-7 h-7 text-blue-400" />
            Purchase Orders
          </h1>
        </div>
        <button
          onClick={() => {
            setEditingPO(null);
            setForm(emptyForm());
            generatePONumber().then(setPendingPONumber).catch(() => {});
            setShowForm(true);
          }}
          className="relative z-2 flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition-colors shadow-lg shadow-blue-900/20"
        >
          <Plus className="w-4 h-4" />
          New PO
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 theme-muted" />
            <input
              type="text"
              placeholder="Search POs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-surface border border-themed rounded-lg theme-text placeholder-muted text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 relative z-2"
            />
          </div>

          {/* Status filter */}
          <div className="relative flex items-center gap-2">
            <Filter className="w-4 h-4 theme-muted flex-shrink-0" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="theme-select border border-themed rounded-lg px-3 py-2 theme-text text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 appearance-none relative z-2 pr-8"
            >
              <option value="all">All Statuses</option>
              <option value="ordered">Ordered</option>
              <option value="confirmed">Confirmed</option>
              <option value="in-transit">In Transit</option>
              <option value="delivered">Delivered</option>
              <option value="invoiced">Invoiced</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 theme-muted pointer-events-none" />
          </div>

          {/* Vendor filter */}
          <div className="relative flex items-center">
            <select
              value={filterVendor}
              onChange={(e) => setFilterVendor(e.target.value)}
              className="theme-select border border-themed rounded-lg px-3 py-2 theme-text text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 appearance-none relative z-2 pr-8"
            >
              <option value="all">All Vendors</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 theme-muted pointer-events-none" />
          </div>

          {/* Sort */}
          <div className="relative flex items-center">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="theme-select border border-themed rounded-lg px-3 py-2 theme-text text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 appearance-none relative z-2 pr-8"
            >
              <option value="date-desc">Date: Newest</option>
              <option value="date-asc">Date: Oldest</option>
              <option value="total-desc">Total: High-Low</option>
              <option value="status">Status</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 theme-muted pointer-events-none" />
          </div>
        </div>

        {/* Summary stat bar */}
        <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-surface border border-themed rounded-lg">
          <div className="flex items-center gap-2">
            <span className="text-sm theme-muted">
              Showing <span className="theme-title font-semibold">{filtered.length}</span> PO{filtered.length !== 1 ? 's' : ''}
            </span>
            <span className="theme-muted">|</span>
            <span className="text-sm theme-muted">
              Total Value: <span className="theme-title font-semibold">${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </span>
          </div>
          {selectedIds.size > 0 && (
            <button
              onClick={() => setShowBulkDeleteConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete Selected ({selectedIds.size})
            </button>
          )}
        </div>
      </div>

      {/* ── CREATE / EDIT FORM ────────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 z-[200] flex items-start justify-center p-4 pt-[5vh]">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeForm} />
          <div className="relative z-10 theme-modal rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl">
            {/* Modal header */}
            <div className="sticky top-0 theme-modal px-6 py-4 border-b border-themed flex items-center justify-between z-20">
              <h2 className="text-lg font-bold theme-title">
                {editingPO ? `Edit Purchase Order (Editing ${editingPO.poNumber})` : 'Create New Purchase Order'}
              </h2>
              <button
                onClick={closeForm}
                className="p-2 rounded-lg hover:bg-white/5 theme-muted hover:theme-title transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Vendor & Date row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm theme-muted mb-1.5">
                    Vendor <span className="text-danger">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={form.vendorId}
                      onChange={(e) => {
                        setForm({ ...form, vendorId: e.target.value });
                        if (e.target.value) clearError('vendor');
                      }}
                      className={`w-full theme-select border rounded-lg px-4 py-2.5 theme-text text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 appearance-none relative z-2 pr-10 ${validationErrors.vendor ? 'border-red-500' : 'border-themed'}`}
                    >
                      <option value="">Select vendor...</option>
                      {vendors.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 theme-muted pointer-events-none" />
                  </div>
                  {validationErrors.vendor && <p className="text-danger text-xs mt-1">{validationErrors.vendor}</p>}
                </div>
                <div>
                  <label className="block text-sm theme-muted mb-1.5">
                    Expected Delivery Date <span className="text-danger">*</span>
                  </label>
                  <input
                    type="date"
                    value={form.deliveryDate}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={(e) => {
                      setForm({ ...form, deliveryDate: e.target.value });
                      const today = new Date().toISOString().split('T')[0];
                      if (e.target.value && e.target.value >= today) clearError('deliveryDate');
                    }}
                    className={`w-full px-4 py-2.5 theme-input border rounded-lg theme-text text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 relative z-2 ${validationErrors.deliveryDate ? 'border-red-500' : 'border-themed'}`}
                  />
                  {validationErrors.deliveryDate && <p className="text-danger text-xs mt-1">{validationErrors.deliveryDate}</p>}
                </div>
              </div>

              {/* PO Number (read-only, auto-generated) */}
              <div>
                <label className="block text-sm theme-muted mb-1.5">PO Number</label>
                <div className="px-4 py-2.5 bg-surface-strong border border-themed rounded-lg text-accent font-mono text-sm select-all">
                  {editingPO ? editingPO.poNumber : pendingPONumber || '—'}
                </div>
              </div>

              {/* Line Items Table */}
              <div>
                <h3 className="text-sm font-semibold theme-title mb-3">Line Items</h3>
                {validationErrors.lineItems && (
                  <p className="text-danger text-xs mb-2">{validationErrors.lineItems}</p>
                )}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-themed">
                        <th className="px-3 py-2 text-left theme-muted font-medium">Item Name</th>
                        <th className="px-3 py-2 text-right theme-muted font-medium w-24">Quantity</th>
                        <th className="px-3 py-2 text-right theme-muted font-medium w-32">Unit Price</th>
                        <th className="px-3 py-2 text-right theme-muted font-medium w-28">Line Total</th>
                        <th className="px-3 py-2 w-12" />
                      </tr>
                    </thead>
                    <tbody>
                      {form.lineItems.map((item, index) => {
                        const nameErr = validationErrors[`${item.id}-name`];
                        const qtyErr = validationErrors[`${item.id}-qty`];
                        const priceErr = validationErrors[`${item.id}-price`];
                        return (
                          <tr key={item.id} className="border-b border-themed/50">
                            <td className="px-3 py-2 relative">
                              <input
                                ref={(el) => setInputRef(item.id, 'name', el)}
                                type="text"
                                value={item.name}
                                onChange={(e) => {
                                  updateLineItem(item.id, 'name', e.target.value);
                                  setAutocompleteOpen(e.target.value.trim() ? item.id : null);
                                }}
                                onFocus={() => {
                                  if (item.name.trim()) setAutocompleteOpen(item.id);
                                }}
                                onBlur={() => {
                                  blurTimerRef.current = setTimeout(() => setAutocompleteOpen(null), 150);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && autocompleteOpen === item.id) {
                                    const query = item.name.trim().toLowerCase();
                                    const match = CATALOG_ITEMS.find((c) => c.name.toLowerCase() === query);
                                    if (match) {
                                      updateLineItem(item.id, 'unitPrice', String(match.unitPrice));
                                    }
                                    setAutocompleteOpen(null);
                                    e.preventDefault();
                                    focusInput(item.id, 'quantity');
                                    return;
                                  }
                                  handleLineItemKeyDown(e, item.id, 'name', index);
                                }}
                                placeholder="Item name"
                                className={`w-full px-2 py-1.5 theme-input border rounded theme-text text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 relative z-2 ${nameErr ? 'border-red-500' : 'border-themed'}`}
                              />
                              {nameErr && <p className="text-danger text-[10px] mt-0.5">{nameErr}</p>}
                              {autocompleteOpen === item.id && (() => {
                                const query = item.name.trim().toLowerCase();
                                if (!query) return null;
                                const matches = CATALOG_ITEMS
                                  .filter((c) => c.name.toLowerCase().includes(query))
                                  .slice(0, 6);
                                if (matches.length === 0) return null;
                                return (
                                  <div className="absolute left-3 top-full mt-1 w-56 theme-card border border-themed rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto">
                                    {matches.map((c) => (
                                      <button
                                        key={c.name}
                                        onMouseDown={(e) => {
                                          e.preventDefault();
                                          if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
                                          setForm({
                                            ...form,
                                            lineItems: form.lineItems.map((li) =>
                                              li.id === item.id
                                                ? { ...li, name: c.name, unitPrice: String(c.unitPrice) }
                                                : li
                                            ),
                                          });
                                          setAutocompleteOpen(null);
                                          focusInput(item.id, 'quantity');
                                        }}
                                        className="w-full text-left px-3 py-2 text-sm theme-muted hover:bg-white/5 cursor-pointer"
                                      >
                                        {c.name}
                                      </button>
                                    ))}
                                  </div>
                                );
                              })()}
                            </td>
                            <td className="px-3 py-2">
                              <input
                                ref={(el) => setInputRef(item.id, 'quantity', el)}
                                type="number"
                                value={item.quantity}
                                onChange={(e) => updateLineItem(item.id, 'quantity', e.target.value)}
                                onKeyDown={(e) => handleLineItemKeyDown(e, item.id, 'quantity', index)}
                                placeholder="1"
                                min="1"
                                className={`w-full px-2 py-1.5 theme-input border rounded theme-text text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500/40 relative z-2 ${qtyErr ? 'border-red-500' : 'border-themed'}`}
                              />
                              {qtyErr && <p className="text-danger text-[10px] mt-0.5">{qtyErr}</p>}
                            </td>
                            <td className="px-3 py-2">
                              <input
                                ref={(el) => setInputRef(item.id, 'unitPrice', el)}
                                type="number"
                                value={item.unitPrice}
                                onChange={(e) => updateLineItem(item.id, 'unitPrice', e.target.value)}
                                onKeyDown={(e) => handleLineItemKeyDown(e, item.id, 'unitPrice', index)}
                                placeholder="0.00"
                                min="0"
                                step="0.01"
                                className={`w-full px-2 py-1.5 theme-input border rounded theme-text text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500/40 relative z-2 ${priceErr ? 'border-red-500' : 'border-themed'}`}
                              />
                              {priceErr && <p className="text-danger text-[10px] mt-0.5">{priceErr}</p>}
                            </td>
                            <td className="px-3 py-2 text-right theme-muted font-medium whitespace-nowrap">
                              ${formatMoney(calcLineTotal(item))}
                            </td>
                            <td className="px-3 py-2 text-center">
                              <button
                                onClick={() => removeLineItem(item.id)}
                                disabled={form.lineItems.length <= 1}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                title="Remove item"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <button
                    id="add-line-item-btn"
                    onClick={addLineItem}
                    className="flex items-center gap-1.5 px-3 py-2 bg-surface-strong hover:bg-surface theme-muted text-sm font-medium rounded-lg transition-colors border border-themed border-dashed"
                  >
                    <Plus className="w-4 h-4" />
                    Add Item
                  </button>
                  <span className="text-xs theme-muted">
                    Total Items: {form.lineItems.filter((i) => i.name.trim()).length}
                  </span>
                </div>
              </div>

              {/* Totals */}
              <div className="bg-surface-strong border border-themed rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="theme-muted">Subtotal</span>
                  <span className="theme-title font-medium">${formatMoney(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="theme-muted">Tax (10%)</span>
                  <span className="theme-title font-medium">${formatMoney(tax)}</span>
                </div>
                <div className="flex justify-between text-base border-t border-themed pt-2">
                  <span className="theme-title font-semibold">Grand Total</span>
                  <span className="text-accent font-bold">${formatMoney(grandTotal)}</span>
                </div>
              </div>
            </div>

            {/* Modal footer */}
            <div className="sticky bottom-0 theme-modal px-6 py-4 border-t border-themed flex justify-end gap-3 z-20">
              <button
                onClick={closeForm}
                className="px-5 py-2.5 bg-surface-strong hover:bg-surface theme-muted text-sm font-medium rounded-lg transition-colors border border-themed"
              >
                {editingPO ? 'Cancel Edit' : 'Cancel'}
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving || !form.vendorId || form.lineItems.length === 0 || form.lineItems.every((i) => !i.name.trim())}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 theme-title text-sm font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isSaving ? 'Saving...' : editingPO ? 'Save Changes' : 'Save Purchase Order'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── VIEW / PRINT PO MODAL ──────────────────────────────── */}
      {viewingPO && (
        <div className="print-modal-wrapper fixed inset-0 z-[200] flex items-start justify-center p-4 pt-[5vh]">
          <div className="print-modal-backdrop absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setViewingPO(null)} />

          <div className="relative z-10 w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl print-modal">
            {/* Action bar — hidden during print */}
            <div className="print-actions sticky top-0 theme-modal border-b border-themed px-6 py-3 flex items-center justify-between z-20">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    document.body.setAttribute('data-printing', 'po');
                    window.addEventListener('afterprint', () => {
                      document.body.removeAttribute('data-printing');
                    }, { once: true });
                    window.print();
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 theme-title text-sm font-medium rounded-lg transition-colors"
                >
                  <Printer className="w-4 h-4" />
                  Print
                </button>
                <button
                  onClick={() => {
                    const po = viewingPO;
                    setViewingPO(null);
                    setEditingPO(po);
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 bg-surface-strong hover:bg-surface theme-muted text-sm font-medium rounded-lg transition-colors border border-themed"
                >
                  <Edit2 className="w-4 h-4" />
                  Edit
                </button>
              </div>
              <button
                onClick={() => setViewingPO(null)}
                className="p-2 rounded-lg hover:bg-white/5 theme-muted hover:theme-title transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Printable PO document */}
            <div className="po-document bg-white text-gray-900 p-8 sm:p-10">
              {/* Company header */}
              <div className="flex items-center justify-between border-b-2 border-blue-600 pb-4 mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                    <Truck className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-gray-900">ProcureAI Procurement</h1>
                    <p className="text-xs text-gray-500">Purchase Order Document</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-blue-600 tracking-tight">{viewingPO.poNumber}</p>
                  <p className="text-xs text-gray-500">Status: {viewingPO.status === 'in-transit' ? 'In Transit' : viewingPO.status.charAt(0).toUpperCase() + viewingPO.status.slice(1)}</p>
                </div>
              </div>

              {/* PO info + Vendor block */}
              <div className="grid grid-cols-2 gap-6 mb-8">
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Order Information</h3>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">PO Number</span>
                      <span className="font-mono font-semibold text-gray-900">{viewingPO.poNumber}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Date Created</span>
                      <span className="text-gray-900">{viewingPO.date}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Delivery Date</span>
                      <span className="text-gray-900">{viewingPO.deliveryDate}</span>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Vendor</h3>
                  <div className="space-y-1.5">
                    <p className="text-sm font-semibold text-gray-900">{viewingPO.vendorName}</p>
                    <p className="text-sm text-gray-500">{viewingPO.items}</p>
                  </div>
                </div>
              </div>

              {/* Line items table */}
              {viewingPO.lineItems && viewingPO.lineItems.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Line Items</h3>
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-blue-600 text-white">
                        <th className="px-4 py-2.5 text-left font-semibold text-xs uppercase tracking-wider rounded-tl-md">Item</th>
                        <th className="px-4 py-2.5 text-right font-semibold text-xs uppercase tracking-wider">Qty</th>
                        <th className="px-4 py-2.5 text-right font-semibold text-xs uppercase tracking-wider">Unit Price</th>
                        <th className="px-4 py-2.5 text-right font-semibold text-xs uppercase tracking-wider rounded-tr-md">Line Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewingPO.lineItems.map((li, idx) => (
                        <tr key={li.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-4 py-2.5 text-gray-800 border-b border-gray-100">{li.name}</td>
                          <td className="px-4 py-2.5 text-right text-gray-800 border-b border-gray-100">{li.quantity}</td>
                          <td className="px-4 py-2.5 text-right text-gray-600 border-b border-gray-100">
                            ${li.unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-2.5 text-right font-medium text-gray-900 border-b border-gray-100">
                            ${li.lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Totals section */}
              <div className="flex justify-end mb-8">
                <div className="w-72 bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
                  <div className="px-4 py-2.5 flex justify-between text-sm border-b border-gray-200">
                    <span className="text-gray-500">Subtotal</span>
                    <span className="text-gray-900 font-medium">
                      ${(viewingPO.subtotal ?? viewingPO.total / 1.1).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="px-4 py-2.5 flex justify-between text-sm border-b border-gray-200">
                    <span className="text-gray-500">Tax (10%)</span>
                    <span className="text-gray-900 font-medium">
                      ${(viewingPO.tax ?? viewingPO.total / 11).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="px-4 py-3 flex justify-between bg-blue-600 text-white">
                    <span className="font-bold">Grand Total</span>
                    <span className="font-bold text-lg">
                      ${viewingPO.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="border-t-2 border-gray-200 pt-4">
                <p className="text-xs text-gray-400 leading-relaxed">
                  Terms: Net 30. This PO is system-generated.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRMATION ────────────────────────────────── */}
      {deletingPO && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDeletingPO(null)} />
          <div className="relative z-10 theme-modal rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-6">
              <div className="flex items-center justify-center w-14 h-14 mx-auto mb-4 rounded-full bg-danger-light">
                <AlertTriangle className="w-7 h-7 text-danger" />
              </div>
              <h2 className="text-lg font-bold theme-title text-center mb-2">Delete Purchase Order</h2>
              <p className="theme-muted text-sm text-center mb-4">
                Are you sure you want to delete{' '}
                <span className="theme-title font-medium">{deletingPO.poNumber}</span>?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeletingPO(null)}
                  className="flex-1 px-4 py-2.5 bg-surface-strong hover:bg-surface theme-muted text-sm font-medium rounded-lg transition-colors border border-themed"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-500 theme-title text-sm font-medium rounded-lg transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── BULK DELETE CONFIRMATION ────────────────────────────────── */}
      {showBulkDeleteConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowBulkDeleteConfirm(false)} />
          <div className="relative z-10 theme-modal rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-6">
              <div className="flex items-center justify-center w-14 h-14 mx-auto mb-4 rounded-full bg-danger-light">
                <AlertTriangle className="w-7 h-7 text-danger" />
              </div>
              <h2 className="text-lg font-bold theme-title text-center mb-2">Delete Selected POs</h2>
              <p className="theme-muted text-sm text-center mb-4">
                Are you sure you want to delete{' '}
                <span className="theme-title font-medium">{selectedIds.size}</span> purchase order{selectedIds.size !== 1 ? 's' : ''}?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowBulkDeleteConfirm(false)}
                  className="flex-1 px-4 py-2.5 bg-surface-strong hover:bg-surface theme-muted text-sm font-medium rounded-lg transition-colors border border-themed"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmBulkDelete}
                  className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-500 theme-title text-sm font-medium rounded-lg transition-colors"
                >
                  Delete All
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── LIST SECTION ──────────────────────────────────────── */}
      <div className="relative z-1 theme-card rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-themed bg-surface-strong">
                <th className="px-4 py-3 text-left theme-muted font-medium w-12">
                  <button
                    onClick={toggleSelectAll}
                    className="p-1 rounded hover:bg-white/5 transition-colors"
                    title={selectedIds.size === filtered.length ? 'Deselect all' : 'Select all'}
                  >
                    {selectedIds.size === filtered.length && filtered.length > 0 ? (
                      <CheckSquare className="w-4 h-4 text-blue-400" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-500" />
                    )}
                  </button>
                </th>
                <th className="px-4 py-3 text-left theme-muted font-medium">PO Number</th>
                <th className="px-4 py-3 text-left theme-muted font-medium">Vendor</th>
                <th className="px-4 py-3 text-left theme-muted font-medium hidden md:table-cell">Date Created</th>
                <th className="px-4 py-3 text-left theme-muted font-medium hidden lg:table-cell">Items</th>
                <th className="px-4 py-3 text-right theme-muted font-medium">Total</th>
                <th className="px-4 py-3 text-left theme-muted font-medium">Status</th>
                <th className="px-4 py-3 text-left theme-muted font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((po) => (
                <tr key={po.id} className={`border-b border-themed/50 hover:bg-white/[0.02] ${selectedIds.has(po.id) ? 'bg-blue-500/5' : ''}`}>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleSelect(po.id)}
                      className="p-1 rounded hover:bg-white/5 transition-colors"
                    >
                      {selectedIds.has(po.id) ? (
                        <CheckSquare className="w-4 h-4 text-blue-400" />
                      ) : (
                        <Square className="w-4 h-4 theme-muted" />
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3 theme-title font-mono text-xs">{po.poNumber}</td>
                  <td className="px-4 py-3 theme-muted">{po.vendorName}</td>
                  <td className="px-4 py-3 theme-muted hidden md:table-cell">{po.date}</td>
                  <td className="px-4 py-3 theme-muted text-xs hidden lg:table-cell max-w-xs truncate">
                    {po.items}
                  </td>
                  <td className="px-4 py-3 text-right theme-muted">
                    ${po.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[po.status] || 'bg-slate-500 text-white'}`}
                    >
                      {po.status === 'in-transit' ? 'In Transit' : po.status.charAt(0).toUpperCase() + po.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setViewingPO(po)}
                        className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-blue-400 transition-colors"
                        title="View"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setViewingPO(null);
                          setEditingPO(po);
                        }}
                        className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-emerald-400 transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDuplicatePO(po)}
                        className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-violet-400 transition-colors"
                        title="Duplicate PO"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeletingPO(po)}
                        className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-red-400 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center theme-muted">
                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>No purchase orders found</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── STATS CARD ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="relative z-1 theme-card rounded-xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
            <Building2 className="w-6 h-6 text-blue-400" />
          </div>
          <div className="min-w-0">
            <p className="text-xs theme-muted uppercase tracking-wider mb-0.5">Most Ordered Vendor</p>
            <p className="text-lg font-bold theme-title truncate">
              {stats.mostOrderedVendor ? stats.mostOrderedVendor.name : 'N/A'}
            </p>
            {stats.mostOrderedVendor && (
              <p className="text-xs theme-muted">{stats.mostOrderedVendor.count} POs</p>
            )}
          </div>
        </div>
        <div className="relative z-1 theme-card rounded-xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
            <DollarSign className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <p className="text-xs theme-muted uppercase tracking-wider mb-0.5">Average PO Value</p>
            <p className="text-lg font-bold theme-title">
              ${stats.avgPOValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>
        <div className="relative z-1 theme-card rounded-xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center flex-shrink-0">
            <TrendingUp className="w-6 h-6 text-orange-400" />
          </div>
          <div>
            <p className="text-xs theme-muted uppercase tracking-wider mb-0.5">This Month Spend</p>
            <p className="text-lg font-bold theme-title">
              ${stats.thisMonthSpend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
