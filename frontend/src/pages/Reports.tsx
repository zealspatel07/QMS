//src/pages/Reports.tsx
import { useEffect, useState } from "react";
import Layout from "../components/layout/Layout";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import {
  BarChart3,
  PieChart as PieIcon,
  TrendingUp,
  Users,
  Package,
  Download,
  Target,
  Award,
  Zap,
} from "lucide-react";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";

/* ===================== TYPES ===================== */

interface KPI {
  total_quotations: number;
  won: number;
  lost: number;
  pending: number;
  win_rate: number;
  total_value: number;
  avg_deal_size: number;
}

interface SalesPerformance {
  user_id: number;
  name: string;
  total_quotations: number;
  won: number;
  lost: number;
  win_rate: number;
  revenue: number;
}

interface CustomerReport {
  id: number;
  company_name: string;
  quotations: number;
  won: number;
  revenue: number;
  last_deal: string | null;
}

interface ProductReport {
  name: string;
  quantity: number;
  revenue: number;
}

interface PipelineItem {
  status: string;
  count: number;
  value: number;
}

interface UserMetrics {
  user_id: number;
  name: string;
  email?: string;
  total_quotations: number;
  won: number;
  lost: number;
  pending: number;
  win_rate: number;
  total_revenue: number;
  avg_deal_size: number;
  conversion_rate: number;
  deals_closed_this_month: number;
  revenue_this_month: number;
  ranking?: number;
  trend?: number; // percentage change
}

interface TimeseriesData {
  period: string;
  revenue: number;
  deals: number;
  won: number;
}


/* ===================== COMPONENT ===================== */

