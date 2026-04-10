import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/layout/Layout";
import { api } from "../api";
import {
    BarChart,
    Bar,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
 } from "recharts";
import {
    Package,
    Truck,
    AlertCircle,
    TrendingUp,
    Clock,
    CheckCircle,
} from "lucide-react";

type Summary = {
    pending_indents: number;
    approved_indents: number;
    open_pos: number;
    delivered_pos: number;
    active_vendors: number;
    products_ordered: number;
    procurement_value: number;
};

type Indent = {
    id: number;
    indent_number: string;
    customer_name: string;
    created_by_name: string;
    indent_date: string;
    item_count: number;
    total_qty: number;
};

type PO = {
    id: number;
    po_number: string;
    vendor_name: string;
    status: "ordered" | "in_transit" | "delivered" | "partial" | "cancelled";
    order_date: string;
    expected_delivery_date: string;
    item_count: number;
    total_value: number;
};

type VendorActivity = {
    id: number;
    name: string;
    order_count: number;
    total_value: number;
};

type DeliveryAlert = {
    id: number;
    po_number: string;
    vendor_name: string;
    status: string;
    expected_delivery_date: string;
    alert_type: "delayed" | "due_today" | "due_soon" | "on_track";
};

type ProcurementValue = {
    month: string;
    month_label: string;
    value: number;
};

