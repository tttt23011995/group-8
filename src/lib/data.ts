import { supabase } from './supabase';

// ── Interfaces (unchanged) ────────────────────────────────────────────────

export interface Vendor {
  id: string;
  vendorCode: string;
  name: string;
  category: string;
  contact: string;
  email: string;
  phone: string;
  leadTime: number;
  paymentTerms: string;
  score: number;
  status: 'active' | 'inactive';
  location: string;
  contractEnd: string;
  notes?: string;
}

export interface LineItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface DeliveryNote {
  timestamp: string;
  text: string;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  vendorId: string;
  vendorName: string;
  date: string;
  total: number;
  status: 'ordered' | 'confirmed' | 'in-transit' | 'delivered' | 'invoiced';
  items: string;
  deliveryDate: string;
  actualDeliveryDate?: string;
  lineItems?: LineItem[];
  subtotal?: number;
  tax?: number;
  deliveryNotes?: DeliveryNote[];
}

export interface VendorRating {
  vendorId: string;
  quality: number;
  delivery: number;
  cost: number;
  responsiveness: number;
  overall: number;
}

export interface DeliveryPerformance {
  onTime: boolean;
  daysDifference: number;
}

// ── Row mappers ───────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToVendor(row: any): Vendor {
  return {
    id: row.id,
    vendorCode: row.vendor_code,
    name: row.name,
    category: row.category,
    contact: row.contact,
    email: row.email,
    phone: row.phone,
    leadTime: row.lead_time,
    paymentTerms: row.payment_terms,
    score: row.score,
    status: row.status,
    location: row.location,
    contractEnd: row.contract_end,
    notes: row.notes || '',
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToPurchaseOrder(row: any): PurchaseOrder {
  return {
    id: row.id,
    poNumber: row.po_number,
    vendorId: row.vendor_id,
    vendorName: row.vendor_name,
    date: row.date,
    total: Number(row.total),
    status: row.status,
    items: row.items,
    deliveryDate: row.delivery_date,
    actualDeliveryDate: row.actual_delivery_date ?? undefined,
    lineItems: row.line_items ?? [],
    subtotal: row.subtotal != null ? Number(row.subtotal) : undefined,
    tax: row.tax != null ? Number(row.tax) : undefined,
    deliveryNotes: row.delivery_notes ?? [],
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToVendorRating(row: any): VendorRating {
  return {
    vendorId: row.vendor_id,
    quality: row.quality,
    delivery: row.delivery,
    cost: row.cost,
    responsiveness: row.responsiveness,
    overall: row.overall,
  };
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

// ── Seed Data ─────────────────────────────────────────────────────────────

export async function seedData(): Promise<void> {
  try {
    const { count, error: countError } = await supabase
      .from('vendors')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('seedData: count check failed', countError);
      return;
    }

    if ((count ?? 0) >= 12) return;

    const vendors: Vendor[] = [
      { id: generateId(), vendorCode: 'VND-001', name: 'Apex Materials Inc.', category: 'Raw Materials', contact: 'Sarah Chen', email: 's.chen@apexmat.com', phone: '+1 (555) 201-3344', leadTime: 14, paymentTerms: 'Net 30', score: 87, status: 'active', location: 'Houston, TX', contractEnd: '2027-03-15' },
      { id: generateId(), vendorCode: 'VND-002', name: 'TechForge Components', category: 'Electronics', contact: 'Marcus Rivera', email: 'm.rivera@techforge.io', phone: '+1 (555) 402-8877', leadTime: 7, paymentTerms: 'Net 60', score: 92, status: 'active', location: 'San Jose, CA', contractEnd: '2026-11-30' },
      { id: generateId(), vendorCode: 'VND-003', name: 'PetroChem Industries', category: 'Raw Materials', contact: 'Olga Petrov', email: 'o.petrov@petrochem.com', phone: '+1 (555) 310-4499', leadTime: 18, paymentTerms: 'Net 60', score: 71, status: 'active', location: 'Baton Rouge, LA', contractEnd: '2026-09-30' },
      { id: generateId(), vendorCode: 'VND-004', name: 'SteelPeak Logistics', category: 'Logistics', contact: 'David Okonkwo', email: 'd.okonkwo@steelpeak.com', phone: '+1 (555) 990-4455', leadTime: 3, paymentTerms: 'Net 30', score: 48, status: 'active', location: 'Chicago, IL', contractEnd: '2026-06-30' },
      { id: generateId(), vendorCode: 'VND-005', name: 'NanoChem Labs', category: 'Raw Materials', contact: 'Dr. Lisa Park', email: 'l.park@nanochem.org', phone: '+1 (555) 335-7766', leadTime: 22, paymentTerms: 'Net 90', score: 55, status: 'inactive', location: 'Raleigh, NC', contractEnd: '2026-04-15' },
      { id: generateId(), vendorCode: 'VND-006', name: 'CircuitPro Ltd', category: 'Electronics', contact: 'Raj Patel', email: 'r.patel@circuitpro.co.uk', phone: '+1 (555) 720-5588', leadTime: 10, paymentTerms: 'Net 30', score: 84, status: 'active', location: 'Austin, TX', contractEnd: '2027-06-30' },
      { id: generateId(), vendorCode: 'VND-007', name: 'Meridian Freight Co.', category: 'Logistics', contact: 'James Whitfield', email: 'j.whitfield@meridianfreight.com', phone: '+1 (555) 441-2233', leadTime: 4, paymentTerms: 'Net 30', score: 79, status: 'active', location: 'Memphis, TN', contractEnd: '2026-12-31' },
      { id: generateId(), vendorCode: 'VND-008', name: 'GreenPack Solutions', category: 'Packaging', contact: 'Emily Nakamura', email: 'e.nakamura@greenpack.co', phone: '+1 (555) 678-1122', leadTime: 8, paymentTerms: 'Net 30', score: 74, status: 'active', location: 'Portland, OR', contractEnd: '2026-08-20' },
      { id: generateId(), vendorCode: 'VND-009', name: 'SilicaSource Group', category: 'Raw Materials', contact: 'Carlos Mendez', email: 'c.mendez@silicasource.com', phone: '+1 (555) 505-6677', leadTime: 30, paymentTerms: 'Net 90', score: 62, status: 'inactive', location: 'Phoenix, AZ', contractEnd: '2026-02-28' },
      { id: generateId(), vendorCode: 'VND-010', name: 'VoltEdge Systems', category: 'Electronics', contact: 'Anika Desai', email: 'a.desai@voltedge.io', phone: '+1 (555) 815-3344', leadTime: 14, paymentTerms: 'Net 60', score: 96, status: 'active', location: 'Denver, CO', contractEnd: '2027-09-30' },
      { id: generateId(), vendorCode: 'VND-011', name: 'SwiftRoute Inc.', category: 'Logistics', contact: 'Tom Bergström', email: 't.bergstrom@swiftroute.com', phone: '+1 (555) 223-9900', leadTime: 2, paymentTerms: 'Net 30', score: 88, status: 'active', location: 'Indianapolis, IN', contractEnd: '2027-01-15' },
      { id: generateId(), vendorCode: 'VND-012', name: 'BoxCraft Industries', category: 'Packaging', contact: 'Mei-Ling Zhao', email: 'm.zhao@boxcraft.com', phone: '+1 (555) 142-7788', leadTime: 21, paymentTerms: 'Net 60', score: 57, status: 'inactive', location: 'Detroit, MI', contractEnd: '2026-03-31' },
    ];

    const { error: vendorError } = await supabase.from('vendors').insert(
      vendors.map((v) => ({
        id: v.id,
        vendor_code: v.vendorCode,
        name: v.name,
        category: v.category,
        contact: v.contact,
        email: v.email,
        phone: v.phone,
        lead_time: v.leadTime,
        payment_terms: v.paymentTerms,
        score: v.score,
        status: v.status,
        location: v.location,
        contract_end: v.contractEnd,
        notes: '',
      }))
    );

    if (vendorError) {
      console.error('seedData: vendor insert failed', vendorError);
      return;
    }

    const purchaseOrders: PurchaseOrder[] = [
      { id: generateId(), poNumber: 'PO-2025-001', vendorId: vendors[0].id, vendorName: vendors[0].name, date: '2026-01-12', total: 33088.0, status: 'invoiced', items: 'Aluminum sheets x400, Copper rods x150, Zinc ingots x80', deliveryDate: '2026-02-05', lineItems: [{ id: generateId(), name: 'Aluminum sheets', quantity: 400, unitPrice: 55, lineTotal: 22000 }, { id: generateId(), name: 'Copper rods', quantity: 150, unitPrice: 68, lineTotal: 10200 }, { id: generateId(), name: 'Zinc ingots', quantity: 80, unitPrice: 9.0, lineTotal: 720 }], subtotal: 32920.0, tax: 3292.0 },
      { id: generateId(), poNumber: 'PO-2025-002', vendorId: vendors[1].id, vendorName: vendors[1].name, date: '2026-01-20', total: 21703.0, status: 'invoiced', items: 'PCB assemblies x120, Connectors x2500', deliveryDate: '2026-02-15', lineItems: [{ id: generateId(), name: 'PCB assemblies', quantity: 120, unitPrice: 110, lineTotal: 13200 }, { id: generateId(), name: 'Connectors', quantity: 2500, unitPrice: 2.2, lineTotal: 5500 }], subtotal: 18700.0, tax: 1870.0 },
      { id: generateId(), poNumber: 'PO-2025-003', vendorId: vendors[2].id, vendorName: vendors[2].name, date: '2026-01-28', total: 25137.0, status: 'delivered', items: 'Ethanol drums x50, Solvent batches x30', deliveryDate: '2026-03-01', lineItems: [{ id: generateId(), name: 'Ethanol drums', quantity: 50, unitPrice: 220, lineTotal: 11000 }, { id: generateId(), name: 'Solvent batches', quantity: 30, unitPrice: 340, lineTotal: 10200 }], subtotal: 21200.0, tax: 2120.0 },
      { id: generateId(), poNumber: 'PO-2025-004', vendorId: vendors[3].id, vendorName: vendors[3].name, date: '2026-02-03', total: 34320.0, status: 'invoiced', items: 'Freight service Q1, Warehousing Feb', deliveryDate: '2026-02-20', lineItems: [{ id: generateId(), name: 'Freight service Q1', quantity: 1, unitPrice: 22000, lineTotal: 22000 }, { id: generateId(), name: 'Warehousing Feb', quantity: 1, unitPrice: 9200, lineTotal: 9200 }], subtotal: 31200.0, tax: 3120.0 },
      { id: generateId(), poNumber: 'PO-2025-005', vendorId: vendors[4].id, vendorName: vendors[4].name, date: '2026-02-10', total: 17160.0, status: 'delivered', items: 'Reagent kits x100, Catalyst packs x60', deliveryDate: '2026-03-15', lineItems: [{ id: generateId(), name: 'Reagent kits', quantity: 100, unitPrice: 44, lineTotal: 4400 }, { id: generateId(), name: 'Catalyst packs', quantity: 60, unitPrice: 112, lineTotal: 6720 }], subtotal: 11120.0, tax: 1112.0 },
      { id: generateId(), poNumber: 'PO-2025-006', vendorId: vendors[5].id, vendorName: vendors[5].name, date: '2026-02-18', total: 28270.5, status: 'invoiced', items: 'Resistors x10000, Capacitors x8000, Diodes x5000', deliveryDate: '2026-03-10', lineItems: [{ id: generateId(), name: 'Resistors', quantity: 10000, unitPrice: 0.15, lineTotal: 1500 }, { id: generateId(), name: 'Capacitors', quantity: 8000, unitPrice: 0.35, lineTotal: 2800 }, { id: generateId(), name: 'Diodes', quantity: 5000, unitPrice: 0.48, lineTotal: 2400 }], subtotal: 6700.0, tax: 670.0 },
      { id: generateId(), poNumber: 'PO-2025-007', vendorId: vendors[6].id, vendorName: vendors[6].name, date: '2026-02-25', total: 16995.0, status: 'delivered', items: 'Express freight x3, Last-mile delivery x150', deliveryDate: '2026-03-12', lineItems: [{ id: generateId(), name: 'Express freight', quantity: 3, unitPrice: 4500, lineTotal: 13500 }, { id: generateId(), name: 'Last-mile delivery', quantity: 150, unitPrice: 15, lineTotal: 2250 }], subtotal: 15750.0, tax: 1575.0 },
      { id: generateId(), poNumber: 'PO-2025-008', vendorId: vendors[7].id, vendorName: vendors[7].name, date: '2026-03-05', total: 9625.0, status: 'delivered', items: 'Custom packaging x10000, Labels x5000', deliveryDate: '2026-04-01', lineItems: [{ id: generateId(), name: 'Custom packaging', quantity: 10000, unitPrice: 0.65, lineTotal: 6500 }, { id: generateId(), name: 'Labels', quantity: 5000, unitPrice: 0.45, lineTotal: 2250 }], subtotal: 8750.0, tax: 875.0 },
      { id: generateId(), poNumber: 'PO-2025-009', vendorId: vendors[8].id, vendorName: vendors[8].name, date: '2026-03-12', total: 13728.0, status: 'delivered', items: 'Silica sand x200, Feldspar x150, Clay batches x40', deliveryDate: '2026-04-20', lineItems: [{ id: generateId(), name: 'Silica sand', quantity: 200, unitPrice: 32, lineTotal: 6400 }, { id: generateId(), name: 'Feldspar', quantity: 150, unitPrice: 28, lineTotal: 4200 }, { id: generateId(), name: 'Clay batches', quantity: 40, unitPrice: 45, lineTotal: 1800 }], subtotal: 12400.0, tax: 1240.0 },
      { id: generateId(), poNumber: 'PO-2025-010', vendorId: vendors[9].id, vendorName: vendors[9].name, date: '2026-03-20', total: 46750.0, status: 'confirmed', items: 'Microcontrollers x2000, Sensor modules x500', deliveryDate: '2026-06-20', lineItems: [{ id: generateId(), name: 'Microcontrollers', quantity: 2000, unitPrice: 14, lineTotal: 28000 }, { id: generateId(), name: 'Sensor modules', quantity: 500, unitPrice: 28, lineTotal: 14000 }], subtotal: 42000.0, tax: 4200.0 },
      { id: generateId(), poNumber: 'PO-2025-011', vendorId: vendors[10].id, vendorName: vendors[10].name, date: '2026-03-28', total: 22464.0, status: 'in-transit', items: 'Same-day courier x40, Regional freight x2', deliveryDate: '2026-05-28', lineItems: [{ id: generateId(), name: 'Same-day courier', quantity: 40, unitPrice: 180, lineTotal: 7200 }, { id: generateId(), name: 'Regional freight', quantity: 2, unitPrice: 6600, lineTotal: 13200 }], subtotal: 20400.0, tax: 2040.0 },
      { id: generateId(), poNumber: 'PO-2025-012', vendorId: vendors[11].id, vendorName: vendors[11].name, date: '2026-04-02', total: 4375.8, status: 'delivered', items: 'Corrugated boxes x5000, Foam inserts x3000', deliveryDate: '2026-04-25', lineItems: [{ id: generateId(), name: 'Corrugated boxes', quantity: 5000, unitPrice: 0.6, lineTotal: 3000 }, { id: generateId(), name: 'Foam inserts', quantity: 3000, unitPrice: 0.98, lineTotal: 2940 }], subtotal: 5940.0, tax: 594.0 },
      { id: generateId(), poNumber: 'PO-2025-013', vendorId: vendors[0].id, vendorName: vendors[0].name, date: '2026-04-08', total: 46750.0, status: 'confirmed', items: 'Aluminum sheets x500, Steel rods x200, Titanium plates x50', deliveryDate: '2026-06-18', lineItems: [{ id: generateId(), name: 'Aluminum sheets', quantity: 500, unitPrice: 55, lineTotal: 27500 }, { id: generateId(), name: 'Steel rods', quantity: 200, unitPrice: 85, lineTotal: 17000 }, { id: generateId(), name: 'Titanium plates', quantity: 50, unitPrice: 80, lineTotal: 4000 }], subtotal: 48500.0, tax: 4850.0 },
      { id: generateId(), poNumber: 'PO-2025-014', vendorId: vendors[1].id, vendorName: vendors[1].name, date: '2026-04-15', total: 20790.0, status: 'in-transit', items: 'PCB assemblies x150, Connectors x2000', deliveryDate: '2026-06-01', lineItems: [{ id: generateId(), name: 'PCB assemblies', quantity: 150, unitPrice: 110, lineTotal: 16500 }, { id: generateId(), name: 'Connectors', quantity: 2000, unitPrice: 2.2, lineTotal: 4400 }], subtotal: 20900.0, tax: 2090.0 },
      { id: generateId(), poNumber: 'PO-2025-015', vendorId: vendors[2].id, vendorName: vendors[2].name, date: '2026-04-22', total: 11704.0, status: 'in-transit', items: 'Ethanol drums x20, Solvent batches x15', deliveryDate: '2026-06-25', lineItems: [{ id: generateId(), name: 'Ethanol drums', quantity: 20, unitPrice: 220, lineTotal: 4400 }, { id: generateId(), name: 'Solvent batches', quantity: 15, unitPrice: 340, lineTotal: 5100 }], subtotal: 9500.0, tax: 950.0 },
      { id: generateId(), poNumber: 'PO-2025-016', vendorId: vendors[3].id, vendorName: vendors[3].name, date: '2026-04-28', total: 34320.0, status: 'ordered', items: 'Freight service Q3, Warehousing July', deliveryDate: '2026-07-01', lineItems: [{ id: generateId(), name: 'Freight service Q3', quantity: 1, unitPrice: 22000, lineTotal: 22000 }, { id: generateId(), name: 'Warehousing July', quantity: 1, unitPrice: 9200, lineTotal: 9200 }], subtotal: 31200.0, tax: 3120.0 },
      { id: generateId(), poNumber: 'PO-2025-017', vendorId: vendors[4].id, vendorName: vendors[4].name, date: '2026-05-02', total: 16926.0, status: 'ordered', items: 'Reagent kits x80, Catalyst packs x100', deliveryDate: '2026-07-10', lineItems: [{ id: generateId(), name: 'Reagent kits', quantity: 80, unitPrice: 44, lineTotal: 3520 }, { id: generateId(), name: 'Catalyst packs', quantity: 100, unitPrice: 118, lineTotal: 11800 }], subtotal: 15320.0, tax: 1532.0 },
      { id: generateId(), poNumber: 'PO-2025-018', vendorId: vendors[5].id, vendorName: vendors[5].name, date: '2026-05-08', total: 28270.5, status: 'in-transit', items: 'Resistors x12000, Capacitors x6000, Inductors x3000', deliveryDate: '2026-06-03', lineItems: [{ id: generateId(), name: 'Resistors', quantity: 12000, unitPrice: 0.15, lineTotal: 1800 }, { id: generateId(), name: 'Capacitors', quantity: 6000, unitPrice: 0.35, lineTotal: 2100 }, { id: generateId(), name: 'Inductors', quantity: 3000, unitPrice: 0.72, lineTotal: 2160 }], subtotal: 6060.0, tax: 606.0 },
      { id: generateId(), poNumber: 'PO-2025-019', vendorId: vendors[0].id, vendorName: vendors[0].name, date: '2026-05-12', total: 28395.0, status: 'ordered', items: 'Aluminum sheets x300, Copper rods x100', deliveryDate: '2026-06-28', lineItems: [{ id: generateId(), name: 'Express freight', quantity: 5, unitPrice: 4500, lineTotal: 22500 }, { id: generateId(), name: 'Regional freight', quantity: 3, unitPrice: 6600, lineTotal: 19800 }], subtotal: 42300.0, tax: 4230.0 },
      { id: generateId(), poNumber: 'PO-2025-020', vendorId: vendors[7].id, vendorName: vendors[7].name, date: '2026-05-18', total: 10373.0, status: 'confirmed', items: 'Custom packaging x8000, Shrink wrap x4000', deliveryDate: '2026-06-22', lineItems: [{ id: generateId(), name: 'Custom packaging', quantity: 8000, unitPrice: 0.65, lineTotal: 5200 }, { id: generateId(), name: 'Shrink wrap', quantity: 4000, unitPrice: 0.42, lineTotal: 1680 }], subtotal: 6880.0, tax: 688.0 },
      { id: generateId(), poNumber: 'PO-2025-021', vendorId: vendors[8].id, vendorName: vendors[8].name, date: '2026-05-22', total: 13728.0, status: 'ordered', items: 'Silica sand x300, Feldspar x100', deliveryDate: '2026-07-20', lineItems: [{ id: generateId(), name: 'Silica sand', quantity: 300, unitPrice: 32, lineTotal: 9600 }, { id: generateId(), name: 'Feldspar', quantity: 100, unitPrice: 28, lineTotal: 2800 }], subtotal: 12400.0, tax: 1240.0 },
      { id: generateId(), poNumber: 'PO-2025-022', vendorId: vendors[9].id, vendorName: vendors[9].name, date: '2026-05-26', total: 62480.0, status: 'confirmed', items: 'Microcontrollers x3000, Sensor modules x800, Power regulators x400', deliveryDate: '2026-06-30', lineItems: [{ id: generateId(), name: 'Microcontrollers', quantity: 3000, unitPrice: 14, lineTotal: 42000 }, { id: generateId(), name: 'Sensor modules', quantity: 800, unitPrice: 28, lineTotal: 22400 }, { id: generateId(), name: 'Power regulators', quantity: 400, unitPrice: 2.5, lineTotal: 1000 }], subtotal: 65400.0, tax: 6540.0 },
      { id: generateId(), poNumber: 'PO-2025-023', vendorId: vendors[10].id, vendorName: vendors[10].name, date: '2026-05-30', total: 15675.0, status: 'in-transit', items: 'Same-day courier x25, Regional freight x1', deliveryDate: '2026-06-20', lineItems: [{ id: generateId(), name: 'Same-day courier', quantity: 25, unitPrice: 180, lineTotal: 4500 }, { id: generateId(), name: 'Regional freight', quantity: 1, unitPrice: 9750, lineTotal: 9750 }], subtotal: 14250.0, tax: 1425.0 },
      { id: generateId(), poNumber: 'PO-2025-024', vendorId: vendors[0].id, vendorName: vendors[0].name, date: '2026-06-01', total: 51480.0, status: 'ordered', items: 'Aluminum sheets x600, Copper rods x250', deliveryDate: '2026-07-15', lineItems: [{ id: generateId(), name: 'Aluminum sheets', quantity: 600, unitPrice: 55, lineTotal: 33000 }, { id: generateId(), name: 'Copper rods', quantity: 250, unitPrice: 68, lineTotal: 17000 }], subtotal: 50000.0, tax: 5000.0 },
      { id: generateId(), poNumber: 'PO-2025-025', vendorId: vendors[0].id, vendorName: vendors[0].name, date: '2026-06-03', total: 11858.0, status: 'ordered', items: 'Aluminum sheets x100, Zinc ingots x300', deliveryDate: '2026-07-08', lineItems: [{ id: generateId(), name: 'Corrugated boxes', quantity: 8000, unitPrice: 0.6, lineTotal: 4800 }, { id: generateId(), name: 'Foam inserts', quantity: 5000, unitPrice: 0.98, lineTotal: 4900 }, { id: generateId(), name: 'Packing tape', quantity: 2000, unitPrice: 0.55, lineTotal: 1100 }], subtotal: 10800.0, tax: 1080.0 },
    ];

    const { error: poError } = await supabase.from('purchase_orders').insert(
      purchaseOrders.map((po) => ({
        id: po.id,
        po_number: po.poNumber,
        vendor_id: po.vendorId,
        vendor_name: po.vendorName,
        date: po.date,
        total: po.total,
        status: po.status,
        items: po.items,
        delivery_date: po.deliveryDate,
        actual_delivery_date: po.actualDeliveryDate ?? null,
        line_items: po.lineItems ?? [],
        subtotal: po.subtotal ?? null,
        tax: po.tax ?? null,
        delivery_notes: po.deliveryNotes ?? [],
      }))
    );

    if (poError) {
      console.error('seedData: PO insert failed', poError);
      return;
    }

    const vendorRatings: VendorRating[] = [
      { vendorId: vendors[0].id, quality: 89, delivery: 85, cost: 82, responsiveness: 90, overall: 87 },
      { vendorId: vendors[1].id, quality: 94, delivery: 91, cost: 88, responsiveness: 95, overall: 92 },
      { vendorId: vendors[2].id, quality: 72, delivery: 68, cost: 75, responsiveness: 70, overall: 71 },
      { vendorId: vendors[3].id, quality: 45, delivery: 42, cost: 52, responsiveness: 50, overall: 47 },
      { vendorId: vendors[4].id, quality: 58, delivery: 52, cost: 55, responsiveness: 56, overall: 55 },
      { vendorId: vendors[5].id, quality: 86, delivery: 82, cost: 80, responsiveness: 88, overall: 84 },
      { vendorId: vendors[6].id, quality: 78, delivery: 80, cost: 76, responsiveness: 82, overall: 79 },
      { vendorId: vendors[7].id, quality: 90, delivery: 45, cost: 74, responsiveness: 73, overall: 70 },
      { vendorId: vendors[8].id, quality: 60, delivery: 64, cost: 58, responsiveness: 66, overall: 62 },
      { vendorId: vendors[9].id, quality: 98, delivery: 94, cost: 95, responsiveness: 97, overall: 96 },
      { vendorId: vendors[10].id, quality: 90, delivery: 87, cost: 86, responsiveness: 89, overall: 88 },
      { vendorId: vendors[11].id, quality: 55, delivery: 58, cost: 60, responsiveness: 54, overall: 57 },
    ];

    const { error: ratingError } = await supabase.from('vendor_ratings').insert(
      vendorRatings.map((r) => ({
        vendor_id: r.vendorId,
        quality: r.quality,
        delivery: r.delivery,
        cost: r.cost,
        responsiveness: r.responsiveness,
        overall: r.overall,
      }))
    );

    if (ratingError) {
      console.error('seedData: ratings insert failed', ratingError);
    }

    const perfRows: { po_id: string; on_time: boolean; days_difference: number }[] = [];
    purchaseOrders.forEach((po, idx) => {
      if (po.status !== 'delivered' && po.status !== 'invoiced') return;
      const vendorIdx = vendors.findIndex((v) => v.id === po.vendorId);

      let onTime = true;
      let daysDifference = 0;

      if (vendorIdx === 4) {
        const isLate = idx % 2 === 0;
        onTime = !isLate;
        daysDifference = isLate ? 3 + (idx % 5) : 0;
      } else if (vendorIdx === 8) {
        const isLate = idx % 5 === 0 || idx % 5 === 2;
        onTime = !isLate;
        daysDifference = isLate ? 2 + (idx % 4) : 0;
      } else if (vendorIdx === 11) {
        const isLate = idx % 5 === 0 || idx % 5 === 3;
        onTime = !isLate;
        daysDifference = isLate ? 2 + (idx % 3) : 0;
      } else if (vendorIdx === 2) {
        const isLate = idx === 2;
        onTime = !isLate;
        daysDifference = isLate ? 3 : 0;
      } else if (vendorIdx === 3) {
        const isLate = idx === 3;
        onTime = !isLate;
        daysDifference = isLate ? 2 : 0;
      }

      perfRows.push({ po_id: po.id, on_time: onTime, days_difference: daysDifference });
    });

    if (perfRows.length > 0) {
      const { error: perfError } = await supabase.from('delivery_performance').insert(perfRows);
      if (perfError) {
        console.error('seedData: delivery_performance insert failed', perfError);
      }
    }
  } catch (e) {
    console.error('seedData: unexpected error', e);
  }
}

// ── Read functions ────────────────────────────────────────────────────────

export async function getVendors(): Promise<Vendor[]> {
  try {
    const { data, error } = await supabase
      .from('vendors')
      .select('*')
      .order('vendor_code');
    if (error) { console.error('getVendors:', error); return []; }
    return (data ?? []).map(rowToVendor);
  } catch (e) {
    console.error('getVendors:', e);
    return [];
  }
}

export async function getPurchaseOrders(): Promise<PurchaseOrder[]> {
  try {
    const { data, error } = await supabase
      .from('purchase_orders')
      .select('*')
      .order('date', { ascending: false });
    if (error) { console.error('getPurchaseOrders:', error); return []; }
    return (data ?? []).map(rowToPurchaseOrder);
  } catch (e) {
    console.error('getPurchaseOrders:', e);
    return [];
  }
}

export async function getVendorRatings(): Promise<VendorRating[]> {
  try {
    const { data, error } = await supabase.from('vendor_ratings').select('*');
    if (error) { console.error('getVendorRatings:', error); return []; }
    return (data ?? []).map(rowToVendorRating);
  } catch (e) {
    console.error('getVendorRatings:', e);
    return [];
  }
}

export async function getDeliveryPerformance(): Promise<Record<string, DeliveryPerformance>> {
  try {
    const { data, error } = await supabase.from('delivery_performance').select('*');
    if (error) { console.error('getDeliveryPerformance:', error); return {}; }
    const result: Record<string, DeliveryPerformance> = {};
    for (const row of data ?? []) {
      result[row.po_id] = { onTime: row.on_time, daysDifference: row.days_difference };
    }
    return result;
  } catch (e) {
    console.error('getDeliveryPerformance:', e);
    return {};
  }
}

// ── Write functions ───────────────────────────────────────────────────────

export async function saveVendors(vendors: Vendor[]): Promise<void> {
  try {
    const rows = vendors.map((v) => ({
      id: v.id,
      vendor_code: v.vendorCode,
      name: v.name,
      category: v.category,
      contact: v.contact,
      email: v.email,
      phone: v.phone,
      lead_time: v.leadTime,
      payment_terms: v.paymentTerms,
      score: v.score,
      status: v.status,
      location: v.location,
      contract_end: v.contractEnd,
      notes: v.notes ?? '',
    }));
    const { error } = await supabase.from('vendors').upsert(rows);
    if (error) console.error('saveVendors:', error);
  } catch (e) {
    console.error('saveVendors:', e);
  }
}

export async function deleteVendor(vendorId: string): Promise<void> {
  try {
    const { error } = await supabase.from('vendors').delete().eq('id', vendorId);
    if (error) console.error('deleteVendor:', error);
  } catch (e) {
    console.error('deleteVendor:', e);
  }
}

export async function savePurchaseOrders(pos: PurchaseOrder[]): Promise<void> {
  try {
    const rows = pos.map((po) => ({
      id: po.id,
      po_number: po.poNumber,
      vendor_id: po.vendorId,
      vendor_name: po.vendorName,
      date: po.date,
      total: po.total,
      status: po.status,
      items: po.items,
      delivery_date: po.deliveryDate,
      actual_delivery_date: po.actualDeliveryDate ?? null,
      line_items: po.lineItems ?? [],
      subtotal: po.subtotal ?? null,
      tax: po.tax ?? null,
      delivery_notes: po.deliveryNotes ?? [],
    }));
    const { error } = await supabase.from('purchase_orders').upsert(rows);
    if (error) console.error('savePurchaseOrders:', error);
  } catch (e) {
    console.error('savePurchaseOrders:', e);
  }
}

export async function deletePurchaseOrder(poId: string): Promise<void> {
  try {
    const { error } = await supabase.from('purchase_orders').delete().eq('id', poId);
    if (error) console.error('deletePurchaseOrder:', error);
  } catch (e) {
    console.error('deletePurchaseOrder:', e);
  }
}

export async function upsertPurchaseOrder(po: PurchaseOrder): Promise<void> {
  try {
    const { error } = await supabase.from('purchase_orders').upsert({
      id: po.id,
      po_number: po.poNumber,
      vendor_id: po.vendorId,
      vendor_name: po.vendorName,
      date: po.date,
      total: po.total,
      status: po.status,
      items: po.items,
      delivery_date: po.deliveryDate,
      actual_delivery_date: po.actualDeliveryDate ?? null,
      line_items: po.lineItems ?? [],
      subtotal: po.subtotal ?? null,
      tax: po.tax ?? null,
      delivery_notes: po.deliveryNotes ?? [],
    });
    if (error) console.error('upsertPurchaseOrder:', error);
  } catch (e) {
    console.error('upsertPurchaseOrder:', e);
  }
}

export async function deletePurchaseOrderById(poId: string): Promise<void> {
  try {
    const { error } = await supabase.from('purchase_orders').delete().eq('id', poId);
    if (error) console.error('deletePurchaseOrderById:', error);
  } catch (e) {
    console.error('deletePurchaseOrderById:', e);
  }
}

export async function upsertVendor(vendor: Vendor): Promise<void> {
  try {
    const { error } = await supabase.from('vendors').upsert({
      id: vendor.id,
      vendor_code: vendor.vendorCode,
      name: vendor.name,
      category: vendor.category,
      contact: vendor.contact,
      email: vendor.email,
      phone: vendor.phone,
      lead_time: vendor.leadTime,
      payment_terms: vendor.paymentTerms,
      score: vendor.score,
      status: vendor.status,
      location: vendor.location,
      contract_end: vendor.contractEnd,
      notes: vendor.notes ?? '',
    });
    if (error) console.error('upsertVendor:', error);
  } catch (e) {
    console.error('upsertVendor:', e);
  }
}

export async function saveVendorRatings(ratings: VendorRating[]): Promise<void> {
  try {
    const rows = ratings.map((r) => ({
      vendor_id: r.vendorId,
      quality: r.quality,
      delivery: r.delivery,
      cost: r.cost,
      responsiveness: r.responsiveness,
      overall: r.overall,
    }));
    const { error } = await supabase.from('vendor_ratings').upsert(rows, { onConflict: 'vendor_id' });
    if (error) console.error('saveVendorRatings:', error);
  } catch (e) {
    console.error('saveVendorRatings:', e);
  }
}

export async function saveDeliveryPerformance(perf: Record<string, DeliveryPerformance>): Promise<void> {
  try {
    const rows = Object.entries(perf).map(([po_id, p]) => ({
      po_id,
      on_time: p.onTime,
      days_difference: p.daysDifference,
    }));
    if (rows.length === 0) return;
    const { error } = await supabase.from('delivery_performance').upsert(rows, { onConflict: 'po_id' });
    if (error) console.error('saveDeliveryPerformance:', error);
  } catch (e) {
    console.error('saveDeliveryPerformance:', e);
  }
}

export async function deleteDeliveryPerformanceEntry(poId: string): Promise<void> {
  try {
    const { error } = await supabase.from('delivery_performance').delete().eq('po_id', poId);
    if (error) console.error('deleteDeliveryPerformanceEntry:', error);
  } catch (e) {
    console.error('deleteDeliveryPerformanceEntry:', e);
  }
}

// ── Computed helpers ──────────────────────────────────────────────────────

export async function getOpenPOCountForVendor(vendorId: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('purchase_orders')
      .select('*', { count: 'exact', head: true })
      .eq('vendor_id', vendorId)
      .not('status', 'in', '(delivered,invoiced)');
    if (error) { console.error('getOpenPOCountForVendor:', error); return 0; }
    return count ?? 0;
  } catch (e) {
    console.error('getOpenPOCountForVendor:', e);
    return 0;
  }
}

export async function generateVendorCode(): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('vendors')
      .select('vendor_code')
      .order('vendor_code', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return 'VND-001';
    const match = (data.vendor_code as string).match(/VND-(\d+)/);
    const maxNum = match ? parseInt(match[1], 10) : 0;
    return `VND-${String(maxNum + 1).padStart(3, '0')}`;
  } catch {
    return 'VND-001';
  }
}

export async function generatePONumber(): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('purchase_orders')
      .select('po_number')
      .order('po_number', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return 'PO-2025-001';
    const match = (data.po_number as string).match(/PO-\d+-(\d+)/);
    const maxNum = match ? parseInt(match[1], 10) : 0;
    return `PO-2025-${String(maxNum + 1).padStart(3, '0')}`;
  } catch {
    return 'PO-2025-001';
  }
}

