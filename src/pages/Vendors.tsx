import { useMemo, useState } from 'react';
import { Search, Plus, MapPin, Phone, Mail, Tag } from 'lucide-react';
import { getVendors, saveVendors, Vendor } from '../lib/data';

const statusColors: Record<string, string> = {
  active: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  inactive: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  'under-review': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
};

function scoreColor(score: number): string {
  if (score >= 85) return 'text-emerald-400';
  if (score >= 70) return 'text-yellow-400';
  return 'text-red-400';
}

export default function Vendors() {
  const [vendors, setVendors] = useState<Vendor[]>(() => getVendors());
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', category: '', contact: '', email: '', phone: '', location: '', contractEnd: '' });

  const filtered = useMemo(
    () =>
      vendors.filter(
        (v) =>
          v.name.toLowerCase().includes(search.toLowerCase()) ||
          v.category.toLowerCase().includes(search.toLowerCase()) ||
          v.location.toLowerCase().includes(search.toLowerCase())
      ),
    [vendors, search]
  );

  function handleAdd() {
    if (!form.name || !form.category) return;
    const newVendor: Vendor = {
      id: Math.random().toString(36).substring(2, 11),
      name: form.name,
      category: form.category,
      contact: form.contact,
      email: form.email,
      phone: form.phone,
      score: 70 + Math.floor(Math.random() * 20),
      status: 'active',
      location: form.location,
      contractEnd: form.contractEnd || '2027-01-01',
    };
    const updated = [...vendors, newVendor];
    setVendors(updated);
    saveVendors(updated);
    setForm({ name: '', category: '', contact: '', email: '', phone: '', location: '', contractEnd: '' });
    setShowAdd(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Vendor Directory</h1>
          <p className="text-slate-400 text-sm mt-1">{vendors.length} vendors registered</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search vendors..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-navy-700 border border-blue-900/40 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 relative z-2"
            />
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="relative z-2 flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        </div>
      </div>

      {showAdd && (
        <div className="relative z-1 bg-navy-800 border border-blue-900/40 rounded-xl p-6">
          <h3 className="text-white font-semibold mb-4">Add New Vendor</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { key: 'name', label: 'Name' },
              { key: 'category', label: 'Category' },
              { key: 'contact', label: 'Contact' },
              { key: 'email', label: 'Email' },
              { key: 'phone', label: 'Phone' },
              { key: 'location', label: 'Location' },
            ].map(({ key, label }) => (
              <div key={key}>
                <label className="block text-xs text-slate-400 mb-1">{label}</label>
                <input
                  type="text"
                  value={(form as Record<string, string>)[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  className="w-full px-3 py-2 bg-navy-700 border border-blue-900/40 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 relative z-2"
                />
              </div>
            ))}
          </div>
          <div className="flex gap-3 mt-4">
            <button
              onClick={handleAdd}
              className="relative z-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Save Vendor
            </button>
            <button
              onClick={() => setShowAdd(false)}
              className="relative z-2 px-4 py-2 bg-navy-700 hover:bg-navy-600 text-slate-300 text-sm font-medium rounded-lg transition-colors border border-blue-900/40"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((v) => (
          <div
            key={v.id}
            className="relative z-1 bg-navy-800 border border-blue-900/40 rounded-xl p-5 transition-shadow duration-300 hover:shadow-lg hover:shadow-blue-900/20"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-white font-semibold">{v.name}</h3>
                <div className="flex items-center gap-1.5 mt-1">
                  <Tag className="w-3 h-3 text-blue-400" />
                  <span className="text-xs text-blue-400">{v.category}</span>
                </div>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusColors[v.status]}`}>
                {v.status.replace('-', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
              </span>
            </div>
            <div className="space-y-1.5 text-sm text-slate-400">
              <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-slate-500" />
                {v.location}
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-slate-500" />
                {v.email}
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-slate-500" />
                {v.phone}
              </div>
            </div>
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-blue-900/30">
              <span className="text-xs text-slate-500">Contract ends {v.contractEnd}</span>
              <span className={`text-sm font-bold ${scoreColor(v.score)}`}>{v.score}/100</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
