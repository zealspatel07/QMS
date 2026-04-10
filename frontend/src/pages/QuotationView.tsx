// src/pages/QuotationView.tsx
import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Edit, Printer, Copy, Mail } from "lucide-react";
import Layout from "../components/layout/Layout";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import WonLostDecision from "../components/WonLostDecision";
import VersionHistory from "../components/VersionHistory";
import VersionViewer from "../components/VersionViewer";
import ReIssueModal from "../components/quotations/ReIssueModal";
import { formatDateDDMMYYYY } from "../utils/date";

/**
 * QuotationView.tsx (rewritten)
 *
 * Key improvements:
 * - Robust normalization for many backend shapes.
 * - Safer PDF fetch/open with Accept: application/pdf and debug preview if HTML returned.
 * - Logs resp.url and resp.status for easier debugging.
 * - Small UI components (toast / confirm / error) kept local and simple.
 * - Defensive code and clear error messages.
 */
function formatVersion(v?: string | null) {
  if (!v) return "—";

  // "0.2" → "2.0"
  if (/^0\.\d+$/.test(v)) {
    const minor = v.split(".")[1];
    return `${minor}.0`;
  }

  return v;
}

/* ---------- API_BASE resolution (supports Vite env or window __ENV or fallback) ---------- */
// @ts-ignore unused function
const _API_BASE: string =
  (import.meta as any)?.env?.VITE_API_BASE ||
  (window as any).__ENV?.API_BASE ||
  window.location.origin;

/* ---------- types ---------- */
type RawItem = any;
type Item = {
  product_id: number;
  product_name: string;
  description?: string;
  qty: number;
  uom?: string;
  unit_price: number;
  tax_rate: number;
  discount_percent: number;
  hsn_code?: string | null;
};

/* ===== CLEAN CORE MODEL (STRICT) =====
 *
 * Core Layer 1: Business Status (stored)
 *   status: "draft" | "pending" | "won" | "lost"
 *
 * Core Layer 2: System Validity (computed from valid_until)
 *   validity_state: "valid" | "expired" | "today" | "soon" | "converted" | "closed_lost" | "not_applicable"
 *
 * Core Layer 3: Versioning (stored)
 *   lifecycle_state: "original" | "reissued"
 *
 * UI Layer 4: Derived Flags (computed, NOT stored)
 *   is_due_soon: boolean (last 3 days)
 *   needs_reissue: boolean (validity expired + not won/lost)
 */
type Quotation = {
  id: number;
  quotation_no: string;
  quotation_date?: string | null;
  created_at?: string | null;
  enquiry_date?: string | null;
  payment_terms?: string | null;
  validity_days?: number;
  valid_until?: string | null;
  remaining_days?: number | null;
 
  // CORE LAYER 2: System State (computed, but returned by API)
  validity_state?: "valid" | "expired" | "today" | "soon" | "converted" | "closed_lost" | "not_applicable";
 
  // CORE LAYER 1: Business State
  status?: "draft" | "pending" | "won" | "lost";
 
  version?: string | null;
 
  // CORE LAYER 3: Versioning State (computed from reissued_from_id)
  is_superseded?: boolean;
 lifecycle_state?: "original" | "reissued" | "superseded";
  reissued_from_id?: number | null;
  reissued_to_id?: number | null;
 
  customer_id?: number | null;
  customer_name?: string;
  customer_contact_person?: string | null;
  customer_address?: string | null;
  customer_gst?: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
  salesperson_id?: number | null;
  salesperson_name?: string | null;
  salesperson_phone?: string | null;
  salesperson_email?: string | null;
  items?: any;
  total_value?: number | null;
  next_followup_date?: string | null;
  terms?: string | null;
  notes?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
};

/* ---------- UI HELPERS ---------- */
function SmallToast({ message, onClose }: { message: string | null; onClose: () => void }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [message, onClose]);
  if (!message) return null;
  return (
    <div className="fixed right-6 bottom-6 z-50">
      <div className="bg-gray-900 text-white px-4 py-2 rounded-lg shadow-lg">{message}</div>
    </div>
  );
}

const FOLLOWUP_TYPE_META = {
  call: { label: "CALL", color: "bg-blue-100 text-blue-700" },
  email: { label: "EMAIL", color: "bg-indigo-100 text-indigo-700" },
  whatsapp: { label: "WHATSAPP", color: "bg-green-100 text-green-700" },
  meeting: { label: "MEETING", color: "bg-purple-100 text-purple-700" },
  site_visit: { label: "SITE VISIT", color: "bg-amber-100 text-amber-700" },
  other: { label: "OTHER", color: "bg-gray-100 text-gray-700" },
} as const;

// LEGACY: getLifecycleState is replaced by inline checks on quote?.lifecycle_state
// @ts-ignore unused - kept for backwards compatibility
function getLifecycleState(q: any): "original" | "reissued" | "superseded" {
  if (!q) return "original";
  if (q.lifecycle_state === "superseded") return "superseded";
  if (q.lifecycle_state === "reissued") return "reissued";
  if (q.reissued_to_id) return "superseded";   // OLD
  if (q.reissued_from_id) return "reissued";   // NEW
  return "original";
}

/**
 * CORE LAYER 2: Compute validity_state from API data
 * API may return "valid", "due", "expired", "not_applicable"
 * We normalize to strict model: "valid" | "expired"
 *
 * IMPORTANT: Draft quotations have no validity concept - return "valid" (inactive)
 */
// @ts-ignore unused - kept for potential future use
function normalizeValidityState(
  apiValidityState?: string,
  remainingDays?: number | null,
  validUntil?: string | null,
  status?: string
): "valid" | "expired" | "today" | "soon" | "converted" | "closed_lost" | "not_applicable" {
  // Pass through terminal states from backend
  if (apiValidityState === "converted" || apiValidityState === "closed_lost" || apiValidityState === "not_applicable") {
    return apiValidityState as any;
  }

  // Pass through time-based validity states from backend
  if (apiValidityState === "today" || apiValidityState === "soon") {
    return apiValidityState as any;
  }

  // Draft status: validity is not applicable
  if (status?.toLowerCase() === "draft") {
    return "not_applicable";
  }

  // Won or Lost status: already handled by backend, but fallback just in case
  if (status?.toLowerCase() === "won") {
    return "converted";
  }
  if (status?.toLowerCase() === "lost") {
    return "closed_lost";
  }
 
  // Simplify: if remaining_days <= 0 or validUntil is past, it's expired
  if (typeof remainingDays === "number" && remainingDays <= 0) {
    return "expired";
  }
 
  if (validUntil) {
    const expiryDate = new Date(validUntil);
    if (!isNaN(expiryDate.getTime())) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      expiryDate.setHours(0, 0, 0, 0);
      if (expiryDate.getTime() < today.getTime()) {
        return "expired";
      }
    }
  }
 
  // Default to valid if we can't determine otherwise
  return "valid";
}

/**
 * COMPUTED FLAG: is_due_soon
 * Last 3 days before expiration
 */
