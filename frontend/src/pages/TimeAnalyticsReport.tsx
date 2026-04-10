// frontend/src/pages/TimeAnalyticsReport.tsx

import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import Layout from '../components/layout/Layout';
import { api } from '../api';
import toast from 'react-hot-toast';

type TimeseriesData = {
  period: string;
  revenue: number;
  deals: number;
  won: number;
};

export default function TimeAnalyticsReport() {
  const [timeseries, setTimeseries] = useState<TimeseriesData[]>([]);
  const [timeUnit, setTimeUnit] = useState<'week' | 'month' | 'quarter' | 'year'>('month');

  useEffect(() => {
    loadData();
  }, [timeUnit]);

  async function loadData() {
    try {
      const response = await api.getReportTimeseries(timeUnit);
      setTimeseries(response.data || []);
    } catch (err) {
      console.error('Time analytics load error:', err);
      toast.error('Failed to load time analytics');
    }
  }

  const totalRevenue = timeseries.reduce((sum, p) => sum + (p.revenue || 0), 0);
  const totalDeals = timeseries.reduce((sum, p) => sum + (p.deals || 0), 0);
  const totalWon = timeseries.reduce((sum, p) => sum + (p.won || 0), 0);

  return (
    <Layout>
      <div className="max-w-[1400px] mx-auto px-8 py-8 space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Time Analytics</h1>
            <p className="text-gray-600 mt-2">Revenue and deal trends over time</p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
            <Download size={16} /> Export
          </button>
        </div>

        {/* ================= TIME UNIT SELECTOR ================= */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex gap-2">
            {['week', 'month', 'quarter', 'year'].map(unit => (
              <button
                key={unit}
                onClick={() => setTimeUnit(unit as any)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  timeUnit === unit
                    ? 'bg-gray-900 text-white'
                    : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {unit.charAt(0).toUpperCase() + unit.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* ================= SUMMARY METRICS ================= */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <SummaryCard
            label="Total Revenue"
            value={`₹${totalRevenue.toLocaleString()}`}
            color="indigo"
          />
          <SummaryCard
            label="Total Deals"
            value={totalDeals}
            color="blue"
          />
          <SummaryCard
            label="Deals Won"
            value={totalWon}
            color="green"
          />
        </div>

        {/* ================= TIMELINE TABLE ================= */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Period</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Total Deals</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Deals Won</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Win Rate</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Revenue</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Avg Deal Value</th>
                </tr>
              </thead>
              <tbody>
                {timeseries.map((row, idx) => (
                  <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium text-gray-900">{row.period}</td>
                    <td className="py-3 px-4 text-right text-gray-600">{row.deals}</td>
                    <td className="py-3 px-4 text-right text-green-600 font-medium">{row.won}</td>
                    <td className="py-3 px-4 text-right text-gray-600">
                      {row.deals > 0 ? `${((row.won / row.deals) * 100).toFixed(1)}%` : '0%'}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-gray-900">
                      ₹{row.revenue.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right text-gray-600">
                      ₹{row.deals > 0 ? (row.revenue / row.deals).toLocaleString() : '0'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
}

function SummaryCard({
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
  };

  const colors = colorMap[color] || colorMap.blue;

  return (
    <div className={`${colors.bg} rounded-lg border border-gray-200 p-6`}>
      <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">{label}</p>
      <p className={`text-3xl font-bold mt-3 ${colors.text}`}>{value}</p>
    </div>
  );
}
