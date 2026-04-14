import { useEffect, useMemo, useState } from "react";
import Layout from "../components/layout/Layout";
import api from "../api";
import { Link } from "react-router-dom";

type PO = {
  id: number;
  po_number: string;
  vendor_name?: string | null;
  status?: string | null;
};

export default function GRN() {
  const [pos, setPos] = useState<PO[]>([]);
  const [loading, setLoading] = useState(false);
  const [postingId, setPostingId] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    api
      .getPurchaseOrders()
      .then((rows: any) => setPos(Array.isArray(rows) ? rows : []))
      .catch((e: any) => setErr(e?.message || "Failed to load POs"))
      .finally(() => setLoading(false));
  }, []);

  const openPos = useMemo(
    () => pos.filter((p) => (p.status || "").toLowerCase() !== "cancelled"),
    [pos],
  );

  async function postGrn(poId: number) {
    try {
      setPostingId(poId);
      setErr(null);
      const resp = await api.postGrnFromPo(poId, {});
      // Soft refresh list; user can open PO view for exact progress
      console.log("GRN posted:", resp);
      alert(resp?.message || `GRN posted for PO ${poId}`);
    } catch (e: any) {
      setErr(e?.message || "Failed to post GRN");
    } finally {
      setPostingId(null);
    }
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto p-8 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">GRN (Inward)</h1>
            <p className="text-sm text-slate-600 mt-1">
              Posts stock inward from received quantities on Purchase Orders. This is idempotent (posts only new deltas).
            </p>
          </div>
        </div>

        {err && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{err}</div>
        )}

        <div className="bg-white border rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b flex items-center justify-between">
            <div className="font-semibold text-slate-900">Purchase Orders</div>
            <div className="text-xs text-slate-500">{loading ? "Loading…" : `${openPos.length} records`}</div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">PO No</th>
                  <th className="text-left px-4 py-3 font-semibold">Vendor</th>
                  <th className="text-left px-4 py-3 font-semibold">Status</th>
                  <th className="text-right px-4 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {openPos.map((po) => (
                  <tr key={po.id} className="border-t">
                    <td className="px-4 py-3">
                      <Link className="text-indigo-700 hover:underline" to={`/purchase-orders/${po.id}`}>
                        {po.po_number}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{po.vendor_name || "—"}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex px-2 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold">
                        {po.status || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => postGrn(po.id)}
                        disabled={postingId === po.id}
                        className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {postingId === po.id ? "Posting…" : "Post GRN"}
                      </button>
                    </td>
                  </tr>
                ))}

                {!loading && openPos.length === 0 && (
                  <tr>
                    <td className="px-4 py-10 text-center text-slate-500" colSpan={4}>
                      No purchase orders found.
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

