// frontend/src/pages/ReportsOverview.tsx

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, TrendingUp, TrendingDown, BarChart3, Users, Package, Target } from 'lucide-react';
import Layout from '../components/layout/Layout';
import { api } from '../api';
import toast from 'react-hot-toast';

type DateRange = { from: string; to: string };
type KPI = {
  total_quotations: number;
  won: number;
  lost: number;
  pending: number;
  win_rate: number;
  total_value: number;
  avg_deal_size: number;
};

type SalesPerformance = {
  user_id: number;
  name: string;
  total_quotations: number;
  won: number;
  lost: number;
  win_rate: number;
  revenue: number;
};

type PipelineItem = {
  status: string;
  count: number;
  value: number;
};

export default function ReportsOverview() {
  const navigate = useNavigate();

  // ================= STATE =================
  const [kpis, setKpis] = useState<KPI | null>(null);
  const [sales, setSales] = useState<SalesPerformance[]>([]);
  const [pipeline, setPipeline] = useState<PipelineItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>({
    from: new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10),
    to: new Date().toISOString().slice(0, 10),
  });
  const [timeUnit, setTimeUnit] = useState<'week' | 'month' | 'quarter' | 'year'>('month');

  // ================= LOAD DATA =================
  useEffect(() => {
    loadAllData();
  }, [dateRange, timeUnit]);

  async function loadAllData() {
    try {
      setLoading(true);

      const kpiRes = await api.getReportKpis();
      setKpis(kpiRes || {});

      const salesRes = await api.getReportSalesPerformance();
      setSales(salesRes.data || []);

      const pipelineRes = await api.getReportPipeline();
      setPipeline(pipelineRes.data || []);

      // Timeseries data loaded but not displayed in overview
      // const timeseriesRes = await api.get('/reports/timeseries', {
      //   range: timeUnit,
      // });
    } catch (err) {
      console.error('Reports load error:', err);
      toast.error('Failed to load reports');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="p-8 space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3 animate-pulse" />
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-32 bg-gray-200 rounded animate-pulse" />
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-[1400px] mx-auto px-8 py-8 space-y-8">
        {/* ================= HEADER ================= */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Reports & Analytics</h1>
            <p className="text-gray-600 mt-2">Track sales performance, pipeline health, and key metrics</p>
          </div>
          <div className="flex gap-2">
            <button

              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <Download size={16} /> CSV
            </button>
            <button

              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <Download size={16} /> Excel
            </button>
          </div>
        </div>

        {/* ================= GLOBAL FILTERS ================= */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
          <h3 className="font-semibold text-gray-900">Filters</h3>
          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-2">From Date</label>
              <input
                type="date"
                value={dateRange.from}
                onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-2">To Date</label>
              <input
                type="date"
                value={dateRange.to}
                onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-2">Time Unit</label>
              <select
                value={timeUnit}
                onChange={(e) => setTimeUnit(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="week">Weekly</option>
                <option value="month">Monthly</option>
                <option value="quarter">Quarterly</option>
                <option value="year">Yearly</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={loadAllData}
                className="w-full px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 text-sm"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* ================= KPI CARDS ================= */}
        {kpis && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              label="Total Quotations"
              value={kpis.total_quotations || 0}
              icon={BarChart3}
              color="blue"
            />
            <KPICard
              label="Deals Won"
              value={kpis.won || 0}
              subtext={`${kpis.win_rate || 0}% win rate`}
              icon={TrendingUp}
              color="green"
            />
            <KPICard
              label="Deals Lost"
              value={kpis.lost || 0}
              icon={TrendingDown}
              color="red"
            />
            <KPICard
              label="Win Rate"
              value={`${kpis.win_rate || 0}%`}
              icon={Target}
              color="purple"
            />
            <KPICard
              label="Total Revenue"
              value={`₹${(kpis.total_value || 0).toLocaleString()}`}
              icon={BarChart3}
              color="indigo"
            />
            <KPICard
              label="Avg Deal Size"
              value={`₹${(kpis.avg_deal_size || 0).toLocaleString()}`}
              icon={Package}
              color="orange"
            />
            <KPICard
              label="Pending Deals"
              value={kpis.pending || 0}
              icon={Users}
              color="amber"
            />
            <KPICard
              label="Total Value"
              value={`₹${(kpis.total_value || 0).toLocaleString()}`}
              icon={TrendingUp}
              color="green"
            />
          </div>
        )}

        {/* ================= SALES PERFORMANCE TABLE ================= */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Sales Performers</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Salesperson</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Quotations</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Won</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Lost</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Win Rate</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {sales.slice(0, 10).map(row => (
                  <tr
                    key={row.user_id}
                    className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/reports/sales/${row.user_id}`)}
                  >
                    <td className="py-3 px-4 text-gray-900">{row.name}</td>
                    <td className="py-3 px-4 text-right text-gray-600">{row.total_quotations}</td>
                    <td className="py-3 px-4 text-right text-green-600 font-medium">{row.won}</td>
                    <td className="py-3 px-4 text-right text-red-600">{row.lost}</td>
                    <td className="py-3 px-4 text-right text-gray-600">{row.win_rate}%</td>
                    <td className="py-3 px-4 text-right font-medium text-gray-900">
                      ₹{row.revenue.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            onClick={() => navigate('/reports/sales')}
            className="mt-4 text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            View Full Sales Report →
          </button>
        </div>

        {/* ================= PIPELINE DISTRIBUTION ================= */}
        {pipeline.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Pipeline Distribution</h3>
              <div className="space-y-3">
                {pipeline.map((item, idx) => {
                  const colors = ['bg-green-500', 'bg-red-500', 'bg-blue-500'];
                  return (
                    <div key={idx}>
                      <div className="flex justify-between mb-2">
                        <span className="text-sm font-medium text-gray-900">{item.status}</span>
                        <span className="text-sm text-gray-600">{item.count} deals • ₹{item.value.toLocaleString()}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`${colors[idx] || 'bg-gray-400'} h-2 rounded-full`}
                          style={{
                            width: `${(item.count / Math.max(...pipeline.map(p => p.count))) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ================= QUICK ACTIONS ================= */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
              <div className="space-y-2">
                <ActionButton
                  label="Sales Performance"
                  onClick={() => navigate('/reports/sales')}
                />
                <ActionButton
                  label="Customer Analysis"
                  onClick={() => navigate('/reports/customers')}
                />
                <ActionButton
                  label="Product Insights"
                  onClick={() => navigate('/reports/products')}
                />
                <ActionButton
                  label="Pipeline View"
                  onClick={() => navigate('/reports/pipeline')}
                />
                <ActionButton
                  label="Audit Logs"
                  onClick={() => navigate('/reports/audit-logs')}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

// ================= COMPONENTS =================

function KPICard({
  label,
  value,
  subtext,
  icon: Icon,
  color = 'blue',
}: {
  label: string;
  value: string | number;
  subtext?: string;
  icon: any;
  color?: string;
}) {
  const colorMap: Record<string, { bg: string; text: string; icon: string }> = {
    blue: { bg: 'bg-blue-50', text: 'text-blue-700', icon: 'text-blue-600' },
    green: { bg: 'bg-green-50', text: 'text-green-700', icon: 'text-green-600' },
    red: { bg: 'bg-red-50', text: 'text-red-700', icon: 'text-red-600' },
    purple: { bg: 'bg-purple-50', text: 'text-purple-700', icon: 'text-purple-600' },
    indigo: { bg: 'bg-indigo-50', text: 'text-indigo-700', icon: 'text-indigo-600' },
    orange: { bg: 'bg-orange-50', text: 'text-orange-700', icon: 'text-orange-600' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-700', icon: 'text-amber-600' },
  };

  const colors = colorMap[color] || colorMap.blue;

  return (
    <div className={`${colors.bg} rounded-lg border border-gray-200 p-4`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">{label}</p>
          <p className={`text-2xl font-bold mt-2 ${colors.text}`}>{value}</p>
          {subtext && <p className="text-xs text-gray-600 mt-1">{subtext}</p>}
        </div>
        <Icon className={`${colors.icon} w-6 h-6`} />
      </div>
    </div>
  );
}

function ActionButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-4 py-3 bg-white border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors font-medium text-gray-900 text-sm"
    >
      {label} →
    </button>
  );
}