export default function Reports() {
  const { permissions, user } = useAuth();
  const [activeTab, setActiveTab] = useState<
    "personal" | "team" | "customers" | "products" | "pipeline" | "advanced"
  >("personal");

  const [timeRange, setTimeRange] = useState<"week" | "month" | "quarter" | "year">("month");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [kpis, setKpis] = useState<KPI | null>(null);
  const [userMetrics, setUserMetrics] = useState<UserMetrics | null>(null);
  const [sales, setSales] = useState<SalesPerformance[]>([]);
  const [customers, setCustomers] = useState<CustomerReport[]>([]);
  const [products, setProducts] = useState<ProductReport[]>([]);
  const [pipeline, setPipeline] = useState<PipelineItem[]>([]);
  const [timeseriesData, setTimeseriesData] = useState<TimeseriesData[]>([]);

  /* ===================== LOAD DATA ===================== */

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [
          kpiRes,
          salesRes,
          customerRes,
          productRes,
          pipelineRes,
        ] = await Promise.all([
          api.getReportKpis?.(),
          api.getReportSalesPerformance?.(),
          api.getReportCustomers?.(),
          api.getReportProducts?.(),
          api.getReportPipeline?.(),
        ]);

        setKpis(kpiRes ?? null);
        setSales(salesRes?.data || []);
        setCustomers(customerRes?.data || []);
        setProducts(productRes?.data || []);
        setPipeline(pipelineRes?.data || []);

        // Generate timeseries data for current user (mock for demo)
        const timeseriesRes = await api.getReportTimeseries(timeRange);
        setTimeseriesData(timeseriesRes?.data || []);

        // Set user metrics based on sales data and current user
        if (user && salesRes?.data) {
          const currentUserData = salesRes.data.find(
            (s: any) => s.user_id === user.id || s.name === user.name
          );
          if (currentUserData) {
            const userMetricsRes = await api.getReportUserMetrics();
            setUserMetrics(userMetricsRes);
          }
        }
      } catch (e: any) {
        setError(e.message || "Failed to load reports");
      } finally {
        setLoading(false);
      }
    })();
  }, [user, timeRange]);

  /* ===================== HELPERS ===================== */



  function getRanking(sales: SalesPerformance[]): SalesPerformance[] {
    return [...sales]
      .sort((a, b) => b.revenue - a.revenue)
      .map((s, i) => ({
        ...s,
        ranking: i + 1,
      }));
  }

  /* ===================== DERIVED DATA ===================== */

  // Removed unused memoized values - calculated inline when needed

  /* ===================== CSV EXPORT HELPERS ===================== */

  function downloadCSV(data: any[], filename: string) {
    if (!data.length) {
      alert("No data to export");
      return;
    }

    const keys = Object.keys(data[0]);
    const header = keys.join(",");
    const rows = data.map((row) =>
      keys
        .map((key) => {
          const value = String(row[key] ?? "");
          return `"${value.replace(/"/g, '""')}"`;
        })
        .join(",")
    );

    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function handleExportCustomers() {
    const data = customers.map((c) => ({
      company_name: c.company_name,
      quotations: c.quotations,
      won: c.won,
      revenue: c.revenue,
      last_deal: c.last_deal ? new Date(c.last_deal).toLocaleDateString() : "—",
    }));
    downloadCSV(data, "customers_report");
  }

  function handleExportProducts() {
    const data = products.map((p) => ({
      name: p.name,
      quantity: p.quantity,
      revenue: p.revenue,
    }));
    downloadCSV(data, "products_report");
  }

  /* ===================== STATES ===================== */

  if (loading) {
    return (
      <Layout>
        <div className="h-screen flex items-center justify-center text-gray-600">
          Loading enterprise reports…
        </div>
      </Layout>
    );
  }

  /* ===================== UI ===================== */

  return (
    <Layout>
      <div className="w-full min-h-screen bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-[1600px] mx-auto px-4 py-6">
          {/* Header - Compact and Professional */}
          <div className="mb-6 flex items-center justify-between pb-4 border-b border-gray-200">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
                {permissions.isAdmin ? "Analytics" : "📈 Your Performance"}
              </h1>
              <p className="text-gray-500 mt-1 text-xs font-medium">
                {permissions.isAdmin
                  ? "Real-time business intelligence"
                  : `Metrics for ${user?.name || "you"}`}
              </p>
            </div>
            <div className="flex gap-1 flex-wrap justify-end">
              {["week", "month", "quarter", "year"].map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range as any)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-300 ${
                    timeRange === range
                      ? "bg-indigo-600 text-white shadow-md"
                      : "bg-white text-gray-700 border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50"
                  }`}
                >
                  {range.charAt(0).toUpperCase() + range.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Tabs - Compact */}
          <div className="flex gap-1 mb-6 overflow-x-auto pb-2 scrollbar-hide">
            {(permissions.isAdmin
              ? [
                ["personal", "My Performance", Zap],
                ["team", "Team Leaderboard", Award],
                ["customers", "Customers", Users],
                ["products", "Products", Package],
                ["pipeline", "Pipeline", PieIcon],
                ["advanced", "Advanced Analytics", BarChart3],
              ]
              : [
                ["personal", "My Performance", Zap],
                ["customers", "Key Customers", Users],
                ["products", "Products", Package],
                ["pipeline", "My Pipeline", PieIcon],
                ["advanced", "Analytics", BarChart3],
              ]
            ).map(([id, label, Icon]: any) => (
              <button
                key={id}
                onClick={() => setActiveTab(id as any)}
                className={`flex items-center gap-2 px-3 py-2 rounded-md font-medium text-xs transition-all duration-300 whitespace-nowrap ${
                  activeTab === id
                    ? "bg-indigo-600 text-white shadow-md"
                    : "bg-white text-gray-700 border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50"
                }`}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 p-3 rounded-lg mb-4 text-red-700 text-sm font-medium">
              ⚠️ {error}
            </div>
          )}

          {loading ? (
            <div className="h-64 flex items-center justify-center text-gray-600">
              <div className="text-center">
                <div className="animate-spin w-8 h-8 border-3 border-gray-300 border-t-indigo-600 rounded-full mx-auto mb-3"></div>
                <p className="text-sm font-medium">Loading analytics…</p>
              </div>
            </div>
          ) : (
            <>
              {/* ===================== PERSONAL ===================== */}
              {activeTab === "personal" && userMetrics && (
                <PersonalPerformance metrics={userMetrics} timeRange={timeRange} timeseries={timeseriesData} />
              )}

              {/* ===================== TEAM ===================== */}
              {activeTab === "team" && permissions.isAdmin && (
                <TeamLeaderboard sales={getRanking(sales)} />
              )}

              {/* ===================== CUSTOMERS ===================== */}
              {activeTab === "customers" && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">Customer Performance</h3>
                      <p className="text-sm text-gray-600">Revenue by customer account</p>
                    </div>
                    {permissions.isAdmin && (
                      <button
                        onClick={handleExportCustomers}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                      >
                        <Download size={16} /> Export as CSV
                      </button>
                    )}
                  </div>
                  <Table
                    headers={["Customer", "Quotations", "Won", "Revenue", "Last Deal"]}
                    rows={customers.map((c) => [
                      c.company_name,
                      c.quotations,
                      c.won,
                      `₹${c.revenue.toLocaleString()}`,
                      c.last_deal ? new Date(c.last_deal).toLocaleDateString() : "—",
                    ])}
                    empty="No customer data available"
                  />
                </div>
              )}

              {/* ===================== PRODUCTS ===================== */}
              {activeTab === "products" && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">Product Performance</h3>
                      <p className="text-sm text-gray-600">Revenue and units sold by product</p>
                    </div>
                    {permissions.isAdmin && (
                      <button
                        onClick={handleExportProducts}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                      >
                        <Download size={16} /> Export as CSV
                      </button>
                    )}
                  </div>
                  <Table
                    headers={["Product", "Qty Sold", "Revenue"]}
                    rows={products.map((p) => [
                      p.name,
                      p.quantity,
                      `₹${p.revenue.toLocaleString()}`,
                    ])}
                    empty="No product data available"
                  />
                </div>
              )}

              {/* ===================== PIPELINE ===================== */}
              {activeTab === "pipeline" && (
                <div className="space-y-4">

                  {/* ===== EXECUTIVE SUMMARY ===== */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">

                    <Stat
                      title="Total Pipeline Value"
                      value={`₹${pipeline.reduce((s, p) => s + Number(p.value || 0), 0).toLocaleString()}`}
                      icon={BarChart3}
                    />

                    <Stat
                      title="Won Revenue"
                      value={`₹${(pipeline.find(p => p.status?.toLowerCase() === "won")?.value || 0).toLocaleString()}`}
                      icon={Award}
                      trend={kpis?.win_rate}
                    />

                    <Stat
                      title="Active (Pending)"
                      value={`₹${(pipeline.find(p => p.status?.toLowerCase() === "pending")?.value || 0).toLocaleString()}`}
                      icon={Target}
                    />

                    <Stat
                      title="Overall Conversion"
                      value={`${kpis?.win_rate ?? 0}%`}
                      icon={TrendingUp}
                      trend={kpis?.win_rate}
                    />
                  </div>

                  {/* ===== OPERATIONAL BREAKDOWN (COUNT) ===== */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <PipelineStat
                      label="Total Quotations"
                      value={pipeline.reduce((s, p) => s + p.count, 0)}
                    />

                    <PipelineStat
                      label="Won Quotations"
                      value={pipeline.find(p => p.status?.toLowerCase() === "won")?.count ?? 0}
                    />

                    <PipelineStat
                      label="Pending Quotations"
                      value={pipeline.find(p => p.status?.toLowerCase() === "pending")?.count ?? 0}
                    />

                    <PipelineStat
                      label="Lost Quotations"
                      value={pipeline.find(p => p.status?.toLowerCase() === "lost")?.count ?? 0}
                    />
                  </div>

                  {/* ===== SALES FUNNEL ===== */}
                  <div className="bg-white rounded-lg p-4 shadow-sm border">

                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          Sales Funnel
                        </h3>
                        <p className="text-xs text-gray-500">
                          Distribution across pipeline stages
                        </p>
                      </div>

                      <div className="text-xs text-gray-400">
                        Cumulative values
                      </div>
                    </div>

                    <div className="space-y-4">
                      {pipeline.map((p) => {
                        const totalValue = pipeline.reduce(
                          (s, x) => s + Number(x.value || 0),
                          0
                        );

                        const percentage =
                          totalValue > 0
                            ? Math.round((Number(p.value || 0) / totalValue) * 100)
                            : 0;

                        const status = p.status?.toLowerCase();

                        const colorMap: Record<string, string> = {
                          won: "bg-green-500",
                          pending: "bg-blue-500",
                          lost: "bg-red-500",
                        };

                        const bg = colorMap[status] || "bg-gray-400";

                        return (
                          <div key={p.status} className="space-y-1">

                            {/* LABEL ROW */}
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium capitalize text-gray-900 text-sm">
                                  {p.status}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {p.count} quotations
                                </p>
                              </div>

                              <div className="text-right">
                                <p className="font-semibold text-gray-900 text-sm">
                                  ₹{Number(p.value || 0).toLocaleString()}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {percentage}%
                                </p>
                              </div>
                            </div>

                            {/* BAR */}
                            <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                style={{ width: `${percentage}%` }}
                                className={`h-full rounded-full transition-all ${bg}`}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* ===== INTERPRETATION / GUIDANCE ===== */}
                  <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                    <h4 className="text-xs font-semibold text-indigo-900 mb-2 uppercase tracking-wide">
                      How to Read This
                    </h4>
                    <p className="text-xs text-indigo-800 leading-relaxed space-y-1">
                      <div>• <strong>Pending</strong> represents active opportunities requiring follow-ups.</div>
                      <div>• <strong>Won</strong> indicates confirmed revenue contribution.</div>
                      <div>• <strong>Lost</strong> helps assess pipeline leakage and sales effectiveness.</div>
                      <div>Improving early follow-ups and reducing stale quotations directly increases conversion.</div>
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
                    <_InsightCard
                      title="Pipeline Risk"
                      value="High pending value"
                      tone="warning"
                    />

                    <_InsightCard
                      title="Revenue Strength"
                      value="Won deals contributing stable flow"
                      tone="success"
                    />

                    <_InsightCard
                      title="Action Required"
                      value="Focus on expiring quotations"
                      tone="info"
                    />
                  </div>

                </div>
              )}


              {/* ===================== ADVANCED ANALYTICS ===================== */}
              {activeTab === "advanced" && (
                <AdvancedAnalytics
                  userMetrics={userMetrics}
                  timeseries={timeseriesData}
                  pipeline={pipeline}
                />
              )}
            </>
          )}

        </div>
      </div>
    </Layout>
  );
}

/* ===================== REUSABLE COMPONENTS ===================== */

// Personal Performance Dashboard
function PersonalPerformance({ metrics, timeseries }: any) {
  // Format period from 2026-04 to 2026-apr
  const formatPeriod = (period: string) => {
    if (!period) return period;
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const parts = period.split('-');
    if (parts.length === 2) {
      const year = parts[0];
      const monthNum = parseInt(parts[1]) - 1;
      return `${year}-${months[monthNum]}`;
    }
    return period;
  };

  const formattedTimeseries = timeseries.map((item: any) => ({
    ...item,
    period: formatPeriod(item.period)
  }));

  return (
    <div className="space-y-4">
      {/* Hero KPIs - Compact */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <PerformanceCard
          label="Total Revenue"
          value={`₹${metrics.total_revenue.toLocaleString()}`}
          subtext={`+${metrics.trend?.toFixed(1) || 0}% this period`}
          icon={TrendingUp}
          color="indigo"
        />
        <PerformanceCard
          label="Deals Won"
          value={metrics.won}
          subtext={`${metrics.win_rate}% win rate`}
          icon={Award}
          color="green"
        />
        <PerformanceCard
          label="Avg Deal Size"
          value={`₹${(metrics.avg_deal_size / 1000).toFixed(1)}K`}
          subtext={`${metrics.total_quotations} quotations`}
          icon={BarChart3}
          color="purple"
        />
        <PerformanceCard
          label="Conversion Rate"
          value={`${metrics.conversion_rate.toFixed(1)}%`}
          subtext={`${metrics.lost} deals lost`}
          icon={Target}
          color="orange"
        />
      </div>

      {/* Revenue Trend Chart - Eye-catching */}
      <div className="bg-gradient-to-br from-white to-slate-50 rounded-xl p-4 shadow-md border border-gray-200 hover:shadow-lg hover:border-indigo-200 transition-all duration-300">
        <div className="mb-4">
          <h3 className="text-lg font-bold text-gray-900">📈 Revenue Growth</h3>
          <p className="text-gray-600 text-xs mt-1">Monthly progress with growth trajectory</p>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart 
            data={formattedTimeseries}
            margin={{ top: 20, right: 30, left: 0, bottom: 20 }}
          >
            <defs>
              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.5}/>
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
              </linearGradient>
              <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.3" floodColor="#6366f1" />
              </filter>
            </defs>
            <CartesianGrid 
              strokeDasharray="4 4" 
              stroke="#c7d2fe"
              opacity={0.5}
              verticalPoints={[]}
            />
            <XAxis 
              dataKey="period"
              tick={{ fill: '#4f46e5', fontSize: 12, fontWeight: 500 }}
              axisLine={{ stroke: '#e0e7ff', strokeWidth: 2 }}
              tickLine={{ stroke: '#e0e7ff' }}
            />
            <YAxis 
              tick={{ fill: '#4f46e5', fontSize: 12, fontWeight: 500 }}
              axisLine={{ stroke: '#e0e7ff', strokeWidth: 2 }}
              tickLine={{ stroke: '#e0e7ff' }}
              width={60}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#ffffff',
                border: '2px solid #6366f1',
                borderRadius: '12px',
                boxShadow: '0 10px 25px rgba(99, 102, 241, 0.2)',
                padding: '12px 16px'
              }}
              cursor={{ stroke: '#6366f1', strokeWidth: 2, opacity: 0.3 }}
              formatter={(value: any) => [
                `₹${typeof value === 'number' ? (value / 1000).toFixed(1) : value}K`,
                'Revenue'
              ]}
              labelStyle={{ color: '#6366f1', fontWeight: 'bold', fontSize: 13 }}
            />
            <Line
              type="natural"
              dataKey="revenue"
              stroke="#6366f1"
              strokeWidth={4}
              dot={{ fill: '#6366f1', r: 7, strokeWidth: 3, stroke: '#ffffff', filter: 'url(#shadow)' }}
              activeDot={{ r: 10, strokeWidth: 2, filter: 'url(#shadow)', fill: '#4f46e5' }}
              name="Revenue"
              isAnimationActive={true}
              animationDuration={1000}
              fill="url(#colorRevenue)"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Goals & Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-blue-700 font-medium">Monthly Target</p>
              <p className="text-2xl font-bold text-blue-900 mt-1">₹{(metrics.revenue_this_month * 1.2).toLocaleString()}</p>
              <p className="text-xs text-blue-600 mt-1">₹{metrics.revenue_this_month.toLocaleString()} achieved</p>
            </div>
            <Target size={32} className="text-blue-300" />
          </div>
          <div className="mt-3 bg-blue-200 rounded-full h-1.5 overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all"
              style={{ width: `${(metrics.revenue_this_month / (metrics.revenue_this_month * 1.2)) * 100}%` }}
            />
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-green-700 font-medium">Deals Target (Month)</p>
              <p className="text-2xl font-bold text-green-900 mt-1">{Math.ceil(metrics.deals_closed_this_month * 1.5)}</p>
              <p className="text-xs text-green-600 mt-1">{metrics.deals_closed_this_month} deals closed</p>
            </div>
            <Award size={32} className="text-green-300" />
          </div>
          <div className="mt-3 bg-green-200 rounded-full h-1.5 overflow-hidden">
            <div
              className="h-full bg-green-600 transition-all"
              style={{ width: `${(metrics.deals_closed_this_month / (metrics.deals_closed_this_month * 1.5)) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Action Items */}
      <div className="bg-white rounded-lg p-4 shadow-sm border">
        <h3 className="text-lg font-semibold mb-3">Recommended Actions</h3>
        <div className="space-y-2">
          <ActionItem icon={Zap} text="Focus on high-value deals to increase average deal size" />
          <ActionItem icon={TrendingUp} text={`Improve conversion rate from ${metrics.win_rate}% to ${Math.min(metrics.win_rate + 5, 95)}%`} />
          <ActionItem icon={Target} text={`Complete 2 more deals to reach monthly target`} />
        </div>
      </div>
    </div>
  );
}

