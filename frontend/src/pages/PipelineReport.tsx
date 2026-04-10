// frontend/src/pages/PipelineReport.tsx

import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import Layout from '../components/layout/Layout';
import { api } from '../api';
import toast from 'react-hot-toast';

type PipelineItem = {
  status: string;
  count: number;
  value: number;
};

export default function PipelineReport() {
  const [pipeline, setPipeline] = useState<PipelineItem[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const response = await api.getReportPipeline();
      setPipeline(response.data || []);
    } catch (err) {
      console.error('Pipeline report load error:', err);
      toast.error('Failed to load pipeline report');
    }
  }

  const totalCount = pipeline.reduce((sum, p) => sum + (p.count || 0), 0);

  const statusColors: Record<string, { bg: string; text: string }> = {
    won: { bg: 'bg-green-100', text: 'text-green-700' },
    lost: { bg: 'bg-red-100', text: 'text-red-700' },
    pending: { bg: 'bg-blue-100', text: 'text-blue-700' },
  };

  return (
    <Layout>
      <div className="max-w-[1400px] mx-auto px-8 py-8 space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Pipeline View</h1>
            <p className="text-gray-600 mt-2">Sales pipeline distribution and health status</p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
            <Download size={16} /> Export
          </button>
        </div>

        {/* ================= PIPELINE CARDS ================= */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {pipeline.map(item => {
            const colors = statusColors[item.status.toLowerCase()] || { bg: 'bg-gray-100', text: 'text-gray-700' };
            return (
              <div key={item.status} className={`${colors.bg} rounded-lg border border-gray-200 p-6`}>
                <p className="text-sm font-medium text-gray-600 uppercase tracking-wide">{item.status}</p>
                <p className={`text-3xl font-bold mt-3 ${colors.text}`}>{item.count}</p>
                <p className="text-sm text-gray-600 mt-2">₹{item.value.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-2">
                  {totalCount > 0 ? `${((item.count / totalCount) * 100).toFixed(1)}% of pipeline` : '0%'}
                </p>
              </div>
            );
          })}
        </div>

        {/* ================= PIPELINE TABLE ================= */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Count</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">% of Total</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Total Value</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Avg Value</th>
                </tr>
              </thead>
              <tbody>
                {pipeline.map(row => {
                  const colors = statusColors[row.status.toLowerCase()] || { bg: 'bg-gray-100', text: 'text-gray-700' };
                  return (
                    <tr key={row.status} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${colors.bg} ${colors.text}`}>
                          {row.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-gray-900">{row.count}</td>
                      <td className="py-3 px-4 text-right text-gray-600">
                        {totalCount > 0 ? `${((row.count / totalCount) * 100).toFixed(1)}%` : '0%'}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-gray-900">
                        ₹{row.value.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right text-gray-600">
                        ₹{row.count > 0 ? (row.value / row.count).toLocaleString() : '0'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
}
