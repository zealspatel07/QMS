import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Layout from "../components/layout/Layout";
import api from "../api";
import { useAuth } from "../context/AuthContext";
import {
  Building2,
  Calendar,
  FileText,
  Hash,
  Layers,
  MapPin,
  Phone,
  StickyNote,
  User,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import {
  cardClass,
  EnquiryFlowRail,
  EnquiryStatusBadge,
  PageHero,
  PrimaryButton,
  SectionTitle,
  subtleCard,
} from "./enquiry/enquiryUi";

type TabKey = "overview" | "customer" | "items";

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

export default function EnquiryView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { permissions } = useAuth();
  const enquiryId = Number(id);

  const [tab, setTab] = useState<TabKey>("overview");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);

  const load = () => {
    if (!Number.isFinite(enquiryId) || enquiryId <= 0) {
      setErr("Invalid enquiry");
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr(null);
    api
      .getEnquiry(enquiryId)
      .then((r) => setData(r))
      .catch((e: any) => setErr(e?.message || "Failed to load enquiry"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enquiryId]);

  const items = useMemo(() => {
    const raw = data?.items;
    if (Array.isArray(raw)) return raw;
    if (raw == null) return [];
    if (typeof raw === "string" && raw.trim()) {
      try {
        const p = JSON.parse(raw);
        return Array.isArray(p) ? p : [];
      } catch {
        return [];
      }
    }
    return [];
  }, [data?.items]);
  const totalQty = useMemo(() => items.reduce((s: number, it: any) => s + Number(it?.qty ?? it?.quantity ?? 0), 0), [items]);

  const cust = data?.customer_snapshot;
  const loc = data?.location_snapshot;
  const ct = data?.contact_snapshot;

  const customerDisplayName = data?.customer_name || cust?.company_name || "—";
  const locationLine = loc?.location_name || loc?.address || "—";
  const contactLine = ct?.contact_name ? `${ct.contact_name}${ct.phone ? ` · ${ct.phone}` : ""}${ct.email ? ` · ${ct.email}` : ""}` : "—";

  const goToCreateQuotation = () => {
    if (!permissions.canCreateQuotation) return;
    navigate("/create-quotation", { state: { fromEnquiryId: enquiryId } });
  };

  const onDelete = async () => {
    if (!window.confirm("Delete this enquiry permanently?")) return;
    try {
      const res: any = await api.deleteEnquiry(enquiryId);
      if (!res?.success) throw new Error("Delete failed");
      navigate("/enquiries");
    } catch (e: any) {
      setErr(e?.message || "Delete failed");
    }
  };

  if (!Number.isFinite(enquiryId) || enquiryId <= 0) {
    return (
      <Layout>
        <div className="max-w-5xl mx-auto p-8">
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">Invalid enquiry id.</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto p-4 sm:p-8 space-y-6">
        <PageHero
          eyebrow="Sales pipeline"
          title={loading ? "Loading enquiry…" : data?.enquiry_no || "Enquiry"}
          subtitle={
            loading
              ? "Fetching details…"
              : `${customerDisplayName} · ${formatDate(data?.enquiry_date)}${data?.source ? ` · Source: ${data.source}` : ""}`
          }
          right={
            <>
              <PrimaryButton variant="secondary" onClick={() => navigate("/enquiries")}>
                Back to list
              </PrimaryButton>
              <PrimaryButton variant="secondary" onClick={load} disabled={loading}>
                <span className="inline-flex items-center gap-2">
                  <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                  Refresh
                </span>
              </PrimaryButton>
              <PrimaryButton variant="secondary" onClick={() => navigate(`/enquiries/${enquiryId}/edit`)} disabled={loading || !data}>
                Edit
              </PrimaryButton>
              {permissions.canCreateQuotation && data?.status === "open" && (
                <PrimaryButton onClick={goToCreateQuotation} disabled={loading || !data}>
                  <span className="inline-flex items-center gap-2">
                    Create quotation
                    <ArrowRight className="w-4 h-4" />
                  </span>
                </PrimaryButton>
              )}
              {permissions.canCreateQuotation && data?.status === "quoted" && (
                <PrimaryButton 
                  onClick={() => navigate("/quotations")} 
                  variant="secondary"
                  disabled={loading || !data}
                >
                  <span className="inline-flex items-center gap-2">
                    📋 View quotations
                  </span>
                </PrimaryButton>
              )}
              <PrimaryButton variant="danger" onClick={onDelete} disabled={loading || !data}>
                Delete
              </PrimaryButton>
            </>
          }
        />

        {err && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</div>}

        {!loading && data && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className={subtleCard}>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Status</div>
                <div className="mt-1">
                  <EnquiryStatusBadge status={data.status} />
                </div>
              </div>
              <div className={subtleCard}>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Line items</div>
                <div className="mt-1 text-lg font-bold text-slate-900">{items.length}</div>
              </div>
              <div className={subtleCard}>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Total qty</div>
                <div className="mt-1 text-lg font-bold text-slate-900">{totalQty || "—"}</div>
              </div>
              <div className={subtleCard}>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Owner</div>
                <div className="mt-1 text-sm font-semibold text-slate-900 truncate">{data.created_by_name || (data.created_by ? `#${data.created_by}` : "—")}</div>
              </div>
            </div>

            <div className={cardClass + " p-5"}>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Pipeline</div>
              <EnquiryFlowRail status={data.status} />
              <p className="text-xs text-slate-500 mt-3">
                Typical flow: capture enquiry, open Create quotation with lines prefilled, then submit when ready.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-1">
              {(
                [
                  ["overview", "Overview", Hash],
                  ["customer", "Customer & site", Building2],
                  ["items", "Items", Layers],
                ] as const
              ).map(([key, label, Icon]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className={`inline-flex items-center gap-2 rounded-t-lg px-4 py-2 text-sm font-semibold transition ${
                    tab === key ? "bg-white text-indigo-700 border border-b-0 border-slate-200 shadow-sm" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Icon className="w-4 h-4 opacity-80" />
                  {label}
                </button>
              ))}
            </div>

            {tab === "overview" && (
              <div className={cardClass}>
                <SectionTitle icon={<Calendar className="w-4 h-4" />} title="Summary" subtitle="Key fields and internal notes" />
                <div className="p-6 grid sm:grid-cols-2 gap-4 text-sm">
                  <div className="space-y-1">
                    <div className="text-slate-500 text-xs font-medium">Enquiry date</div>
                    <div className="font-semibold text-slate-900">{formatDate(data.enquiry_date)}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-slate-500 text-xs font-medium">Source</div>
                    <div className="font-semibold text-slate-900">{data.source || "—"}</div>
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <div className="text-slate-500 text-xs font-medium inline-flex items-center gap-1">
                      <StickyNote className="w-3.5 h-3.5" /> Notes
                    </div>
                    <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3 text-slate-800 whitespace-pre-wrap">{data.notes?.trim() ? data.notes : "No notes."}</div>
                  </div>
                  {data.status === "lost" && data.lost_reason && (
                    <div className="space-y-1 sm:col-span-2">
                      <div className="text-red-700 text-xs font-medium">Lost reason</div>
                      <div className="rounded-xl border border-red-100 bg-red-50/50 px-4 py-3 text-red-900 whitespace-pre-wrap">{data.lost_reason}</div>
                    </div>
                  )}
                </div>
                <div className="px-6 pb-6 flex flex-wrap gap-3">
                  {data.status === "quoted" && (
                    <div className="w-full rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 flex items-center gap-2">
                      <span className="text-lg">✅</span>
                      <span>
                        <strong>Quotation created!</strong> This enquiry has been converted to one or more quotations. View them below or create additional quotations if needed.
                      </span>
                    </div>
                  )}
                  <Link
                    to="/quotations"
                    state={{ fromEnquiryId: enquiryId }}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                  >
                    <FileText className="w-4 h-4 text-indigo-600" />
                    Related quotations
                  </Link>
                  {permissions.canCreateQuotation && data.status === "open" && (
                    <PrimaryButton onClick={goToCreateQuotation}>
                      Create quotation (prefilled)
                    </PrimaryButton>
                  )}
                  {permissions.canCreateQuotation && data.status === "quoted" && (
                    <PrimaryButton onClick={goToCreateQuotation}>
                      Create another quotation
                    </PrimaryButton>
                  )}
                </div>
              </div>
            )}

            {tab === "customer" && (
              <div className={cardClass}>
                <SectionTitle icon={<Building2 className="w-4 h-4" />} title="Customer & contact" subtitle="Snapshot from master data at save time" />
                <div className="p-6 grid md:grid-cols-3 gap-4">
                  <div className="rounded-xl border border-slate-100 p-4 space-y-2">
                    <div className="text-xs font-semibold text-slate-500 uppercase">Customer</div>
                    <div className="font-semibold text-slate-900">{customerDisplayName}</div>
                    {cust?.gstin && <div className="text-xs text-slate-600">GSTIN: {cust.gstin}</div>}
                    {cust?.address && <div className="text-xs text-slate-600 whitespace-pre-wrap">{cust.address}</div>}
                  </div>
                  <div className="rounded-xl border border-slate-100 p-4 space-y-2">
                    <div className="text-xs font-semibold text-slate-500 uppercase inline-flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" /> Location
                    </div>
                    <div className="font-semibold text-slate-900">{locationLine}</div>
                    {loc?.city || loc?.state ? (
                      <div className="text-xs text-slate-600">
                        {[loc?.city, loc?.state].filter(Boolean).join(", ")}
                      </div>
                    ) : null}
                    {loc?.gstin && <div className="text-xs text-slate-600">Loc. GSTIN: {loc.gstin}</div>}
                  </div>
                  <div className="rounded-xl border border-slate-100 p-4 space-y-2">
                    <div className="text-xs font-semibold text-slate-500 uppercase inline-flex items-center gap-1">
                      <User className="w-3.5 h-3.5" /> Contact
                    </div>
                    <div className="font-semibold text-slate-900">{contactLine}</div>
                    {ct?.email && (
                      <div className="text-xs text-slate-600 inline-flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5 shrink-0" /> {ct.email}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {tab === "items" && (
              <div className={cardClass}>
                <SectionTitle icon={<Layers className="w-4 h-4" />} title="Enquired items" subtitle="Products and quantities requested" />
                <div className="p-4 sm:p-6 overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500 border-b border-slate-100">
                        <th className="px-3 py-2">#</th>
                        <th className="px-3 py-2">Product</th>
                        <th className="px-3 py-2">Description</th>
                        <th className="px-3 py-2 text-right">Qty</th>
                        <th className="px-3 py-2">UOM</th>
                        <th className="px-3 py-2">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-3 py-10 text-center text-slate-500">
                            No line items on this enquiry.
                          </td>
                        </tr>
                      ) : (
                        items.map((it: any, i: number) => (
                          <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50">
                            <td className="px-3 py-3 text-slate-500">{i + 1}</td>
                            <td className="px-3 py-3 font-medium text-slate-900">{it.product_name || it.name || "—"}</td>
                            <td className="px-3 py-3 text-slate-600 max-w-xs truncate">{it.description || "—"}</td>
                            <td className="px-3 py-3 text-right font-semibold tabular-nums">{it.qty ?? it.quantity ?? "—"}</td>
                            <td className="px-3 py-3 text-slate-600">{it.uom || "—"}</td>
                            <td className="px-3 py-3 text-slate-600 max-w-[200px] truncate">{it.notes || "—"}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="text-center text-xs text-slate-400">
              Last updated {formatDate(data.updated_at)} · Created {formatDate(data.created_at)}
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
