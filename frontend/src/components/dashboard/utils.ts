/**
 * Procurement Analytics Utilities
 * Calculations for 2026 UX best practices including leading indicators
 */

export interface MaverickSpendData {
  maverick_spend: number;
  total_spend: number;
  percentage: number;
}

export interface CycleTimeData {
  average_cycle_time_days: number;
  variance: number;
  on_time_percentage: number;
}

export interface LeadingIndicators {
  cycleTime: CycleTimeData;
  maverickSpend: MaverickSpendData;
}

/**
 * Calculate average PO Cycle Time (days from indent to approval)
 * Used as a leading indicator for supplier reliability
 */
export function calculateCycleTime(
  indents: any[],
  pos: any[]
): CycleTimeData {
  if (indents.length === 0)
    return { average_cycle_time_days: 0, variance: 0, on_time_percentage: 0 };

  // Group POs by associated indents
  const cycleTimes: number[] = [];
  const onTimeCount = indents.filter((indent) => {
    const associatedPO = pos.find((po) => po.indent_id === indent.id);
    if (!associatedPO) return false;

    const indentDate = new Date(indent.indent_date).getTime();
    const poDate = new Date(associatedPO.order_date).getTime();
    const days = Math.floor((poDate - indentDate) / (1000 * 60 * 60 * 24));

    cycleTimes.push(days);
    return days <= 5; // Assuming 5 days is "on-time"
  }).length;

  const average =
    cycleTimes.length > 0
      ? cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length
      : 0;

  const variance =
    cycleTimes.length > 0
      ? Math.sqrt(
          cycleTimes.reduce((sum, time) => sum + Math.pow(time - average, 2), 0) /
            cycleTimes.length
        )
      : 0;

  return {
    average_cycle_time_days: Math.round(average * 10) / 10,
    variance: Math.round(variance * 10) / 10,
    on_time_percentage: Math.round((onTimeCount / indents.length) * 100),
  };
}

/**
 * Calculate Maverick Spend % (spend outside approved contracts)
 * Leading indicator for procurement compliance
 */
export function calculateMaverickSpend(
  pos: any[],
  approvedVendors: any[] = []
): MaverickSpendData {
  if (pos.length === 0) return { maverick_spend: 0, total_spend: 0, percentage: 0 };

  const totalSpend = pos.reduce((sum, po) => sum + (po.total_value || 0), 0);

  // If no approved vendors list, consider all vendors as approved
  let approvedSpend = totalSpend;
  if (approvedVendors.length > 0) {
    const approvedVendorIds = approvedVendors.map((v) => v.id);
    approvedSpend = pos
      .filter((po) => approvedVendorIds.includes(po.vendor_id))
      .reduce((sum, po) => sum + (po.total_value || 0), 0);
  }

  const maverickSpend = totalSpend - approvedSpend;
  const percentage = totalSpend > 0 ? Math.round((maverickSpend / totalSpend) * 100) : 0;

  return {
    maverick_spend: maverickSpend,
    total_spend: totalSpend,
    percentage,
  };
}

/**
 * Calculate days until due from expected delivery date
 */
export function calculateDaysUntilDue(expectedDeliveryDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dueDate = new Date(expectedDeliveryDate);
  dueDate.setHours(0, 0, 0, 0);

  const diffTime = dueDate.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Determine alert type based on days until due
 */
export function getAlertType(
  daysUntilDue: number,
  status: string
): "delayed" | "due_today" | "due_soon" | "on_track" {
  if (status === "delayed") return "delayed";
  if (daysUntilDue < 0) return "delayed";
  if (daysUntilDue === 0) return "due_today";
  if (daysUntilDue <= 3) return "due_soon";
  return "on_track";
}

/**
 * Format currency based on Indian numbering system
 */
export function formatCurrency(value: number, unit: "L" | "Cr" = "L"): string {
  if (unit === "Cr") {
    return `₹${(value / 10000000).toFixed(2)}Cr`;
  }
  return `₹${(value / 100000).toFixed(1)}L`;
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(text: string, maxLength: number = 30): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
}

/**
 * Generate sparkline data (minimal historical context)
 * In real implementation, this would come from API
 */
export function generateSparklineData(
  months: number = 6
): Array<{ month: string; value: number }> {
  // This function is deprecated - use component-level calculated sparklines instead
  const data: Array<{ month: string; value: number }> = [];
  const today = new Date();

  for (let i = months - 1; i >= 0; i--) {
    const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const month = date.toLocaleString("default", { month: "short" });
    data.push({ month, value: 0 });
  }

  return data;
}
