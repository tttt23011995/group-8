import {
  getVendors,
  getPurchaseOrders,
  getVendorRatings,
  getDeliveryPerformance,
  getOpenPOCountForVendor,
  Vendor,
  PurchaseOrder,
  VendorRating,
  DeliveryPerformance,
} from './data';

// ── Interfaces ────────────────────────────────────────────────────────────

export interface RiskCategory {
  type: string;
  severity: 'low' | 'medium' | 'high';
  scoreImpact: number;
  message: string;
}

/**
 * New SupplierRisk interface with simplified structure
 * Uses lowercase risk levels and detectedRisks array
 */
export interface NewSupplierRisk {
  vendorId: string;
  vendorName: string;
  category: string;

  overallRiskScore: number;
  riskLevel: 'low' | 'medium' | 'high';

  detectedRisks: RiskCategory[];

  spendExposure: number;
  openPOCount: number;
  lateDeliveryRate: number;
}

export interface RiskDashboardMetrics {
  totalSuppliers: number;
  highRiskSuppliers: number;
  mediumRiskSuppliers: number;
  lowRiskSuppliers: number;
  averageRiskScore: number;
  criticalAlerts: number;
  overduePOs: number;
}

// ── Helper Functions ──────────────────────────────────────────────────────

function getDaysBetween(date1: Date, date2: Date): number {
  const msPerDay = 86400000;
  return Math.floor((date2.getTime() - date1.getTime()) / msPerDay);
}

function getPercentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)] ?? 0;
}

function getCategoryAverageLeadTime(vendors: Vendor[], category: string): number {
  const categoryVendors = vendors.filter(v => v.category === category);
  if (categoryVendors.length === 0) return 7;
  return categoryVendors.reduce((sum, v) => sum + v.leadTime, 0) / categoryVendors.length;
}

// ── Risk Calculators ─────────────────────────────────────────────────────

/**
 * 1. DELIVERY RISK
 * Detects overdue shipments, chronic late delivery, and extended lead times
 */
