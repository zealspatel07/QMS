import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Layout from "../components/layout/Layout";
import api from "../api";
import { toast } from "react-toastify";
import { Edit2, Trash2, Check, X, ChevronRight, ArrowRight } from "lucide-react";

const cardClass = "bg-white rounded-xl border border-gray-200 p-6";

export default function DispatchView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const dispatchId = Number(id);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [dispatch, setDispatch] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editRemarks, setEditRemarks] = useState("");
  const [saving, setSaving] = useState(false);

  // Load dispatch details
  useEffect(() => {
    loadDispatch();
  }, [dispatchId]);

  const loadDispatch = async () => {
    if (!Number.isFinite(dispatchId) || dispatchId <= 0) {
      setErr("Invalid dispatch ID");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setErr(null);
      const data = await api.getDispatch(dispatchId);
      setDispatch(data);
      setEditRemarks(data?.remarks || "");
    } catch (e: any) {
      setErr(e?.message || "Failed to load dispatch");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRemarks = async () => {
    if (!dispatch) return;

    setSaving(true);
    try {
      await api.updateDispatch(dispatchId, { remarks: editRemarks });
      setDispatch((prev: any) => ({ ...prev, remarks: editRemarks }));
      setIsEditing(false);
      toast.success("Remarks updated");
    } catch (e: any) {
      toast.error(e?.message || "Failed to update remarks");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDispatch = async () => {
    if (!window.confirm("Delete this dispatch? This action cannot be undone.")) return;

    try {
      await api.deleteDispatch(dispatchId);
      toast.success("Dispatch deleted");
      navigate("/dispatch");
    } catch (e: any) {
      toast.error(e?.message || "Failed to delete dispatch");
    }
  };

  const handleGenerateInvoice = async () => {
    try {
      const invoice = await api.createInvoiceFromDispatch(dispatchId, {});
      toast.success(`Invoice ${invoice?.invoice_no || invoice?.id} created`);
      navigate(`/invoices/${invoice?.id}`);
    } catch (e: any) {
      toast.error(e?.message || "Failed to generate invoice");
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="max-w-6xl mx-auto p-8 text-center text-gray-500">Loading...</div>
      </Layout>
    );
  }

  if (err || !dispatch) {
    return (
      <Layout>
        <div className="max-w-6xl mx-auto p-8">
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800">
            {err || "Dispatch not found"}
          </div>
        </div>
      </Layout>
    );
  }

  const items = Array.isArray(dispatch.items)
    ? dispatch.items
    : typeof dispatch.items === "string" && dispatch.items.trim()
      ? JSON.parse(dispatch.items)
      : [];

  const totalDispatched = items.reduce((sum: number, item: any) => sum + Number(item.dispatch_qty || 0), 0);

  return (
    <Layout>
      <div className="max-w-6xl mx-auto p-4 sm:p-8 space-y-6">
        {/* Flow Breadcrumb */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
          <p className="text-xs font-semibold text-gray-600 uppercase mb-3">Document Flow</p>
          <div className="flex items-center gap-2 text-sm overflow-x-auto pb-2">
            {dispatch.enquiry_id && (
              <>
                <button
                  onClick={() => dispatch.enquiry_id && navigate(`/enquiries/${dispatch.enquiry_id}`)}
                  className="px-3 py-1 bg-white rounded-lg border border-gray-200 hover:border-blue-400 text-gray-700 hover:text-blue-600 font-medium whitespace-nowrap"
                >
                  ENQ #{dispatch.enquiry_id}
                </button>
                <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
              </>
            )}
            {dispatch.quotation_id && (
              <>
                <button
                  onClick={() => dispatch.quotation_id && navigate(`/quotations/${dispatch.quotation_id}`)}
                  className="px-3 py-1 bg-white rounded-lg border border-gray-200 hover:border-blue-400 text-gray-700 hover:text-blue-600 font-medium whitespace-nowrap"
                >
                  Q #{dispatch.quotation_id}
                </button>
                <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
              </>
            )}
            {dispatch.sales_order_id && (
              <>
                <button
                  onClick={() => dispatch.sales_order_id && navigate(`/sales-orders/${dispatch.sales_order_id}`)}
                  className="px-3 py-1 bg-white rounded-lg border border-gray-200 hover:border-blue-400 text-gray-700 hover:text-blue-600 font-medium whitespace-nowrap"
                >
                  SO #{dispatch.sales_order_id}
                </button>
                <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
              </>
            )}
            <div className="px-3 py-1 bg-blue-100 rounded-lg border border-blue-300 text-blue-700 font-medium whitespace-nowrap">
              DSP #{dispatch.dispatch_no}
            </div>
          </div>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{dispatch.dispatch_no}</h1>
            <p className="text-gray-600 mt-2">
              {dispatch.so_number && `Sales Order: ${dispatch.so_number}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex px-3 py-1 rounded-full text-sm font-semibold ${
              dispatch.status === "completed"
                ? "bg-green-100 text-green-800"
                : dispatch.status === "pending"
                  ? "bg-yellow-100 text-yellow-800"
                  : "bg-gray-100 text-gray-800"
            }`}>
              {dispatch.status || "—"}
            </span>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid  md:grid-cols-3 gap-4">
          <div className={cardClass}>
            <p className="text-xs font-semibold uppercase text-gray-500">Dispatch Date</p>
            <p className="text-lg font-bold text-gray-900 mt-2">
              {new Date(dispatch.dispatch_date || "").toLocaleDateString()}
            </p>
          </div>
          <div className={cardClass}>
            <p className="text-xs font-semibold uppercase text-gray-500">Customer</p>
            <p className="text-lg font-bold text-gray-900 mt-2">
              {dispatch.customer_snapshot?.company_name || dispatch.customer_name || "—"}
            </p>
          </div>
          <div className={cardClass}>
            <p className="text-xs font-semibold uppercase text-gray-500">Items Dispatched</p>
            <p className="text-lg font-bold text-gray-900 mt-2">{totalDispatched}</p>
          </div>
        </div>

        {/* Dispatch Items */}
        <div className={cardClass}>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Dispatch Items</h2>
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">#</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Product</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-700">Dispatch Qty</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-700">UOM</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item: any, idx: number) => (
                  <tr key={idx} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-600">{idx + 1}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{item.product_name}</td>
                    <td className="px-4 py-3 text-center text-gray-700 font-semibold">
                      {Number(item.dispatch_qty || 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600">{item.uom}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Remarks */}
        <div className={cardClass}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">Remarks</h2>
            <button
              type="button"
              onClick={() => setIsEditing(!isEditing)}
              className="text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <Edit2 className="w-4 h-4" />
              {isEditing ? "Cancel" : "Edit"}
            </button>
          </div>

          {isEditing ? (
            <div className="space-y-3">
              <textarea
                value={editRemarks}
                onChange={(e) => setEditRemarks(e.target.value)}
                rows={4}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveRemarks}
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  Save
                </button>
              </div>
            </div>
          ) : (
            <p className="text-gray-700 whitespace-pre-wrap">{dispatch.remarks || "No remarks"}</p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={() => navigate("/dispatches")}
            className="px-6 py-2 rounded-lg border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50"
          >
            Back
          </button>
          {dispatch.status !== "completed" && (
            <>
              <button
                type="button"
                onClick={handleGenerateInvoice}
                className="px-6 py-2 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700"
              >
                Generate Invoice
              </button>
              <button
                type="button"
                onClick={handleDeleteDispatch}
                className="px-6 py-2 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
