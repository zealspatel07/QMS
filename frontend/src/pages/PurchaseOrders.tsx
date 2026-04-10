import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import Layout from "../components/layout/Layout";
import api from "../api";
import { useNavigate, useLocation } from "react-router-dom";
import ClosePoModal from "../components/ClosePoModal";
import {
  Search,
  Eye,
  FileText,
  Calendar,
  Building,
  Package,
  CheckCircle,
  AlertCircle,
  Plus,
  Loader,
  XCircle,
  Download,
  Trash2
} from "lucide-react";

interface PO {
  id: number;
  po_number: string;
  vendor_name: string;
  indent_number: string;
  order_date: string;
  status: string;
}

export default function PurchaseOrders() {

  const navigate = useNavigate();

  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const indentId = params.get("indent");

  const [orders, setOrders] = useState<PO[]>([]);
  const [filtered, setFiltered] = useState<PO[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [closeModal, setCloseModal] = useState(false);
  const [selectedPO, setSelectedPO] = useState<PO | null>(null);
  const [isClosing, setIsClosing] = useState(false);

  const [showExportModal, setShowExportModal] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [rangeType, setRangeType] = useState<"custom" | "today" | "week" | "month" | "year">("custom");
  const [exporting, setExporting] = useState(false);

  const [daysRange, setDaysRange] = useState(7);
  const [status, setStatus] = useState("all");
  const [exportType, setExportType] = useState("detailed"); // detailed | summary

  useEffect(() => {
    fetchPOs();
  }, []);
  useEffect(() => {
    if (fromDate && toDate) {
      // OPTIONAL API (you can skip if not ready)
      // fetch(`/api/purchase-orders/count?from=${fromDate}&to=${toDate}`)
    }
  }, [fromDate, toDate]);

  async function fetchPOs() {
    setLoading(true);
    try {
      const res = await api.getPurchaseOrders(indentId);

      let data: PO[] = [];

      if (Array.isArray(res)) data = res;
      else if (Array.isArray(res?.data)) data = res.data;

      setOrders(data);
      setFiltered(data);
      if (data.length === 0) {
        toast.success("No purchase orders found");
      }
    } catch (err) {
      console.error("Failed to fetch purchase orders:", err);
      toast.error("Failed to fetch purchase orders");
      setOrders([]);
      setFiltered([]);
    } finally {
      setLoading(false);
    }
  }

  const handleClosePO = async (reason: string) => {
    if (!selectedPO) return;

    setIsClosing(true);
    try {
      await toast.promise(
        api.closePurchaseOrder(selectedPO.id, reason),
        {
          loading: "Closing purchase order...",
          success: "✓ Purchase order closed successfully",
          error: "Failed to close purchase order"
        }
      );
      // Refresh POs
      await fetchPOs();
      setCloseModal(false);
      setSelectedPO(null);
    } catch (error) {
      console.error("Error closing PO:", error);
    } finally {
      setIsClosing(false);
    }
  };

  const applyQuickRange = (type: string) => {
    const today = new Date();

    let from = "";
    let to = today.toISOString().split("T")[0];

    if (type === "today") {
      from = to;
    }

    if (type === "week") {
      const past = new Date();
      past.setDate(today.getDate() - 6);
      from = past.toISOString().split("T")[0];
    }

    if (type === "month") {
      const past = new Date(today.getFullYear(), today.getMonth(), 1);
      from = past.toISOString().split("T")[0];
    }

    if (type === "year") {
      const past = new Date(today.getFullYear(), 0, 1);
      from = past.toISOString().split("T")[0];
    }

    setFromDate(from);
    setToDate(to);
    setRangeType(type as any);
  };

  async function handleDownloadCSV() {
    try {
      // ✅ 1. AUTH CHECK
      const token = localStorage.getItem("token");
      if (!token) {
        toast.error("Authentication required");
        return;
      }

      // ✅ 2. DATE VALIDATION
      if (!fromDate || !toDate) {
        toast.error("Please select a valid date range");
        return;
      }

      if (new Date(fromDate) > new Date(toDate)) {
        toast.error("From date cannot be after To date");
        return;
      }

      // ✅ 3. BUILD QUERY SAFELY
      const params = new URLSearchParams({
        from: fromDate,
        to: toDate,
        status,
        type: exportType
      });

      const url = `${import.meta.env.VITE_API_BASE}/api/purchase-orders/export?${params.toString()}`;

      // ✅ 4. LOADING FEEDBACK
      const loadingToast = toast.loading("Preparing export...");

      // ✅ 5. API CALL
      const res = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error("Export failed");
      }

      // ✅ 6. BLOB HANDLING
      const blob = await res.blob();

      if (!blob || blob.size === 0) {
        toast.dismiss(loadingToast);
        toast.error("No data found for selected range");
        return;
      }

      // ✅ 7. DOWNLOAD FILE (DYNAMIC NAME)
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");

      const fileName = `PO_${fromDate}_to_${toDate}.csv`;

      link.href = downloadUrl;
      link.download = fileName;

      document.body.appendChild(link);
      link.click();

      // ✅ 8. CLEANUP
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);

      // ✅ 9. SUCCESS UX
      toast.dismiss(loadingToast);
      toast.success("CSV downloaded successfully");

    } catch (err) {
      console.error("CSV Export Error:", err);
      toast.error("Failed to export CSV");
    }
  }

  async function handleDeletePO(id: number, poNumber: string) {
    const ok = confirm(
      `Are you sure you want to delete purchase order ${poNumber}? This action cannot be undone.`
    );
    if (!ok) return;

    try {
      await api.deletePurchaseOrder(id);
      setOrders((prev) => prev.filter((po) => po.id !== id));
      setFiltered((prev) => prev.filter((po) => po.id !== id));
      toast.success("Purchase order deleted successfully");
    } catch (err: any) {
      console.error("Delete failed", err);
      toast.error("Failed to delete purchase order");
    }
  }

  useEffect(() => {

    let data = [...orders];

    if (search) {

      data = data.filter(po =>
        po.po_number.toLowerCase().includes(search.toLowerCase()) ||
        po.vendor_name.toLowerCase().includes(search.toLowerCase()) ||
        po.indent_number.toLowerCase().includes(search.toLowerCase())
      );

    }

    if (statusFilter !== "all") {
      data = data.filter(po => po.status === statusFilter);
    }

    setFiltered(data);

  }, [search, statusFilter, orders]);

  function getStatusColor(status: string) {
    const colors: Record<string, string> = {
      created: "bg-yellow-100 text-yellow-800 border border-yellow-200",
      pending: "bg-yellow-100 text-yellow-800 border border-yellow-200",
      partial: "bg-purple-100 text-purple-800 border border-purple-200",
      completed: "bg-emerald-100 text-emerald-800 border border-emerald-200",
      closed: "bg-red-100 text-red-800 border border-red-200",
      cancelled: "bg-red-100 text-red-800 border border-red-200"
    };
    return colors[status] || colors.pending;
  }

  function getStatusIcon(status: string) {
    const icons: Record<string, React.ReactNode> = {
      created: <AlertCircle size={14} />,
      pending: <AlertCircle size={14} />,
      partial: <Package size={14} />,
      completed: <CheckCircle size={14} />,
      closed: <AlertCircle size={14} />,
      cancelled: <AlertCircle size={14} />
    };
    return icons[status];
  }

  function formatDate(date: string) {
  if (!date) return "";

  const d = new Date(date);

  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();

  return `${day}-${month}-${year}`;
}

  const totalPOs = orders.length;
  const pendingPOs = orders.filter(o => o.status === "pending").length;
  const partialPOs = orders.filter(o => o.status === "partial").length;
  const completedPOs = orders.filter(o => o.status === "completed").length;

  return (

    <Layout>

      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-8 px-4 sm:px-6 lg:px-8">

        <div className="w-full">

          {/* ====== PAGE HEADER ====== */}
          <div className="mb-8">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-3 bg-blue-100 rounded-lg">
                    <FileText className="text-blue-600" size={32} />
                  </div>
                  <div>
                    <h1 className="text-4xl font-bold text-slate-900 tracking-tight">
                      Purchase Orders
                    </h1>
                    <p className="text-slate-600 mt-1 flex items-center gap-2">
                      <FileText size={16} />
                      Manage vendor purchase orders and deliveries
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowExportModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                  title="Download all purchase orders as CSV"
                >
                  <Download size={18} />
                  Download CSV
                </button>
                <button
                  onClick={() => navigate("/create-po")}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 border border-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                  title="Create a new purchase order directly"
                >
                  <Plus size={18} />
                  Create PO
                </button>
                <button
                  onClick={() => navigate("/indents")}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  ← Back to Indents
                </button>
              </div>
            </div>
          </div>

          {/* ====== STAT CARDS ====== */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">

            {/* Total POs */}
            <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-slate-600 text-sm font-medium">Total POs</p>
                  <p className="text-3xl font-bold text-slate-900 mt-2">{totalPOs}</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-lg">
                  <FileText className="text-blue-600" size={24} />
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-3">All purchase orders</p>
            </div>

            {/* Pending POs */}
            <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-slate-600 text-sm font-medium">Pending</p>
                  <p className="text-3xl font-bold text-yellow-600 mt-2">{pendingPOs}</p>
                </div>
                <div className="p-3 bg-yellow-100 rounded-lg">
                  <AlertCircle className="text-yellow-600" size={24} />
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-3">Awaiting delivery</p>
            </div>

            {/* Partial POs */}
            <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-slate-600 text-sm font-medium">Partial</p>
                  <p className="text-3xl font-bold text-indigo-600 mt-2">{partialPOs}</p>
                </div>
                <div className="p-3 bg-indigo-100 rounded-lg">
                  <Package className="text-indigo-600" size={24} />
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-3">Partially received</p>
            </div>

            {/* Completed POs */}
            <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-slate-600 text-sm font-medium">Completed</p>
                  <p className="text-3xl font-bold text-emerald-600 mt-2">{completedPOs}</p>
                </div>
                <div className="p-3 bg-emerald-100 rounded-lg">
                  <CheckCircle className="text-emerald-600" size={24} />
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-3">All items delivered</p>
            </div>

          </div>

          {/* ====== SEARCH & FILTER BAR ====== */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-5 mb-8">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">

              {/* Search Input */}
              <div className="flex-1 w-full flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 hover:border-slate-300 transition-colors">
                <Search size={18} className="text-slate-400 flex-shrink-0" />
                <input
                  placeholder="Search PO number, vendor, indent..."
                  className="bg-transparent flex-1 text-sm text-slate-900 placeholder-slate-500 outline-none"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              {/* Status Filter */}
              <select
                title="Filter purchase orders by status"
                className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="partial">Partial</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>

            </div>
          </div>

          {/* ====== LOADING STATE ====== */}
          {loading && (
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-12 text-center">
              <div className="inline-flex items-center gap-2 text-slate-600">
                <Loader size={20} className="animate-spin" />
                <span className="font-medium">Loading purchase orders...</span>
              </div>
            </div>
          )}

          {/* ====== EMPTY STATE ====== */}
          {!loading && filtered.length === 0 && (
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-12 text-center">
              <div className="text-slate-400 mb-3">
                <FileText size={48} className="mx-auto" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-1">
                {search || statusFilter !== 'all' ? 'No matching purchase orders' : 'No purchase orders yet'}
              </h3>
              <p className="text-slate-600 mb-6">
                {search || statusFilter !== 'all'
                  ? 'Try adjusting your search or filter criteria'
                  : 'Create an indent or generate a purchase order directly'}
              </p>
              <div className="flex gap-3 justify-center flex-wrap">
                <button
                  onClick={() => navigate("/indents")}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <FileText size={16} />
                  Create Indent
                </button>
                <button
                  onClick={() => navigate("/create-po")}
                  className="inline-flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus size={16} />
                  Create PO
                </button>
              </div>
            </div>
          )}

          {/* ====== PO TABLE ====== */}
          {!loading && filtered.length > 0 && (
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">

              <table className="w-full">

                <thead className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">

                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wide">PO Number</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wide">Indent</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wide">Vendor</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wide">Order Date</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wide">Status</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-slate-700 uppercase tracking-wide">Action</th>
                  </tr>

                </thead>

                <tbody className="divide-y divide-slate-200">

                  {filtered.map((po) => (

                    <tr
                      key={po.id}
                      onClick={() => navigate(`/purchase-orders/${po.id}`)}
                      className="hover:bg-slate-50 transition-colors group cursor-pointer"
                    >

                      {/* PO Number */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="p-2 bg-blue-50 rounded group-hover:bg-blue-100 transition-colors">
                            <FileText className="text-blue-600" size={16} />
                          </div>
                          <span className="font-semibold text-slate-900 group-hover:underline">
                            {po.po_number}
                          </span>
                        </div>
                      </td>

                      {/* Indent Number */}
                      <td className="px-6 py-4">
                        <span className="text-slate-700">{po.indent_number}</span>
                      </td>

                      {/* Vendor Name */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Building size={14} className="text-slate-400" />
                          <span className="text-slate-700">{po.vendor_name}</span>
                        </div>
                      </td>

                      {/* Order Date */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Calendar size={14} className="text-slate-400" />
                          <span className="text-slate-700">{formatDate(po.order_date)}</span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(po.status)}`}>
                          {getStatusIcon(po.status)}
                          {po.status.charAt(0).toUpperCase() + po.status.slice(1)}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/purchase-orders/${po.id}`);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                            title="View PO"
                          >
                            <Eye size={16} />
                            View
                          </button>

                          {po.status !== "completed" && po.status !== "closed" && po.status !== "cancelled" && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedPO(po);
                                setCloseModal(true);
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                            >
                              <XCircle size={16} />
                              <span className="hidden sm:inline">Close</span>
                            </button>
                          )}

                          {/* Delete Button (Trash Icon) */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeletePO(po.id, po.po_number);
                            }}
                            className="p-2 text-red-600 hover:text-red-700 transition"
                            title="Delete PO"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>

                    </tr>

                  ))}

                </tbody>

              </table>

              {/* Table Footer */}
              <div className="bg-slate-50 border-t border-slate-200 px-6 py-4">
                <p className="text-sm text-slate-600">
                  Showing <span className="font-semibold">{filtered.length}</span> of <span className="font-semibold">{orders.length}</span> purchase orders
                </p>
              </div>

            </div>
          )}

        </div>

      </div>

      {/* ====== CLOSE PO MODAL ====== */}
      {selectedPO && (
        <ClosePoModal
          isOpen={closeModal}
          poNumber={selectedPO.po_number}
          onClose={() => {
            setCloseModal(false);
            setSelectedPO(null);
          }}
          onSubmit={handleClosePO}
          isLoading={isClosing}
        />
      )}

      {showExportModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">

          <div className="bg-white rounded-2xl w-full max-w-6xl shadow-2xl p-6 animate-fadeIn">

            {/* ================= HEADER ================= */}
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-xl font-semibold text-slate-800">
                  Export Purchase Orders
                </h2>
                <p className="text-sm text-slate-500">
                  Configure filters and export data
                </p>
              </div>

              <button
                onClick={() => setShowExportModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg"
              >
                ✕
              </button>
            </div>

            {/* ================= BODY ================= */}
            <div className="grid grid-cols-2 gap-6">

              {/* ===== LEFT PANEL ===== */}
              <div className="space-y-5">

                {/* QUICK FILTERS */}
                <div>
                  <p className="text-xs text-slate-500 mb-2 uppercase">Quick Filters</p>

                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: "Today", value: "today" },
                      { label: "7 Days", value: "week" },
                      { label: "Month", value: "month" },
                      { label: "Year", value: "year" }
                    ].map((btn) => (
                      <button
                        key={btn.value}
                        onClick={() => applyQuickRange(btn.value)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition
                  ${rangeType === btn.value
                            ? "bg-blue-600 text-white shadow"
                            : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                          }`}
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* DYNAMIC LAST N DAYS */}
                <div>
                  <p className="text-xs text-slate-500 mb-2 uppercase">Dynamic Range</p>

                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      placeholder="Days"
                      aria-label="Dynamic range in days"
                      value={daysRange}
                      onChange={(e) => setDaysRange(Number(e.target.value))}
                      className="w-20 border px-2 py-1 rounded text-sm"
                    />

                    <span className="text-sm text-slate-600">Days</span>

                    <button
                      onClick={() => {
                        const today = new Date();
                        const past = new Date();
                        past.setDate(today.getDate() - daysRange);

                        setFromDate(past.toISOString().split("T")[0]);
                        setToDate(today.toISOString().split("T")[0]);
                        setRangeType("custom");
                      }}
                      className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs"
                    >
                      Apply
                    </button>
                  </div>
                </div>

                {/* STATUS FILTER */}
                <div>
                  <p className="text-xs text-slate-500 mb-2 uppercase">Status</p>

                  <select
                    aria-label="PO Status filter"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full border px-3 py-2 rounded-lg text-sm"
                  >
                    <option value="all">All</option>
                    <option value="created">Created</option>
                    <option value="pending">Pending</option>
                    <option value="partial">Partial</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>

                {/* EXPORT TYPE */}
                <div>
                  <p className="text-xs text-slate-500 mb-2 uppercase">Export Type</p>

                  <div className="flex gap-2">
                    {["detailed", "summary"].map((type) => (
                      <button
                        key={type}
                        onClick={() => setExportType(type)}
                        className={`px-3 py-2 text-sm rounded-lg border
                    ${exportType === type
                            ? "bg-blue-600 text-white"
                            : "bg-slate-100"
                          }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

              </div>

              {/* ===== RIGHT PANEL ===== */}
              <div className="space-y-5">

                {/* CUSTOM DATE */}
                <div>
                  <p className="text-xs text-slate-500 mb-2 uppercase">Date Range</p>

                  <div className="flex items-center gap-2">

                    <div className="relative flex-1">
                      <input
                        type="date"
                        aria-label="Start date"
                        value={fromDate}
                        onChange={(e) => {
                          setFromDate(e.target.value);
                          setRangeType("custom");
                        }}
                        className="w-full border px-3 py-2 pr-10 rounded-lg text-sm"
                      />

                      <button
                        onClick={(e) => {
                          const input = e.currentTarget.previousSibling as HTMLInputElement;
                          input?.showPicker();
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400"
                      >
                        📅
                      </button>
                    </div>

                    <span className="text-slate-400">→</span>

                    <div className="relative flex-1">
                      <input
                        type="date"
                        aria-label="End date"
                        value={toDate}
                        onChange={(e) => {
                          setToDate(e.target.value);
                          setRangeType("custom");
                        }}
                        className="w-full border px-3 py-2 pr-10 rounded-lg text-sm"
                      />

                      <button
                        onClick={(e) => {
                          const input = e.currentTarget.previousSibling as HTMLInputElement;
                          input?.showPicker();
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400"
                      >
                        📅
                      </button>
                    </div>

                  </div>
                </div>

                {/* SUMMARY PANEL */}
                <div className="bg-slate-50 border rounded-lg p-4 space-y-2 text-sm">
                  <div><b>From:</b> {fromDate || "-"}</div>
                  <div><b>To:</b> {toDate || "-"}</div>
                  <div><b>Status:</b> {status}</div>
                  <div><b>Type:</b> {exportType}</div>
                </div>

                {/* ERROR */}
                {fromDate && toDate && new Date(fromDate) > new Date(toDate) && (
                  <div className="text-xs text-red-500">
                    Invalid date range
                  </div>
                )}

              </div>

            </div>

            {/* ================= FOOTER ================= */}
            <div className="flex justify-between items-center mt-6">

              <div className="text-xs text-slate-400">
                {/* Preview count would go here */}
              </div>

              <div className="flex gap-3">

                <button
                  onClick={() => setShowExportModal(false)}
                  className="px-4 py-2 border rounded-lg text-sm"
                >
                  Cancel
                </button>

                <button
                  disabled={
                    exporting ||
                    !fromDate ||
                    !toDate ||
                    new Date(fromDate) > new Date(toDate)
                  }
                  onClick={async () => {
                    setExporting(true);
                    await handleDownloadCSV();
                    setExporting(false);
                    setShowExportModal(false);
                  }}
                  className={`px-5 py-2 rounded-lg text-sm text-white flex items-center gap-2
              ${exporting ? "bg-blue-400" : "bg-blue-600 hover:bg-blue-700"}`}
                >
                  {exporting && (
                    <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                  )}
                  {exporting ? "Exporting..." : "Download CSV"}
                </button>

              </div>

            </div>

          </div>
        </div>
      )}
    </Layout>

  );
}