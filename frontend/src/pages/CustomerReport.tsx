// frontend/src/pages/CustomerReport.tsx

import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import Layout from '../components/layout/Layout';
import { api } from '../api';
import toast from 'react-hot-toast';

type CustomerData = {
  id: number;
  company_name: string;
  quotations: number;
  won: number;
  revenue: number;
  last_deal: string | null;
};

export default function CustomerReport() {
  const [customers, setCustomers] = useState<CustomerData[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const response = await api.getReportCustomers();
      setCustomers(response.data || []);
    } catch (err) {
      console.error('Customer report load error:', err);
      toast.error('Failed to load customer report');
    }
  }

  function handleExport(format: 'csv' | 'xlsx') {
    if (!customers.length) {
      toast.error('No data to export');
      return;
    }

    if (format === 'csv') {
      const headers = ['Company Name', 'Quotations', 'Won', 'Revenue', 'Last Deal'];
      const rows = customers.map(c => [
        c.company_name,
        c.quotations,
        c.won,
        c.revenue,
        c.last_deal ? new Date(c.last_deal).toLocaleDateString() : '',
      ]);

      const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `customer_report_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      toast.success('CSV exported successfully');
    } else if (format === 'xlsx') {
      toast.error('XLSX export coming soon');
    }
  }


  return (
    <Layout>
      <div className="max-w-[1400px] mx-auto px-8 py-8 space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Customer Report</h1>
            <p className="text-gray-600 mt-2">Top customers by revenue and engagement</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleExport('csv')}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <Download size={16} /> CSV
            </button>
            <button
              onClick={() => handleExport('xlsx')}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <Download size={16} /> Excel
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Company Name</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Quotations</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Won</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Revenue</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Last Deal</th>
                </tr>
              </thead>
              <tbody>
                {customers.map(row => (
                  <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium text-gray-900">{row.company_name}</td>
                    <td className="py-3 px-4 text-right text-gray-600">{row.quotations}</td>
                    <td className="py-3 px-4 text-right text-green-600 font-medium">{row.won}</td>
                    <td className="py-3 px-4 text-right font-bold text-gray-900">₹{row.revenue.toLocaleString()}</td>
                    <td className="py-3 px-4 text-right text-gray-600">
                      {row.last_deal ? new Date(row.last_deal).toLocaleDateString() : '—'}
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