export async function getChartData(numMonths: number): Promise<{
  months: string[];
  counts: number[];
  spends: number[];
  availableMonths: number;
}> {
  try {
    const pos = await getPurchaseOrders();
    const now = new Date();
    const months: string[] = [];
    const counts: number[] = [];
    const spends: number[] = [];

    const poMonthSet = new Set(
      pos.map((po) => {
        const d = new Date(po.date);
        return `${d.getFullYear()}-${d.getMonth()}`;
      })
    );
    const availableMonths = poMonthSet.size;

    for (let i = numMonths - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleString('en-US', { month: 'short', year: '2-digit' });
      months.push(label);

      const monthPOs = pos.filter((po) => {
        const poDate = new Date(po.date);
        return poDate.getMonth() === d.getMonth() && poDate.getFullYear() === d.getFullYear();
      });

      const count = monthPOs.length || Math.floor(Math.random() * 12) + 3;
      const spend = monthPOs.reduce((s, po) => s + po.total, 0) || Math.floor(Math.random() * 80000) + 10000;
      counts.push(count);
      spends.push(spend);
    }

    return { months, counts, spends, availableMonths };
  } catch (e) {
    console.error('getChartData:', e);
    return { months: [], counts: [], spends: [], availableMonths: 0 };
  }
}

