import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Layout from "../components/layout/Layout";
import api from "../api";
import { toast } from "react-toastify";
import { Edit2, Trash2, Check, ArrowRight } from "lucide-react";

const cardClass = "bg-white rounded-xl border border-gray-200 p-6";

export default function SalesOrderView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const soId = Number(id);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [salesOrder, setSalesOrder] = useState<any>(null);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [editNotes, setEditNotes] = useState("");
  const [isEditingTerms, setIsEditingTerms] = useState(false);
  const [editTerms, setEditTerms] = useState("");
  const [saving, setSaving] = useState(false);

  // Load sales order details
  useEffect(() => {
    loadSO();
  }, [soId]);

  const loadSO = async () => {
    if (!Number.isFinite(soId) || soId <= 0) {
      setErr("Invalid sales order ID");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setErr(null);
      const data = await api.getSalesOrder(soId);
      setSalesOrder(data);
      setEditNotes(data?.notes || "");
      setEditTerms(data?.terms || "");
    } catch (e: any) {
      setErr(e?.message || "Failed to load sales order");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!salesOrder) return;

    setSaving(true);
    try {
      await api.updateSalesOrder(soId, { notes: editNotes });
      setSalesOrder((prev: any) => ({ ...prev, notes: editNotes }));
      setIsEditingNotes(false);
      toast.success("Notes updated");
    } catch (e: any) {
      toast.error(e?.message || "Failed to update notes");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTerms = async () => {
    if (!salesOrder) return;

    setSaving(true);
    try {
      await api.updateSalesOrder(soId, { terms: editTerms });
      setSalesOrder((prev: any) => ({ ...prev, terms: editTerms }));
      setIsEditingTerms(false);
      toast.success("Terms updated");
    } catch (e: any) {
      toast.error(e?.message || "Failed to update terms");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSO = async () => {
    if (!window.confirm("Delete this sales order? This action cannot be undone.")) return;

    try {
      await api.deleteSalesOrder(soId);
      toast.success("Sales order deleted");
      navigate("/sales-orders");
    } catch (e: any) {
      toast.error(e?.message || "Failed to delete sales order");
    }
  };

  const handleConfirmSO = async () => {
    if (!salesOrder) return;

    try {
      await api.updateSalesOrder(soId, { status: "confirmed" });
      setSalesOrder((prev: any) => ({ ...prev, status: "confirmed" }));
      toast.success("Sales order confirmed");
    } catch (e: any) {
      toast.error(e?.message || "Failed to confirm sales order");
    }
  };

  const handleCreateDispatch = () => {
    navigate("/dispatch/create", { state: { fromSalesOrderId: soId } });
  };

  if (loading) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto p-8 text-center text-gray-500">Loading...</div>
      </Layout>
    );
  }

  if (err || !salesOrder) {
    return (
      <Layout>
        <div className="max-w-6xl mx-auto p-8">
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800">
            {err || "Sales order not found"}
          </div>
        </div>
      </Layout>
    );
  }

  const items = Array.isArray(salesOrder.items)
    ? salesOrder.items
    : typeof salesOrder.items === "string" && salesOrder.items.trim()
      ? JSON.parse(salesOrder.items)
      : [];

  const subtotal = items.reduce(
    (sum: number, item: any) => sum + (Number(item.qty) || 0) * (Number(item.unit_price) || 0),
    0
  );

  const taxTotal = items.reduce(
    (sum: number, item: any) =>
      sum +
      ((Number(item.qty) || 0) * (Number(item.unit_price) || 0) * (Number(item.tax_rate) || 0)) / 100,
    0
  );

  const grandTotal = subtotal + taxTotal;

  return (
    <Layout>
      <div className="max-w-7xl mx-auto p-4 sm:p-8 space-y-6">
        {/* Flow Breadcrumb */}
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4 border border-green-200">
          <p className="text-xs font-semibold text-gray-600 uppercase mb-3">Document Flow</p>
          <div className="flex items-center gap-2 text-sm overflow-x-auto pb-2">
            {salesOrder.enquiry_id && (
              <>
                <button
                  onClick={() => salesOrder.enquiry_id && navigate(`/enquiries/${salesOrder.enquiry_id}`)}
                  className="px-3 py-1 bg-white rounded-lg border border-gray-200 hover:border-green-400 text-gray-700 hover:text-green-600 font-medium whitespace-nowrap"
                >
                  ENQ #{salesOrder.enquiry_id}
                </button>
                <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
              </>
            )}
            {salesOrder.quotation_id && (
              <>
                <button
                  onClick={() => salesOrder.quotation_id && navigate(`/quotations/${salesOrder.quotation_id}`)}
                  className="px-3 py-1 bg-white rounded-lg border border-gray-200 hover:border-green-400 text-gray-700 hover:text-green-600 font-medium whitespace-nowrap"
                >
                  Q #{salesOrder.quotation_id}
                </button>
                <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
              </>
            )}
            <div className="px-3 py-1 bg-green-100 rounded-lg border border-green-300 text-green-700 font-medium whitespace-nowrap">
              SO #{salesOrder.so_number}
            </div>
          </div>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{salesOrder.so_number}</h1>
            <p className="text-gray-600 mt-2">
              {salesOrder.customer_snapshot?.company_name}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex px-3 py-1 rounded-full text-sm font-semibold ${
              salesOrder.status === "completed"
                ? "bg-green-100 text-green-800"
                : salesOrder.status === "confirmed"
                  ? "bg-blue-100 text-blue-800"
                  : "bg-yellow-100 text-yellow-800"
            }`}>
              {salesOrder.status || "—"}
            </span>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid md:grid-cols-4 gap-4">
          <div className={cardClass}>
            <p className="text-xs font-semibold uppercase text-gray-500">SO Date</p>
            <p className="text-lg font-bold text-gray-900 mt-2">
              {new Date(salesOrder.so_date || "").toLocaleDateString()}
            </p>
          </div>
          <div className={cardClass}>
            <p className="text-xs font-semibold uppercase text-gray-500">Customer</p>
            <p className="text-sm font-bold text-gray-900 mt-2">
              {salesOrder.customer_snapshot?.company_name || "—"}
            </p>
          </div>
          <div className={cardClass}>
            <p className="text-xs font-semibold uppercase text-gray-500">Total Value</p>
            <p className="text-lg font-bold text-gray-900 mt-2">
              ₹{Number(salesOrder.total_value || 0).toLocaleString()}
            </p>
          </div>
          <div className={cardClass}>
            <p className="text-xs font-semibold uppercase text-gray-500">Items</p>
            <p className="text-lg font-bold text-gray-900 mt-2">
              {items.length}
            </p>
          </div>
        </div>

        {/* Sales Order Items */}
        <div className={cardClass}>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Sales Order Items</h2>
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">#</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Product</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-700">Qty</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-700">UOM</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">Unit Price</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">Tax %</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item: any, idx: number) => (
                  <tr key={idx} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-600">{idx + 1}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      <div>{item.product_name}</div>
                      {item.description && (
                        <div className="text-xs text-gray-500 mt-1">{item.description}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-700">{Number(item.qty).toFixed(2)}</td>
                    <td className="px-4 py-3 text-center text-gray-600">{item.uom}</td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      ₹{Number(item.unit_price || 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {Number(item.tax_rate || 0).toFixed(1)}%
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">
                      ₹{((Number(item.qty) || 0) * (Number(item.unit_price) || 0)).toLocaleString()}
                    </td>
                  </tr>
                ))}
                <tr className="bg-gray-50 border-t">
                  <td colSpan={6} className="px-4 py-3 text-right font-semibold">
                    Subtotal:
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">
                    ₹{subtotal.toLocaleString()}
                  </td>
                </tr>
                <tr className="bg-gray-50">
                  <td colSpan={6} className="px-4 py-3 text-right font-semibold">
                    Tax:
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">
                    ₹{taxTotal.toLocaleString()}
                  </td>
                </tr>
                <tr className="bg-blue-50 border-t">
                  <td colSpan={6} className="px-4 py-3 text-right font-bold text-lg">
                    Grand Total:
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-lg text-blue-600">
                    ₹{grandTotal.toLocaleString()}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Terms */}
        <div className={cardClass}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">Terms & Conditions</h2>
            <button
              type="button"
              onClick={() => setIsEditingTerms(!isEditingTerms)}
              className="text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <Edit2 className="w-4 h-4" />
              {isEditingTerms ? "Cancel" : "Edit"}
            </button>
          </div>

          {isEditingTerms ? (
            <div className="space-y-3">
              <textarea
                value={editTerms}
                onChange={(e) => setEditTerms(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setIsEditingTerms(false)}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveTerms}
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  Save
                </button>
              </div>
            </div>
          ) : (
            <p className="text-gray-700 whitespace-pre-wrap">{salesOrder.terms || "No terms specified"}</p>
          )}
        </div>

        {/* Notes */}
        <div className={cardClass}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">Notes</h2>
            <button
              type="button"
              onClick={() => setIsEditingNotes(!isEditingNotes)}
              className="text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <Edit2 className="w-4 h-4" />
              {isEditingNotes ? "Cancel" : "Edit"}
            </button>
          </div>

          {isEditingNotes ? (
            <div className="space-y-3">
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setIsEditingNotes(false)}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveNotes}
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  Save
                </button>
              </div>
            </div>
          ) : (
            <p className="text-gray-700 whitespace-pre-wrap">{salesOrder.notes || "No notes"}</p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={() => navigate("/sales-orders")}
            className="px-6 py-2 rounded-lg border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50"
          >
            Back
          </button>
          {salesOrder.status !== "confirmed" && (
            <button
              type="button"
              onClick={handleConfirmSO}
              className="px-6 py-2 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700"
            >
              Confirm Order
            </button>
          )}
          {salesOrder.status === "confirmed" && (
            <button
              type="button"
              onClick={handleCreateDispatch}
              className="px-6 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700"
            >
              Create Dispatch
            </button>
          )}
          <button
            type="button"
            onClick={handleDeleteSO}
            className="px-6 py-2 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </div>
      </div>
    </Layout>
  );
}
