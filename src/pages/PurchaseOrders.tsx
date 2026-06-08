import { useMemo, useState } from 'react';
import { Search, Plus, Filter } from 'lucide-react';
import { getPurchaseOrders, savePurchaseOrders, PurchaseOrder } from '../lib/data';

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  approved: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  shipped: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  delivered: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  overdue: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const statusOptions: PurchaseOrder['status'][] = ['pending', 'approved', 'shipped', 'delivered', 'overdue'];

export default function PurchaseOrders() {
  const [pos, setPos] = useState<PurchaseOrder[]>(() => getPurchaseOrders());
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ vendorName: '', items: '', total: '', deliveryDate: '' });

  const filtered = useMemo(() => {
    return pos.filter((po) => {
      const matchSearch =
        po.poNumber.toLowerCase().includes(search.toLowerCase()) ||
        po.vendorName.toLowerCase().includes(search.toLowerCase());
      const matchStatus = filterStatus === 'all' || po.status === filterStatus;
      return matchSearch && matchStatus;
    });
  }, [pos, search, filterStatus]);

  function handleAdd() {
    if (!form.vendorName || !form.total) return;
    const count = pos.length + 1;
    const newPO: PurchaseOrder = {
      id: Math.random().toString(36).substring(2, 11),
      poNumber: `PO-2026-${String(count).padStart(4, '0')}`,
      vendorId: '',
      vendorName: form.vendorName,
      date: new Date().toISOString().slice(0, 10),
      total: parseFloat(form.total) || 0,
      status: 'pending',
      items: form.items,
      deliveryDate: form.deliveryDate || '2026-07-01',
    };
    const updated = [...pos, newPO];
    setPos(updated);
    savePurchaseOrders(updated);
    setForm({ vendorName: '', items: '', total: '', deliveryDate: '' });
    setShowAdd(false);
  }

  function updateStatus(id: string, status: PurchaseOrder['status']) {
    const updated = pos.map((po) => (po.id === id ? { ...po, status } : po));
    setPos(updated);
    savePurchaseOrders(updated);
  }

  const totalValue = filtered.reduce((sum, po) => sum + po.total, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Purchase Orders</h1>
          <p className="text-slate-400 text-sm mt-1">
            {filtered.length} orders | Total value: ${totalValue.toLocaleString()}
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="relative z-2 flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          New PO
        </button>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search POs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-navy-700 border border-blue-900/40 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 relative z-2"
          />
        </div>
        <div className="relative flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-500" />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-navy-700 border border-blue-900/40 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 relative z-2"
          >
            <option value="all">All Statuses</option>
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {showAdd && (
        <div className="relative z-1 bg-navy-800 border border-blue-900/40 rounded-xl p-6">
          <h3 className="text-white font-semibold mb-4">Create New Purchase Order</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Vendor Name</label>
              <input
                type="text"
                value={form.vendorName}
                onChange={(e) => setForm({ ...form, vendorName: e.target.value })}
                className="w-full px-3 py-2 bg-navy-700 border border-blue-900/40 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 relative z-2"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Total ($)</label>
              <input
                type="number"
                value={form.total}
                onChange={(e) => setForm({ ...form, total: e.target.value })}
                className="w-full px-3 py-2 bg-navy-700 border border-blue-900/40 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 relative z-2"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-slate-400 mb-1">Items</label>
              <input
                type="text"
                value={form.items}
                onChange={(e) => setForm({ ...form, items: e.target.value })}
                className="w-full px-3 py-2 bg-navy-700 border border-blue-900/40 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 relative z-2"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Delivery Date</label>
              <input
                type="date"
                value={form.deliveryDate}
                onChange={(e) => setForm({ ...form, deliveryDate: e.target.value })}
                className="w-full px-3 py-2 bg-navy-700 border border-blue-900/40 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 relative z-2"
              />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={handleAdd} className="relative z-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors">
              Create PO
            </button>
            <button onClick={() => setShowAdd(false)} className="relative z-2 px-4 py-2 bg-navy-700 hover:bg-navy-600 text-slate-300 text-sm font-medium rounded-lg transition-colors border border-blue-900/40">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="relative z-1 bg-navy-800 border border-blue-900/40 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-blue-900/40 bg-navy-700/50">
                <th className="px-4 py-3 text-left text-slate-400 font-medium">PO Number</th>
                <th className="px-4 py-3 text-left text-slate-400 font-medium">Vendor</th>
                <th className="px-4 py-3 text-left text-slate-400 font-medium hidden md:table-cell">Items</th>
                <th className="px-4 py-3 text-left text-slate-400 font-medium hidden sm:table-cell">Date</th>
                <th className="px-4 py-3 text-left text-slate-400 font-medium hidden sm:table-cell">Delivery</th>
                <th className="px-4 py-3 text-right text-slate-400 font-medium">Total</th>
                <th className="px-4 py-3 text-left text-slate-400 font-medium">Status</th>
                <th className="px-4 py-3 text-left text-slate-400 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((po) => (
                <tr key={po.id} className="border-b border-blue-900/20 hover:bg-white/[0.02]">
                  <td className="px-4 py-3 text-white font-mono text-xs">{po.poNumber}</td>
                  <td className="px-4 py-3 text-slate-300">{po.vendorName}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs hidden md:table-cell max-w-xs truncate">{po.items}</td>
                  <td className="px-4 py-3 text-slate-400 hidden sm:table-cell">{po.date}</td>
                  <td className="px-4 py-3 text-slate-400 hidden sm:table-cell">{po.deliveryDate}</td>
                  <td className="px-4 py-3 text-right text-slate-300">${po.total.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusColors[po.status]}`}>
                      {po.status.charAt(0).toUpperCase() + po.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={po.status}
                      onChange={(e) => updateStatus(po.id, e.target.value as PurchaseOrder['status'])}
                      className="bg-navy-700 border border-blue-900/40 rounded px-2 py-1 text-xs text-slate-300 focus:outline-none relative z-2"
                    >
                      {statusOptions.map((s) => (
                        <option key={s} value={s}>
                          {s.charAt(0).toUpperCase() + s.slice(1)}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
