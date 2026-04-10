// src/pages/Quotations.tsx
import { useEffect, useMemo, useState, useRef } from "react";
import { api } from "../api";
import { useNavigate, useSearchParams } from "react-router-dom";
import Layout from "../components/layout/Layout";
import { toast } from "react-toastify";
import { formatDateDDMMYYYY } from "../utils/date";
import { Eye, Edit2, Trash2 } from "lucide-react";

/**
 * QuotationList — improved UI:
 * - Uses Tailwind utility classes
 * - Search + filters + export + pagination
 * - Table with sticky header, zebra rows, status pills, and row action menu
 *
 * Note: keeps original API calls (api.getQuotations(), api.getProducts(), api.getCustomers(), api.deleteQuotation)
 */

type QuotationItem = {
  product_name?: string;
  product?: { name?: string };
  name?: string;
  product_title?: string;
  product_id?: number;
  productId?: number;
};

type Q = {
  id: number;
  quotation_no: string;
  total_value?: string | number;
  status?: string;
  created_at?: string;

  reissued_from?: {
    id?: number;
    quotation_no?: string;
  } | null;

  is_superseded?: boolean;
  lifecycle_state?: "active" | "reissued" | "superseded";

  validity?: {
    quotation_date?: string;
    validity_days?: number;
    valid_until?: string;
    remaining_days?: number;
    validity_state?: "valid" | "due" | "overdue" | "expired" | "today" | "soon" | "converted" | "closed_lost" | "not_applicable";
  };

  customer?: {
    id?: number;
    company_name?: string;
    gstin?: string;
  } | null;

  contact?: {
    id?: number;
    name?: string;
    phone?: string;
    email?: string;
  } | null;

  meta?: {
    items?: any[];
    salesperson?: {
      name?: string;
    } | string;
    sales_person?: {
      name?: string;
    } | string;
  };

  product_summary?: string;

  items?: QuotationItem[] | string | null;


};


