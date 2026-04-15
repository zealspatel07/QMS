import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/layout/Layout";
import api from "../api";
import { toast } from "react-toastify";

const cardClass = "bg-white rounded-2xl border border-slate-200 shadow-sm p-5";

export default function InvoiceCreate() {
  const navigate = useNavigate();
  const [dispatches, setDispatches] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedDispatchId, setSelectedDispatchId] = useState<number | "">("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [terms, setTerms] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [dispatchRows, invoiceRows] = await Promise.all([
          api.getDispatches({ limit: 300 }),
          api.getInvoices({ limit: 300 }),
        ]);
        setDispatches(Array.isArray(dispatchRows) ? dispatchRows : []);
        setInvoices(Array.isArray(invoiceRows) ? invoiceRows : []);
      } catch (e: any) {
        toast.error(e?.message || "Failed to load invoice creation data");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const invoicedDispatchIds = useMemo(
    () => new Set((invoices || []).map((inv: any) => Number(inv.dispatch_id)).filter(Boolean)),
    [invoices],
  );

  const eligibleDispatches = useMemo(
    () => dispatches.filter((d) => !invoicedDispatchIds.has(Number(d.id))),
    [dispatches, invoicedDispatchIds],
  );

  const selectedDispatch = eligibleDispatches.find((d) => Number(d.id) === Number(selectedDispatchId));

  const createInvoice = async () => {
    const dispatchId = Number(selectedDispatchId);
    if (!Number.isFinite(dispatchId) || dispatchId <= 0) {
      toast.error("Select a dispatch");
      return;
    }
    try {
      setSaving(true);
      const result = await api.createInvoiceFromDispatch(dispatchId, {
        invoice_date: invoiceDate || null,
        due_date: dueDate || null,
        terms: terms || null,
        notes: notes || null,
      });
      toast.success(`Invoice ${result?.invoice_no || ""} created`);
      navigate(`/invoices/${result?.id}`);
    } catch (e: any) {
      toast.error(e?.message || "Failed to create invoice");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto p-4 sm:p-8 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Create Invoice</h1>
            <p className="text-sm text-slate-600 mt-1">Generate a professional invoice from dispatch-ready operational records.</p>
          </div>
          <button onClick={() => navigate("/invoices")} className="px-4 py-2 rounded-lg border">Back</button>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className={cardClass}>
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Select Dispatch</h2>
              <select
                value={selectedDispatchId}
                onChange={(e) => setSelectedDispatchId(e.target.value ? Number(e.target.value) : "")}
                className="w-full rounded-xl border border-slate-300 px-4 py-3"
              >
                <option value="">Choose dispatch...</option>
                {eligibleDispatches.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.dispatch_no} | {d.so_number || `SO ${d.sales_order_id}`} | {d.customer_name || "Customer"}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500 mt-2">{loading ? "Loading dispatches..." : `${eligibleDispatches.length} dispatches available for invoicing`}</p>
            </div>

            <div className={cardClass}>
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Commercial Details</h2>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-600">Invoice Date</label>
                  <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} className="mt-1 w-full rounded-xl border px-4 py-3" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Due Date</label>
                  <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="mt-1 w-full rounded-xl border px-4 py-3" />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs font-semibold text-slate-600">Terms & Conditions</label>
                  <textarea value={terms} onChange={(e) => setTerms(e.target.value)} rows={4} className="mt-1 w-full rounded-xl border px-4 py-3" placeholder="Payment terms, delivery terms, tax note..." />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs font-semibold text-slate-600">Internal / Client Notes</label>
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} className="mt-1 w-full rounded-xl border px-4 py-3" placeholder="Special billing instructions, narration, project note..." />
                </div>
              </div>
            </div>
          </div>

          <div className={cardClass}>
            <h2 className="text-lg font-semibold text-slate-900 mb-4">ERP Summary</h2>
            {!selectedDispatch ? (
              <p className="text-sm text-slate-500">Select a dispatch to review sales-order context before generating the invoice.</p>
            ) : (
              <div className="space-y-3 text-sm">
                <div><span className="text-slate-500">Dispatch</span><div className="font-semibold">{selectedDispatch.dispatch_no}</div></div>
                <div><span className="text-slate-500">Sales Order</span><div className="font-semibold">{selectedDispatch.so_number || `SO ${selectedDispatch.sales_order_id}`}</div></div>
                <div><span className="text-slate-500">Dispatch Date</span><div className="font-semibold">{selectedDispatch.dispatch_date || "-"}</div></div>
                <div><span className="text-slate-500">Status</span><div className="font-semibold">{selectedDispatch.status || "-"}</div></div>
              </div>
            )}

            <button
              type="button"
              onClick={createInvoice}
              disabled={saving || !selectedDispatchId}
              className="mt-6 w-full rounded-xl bg-indigo-600 text-white font-semibold px-4 py-3 disabled:opacity-50"
            >
              {saving ? "Creating..." : "Generate Invoice"}
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
