import { useEffect, useState } from "react";
import Layout from "../components/layout/Layout";
import api from "../api";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

export default function Invoices() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const load = () => {
    setLoading(true);
    setErr(null);
    api
      .getInvoices({ limit: 200 })
      .then((r) => setRows(Array.isArray(r) ? r : []))
      .catch((e: any) => setErr(e?.message || "Failed to load invoices"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const interval = window.setInterval(load, 20000);
    return () => window.clearInterval(interval);
  }, []);

  const handleDelete = async (id: number) => {
    if (!window.confirm("Delete this invoice?")) return;
    try {
      setDeletingId(id);
      await api.deleteInvoice(id);
      toast.success("Invoice deleted");
      load();
    } catch (e: any) {
      toast.error(e?.message || "Failed to delete invoice");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto p-8 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Invoices</h1>
            <p className="text-sm text-slate-600 mt-1">Modern ERP billing register with create, view, edit, print and payment tracking.</p>
          </div>
          <button onClick={() => navigate("/invoices/create")} className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold">
            Create Invoice
          </button>
        </div>
        {err && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{err}</div>}

        <div className="grid md:grid-cols-4 gap-4">
          <div className="bg-white border rounded-2xl p-4"><div className="text-xs text-slate-500">Invoices</div><div className="mt-2 text-2xl font-bold">{rows.length}</div></div>
          <div className="bg-white border rounded-2xl p-4"><div className="text-xs text-slate-500">Unpaid</div><div className="mt-2 text-2xl font-bold text-amber-600">{rows.filter((r) => r.payment_status === "unpaid").length}</div></div>
          <div className="bg-white border rounded-2xl p-4"><div className="text-xs text-slate-500">Partial</div><div className="mt-2 text-2xl font-bold text-indigo-600">{rows.filter((r) => r.payment_status === "partial").length}</div></div>
          <div className="bg-white border rounded-2xl p-4"><div className="text-xs text-slate-500">Paid</div><div className="mt-2 text-2xl font-bold text-emerald-600">{rows.filter((r) => r.payment_status === "paid").length}</div></div>
        </div>

        <div className="bg-white border rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b flex items-center justify-between">
            <div className="font-semibold">Invoices</div>
            <div className="text-xs text-slate-500">{loading ? "Loading…" : `${rows.length} records`}</div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Invoice No</th>
                  <th className="text-left px-4 py-3 font-semibold">Date</th>
                  <th className="text-left px-4 py-3 font-semibold">Reference</th>
                  <th className="text-left px-4 py-3 font-semibold">Payment</th>
                  <th className="text-left px-4 py-3 font-semibold">Status</th>
                  <th className="text-right px-4 py-3 font-semibold">Total</th>
                  <th className="text-right px-4 py-3 font-semibold">Paid</th>
                  <th className="text-right px-4 py-3 font-semibold">Balance</th>
                  <th className="text-right px-4 py-3 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((i) => (
                  <tr key={i.id} className="border-t">
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      <Link className="text-indigo-700 hover:underline" to={`/invoices/${i.id}`}>
                        {i.invoice_no}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{i.invoice_date || "—"}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      <div>Dispatch #{i.dispatch_id || "-"}</div>
                      <div>SO #{i.sales_order_id || "-"}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex px-2 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold">
                        {i.payment_status || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex px-2 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold">
                        {i.status || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">{Number(i.total_amount || 0).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right">{Number(i.amount_paid || 0).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right">{Number(i.balance_due || 0).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleDelete(Number(i.id))}
                        disabled={deletingId === Number(i.id)}
                        className="px-2 py-1 text-xs rounded border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {!loading && rows.length === 0 && (
                  <tr>
                    <td className="px-4 py-10 text-center text-slate-500" colSpan={9}>
                      No invoices found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
}

