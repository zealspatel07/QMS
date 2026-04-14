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

export default function Dispatch() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);

  const load = () => {
    setLoading(true);
    setErr(null);
    api
      .getDispatches({ limit: 300 })
      .then((r) => setRows(Array.isArray(r) ? r : []))
      .catch((e: any) => {
        setErr(e?.message || "Failed to load dispatches");
        console.error(e);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async (id: number) => {
    if (!window.confirm("Delete this dispatch? This action cannot be undone.")) return;

    setDeleting(id);
    try {
      await api.deleteDispatch(id);
      toast.success("Dispatch deleted");
      load();
    } catch (e: any) {
      toast.error(e?.message || "Failed to delete dispatch");
      console.error(e);
    } finally {
      setDeleting(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "completed":
        return "bg-green-100 text-green-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "cancelled":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto p-4 sm:p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dispatches</h1>
            <p className="text-gray-600 mt-2">
              Manage shipments from sales orders. Track partial and full dispatches, update inventory.
            </p>
          </div>
          <button
            onClick={() => navigate("/dispatch/create")}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700"
          >
            <Plus className="w-5 h-5" />
            New Dispatch
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
            <p className="text-xs font-semibold uppercase text-gray-500">Total Dispatches</p>
            <p className="text-2xl font-bold text-gray-900 mt-2">{rows.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-semibold uppercase text-gray-500">Pending</p>
            <p className="text-2xl font-bold text-yellow-600 mt-2">
              {rows.filter((r) => r.status === "pending").length}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-semibold uppercase text-gray-500">Completed</p>
            <p className="text-2xl font-bold text-green-600 mt-2">
              {rows.filter((r) => r.status === "completed").length}
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
                  <th className="px-6 py-3 text-left font-semibold text-gray-700">Dispatch No</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-700">Sales Order</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-700">Dispatch Date</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-700">Customer</th>
                  <th className="px-6 py-3 text-center font-semibold text-gray-700">Status</th>
                  <th className="px-6 py-3 text-right font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {rows.length === 0 && !loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-gray-500">
                      No dispatches found. Create one to get started.
                    </td>
                  </tr>
                ) : (
                  rows.map((dispatch) => (
                    <tr key={dispatch.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-semibold text-gray-900">
                        {dispatch.dispatch_no}
                      </td>
                      <td className="px-6 py-4">
                        <Link
                          to={`/sales-orders/${dispatch.sales_order_id}`}
                          className="text-blue-600 hover:underline font-semibold"
                        >
                          {dispatch.so_number || `SO #${dispatch.sales_order_id}`}
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-gray-700">
                        {formatDate(dispatch.dispatch_date)}
                      </td>
                      <td className="px-6 py-4 text-gray-700">
                        {dispatch.customer_snapshot?.company_name || dispatch.customer_name || "—"}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(dispatch.status)}`}>
                          {dispatch.status || "—"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            to={`/dispatch/${dispatch.id}`}
                            className="text-blue-600 hover:text-blue-700 p-2 rounded-lg hover:bg-blue-50"
                            title="View dispatch"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>
                          <button
                            onClick={() => handleDelete(Number(dispatch.id))}
                            disabled={deleting === Number(dispatch.id)}
                            className="text-red-600 hover:text-red-700 p-2 rounded-lg hover:bg-red-50 disabled:opacity-50"
                            title="Delete dispatch"
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
            Loading dispatches...
          </div>
        )}
      </div>
    </Layout>
  );
}

