import { useEffect, useMemo, useState } from "react";
import Layout from "../components/layout/Layout";
import api from "../api";

export default function InStockView() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [posting, setPosting] = useState(false);
  const [productId, setProductId] = useState<number | "">("");
  const [qty, setQty] = useState<string>("");
  const [unitCost, setUnitCost] = useState<string>("");
  const [remarks, setRemarks] = useState<string>("");
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  useEffect(() => {
    setLoading(true);
    api
      .getInStock({ q, limit: 300, only_positive: true })
      .then((r) => setRows(Array.isArray(r) ? r : []))
      .catch((e: any) => setErr(e?.message || "Failed to load stock"))
      .finally(() => setLoading(false));
  }, [q]);

  useEffect(() => {
    api
      .getProducts()
      .then((r: any) => setProducts(Array.isArray(r) ? r : []))
      .catch(() => {});
  }, []);

  async function postInward() {
    try {
      setPosting(true);
      setErr(null);
      const pid = Number(productId);
      const qn = Number(qty);
      const cost = unitCost !== "" ? Number(unitCost) : undefined;
      if (!Number.isFinite(pid) || pid <= 0) {
        setErr("Select a product.");
        return;
      }
      if (!Number.isFinite(qn) || qn <= 0) {
        setErr("Quantity must be > 0.");
        return;
      }

      await api.postManualStockInward({
        grn_date: today,
        remarks: remarks || "Manual stock inward",
        items: [
          {
            product_id: pid,
            quantity: qn,
            unit_cost: cost,
            remarks: remarks || undefined,
          },
        ],
      });

      setModalOpen(false);
      setProductId("");
      setQty("");
      setUnitCost("");
      setRemarks("");

      // Refresh stock view
      setLoading(true);
      const refreshed = await api.getInStock({ q, limit: 300, only_positive: true });
      setRows(Array.isArray(refreshed) ? refreshed : []);
    } catch (e: any) {
      setErr(e?.message || "Failed to post stock inward");
    } finally {
      setPosting(false);
      setLoading(false);
    }
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto p-8 space-y-4">
        <h1 className="text-2xl font-semibold text-slate-900">In Stock View</h1>
        <p className="text-sm text-slate-600">Live availability per product (calculated from ledger).</p>

        {err && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{err}</div>}

        <div className="bg-white border rounded-xl p-4 flex flex-wrap items-end justify-between gap-3">
          <div className="w-full max-w-md">
            <label className="text-xs font-semibold text-slate-600">Search</label>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="block w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="Product name / HSN…"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700"
            >
              + Add Stock
            </button>
            <div className="text-xs text-slate-500">{loading ? "Loading…" : `${rows.length} products`}</div>
          </div>
        </div>

        <div className="bg-white border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Product</th>
                  <th className="text-left px-4 py-3 font-semibold">HSN</th>
                  <th className="text-left px-4 py-3 font-semibold">UOM</th>
                  <th className="text-right px-4 py-3 font-semibold">Available</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.product_id} className="border-t">
                    <td className="px-4 py-3 font-semibold text-slate-900">{r.product_name}</td>
                    <td className="px-4 py-3 text-slate-600">{r.hsn_code || "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{r.uom || "—"}</td>
                    <td className="px-4 py-3 text-right font-semibold">{Number(r.available_qty || 0).toFixed(3)}</td>
                  </tr>
                ))}
                {!loading && rows.length === 0 && (
                  <tr>
                    <td className="px-4 py-10 text-center text-slate-500" colSpan={4}>
                      No products found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-lg shadow-xl">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <div>
                <div className="text-lg font-semibold text-slate-900">Add Stock (Manual Inward)</div>
                <div className="text-sm text-slate-600 mt-1">
                  Posts an <b>IN</b> entry to the stock ledger. Use for opening stock or adjustments.
                </div>
              </div>
              <button className="px-3 py-2 rounded-lg border" onClick={() => setModalOpen(false)} type="button">
                Close
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-600">Product</label>
                <select
                  value={productId}
                  onChange={(e) => setProductId(e.target.value ? Number(e.target.value) : "")}
                  className="block w-full border rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">Select product…</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600">Quantity</label>
                  <input
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    className="block w-full border rounded-lg px-3 py-2 text-sm"
                    placeholder="e.g. 10"
                    inputMode="decimal"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Unit cost (optional)</label>
                  <input
                    value={unitCost}
                    onChange={(e) => setUnitCost(e.target.value)}
                    className="block w-full border rounded-lg px-3 py-2 text-sm"
                    placeholder="e.g. 1250"
                    inputMode="decimal"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600">Remarks</label>
                <input
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="block w-full border rounded-lg px-3 py-2 text-sm"
                  placeholder="Opening stock / adjustment reason…"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t flex justify-end gap-2">
              <button className="px-4 py-2 rounded-lg border" onClick={() => setModalOpen(false)} type="button" disabled={posting}>
                Cancel
              </button>
              <button
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-semibold disabled:opacity-50"
                onClick={postInward}
                type="button"
                disabled={posting}
              >
                {posting ? "Posting…" : "Post Stock Inward"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

