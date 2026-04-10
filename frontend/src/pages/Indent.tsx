// frontend/src/pages/Indent.tsx

import React, { useEffect, useState } from "react";
import Layout from "../components/layout/Layout";
import api from "../api";
import { useNavigate } from "react-router-dom";

import {
    Plus,
    Search,
    Eye,
    Package,
    Calendar,
    User,
    ChevronRight,
    Filter,
    FileText,
    CheckCircle,
    RefreshCw,
    Trash2
} from "lucide-react";
import toast from "react-hot-toast";

interface Indent {
    id: number;
    indent_number: string;
    indent_date: string;
    customer: string;
    product_name: string;
    product_description: string;
    product_count: number;
    total_quantity: number;
    preferred_vendor: string;
    status: string;
}

export default function Indent() {
    const navigate = useNavigate();

    const [indents, setIndents] = useState<Indent[]>([]);
    const [filtered, setFiltered] = useState<Indent[]>([]);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [loading, setLoading] = useState(true);

    // Pagination state
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(10);

    // PO tracking
    const [poTracking, setPoTracking] = useState<Record<number, { total: number; created: number; partial_received?: number; completed?: number; po_count?: number; status?: string }>>({}
    );
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        fetchIndents();
    }, []);

    async function fetchIndents() {
        setLoading(true);
        try {
            const res = await api.getIndents();
            const data = Array.isArray(res) ? res : [];
            setIndents(data);
            setFiltered(data);

            // Fetch PO tracking for each indent
            await fetchPOTracking(data);
        } catch (err) {
            console.error("Failed to fetch indents:", err);
            setIndents([]);
            setFiltered([]);
        } finally {
            setLoading(false);
        }
    }

    async function handleRefreshPOTracking() {
        setRefreshing(true);
        try {
            await fetchPOTracking(indents);
        } finally {
            setRefreshing(false);
        }
    }

    async function handleDeleteIndent(id: number, indentNumber: string) {
        const ok = confirm(
            `Are you sure you want to delete indent ${indentNumber}? This action cannot be undone.`
        );
        if (!ok) return;

        try {
            await api.deleteIndent(id);
            setIndents((prev) => prev.filter((r) => r.id !== id));
            setFiltered((prev) => prev.filter((r) => r.id !== id));
            toast.success("Indent deleted successfully");
        } catch (err: any) {
            console.error("Delete failed", err);
            toast.error("Failed to delete indent");
        }
    }

    async function fetchPOTracking(indentList: Indent[]) {
        try {
            const tracking: Record<number, { total: number; created: number; partial_received?: number; completed?: number; po_count?: number; status?: string }> = {};

            for (const indent of indentList) {
                try {
                    // Fetch PO count from backend using authenticated API
                    const data = await api.getIndentPOCount(indent.id);
                    console.log(`Indent ${indent.id}: `, data);
                    tracking[indent.id] = {
                        total: data.total || indent.product_count || 0,
                        created: data.created || 0,
                        partial_received: data.partial_received || 0,
                        completed: data.completed || 0,
                        po_count: data.po_count || 0,
                        status: data.status
                    };
                } catch (err) {
                    console.error(`Error fetching PO count for indent ${indent.id}:`, err);
                    // Fallback
                    tracking[indent.id] = {
                        total: indent.product_count || 1,
                        created: 0,
                        partial_received: 0,
                        completed: 0,
                        po_count: 0,
                        status: undefined
                    };
                }
            }

            console.log("Final PO Tracking:", tracking);
            setPoTracking(tracking);
        } catch (err) {
            console.error("Failed to fetch PO tracking:", err);
        }
    }

    useEffect(() => {

        let data = [...indents];

        if (search) {

            data = data.filter((i) =>
                i.indent_number.toLowerCase().includes(search.toLowerCase()) ||
                i.customer.toLowerCase().includes(search.toLowerCase()) ||
                i.product_name.toLowerCase().includes(search.toLowerCase())
            );

        }

        if (statusFilter !== "all") {
            data = data.filter((i) => i.status === statusFilter);
        }

        setFiltered(data);
        setPage(1); // Reset to page 1 when filters change

    }, [search, statusFilter, indents]);

    // Calculate pagination
    const pageCount = Math.max(1, Math.ceil(filtered.length / perPage));
    const pageSlice = filtered.slice((page - 1) * perPage, page * perPage);

    function getStatusColor(status: string) {
        const colors: Record<string, string> = {
            draft: "bg-slate-100 text-slate-700 border border-slate-200",
            submitted: "bg-blue-100 text-blue-700 border border-blue-200",
            approved: "bg-purple-100 text-purple-700 border border-purple-200",
            ordered: "bg-indigo-100 text-indigo-700 border border-indigo-200",
            received: "bg-emerald-100 text-emerald-700 border border-emerald-200"
        };
        return colors[status] || colors.draft;
    }

    function getStatusIcon(status: string) {
        const icons: Record<string, React.ReactNode> = {
            draft: <FileText size={14} />,
            submitted: <Package size={14} />,
            approved: <CheckCircle size={14} />,
            ordered: <Package size={14} />,
            received: <CheckCircle size={14} />
        };
        return icons[status];
    }

    function getPOTrackingStatus(indentId: number, totalItems: number) {
        const tracking = poTracking[indentId];

        // If no tracking data available, use product count
        if (!tracking) {
            return { label: "Loading...", color: "bg-slate-100 text-slate-700", percentage: 0 };
        }

        const created = tracking.created || 0;
        const partialReceived = tracking.partial_received || 0;
        const completed = tracking.completed || 0;
        const total = tracking.total || totalItems || 0;
        const status = tracking.status;

        console.log(`Status for indent ${indentId}: status=${status}, created=${created}, partial=${partialReceived}, completed=${completed}, total=${total}`);

        if (total === 0) return { label: "No Items", color: "bg-slate-100 text-slate-700", percentage: 0 };

        if (status === "pending") {
            return { label: "PO Pending", color: "bg-yellow-100 text-yellow-700", percentage: 0 };
        }
        if (status === "po_created") {
            return { label: `${created}/${total} PO Created`, color: "bg-blue-100 text-blue-700", percentage: Math.round((created / total) * 100) };
        }
        if (status === "partial_received") {
            return { label: `Partially Received (${partialReceived}/${total})`, color: "bg-orange-100 text-orange-700", percentage: Math.round((partialReceived / total) * 100) };
        }
        if (status === "completed") {
            return { label: "Completed", color: "bg-green-100 text-green-700", percentage: 100 };
        }
        if (status === "closed") {
            return { label: "Closed", color: "bg-red-100 text-red-700", percentage: 100 };
        }

        if (created === 0) return { label: "PO Pending", color: "bg-yellow-100 text-yellow-700", percentage: 0 };
        if (created >= total) return { label: "All POs Created", color: "bg-emerald-100 text-emerald-700", percentage: 100 };
        return { label: ` ${created}/${total} POs`, color: "bg-orange-100 text-orange-700", percentage: Math.round((created / total) * 100) };
    }

    return (
        <Layout>
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-8 px-4 sm:px-6 lg:px-8">
                <div className="w-full">
                    {/* Header Section */}
                    <div className="mb-8">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div>
                                <h1 className="text-4xl font-bold text-slate-900 tracking-tight">Purchase Indents</h1>
                                <p className="text-slate-600 mt-2 flex items-center gap-2">
                                    <Package size={16} />
                                    Manage material requests and requisitions
                                </p>
                            </div>
                            <button
                                onClick={() => navigate("/create-indent")}
                                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-rose-500 to-rose-600 text-white rounded-lg font-medium hover:shadow-lg hover:from-rose-600 hover:to-rose-700 transition-all duration-200 transform hover:scale-105"
                            >
                                <Plus size={20} />
                                Create Indent
                            </button>
                        </div>
                    </div>

                    {/* Stats Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                        <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm hover:shadow-md transition">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-slate-600 text-sm font-medium">Total Indents</p>
                                    <p className="text-3xl font-bold text-slate-900 mt-1">{indents.length}</p>
                                </div>
                                <div className="p-3 bg-blue-100 rounded-lg">
                                    <FileText className="text-blue-600" size={24} />
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm hover:shadow-md transition">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-slate-600 text-sm font-medium">Complete Indents</p>
                                    <p className="text-3xl font-bold text-slate-900 mt-1">
                                        {indents.filter((i) => i.status === "received" || (poTracking[i.id]?.status === "completed")).length}
                                    </p>
                                </div>
                                <div className="p-3 bg-green-100 rounded-lg">
                                    <CheckCircle className="text-green-600" size={24} />
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm hover:shadow-md transition">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-slate-600 text-sm font-medium">Pending Indents</p>
                                    <p className="text-3xl font-bold text-slate-900 mt-1">
                                        {indents.filter((i) => i.status === "submitted").length}
                                    </p>
                                </div>
                                <div className="p-3 bg-yellow-100 rounded-lg">
                                    <Package className="text-yellow-600" size={24} />
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm hover:shadow-md transition">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-slate-600 text-sm font-medium">Partial Indents</p>
                                    <p className="text-3xl font-bold text-slate-900 mt-1">
                                        {indents.filter(
                                            (i) => (poTracking[i.id]?.partial_received ?? 0) > 0
                                        ).length}
                                    </p>
                                </div>
                                <div className="p-3 bg-orange-100 rounded-lg">
                                    <Package className="text-orange-600" size={24} />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Search & Filter Bar */}
                    <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm mb-8">
                        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                            <div className="flex-1 relative">
                                <Search className="absolute left-3 top-3 text-slate-400" size={18} />
                                <input
                                    placeholder="Search indent number, customer, or product..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                                />
                            </div>

                            <div className="flex items-center gap-2">
                                <Filter size={18} className="text-slate-600" />
                                <select
                                    aria-label="Filter by status"
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent bg-white"
                                >
                                    <option value="all">All Status</option>
                                    <option value="draft">Draft</option>
                                    <option value="submitted">Submitted</option>
                                    <option value="approved">Approved</option>
                                    <option value="ordered">Ordered</option>
                                    <option value="received">Received</option>
                                </select>

                                {/* Refresh PO Tracking Button */}
                                <button
                                    onClick={handleRefreshPOTracking}
                                    disabled={refreshing}
                                    className="inline-flex items-center gap-1 px-3 py-2 text-slate-600 hover:text-slate-900 border border-slate-300 rounded-lg hover:bg-slate-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="Refresh PO tracking data"
                                >
                                    <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
                                    Refresh
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Table */}
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <p className="text-slate-500">Loading indents...</p>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
                            <Package size={48} className="text-slate-300 mx-auto mb-4" />
                            <p className="text-slate-600 text-lg">No indents found</p>
                            <p className="text-slate-500 text-sm mt-1">
                                {search || statusFilter !== "all"
                                    ? "Try adjusting your filters"
                                    : "Create your first indent to get started"}
                            </p>
                        </div>
                    ) : (
                        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-slate-200 bg-slate-50">
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Indent No</th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Date</th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Customer</th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Product</th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Qty</th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">PO Tracking</th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200">
                                        {pageSlice.map((indent) => {
                                            const poStatus = getPOTrackingStatus(indent.id, indent.product_count);
                                            return (
                                                <tr
                                                    key={indent.id}
                                                    onClick={() => navigate(`/indents/${indent.id}`)}
                                                    className="hover:bg-slate-50 transition-all group cursor-pointer active:scale-[0.998]"
                                                >

                                                    {/* Indent Number */}
                                                    <td className="px-6 py-4">
                                                        <span className="font-semibold text-slate-900 group-hover:underline">
                                                            {indent.indent_number}
                                                        </span>
                                                    </td>

                                                    {/* Date */}
                                                    <td className="px-6 py-4 text-slate-600 text-sm">
                                                        <div className="flex items-center gap-2">
                                                            <Calendar size={14} className="text-slate-400" />
                                                            {new Date(indent.indent_date).toLocaleDateString()}
                                                        </div>
                                                    </td>

                                                    {/* Customer */}
                                                    <td className="px-6 py-4 text-slate-600">
                                                        <div className="flex items-center gap-2">
                                                            <User size={14} className="text-slate-400" />
                                                            {indent.customer}
                                                        </div>
                                                    </td>

                                                    {/* Product */}
                                                    <td className="px-6 py-4">
                                                        <div>
                                                            <p className="text-slate-900 font-medium">{indent.product_name}</p>
                                                            <p className="text-slate-500 text-sm">{indent.product_description}</p>
                                                        </div>
                                                    </td>

                                                    {/* Quantity */}
                                                    <td className="px-6 py-4">
                                                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-100 text-slate-700 font-medium text-sm">
                                                            <Package size={14} />
                                                            {indent.total_quantity}
                                                        </span>
                                                    </td>

                                                    {/* Status */}
                                                    <td className="px-6 py-4">
                                                        <span
                                                            className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(indent.status)}`}
                                                        >
                                                            {getStatusIcon(indent.status)}
                                                            {indent.status.charAt(0).toUpperCase() + indent.status.slice(1)}
                                                        </span>
                                                    </td>

                                                    {/* PO Tracking */}
                                                    <td className="px-6 py-4">
                                                        <span
                                                            className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${poStatus.color}`}
                                                            title={`${poStatus.label}: ${poStatus.percentage}% complete`}
                                                        >
                                                            {poStatus.label}
                                                        </span>
                                                    </td>

                                                    {/* Actions */}
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">

                                                            {/* View Button */}
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation(); // 🔥 critical
                                                                    navigate(`/indents/${indent.id}`);
                                                                }}
                                                                className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium text-sm hover:bg-blue-50 px-3 py-1 rounded transition"
                                                            >
                                                                <Eye size={16} />
                                                                View
                                                            </button>

                                                            {/* Delete Button (Trash Icon) */}
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation(); // 🔥 critical
                                                                    handleDeleteIndent(indent.id, indent.indent_number);
                                                                }}
                                                                className="text-red-600 hover:text-red-700 hover:bg-red-50 p-2 rounded transition"
                                                                title="Delete indent"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>

                                                            {/* Arrow */}
                                                            <button
                                                                aria-label="View indent details"
                                                                onClick={(e) => {
                                                                    e.stopPropagation(); // 🔥 prevent row click duplication
                                                                    navigate(`/indents/${indent.id}`);
                                                                }}
                                                                className="text-slate-600 hover:text-slate-700 transition"
                                                            >
                                                                <ChevronRight size={18} />
                                                            </button>

                                                        </div>
                                                    </td>

                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Footer - Pagination */}
                    <div className="mt-6 px-4 py-4 border-t border-slate-200 bg-white rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="text-sm text-slate-600">
                            Showing <span className="font-medium">{filtered.length === 0 ? 0 : (page - 1) * perPage + 1}</span>–<span className="font-medium">{Math.min(page * perPage, filtered.length)}</span> of <span className="font-medium">{filtered.length}</span> indents
                        </div>

                        <div className="flex items-center gap-2">
                            <select
                                value={perPage}
                                onChange={(e) => {
                                    setPerPage(Number(e.target.value));
                                    setPage(1);
                                }}
                                className="px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent bg-white text-sm"
                                title="Results per page"
                            >
                                <option value={5}>5</option>
                                <option value={10}>10</option>
                                <option value={20}>20</option>
                                <option value={50}>50</option>
                            </select>

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
            </div>
        </Layout>
    );
}