export default function PurchaseDashboard() {
    const navigate = useNavigate();
    const [summary, setSummary] = useState<Summary | null>(null);
    const [pendingIndents, setPendingIndents] = useState<Indent[]>([]);
    const [openPos, setOpenPos] = useState<PO[]>([]);
    const [vendorActivity, setVendorActivity] = useState<VendorActivity[]>([]);
    const [deliveryAlerts, setDeliveryAlerts] = useState<DeliveryAlert[]>([]);
    const [procurementValue, setProcurementValue] = useState<ProcurementValue[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadDashboardData();
    }, []);

    async function loadDashboardData() {
        setLoading(true);
        try {
            const [
                summary,
                pending,
                open,
                vendors,
                alerts,
                value
            ] = await Promise.all([
                api.getPurchaseSummary(),
                api.getPendingIndents(),
                api.getOpenPOs(),
                api.getVendorActivity(),
                api.getDeliveryAlerts(),
                api.getProcurementValue()
            ]);

            setSummary(summary || {});
            setPendingIndents(Array.isArray(pending) ? pending : []);
            setOpenPos(Array.isArray(open) ? open : []);
            setVendorActivity(Array.isArray(vendors) ? vendors : []);
            setDeliveryAlerts(Array.isArray(alerts) ? alerts : []);
            setProcurementValue(Array.isArray(value) ? value : []);
        } catch (err) {
            console.error("Failed to load purchase dashboard", err);
            // Set default empty values on error
            setSummary(null);
            setPendingIndents([]);
            setOpenPos([]);
            setVendorActivity([]);
            setDeliveryAlerts([]);
            setProcurementValue([]);
        } finally {
            setLoading(false);
        }
    }

    function formatCurrency(value: number) {
        return `₹${(value / 100000).toFixed(1)}L`;
    }

    function getStatusColor(status: string) {
        const colors: Record<string, string> = {
            ordered: "bg-blue-100 text-blue-700",
            in_transit: "bg-purple-100 text-purple-700",
            delivered: "bg-emerald-100 text-emerald-700",
            partial: "bg-amber-100 text-amber-700",
            cancelled: "bg-slate-100 text-slate-700",
        };
        return colors[status] || "bg-slate-100 text-slate-700";
    }

    function getAlertColor(type: string) {
        const colors: Record<string, string> = {
            delayed: "bg-rose-100 text-rose-700 border-rose-300",
            due_today: "bg-amber-100 text-amber-700 border-amber-300",
            due_soon: "bg-orange-100 text-orange-700 border-orange-300",
            on_track: "bg-emerald-100 text-emerald-700 border-emerald-300",
        };
        return colors[type] || "bg-slate-100 text-slate-700 border-slate-300";
    }

    if (loading) {
        return (
            <Layout>
                <div className="p-6">
                    <div className="text-center text-slate-400">Loading dashboard...</div>
                </div>
            </Layout>
        );
    }

    return (
        <Layout>
            <div className="p-6 space-y-6">
                {/* ---------- HEADER ---------- */}
                <div>
                    <div className="text-sm text-slate-400">Operations</div>
                    <h1 className="text-3xl font-medium text-slate-800">
                        Procurement Dashboard
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Manage indents, purchase orders, vendors, and deliveries
                    </p>
                </div>

                {/* ---------- KPI CARDS ---------- */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                    {/* Pending Indents */}
                    <div className="rounded-lg border border-amber-200 p-4 bg-amber-50">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-xs text-amber-600 font-medium">Pending Indents</div>
                                <div className="text-2xl font-medium text-amber-700 mt-1">
                                    {summary?.pending_indents || 0}
                                </div>
                            </div>
                            <Clock className="text-amber-600" size={24} opacity={0.5} />
                        </div>
                    </div>

                    {/* Approved Indents */}
                    <div className="rounded-lg border border-emerald-200 p-4 bg-emerald-50">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-xs text-emerald-600 font-medium">Approved Indents</div>
                                <div className="text-2xl font-medium text-emerald-700 mt-1">
                                    {summary?.approved_indents || 0}
                                </div>
                            </div>
                            <CheckCircle className="text-emerald-600" size={24} opacity={0.5} />
                        </div>
                    </div>

                    {/* Open POs */}
                    <div className="rounded-lg border border-blue-200 p-4 bg-blue-50">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-xs text-blue-600 font-medium">Open POs</div>
                                <div className="text-2xl font-medium text-blue-700 mt-1">
                                    {summary?.open_pos || 0}
                                </div>
                            </div>
                            <Package className="text-blue-600" size={24} opacity={0.5} />
                        </div>
                    </div>

                    {/* Delivered Orders */}
                    <div className="rounded-lg border border-indigo-200 p-4 bg-indigo-50">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-xs text-indigo-600 font-medium">Delivered</div>
                                <div className="text-2xl font-medium text-indigo-700 mt-1">
                                    {summary?.delivered_pos || 0}
                                </div>
                            </div>
                            <Truck className="text-indigo-600" size={24} opacity={0.5} />
                        </div>
                    </div>

                    {/* Active Vendors */}
                    <div className="rounded-lg border border-rose-200 p-4 bg-rose-50">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-xs text-rose-600 font-medium">Vendors</div>
                                <div className="text-2xl font-medium text-rose-700 mt-1">
                                    {summary?.active_vendors || 0}
                                </div>
                            </div>
                            <TrendingUp className="text-rose-600" size={24} opacity={0.5} />
                        </div>
                    </div>

                    {/* Products Ordered */}
                    <div className="rounded-lg border border-cyan-200 p-4 bg-cyan-50">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-xs text-cyan-600 font-medium">Products</div>
                                <div className="text-2xl font-medium text-cyan-700 mt-1">
                                    {summary?.products_ordered || 0}
                                </div>
                            </div>
                            <Package className="text-cyan-600" size={24} opacity={0.5} />
                        </div>
                    </div>

                    {/* Procurement Value */}
                    <div className="rounded-lg border border-purple-200 p-4 bg-purple-50">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-xs text-purple-600 font-medium">Value (Month)</div>
                                <div className="text-xl font-medium text-purple-700 mt-1">
                                    {formatCurrency(summary?.procurement_value || 0)}
                                </div>
                            </div>
                            <TrendingUp className="text-purple-600" size={24} opacity={0.5} />
                        </div>
                    </div>
                </div>

                {/* ---------- SECTION 1: INDENTS REQUIRING ACTION ---------- */}
                <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
                    <div className="px-6 py-4 border-b">
                        <h2 className="text-lg font-medium">Indents Requiring PO Creation</h2>
                        <p className="text-sm text-slate-500">Approved indents waiting for purchase orders</p>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 border-b">
                                <tr>
                                    <th className="px-6 py-3 text-left">Indent #</th>
                                    <th className="px-6 py-3 text-left">Customer</th>
                                    <th className="px-6 py-3 text-left">Items</th>
                                    <th className="px-6 py-3 text-left">Quantity</th>
                                    <th className="px-6 py-3 text-left">Requested By</th>
                                    <th className="px-6 py-3 text-left">Date</th>
                                    <th className="px-6 py-3 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pendingIndents.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-8 text-center text-slate-400">
                                            No pending indents
                                        </td>
                                    </tr>
                                ) : (
                                    pendingIndents.map((indent) => (
                                        <tr key={indent.id} className="border-b hover:bg-slate-50 cursor-pointer" onClick={() => navigate(`/indents/${indent.id}`)}>
                                            <td className="px-6 py-4 font-medium text-blue-600 hover:underline">{indent.indent_number}</td>
                                            <td className="px-6 py-4">{indent.customer_name}</td>
                                            <td className="px-6 py-4">{indent.item_count}</td>
                                            <td className="px-6 py-4">{indent.total_qty}</td>
                                            <td className="px-6 py-4 text-slate-600">{indent.created_by_name}</td>
                                            <td className="px-6 py-4 text-slate-600">
                                                {new Date(indent.indent_date).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button className="px-3 py-1 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100 font-medium">
                                                    Create PO →
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* ---------- SECTION 2: PURCHASE ORDERS IN PROGRESS ---------- */}
                <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
                    <div className="px-6 py-4 border-b">
                        <h2 className="text-lg font-medium">Purchase Orders in Progress</h2>
                        <p className="text-sm text-slate-500">Active orders awaiting delivery</p>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 border-b">
                                <tr>
                                    <th className="px-6 py-3 text-left">PO #</th>
                                    <th className="px-6 py-3 text-left">Vendor</th>
                                    <th className="px-6 py-3 text-left">Items</th>
                                    <th className="px-6 py-3 text-left">Status</th>
                                    <th className="px-6 py-3 text-left">Order Date</th>
                                    <th className="px-6 py-3 text-left">Expected Delivery</th>
                                    <th className="px-6 py-3 text-right">Value</th>
                                </tr>
                            </thead>
                            <tbody>
                                {openPos.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-8 text-center text-slate-400">
                                            No open purchase orders
                                        </td>
                                    </tr>
                                ) : (
                                    openPos.map((po) => (
                                        <tr key={po.id} className="border-b hover:bg-slate-50 cursor-pointer" onClick={() => navigate(`/purchase-orders/${po.id}`)}>
                                            <td className="px-6 py-4 font-medium text-blue-600 hover:underline">{po.po_number}</td>
                                            <td className="px-6 py-4">{po.vendor_name}</td>
                                            <td className="px-6 py-4">{po.item_count}</td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(po.status)}`}>
                                                    {po.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-slate-600">
                                                {new Date(po.order_date).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4 text-slate-600">
                                                {new Date(po.expected_delivery_date).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4 text-right font-medium">
                                                ₹{(po.total_value / 100000).toFixed(1)}L
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* ---------- SECTION 3 & 4: CHARTS ROW ---------- */}
                <div className="grid lg:grid-cols-2 gap-6">
                    {/* Vendor Activity */}
                    <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
                        <h2 className="text-lg font-medium mb-4">Top Vendors This Month</h2>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={vendorActivity}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis />
                                <Tooltip />
                                <Bar dataKey="order_count" fill="#3b82f6" name="Orders" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Delivery Alerts Summary */}
                    <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
                        <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
                            <AlertCircle size={20} className="text-rose-600" />
                            Delivery Alerts
                        </h2>

                        <div className="space-y-3 max-h-80 overflow-y-auto">
                            {deliveryAlerts.length === 0 ? (
                                <div className="text-center text-slate-400 py-8">No delivery alerts</div>
                            ) : (
                                deliveryAlerts.map((alert) => (
                                    <div
                                        key={alert.id}
                                        className={`p-3 rounded-lg border-2 ${getAlertColor(alert.alert_type)}`}
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <div className="font-medium">{alert.po_number}</div>
                                                <div className="text-xs opacity-75">{alert.vendor_name}</div>
                                                <div className="text-xs opacity-75 mt-1">
                                                    Expected: {new Date(alert.expected_delivery_date).toLocaleDateString()}
                                                </div>
                                            </div>
                                            <span className="text-xs font-medium px-2 py-1 bg-white rounded opacity-80">
                                                {alert.alert_type === "delayed"
                                                    ? "DELAYED"
                                                    : alert.alert_type === "due_today"
                                                        ? "TODAY"
                                                        : alert.alert_type === "due_soon"
                                                            ? "SOON"
                                                            : "ON TRACK"}
                                            </span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* ---------- SECTION 5: PROCUREMENT VALUE TREND ---------- */}
                <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
                    <h2 className="text-lg font-medium mb-4">Monthly Procurement Value</h2>
                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={procurementValue}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="month_label" />
                            <YAxis />
                            <Tooltip formatter={(value) => (typeof value === 'number' ? `₹${value.toLocaleString()}` : value)} />
                            <Legend />
                            <Line
                                type="monotone"
                                dataKey="value"
                                name="Purchase Value"
                                stroke="#8b5cf6"
                                strokeWidth={2}
                                dot={{ fill: "#8b5cf6", r: 4 }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </Layout>
    );
}
