import { useEffect, useMemo, useState } from "react";
import Layout from "../components/layout/Layout";
import api from "../api";
import { Link, useNavigate } from "react-router-dom";
import { Eye, Pencil, Plus, RefreshCw, Search, Trash2, FileText } from "lucide-react";
import { EnquiryStatusBadge, PageHero, PrimaryButton, subtleCard } from "./enquiry/enquiryUi";

function formatDate(v: string | null | undefined) {
  if (!v) return "—";
  try {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return String(v).slice(0, 10);
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return String(v);
  }
}

export default function Enquiries() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [q, setQ] = useState("");
  const navigate = useNavigate();

  const load = () => {
    setLoading(true);
    setErr(null);
    api
      .getEnquiries({
        limit: 300,
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(q.trim() ? { q: q.trim() } : {}),
      })
      .then((r) => setRows(Array.isArray(r) ? r : []))
      .catch((e: any) => setErr(e?.message || "Failed to load enquiries"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const t = window.setTimeout(() => {
      load();
    }, q.trim() ? 280 : 0);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, q]);

  const stats = useMemo(() => {
    const open = rows.filter((r) => (r.status || "").toLowerCase() === "open").length;
    const quoted = rows.filter((r) => (r.status || "").toLowerCase() === "quoted").length;
    const lost = rows.filter((r) => (r.status || "").toLowerCase() === "lost").length;
    return { open, quoted, lost, total: rows.length };
  }, [rows]);

  const onDelete = async (id: number) => {
    if (!window.confirm("Delete this enquiry?")) return;
    setErr(null);
    try {
      const res: any = await api.deleteEnquiry(id);
      if (!res?.success) throw new Error("Failed to delete enquiry");
      load();
    } catch (e: any) {
      setErr(e?.message || "Failed to delete enquiry");
    }
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto p-4 sm:p-8 space-y-6">
        <PageHero
          eyebrow="Sales"
          title="Enquiries"
          subtitle="Track leads before they become quotations. Filter, open a record, or start a new enquiry."
          right={
            <>
              <PrimaryButton variant="secondary" onClick={load} disabled={loading}>
                <span className="inline-flex items-center gap-2">
                  <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                  Refresh
                </span>
              </PrimaryButton>
              <PrimaryButton onClick={() => navigate("/enquiries/create")} disabled={loading}>
                <span className="inline-flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  New enquiry
                </span>
              </PrimaryButton>
            </>
          }
        />

        {err && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</div>}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className={subtleCard}>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">In pipeline</div>
            <div className="text-2xl font-bold text-slate-900 mt-0.5">{stats.open}</div>
            <div className="text-xs text-slate-500">Open</div>
          </div>
          <div className={subtleCard}>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Quoted</div>
            <div className="text-2xl font-bold text-violet-700 mt-0.5">{stats.quoted}</div>
            <div className="text-xs text-slate-500">Draft / sent</div>
          </div>
          <div className={subtleCard}>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Lost</div>
            <div className="text-2xl font-bold text-red-600 mt-0.5">{stats.lost}</div>
            <div className="text-xs text-slate-500">Not proceeding</div>
          </div>
          <div className={subtleCard}>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Listed</div>
            <div className="text-2xl font-bold text-slate-900 mt-0.5">{stats.total}</div>
            <div className="text-xs text-slate-500">Current result set</div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-400"
                placeholder="Search enquiry no, customer, source…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 uppercase">Status</span>
              {["", "open", "quoted", "lost", "closed"].map((s) => (
                <button
                  key={s || "all"}
                  type="button"
                  onClick={() => setStatusFilter(s)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    statusFilter === s ? "bg-indigo-600 text-white shadow-sm" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {s ? s : "All"}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500 bg-slate-50/90 border-b border-slate-100">
                  <th className="px-4 py-3">Enquiry</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={e.id} className="border-b border-slate-50 hover:bg-indigo-50/30 transition-colors">
                    <td className="px-4 py-3">
                      <Link to={`/enquiries/${e.id}`} className="font-semibold text-indigo-700 hover:underline">
                        {e.enquiry_no}
                      </Link>
                      {e.source && <div className="text-[11px] text-slate-500 mt-0.5 truncate max-w-[200px]">{e.source}</div>}
                    </td>
                    <td className="px-4 py-3 text-slate-800">{e.customer_name || "—"}</td>
                    <td className="px-4 py-3 text-slate-600 tabular-nums">{formatDate(e.enquiry_date)}</td>
                    <td className="px-4 py-3">
                      <EnquiryStatusBadge status={e.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center justify-end gap-0.5 sm:gap-1 flex-wrap">
                        <Link
                          to={`/enquiries/${e.id}`}
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-200"
                          title="View"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">View</span>
                        </Link>
                        <Link
                          to={`/enquiries/${e.id}/edit`}
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-200"
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Edit</span>
                        </Link>
                        <Link
                          to="/create-quotation"
                          state={{ fromEnquiryId: e.id }}
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-white hover:shadow-sm border border-transparent hover:border-indigo-100"
                          title="Create quotation from this enquiry"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">New quote</span>
                        </Link>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 border border-transparent hover:border-red-100 disabled:opacity-50"
                          onClick={() => onDelete(Number(e.id))}
                          disabled={loading}
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && rows.length === 0 && (
                  <tr>
                    <td className="px-4 py-16 text-center text-slate-500" colSpan={5}>
                      No enquiries match your filters. Try clearing search or create a new enquiry.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 text-xs text-slate-500 border-t border-slate-100 bg-slate-50/50">
            {loading ? "Loading…" : `${rows.length} enquiries`}
          </div>
        </div>
      </div>
    </Layout>
  );
}