// ── Catalog (static) ──────────────────────────────────────────────────────

export interface CatalogItem {
  name: string;
  unitPrice: number;
}

export const CATALOG_ITEMS: CatalogItem[] = [
  { name: 'Aluminum sheets', unitPrice: 55 },
  { name: 'Copper rods', unitPrice: 68 },
  { name: 'Steel rods', unitPrice: 85 },
  { name: 'Zinc ingots', unitPrice: 9 },
  { name: 'Titanium plates', unitPrice: 80 },
  { name: 'Ethanol drums', unitPrice: 220 },
  { name: 'Solvent batches', unitPrice: 340 },
  { name: 'Reagent kits', unitPrice: 44 },
  { name: 'Catalyst packs', unitPrice: 118 },
  { name: 'Silica sand', unitPrice: 32 },
  { name: 'Feldspar', unitPrice: 28 },
  { name: 'Clay batches', unitPrice: 45 },
  { name: 'PCB assemblies', unitPrice: 110 },
  { name: 'Connectors', unitPrice: 2.2 },
  { name: 'Resistors', unitPrice: 0.15 },
  { name: 'Capacitors', unitPrice: 0.35 },
  { name: 'Diodes', unitPrice: 0.48 },
  { name: 'Inductors', unitPrice: 0.72 },
  { name: 'Microcontrollers', unitPrice: 14 },
  { name: 'Sensor modules', unitPrice: 28 },
  { name: 'Power regulators', unitPrice: 2.5 },
  { name: 'Freight service Q1', unitPrice: 22000 },
  { name: 'Freight service Q3', unitPrice: 22000 },
  { name: 'Warehousing Feb', unitPrice: 9200 },
  { name: 'Warehousing July', unitPrice: 9200 },
  { name: 'Express freight', unitPrice: 4500 },
  { name: 'Regional freight', unitPrice: 6600 },
  { name: 'Same-day courier', unitPrice: 180 },
  { name: 'Last-mile delivery', unitPrice: 15 },
  { name: 'Custom packaging', unitPrice: 0.65 },
  { name: 'Labels', unitPrice: 0.45 },
  { name: 'Shrink wrap', unitPrice: 0.42 },
  { name: 'Corrugated boxes', unitPrice: 0.6 },
  { name: 'Foam inserts', unitPrice: 0.98 },
  { name: 'Packing tape', unitPrice: 0.55 },
];
