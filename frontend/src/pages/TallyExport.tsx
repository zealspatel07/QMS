import { useState } from "react";
import Layout from "../components/layout/Layout";
import api from "../api";

export default function TallyExport() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [json, setJson] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    try {
      setLoading(true);
      setErr(null);
      const resp = await api.exportInvoicesForTally(from && to ? { from, to } : {});
      setJson(resp);
    } catch (e: any) {
      setErr(e?.message || "Export failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto p-8 space-y-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Tally Export</h1>
          <p className="text-sm text-slate-600 mt-1">Exports invoices as JSON (temporary integration).</p>
        </div>

        {err && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{err}</div>}

        <div className="bg-white border rounded-xl p-5 flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs text-slate-600 font-semibold">From</label>
            <input value={from} onChange={(e) => setFrom(e.target.value)} type="date" className="block border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-slate-600 font-semibold">To</label>
            <input value={to} onChange={(e) => setTo(e.target.value)} type="date" className="block border rounded-lg px-3 py-2 text-sm" />
          </div>
          <button
            onClick={run}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? "Exporting…" : "Export JSON"}
          </button>
        </div>

        {json && (
          <div className="bg-white border rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b font-semibold">JSON Preview</div>
            <pre className="p-4 text-xs overflow-auto max-h-[520px]">{JSON.stringify(json, null, 2)}</pre>
          </div>
        )}
      </div>
    </Layout>
  );
}

