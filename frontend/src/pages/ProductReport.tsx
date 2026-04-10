// frontend/src/pages/ProductReport.tsx

import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import Layout from '../components/layout/Layout';
import { api } from '../api';
import toast from 'react-hot-toast';

type ProductData = {
  name: string;
  quantity: number;
  revenue: number;
};

export default function ProductReport() {
  const [products, setProducts] = useState<ProductData[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const response = await api.getReportProducts();
      setProducts(response.data || []);
    } catch (err) {
      console.error('Product report load error:', err);
      toast.error('Failed to load product report');
    }
  }

  const totalRevenue = products.reduce((sum, p) => sum + (p.revenue || 0), 0);

  return (
    <Layout>
      <div className="max-w-[1400px] mx-auto px-8 py-8 space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Product Report</h1>
            <p className="text-gray-600 mt-2">Top products by revenue and quantity sold</p>
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

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Product Name</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Quantity Sold</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Revenue</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">% of Total</th>
                </tr>
              </thead>
              <tbody>
                {products.map((row, idx) => (
                  <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium text-gray-900">{row.name}</td>
                    <td className="py-3 px-4 text-right text-gray-600">{row.quantity}</td>
                    <td className="py-3 px-4 text-right font-bold text-gray-900">₹{row.revenue.toLocaleString()}</td>
                    <td className="py-3 px-4 text-right text-gray-600">
                      {totalRevenue > 0 ? `${((row.revenue / totalRevenue) * 100).toFixed(1)}%` : '0%'}
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