function calculateDeliveryRisks(
  vendor: Vendor,
  vendorPos: PurchaseOrder[],
  perfMap: Record<string, DeliveryPerformance>,
  categoryAvgLeadTime: number
): RiskCategory[] {
  const risks: RiskCategory[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 1.1 Overdue shipments - PO not delivered and past delivery date
  const overduePOs = vendorPos.filter(po => {
    if (po.status === 'delivered' || po.status === 'invoiced') return false;
    const deliveryDate = new Date(po.deliveryDate);
    deliveryDate.setHours(0, 0, 0, 0);
    return deliveryDate < today;
  });

  if (overduePOs.length > 0) {
    risks.push({
      type: 'Overdue Delivery',
      severity: 'high',
      scoreImpact: 30,
      message: `${overduePOs.length} purchase order(s) past delivery date`,
    });
  }

  // 1.2 Chronic late delivery - late rate > 40%
  const completedPOs = vendorPos.filter(po => po.status === 'delivered' || po.status === 'invoiced');
  let lateCount = 0;
  let totalWithPerf = 0;

  completedPOs.forEach(po => {
    const perf = perfMap[po.id];
    if (perf) {
      totalWithPerf++;
      if (!perf.onTime) lateCount++;
    }
  });

  const lateDeliveryRate = totalWithPerf > 0 ? (lateCount / totalWithPerf) * 100 : 0;

  if (lateDeliveryRate > 40) {
    risks.push({
      type: 'Chronic Late Delivery',
      severity: 'medium',
      scoreImpact: 20,
      message: `Late delivery rate of ${lateDeliveryRate.toFixed(1)}% exceeds 40% threshold`,
    });
  }

  // 1.3 Long lead time compared to category average
  if (categoryAvgLeadTime > 0 && vendor.leadTime > categoryAvgLeadTime * 1.2) {
    risks.push({
      type: 'Extended Lead Time',
      severity: 'low',
      scoreImpact: 10,
      message: `Lead time of ${vendor.leadTime} days exceeds category average of ${categoryAvgLeadTime.toFixed(0)} days`,
    });
  }

  return risks;
}

/**
 * 2. PERFORMANCE RISK
 * Based on vendor ratings - overall score, quality metrics
 */
function calculatePerformanceRisks(ratings: VendorRating[]): RiskCategory[] {
  const risks: RiskCategory[] = [];

  if (ratings.length === 0) return risks;

  const avgOverall = ratings.reduce((s, r) => s + (r.overall ?? 0), 0) / ratings.length;
  const avgQuality = ratings.reduce((s, r) => s + (r.quality ?? 0), 0) / ratings.length;

  // 2.1 Low overall score (< 60)
  if (avgOverall < 60) {
    risks.push({
      type: 'Low Performance Score',
      severity: 'high',
      scoreImpact: 25,
      message: `Average performance score of ${avgOverall.toFixed(1)} is critically low`,
    });
  }
  // 2.2 Medium performance concern (60-75)
  else if (avgOverall >= 60 && avgOverall < 75) {
    risks.push({
      type: 'Moderate Performance',
      severity: 'medium',
      scoreImpact: 15,
      message: `Average performance score of ${avgOverall.toFixed(1)} indicates room for improvement`,
    });
  }

  // 2.3 Quality issue - quality score < 70
  if (avgQuality < 70) {
    risks.push({
      type: 'Quality Risk',
      severity: 'medium',
      scoreImpact: 10,
      message: `Average quality score of ${avgQuality.toFixed(1)} is below 70`,
    });
  }

  return risks;
}

/**
 * 3. CONTRACT RISK
 * Contract expiration and expired contracts with active POs
 */
function calculateContractRisks(vendor: Vendor, openPOCount: number): RiskCategory[] {
  const risks: RiskCategory[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const contractEnd = new Date(vendor.contractEnd);
  contractEnd.setHours(0, 0, 0, 0);

  const daysToExpiry = getDaysBetween(today, contractEnd);

  // 3.1 Contract expiring within 90 days
  if (daysToExpiry > 0 && daysToExpiry <= 90) {
    risks.push({
      type: 'Contract Expiring Soon',
      severity: 'medium',
      scoreImpact: 15,
      message: `Contract expires in ${daysToExpiry} days`,
    });
  }

  // 3.2 Contract expired but vendor still active with open POs
  if (daysToExpiry < 0 && vendor.status === 'active' && openPOCount > 0) {
    risks.push({
      type: 'Expired Contract with Active POs',
      severity: 'high',
      scoreImpact: 30,
      message: `Contract expired ${Math.abs(daysToExpiry)} days ago but vendor has ${openPOCount} open PO(s)`,
    });
  }

  return risks;
}

/**
 * 4. PROCUREMENT EXPOSURE RISK
 * Spend concentration, too many open POs, stuck POs
 */
function calculateExposureRisks(
  _vendor: Vendor,
  vendorPos: PurchaseOrder[],
  totalSpend: number,
  openPOCount: number
): RiskCategory[] {
  const risks: RiskCategory[] = [];

  const vendorSpend = vendorPos.reduce((s, po) => s + po.total, 0);
  const spendShare = totalSpend > 0 ? (vendorSpend / totalSpend) * 100 : 0;

  // 4.1 Spend concentration > 35%
  if (spendShare > 35) {
    risks.push({
      type: 'Supplier Dependency',
      severity: 'high',
      scoreImpact: 20,
      message: `${spendShare.toFixed(1)}% of total spend concentrated with this supplier`,
    });
  }

  // 4.2 Too many open POs (> 5)
  if (openPOCount > 5) {
    risks.push({
      type: 'High Open PO Count',
      severity: 'medium',
      scoreImpact: 15,
      message: `${openPOCount} open purchase orders`,
    });
  }

  // 4.3 Stuck POs - ordered > 14 days or confirmed > 21 days
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const stuckPOs = vendorPos.filter(po => {
    const poDate = new Date(po.date);
    poDate.setHours(0, 0, 0, 0);
    const daysSinceOrder = getDaysBetween(poDate, today);

    if (po.status === 'ordered' && daysSinceOrder > 14) return true;
    if (po.status === 'confirmed' && daysSinceOrder > 21) return true;
    return false;
  });

  if (stuckPOs.length > 0) {
    risks.push({
      type: 'Stuck Purchase Orders',
      severity: 'medium',
      scoreImpact: 10,
      message: `${stuckPOs.length} PO(s) stuck in ordered/confirmed status for extended period`,
    });
  }

  return risks;
}

/**
 * 5. HIGH VALUE EXPOSURE
 * PO totals exceeding 95th percentile
 */
function calculateHighValueRisks(
  vendorPos: PurchaseOrder[],
  allPos: PurchaseOrder[]
): RiskCategory[] {
  const risks: RiskCategory[] = [];

  if (allPos.length < 5) return risks;

  const allTotals = allPos.map(po => po.total);
  const p95 = getPercentile(allTotals, 95);

  const highValuePOs = vendorPos.filter(po => po.total > p95);

  if (highValuePOs.length > 0) {
    risks.push({
      type: 'High Value Exposure',
      severity: 'medium',
      scoreImpact: 10,
      message: `${highValuePOs.length} PO(s) exceed 95th percentile value ($${p95.toLocaleString()})`,
    });
  }

  return risks;
}

// ── Core Analysis Functions ───────────────────────────────────────────────

/**
 * Calculate risk for a single supplier
 */
export function getSupplierRisk(vendorId: string): NewSupplierRisk | null {
  const vendors = getVendors();
  const vendor = vendors.find(v => v.id === vendorId);

  if (!vendor) return null;

  const allPos = getPurchaseOrders();
  const vendorPos = allPos.filter(po => po.vendorId === vendorId);
  const ratings = getVendorRatings().filter(r => r.vendorId === vendorId);
  const perfMap = getDeliveryPerformance();

  const categoryAvgLeadTime = getCategoryAverageLeadTime(vendors, vendor.category);
  const totalSpend = allPos.reduce((s, po) => s + po.total, 0);
  const openPOCount = getOpenPOCountForVendor(vendorId);

  // Calculate all risk categories
  const deliveryRisks = calculateDeliveryRisks(vendor, vendorPos, perfMap, categoryAvgLeadTime);
  const performanceRisks = calculatePerformanceRisks(ratings);
  const contractRisks = calculateContractRisks(vendor, openPOCount);
  const exposureRisks = calculateExposureRisks(vendor, vendorPos, totalSpend, openPOCount);
  const highValueRisks = calculateHighValueRisks(vendorPos, allPos);

  // Combine all detected risks
  const detectedRisks: RiskCategory[] = [
    ...deliveryRisks,
    ...performanceRisks,
    ...contractRisks,
    ...exposureRisks,
    ...highValueRisks,
  ];

  // Calculate overall risk score (clamped 0-100)
  const rawScore = detectedRisks.reduce((sum, r) => sum + r.scoreImpact, 0);
  const overallRiskScore = Math.min(100, Math.max(0, rawScore));

  // Determine risk level based on thresholds
  let riskLevel: 'low' | 'medium' | 'high';
  if (overallRiskScore <= 30) {
    riskLevel = 'low';
  } else if (overallRiskScore <= 60) {
    riskLevel = 'medium';
  } else {
    riskLevel = 'high';
  }

  // Calculate late delivery rate for the supplier
  const completedPOs = vendorPos.filter(po => po.status === 'delivered' || po.status === 'invoiced');
  let lateCount = 0;
  completedPOs.forEach(po => {
    const perf = perfMap[po.id];
    if (perf && !perf.onTime) lateCount++;
  });
  const lateDeliveryRate = completedPOs.length > 0
    ? (lateCount / completedPOs.length) * 100
    : 0;

  // Calculate spend exposure percentage
  const vendorSpend = vendorPos.reduce((s, po) => s + po.total, 0);
  const spendExposure = totalSpend > 0 ? (vendorSpend / totalSpend) * 100 : 0;

  return {
    vendorId: vendor.id,
    vendorName: vendor.name,
    category: vendor.category,
    overallRiskScore,
    riskLevel,
    detectedRisks,
    spendExposure,
    openPOCount,
    lateDeliveryRate,
  };
}

/**
 * Get risks for all suppliers, sorted by highest risk first
 */
export function getSupplierRisks(): NewSupplierRisk[] {
  const vendors = getVendors();
  const risks: NewSupplierRisk[] = [];

  for (const vendor of vendors) {
    const risk = getSupplierRisk(vendor.id);
    if (risk) {
      risks.push(risk);
    }
  }

  // Sort by highest risk score first
  return risks.sort((a, b) => b.overallRiskScore - a.overallRiskScore);
}

/**
 * Get aggregate dashboard metrics for risk overview
 * Compatible with useAnimatedCounter() hook
 */
export function getRiskDashboardMetrics(): RiskDashboardMetrics {
  const risks = getSupplierRisks();
  const pos = getPurchaseOrders();

  const totalSuppliers = risks.length;
  const highRiskSuppliers = risks.filter(r => r.riskLevel === 'high').length;
  const mediumRiskSuppliers = risks.filter(r => r.riskLevel === 'medium').length;
  const lowRiskSuppliers = risks.filter(r => r.riskLevel === 'low').length;

  const averageRiskScore = risks.length > 0
    ? Math.round(risks.reduce((sum, r) => sum + r.overallRiskScore, 0) / risks.length)
    : 0;

  // Count high-severity risks as critical alerts
  const criticalAlerts = risks.reduce((sum, r) => {
    return sum + r.detectedRisks.filter(risk => risk.severity === 'high').length;
  }, 0);

  // Count overdue purchase orders across all suppliers
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const overduePOs = pos.filter(po => {
    if (po.status === 'delivered' || po.status === 'invoiced') return false;
    const deliveryDate = new Date(po.deliveryDate);
    deliveryDate.setHours(0, 0, 0, 0);
    return deliveryDate < today;
  }).length;

  return {
    totalSuppliers,
    highRiskSuppliers,
    mediumRiskSuppliers,
    lowRiskSuppliers,
    averageRiskScore,
    criticalAlerts,
    overduePOs,
  };
}

// ── Additional Helper Exports ─────────────────────────────────────────────

/**
 * Get suppliers filtered by risk level
 */
export function getSuppliersByRiskLevel(level: 'low' | 'medium' | 'high'): NewSupplierRisk[] {
  return getSupplierRisks().filter(r => r.riskLevel === level);
}

/**
 * Get count of suppliers at each risk level
 */
export function getRiskLevelCounts(): { low: number; medium: number; high: number } {
  const risks = getSupplierRisks();
  return {
    low: risks.filter(r => r.riskLevel === 'low').length,
    medium: risks.filter(r => r.riskLevel === 'medium').length,
    high: risks.filter(r => r.riskLevel === 'high').length,
  };
}

/**
 * Check if a specific vendor has any high-severity risks
 */
export function hasCriticalRisk(vendorId: string): boolean {
  const risk = getSupplierRisk(vendorId);
  if (!risk) return false;
  return risk.detectedRisks.some(r => r.severity === 'high');
}

/**
 * Get all risk types detected across all suppliers (unique)
 */
export function getAllDetectedRiskTypes(): string[] {
  const risks = getSupplierRisks();
  const typeSet = new Set<string>();
  risks.forEach(r => {
    r.detectedRisks.forEach(dr => typeSet.add(dr.type));
  });
  return Array.from(typeSet).sort();
}

/**
 * Force recalculation of all supplier risks
 * Useful for triggering re-renders in React components
 */
export function recalculateAllRisks(): NewSupplierRisk[] {
  return getSupplierRisks();
}

// ── Backward Compatibility Exports (Legacy) ─────────────────────────────────

/**
 * Legacy SupplierMetrics interface for backward compatibility with Delivery.tsx
 */
export interface LegacySupplierMetrics {
  vendorId: string;
  vendorName: string;
  vendor: Vendor;
  totalOrders: number;
  lateOrders: number;
  currentOverdueOrders: number;
  averageDelayDays: number;
  onTimeDeliveryRate: number;
  averageLeadTime: number;
  supplierOrderShare: number;
  supplierSpend: number;
  supplierSpendShare: number;
  vendorLeadTime: number;
  vendorScore: number;
  vendorRatingOverall: number | null;
  vendorRatingDelivery: number | null;
  vendorRatingQuality: number | null;
  vendorRatingCost: number | null;
  vendorRatingResponsiveness: number | null;
}

/**
 * Legacy SupplierRisk interface for backward compatibility with Delivery.tsx
 */
export interface LegacySupplierRisk {
  vendorId: string;
  vendorName: string;
  deliveryDelayRiskScore: number;
  leadTimeRiskScore: number;
  supplierDependencyRiskScore: number;
  costConcentrationRiskScore: number;
  supplierPerformanceRiskScore: number;
  overallRiskScore: number;
  riskLevel: 'Low' | 'Medium' | 'High';
  detectedRiskTypes: string[];
}

export interface LegacySupplierRiskEntry {
  metrics: LegacySupplierMetrics;
  risk: LegacySupplierRisk;
}

/**
 * Build legacy metrics for a single vendor
 */
function buildLegacyMetrics(vendor: Vendor, allPos: PurchaseOrder[], totalOrders: number, totalSpend: number, today: Date): LegacySupplierMetrics | null {
  const vendorPOs = allPos.filter(p => p.vendorId === vendor.id);
  if (vendorPOs.length === 0) return null;

  const perfMap = getDeliveryPerformance();

  // Late Orders
  let lateOrders = 0;
  const delayDaysArr: number[] = [];

  for (const po of vendorPOs) {
    const ext = po as PurchaseOrder & { actualDeliveryDate?: string };
    const isCompleted = po.status === 'delivered' || po.status === 'invoiced';

    if (isCompleted) {
      if (ext.actualDeliveryDate) {
        const actual = new Date(ext.actualDeliveryDate);
        const expected = new Date(po.deliveryDate);
        actual.setHours(0, 0, 0, 0);
        expected.setHours(0, 0, 0, 0);
        const diff = Math.floor((actual.getTime() - expected.getTime()) / 86400000);
        if (diff > 0) {
          lateOrders++;
          delayDaysArr.push(diff);
        }
      } else if (perfMap[po.id]) {
        const perf = perfMap[po.id];
        if (!perf.onTime && perf.daysDifference > 0) {
          lateOrders++;
          delayDaysArr.push(perf.daysDifference);
        }
      }
    }
  }

  // Current Overdue
  let currentOverdueOrders = 0;
  for (const po of vendorPOs) {
    if (po.status === 'delivered' || po.status === 'invoiced') continue;
    const deliveryDate = new Date(po.deliveryDate);
    deliveryDate.setHours(0, 0, 0, 0);
    const diff = Math.floor((today.getTime() - deliveryDate.getTime()) / 86400000);
    if (diff > 0) {
      currentOverdueOrders++;
      delayDaysArr.push(diff);
    }
  }

  const averageDelayDays = delayDaysArr.length > 0
    ? parseFloat((delayDaysArr.reduce((s, v) => s + v, 0) / delayDaysArr.length).toFixed(1))
    : 0;

  // On-Time Delivery Rate
  const completedPOs = vendorPOs.filter(p => p.status === 'delivered' || p.status === 'invoiced');
  let onTimeDeliveryRate = 100;
  if (completedPOs.length > 0) {
    const onTimeCount = Math.max(0, completedPOs.length - lateOrders);
    onTimeDeliveryRate = Math.round((onTimeCount / completedPOs.length) * 100);
  }

  // Average Lead Time
  const leadTimes: number[] = [];
  for (const po of vendorPOs) {
    const ext = po as PurchaseOrder & { actualDeliveryDate?: string };
    const start = new Date(po.date);
    start.setHours(0, 0, 0, 0);

    if (ext.actualDeliveryDate) {
      const end = new Date(ext.actualDeliveryDate);
      end.setHours(0, 0, 0, 0);
      leadTimes.push(Math.floor((end.getTime() - start.getTime()) / 86400000));
    } else if (po.deliveryDate) {
      const end = new Date(po.deliveryDate);
      end.setHours(0, 0, 0, 0);
      leadTimes.push(Math.floor((end.getTime() - start.getTime()) / 86400000));
    } else {
      leadTimes.push(Math.floor((today.getTime() - start.getTime()) / 86400000));
    }
  }
  const averageLeadTime = leadTimes.length > 0
    ? parseFloat((leadTimes.reduce((s, v) => s + v, 0) / leadTimes.length).toFixed(1))
    : 0;

  // Spend & Order Share
  const supplierSpend = vendorPOs.reduce((s, p) => s + (p.total || 0), 0);
  const supplierOrderShare = totalOrders > 0
    ? parseFloat(((vendorPOs.length / totalOrders) * 100).toFixed(1))
    : 0;
  const supplierSpendShare = totalSpend > 0
    ? parseFloat(((supplierSpend / totalSpend) * 100).toFixed(1))
    : 0;

  // Vendor Ratings
  const ratings = getVendorRatings();
  const legRating = ratings.find(r => r.vendorId === vendor.id);

  return {
    vendorId: vendor.id,
    vendorName: vendor.name,
    vendor,
    totalOrders: vendorPOs.length,
    lateOrders,
    currentOverdueOrders,
    averageDelayDays,
    onTimeDeliveryRate,
    averageLeadTime,
    supplierOrderShare,
    supplierSpend,
    supplierSpendShare,
    vendorLeadTime: vendor.leadTime || 7,
    vendorScore: vendor.score || 0,
    vendorRatingOverall: legRating?.overall ?? null,
    vendorRatingDelivery: legRating?.delivery ?? null,
    vendorRatingQuality: legRating?.quality ?? null,
    vendorRatingCost: legRating?.cost ?? null,
    vendorRatingResponsiveness: legRating?.responsiveness ?? null,
  };
}

/**
 * Build legacy risk from legacy metrics
 */
function buildLegacyRisk(metrics: LegacySupplierMetrics): LegacySupplierRisk {
  const vendors = getVendors();

  // 1. Delivery Delay Risk (max 30)
  let deliveryDelayRiskScore = 0;
  if (metrics.lateOrders === 1) deliveryDelayRiskScore += 8;
  else if (metrics.lateOrders === 2) deliveryDelayRiskScore += 15;
  else if (metrics.lateOrders >= 3) deliveryDelayRiskScore += 22;
  if (metrics.averageDelayDays >= 5) deliveryDelayRiskScore += 5;
  if (metrics.currentOverdueOrders >= 1) deliveryDelayRiskScore += 3;
  if (metrics.onTimeDeliveryRate < 80) deliveryDelayRiskScore += 3;
  deliveryDelayRiskScore = Math.min(deliveryDelayRiskScore, 30);

  // 2. Lead Time Risk (max 20)
  let leadTimeRiskScore = 0;
  const avgLT = metrics.averageLeadTime;
  if (avgLT <= 7) leadTimeRiskScore = 0;
  else if (avgLT <= 14) leadTimeRiskScore = 8;
  else if (avgLT <= 21) leadTimeRiskScore = 14;
  else leadTimeRiskScore = 18;
  if (metrics.averageLeadTime > metrics.vendorLeadTime * 1.25) {
    leadTimeRiskScore += 2;
  }
  leadTimeRiskScore = Math.min(leadTimeRiskScore, 20);

  // 3. Supplier Dependency Risk (max 20)
  let supplierDependencyRiskScore = 0;
  const orderShare = metrics.supplierOrderShare;
  if (orderShare < 30) supplierDependencyRiskScore = 0;
  else if (orderShare <= 50) supplierDependencyRiskScore = 8;
  else if (orderShare <= 70) supplierDependencyRiskScore = 14;
  else supplierDependencyRiskScore = 18;

  const activeVendorsInCategory = vendors.filter(
    v => v.category === metrics.vendor.category && v.status === 'active' && v.id !== metrics.vendorId
  );
  if (metrics.vendor.status === 'active' && activeVendorsInCategory.length === 0) {
    supplierDependencyRiskScore += 2;
  }
  supplierDependencyRiskScore = Math.min(supplierDependencyRiskScore, 20);

  // 4. Cost Concentration Risk (max 15)
  let costConcentrationRiskScore = 0;
  const spendShare = metrics.supplierSpendShare;
  if (spendShare < 25) costConcentrationRiskScore = 0;
  else if (spendShare <= 40) costConcentrationRiskScore = 5;
  else if (spendShare <= 60) costConcentrationRiskScore = 10;
  else costConcentrationRiskScore = 15;
  costConcentrationRiskScore = Math.min(costConcentrationRiskScore, 15);

  // 5. Supplier Performance Risk (max 15)
  let supplierPerformanceRiskScore = 0;
  if (metrics.vendorRatingOverall !== null || metrics.vendorRatingDelivery !== null) {
    if (metrics.vendorRatingOverall !== null) {
      if (metrics.vendorRatingOverall >= 70 && metrics.vendorRatingOverall < 85) {
        supplierPerformanceRiskScore += 5;
      } else if (metrics.vendorRatingOverall < 70) {
        supplierPerformanceRiskScore += 8;
      }
    }
    if (metrics.vendorRatingDelivery !== null) {
      if (metrics.vendorRatingDelivery >= 70 && metrics.vendorRatingDelivery < 85) {
        supplierPerformanceRiskScore += 4;
      } else if (metrics.vendorRatingDelivery < 70) {
        supplierPerformanceRiskScore += 7;
      }
    }
  } else if (metrics.vendorScore > 0) {
    if (metrics.vendorScore >= 70 && metrics.vendorScore < 85) {
      supplierPerformanceRiskScore += 5;
    } else if (metrics.vendorScore < 70) {
      supplierPerformanceRiskScore += 8;
    }
  } else {
    if (metrics.onTimeDeliveryRate < 80) supplierPerformanceRiskScore += 6;
    if (metrics.averageDelayDays >= 5) supplierPerformanceRiskScore += 5;
    if (metrics.lateOrders >= 3) supplierPerformanceRiskScore += 4;
  }
  supplierPerformanceRiskScore = Math.min(supplierPerformanceRiskScore, 15);

  const overallRiskScore = Math.min(
    100,
    deliveryDelayRiskScore +
      leadTimeRiskScore +
      supplierDependencyRiskScore +
      costConcentrationRiskScore +
      supplierPerformanceRiskScore
  );

  let riskLevel: 'Low' | 'Medium' | 'High';
  if (overallRiskScore <= 39) riskLevel = 'Low';
  else if (overallRiskScore <= 69) riskLevel = 'Medium';
  else riskLevel = 'High';

  const detectedRiskTypes: string[] = [];
  if (deliveryDelayRiskScore >= 15) detectedRiskTypes.push('Delivery Delay Risk');
  if (leadTimeRiskScore >= 8) detectedRiskTypes.push('Lead Time Risk');
  if (supplierDependencyRiskScore >= 8) detectedRiskTypes.push('Supplier Dependency Risk');
  if (costConcentrationRiskScore >= 5) detectedRiskTypes.push('Cost Concentration Risk');
  if (supplierPerformanceRiskScore >= 5) detectedRiskTypes.push('Supplier Performance Risk');

  return {
    vendorId: metrics.vendorId,
    vendorName: metrics.vendorName,
    deliveryDelayRiskScore,
    leadTimeRiskScore,
    supplierDependencyRiskScore,
    costConcentrationRiskScore,
    supplierPerformanceRiskScore,
    overallRiskScore,
    riskLevel,
    detectedRiskTypes,
  };
}

/**
 * Legacy function for backward compatibility with Delivery.tsx
 * Returns array of { metrics, risk } sorted by highest risk first
 */
export function buildSupplierRiskData(): LegacySupplierRiskEntry[] {
  const vendors = getVendors();
  const allPos = getPurchaseOrders();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const totalOrders = allPos.length;
  const totalSpend = allPos.reduce((s, p) => s + (p.total || 0), 0);

  const results: LegacySupplierRiskEntry[] = [];

  for (const vendor of vendors) {
    const metrics = buildLegacyMetrics(vendor, allPos, totalOrders, totalSpend, today);
    if (metrics) {
      const risk = buildLegacyRisk(metrics);
      results.push({ metrics, risk });
    }
  }

  return results.sort((a, b) => b.risk.overallRiskScore - a.risk.overallRiskScore);
}

// Type aliases for backward compatibility
export type SupplierMetrics = LegacySupplierMetrics;
export type SupplierRisk = LegacySupplierRisk;
export type SupplierRiskEntry = LegacySupplierRiskEntry;
