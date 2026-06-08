export interface Vendor {
  id: string;
  name: string;
  category: string;
  contact: string;
  email: string;
  phone: string;
  score: number;
  status: 'active' | 'inactive' | 'under-review';
  location: string;
  contractEnd: string;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  vendorId: string;
  vendorName: string;
  date: string;
  total: number;
  status: 'pending' | 'approved' | 'shipped' | 'delivered' | 'overdue';
  items: string;
  deliveryDate: string;
}

export interface VendorRating {
  vendorId: string;
  quality: number;
  delivery: number;
  cost: number;
  responsiveness: number;
  overall: number;
}

const VENDOR_KEY = 'vendors';
const PO_KEY = 'purchaseOrders';
const RATING_KEY = 'vendorRatings';

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

export function seedData(): void {
  if (localStorage.getItem(VENDOR_KEY)) return;

  const vendors: Vendor[] = [
    {
      id: generateId(),
      name: 'Apex Materials Inc.',
      category: 'Raw Materials',
      contact: 'Sarah Chen',
      email: 's.chen@apexmat.com',
      phone: '+1 (555) 201-3344',
      score: 87,
      status: 'active',
      location: 'Houston, TX',
      contractEnd: '2027-03-15',
    },
    {
      id: generateId(),
      name: 'TechForge Components',
      category: 'Electronics',
      contact: 'Marcus Rivera',
      email: 'm.rivera@techforge.io',
      phone: '+1 (555) 402-8877',
      score: 92,
      status: 'active',
      location: 'San Jose, CA',
      contractEnd: '2026-11-30',
    },
    {
      id: generateId(),
      name: 'GreenPack Solutions',
      category: 'Packaging',
      contact: 'Emily Nakamura',
      email: 'e.nakamura@greenpack.co',
      phone: '+1 (555) 678-1122',
      score: 74,
      status: 'under-review',
      location: 'Portland, OR',
      contractEnd: '2026-08-20',
    },
    {
      id: generateId(),
      name: 'SteelPeak Logistics',
      category: 'Logistics',
      contact: 'David Okonkwo',
      email: 'd.okonkwo@steelpeak.com',
      phone: '+1 (555) 990-4455',
      score: 68,
      status: 'active',
      location: 'Chicago, IL',
      contractEnd: '2026-06-30',
    },
    {
      id: generateId(),
      name: 'NanoChem Labs',
      category: 'Chemicals',
      contact: 'Dr. Lisa Park',
      email: 'l.park@nanochem.org',
      phone: '+1 (555) 335-7766',
      score: 81,
      status: 'inactive',
      location: 'Raleigh, NC',
      contractEnd: '2025-12-31',
    },
  ];

  const purchaseOrders: PurchaseOrder[] = [
    {
      id: generateId(),
      poNumber: 'PO-2026-0401',
      vendorId: vendors[0].id,
      vendorName: vendors[0].name,
      date: '2026-05-28',
      total: 42500,
      status: 'approved',
      items: 'Aluminum sheets x500, Steel rods x200',
      deliveryDate: '2026-06-15',
    },
    {
      id: generateId(),
      poNumber: 'PO-2026-0402',
      vendorId: vendors[1].id,
      vendorName: vendors[1].name,
      date: '2026-05-30',
      total: 18900,
      status: 'shipped',
      items: 'PCB assemblies x150, Connectors x2000',
      deliveryDate: '2026-06-10',
    },
    {
      id: generateId(),
      poNumber: 'PO-2026-0403',
      vendorId: vendors[2].id,
      vendorName: vendors[2].name,
      date: '2026-05-15',
      total: 8750,
      status: 'overdue',
      items: 'Custom packaging x10000, Labels x5000',
      deliveryDate: '2026-05-28',
    },
    {
      id: generateId(),
      poNumber: 'PO-2026-0404',
      vendorId: vendors[3].id,
      vendorName: vendors[3].name,
      date: '2026-06-01',
      total: 31200,
      status: 'pending',
      items: 'Freight service Q3, Warehousing July',
      deliveryDate: '2026-07-01',
    },
    {
      id: generateId(),
      poNumber: 'PO-2026-0405',
      vendorId: vendors[4].id,
      vendorName: vendors[4].name,
      date: '2026-04-20',
      total: 15600,
      status: 'delivered',
      items: 'Solvent batches x40, Reagent kits x100',
      deliveryDate: '2026-05-10',
    },
  ];

  const vendorRatings: VendorRating[] = vendors.map((v) => ({
    vendorId: v.id,
    quality: Math.round(v.score * (0.9 + Math.random() * 0.2)),
    delivery: Math.round(v.score * (0.85 + Math.random() * 0.3)),
    cost: Math.round(v.score * (0.9 + Math.random() * 0.15)),
    responsiveness: Math.round(v.score * (0.8 + Math.random() * 0.35)),
    overall: v.score,
  }));

  localStorage.setItem(VENDOR_KEY, JSON.stringify(vendors));
  localStorage.setItem(PO_KEY, JSON.stringify(purchaseOrders));
  localStorage.setItem(RATING_KEY, JSON.stringify(vendorRatings));
}

export function getVendors(): Vendor[] {
  const data = localStorage.getItem(VENDOR_KEY);
  return data ? JSON.parse(data) : [];
}

export function getPurchaseOrders(): PurchaseOrder[] {
  const data = localStorage.getItem(PO_KEY);
  return data ? JSON.parse(data) : [];
}

export function getVendorRatings(): VendorRating[] {
  const data = localStorage.getItem(RATING_KEY);
  return data ? JSON.parse(data) : [];
}

export function saveVendors(vendors: Vendor[]): void {
  localStorage.setItem(VENDOR_KEY, JSON.stringify(vendors));
}

export function savePurchaseOrders(pos: PurchaseOrder[]): void {
  localStorage.setItem(PO_KEY, JSON.stringify(pos));
}

export function saveVendorRatings(ratings: VendorRating[]): void {
  localStorage.setItem(RATING_KEY, JSON.stringify(ratings));
}

export function getMonthlyPOData(): { months: string[]; counts: number[] } {
  const pos = getPurchaseOrders();
  const now = new Date();
  const months: string[] = [];
  const counts: number[] = [];

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = d.toLocaleString('en-US', { month: 'short', year: '2-digit' });
    months.push(label);
    const count = pos.filter((po) => {
      const poDate = new Date(po.date);
      return poDate.getMonth() === d.getMonth() && poDate.getFullYear() === d.getFullYear();
    }).length;
    counts.push(count || Math.floor(Math.random() * 12) + 3);
  }

  return { months, counts };
}
