/**
 * AnalyticsSection - Enhanced Analytics Visualizations
 * Features: Combo Chart (actual vs budget) and Treemap (vendor spend concentration)
 * Implements data-driven insights for procurement governance
 */

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Treemap,
  Cell,
} from "recharts";

interface ProcurementValue {
  month: string;
  month_label: string;
  value: number;
}

interface VendorActivity {
  id: number;
  name: string;
  order_count: number;
  total_value: number;
}

interface AnalyticsSectionProps {
  procurementValue: ProcurementValue[];
  vendorActivity: VendorActivity[];
}

// Color palette for Treemap
const TREEMAP_COLORS = [
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#f59e0b",
  "#10b981",
  "#06b6d4",
  "#6366f1",
  "#ef4444",
];

/**
 * Generate mock budget data (in real implementation, would come from API)
 */
function generateBudgetData(
  procurementValue: ProcurementValue[]
): Array<{ month_label: string; actual: number; budget: number }> {
  return procurementValue.map((item) => ({
    month_label: item.month_label,
    actual: item.value,
    // Mock budget: 120% of current actual for demo
    budget: item.value * 1.2,
  }));
}

export default function AnalyticsSection({
  procurementValue,
  vendorActivity,
}: AnalyticsSectionProps) {
  const comboData = generateBudgetData(procurementValue);

  // Prepare Treemap data with size and depth
  // Ensure each treemap node has a unique `name` (used internally by recharts)
  // while keeping the original vendor name available as `displayName` for labels.
  const treemapData = vendorActivity.map((vendor, index) => ({
    // make name unique by appending the id
    name: `${vendor.name}-${vendor.id}`,
    displayName: vendor.name,
    value: vendor.total_value,
    depth: 1,
    fill: TREEMAP_COLORS[index % TREEMAP_COLORS.length],
  }));

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {/* ===== COMBO CHART: Actual vs Budget ===== */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Monthly Spend vs Budget
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Actual procurement value vs approved budget allocation
          </p>
        </div>

        <ResponsiveContainer width="100%" height={300} className="mt-6">
          <ComposedChart data={comboData}>
            <defs>
              <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="month_label"
              stroke="#94a3b8"
              style={{ fontSize: "12px" }}
            />
            <YAxis
              stroke="#94a3b8"
              style={{ fontSize: "12px" }}
              tickFormatter={(value) => `₹${value / 1000000}M`}
            />
            <Tooltip
              formatter={(value) =>
                typeof value === "number" ? `₹${(value / 100000).toFixed(1)}L` : value
              }
              contentStyle={{
                backgroundColor: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
              }}
            />
            <Legend
              wrapperStyle={{ paddingTop: "20px" }}
              iconType="line"
            />

            {/* Budget as line */}
            <Line
              type="monotone"
              dataKey="budget"
              stroke="#94a3b8"
              name="Budget Allocation"
              strokeWidth={2}
              dot={{ fill: "#94a3b8", r: 4 }}
              activeDot={{ r: 6 }}
              strokeDasharray="5 5"
            />

            {/* Actual as bar */}
            <Bar
              dataKey="actual"
              fill="url(#colorActual)"
              name="Actual Spend"
              radius={[8, 8, 0, 0]}
            />
          </ComposedChart>
        </ResponsiveContainer>

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {comboData.length > 0
                ? (
                    comboData.reduce((sum, item) => sum + item.actual, 0) /
                    comboData.length /
                    100000
                  ).toFixed(1)
                : "0"}
              L
            </div>
            <div className="text-xs text-slate-600 mt-1">Avg Monthly Spend</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-slate-600">
              {comboData.length > 0
                ? Math.round(
                    (comboData.reduce((sum, item) => sum + item.actual, 0) /
                      comboData.reduce((sum, item) => sum + item.budget, 0)) *
                      100
                  )
                : "0"}
              %
            </div>
            <div className="text-xs text-slate-600 mt-1">Budget Utilization</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-emerald-600">
              {comboData.length > 0
                ? (
                    comboData.reduce((sum, item) => sum + (item.budget - item.actual), 0) /
                    100000
                  ).toFixed(1)
                : "0"}
              L
            </div>
            <div className="text-xs text-slate-600 mt-1">Remaining Budget</div>
          </div>
        </div>
      </div>

      {/* ===== TREEMAP: Vendor Spend Concentration ===== */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Vendor Spend Concentration
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Relative size = total spend by vendor (identifies supplier dependency)
          </p>
        </div>

        <ResponsiveContainer width="100%" height={300} className="mt-6">
          <Treemap
            data={treemapData}
            dataKey="value"
            stroke="white"
            fill="#8884d8"
            content={<CustomTreeNode />}
          >
            {treemapData.map((item, index) => (
              <Cell key={`cell-${index}`} fill={item.fill} />
            ))}
          </Treemap>
        </ResponsiveContainer>

        {/* Vendor List */}
        <div className="mt-6 pt-4 border-t">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Top 5 Vendors</h3>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {vendorActivity.slice(0, 5).map((vendor, index) => {
              const totalSpend = vendorActivity.reduce(
                (sum, v) => sum + v.total_value,
                0
              );
              const percentage = Math.round(
                (vendor.total_value / totalSpend) * 100
              );

              return (
                <div key={vendor.id} className="flex items-center gap-3">
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: TREEMAP_COLORS[index % TREEMAP_COLORS.length] }}
                  />
                  <div className="flex-1">
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-slate-900 truncate">
                        {vendor.name}
                      </span>
                      <span className="text-sm font-bold text-slate-700">
                        {percentage}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-slate-200 rounded-full mt-1.5 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${percentage}%`,
                          backgroundColor:
                            TREEMAP_COLORS[index % TREEMAP_COLORS.length],
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Custom Treemap node renderer with labels and values
 */
function CustomTreeNode(props: any) {
  const { x, y, width, height, name, value, payload } = props;

  if (width < 50 || height < 40) {
    return null; // Don't render labels for very small boxes
  }
  // Prefer the original vendor name for label if available
  const displayName = (payload && payload.displayName) || name;
  const truncatedName = displayName.length > 15 ? displayName.substring(0, 12) + "..." : displayName;
  const valueInL = (value / 100000).toFixed(0);

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        style={{ outline: "none" }}
      />
      <text
        x={x + width / 2}
        y={y + height / 2 - 10}
        textAnchor="middle"
        fill="#fff"
        fontSize={12}
        fontWeight="bold"
      >
        {truncatedName}
      </text>
      <text
        x={x + width / 2}
        y={y + height / 2 + 10}
        textAnchor="middle"
        fill="#fff"
        fontSize={11}
        opacity={0.8}
      >
        ₹{valueInL}L
      </text>
    </g>
  );
}
