// frontend/src/pages/SalesReport.tsx

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Download } from 'lucide-react';
import Layout from '../components/layout/Layout';
import { api } from '../api';
import toast from 'react-hot-toast';

type SalesPerformance = {
  user_id: number;
  name: string;
  total_quotations: number;
  won: number;
  lost: number;
  win_rate: number;
  revenue: number;
};

type UserMetrics = {
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
};

export default function SalesReport() {
  const { userId } = useParams<{ userId?: string }>();

  const [sales, setSales] = useState<SalesPerformance[]>([]);
  const [userMetrics, setUserMetrics] = useState<UserMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [userId]);

  async function loadData() {
    try {
      setLoading(true);

      const salesRes = await api.getReportSalesPerformance();
      setSales(salesRes.data || []);

      if (userId) {
        // Drill-down view for specific user
        const metricsRes = await api.getReportUserMetrics();
        setUserMetrics(metricsRes || {});
      } else {
        // Full team view
        const metricsRes = await api.getReportUserMetrics();
        setUserMetrics(metricsRes || {});
      }
    } catch (err) {
      console.error('Sales report load error:', err);
      toast.error('Failed to load sales report');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="p-8 space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3 animate-pulse" />
          <div className="h-64 bg-gray-200 rounded animate-pulse" />
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
            <h1 className="text-3xl font-bold text-gray-900">Sales Performance Report</h1>
            <p className="text-gray-600 mt-2">Detailed sales metrics and team performance tracking</p>
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

        {/* ================= PERSONAL METRICS (IF VIEWING OWN) ================= */}
        {userMetrics && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricsCard
              label="Total Revenue"
              value={`₹${(userMetrics.total_revenue || 0).toLocaleString()}`}
              color="indigo"
            />
            <MetricsCard
              label="Deals Won This Month"
              value={userMetrics.deals_closed_this_month || 0}
              color="green"
            />
            <MetricsCard
              label="Monthly Revenue"
              value={`₹${(userMetrics.revenue_this_month || 0).toLocaleString()}`}
              color="blue"
            />
            <MetricsCard
              label="Conversion Rate"
              value={`${(userMetrics.conversion_rate || 0).toFixed(1)}%`}
              color="purple"
            />
          </div>
        )}

        {/* ================= TEAM LEADERBOARD ================= */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Sales Leaderboard</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Rank</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Salesperson</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Quotations</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Won</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Lost</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Win Rate</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Revenue</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Avg Deal</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((row, idx) => (
                  <tr
                    key={row.user_id}
                    className="border-b border-gray-100 hover:bg-gray-50"
                  >
                    <td className="py-3 px-4 font-bold text-lg text-gray-900">#{idx + 1}</td>
                    <td className="py-3 px-4 text-gray-900 font-medium">{row.name}</td>
                    <td className="py-3 px-4 text-right text-gray-600">{row.total_quotations}</td>
                    <td className="py-3 px-4 text-right text-green-600 font-medium">{row.won}</td>
                    <td className="py-3 px-4 text-right text-red-600">{row.lost}</td>
                    <td className="py-3 px-4 text-right text-gray-600">{row.win_rate}%</td>
                    <td className="py-3 px-4 text-right font-bold text-gray-900">
                      ₹{row.revenue.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right text-gray-600">
                      ₹{row.total_quotations > 0 ? (row.revenue / row.total_quotations).toLocaleString() : '0'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ================= INSIGHTS ================= */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <InsightBox title="Top Performer" content={sales.length > 0 ? `${sales[0].name} leads with ₹${sales[0].revenue.toLocaleString()} revenue` : 'No data'} />
          <InsightBox title="Team Average" content={`${(sales.reduce((sum, s) => sum + s.win_rate, 0) / Math.max(sales.length, 1)).toFixed(1)}% average win rate`} />
        </div>
      </div>
    </Layout>
  );
}

// ================= COMPONENTS =================

function MetricsCard({
  label,
  value,
  color = 'blue',
}: {
  label: string;
  value: string | number;
  color?: string;
}) {
  const colorMap: Record<string, { bg: string; text: string }> = {
    blue: { bg: 'bg-blue-50', text: 'text-blue-700' },
    green: { bg: 'bg-green-50', text: 'text-green-700' },
    indigo: { bg: 'bg-indigo-50', text: 'text-indigo-700' },
    purple: { bg: 'bg-purple-50', text: 'text-purple-700' },
  };

  const colors = colorMap[color] || colorMap.blue;

  return (
    <div className={`${colors.bg} rounded-lg border border-gray-200 p-4`}>
      <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-2 ${colors.text}`}>{value}</p>
    </div>
  );
}

function InsightBox({ title, content }: { title: string; content: string }) {
  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-700">{content}</p>
    </div>
  );
}