// Team Leaderboard
function TeamLeaderboard({ sales }: any) {
  const rankedSales = sales.slice(0, 10);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {rankedSales.slice(0, 3).map((s: any, i: number) => (
          <div key={s.user_id} className={`rounded-lg p-4 border text-white text-sm ${i === 0 ? 'bg-gradient-to-br from-blue-500 to-blue-700' :
            i === 1 ? 'bg-gradient-to-br from-indigo-500 to-indigo-700' :
              'bg-gradient-to-br from-purple-500 to-purple-700'
            }`}>
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="text-xs opacity-80">#{i + 1}</p>
                <p className="text-2xl font-bold">🏆</p>
              </div>
              <Award size={20} />
            </div>
            <p className="font-semibold">{s.name}</p>
            <p className="text-xs opacity-90 mt-1">₹{s.revenue.toLocaleString()}</p>
            <p className="text-xs opacity-75 mt-1">{s.won} wins • {s.win_rate}% rate</p>
          </div>
        ))}
        <div className="bg-white rounded-lg p-4 border shadow-sm">
          <p className="text-xs text-gray-600 font-medium">Team Average</p>
          <p className="text-2xl font-bold mt-1 text-gray-900">₹{Math.floor(rankedSales.reduce((s: number, r: any) => s + r.revenue, 0) / rankedSales.length).toLocaleString()}</p>
          <p className="text-xs text-gray-500 mt-1">{rankedSales.length} active sellers</p>
        </div>
      </div>

      {/* Full Rankings Table */}
      <div className="bg-white rounded-lg p-4 shadow-sm border overflow-x-auto">
        <h3 className="text-lg font-semibold mb-3">Full Rankings</h3>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b">
              <th className="px-3 py-2 text-left font-medium text-gray-600">Rank</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Salesperson</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Quotations</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Won</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Lost</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Win %</th>
              <th className="px-3 py-2 text-right font-medium text-gray-600">Revenue</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rankedSales.map((s: any, i: number) => (
              <tr key={s.user_id} className="hover:bg-indigo-50/40 transition">
                <td className="px-3 py-2">
                  <span className="inline-flex w-6 h-6 items-center justify-center bg-indigo-100 text-indigo-700 rounded-full font-semibold text-xs">
                    {i + 1}
                  </span>
                </td>
                <td className="px-3 py-2 font-medium text-sm">{s.name}</td>
                <td className="px-3 py-2 text-sm">{s.total_quotations}</td>
                <td className="px-3 py-2"><span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">{s.won}</span></td>
                <td className="px-3 py-2"><span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-medium">{s.lost}</span></td>
                <td className="px-3 py-2"><span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">{s.win_rate}%</span></td>
                <td className="px-3 py-2 text-right font-bold text-indigo-600 text-sm">₹{s.revenue.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Advanced Analytics
function AdvancedAnalytics({
  userMetrics,
  timeseries,
  pipeline,
}: {
  userMetrics: UserMetrics | null;
  timeseries: TimeseriesData[];
  pipeline: PipelineItem[];
}) {
  return (
    <div className="space-y-4">
      {/* Win Rate Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <_ChartCard title="Deal Cycle Analysis">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={timeseries}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="deals" fill="#6366f1" name="Total Deals" />
              <Bar dataKey="won" fill="#10b981" name="Won Deals" />
            </BarChart>
          </ResponsiveContainer>
        </_ChartCard>

        <div className="bg-white rounded-lg p-4 shadow-sm border">
          <h3 className="text-lg font-semibold mb-4">Revenue Distribution</h3>

          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={pipeline.map((p) => ({
                  name: p.status.charAt(0).toUpperCase() + p.status.slice(1),
                  value: Number(p.value || 0),
                }))}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={90}
                label={({ name, percent }) =>
                  percent != null
                    ? `${name} ${(percent * 100).toFixed(0)}%`
                    : name
                }
              >
                {pipeline.map((p) => {
                  const status = p.status.toLowerCase();
                  let color = "#9ca3af";

                  if (status === "won") color = "#10b981";
                  else if (status === "pending") color = "#3b82f6";
                  else if (status === "lost") color = "#ef4444";

                  return <Cell key={p.status} fill={color} />;
                })}
              </Pie>

              <Tooltip
                formatter={(value: any) =>
                  `₹${Number(value).toLocaleString()}`
                }
              />
            </PieChart>
          </ResponsiveContainer>

        </div>
      </div>

      {/* Performance Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricBox
          label="Avg Deal Value"
          value={
            userMetrics?.avg_deal_size
              ? `₹${(userMetrics.avg_deal_size / 1000).toFixed(1)}K`
              : "—"
          }
          color="indigo"
        />

        <MetricBox
          label="Total Quotations"
          value={userMetrics?.total_quotations ?? "—"}
          color="blue"
        />

        <MetricBox
          label="Conversion Rate"
          value={
            typeof userMetrics?.conversion_rate === "number"
              ? `${userMetrics.conversion_rate.toFixed(1)}%`
              : "—"
          }
          color="green"
        />

        <MetricBox
          label="Lost Deals"
          value={userMetrics?.lost ?? "—"}
          color="red"
        />
      </div>


      {/* Insights */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl p-8 border border-indigo-200 hover:border-indigo-300 transition-all duration-300">
        <h3 className="text-2xl font-bold text-indigo-900 mb-6">🔍 Performance Insights</h3>

        <div className="space-y-4">
          <InsightBullet
            title="Win Rate Trend"
            description={`Your win rate is ${typeof userMetrics?.conversion_rate === "number"
              ? userMetrics.conversion_rate.toFixed(1)
              : 0
              }%, which is ${(userMetrics?.conversion_rate ?? 0) > 40 ? "above" : "below"
              } the industry benchmark of 40%.`}
          />

          <InsightBullet
            title="Deal Momentum"
            description={`You have successfully closed ${userMetrics?.won ?? 0
              } deals during this period, indicating ${(userMetrics?.won ?? 0) >= 5 ? "strong" : "moderate"
              } sales momentum.`}
          />

          <InsightBullet
            title="Revenue Focus"
            description="Industry data suggests that a small portion of high-value deals contributes the majority of revenue. Prioritizing premium opportunities can significantly improve overall performance."
          />
        </div>
      </div>
    </div>
  );
}

// Helper Components
function PerformanceCard({ label, value, subtext, icon: Icon, color }: any) {
  const colorMap: Record<string, {bg: string, border: string, icon: string, text: string, lightBg: string}> = {
    indigo: {bg: "from-indigo-600 to-indigo-700", border: "border-indigo-300", icon: "text-indigo-50", text: "text-indigo-100", lightBg: "bg-indigo-50"},
    green: {bg: "from-green-600 to-green-700", border: "border-green-300", icon: "text-green-50", text: "text-green-100", lightBg: "bg-green-50"},
    purple: {bg: "from-purple-600 to-purple-700", border: "border-purple-300", icon: "text-purple-50", text: "text-purple-100", lightBg: "bg-purple-50"},
    orange: {bg: "from-orange-600 to-orange-700", border: "border-orange-300", icon: "text-orange-50", text: "text-orange-100", lightBg: "bg-orange-50"},
  };

  const colors = colorMap[color as keyof typeof colorMap] || colorMap.indigo;

  return (
    <div className={`rounded-xl p-4 bg-gradient-to-br ${colors.bg} border border-white/20 shadow-md hover:shadow-lg hover:scale-105 transition-all duration-300 group`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-white/80">{label}</p>
          <p className="text-2xl font-bold mt-2 text-white">{value}</p>
          <p className={`text-xs mt-2 ${colors.text}`}>{subtext}</p>
        </div>
        <div className={`${colors.lightBg} rounded-lg p-2 group-hover:scale-110 transition-transform duration-300`}>
          <Icon size={24} className={colors.icon} />
        </div>
      </div>
    </div>
  );
}

function ActionItem({ icon: Icon, text }: any) {
  return (
    <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg border border-blue-100 hover:border-blue-200 transition-all duration-300">
      <Icon size={16} className="text-blue-600 mt-0.5 flex-shrink-0" />
      <p className="text-xs text-blue-900 font-medium">{text}</p>
    </div>
  );
}

function MetricBox({ label, value, color }: any) {
  const colorMap: Record<string, {bg: string, border: string, text: string}> = {
    indigo: {bg: "bg-white", border: "border-indigo-200", text: "text-indigo-700"},
    blue: {bg: "bg-white", border: "border-blue-200", text: "text-blue-700"},
    green: {bg: "bg-white", border: "border-green-200", text: "text-green-700"},
    red: {bg: "bg-white", border: "border-red-200", text: "text-red-700"},
  };

  const colors = colorMap[color as keyof typeof colorMap] || colorMap.indigo;

  return (
    <div className={`rounded-lg p-4 ${colors.bg} border ${colors.border} shadow-sm hover:shadow-md transition-all duration-300`}>
      <p className="text-xs font-bold uppercase tracking-wide text-gray-600">{label}</p>
      <p className={`text-2xl font-bold mt-2 ${colors.text}`}>{value}</p>
    </div>
  );
}

function InsightBullet({ title, description }: any) {
  return (
    <div className="flex gap-2 p-3 rounded-lg bg-indigo-50 border border-indigo-200 hover:border-indigo-300 hover:shadow-md transition-all duration-300">
      <div className="w-2 h-2 rounded-full bg-indigo-600 mt-1.5 flex-shrink-0" />
      <div>
        <p className="font-semibold text-indigo-900 text-sm">{title}</p>
        <p className="text-xs text-indigo-700 mt-0.5">{description}</p>
      </div>
    </div>
  );
}

function Stat({
  title,
  value,
  icon: Icon,
  trend,
}: any) {
  return (
    <div className={`relative rounded-lg p-4 bg-white border border-gray-200 shadow-sm hover:shadow-md hover:scale-102 transition-all duration-300 group`}>
      {Icon && (
        <div className="absolute top-4 right-4 text-gray-100 opacity-40 group-hover:opacity-60 transition-opacity">
          <Icon size={32} />
        </div>
      )}

      <p className="text-xs uppercase tracking-wider text-gray-500 font-bold">
        {title}
      </p>

      <p className="text-3xl font-bold mt-2 text-gray-900">
        {value}
      </p>

      {trend !== undefined && (
        <div className={`inline-flex items-center gap-1 mt-2 px-2 py-1 rounded text-xs font-bold ${
          trend >= 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
        }`}>
          {trend >= 0 ? "↑" : "↓"} {Math.abs(trend).toFixed(1)}%
        </div>
      )}
    </div>
  );
}

function _ChartCard({ title, children }: any) {
  return (
    <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm hover:shadow-md hover:border-gray-300 transition-all duration-300">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold text-gray-900">{title}</h3>
        <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-3 py-1 rounded-full">Last 30 days</span>
      </div>
      {children}
    </div>
  );
}

function PipelineStat({ label, value }: any) {
  return (
    <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm hover:shadow-md hover:border-gray-300 transition-all duration-300">
      <p className="text-xs text-gray-600 font-bold uppercase tracking-wide">{label}</p>
      <p className="text-3xl font-bold mt-2 text-gray-900">{value}</p>
    </div>
  );
}

function _InsightCard({ title, value, tone }: any) {
  const toneMap: any = {
    warning: "from-yellow-50 to-yellow-100 border-yellow-200 text-yellow-900",
    info: "from-blue-50 to-blue-100 border-blue-200 text-blue-900",
    success: "from-green-50 to-green-100 border-green-200 text-green-900",
  };

  return (
    <div className={`rounded-lg p-4 bg-gradient-to-br ${toneMap[tone]} border hover:shadow-md transition-all duration-300`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-700">{title}</p>
      <p className="text-xl font-bold mt-1">{value}</p>
    </div>
  );
}

function Table({ headers, rows, empty }: any) {
  if (!rows.length) return <p className="text-gray-600 text-center py-4 text-sm">{empty}</p>;

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:border-gray-300 transition-all">
      <table className="w-full text-xs">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            {headers.map((h: string) => (
              <th key={h} className="px-4 py-2 text-left font-semibold text-gray-700 uppercase tracking-wide">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row: any[], i: number) => (
            <tr key={i} className="hover:bg-gray-50 transition-colors">
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-2 text-gray-700">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
