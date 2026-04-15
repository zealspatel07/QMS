import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Layout from "../components/layout/Layout";
import api from "../api";
import { toast } from "react-toastify";

const cardClass = "bg-white rounded-2xl border border-slate-200 shadow-sm p-5";

export default function InvoiceEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const invoiceId = Number(id);
  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    invoice_date: "",
    due_date: "",
    terms: "",
    notes: "",
    status: "issued",
  });

  const load = async () => {
    try {
      setLoading(true);
      const data = await api.getInvoiceById(invoiceId);
      setInvoice(data);
      setForm({
        invoice_date: data?.invoice_date || "",
        due_date: data?.due_date || "",
        terms: data?.terms || "",
        notes: data?.notes || "",
        status: data?.status || "issued",
      });
    } catch (e: any) {
      toast.error(e?.message || "Failed to load invoice");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (invoiceId) load();
  }, [invoiceId]);

  const items = useMemo(() => (Array.isArray(invoice?.items) ? invoice.items : []), [invoice]);

  const save = async () => {
    try {
      setSaving(true);
      await api.updateInvoice(invoiceId, form);
      toast.success("Invoice updated");
      navigate(`/invoices/${invoiceId}`);
    } catch (e: any) {
      toast.error(e?.message || "Failed to update invoice");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto p-4 sm:p-8 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Edit Invoice</h1>
            <p className="text-sm text-slate-600 mt-1">{invoice?.invoice_no || "Loading invoice..."}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => navigate(`/invoices/${invoiceId}`)} className="px-4 py-2 rounded-lg border">Cancel</button>
            <button onClick={save} disabled={saving || loading} className="px-4 py-2 rounded-lg bg-indigo-600 text-white disabled:opacity-50">
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className={cardClass}>
              <h2 className="text-lg font-semibold mb-4">Invoice Controls</h2>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-600">Invoice Date</label>
                  <input type="date" value={form.invoice_date} onChange={(e) => setForm((s) => ({ ...s, invoice_date: e.target.value }))} className="mt-1 w-full rounded-xl border px-4 py-3" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Due Date</label>
                  <input type="date" value={form.due_date} onChange={(e) => setForm((s) => ({ ...s, due_date: e.target.value }))} className="mt-1 w-full rounded-xl border px-4 py-3" />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs font-semibold text-slate-600">Status</label>
                  <select value={form.status} onChange={(e) => setForm((s) => ({ ...s, status: e.target.value }))} className="mt-1 w-full rounded-xl border px-4 py-3">
                    <option value="draft">Draft</option>
                    <option value="issued">Issued</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs font-semibold text-slate-600">Terms</label>
                  <textarea value={form.terms} onChange={(e) => setForm((s) => ({ ...s, terms: e.target.value }))} rows={4} className="mt-1 w-full rounded-xl border px-4 py-3" />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs font-semibold text-slate-600">Notes</label>
                  <textarea value={form.notes} onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))} rows={4} className="mt-1 w-full rounded-xl border px-4 py-3" />
                </div>
              </div>
            </div>

            <div className={cardClass}>
              <h2 className="text-lg font-semibold mb-4">Invoice Items</h2>
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left">Product</th>
                      <th className="px-4 py-3 text-left">UOM</th>
                      <th className="px-4 py-3 text-right">Qty</th>
                      <th className="px-4 py-3 text-right">Rate</th>
                      <th className="px-4 py-3 text-right">Tax</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it: any, idx: number) => (
                      <tr key={idx} className="border-t">
                        <td className="px-4 py-3">{it.product_name || `#${it.product_id}`}</td>
                        <td className="px-4 py-3">{it.uom || "-"}</td>
                        <td className="px-4 py-3 text-right">{Number(it.qty || 0).toFixed(2)}</td>
                        <td className="px-4 py-3 text-right">{Number(it.unit_price || 0).toFixed(2)}</td>
                        <td className="px-4 py-3 text-right">{Number(it.tax_rate || 0).toFixed(2)}%</td>
                        <td className="px-4 py-3 text-right">{(Number(it.qty || 0) * Number(it.unit_price || 0)).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className={cardClass}>
            <h2 className="text-lg font-semibold mb-4">Customer Snapshot</h2>
            <div className="space-y-3 text-sm">
              <div><span className="text-slate-500">Company</span><div className="font-semibold">{invoice?.customer_snapshot?.company_name || "-"}</div></div>
              <div><span className="text-slate-500">Location</span><div className="font-semibold">{invoice?.customer_snapshot?.location_name || "-"}</div></div>
              <div><span className="text-slate-500">GSTIN</span><div className="font-semibold">{invoice?.customer_snapshot?.gstin || "-"}</div></div>
              <div><span className="text-slate-500">Contact</span><div className="font-semibold">{invoice?.customer_snapshot?.contact_name || "-"}</div></div>
              <div><span className="text-slate-500">Phone</span><div className="font-semibold">{invoice?.customer_snapshot?.phone || "-"}</div></div>
              <div><span className="text-slate-500">Email</span><div className="font-semibold break-all">{invoice?.customer_snapshot?.email || "-"}</div></div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