function ValidityBadge({
  state,
  remainingDays,
}: {
  state?: "valid" | "due" | "overdue" | "expired" | "today" | "soon" | "converted" | "closed_lost" | "not_applicable";
  remainingDays?: number;
}) {
  if (!state) return null;

  // Skip display for closed states and non-applicable states - these should not be shown via badge
  if (state === "converted" || state === "closed_lost" || state === "not_applicable") return null;

  const map: Record<string, string> = {
    valid: "bg-green-100 text-green-700",
    due: "bg-yellow-100 text-yellow-700",
    overdue: "bg-orange-100 text-orange-700",
    expired: "bg-red-100 text-red-700",
    today: "bg-orange-100 text-orange-700",
    soon: "bg-yellow-100 text-yellow-700",
  };

  const label =
    state === "valid"
      ? "Valid"
      : state === "due"
        ? `Due (${remainingDays ?? 0}d)`
        : state === "overdue"
          ? "Overdue"
          : state === "today"
            ? "Expires Today"
            : state === "soon"
              ? `Due (${remainingDays ?? 0}d)`
              : "Expired";

  return (
    <span
      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${map[state]}`}
    >
      {label}
    </span>
  );
}

function formatCurrency(v?: number | string) {
  const n = typeof v === "number" ? v : Number(String(v || "0").replace(/[^0-9.-]+/g, ""));
  if (!Number.isFinite(n)) return "₹0";
  return `₹${n.toLocaleString()}`;
}

function getStatusUI(status?: string) {
  const s = String(status || "").trim().toLowerCase();

  const map: Record<string, { label: string; className: string }> = {
    draft: {
      label: "Draft",
      className: "bg-amber-50 text-amber-900",
    },
    pending: {
      label: "Pending",
      className: "bg-blue-100 text-blue-700",
    },
    approved: {
      label: "Approved",
      className: "bg-purple-100 text-purple-700",
    },
    won: {
      label: "Won",
      className: "bg-green-100 text-green-700",
    },
    lost: {
      label: "Lost",
      className: "bg-red-100 text-red-700",
    },
    expired: {
      label: "Expired",
      className: "bg-red-100 text-red-700",
    },
  };

  return map[s] || {
    label: s || "-",
    className: "bg-slate-100 text-slate-600",
  };
}

export default function Quotations() {
  const navigate = useNavigate();

  const [rows, setRows] = useState<Q[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [productsMap, setProductsMap] = useState<Record<string, string>>({});
  //const [customersMap, setCustomersMap] = useState<Record<string, string>>({});

  // UI state
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "draft" | "pending" | "won" | "lost">("all");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  const fromDateRef = useRef<HTMLInputElement>(null);
  const toDateRef = useRef<HTMLInputElement>(null);


  const [searchParams] = useSearchParams();

  const kpiStatus = searchParams.get("status");     // pending | won | lost
  const kpiValidity = searchParams.get("validity"); // today | soon
  const kpiFollowup = searchParams.get("followup"); // today | overdue


  // load lookups
  useEffect(() => {
    let mounted = true;
    async function loadLookups() {
      try {
        const [pRes] = await Promise.allSettled([api.getProducts(),]);
        if (!mounted) return;

        if (pRes.status === "fulfilled") {
          const pdata = Array.isArray(pRes.value) ? pRes.value : pRes.value?.data ?? pRes.value ?? [];
          const m: Record<string, string> = {};
          (pdata || []).forEach((it: any) => {
            const id = it.id ?? it._id ?? it.ID;
            const name = it.name ?? it.product_name ?? it.title;
            if (id != null) m[String(id)] = String(name ?? id);
          });
          setProductsMap(m);
        }


      } catch (err) {
        console.warn("lookup load failed", err);
      }
    }
    loadLookups();
    return () => {
      mounted = false;
    };
  }, []);

  // load rows
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kpiStatus, kpiValidity, kpiFollowup]);


  async function load() {
    setLoading(true);
    try {
      const data = await api.getQuotations({
        status: kpiStatus,
        validity: kpiValidity,
        followup: kpiFollowup,
      });

      console.log('📊 Quotations API Response:', data);
      
      const rowData = Array.isArray(data) ? data : data?.data ?? [];
      console.log('📝 Setting rows:', rowData.length, 'quotations');
      
      setRows(rowData);

      // 🔹 Sync UI status dropdown with KPI filter
      if (kpiStatus && ["draft", "pending", "won", "lost"].includes(kpiStatus)) {
        setStatusFilter(kpiStatus as any);
      }

    } catch (err) {
      console.error('❌ Quotations load error:', err);
      toast.error("Failed to load quotations");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: number, status?: string) {
    const isDecided = ["won", "lost"].includes(String(status || "").toLowerCase());
    const ok = confirm(
      isDecided
        ? "This quotation has been marked as Won/Lost. Continuing will force-delete the quotation (admin only). This action cannot be undone. Proceed?"
        : "Are you sure you want to delete this quotation? This action cannot be undone."
    );
    if (!ok) return;

    try {
      await api.deleteQuotation(id, { force: isDecided });
      setRows((prev) => prev.filter((r) => r.id !== id));
      toast.success("Quotation deleted");
    } catch (err: any) {
      console.error("Delete failed", err);
      const body = err?.body || err?.message || String(err);
      if (String(body).toLowerCase().includes("not found")) {
        toast.error("Quotation not found");
        await load();
        return;
      }
      if (err?.status === 403) {
        toast.error("You are not allowed to delete decided quotations.");
        return;
      }
      toast.error("Failed to delete quotation");
    }
  }


  function rowSearchText(row: Q): string {
    return [
      row.quotation_no,
      row.customer?.company_name,
      productListText(row),
      salespersonText(row),
      contactPersonText(row),
      row.status,
      row.total_value,
      row.validity?.validity_state,
      row.created_at
        ? new Date(row.created_at).toLocaleDateString()
        : "",
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
  }

  // robust items parsing (string or array)
  function resolveItems(row: Q): QuotationItem[] {
    const raw = (row as any).items;
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      } catch (_) {
        // not JSON, return as single string fallback
        return [{ name: String(raw) } as any];
      }
    }
    if (row.meta && Array.isArray((row.meta as any).items)) return (row.meta as any).items;
    return [];
  }

  function productListText(row: Q) {
    const items = resolveItems(row);
    const names: string[] = [];
    for (const it of items) {
      if (!it) continue;
      if (typeof it.product_name === "string" && it.product_name.trim()) {
        names.push(it.product_name.trim());
        continue;
      }
      if (it.product && typeof it.product.name === "string" && it.product.name.trim()) {
        names.push(it.product.name.trim());
        continue;
      }
      if (typeof it.name === "string" && it.name.trim()) {
        names.push(it.name.trim());
        continue;
      }
      if (typeof it.product_title === "string" && it.product_title.trim()) {
        names.push(it.product_title.trim());
        continue;
      }
      const pid = (it as any).product_id ?? (it as any).productId ?? (it as any).id ?? (it as any)._id;
      if (pid != null && productsMap[String(pid)]) {
        names.push(productsMap[String(pid)]);
        continue;
      }
      if (typeof it === "string" && (it as any).trim()) {
        names.push((it as any).trim());
        continue;
      }
      try {
        const j = JSON.stringify(it);
        if (j && j !== "{}" && j.length < 60) names.push(j);
      } catch (_) { }
    }

    if (!names.length) {
      if (row.product_summary && String(row.product_summary).trim()) return row.product_summary;
      return "-";
    }
    if (names.length <= 2) return names.join(", ");
    return `${names.slice(0, 2).join(", ")} +${names.length - 2} more`;
  }

  function salespersonText(row: Q) {
    const anyRow = row as any;

    // 1️⃣ Direct backend alias (PRIMARY, always prefer this)
    if (typeof anyRow.salesperson_name === "string" && anyRow.salesperson_name.trim()) {
      return anyRow.salesperson_name.trim();
    }

    // 2️⃣ Nested salesperson object (future-proof)
    if (anyRow.salesperson && typeof anyRow.salesperson.name === "string" && anyRow.salesperson.name.trim()) {
      return anyRow.salesperson.name.trim();
    }

    // 3️⃣ Legacy / alternate naming (controlled & explicit)
    const legacyCandidates = [
      anyRow.sales_person,
      anyRow.sales_personnel,
      anyRow.sales_rep,
      anyRow.owner,
    ];

    for (const c of legacyCandidates) {
      if (!c) continue;

      if (typeof c === "string" && c.trim()) {
        return c.trim();
      }

      if (typeof c === "object" && typeof c.name === "string" && c.name.trim()) {
        return c.name.trim();
      }
    }

    // 4️⃣ Snapshot / meta fallback (optional, safe)
    if (anyRow.meta && typeof anyRow.meta === "object") {
      const m = anyRow.meta.salesperson || anyRow.meta.sales_person;
      if (typeof m === "string" && m.trim()) return m.trim();
      if (m && typeof m.name === "string" && m.name.trim()) return m.name.trim();
    }

    // ❌ NO customer fallback — EVER
    return "-";
  }
  function contactPersonText(row: Q) {
    return row.contact?.name || "-";
  }


  // filtered & paginated
  const filtered = useMemo(() => {
    let list = rows.slice();

    // KPI STATUS FILTER (from URL params - takes precedence)
    if (kpiStatus && ["draft", "pending", "won", "lost"].includes(kpiStatus)) {
      list = list.filter(
        (r) => (r.status || "").toLowerCase() === kpiStatus
      );
    } else if (statusFilter !== "all") {
      // Local status filter if no KPI status
      list = list.filter(
        (r) => (r.status || "").toLowerCase() === statusFilter
      );
    }

    // KPI VALIDITY FILTER (from URL params)
    if (kpiValidity && ["today", "soon", "valid", "expired"].includes(kpiValidity)) {
      list = list.filter((r) => {
        const validityState = r.validity?.validity_state;
        return validityState === kpiValidity;
      });
    }

    // KPI FOLLOWUP FILTER (from URL params)
    if (kpiFollowup) {
      // TODO: Implement followup filtering once followup data is available in API
      // For now, this is a placeholder for future implementation
    }

    // DATE FILTER
    if (fromDate) {
      const from = new Date(fromDate);
      from.setHours(0, 0, 0, 0);

      list = list.filter((r) => {
        if (!r.created_at) return false;
        return new Date(r.created_at) >= from;
      });
    }

    if (toDate) {
      const to = new Date(toDate);
      to.setHours(23, 59, 59, 999);

      list = list.filter((r) => {
        if (!r.created_at) return false;
        return new Date(r.created_at) <= to;
      });
    }

    // GLOBAL SEARCH
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((r) => rowSearchText(r).includes(q));
    }

    return list;
  }, [rows, statusFilter, query, fromDate, toDate, kpiStatus, kpiValidity, kpiFollowup]);


  const pageCount = Math.max(1, Math.ceil(filtered.length / perPage));
  useEffect(() => {
    if (page > pageCount) setPage(1);
  }, [pageCount, page]);

  const pageSlice = filtered.slice((page - 1) * perPage, page * perPage);



  // small skeleton row
  // const SkeletonRow = () => (
  //   <tr>
  //     <td colSpan={10} className="p-6">
  //       <div className="animate-pulse flex gap-4 items-center">
  //         <div className="h-4 bg-slate-200 rounded w-48" />
  //         <div className="h-4 bg-slate-200 rounded w-32" />
  //         <div className="h-4 bg-slate-200 rounded w-40" />
  //         <div className="h-4 bg-slate-200 rounded w-20" />
  //       </div>
  //     </td>
  //   </tr>
  // );

  return (
    <Layout>
      <div className="max-w-full px-6 pb-8">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-4xl font-medium text-slate-900 tracking-tight">Quotations</h1>
              <p className="text-slate-600 mt-2">Manage quotations, export data, and review statuses</p>
            </div>
            <button
              onClick={() => navigate("/create-quotation")}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-rose-500 to-rose-600 text-white rounded-lg font-medium hover:shadow-lg hover:from-rose-600 hover:to-rose-700 transition-all duration-200 transform hover:scale-105"
              title="Create new quotation"
            >
              + New Quotation
            </button>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm mb-8">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className="flex-1 relative">
              {/* SEARCH */}
              <input
                id="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Search quotation, customer, product, salesperson..."
                className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
              />
            </div>

            <div className="flex flex-wrap gap-3 items-center">
              {/* STATUS FILTER */}
              <select
                id="status"
                aria-label="Filter by status"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as any);
                  setPage(1);
                }}
                className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent bg-white"
              >
                <option value="all">All Status</option>
                <option value="draft">Draft</option>
                <option value="pending">Pending</option>
                <option value="won">Won</option>
                <option value="lost">Lost</option>
              </select>

              {/* FROM DATE */}
              <input
                ref={fromDateRef}
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setPage(1);
                }}
                className="px-4 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent cursor-pointer"
                title="From Date"
              />

              {/* TO DATE */}
              <input
                ref={toDateRef}
                type="date"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  setPage(1);
                }}
                className="px-4 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent cursor-pointer"
                title="To Date"
              />

              {/* PER PAGE */}
              <select
                value={perPage}
                onChange={(e) => setPerPage(Number(e.target.value))}
                className="px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent bg-white text-sm"
                title="Results per page"
              >
                <option value={8}>8</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>

              {/* CLEAR FILTERS */}
              {(query || statusFilter !== "all" || fromDate || toDate) && (
                <button
                  onClick={() => {
                    setQuery("");
                    setStatusFilter("all");
                    setFromDate("");
                    setToDate("");
                    setPage(1);
                  }}
                  className="text-sm text-slate-600 hover:text-slate-900 hover:underline font-medium"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Status Filter Pills */}
        <div className="flex gap-2 mb-4">
          {["all", "pending", "won", "lost"].map((s) => (
            <button
              key={s}
              onClick={() => {
                setStatusFilter(s as any);
                setPage(1);
              }}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
                statusFilter === s
                  ? "bg-rose-500 text-white shadow-md"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>


        {/* Table Section */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-20">
                <tr>
                  <th className="sticky left-0 z-30 bg-slate-50 px-6 py-4 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">Quote #</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">Customer</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">Products</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">Salesperson</th>
                  <th className="px-6 py-4 text-right text-xs font-medium text-slate-700 uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">Validity</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">Lifecycle</th>
                  <th className="px-6 py-4 text-right text-xs font-medium text-slate-700 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center">
                      <div className="inline-flex items-center gap-2 text-slate-600">
                        <div className="w-5 h-5 rounded-full border-2 border-slate-300 border-t-rose-500 animate-spin"></div>
                        Loading...
                      </div>
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-16 text-center">
                      <div className="mb-6">
                        <p className="text-lg font-medium text-slate-900">No quotations found</p>
                        <p className="text-sm text-slate-500 mt-2">
                          {query.trim() || statusFilter !== "all" || fromDate || toDate
                            ? "No results match your filters. Try adjusting your search criteria."
                            : rows.length === 0
                              ? "Create your first quotation to get started"
                              : "No quotations match your current filters"
                          }
                        </p>
                      </div>
                      {rows.length === 0 && !query.trim() && statusFilter === "all" && !fromDate && !toDate && (
                        <button
                          onClick={() => navigate("/create-quotation")}
                          className="inline-flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-rose-500 to-rose-600 text-white rounded-lg font-medium hover:shadow-lg hover:from-rose-600 hover:to-rose-700 transition-all duration-200 transform hover:scale-105 mt-4"
                        >
                          + Create Quotation
                        </button>
                      )}
                    </td>
                  </tr>
                ) : (
                  pageSlice.map((r) => (
                    <tr
                      key={r.id}
                      onClick={() => navigate(`/quotations/${r.id}`)}
                      className={`
                        group cursor-pointer transition-all duration-150 active:scale-[0.998]
                        ${r.validity?.validity_state === "expired" ? "bg-red-50" : ""}
                        ${r.lifecycle_state === "reissued" ? "bg-indigo-50/40" : ""}
                        hover:bg-slate-100
                      `}
                    >

                      {/* Quote # + Date (Sticky) */}
                      <td className="sticky left-0 z-10 bg-white bg-opacity-90 px-6 py-5">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-900 group-hover:text-rose-600 transition">
                            {r.quotation_no}
                          </span>
                          <span className="text-xs text-slate-500 mt-1">
                            {r.created_at ? formatDateDDMMYYYY(r.created_at) : "N/A"}
                          </span>
                        </div>
                      </td>

                      {/* Customer + Contact (Merged) */}
                      <td className="px-6 py-5">
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-800">
                            {r.customer?.company_name || "N/A"}
                          </span>
                          <span className="text-xs text-slate-500 mt-1">
                            {contactPersonText(r)}
                          </span>
                        </div>
                      </td>

                      {/* Products */}
                      <td
                        className="px-6 py-5 text-sm text-slate-700 max-w-xs truncate"
                        title={resolveItems(r)
                          .map((i) => i?.product_name ?? i?.name ?? i?.product?.name ?? "")
                          .filter(Boolean)
                          .join(", ")}
                      >
                        {productListText(r)}
                      </td>

                      {/* Salesperson */}
                      <td className="px-6 py-5 whitespace-nowrap text-sm text-slate-700">
                        {salespersonText(r)}
                      </td>

                      {/* Amount */}
                      <td className="px-6 py-5 whitespace-nowrap text-right">
                        <span className="text-base font-semibold text-emerald-600">
                          {formatCurrency(r.total_value)}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-5 whitespace-nowrap text-sm">
                        {(() => {
                          // Check if expired via validity_state
                          if (r.validity?.validity_state === "expired") {
                            return (
                              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                                <span className="w-2 h-2 rounded-full bg-current opacity-70"></span>
                                Expired
                              </span>
                            );
                          }

                          const statusUI = getStatusUI(r.status);
                          return (
                            <span
                              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${statusUI.className}`}
                            >
                              <span className="w-2 h-2 rounded-full bg-current opacity-70"></span>
                              {statusUI.label}
                            </span>
                          );
                        })()}
                      </td>

                      {/* Validity */}
                      <td className="px-6 py-5 whitespace-nowrap text-sm">
                        {(() => {
                          const status = String(r.status || "").trim().toLowerCase();
                          const validityState = r.validity?.validity_state;

                          // 🟢 VALIDITY FIRST (CORE RESPONSIBILITY)
                          
                          // Draft → no validity concept
                          if (status === "draft") {
                            return (
                              <span className="inline-flex px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
                                Draft
                              </span>
                            );
                          }

                          // Won → closed commercial artifact
                          if (status === "won" || validityState === "converted") {
                            return (
                              <span className="inline-flex px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                Converted
                              </span>
                            );
                          }

                          // Lost → closed deal
                          if (status === "lost" || validityState === "closed_lost") {
                            return (
                              <span className="inline-flex px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                                Closed - Lost
                              </span>
                            );
                          }

                          // Pending → ALWAYS show validity_state
                          if (status === "pending") {
                            if (validityState === "expired") {
                              return (
                                <span className="inline-flex px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                                  Expired
                                </span>
                              );
                            }

                            return (
                              <ValidityBadge
                                state={validityState}
                                remainingDays={r.validity?.remaining_days}
                              />
                            );
                          }

                          return <span className="text-slate-400 text-xs">—</span>;
                        })()}
                      </td>

                      {/* Lifecycle */}
                      <td className="px-6 py-5 whitespace-nowrap text-sm">
                        {(() => {
                          const lifecycle = (r as any).lifecycle_state;
                          const status = String(r.status || "").trim().toLowerCase();
                          const validityState = r.validity?.validity_state;

                          // If status is Expired OR validity_state is Expired -> show Superseded
                          if (status === "expired" || validityState === "expired") {
                            return (
                              <span className="inline-flex px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-200 text-slate-700">
                                Superseded
                              </span>
                            );
                          }

                          // If status is Lost -> show Inactive
                          if (status === "lost") {
                            return (
                              <span className="inline-flex px-3 py-1.5 rounded-full text-xs font-semibold bg-gray-200 text-gray-700">
                                Inactive
                              </span>
                            );
                          }

                          // If lifecycle is Reissued -> show Active with Reissue reference
                          if (lifecycle === "reissued") {
                            const parent = r.reissued_from;
                            return (
                              <div className="flex flex-col gap-1.5">
                                <span className="inline-flex px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                                  Active (Reissue)
                                </span>

                                {parent?.quotation_no && (
                                  <span
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigate(`/quotations/${parent.id}`);
                                    }}
                                    className="text-xs text-slate-500"
                                  >
                                    Ref: <span className="text-blue-600 hover:underline cursor-pointer font-medium">{parent.quotation_no}</span>
                                  </span>
                                )}
                              </div>
                            );
                          }

                          // If status is Won, Pending, or Draft -> show Active
                          if (["won", "pending", "draft"].includes(status)) {
                            return (
                              <span className="inline-flex px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                                Active
                              </span>
                            );
                          }

                          // Default: Active/Original version
                          return (
                            <span className="inline-flex px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                              Active
                            </span>
                          );
                        })()}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-5 whitespace-nowrap text-right">
                        <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">

                          {/* View */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/quotations/${r.id}`);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-sky-600 hover:text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-lg transition-colors"
                            title="View quotation"
                          >
                            <Eye size={16} />
                            View
                          </button>

                          {/* Edit */}
                          {(() => {
                            const status = String(r.status || "").trim().toLowerCase();
                            const isExpired = r.validity?.validity_state === "expired";

                            const canEdit =
                              status === "draft" ||
                              (status === "pending" && !isExpired);

                            return (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation(); // 🔥 critical
                                  if (canEdit) {
                                    navigate(`/quotations/${r.id}/edit`);
                                  }
                                }}
                                disabled={!canEdit}
                                title={canEdit ? "Edit quotation" : "Cannot edit this quotation"}
                                className={`p-2 transition ${!canEdit
                                  ? "text-slate-300 cursor-not-allowed opacity-50"
                                  : "text-slate-600 hover:text-slate-900"
                                  }`}
                              >
                                <Edit2 size={16} />
                              </button>
                            );
                          })()}

                          {/* Delete */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation(); // 🔥 critical
                              handleDelete(r.id, r.status);
                            }}
                            className="p-2 text-rose-600 hover:text-rose-700 transition"
                            title="Delete quotation"
                          >
                            <Trash2 size={16} />
                          </button>

                        </div>
                      </td>

                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="text-sm text-slate-600">
              Showing <span className="font-medium">{filtered.length === 0 ? 0 : (page - 1) * perPage + 1}</span>–<span className="font-medium">{Math.min(page * perPage, filtered.length)}</span> of <span className="font-medium">{filtered.length}</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                ← Prev
              </button>

              <div className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700">
                {pageCount === 0 ? "0 / 0" : `${page} / ${pageCount}`}
              </div>

              <button
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                disabled={page === pageCount || pageCount === 0}
                className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                Next →
              </button>
            </div>
          </div>
        </div>
      </div >
    </Layout >
  );
}
