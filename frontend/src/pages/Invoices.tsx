import { useEffect, useState } from "react";
import Layout from "../components/layout/Layout";
import api from "../api";

export default function Invoices() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    api
      .getInvoices({ limit: 200 })
      .then((r) => setRows(Array.isArray(r) ? r : []))
      .catch((e: any) => setErr(e?.message || "Failed to load invoices"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Layout>
      <div className="max-w-6xl mx-auto p-8 space-y-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Invoices</h1>
          <p className="text-sm text-slate-600 mt-1">Generated from dispatch. Payment tracking supported.</p>
        </div>
        {err && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{err}</div>}

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
                  <th className="text-left px-4 py-3 font-semibold">Payment</th>
                  <th className="text-right px-4 py-3 font-semibold">Total</th>
                  <th className="text-right px-4 py-3 font-semibold">Paid</th>
                  <th className="text-right px-4 py-3 font-semibold">Balance</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((i) => (
                  <tr key={i.id} className="border-t">
                    <td className="px-4 py-3 font-semibold text-slate-900">{i.invoice_no}</td>
                    <td className="px-4 py-3">{i.invoice_date || "—"}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex px-2 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold">
                        {i.payment_status || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">{Number(i.total_amount || 0).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right">{Number(i.amount_paid || 0).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right">{Number(i.balance_due || 0).toFixed(2)}</td>
                  </tr>
                ))}
                {!loading && rows.length === 0 && (
                  <tr>
                    <td className="px-4 py-10 text-center text-slate-500" colSpan={6}>
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

