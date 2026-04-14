import { useEffect, useState } from "react";
import Layout from "../components/layout/Layout";
import api from "../api";

export default function StockLedger() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    api
      .getStockLedger({ limit: 200 })
      .then((r) => setRows(Array.isArray(r) ? r : []))
      .catch((e: any) => setErr(e?.message || "Failed to load stock ledger"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Layout>
      <div className="max-w-6xl mx-auto p-8 space-y-4">
        <h1 className="text-2xl font-semibold text-slate-900">Stock Ledger</h1>
        <p className="text-sm text-slate-600">Single source of truth. Stock = SUM(IN) − SUM(OUT).</p>

        {err && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{err}</div>}

        <div className="bg-white border rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b flex items-center justify-between">
            <div className="font-semibold">Latest transactions</div>
            <div className="text-xs text-slate-500">{loading ? "Loading…" : `${rows.length} records`}</div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Date</th>
                  <th className="text-left px-4 py-3 font-semibold">Product</th>
                  <th className="text-left px-4 py-3 font-semibold">Type</th>
                  <th className="text-left px-4 py-3 font-semibold">Dir</th>
                  <th className="text-right px-4 py-3 font-semibold">Qty</th>
                  <th className="text-left px-4 py-3 font-semibold">Ref</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-4 py-3">{r.txn_date ? String(r.txn_date).slice(0, 19).replace("T", " ") : "—"}</td>
                    <td className="px-4 py-3">{r.product_name || `#${r.product_id}`}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex px-2 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold">
                        {r.txn_type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${
                          r.direction === "IN" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                        }`}
                      >
                        {r.direction}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">{Number(r.quantity || 0).toFixed(3)}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {r.ref_table ? `${r.ref_table}#${r.ref_id ?? ""}` : "—"}
                    </td>
                  </tr>
                ))}
                {!loading && rows.length === 0 && (
                  <tr>
                    <td className="px-4 py-10 text-center text-slate-500" colSpan={6}>
                      No ledger entries found.
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

