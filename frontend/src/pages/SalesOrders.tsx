import { useEffect, useState } from "react";
import Layout from "../components/layout/Layout";
import api from "../api";
import { Link, useNavigate } from "react-router-dom";
import { Plus, RefreshCw, Eye, Trash2 } from "lucide-react";
import { toast } from "react-toastify";

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return "—";
  }
}

export default function SalesOrders() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);

  const load = () => {
    setLoading(true);
    setErr(null);
    api
      .getSalesOrders({ limit: 300 })
      .then((r) => setRows(Array.isArray(r) ? r : []))
      .catch((e: any) => {
        setErr(e?.message || "Failed to load sales orders");
        console.error(e);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async (id: number) => {
    if (!window.confirm("Delete this sales order? This action cannot be undone.")) return;

    setDeleting(id);
    try {
      await api.deleteSalesOrder(id);
      toast.success("Sales order deleted");
      load();
    } catch (e: any) {
      toast.error(e?.message || "Failed to delete sales order");
      console.error(e);
    } finally {
      setDeleting(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "completed":
        return "bg-green-100 text-green-800";
      case "confirmed":
        return "bg-blue-100 text-blue-800";
      case "converted":
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getTotalRevenue = () => {
    return rows.reduce((sum, so) => sum + Number(so.total_value || 0), 0);
  };

  const getConfirmedCount = () => rows.filter((so) => so.status === "confirmed").length;

  return (
    <Layout>
      <div className="max-w-7xl mx-auto p-4 sm:p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Sales Orders</h1>
            <p className="text-gray-600 mt-2">
              Manage confirmed quotations. Track dispatch and invoicing from here.
            </p>
          </div>
          <button
            onClick={() => navigate("/create-sales-order")}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700"
          >
            <Plus className="w-5 h-5" />
            New Sales Order
          </button>
        </div>

        {/* Error Message */}
        {err && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800 text-sm">
            {err}
          </div>
        )}

        {/* Stats */}
        <div className="grid md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-semibold uppercase text-gray-500">Total Sales Orders</p>
            <p className="text-2xl font-bold text-gray-900 mt-2">{rows.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-semibold uppercase text-gray-500">Confirmed</p>
            <p className="text-2xl font-bold text-blue-600 mt-2">
              {getConfirmedCount()}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-semibold uppercase text-gray-500">Total Revenue</p>
            <p className="text-2xl font-bold text-gray-900 mt-2">
              ₹{getTotalRevenue().toLocaleString()}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-semibold uppercase text-gray-500">Refresh</p>
            <button
              onClick={load}
              disabled={loading}
              className="mt-2 p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left font-semibold text-gray-700">SO No</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-700">Quotation</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-700">Customer</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-700">SO Date</th>
                  <th className="px-6 py-3 text-right font-semibold text-gray-700">Total</th>
                  <th className="px-6 py-3 text-center font-semibold text-gray-700">Status</th>
                  <th className="px-6 py-3 text-right font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {rows.length === 0 && !loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-10 text-center text-gray-500">
                      No sales orders found. Create one to get started.
                    </td>
                  </tr>
                ) : (
                  rows.map((so) => (
                    <tr key={so.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-semibold text-gray-900">
                        {so.so_number}
                      </td>
                      <td className="px-6 py-4">
                        <Link
                          to={`/quotations/${so.quotation_id}`}
                          className="text-blue-600 hover:underline font-semibold"
                        >
                          {so.quotation_no || `Quot #${so.quotation_id}`}
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-gray-700">
                        {so.customer_snapshot?.company_name || so.customer_name || "—"}
                      </td>
                      <td className="px-6 py-4 text-gray-700">
                        {formatDate(so.so_date)}
                      </td>
                      <td className="px-6 py-4 text-right font-semibold text-gray-900">
                        ₹{Number(so.total_value || 0).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(so.status)}`}>
                          {so.status || "—"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            to={`/sales-orders/${so.id}`}
                            className="text-blue-600 hover:text-blue-700 p-2 rounded-lg hover:bg-blue-50"
                            title="View sales order"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>
                          <button
                            onClick={() => handleDelete(Number(so.id))}
                            disabled={deleting === Number(so.id)}
                            className="text-red-600 hover:text-red-700 p-2 rounded-lg hover:bg-red-50 disabled:opacity-50"
                            title="Delete sales order"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {loading && (
          <div className="text-center py-8 text-gray-500">
            Loading sales orders...
          </div>
        )}
      </div>
    </Layout>
  );
}