// @ts-ignore unused - kept for potential future use
function getIsDueSoon(validUntil?: string | null): boolean {
  if (!validUntil) return false;
 
  const today = new Date();
  today.setHours(0, 0, 0, 0);
 
  const expiryDate = new Date(validUntil);
  if (isNaN(expiryDate.getTime())) return false;
  expiryDate.setHours(0, 0, 0, 0);
 
  const daysUntilExpiry = Math.floor((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return daysUntilExpiry <= 3 && daysUntilExpiry > 0;
}

/**
 * COMPUTED FLAG: needs_reissue
 * Validity expired AND status is not won/lost
 */
// @ts-ignore unused - kept for potential future use
function getNeedsReissue(validityState?: string, status?: string): boolean {
  if (validityState === "expired" && status !== "won" && status !== "lost") {
    return true;
  }
  return false;
}

function getNextFollowupMeta(
  nextDate?: string | null,
  type?: keyof typeof FOLLOWUP_TYPE_META
) {
  if (!nextDate) return null;

  const d = new Date(nextDate);
  if (isNaN(d.getTime())) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);

  const diff =
    Math.floor((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  let tone =
    diff < 0
      ? "bg-red-100 text-red-700"
      : diff === 0
        ? "bg-amber-100 text-amber-700"
        : "bg-green-100 text-green-700";

  const label =
    diff < 0
      ? `Overdue (${Math.abs(diff)}d)`
      : diff === 0
        ? "Today"
        : diff === 1
          ? "Tomorrow"
          : `In ${diff} days`;


  const meta =
    FOLLOWUP_TYPE_META[type || "other"] || FOLLOWUP_TYPE_META.other;

  return {
    date: d,
    label: `${meta.label} · ${label}`,
    color: tone,
  };
}




function ConfirmModal({
  title,
  message,
  open,
  loading,
  onConfirm,
  onCancel,
}: {
  title?: string;
  message: string;
  open: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <h3 className="text-lg font-semibold mb-2">{title ?? "Confirm"}</h3>
        <p className="text-sm text-gray-700 mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button className="px-4 py-2 border rounded-lg" onClick={onCancel} disabled={loading}>Cancel</button>
          <button className="px-4 py-2 rounded-lg bg-green-600 text-white" onClick={onConfirm} disabled={loading}>
            {loading ? "Working…" : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ErrorModal({
  open,
  title,
  message,
  onClose,
}: {
  open: boolean;
  title?: string;
  message?: string | null;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg p-6">
        <div className="flex justify-between items-start">
          <h3 className="text-lg font-semibold">{title ?? "Error"}</h3>
          <button className="text-gray-500" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="mt-3 text-sm text-gray-700 whitespace-pre-wrap">{message ?? "An unknown error occurred."}</div>
        <div className="mt-6 flex justify-end">
          <button onClick={onClose} className="px-3 py-2 rounded border text-sm">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- helpers for PDF / blob detection ---------- */
// @ts-ignore unused function
function _extractFilenameFromContentDisposition(header?: string | null): string | null {
  if (!header) return null;
  const filenameStar = /filename\*\s*=\s*(?:UTF-8'')?([^;,\n]+)/i.exec(header);
  if (filenameStar && filenameStar[1]) {
    try {
      return decodeURIComponent(filenameStar[1].trim().replace(/^["']|["']$/g, ""));
    } catch {
      return filenameStar[1].trim().replace(/^["']|["']$/g, "");
    }
  }
  const m = /filename\s*=\s*["']?([^"';,]+)["']?/i.exec(header);
  if (m && m[1]) {
    try {
      return decodeURIComponent(m[1]);
    } catch {
      return m[1];
    }
  }
  return null;
}

async function blobIsPdf(blob: Blob) {
  try {
    const header = await blob.slice(0, 8).text();
    return header.startsWith("%PDF-");
  } catch {
    return false;
  }
}



// @ts-ignore unused function
async function _blobLooksLikeHtml(blob: Blob) {
  try {
    if (await blobIsPdf(blob)) return false;
    const preview = await blob.slice(0, 512).text();
    return /<html|<!doctype html|<body|<script/i.test(preview);
  } catch {
    return false;
  }
}

// @ts-ignore unused function
async function _fetchWithRetries(input: RequestInfo, init?: RequestInit, attempts = 2) {
  let lastErr: any = null;
  for (let i = 0; i < attempts; i++) {
    try {
      const r = await fetch(input, init);
      return r;
    } catch (e) {
      lastErr = e;
      // backoff
      await new Promise((res) => setTimeout(res, 200 * (i + 1)));
    }
  }
  throw lastErr;
}
// helpers (top of file)

function getStatusDisplay(
  status?: string,
  followupRisk?: { level: string }
) {
  const s = (status || "").toLowerCase();

  // ✅ DRAFT (ORANGE / AMBER)
  if (s === "draft") {
    return {
      label: "Draft",
      tone: "amber" as const,   // ✅ FIX
    };
  }
  if (s === "pending") {
    return {
      label: "Pending",
      tone: "blue" as const,
    };
  }

  // TERMINAL STATES
  if (s === "won") {
    return { label: "WON", tone: "green" as const };
  }

  if (s === "lost") {
    return { label: "LOST", tone: "red" as const };
  }

  // PENDING STATES
  if (followupRisk?.level === "critical") {
    return { label: "Pending — Action Required", tone: "red" as const };
  }

  if (followupRisk?.level === "warning") {
    return { label: "Pending — Needs Attention", tone: "amber" as const };
  }

  return { label: "Pending", tone: "green" as const };
}


/* ---------- main component ---------- */
export default function QuotationView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [quote, setQuote] = useState<Quotation | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [creatingOrder] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"approve" | "reject" | null>(null);
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [versionHistory, setVersionHistory] = useState<any[]>([]);
  const [_decision, setDecision] = useState<any>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [viewingVersion, setViewingVersion] = useState<string | null>(null);  // ✅ NEW: Track which version user is viewing
  const { } = useAuth();
  const [_actionsMenuOpen, _setActionsMenuOpen] = useState(false);

  const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({});

  const [showReIssue, setShowReIssue] = useState(false);

  const [activeTab, setActiveTab] =
    useState<"overview" | "products" | "followups" | "history">("overview");






  const [showAddFollowup, setShowAddFollowup] = useState(false);
  const [followups, setFollowups] = useState<any[]>([]);
  const [loadingFollowups, setLoadingFollowups] = useState(false);
  const [showCreateOrderModal, setShowCreateOrderModal] = useState(false);




  const slaCounters = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let missed = 0;
    let todayCnt = 0;
    let upcoming = 0;

    for (const f of followups) {
      if (!f.next_followup_date || f.is_completed) continue;

      const d = new Date(f.next_followup_date);
      d.setHours(0, 0, 0, 0);

      if (d < today) missed++;
      else if (d.getTime() === today.getTime()) todayCnt++;
      else upcoming++;
    }

    return { missed, today: todayCnt, upcoming };
  }, [followups]);


  const isTerminal =
    quote?.status?.toLowerCase() === "won" ||
    quote?.status?.toLowerCase() === "lost";

  const canAddFollowup =
    (quote?.status ?? "").toLowerCase() === "pending";

  const canMutateFollowups =
    (quote?.status ?? "").toLowerCase() === "pending";


  const markFollowupDone = async (followupId: number) => {
    if (!quote?.id) return;

    if (!canMutateFollowups) {
      setToast("Follow-ups are locked for this quotation");
      return;
    }

    try {
      await api.completeQuotationFollowup(followupId);

      const refreshed = await api.getQuotationFollowups(quote.id);
      setFollowups(
        Array.isArray(refreshed)
          ? refreshed.map(f => ({
            ...f,
            is_completed: Boolean(f.is_completed),
          }))
          : []
      );
      setToast("Follow-up marked as completed");
    } catch (e) {
      console.error(e);
      setToast("Failed to mark follow-up");
    }
  };

  const nextPlannedFollowup = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const planned = followups
      .filter(f => f.next_followup_date)
      .map(f => ({
        ...f,
        d: new Date(f.next_followup_date),
      }))
      .filter(f => !isNaN(f.d.getTime()))
      .sort((a, b) => a.d.getTime() - b.d.getTime());

    if (!planned.length) return null;

    const f = planned[0];

    const diffDays = Math.round(
      (f.d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    const tone =
      diffDays < 0
        ? "bg-red-100 text-red-700"
        : diffDays === 0
          ? "bg-amber-100 text-amber-700"
          : "bg-green-100 text-green-700";

    return {
      ...f,
      diffDays,
      tone,
    };
  }, [followups]);

  const lastInteraction = useMemo(() => {
    if (!followups.length) return null;

    return [...followups]
      .sort(
        (a, b) =>
          new Date(b.followup_date).getTime() -
          new Date(a.followup_date).getTime()
      )[0];
  }, [followups]);

  const followupRiskScore = useMemo(() => {
    const remaining = quote?.remaining_days ?? null;

    // 🔴 Expired quotation always wins
    if (quote?.validity_state === "expired") {
      return { level: "critical", label: "Expired", color: "red" };
    }

    // 🟠 Time-critical validity
    if (typeof remaining === "number" && remaining <= 0) {
      return { level: "warning", label: "Time-Critical", color: "amber" };
    }

    // Get OPEN follow-ups only
    const openFollowups = followups.filter(f => !f.is_completed);

    // ✅ All follow-ups completed → Healthy
    if (openFollowups.length === 0 && followups.length > 0) {
      return { level: "healthy", label: "All Follow-Ups Completed", color: "green" };
    }

    // 🔴 Missed follow-up
    if (nextPlannedFollowup && nextPlannedFollowup.diffDays < 0) {
      return { level: "critical", label: "Missed Follow-Up", color: "red" };
    }

    // 🟡 No follow-up yet
    if (followups.length === 0) {
      return { level: "warning", label: "No Follow-Up Yet", color: "amber" };
    }

    // 🟡 Stale follow-up (calculated correctly)
    if (lastInteraction) {
      const lastDate = new Date(lastInteraction.followup_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      lastDate.setHours(0, 0, 0, 0);

      const daysAgo =
        Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysAgo >= 3 && typeof remaining === "number" && remaining <= 3) {
        return { level: "warning", label: "Stale Follow-Up", color: "amber" };
      }
    }

    // 🟢 Healthy
    return { level: "healthy", label: "On Track", color: "green" };
  }, [
    quote?.validity_state,
    quote?.remaining_days,
    followups,
    lastInteraction,
    nextPlannedFollowup,
  ]);




  // ---------- follow-up status helper ---------- //



  //---------- high-risk quotation helper ---------- //





  /* ---------- item normalizer ---------- */
  const normalizeItemsFromRaw = useCallback((rawInput: any): Item[] => {
    let raw = rawInput ?? [];
    if (raw == null) raw = [];
    if (typeof raw === "string") {
      try {
        raw = JSON.parse(raw);
      } catch {
        raw = [];
      }
    }
    if (!Array.isArray(raw)) raw = [];

    return raw.map((it: RawItem) => {
      const qty = Number(it.qty ?? it.quantity ?? 0) || 0;
      const unit_price = Number(it.unit_price ?? it.unitPrice ?? it.price ?? 0) || 0;
      const tax_rate = Number(it.tax_rate ?? it.taxRate ?? 0) || 0;
      const discount_percent = Number(it.discount_percent ?? it.discountPercent ?? 0) || 0;
      return {
        product_id: Number(it.product_id ?? it.productId ?? 0) || 0,
        product_name: (it.product_name ?? it.productName ?? it.description ?? "") + "",
        description: it.description ?? it.product_name ?? "",
        qty,
        uom: it.uom ?? "NOS",
        unit_price,
        tax_rate,
        discount_percent,
        hsn_code: it.hsn_code ?? null,
      } as Item;
    });
  }, []);

  useEffect(() => {
    if (!quote?.id) return;

    setLoadingFollowups(true);

    api
      .getQuotationFollowups(quote.id)
      .then((data) =>
        setFollowups(
          Array.isArray(data)
            ? data.map(f => ({
              ...f,
              is_completed: Boolean(f.is_completed),
            }))
            : []
        )
      )
      .finally(() => setLoadingFollowups(false));
  }, [quote?.id]);


  /* ---------- row expander ---------- */
  function toggleRow(idx: number) {
    setExpandedRows(prev => ({ ...prev, [idx]: !prev[idx] }));
  }

  /* ---------- address helper ---------- */
  function formatAddressFromCustomer(customer: any): string {
    if (!customer) return "";
    if (typeof customer === "string" && customer.trim()) return customer.trim();

    const parts: string[] = [];
    const push = (v?: any) => {
      if (v == null) return;
      const s = String(v).trim();
      if (s) parts.push(s);
    };

    push(customer.address_full ?? customer.full_address ?? customer.addressText ?? customer.address_line);
    push(customer.address || customer.address1 || customer.address_line1 || customer.addr);
    push(customer.address2 || customer.address_line2);
    const city = customer.city || customer.town || customer.district || customer.locality;
    push(city);
    const state = customer.state || customer.region;
    push(state);
    const pin = customer.pincode || customer.pin || customer.zip || customer.postal_code;
    push(pin);
    push(customer.country);

    if (parts.length === 0 && Array.isArray(customer.address_lines)) {
      for (const ln of customer.address_lines) push(ln);
    }

    if (parts.length === 0) {
      const guess: string[] = [];
      Object.keys(customer || {}).forEach((k) => {
        const v = customer[k];
        if (typeof v === "string" && v.length > 8 && /[0-9a-zA-Z]/.test(v)) {
          guess.push(v.trim());
        }
      });
      if (guess.length) return guess.join(", ");
    }

    return parts.join(", ");
  }

  /* ---------- fetch & normalize ---------- */
  const fetchQuotation = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const resp: any = await api.getQuotation(Number(id));
      console.debug("[QuotationView] rawResp:", resp);

      const qRaw: any = resp && (resp.quotation ?? resp);
      const q: any = { ...(qRaw || {}) };

      // ✅ CUSTOMER SNAPSHOT (SOURCE OF TRUTH)
      let snapshot: any = null;

      if (q.customer_snapshot) {
        snapshot =
          typeof q.customer_snapshot === "string"
            ? (() => {
              try { return JSON.parse(q.customer_snapshot); }
              catch { return null; }
            })()
            : q.customer_snapshot;
      }



      const customerCandidates = [
        q.customer,
        q.customer_info,
        q.customer_details,
        q.billing,
        q.bill_to,
        q.client,
        q.client_info,
        q.customerObj,
        q.customer_id,
        q.customerId,
      ];

      const topLevelCustomers = resp?.customers || resp?.customer_list || resp?.customers_list || resp?.customerMap || resp?.customer || [];

      let customerObj: any = null;
      for (const c of customerCandidates) {
        if (c != null && (typeof c === "object" || typeof c === "string" || typeof c === "number")) {
          customerObj = c;
          break;
        }
      }

      if ((typeof customerObj === "number" || typeof customerObj === "string") && topLevelCustomers && Array.isArray(topLevelCustomers)) {
        const idStr = String(customerObj);
        const found = topLevelCustomers.find((x: any) => String(x?.id ?? x?._id ?? x?.customer_id ?? "") === idStr);
        if (found) customerObj = found;
      }

      if (!customerObj && resp) {
        const fallbackKeys = [resp.customer, resp.client, resp.customer_info, resp.customer_details, resp.billing, resp.bill_to];
        for (const f of fallbackKeys) {
          if (f != null && (typeof f === "object" || typeof f === "string")) {
            customerObj = f;
            break;
          }
        }
      }

      const candidatesAddress = [
        q.customer_address,
        q.address,
        q.customer_address_full,
        q.address_full,
        q.address_text,
        q.billing_address,
        q.shipping_address,
        q.customer?.address,
        q.customer?.address_lines,
      ];

      let normalized_customer_address = "";
      for (const c of candidatesAddress) {
        if (c && typeof c === "string" && String(c).trim()) {
          normalized_customer_address = String(c).trim();
          break;
        }
      }

      if (!normalized_customer_address) {
        normalized_customer_address = formatAddressFromCustomer(customerObj) || "";
      }

      if (!normalized_customer_address && Array.isArray(topLevelCustomers) && topLevelCustomers.length > 0) {
        for (const c of topLevelCustomers) {
          const t = formatAddressFromCustomer(c);
          if (t) {
            normalized_customer_address = t;
            break;
          }
        }
      }

      const normalized_enquiry_date =
        q.enquiry_date ??
        q.lead_date ??
        q.enquiry_created_at ??
        q.enquiry?.created_at ??
        null;
      const normalized_customer_contact_person =
        q.customer_contact_person ??
        q.contact_person ??
        q.customer?.contact_person ??
        customerObj?.contact_person ??
        customerObj?.contactPerson ??
        "";
      const normalized_customer_gst =
        q.customer_gst ?? q.gstin ?? q.tax_id ?? q.customer?.gstin ?? customerObj?.gstin ?? customerObj?.gst ?? "";

      const normalized_customer_phone =
        q.customer_phone ?? q.phone ?? q.contact_number ?? q.mobile ?? q.customer?.phone ?? customerObj?.phone ?? customerObj?.mobile ?? "";

      const normalized_customer_email = q.customer_email ?? q.email ?? q.customer?.email ?? customerObj?.email ?? "";

      const spCandidates = [q.salesperson, q.salesperson_info, q.created_by, q.user, q.owner, q.created_by_user];
      let sp: any = null;
      for (const s of spCandidates) {
        if (s) {
          sp = s;
          break;
        }
      }

      const normalized_payment_terms =
        q.payment_terms ??
        q.paymentTerms ??
        q.commercial_terms?.payment_terms ??
        null;

      const normalized_salesperson_name = q.salesperson_name ?? q.created_by_name ?? (sp && (sp.name || sp.full_name || sp.username)) ?? "";

      const normalized_salesperson_phone = q.salesperson_phone ?? (sp && (sp.mobile || sp.phone || sp.contact)) ?? "";

      const normalized_salesperson_email = q.salesperson_email ?? (sp && (sp.email || sp.contact_email)) ?? "";

      const validity =
        q.validity && typeof q.validity === "object"
          ? q.validity
          : {};

      const normalizedQuote = {
        ...q,

        payment_terms: normalized_payment_terms,
        valid_until: validity.valid_until ?? q.valid_until ?? null,
        remaining_days: validity.remaining_days ?? q.remaining_days ?? null,
        // CORE LAYER 2: Normalize validity_state to strict model
        validity_state: normalizeValidityState(
          validity.validity_state ?? q.validity_state,
          validity.remaining_days ?? q.remaining_days,
          validity.valid_until ?? q.valid_until,
          q.status  // Pass status to skip validity for draft
        ),

        enquiry_date: normalized_enquiry_date,

        // 🔑 SNAPSHOT-FIRST CUSTOMER FIELDS
        customer_contact_person:
          snapshot?.contact_name ??
          normalized_customer_contact_person ??
          "",

        customer_address:
          snapshot?.address ??
          normalized_customer_address ??
          "(Customer address not provided)",

        customer_gst:
          snapshot?.gstin ??
          normalized_customer_gst ??
          "",

        customer_phone:
          snapshot?.phone ??
          normalized_customer_phone ??
          "",

        customer_email:
          snapshot?.email ??
          normalized_customer_email ??
          "",

        // (Optional but correct)
        customer_name:
          snapshot?.company_name ??
          q.customer_name ??
          "",

        salesperson_name: normalized_salesperson_name || "",
        salesperson_phone: normalized_salesperson_phone || "",
        salesperson_email: normalized_salesperson_email || "",
      };


      console.debug("[QuotationView] normalizedQuote:", normalizedQuote);

      setQuote(normalizedQuote);
      setItems(
        normalizedQuote?.items ??
        normalizedQuote?.line_items ??
        normalizeItemsFromRaw(normalizedQuote?.items ?? normalizedQuote?.line_items ?? [])
      );

      // Fetch version history and decisions
      setHistoryLoading(true);
      try {
        const [versionsResp, decisionResp] = await Promise.all([
          api.getVersionHistory(Number(id)).catch(() => []),
          api.getQuotationDecisions(Number(id)).catch(() => null),
        ]);
        console.log('[QuotationView] Version history response:', { versionsResp, length: Array.isArray(versionsResp) ? versionsResp.length : 0 });
        setVersionHistory(Array.isArray(versionsResp) ? versionsResp : []);
        setDecision(decisionResp);
      } catch (err) {
        console.error("Failed to load version history:", err);
      } finally {
        setHistoryLoading(false);
      }
    } catch (err) {
      console.error("Failed to load quotation", err);
      setErrorMessage("Failed to load quotation. See console for details.");
      setErrorOpen(true);
    } finally {
      setLoading(false);
    }
  }, [id, normalizeItemsFromRaw]);

  useEffect(() => {
    fetchQuotation();
  }, [fetchQuotation]);


  // ===== CLEAN CORE MODEL (STRICT) LAYERS =====
 
  // LAYER 1: Business Status (from API)
  const businessStatus = quote?.status as "draft" | "pending" | "won" | "lost" | undefined;
 
  // LAYER 2: System Validity (from API, already normalized to valid|expired)
  const systemValidity = quote?.validity_state as "valid" | "expired" | "today" | "soon" | "converted" | "closed_lost" | "not_applicable" | undefined;
 
  // LAYER 3: Versioning Lifecycle (computed from reissued_from_id)
  // const versioningLifecycle = getLifecycleState(quote);
 
  // LAYER 4: Derived UI Flags (computed, NOT stored)
  // NOTE: These flags are ONLY relevant when NOT in draft status
  // const is_due_soon = useMemo(
  //   () => {
  //     // Skip for draft status (no validity concept when drafting)
  //     if (businessStatus === "draft") return false;
  //     return getIsDueSoon(quote?.valid_until);
  //   },
  //   [quote?.valid_until, businessStatus]
  // );
 
  // const needs_reissue = useMemo(
  //   () => {
  //     // Skip for draft status (can't reissue a draft, only expired quotations)
  //     if (businessStatus === "draft") return false;
  //     return getNeedsReissue(systemValidity, businessStatus);
  //   },
  //   [systemValidity, businessStatus]
  // );
 
  // ===== HELPER FLAGS (for template compatibility) =====
  // const validityState = systemValidity;
  const isExpired = systemValidity === "expired";
 
  // 🔥 CRITICAL: Distinguish between states
  // isSuperseded: This quotation has been replaced (has child) → LOCKED 🔒
  // isReissued: This is a new version of another (has parent) → NORMAL ✅

 
  const isSuperseded = quote?.lifecycle_state === "superseded";
  const isReissued = quote?.lifecycle_state === "reissued";
 
  // ✅ CORRECT: ONLY lock if superseded (has child), NOT if it's a new version (has parent)
  const isLocked = isSuperseded;  // Only OLD quotations (005) are locked

  /* ---------- totals ---------- */
  const totals = useMemo(() => {
    let subtotal = 0;
    let tax = 0;
    let grand = 0;
    const lines = items.map((it) => {
      const gross = (it.qty || 0) * (it.unit_price || 0);
      const discount = (gross * (it.discount_percent || 0)) / 100;
      const afterDiscount = gross - discount;
      const lineTax = (afterDiscount * (it.tax_rate || 0)) / 100;
      const lineTotal = afterDiscount + lineTax;
      subtotal += afterDiscount;
      tax += lineTax;
      grand += lineTotal;
      return { ...it, gross, discount, afterDiscount, lineTax, lineTotal };
    });
    return {
      lines,
      subtotal: Math.round(subtotal * 100) / 100,
      tax: Math.round(tax * 100) / 100,
      grand: Math.round(grand * 100) / 100,
    };
  }, [items]);


  const displayedGrand = useMemo(() => {
    if (quote && quote.total_value && Number(quote.total_value) > 0) return Number(quote.total_value);
    return totals.grand;
  }, [quote, totals.grand]);

  function fmt(n: number) {
    try {
      return "₹" + Number(n || 0).toLocaleString();
    } catch {
      return "₹" + String(n || 0);
    }
  }

  /* ---------- actions ---------- */
  // @ts-ignore unused function
  function _openConfirm(action: "approve" | "reject") {
    setConfirmAction(action);
    setConfirmOpen(true);
  }



  async function handleReIssue(opts: {
    mode: "same" | "edit";
    validityDays: number;
  }) {
    try {
      const res: any = await api.reissueQuotation(Number(id), {
        validity_days: opts.validityDays,
      });

      const newId = Number(res?.id);

      if (!newId || Number.isNaN(newId)) {
        throw new Error("Re-issue failed: invalid new quotation id");
      }

      setShowReIssue(false);

      if (opts.mode === "edit") {
        navigate(`/quotations/${newId}/edit`);
      } else {
        navigate(`/quotations/${newId}`);
      }
    } catch (e: any) {
      console.error(e);
     
      // 🔥 CRITICAL: Handle 409 (already reissued)
      if (e?.status === 409 || e?.response?.status === 409) {
        setToast("This quotation has already been re-issued. Refreshing...");
        setShowReIssue(false);
        // Force refresh to get latest state from backend
        await fetchQuotation();
        return;
      }
     
      setToast(e?.error || e?.message || "Failed to re-issue quotation");
    }
  }

  async function handleWon() {
    if (!id) return;
    setActionLoading(true);
    try {
      const res: any = await api.markQuotationWon(Number(id));
      const updated: Quotation = res && (res.quotation ?? res);
      setQuote(updated);
      if (updated.items) setItems(normalizeItemsFromRaw(updated.items));
      setToast("Quotation marked as Won");
      await fetchQuotation();
    } catch (err: any) {
      console.error("Error marking as won:", err);
      setErrorMessage(err?.message ?? "Failed to mark quotation as won");
      setErrorOpen(true);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleLost(reason: string) {
    if (!id) return;
    setActionLoading(true);
    try {
      const res: any = await api.markQuotationLost(Number(id), reason);
      const updated: Quotation = res && (res.quotation ?? res);
      setQuote(updated);
      if (updated.items) setItems(normalizeItemsFromRaw(updated.items));
      setToast("Quotation marked as Lost");
      await fetchQuotation();
    } catch (err: any) {
      console.error("Error marking as lost:", err);
      setErrorMessage(err?.message ?? "Failed to mark quotation as lost");
      setErrorOpen(true);
    } finally {
      setActionLoading(false);
    }
  }

  async function runConfirmAction() {
    if (!id || !confirmAction) return;
    setActionLoading(true);
    try {
      if (confirmAction === "approve") {
        const res: any = await api.approveQuotation(Number(id));
        const updated: Quotation = res && (res.quotation ?? res);
        setQuote(updated);
        if (updated.items) setItems(normalizeItemsFromRaw(updated.items));
        setToast("Quotation approved");
      } else {
        if (typeof api.updateQuotation === "function") {
          await api.updateQuotation(Number(id), { status: "rejected" });
          await fetchQuotation();
          setToast("Quotation marked as rejected");
        } else {
          throw new Error("Reject not supported by API");
        }
      }
    } catch (err: any) {
      console.error("Action failed", err);
      setErrorMessage(err?.message ?? "Action failed");
      setErrorOpen(true);
    } finally {
      setActionLoading(false);
      setConfirmOpen(false);
      setConfirmAction(null);
    }
  }

  /* ---------- download PDF (safe) (Future planing) ---------- */


  /* ---------- open PDF in new tab (safe)   (Future planing ) ---------- */


  /* ---------- print (keeps your implementation) ---------- */
  async function printQuotation() {
    if (!quote) return;

    const esc = (v: any) =>
      String(v ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");

    const fmt = (n: number) =>
      "₹" + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });

    const origin = window.location.origin;
    const logoUrl = `${origin}/logo.png`;

    const createdByName =
      quote.salesperson_name ||
      quote.approved_by ||
      "—";

    const createdByEmail =
      quote.salesperson_email ||
      "—";

    const createdByPhone =
      quote.salesperson_phone ||
      "—";

    /* ---------------- CALCULATIONS ---------------- */

    let subTotal = 0;
    let discountTotal = 0;
    let taxTotal = 0;

   const rowsHtml = items.map((it: any, i: number) => {
  const qty = Number(it.qty || 0);
  const rate = Number(it.unit_price || 0);
  const discountPct = Number(it.discount_percent || 0);
  const discountAmt = Number(it.discount_amount || 0);
  const taxRate = Number(it.tax_rate || 0);

  const lineBase = qty * rate;

  const discountFromPercent = (lineBase * discountPct) / 100;
  const discount =
    discountAmt > 0 ? discountAmt : discountFromPercent;

  const taxable = lineBase - discount;
  const tax = (taxable * taxRate) / 100;

  subTotal += lineBase;
  discountTotal += discount;
  taxTotal += tax;

    return `
<tr>
  <td class="center">${i + 1}</td>
  <td>
    <div class="item-product">${esc(it.product_name)}</div>
    <div class="item-description" style="font-size:10px;">
      ${esc(it.description || "")}
    </div>
  </td>

  <!-- ✅ FIXED QTY + UOM -->
  <td class="center">
    ${qty} ${esc(it.uom || "NOS")}
  </td>

  <td class="right">${fmt(rate)}</td>
  <td class="right">${fmt(lineBase)}</td>
</tr>`;
}).join("");

    const grandTotal = subTotal - discountTotal + taxTotal;


    const termsHtml = quote.terms
      ? `<ol style="margin:0; padding-left:18px;">
      ${esc(quote.terms)
        .split(/\r?\n/)
        .map(line =>
          `<li>${line.replace(/^\s*\d+[\.\)]\s*/, "")}</li>`
        )
        .join("")}
     </ol>`
      : "No terms and conditions provided.";

    const css = `
@page {
  size: A4;
  margin: 11mm;
  @bottom-right {
    content: "Page " counter(page) " of " counter(pages);
    font-size: 10px;
  }
}

body {
  font-family: Calibri, sans-serif;
  font-size: 11px;
  margin: 0;
  padding: 0;
  color: #000;
}

.page {
  padding: 10px;
  border: 1px solid #000;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  min-height: 275mm;
}

.bold { font-weight: bold; }
.right { text-align: right; }
.center { text-align: center; }

/* HEADER */
.header-box {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  border: 2px solid #000;
  padding: 8px;
  margin-bottom: 6px;
  background: #f5f5f5;
}

.header-left {
  flex: 0 0 auto;
}

.header-right {
  flex: 1;
  text-align: left;
  padding-left: 12px;
  font-size: 10px;
  line-height: 1.4;
}

.logo {
  height: 50px;
  width: auto;
}

.company-name {
  font-weight: bold;
  font-size: 11px;
  margin-bottom: 4px;
}

.company-details {
  font-size: 10px;
  color: #333;
}

/* TITLE */
.main-title {
  font-size: 16px;
  font-weight: bold;
  text-align: center;
  margin: 4px 0 8px 0;
}

/* DETAILS TABLE - NEW STRUCTURE */
.main-structure {
  width: 100%;
  border-collapse: collapse;
  border: 1px solid #000;
  margin-bottom: 6px;
  font-size: 11px;
}

.main-structure td {
  border: 1px solid #000;
  padding: 0;
  vertical-align: top;
  height: auto;
}

.left-column {
  width: 50%;
  border-right: 1px solid #000;
  padding-left: 0px;
}

.right-column {
  width: 50%;
}

.left-section-table {
  width: 100%;
  border-collapse: collapse;
  border: none;
}

.left-section-table tr {
  border-bottom: 1px solid #000;
}

.left-section-table tr:last-child {
  border-bottom: none;
}

.left-section-table td {
  border: none;
  padding: 10px 8px;
}

.buyer-section {
  width: 80%;
 
  background: #fff;
  font-size: 11px;
  line-height: 1.5;
}

.po-section {
  width: 80%;
  
  background: #fff;
  font-size: 11px;
  line-height: 1.5;
}

  .buyer-section,
.po-section {
  padding: 10px 16px;  
}

.section-title {
  font-weight: bold;
  margin-bottom: 8px;
  margin-top: 0;
  font-size: 11px;
  color: #000;
}

.meta-inner {
  width: 100%;
  border-collapse: collapse;
  font-size: 10px;
  border: none;
  background: #fff;
  color: #000;
  line-height: 1.6;
}

.meta-inner tr {
  border-bottom: 1px solid #000;
}

.meta-inner tr:last-child {
  border-bottom: none;
}

.meta-inner td {
  border: none;
  padding: 6px 8px;
  vertical-align: top;
  background: #fff;
  color: #000;
  font-weight: normal;
}

.meta-inner td:first-child {
  font-weight: bold;
  text-align: left;
  border-right: 1px solid #000;
}

.meta-inner tr:last-child td:first-child {
  border-right: none;
}

.meta-inner td:last-child {
  text-align: left;
}

/* SUPPLIER BOX */
.supplier-box {
  border: 1px solid #000;
  padding: 8px;
  margin-bottom: 12px;
  font-size: 11px;
  line-height: 1.5;
  display: none;
}

.items-table {
  width: 100%;
  border-collapse: collapse;
  border: 1px solid #000;
  margin: 6px 0 0 0;
  font-size: 11px;
}

.items-table th,
.items-table td {
  border: 1px solid #000;
  padding: 6px 4px;
  vertical-align: top;
  text-align: left;
}

.items-table th {
  background: #000;
  color: #000;
  font-weight: 700;         /* stronger */
  font-size: 12px;          /* slightly bigger */
  letter-spacing: 0.3px;    /* improves clarity */
  -webkit-font-smoothing: none;
}

.items-table td {
  background: #fff;
}

.items-table .item-product {
  font-weight: bold;
}

/* SUMMARY TABLE - SEPARATE FROM ITEMS */
.summary-table {
  width: 100%;
  border-collapse: collapse;
  border: 1px solid #000;
  font-size: 11px;
  margin-top: 6px;
}

.summary-table td {
  border: 1px solid #000;
  padding: 6px 4px;
  vertical-align: top;
  text-align: right;
  background: #fff;
  color: #000;
}

.summary-table .label {
  text-align: right;
  font-weight: bold;
  width: 70%;
}

.summary-table .amount {
  text-align: right;
  width: 30%;
}

.summary-table tr.summary-row td {
  background: #fff;
  font-weight: bold;
  color: #000;
}

.summary-table tr.grand-total-row td {
  background: #fff;
  color: #000;
  font-weight: bold;
  border-top: 2px solid #000;
}

/* AMOUNT IN WORDS */
.amount-in-words {
  margin-top: 6px;
  font-size: 11px;
  line-height: 1.4;
  border: 1px solid #000;
  padding: 6px;
}

/* TERMS */
.terms {
  margin-top: 6px;
  font-size: 11px;
  line-height: 1.4;
  flex-grow: 1;
}

.terms ol {
  margin: 4px 0;
  padding-left: 18px;
}

.terms li {
  margin-bottom: 3px;
}

/* FOOTER */
.footer {
  margin-top: 12px;
  font-size: 11px;
  line-height: 1.4;
}
`;

    /* ---------------- HTML ---------------- */

    const fmtDate = (d?: string | null) => {
      if (!d) return "—";

      // If already in DD-MM-YYYY, return as-is
      if (/^\d{2}-\d{2}-\d{4}$/.test(d)) {
        return d;
      }

      // If YYYY-MM-DD or ISO string
      const date = new Date(d);
      if (isNaN(date.getTime())) return "—";

      return date.toLocaleDateString("en-GB");
    };

   const html = `
<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<title>Sales Quotation</title>
<style>${css}</style>
</head>

<body>

<div class="page">

  <!-- HEADER -->
  <div class="header-box">
    <div class="header-left">
      <img src="${logoUrl}" class="logo" alt="Logo"/>
    </div>
    <div class="header-right">
      <div class="company-name">PRAYOSHA AUTOMATION PRIVATE LIMITED</div>
      <div class="company-details">
        Third Floor, 28, Samravy Sequence, Opp. Ambe School, Manjalpur, Vadodara - 390011<br/>
        (Guj.), India | CIN: U74999GJ2020PTC115431 | Website: www.prayosha.net.in
      </div>
    </div>
  </div>

  <!-- TITLE -->
  <div class="main-title">SALES QUOTATION</div>

  <!-- MAIN STRUCTURE: 2-COLUMN OUTER TABLE -->
  <table class="main-structure">
    <tr>
      <!-- LEFT COLUMN: Buyer + PO (2 rows) -->
      <td class="left-column">
        <table class="left-section-table">
          <!-- ROW 1: BUYER DETAILS -->
          <tr>
            <td class="buyer-section">
              <div class="section-title">Buyer Details,</div>
              <strong>${esc(quote.customer_name)}</strong><br/>
              ${quote.customer_contact_person ? `<span style="font-size:10px;">Contact Person: ${esc(quote.customer_contact_person)}</span><br/>` : ``}
              ${quote.customer_address ? `<span style="font-size:10px;">${esc(quote.customer_address)}</span><br/>` : ``}
              ${quote.customer_phone ? `<span style="font-size:10px;">Phone: ${esc(quote.customer_phone)}</span><br/>` : ``}
              ${quote.customer_email ? `<span style="font-size:10px;">Email: ${esc(quote.customer_email)}</span><br/>` : ``}
              ${quote.customer_gst ? `<span style="font-size:10px;">GSTIN: ${esc(quote.customer_gst)}</span>` : ``}
            </td>
          </tr>
          <!-- ROW 2: PURCHASE ORDER SECTION -->
          <tr>
            <td class="po-section">
              <div class="section-title"> Purchase Order to be placed on:</div>
              <span style="font-size:10px; line-height:1.8;">
                 PRAYOSHA AUTOMATION PRIVATE LIMITED<br/>
                 High Rise 408-409, Park Paradise, Nr. Billabong International High School,<br/>
                 Kalali-Vadsar Ring Road, Vadodara – 390012 (GJ), IN<br/><br/>
                <strong>GSTIN: 24AALCP3186E1ZD</strong>
              </span>
            </td>
          </tr>
        </table>
      </td>

      <!-- RIGHT COLUMN: META INFO -->
      <td class="right-column">
        <table class="meta-inner">
          <tr><td>Quotation No.</td><td>${quote.quotation_no}</td></tr>
          <tr><td>Version</td><td>${formatVersion(quote.version)}</td></tr>
          <tr><td>Quotation Date</td><td>${fmtDate(quote.quotation_date)}</td></tr>
          <tr><td>Payment Terms</td><td>${esc(quote.payment_terms || "—")}</td></tr>
          <tr><td>Salesperson Name</td><td>${esc(createdByName)}</td></tr>
          <tr><td>Mo. No.</td><td>${esc(createdByPhone)}</td></tr>
          <tr><td>E-Mail</td><td>${esc(createdByEmail)}</td></tr>
          <tr><td>Remarks, If Any:</td><td>${esc((quote as any)?.remarks || "")}</td></tr>
        </table>
      </td>
    </tr>
  </table>

  <!-- ITEMS TABLE -->
  <table class="items-table">
    <thead>
      <tr>
        <th style="width:5%;">#</th>
        <th style="width:50%; text-align:center;">Description</th>
        <th style="width:15%; text-align:center;">Qty.</th>
        <th style="width:15%; text-align:center;">Rate</th>
        <th style="width:15%; text-align:center;">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>

  <!-- SUMMARY TABLE (SEPARATE WITH GAP) -->
  <table class="summary-table">
    <tr class="summary-row">
      <td class="label"><strong>Sub Total</strong></td>
      <td class="amount"><strong>${fmt(subTotal)}</strong></td>
    </tr>

    ${discountTotal > 0 ? `
    <tr class="summary-row">
      <td class="label"><strong>Discount</strong></td>
      <td class="amount"><strong>- ${fmt(discountTotal)}</strong></td>
    </tr>
    ` : ""}

    <tr class="summary-row">
      <td class="label"><strong>Tax</strong></td>
      <td class="amount"><strong>${fmt(taxTotal)}</strong></td>
    </tr>

    <tr class="grand-total-row">
      <td class="label"><strong>Grand Total</strong></td>
      <td class="amount"><strong>${fmt(grandTotal)}</strong></td>
    </tr>
  </table>

  <!-- TERMS -->
  <div class="terms">
    <strong>Terms & Conditions:</strong>
    ${termsHtml}
  </div>

</div>

</body>
</html>
`;


    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";

    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) return;

    doc.open();
    doc.write(html);
    doc.close();

    iframe.onload = () => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();

      // cleanup
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    };
  }
 
  //-----------------Email operater --------------------///

  const copyLink = useCallback(() => {
    if (!quote?.id) return;

    const url = `${window.location.origin}/quotations/${quote.id}`;

    try {
      navigator.clipboard.writeText(url);
      setToast("Link copied");
    } catch (err) {
      console.error("Copy failed", err);
      setErrorMessage("Failed to copy link");
      setErrorOpen(true);
    }
  }, [quote]);




  ///Outlook option for the mail :-

  function openEmailClient(provider: "gmail" | "outlook") {
    if (!quote) return;

    const to = encodeURIComponent(quote.customer_email || "");
    const subject = encodeURIComponent(
      `Quotation ${quote.quotation_no || quote.id}`
    );

    const body = encodeURIComponent(
      `Hello,

Please find the quotation attached.
(Kindly attach the PDF before sending)

Quotation Link:
${window.location.origin}/quotations/${quote.id}

Ref: ${quote.quotation_no || quote.id}

Regards,`
    );

    let url = "";

    if (provider === "gmail") {
      url =
        `https://mail.google.com/mail/?view=cm&fs=1` +
        `&to=${to}` +
        `&su=${subject}` +
        `&body=${body}`;
    }

    if (provider === "outlook") {
      url =
        `https://outlook.office.com/mail/deeplink/compose` +
        `?to=${to}` +
        `&subject=${subject}` +
        `&body=${body}`;
    }

    window.open(url, "_blank", "noopener,noreferrer");
    setToast(
      provider === "gmail"
        ? "Gmail compose opened"
        : "Outlook compose opened"
    );
  }



  /* ---------- render ---------- */
  if (loading) {
    return (
      <Layout>
        <div className="p-8 max-w-6xl mx-auto">Loading…</div>
      </Layout>
    );
  }
  if (!quote) {
    return (
      <Layout>
        <div className="p-8 max-w-6xl mx-auto">Quotation not found.</div>
      </Layout>
    );
  }

  // const lifecycle = versioningLifecycle;
  // const status = businessStatus?.toLowerCase() ?? "pending";

  /* ===== ENTERPRISE 4-LAYER DECISION UI HELPERS ===== */

  // Helper: Follow-up risk scoring
  function getFollowupRiskScore() {
    if (businessStatus === "won" || businessStatus === "lost") {
      return { level: "complete", label: "Deal Closed", color: "text-gray-600" };
    }
   
    // Check next followup
    const nextFollowup = quote?.next_followup_date;
    if (nextFollowup) {
      const diffMs = new Date(nextFollowup).getTime() - Date.now();
      const diffDays = Math.ceil(diffMs / 86400000);
     
      if (diffDays <= 0) {
        return { level: "critical", label: "⚠️ Overdue Follow-Up", color: "text-red-600" };
      } else if (diffDays <= 2) {
        return { level: "warning", label: "⏰ Follow-Up Soon", color: "text-amber-600" };
      }
    }
   
    return { level: "healthy", label: "✓ On Track", color: "text-green-600" };
  }

  // Helper: Next action determination
  function getNextActionText() {
    if (!quote) return "Loading...";
    if (quote.status === "won") return "Proceed with order creation";
    if (quote.status === "lost") return "Deal closed - archive if needed";
    const riskScore = getFollowupRiskScore();
    if (riskScore.level === "critical") return "Immediate follow-up required";
    if (riskScore.level === "warning") return "Continue nurturing this deal";
    return "Continue deal progress";
  }

  function getNextActionSubtext() {
    if (!quote) return "";
    if (quote.status === "won") return "Convert to sales order when ready";
    if (quote.status === "lost") return "Record lessons learned";
    const riskScore = getFollowupRiskScore();
    if (riskScore.level === "critical") return "Customer expects communication";
    return "Last contact: " + (quote.created_at ? formatDateDDMMYYYY(quote.created_at) : "—");
  }

  function getPrimaryActionLabel() {
    if (!quote) return "Loading...";
    if (quote.status === "won") return "Create Order";
    if (quote.status === "lost") return "Close Deal";
    if (quote.validity_state === "expired") return "Re-Issue Quotation";
    const riskScore = getFollowupRiskScore();
    if (riskScore.level !== "healthy") return "Add Follow-Up";
    return "Send Quotation";
  }

  async function handlePrimaryAction() {
    if (!quote) return;

    // Create Order flow for won quotations - show modal with options
    if (quote.status === "won") {
      setShowCreateOrderModal(true);
      return;
    }

    // existing behaviors
    if (quote.validity_state === "expired" && !isLocked) {
      setShowReIssue(true);
    } else if (!isLocked && businessStatus !== "won" && businessStatus !== "lost") {
      setShowAddFollowup(true);
    }
  }

  function handleCreateIndent() {
    if (!quote) return;
    // Navigate to CreateIndent form with quotation data - indent will be created only when user clicks submit
    setShowCreateOrderModal(false);
    navigate(`/create-indent`, { state: { quotationId: quote.id, quotationNo: quote.quotation_no, quotationData: quote } });
  }

  // Helper: Render next followup
  function getNextFollowupInfo() {
    // Use the calculated nextPlannedFollowup memo instead of quote.next_followup_date
    if (!nextPlannedFollowup) {
      return { display: "None scheduled", days: "—" };
    }
    
    const diffDays = nextPlannedFollowup.diffDays;
    return {
      display: diffDays < 0 ? `${Math.abs(diffDays)}d overdue` : diffDays === 0 ? "Today" : `In ${diffDays}d`,
      days: `${diffDays}d`
    };
  }

  function getLastActivityDays() {
    if (!quote?.created_at) return "—";
    const diffMs = Date.now() - new Date(quote.created_at).getTime();
    const diffDays = Math.floor(diffMs / 86400000);
    return diffDays === 0 ? "Today" : `${diffDays}days ago`;
  }

  // Component: InsightCard
  function InsightCard({  label, value, hint }: {  label: string; value: string; hint: string; }) {
    return (
      <div className="bg-white border rounded-xl p-4 hover:shadow-md transition">
        <div className="text-xs text-gray-500 font-medium uppercase tracking-wider">{label}</div>
        <div className="text-lg font-semibold mt-2 text-gray-900">{value}</div>
        <div className="text-xs text-gray-400 mt-1">{hint}</div>
      </div>
    );
  }



  function getHeaderStatusUI() {
    // LAYER 1: TERMINAL STATES (highest priority)
    if (businessStatus === "won") return { label: "WON", tone: "green" };
    if (businessStatus === "lost") return { label: "LOST", tone: "red" };

    // LAYER 2: VERSIONING - SUPERSEDED (MOST IMPORTANT)
    // If this quotation has been superseded by a newer version, show as superseded
    if (quote?.reissued_to_id) {
      return { label: "Superseded", tone: "gray" };
    }

    // LAYER 3: VERSIONING - REISSUED (child in chain)
    // If this quotation IS a reissued version, show as reissued
    if (quote?.reissued_from_id) {
      return { label: "Reissued", tone: "purple" };
    }

    // LAYER 4: SYSTEM VALIDITY
    if (systemValidity === "expired") {
      return { label: "Expired", tone: "red" };
    }

    // DEFAULT: pending/draft → Active
    return { label: "Active", tone: "blue" };
  }


  // header accent asset from public folder (use origin so it works when deployed)
  // const headerAccent = `${window.location.origin}/header-accent.png`;

  function ItemsSummary({
    totals,
    displayedGrand,
    fmt,
    onViewProducts,
  }: {
    totals: any;
    displayedGrand: number;
    fmt: (n: number) => string;
    onViewProducts: () => void;
  }) {
    const [open, setOpen] = React.useState(false);



    return (
      <div className="border rounded-lg bg-white">
        {/* HEADER */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b cursor-pointer hover:bg-gray-50"
          onClick={() => setOpen(!open)}
        >
          <div>
            <h3 className="text-sm font-semibold">Items Detail</h3>
            <div className="text-xs text-gray-500">
              {totals.lines.length} items · Total {fmt(displayedGrand)}
            </div>
          </div>

          <span className="text-xs text-indigo-600">
            {open ? "Collapse ▲" : "Expand ▼"}
          </span>
        </div>

        {/* TABLE */}
        {open && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr className="text-left text-xs text-gray-500 uppercase">
                  <th className="px-4 py-2 w-12">#</th>
                  <th className="px-4 py-2">Item</th>
                  <th className="px-4 py-2 text-center">Qty</th>
                  <th className="px-4 py-2 text-right">Unit</th>
                  <th className="px-4 py-2 text-center">Disc</th>
                  <th className="px-4 py-2 text-center">Tax</th>
                  <th className="px-4 py-2 text-right">Line Total</th>
                </tr>
              </thead>

              <tbody className="divide-y">
                {totals.lines.map((l: any, i: number) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-400">{i + 1}</td>

                    <td className="px-4 py-2">
                      <div className="font-medium text-gray-800">
                        {l.product_name}
                      </div>

                      {l.description && (
                        <div className="text-xs text-gray-500 whitespace-pre-wrap break-words">
                          {l.description}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-2 text-center">{l.qty}</td>

                    <td className="px-4 py-2 text-right">
                      {fmt(l.unit_price)}
                    </td>

                    <td className="px-4 py-2 text-center">
                      {l.discount_percent > 0 ? (
                        <span className="text-rose-600 font-medium">
                          −{l.discount_percent}%
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>

                    <td className="px-4 py-2 text-center">
                      {l.tax_rate > 0 ? `${l.tax_rate}%` : "—"}
                    </td>

                    <td className="px-4 py-2 text-right font-medium">
                      {fmt(l.lineTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* FOOTER */}
        <div className="flex justify-between items-center px-4 py-3 border-t bg-gray-50">
          <div className="text-sm font-semibold">
            Total: {fmt(displayedGrand)}
          </div>

          <button
            onClick={onViewProducts}
            className="text-sm text-indigo-600 hover:underline"
          >
            View Full Products →
          </button>
        </div>
      </div>
    );
  }
  /// ---------- Add Follow-Up Modal ----------

  function AddFollowupModal({
    quotationId,
    canMutateFollowups,
    onClose,
    onCreated,
  }: {
    quotationId: number;
    canMutateFollowups: boolean;
    onClose: () => void;
    onCreated: () => void;
  }) {
    const [followupDate, setFollowupDate] = useState("");
    const [nextFollowupDate, setNextFollowupDate] = useState("");
    const [type, setType] = useState<
      "call" | "email" | "whatsapp" | "meeting" | "site_visit" | "other"
    >("call");
    const [note, setNote] = useState("");
    const [loading, setLoading] = useState(false);
    const followupDateRef = useRef<HTMLInputElement>(null);
    const nextFollowupDateRef = useRef<HTMLInputElement>(null);

    async function submit() {
      // 🔒 HARD BUSINESS RULE GUARD
      if (!canMutateFollowups) {
        setToast("Follow-ups are locked for this quotation");
        return;
      }

      if (!followupDate || !note.trim()) return;

      setLoading(true);
      try {
        await api.createQuotationFollowup(quotationId, {
          followup_date: followupDate,
          note: note.trim(),
          followup_type: type,
          next_followup_date: nextFollowupDate || null,
        });
        onCreated();
      } finally {
        setLoading(false);
      }
    }

    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl w-full max-w-lg shadow-xl">
          {/* HEADER */}
          <div className="px-5 py-4 border-b">
            <h3 className="text-base font-semibold">Log Follow-Up</h3>
            <p className="text-xs text-gray-500">
              Record customer interaction and plan next action
            </p>
          </div>

          {/* BODY */}
          <div className="p-5 space-y-4">
            {/* TYPE */}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">
                Follow-Up Type
              </label>
              <select
                aria-label="Follow-Up Type"
                value={type}
                onChange={(e) =>
                  setType(e.target.value as
                    | "call"
                    | "email"
                    | "whatsapp"
                    | "meeting"
                    | "site_visit"
                    | "other"
                  )
                }
                className="w-full border rounded-lg px-3 py-2 text-sm"
              >
                <option value="call">📞 Call</option>
                <option value="email">📧 Email</option>
                <option value="whatsapp">💬 WhatsApp</option>
                <option value="meeting">🤝 Meeting</option>
                <option value="site_visit">🏭 Site Visit</option>
                <option value="other">📌 Other</option>
              </select>
            </div>

            {/* FOLLOW-UP DATE */}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">
                Follow-Up Date
              </label>
              <div className="relative">
                <input
                  ref={followupDateRef}
                  type="date"
                  aria-label="Follow-Up Date"
                  value={followupDate}
                  onChange={(e) => setFollowupDate(e.target.value)}
                  onClick={() => followupDateRef.current?.showPicker()}
                  className="w-full border rounded-lg px-3 py-2 text-sm pr-10 cursor-pointer"
                />

                {/* Calendar Icon */}
                <button
                  type="button"
                  onClick={() => followupDateRef.current?.showPicker()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-indigo-600"
                  tabIndex={-1}
                >
                  📅
                </button>
              </div>
            </div>

            {/* NOTE */}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">
                Outcome / Notes
              </label>
              <textarea
                rows={4}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="What happened? What is the next expectation?"
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>

            {/* NEXT FOLLOW-UP */}
            <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3">
              <label className="text-xs font-medium text-indigo-700 mb-1 block">
                Next Follow-Up (Optional)
              </label>
              <div className="relative">
                <input
                  ref={nextFollowupDateRef}
                  type="date"
                  aria-label="Next Follow-Up Date"
                  value={nextFollowupDate}
                  onChange={(e) => setNextFollowupDate(e.target.value)}
                  onClick={() => nextFollowupDateRef.current?.showPicker()}
                  className="w-full border rounded-lg px-3 py-2 text-sm pr-10 cursor-pointer"
                />

                <button
                  type="button"
                  onClick={() => nextFollowupDateRef.current?.showPicker()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-indigo-500 hover:text-indigo-700"
                  tabIndex={-1}
                >
                  📅
                </button>
              </div>
              <p className="text-[11px] text-indigo-600 mt-1">
                This drives Follow-Up Intelligence & risk scoring
              </p>
            </div>
          </div>

          {/* FOOTER */}
          <div className="px-5 py-4 border-t flex justify-end gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm rounded border"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={loading || !followupDate || !note.trim()}
              className="px-4 py-2 text-sm rounded bg-indigo-600 text-white disabled:opacity-50"
            >
              {loading ? "Saving…" : "Save Follow-Up"}
            </button>
          </div>
        </div>
      </div>
    );
  }


  /* ===== CREATE ORDER MODAL ===== */
  function CreateOrderModal({
    open,
    onClose,
    onCreateIndent,
    isLoading,
  }: {
    open: boolean;
    onClose: () => void;
    onCreateIndent: () => void;
    isLoading: boolean;
  }) {
    if (!open) return null;

    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
          {/* HEADER */}
          <div className="px-6 py-4 border-b">
            <h3 className="text-lg font-semibold text-gray-900">Create Order</h3>
            <p className="text-sm text-gray-500 mt-1">
              Convert this quotation to an indent for procurement
            </p>
          </div>

          {/* CONTENT */}
          <div className="px-6 py-6">
            <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="text-2xl">📋</div>
                <div>
                  <h4 className="font-semibold text-indigo-900">Create Indent</h4>
                  <p className="text-sm text-indigo-700 mt-1">
                    Creates an indent for this quotation which can be used to generate purchase orders
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* FOOTER */}
          <div className="px-6 py-4 border-t flex justify-end gap-2">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-sm rounded border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={onCreateIndent}
              disabled={isLoading}
              className="px-4 py-2 text-sm rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {isLoading ? "Creating..." : "Create Indent"}
            </button>
          </div>
        </div>
      </div>
    );
  }


  function StatCard({
    label,
    value,
    tone = "gray",
  }: {
    label: string;
    value: string;
    tone?: "green" | "amber" | "red" | "blue" | "gray";
  }) {
    const map: any = {
      green: "bg-green-50 text-green-700",
      amber: "bg-amber-50 text-amber-700",
      red: "bg-red-50 text-red-700",
      blue: "bg-indigo-50 text-indigo-700",
      gray: "bg-gray-50 text-gray-700",
    };

    return (
      <div className={`rounded-lg p-4 border ${map[tone]}`}>
        <div className="text-xs uppercase tracking-wide">{label}</div>
        <div className="text-lg font-semibold mt-1">{value}</div>
      </div>
    );
  }




  return (
    <Layout>
      <style>{`
        .modern-card { border-radius: 12px; border: 1px solid #e5e7eb; }
        .modern-hover { transition: box-shadow 0.2s; }
        .modern-hover:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
        @media (max-width: 1024px) { .grid-responsive { grid-template-columns: 1fr 1fr; } }
      `}</style>

      <div className="max-w-7xl mx-auto p-8 space-y-6">
       
        {/* ===== LAYER 1: HERO (Decision Anchor) ===== */}
        <div className="bg-white border rounded-xl shadow-sm p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
                {quote.quotation_no}
              </h1>
              <div className="text-sm text-gray-500 mt-1">
                {quote.customer_name} • <strong>{fmt(displayedGrand)}</strong>
              </div>
            </div>
            <div className="flex flex-col items-end gap-3">
              {(() => {
                const ui = getHeaderStatusUI();
                const toneMap: any = {
                  green: "text-green-700 bg-green-100",
                  red: "text-red-700 bg-red-100",
                  amber: "text-amber-700 bg-amber-100",
                  blue: "text-blue-700 bg-blue-100",
                  gray: "text-gray-700 bg-gray-100",
                  purple: "text-purple-700 bg-purple-100",
                };
                return (
                  <div className={`px-4 py-2 rounded-full text-sm font-semibold ${toneMap[ui.tone]}`}>
                    {ui.label}
                  </div>
                );
              })()}
             
              {/* ACTION BUTTONS */}
              <div className="flex items-center gap-2">
                {/* EDIT */}
                <button
                  onClick={() => {
                    if (isExpired || isLocked) return;
                    navigate(`/quotations/${quote.id}/edit`);
                  }}
                  title={
                    isExpired
                      ? "Quotation expired. Re-issue required."
                      : isLocked
                        ? "This quotation has been superseded. It is locked."
                        : "Edit quotation"
                  }
                  disabled={isExpired || isLocked}
                  className={`p-2 rounded border bg-white hover:bg-gray-50 transition ${
                    isExpired || isLocked ? "opacity-40 cursor-not-allowed" : ""
                  }`}
                >
                  <Edit size={18} />
                </button>

                {/* PRINT */}
                <button
                  onClick={printQuotation}
                  title={
                    viewingVersion
                      ? "Close version preview to print quotation"
                      : "Print quotation"
                  }
                  disabled={!!viewingVersion}
                  className={`p-2 rounded border bg-white hover:bg-gray-50 transition ${
                    viewingVersion ? "opacity-40 cursor-not-allowed" : ""
                  }`}
                >
                  <Printer size={18} />
                </button>

                {/* COPY LINK */}
                <button
                  onClick={copyLink}
                  title="Copy link"
                  className="p-2 rounded border bg-white hover:bg-gray-50 transition"
                >
                  <Copy size={18} />
                </button>

                {/* EMAIL */}
                <div className="relative">
                  <button
                    title="Send email"
                    className="p-2 rounded border bg-white hover:bg-gray-50 transition"
                    onClick={() => _setActionsMenuOpen((v) => !v)}
                  >
                    <Mail size={18} />
                  </button>

                  {_actionsMenuOpen && (
                    <div className="absolute right-0 mt-2 w-40 bg-white border rounded-lg shadow-lg z-50">
                      <button
                        onClick={() => {
                          openEmailClient("gmail");
                          _setActionsMenuOpen(false);
                        }}
                        className="w-full px-4 py-2 text-sm text-left hover:bg-gray-50"
                      >
                        📧 Gmail
                      </button>

                      <button
                        onClick={() => {
                          openEmailClient("outlook");
                          _setActionsMenuOpen(false);
                        }}
                        className="w-full px-4 py-2 text-sm text-left hover:bg-gray-50"
                      >
                        📨 Outlook
                      </button>
                    </div>
                  )}
                </div>

                {/* WON / LOST */}
                {quote && !isLocked && quote.validity_state !== "expired" && (
                  <WonLostDecision
                    quotationId={quote.id}
                    status={quote.status}
                    onWon={handleWon}
                    onLost={handleLost}
                    isLoading={actionLoading}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Decision Strip */}
          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            <span className="px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 font-medium">
              💰 {fmt(displayedGrand)}
            </span>
            {quote.status !== "won" && quote.status !== "lost" && (
              <span className={`px-3 py-1.5 rounded-full font-medium ${
                quote.validity_state === "expired"
                  ? "bg-red-100 text-red-700"
                  : "bg-green-100 text-green-700"
              }`}>
                ⏳ {quote.validity_state === "expired"
                  ? "Expired"
                  : `${quote.remaining_days ?? 0}d remaining`}
              </span>
            )}
            <span className="px-3 py-1.5 rounded-full bg-indigo-100 text-indigo-700 font-medium">
              📦 {totals.lines.length} Items
            </span>
          </div>
        </div>

        {/* ===== LAYER 2: ACTION BAR (Next Step) ===== */}
        {quote.status !== "lost" && quote.validity_state !== "expired" && (
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-indigo-900">
                {getNextActionText()}
              </div>
              <div className="text-xs text-indigo-600 mt-0.5">
                {getNextActionSubtext()}
              </div>
            </div>
            {quote.status === "won" && (
              <button
                onClick={handlePrimaryAction}
                disabled={creatingOrder}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition shrink-0 ml-4 disabled:opacity-60"
              >
                {creatingOrder ? "Creating..." : getPrimaryActionLabel()}
              </button>
            )}
          </div>
        )}

        {/* ===== RE-ISSUE ACTION BAR (For Expired Quotations) ===== */}
        {quote.validity_state === "expired" && !isLocked && quote.status !== "won" && quote.status !== "lost" && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-amber-900">
                Re-Issue this Quotation
              </div>
              <div className="text-xs text-amber-700 mt-0.5">
                Send an updated quotation to your customer
              </div>
            </div>
            <button
              onClick={() => setShowReIssue(true)}
              className="bg-amber-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-amber-700 transition shrink-0 ml-4"
            >
              ↻ Re-Issue
            </button>
          </div>
        )}

        {/* ===== LAYER 3: INSIGHT GRID (State Awareness) ===== */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 grid-responsive">
          <InsightCard
            label="Status"
            value={(() => {
              const ui = getHeaderStatusUI();
              return ui.label;
            })()}
            hint="Deal stage"
          />
          <InsightCard
            label="Risk"
            value={getFollowupRiskScore().label}
            hint="Follow-up tracking"
          />
          <InsightCard
            label="Next Follow-Up"
            value={getNextFollowupInfo().days}
            hint="Upcoming task"
          />
          <InsightCard
            label="Last Activity"
            value={getLastActivityDays()}
            hint="Customer contact"
          />
        </div>

        {/* ===== VALIDITY BANNERS ===== */}
        {/* HIGHEST PRIORITY: Superseded */}
        {quote.reissued_to_id && (
          <div className="mb-4 p-4 bg-amber-50 border-2 border-amber-300 rounded-lg text-sm text-amber-900 shadow-md">
            <div className="font-semibold text-base">🔒 Quotation superseded</div>
            <div className="text-sm mt-2">
              A newer version of this quotation exists. This version is locked.
            </div>
            <button
              onClick={() => navigate(`/quotations/${quote.reissued_to_id}`)}
              className="text-sm text-amber-700 hover:underline font-medium mt-3 inline-block"
            >
              View latest version →
            </button>
          </div>
        )}

        {/* ===== TABS HEADER ===== */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="flex gap-6 text-sm font-medium">
            {[
              { id: "overview", label: "Overview" },
              { id: "products", label: "Products" },
              { id: "followups", label: "Follow-Ups" },
              { id: "history", label: "History" },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                className={`pb-3 transition ${activeTab === t.id
                  ? "border-b-2 border-indigo-600 text-indigo-600"
                  : "text-gray-500 hover:text-gray-700"
                  }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>

        {(isSuperseded || isReissued) && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-700">
            {isSuperseded ? (
              <>
                🔒 This quotation has been superseded by a newer version.
                Further edits or re-issue actions are not allowed.
              </>
            ) : (
              <>
                🔄 This is a reissued version. It is editable and can be re-issued.
              </>
            )}
          </div>
        )}


        {activeTab === "overview" && (
          <div className="space-y-6">

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
              <div className="lg:col-span-2">
                <div className="bg-white rounded-lg border shadow p-4">


                  <div className="mt-4 border-t pt-4">
                    <h4 className="font-medium">Customer contact</h4>

                    {quote.customer_contact_person && (
                      <div className="mt-2 text-sm text-gray-700">
                        <strong>Contact Person:</strong> {quote.customer_contact_person}
                      </div>
                    )}

                    <div className="mt-2 text-sm text-gray-700">
                      <div>
                        <strong>Address:</strong>
                        <div className="whitespace-pre-wrap">
                          {quote.customer_address ?? "(Customer address not provided)"}
                        </div>
                      </div>

                      {quote.customer_gst && (
                        <div className="mt-2">
                          <strong>GST:</strong> {quote.customer_gst}
                        </div>
                      )}

                      {quote.customer_phone && (
                        <div className="mt-2">
                          <strong>Phone:</strong> {quote.customer_phone}
                        </div>
                      )}

                      {quote.customer_email && (
                        <div className="mt-2">
                          <strong>Email:</strong> {quote.customer_email}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <aside className="bg-white rounded-lg border shadow p-4">
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  Quotation Owner
                  <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                    Owner
                  </span>
                </h4>
                <div className="text-sm text-gray-700">
                  <div><strong>Name:</strong> {quote.salesperson_name ?? "—"}</div>
                  {quote.salesperson_phone ? <div className="mt-2"><strong>Phone:</strong> {quote.salesperson_phone}</div> : null}
                  {quote.salesperson_email ? <div className="mt-2"><strong>Email:</strong> {quote.salesperson_email}</div> : null}
                </div>


              </aside>
            </div>

            {/* ================= SECTION 1 — EXECUTIVE SNAPSHOT ================= */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

              {/* STATUS */}
              {(() => {
                const statusUI = getStatusDisplay(quote.status, followupRiskScore);

                return (
                  <StatCard
                    label="Status"
                    value={statusUI.label}
                    tone={statusUI.tone}
                  />
                );
              })()}

              {/* DEAL VALUE */}
              <StatCard
                label="Deal Value"
                value={fmt(displayedGrand)}
                tone="green"
              />

              {/* VALIDITY */}
              {!isTerminal && quote.status !== "won" && quote.status !== "lost" && (
                <StatCard
                  label="Validity"
                  value={
                    quote.status === "draft"
                      ? "Not Applicable"
                      : quote.validity_state === "expired"
                        ? "Expired"
                        : quote.remaining_days === 0
                          ? "Expires Today"
                          : `Expires in ${quote.remaining_days} days`
                  }
                  tone={
                    quote.status === "draft"
                      ? "gray"
                      : quote.validity_state === "expired"
                        ? "red"
                        : (quote.remaining_days ?? 99) <= 2
                          ? "amber"
                          : "green"
                  }
                />
              )}


              {/* VERSION */}
              <StatCard
                label="Version"
                value={`v${formatVersion(quote.version)}`}
                tone="blue"
              />

              <StatCard
                label="Payment Terms"
                value={quote.payment_terms || "No payemt terms mentioned"}
                tone="gray"
              />

            </div>
            {/* ================= SECTION 2 — ITEMS SUMMARY ================= */}
            <div className="bg-white border rounded-xl shadow-sm">

              {/* HEADER */}
              <div className="flex items-center justify-between px-5 py-4 border-b">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">
                    Items Summary
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {totals.lines.length} item{totals.lines.length !== 1 ? "s" : ""} ·
                    Quotation value overview
                  </p>
                </div>

                {/* PRIMARY VALUE */}
                <div className="text-right">
                  <div className="text-xs text-gray-500">Total Value</div>
                  <div className="text-lg font-semibold text-gray-900">
                    {fmt(displayedGrand)}
                  </div>
                </div>
              </div>

              {/* SNAPSHOT STRIP */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 px-5 py-4 bg-gray-50 border-b">

                <div>
                  <div className="text-xs text-gray-500">Subtotal</div>
                  <div className="font-medium">{fmt(totals.subtotal)}</div>
                </div>

                <div>
                  <div className="text-xs text-gray-500">Tax</div>
                  <div className="font-medium">{fmt(totals.tax)}</div>
                </div>

                <div>
                  <div className="text-xs text-gray-500">Discounts</div>
                  <div className="font-medium">
                    {totals.lines.some(l => l.discount_percent > 0)
                      ? "Applied"
                      : "Not applied"}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-gray-500">Items</div>
                  <div className="font-medium">
                    {totals.lines.length}
                  </div>
                </div>

              </div>

              {/* COLLAPSIBLE DETAIL */}
              <ItemsSummary
                totals={totals}
                displayedGrand={displayedGrand}
                fmt={fmt}
                onViewProducts={() => setActiveTab("products")}
              />

            </div>

            {/* ================= SECTION 3 — TERMS & CONDITIONS ================= */}
            <div className="bg-white border rounded-lg p-4">
              <h3 className="text-sm font-semibold mb-3">Terms & Conditions</h3>

              {quote.terms ? (
                <div className="whitespace-pre-wrap text-sm text-gray-700">
                  {quote.terms}
                </div>
              ) : (
                <div className="text-gray-500 text-sm">
                  No terms and conditions provided.
                </div>
              )}

              {quote.notes && (
                <>
                  <div className="mt-4 pt-3 border-t">
                    <h4 className="text-xs font-semibold text-gray-500 mb-1">
                      Internal Notes
                    </h4>
                    <div className="whitespace-pre-wrap text-sm text-gray-700">
                      {quote.notes}
                    </div>
                  </div>
                </>
              )}

              <div className="pt-3 mt-3 border-t text-xs text-gray-500">
                <div>Validity Period: {quote.validity_days ?? "—"} days</div>
                <div>Prepared by: {quote.salesperson_name ?? "—"}</div>
              </div>
            </div>

            {/* ================= SECTION 4 — FOLLOW-UP INTELLIGENCE ================= */}
            <div className="bg-white border rounded-lg p-4 space-y-4">
              {/* HEADER */}
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Follow-Up Intelligence</h3>
                <p className="text-xs text-gray-500">
                  Risk status and next required customer action
                </p>
                {/* Risk Badge */}
                <span
                  className={`px-2 py-1 text-xs rounded-full font-medium ${followupRiskScore.color === "red"
                    ? "bg-red-100 text-red-700"
                    : followupRiskScore.color === "amber"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-green-100 text-green-700"
                    }`}
                >
                  {followupRiskScore.label}
                </span>
              </div>

              {/* NO FOLLOW-UPS */}
              {followups.length === 0 ? (
                <div className="text-sm text-gray-500">
                  No follow-ups logged yet.
                  <button
                    onClick={() => setActiveTab("followups")}
                    className="ml-2 text-indigo-600 hover:underline"
                  >
                    Add Follow-Up →
                  </button>
                </div>
              ) : (
                <>




                  {(() => {
                    if (!followups.length) return null;

                    // 1️⃣ Prefer latest NON-completed follow-up
                    // Always show most recent interaction (completed or not)
                    // 1️⃣ Prefer most recent OPEN follow-up
                    const last = [...followups]
                      .sort(
                        (a, b) =>
                          new Date(b.created_at).getTime() -
                          new Date(a.created_at).getTime()
                      )[0];

                    if (!last) return null;


                    if (!last) return null;


                    const lastDate = new Date(last.followup_date);

                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    lastDate.setHours(0, 0, 0, 0);



                    const meta =
                      FOLLOWUP_TYPE_META[
                      last.followup_type as keyof typeof FOLLOWUP_TYPE_META
                      ] || FOLLOWUP_TYPE_META.other;

                    // Day-level overdue check
                    let isOverdue = false;
                    if (!last.is_completed && last.next_followup_date) {
                      const next = new Date(last.next_followup_date);
                      next.setHours(0, 0, 0, 0);
                      isOverdue = next <= today;
                    }

                    return (
                      <div
                        className={`border rounded-lg p-3 space-y-2 ${isOverdue ? "bg-red-50 border-red-300" : "bg-slate-50"
                          }`}
                      >
                        {/* HEADER */}
                        <div className="flex items-center justify-between gap-2">
                          {/* LEFT GROUP */}
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="text-xs text-gray-500 uppercase tracking-wide">
                              Last Interaction
                            </div>

                            {isOverdue && (
                              <span className="text-xs text-red-600 font-medium whitespace-nowrap">
                                ⚠ Attention Required
                              </span>
                            )}
                          </div>

                          {/* RIGHT BADGE */}
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${meta.color}`}
                          >
                            {meta.label}
                          </span>
                        </div>

                        {/* NOTE */}
                        <div className="text-sm text-gray-800 whitespace-pre-wrap">
                          {last.note || "—"}
                        </div>

                        {/* META */}
                        <div className="text-xs text-gray-500 space-y-1">
                          <div>
                            Logged{" "}
                            {Math.floor(
                              (today.getTime() - new Date(last.created_at).getTime()) /
                              (1000 * 60 * 60 * 24)
                            )}{" "}
                            day(s) ago
                            {last.followup_date && (
                              <>
                                {" "}
                                · Interaction on {formatDateDDMMYYYY(last.followup_date)}
                              </>
                            )}
                          </div>

                          <div>
                            by <strong>{last.created_by_name || "—"}</strong>
                          </div>
                        </div>

                        {/* ACTION */}
                        <div className="flex justify-end pt-2">
                          {!last.is_completed ? (
                            <button
                              onClick={() => markFollowupDone(last.id)}
                              className="
        inline-flex items-center gap-1.5
        px-3 py-1.5
        text-xs font-medium
        rounded-full
        bg-green-50 text-green-700
        border border-green-200
        hover:bg-green-100
        hover:border-green-300
        transition
      "
                            >
                              ✓ Mark as Completed
                            </button>
                          ) : (
                            <span
                              className="
        inline-flex items-center gap-1.5
        px-3 py-1.5
        text-xs font-medium
        rounded-full
        bg-green-100 text-green-700
        border border-green-200
      "
                            >
                              ✓ Completed
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })()}


                  {/* NEXT FOLLOW-UP */}
                  {nextPlannedFollowup && (() => {
                    const meta =
                      FOLLOWUP_TYPE_META[
                      nextPlannedFollowup.followup_type as keyof typeof FOLLOWUP_TYPE_META
                      ] || FOLLOWUP_TYPE_META.other;

                    return (
                      <div className="flex items-center justify-between border rounded-lg p-4 bg-slate-50">
                        <div>
                          <div className="text-xs text-gray-500 uppercase tracking-wide">
                            Next Follow-Up
                          </div>

                          <div className="text-sm font-semibold">
                            {nextPlannedFollowup.d.toLocaleDateString()}
                          </div>

                          <div className="text-xs text-gray-500 mt-1">
                            Owner: <strong>{nextPlannedFollowup.created_by_name || "—"}</strong>
                          </div>
                        </div>

                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${nextPlannedFollowup.tone}`}>
                          {meta.label} ·{" "}
                          {nextPlannedFollowup.diffDays < 0
                            ? `Overdue (${Math.abs(nextPlannedFollowup.diffDays)}d)`
                            : nextPlannedFollowup.diffDays === 0
                              ? "Today"
                              : nextPlannedFollowup.diffDays === 1
                                ? "Tomorrow"
                                : `In ${nextPlannedFollowup.diffDays} days`}
                        </span>
                      </div>
                    );
                  })()}

                  {/* CTA */}
                  <div className="text-right">
                    <button
                      onClick={() => setActiveTab("followups")}
                      className="text-indigo-600 text-sm hover:underline"
                    >
                      View Full Timeline →
                    </button>
                  </div>
                </>
              )}
            </div>



            {/* ================= SECTION 5 — STAKEHOLDERS ================= */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="border rounded-lg p-4">
                <div className="text-xs text-gray-500">Salesperson</div>
                <div className="font-semibold">{quote.salesperson_name || "—"}</div>
                {quote.salesperson_email && (
                  <div className="text-xs text-gray-500">
                    {quote.salesperson_email}
                  </div>
                )}
              </div>

              <div className="border rounded-lg p-4">
                <div className="text-xs text-gray-500">Customer Contact</div>
                <div className="text-sm whitespace-pre-wrap text-gray-700">
                  {quote.customer_address ?? "—"}
                </div>
              </div>
            </div>

            {/* ================= SECTION 6 — FINANCIAL HEALTH (ADMIN) ================= */}
            <div className="border rounded-lg p-4">
              <h3 className="text-sm font-semibold mb-3">Financial Health</h3>

              <div className="flex flex-wrap gap-2 text-xs">
                <span className="px-3 py-1 rounded-full bg-green-100 text-green-700">
                  Deal Size: {fmt(displayedGrand)}
                </span>

                {totals.lines.some((l) => l.discount_percent > 0) && (
                  <span className="px-3 py-1 rounded-full bg-rose-100 text-rose-700">
                    Discount Applied
                  </span>
                )}

                <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700">
                  Tax Included
                </span>
              </div>
            </div>

            {/* ================= SECTION 7 — SYSTEM STATUS ================= */}
            <div className="border rounded-lg p-4">
              <h3 className="text-sm font-semibold mb-3">System Status</h3>

              <div className="flex gap-6 text-sm">
                <div>
                  Editable:{" "}
                  <strong>
                    {quote.validity_state === "expired" ? "No" : "Yes"}
                  </strong>
                </div>

                <div>
                  Follow-Ups:{" "}
                  <strong>
                    {quote.status === "pending" ? "Enabled" : "Locked"}
                  </strong>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* Products Tab */}
        {activeTab === "products" && (
          <div className="bg-white rounded-lg border shadow-sm overflow-hidden">

            {/* HEADER */}
            <div className="p-4 border-b flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">Products</h3>
                <p className="text-xs text-gray-500">
                  Full item-level breakdown (current version)
                </p>
              </div>
              <div className="text-xs text-gray-400">
                Rows: {totals.lines.length}
              </div>
            </div>

            {/* TABLE */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">

                {/* ===== TABLE HEAD ===== */}
                <thead className="bg-slate-50 border-b">
                  <tr className="text-xs text-gray-500 uppercase tracking-wide">
                    <th className="px-4 py-3 text-left w-10">#</th>
                    <th className="px-4 py-3 text-left">Item</th>
                    <th className="px-4 py-3 text-center w-16">Qty</th>
                    <th className="px-4 py-3 text-right w-24">Rate</th>
                    <th className="px-4 py-3 text-right w-28">Base Total</th>
                    <th className="px-4 py-3 text-center w-20">Disc</th>
                    <th className="px-4 py-3 text-center w-16">Tax</th>
                    <th className="px-4 py-3 text-center w-24">HSN</th>
                    <th className="px-4 py-3 text-right w-28">Line Total</th>
                  </tr>
                </thead>

                {/* ===== TABLE BODY ===== */}
                <tbody>
                  {totals.lines.map((l: any, idx: number) => {
                    const isOpen = !!expandedRows[idx];
                    const baseTotal = l.qty * l.unit_price;

                    return (
                      <React.Fragment key={idx}>
                        {/* MAIN ROW */}
                        <tr
                          className="border-b hover:bg-slate-50 cursor-pointer"
                          onClick={() => toggleRow(idx)}
                        >
                          <td className="px-4 py-3 text-gray-400">{idx + 1}</td>

                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-900">
                              {l.product_name}
                            </div>
                            <div className="text-xs text-gray-400">
                              Click to {isOpen ? "hide" : "view"} description
                            </div>
                          </td>

                          <td className="px-4 py-3 text-center">{l.qty}</td>

                          <td className="px-4 py-3 text-right">
                            {fmt(l.unit_price)}
                          </td>

                          {/* BASE TOTAL */}
                          <td className="px-4 py-3 text-right text-gray-600">
                            {fmt(baseTotal)}
                          </td>

                          <td className="px-4 py-3 text-center">
                            {l.discount_percent > 0 ? (
                              <span className="text-rose-600 font-medium">
                                −{l.discount_percent}%
                              </span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>

                          <td className="px-4 py-3 text-center">
                            {l.tax_rate}%
                          </td>

                          {/* HSN */}
                          <td className="px-4 py-3 text-center text-xs text-gray-700">
                            {l.hsn_code || "—"}
                          </td>

                          <td className="px-4 py-3 text-right font-semibold">
                            {fmt(l.lineTotal)}
                          </td>
                        </tr>

                        {/* EXPANDED DE9CRIPTION */}
                        {isOpen && (
                          <tr className="bg-slate-50">
                            <td />
                            <td
                              colSpan={8}
                              className="px-4 pb-4 text-xs text-gray-600 whitespace-pre-wrap break-words"
                            >
                              {l.description || "No description provided"}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>

                {/* ===== TABLE FOOTER ===== */}
                <tfoot>
                  <tr className="bg-slate-100 font-semibold">
                    <td colSpan={9} className="px-4 py-3 text-right">
                      Grand Total
                    </td>
                    <td className="px-4 py-3 text-right">
                      {fmt(displayedGrand)}
                    </td>
                  </tr>
                </tfoot>

              </table>
            </div>
          </div>
        )}


        {/* ================= FOLLOW-UPS TAB (PRO UI) ================= */}
        {activeTab === "followups" && (
          <div className="space-y-6">

            {/* HEADER */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Follow-Ups
                </h3>
                <p className="text-xs text-gray-500">
                  Customer interactions & reminders timeline
                </p>
              </div>

              <button
                onClick={() => canAddFollowup && setShowAddFollowup(true)}
                disabled={!canAddFollowup}
                title={
                  canAddFollowup
                    ? "Add follow-up"
                    : "Follow-ups are allowed only while quotation is Pending"
                }
                className={`px-4 py-2 rounded-md text-sm shadow-sm
    ${canAddFollowup
                    ? "bg-indigo-600 text-white hover:bg-indigo-700"
                    : "bg-gray-300 text-gray-600 cursor-not-allowed"
                  }`}
              >
                + Add Follow-Up
              </button>
            </div>

            {/* SLA COUNTERS — ADD HERE */}
            <div className="grid grid-cols-3 gap-3">
              <StatCard
                label="Missed"
                value={String(slaCounters.missed)}
                tone="red"
              />
              <StatCard
                label="Due Today"
                value={String(slaCounters.today)}
                tone="amber"
              />
              <StatCard
                label="Upcoming"
                value={String(slaCounters.upcoming)}
                tone="green"
              />
            </div>

            {/* CONTENT */}
            <div className="bg-white border rounded-xl p-6">

              {loadingFollowups ? (
                <div className="text-sm text-gray-500">Loading follow-ups…</div>
              ) : followups.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-gray-500 text-sm mb-2">
                    No follow-ups recorded yet
                  </div>
                  <div className="text-xs text-gray-400 mb-4">
                    Start logging customer communication to track engagement
                  </div>
                  <button
                    onClick={() => setShowAddFollowup(true)}
                    disabled={!canMutateFollowups}
                    className={`px-4 py-2 rounded-md text-sm shadow-sm
    ${canMutateFollowups
                        ? "bg-indigo-600 text-white hover:bg-indigo-700"
                        : "bg-gray-300 text-gray-500 cursor-not-allowed"}
  `}
                  >
                    + Add Follow-Up
                  </button>
                </div>
              ) : (
                <div className="relative pl-6 space-y-6">

                  {/* NEXT FOLLOW-UP INDICATOR */}
                  {nextPlannedFollowup && (() => {
                    const meta =
                      FOLLOWUP_TYPE_META[
                      nextPlannedFollowup.followup_type as keyof typeof FOLLOWUP_TYPE_META
                      ] || FOLLOWUP_TYPE_META.other;

                    return (
                      <div className="flex items-center justify-between border rounded-lg p-4 bg-slate-50">
                        <div>
                          <div className="text-xs text-gray-500 uppercase tracking-wide">
                            Next Follow-Up
                          </div>

                          <div className="text-sm font-semibold">
                            {nextPlannedFollowup.d.toLocaleDateString()}
                          </div>

                          <div className="text-xs text-gray-500 mt-1">
                            Owner: <strong>{nextPlannedFollowup.created_by_name || "—"}</strong>
                          </div>
                        </div>

                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${nextPlannedFollowup.tone}`}>
                          {meta.label} ·{" "}
                          {nextPlannedFollowup.diffDays < 0
                            ? `Overdue (${Math.abs(nextPlannedFollowup.diffDays)}d)`
                            : nextPlannedFollowup.diffDays === 0
                              ? "Today"
                              : `In ${nextPlannedFollowup.diffDays}d`}
                        </span>
                      </div>
                    );
                  })()}
                  {/* TIMELINE LINE */}
                  <div className="absolute left-2 top-0 bottom-0 w-px bg-gray-200" />

                  {followups.map((f, idx) => {
                    const date = new Date(f.followup_date);
                    const daysAgo = Math.floor(
                      (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24)
                    );



                    const meta =
                      FOLLOWUP_TYPE_META[
                      f.followup_type as keyof typeof FOLLOWUP_TYPE_META
                      ] || FOLLOWUP_TYPE_META.other;

                    const isCompleted = f.is_completed;

                    const today = new Date();
                    today.setHours(0, 0, 0, 0);

                    const next = f.next_followup_date
                      ? new Date(f.next_followup_date)
                      : null;

                    if (next) next.setHours(0, 0, 0, 0);

                    const isOverdue =
                      !isCompleted &&
                      next &&
                      next <= today;


                    return (
                      <div
                        key={f.id}
                        className={`relative border rounded-lg p-4 shadow-sm transition
    ${isOverdue ? "bg-red-50 border-red-300" : "bg-white hover:shadow-md"}
  `}
                      >
                        {/* DOT */}
                        <div className="absolute -left-[22px] top-5 h-3 w-3 rounded-full bg-indigo-600 border-2 border-white" />

                        {/* HEADER */}
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full font-medium ${meta.color}`}
                            >
                              {meta.label}
                            </span>

                            {isOverdue && (
                              <span className="text-xs text-red-600 font-medium">
                                ⚠ Owner Attention Required
                              </span>
                            )}

                            <span className="text-xs text-gray-500">
                              #{followups.length - idx}
                            </span>
                          </div>

                          <div className="text-right">
                            <div className="text-xs text-gray-500">
                              {date.toLocaleDateString()}
                            </div>
                            <div className="text-[11px] text-gray-400">
                              {daysAgo === 0 ? "Today" : `${daysAgo} day(s) ago`}
                            </div>
                          </div>
                        </div>

                        {/* BODY — NOTE */}
                        <div className="text-sm text-gray-800 whitespace-pre-wrap mb-3">
                          {f.note || "—"}
                        </div>

                        {/* FOOTER */}
                        <div className="flex justify-between items-center text-xs text-gray-500 gap-2">
                          <span>
                            Logged by <strong>{f.created_by_name || "—"}</strong>
                          </span>

                          <div className="flex items-center gap-2">
                            {(() => {
                              const nextMeta = getNextFollowupMeta(
                                f.next_followup_date,
                                f.followup_type
                              );

                              return nextMeta ? (
                                <span
                                  className={`px-2 py-0.5 rounded-full font-medium ${nextMeta.color}`}
                                >
                                  {nextMeta.label}
                                </span>
                              ) : null;
                            })()}

                            {/* ✅ COMPLETION STATE */}
                            {!f.is_completed ? (
                              <button
                                onClick={() => markFollowupDone(f.id)}
                                className="
        inline-flex items-center gap-1.5
        px-3 py-1.5
        text-xs font-medium
        rounded-full
        bg-green-50 text-green-700
        border border-green-200
        hover:bg-green-100
        hover:border-green-300
        transition
      "
                              >
                                ✓ Mark as Completed
                              </button>
                            ) : (
                              <span className="inline-flex items-center gap-1.5
        px-3 py-1.5
        text-xs font-medium
        rounded-full
        bg-green-100 text-green-700
        border border-green-200">
                                ✓ Completed
                              </span>
                            )}
                          </div>
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}



        {/* History  Tab */}
        {activeTab === "history" && (
          <div className="space-y-6">

            <div className="bg-white border rounded-lg p-4">
              <h3 className="text-sm font-semibold mb-3">Version History</h3>

              <VersionHistory
                versions={versionHistory}
                isLoading={historyLoading}
                onViewVersion={(version) => setViewingVersion(version)}
                layout="vertical"
              />
            </div>

            {viewingVersion && (
              <VersionViewer
                quotationId={quote.id}
                versionNumber={viewingVersion}
                onClose={() => setViewingVersion(null)}
              />
            )}

          </div>
        )}


      </div>

      <ReIssueModal
        open={showReIssue}
        onClose={() => setShowReIssue(false)}
        onConfirm={handleReIssue}
        quotationNo={quote?.quotation_no}
        version={quote?.version ?? undefined}
        validUntil={quote?.valid_until ?? undefined}
      />

      {showAddFollowup && quote?.id && (
        <AddFollowupModal
          quotationId={quote.id}
          canMutateFollowups={canMutateFollowups}
          onClose={() => setShowAddFollowup(false)}
          onCreated={() => {
            setShowAddFollowup(false);
            api.getQuotationFollowups(quote.id).then(data =>
              setFollowups(
                Array.isArray(data)
                  ? data.map(f => ({
                    ...f,
                    is_completed: Boolean(f.is_completed),
                  }))
                  : []
              )
            );
          }}
        />
      )}

      <CreateOrderModal
        open={showCreateOrderModal}
        onClose={() => setShowCreateOrderModal(false)}
        onCreateIndent={handleCreateIndent}
        isLoading={creatingOrder}
      />

      <SmallToast message={toast} onClose={() => setToast(null)} />
      <ConfirmModal
        open={confirmOpen}
        loading={actionLoading}
        title={confirmAction === "approve" ? "Approve quotation" : "Reject quotation"}
        message={confirmAction === "approve" ? "Approve this quotation? This action cannot be undone." : "Mark this quotation as rejected?"}
        onConfirm={runConfirmAction}
        onCancel={() => { setConfirmOpen(false); setConfirmAction(null); }}
      />
      <ErrorModal open={errorOpen} title="Operation failed" message={errorMessage} onClose={() => setErrorOpen(false)} />
    </Layout>
  );
}

/* ---------- small utility (module-scope) ---------- */
// @ts-ignore unused function
function _escapeHtmlForPreview(s: string) {
  if (!s) return "";
  return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}