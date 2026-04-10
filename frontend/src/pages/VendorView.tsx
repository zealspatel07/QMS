import { useEffect, useState } from "react";
import Layout from "../components/layout/Layout";
import api from "../api";
import { useParams, useNavigate } from "react-router-dom";

export default function VendorView() {

    const { id } = useParams();
    const navigate = useNavigate();

    const [vendor, setVendor] = useState<any>(null);
    const [contacts, setContacts] = useState<any[]>([]);
    const [history, setHistory] = useState<any[]>([]);
    const [performance, setPerformance] = useState<any>(null);
    const [procurement, setProcurement] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchVendor();
    }, []);

    async function fetchVendor() {

        try {

            const vendorData = await api.getVendor(id!);

            if (!vendorData) {
                console.warn("Vendor not found");
                return;
            }
            const contactsData = await api.getVendorContacts(id!);
            const historyData = await api.getVendorPurchaseHistory(id!);
            const perfData = await api.getVendorPerformance(id!);
            const procData = await api.getVendorProcurement(id!);

            setVendor(vendorData);
            setContacts(contactsData);
            setHistory(historyData);
            setPerformance(perfData);
            setProcurement(procData);

        } catch (err) {

            console.error("Vendor load failed", err);

        } finally {
            setLoading(false);
        }

    }

    if (loading) {
        return (
            <Layout>
                <div className="flex items-center justify-center min-h-screen">
                    <div className="text-center">
                        <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-gray-600">Loading vendor...</p>
                    </div>
                </div>
            </Layout>
        );
    }

    if (!vendor) {
        return (
            <Layout>
                <div className="flex items-center justify-center min-h-screen">
                    <div className="text-center">
                        <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                        </svg>
                        <p className="text-gray-600 text-lg font-medium">Vendor not found</p>
                        <button
                            onClick={() => navigate("/vendors")}
                            className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                        >
                            ← Back to Vendors
                        </button>
                    </div>
                </div>
            </Layout>
        );
    }

    return (
        <Layout>

            <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4 sm:px-6 lg:px-8">

                <div className="max-w-full mx-auto">

                    {/* Header Card */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 mb-8">

                        <div className="flex items-start justify-between mb-6">

                            <div className="flex items-center gap-4">
                                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center flex-shrink-0">
                                    <span className="text-2xl font-bold text-white">
                                        {vendor.name.charAt(0).toUpperCase()}
                                    </span>
                                </div>
                                <div>
                                    <h1 className="text-3xl font-bold text-gray-900">{vendor.name}</h1>
                                    <p className="text-gray-600 mt-1">Vendor ID: {vendor.vendor_code || `#${vendor.id}`}</p>
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={() => navigate(`/vendors/edit/${vendor.id}`)}
                                    className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                                >
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                    </svg>
                                    Edit
                                </button>

                                <button
                                    onClick={() => navigate("/vendors")}
                                    className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                    ← Back
                                </button>
                            </div>

                        </div>

                        {/* Vendor Info Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-6 border-t border-gray-200">

                            <div>
                                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Primary Contact</p>
                                <p className="text-gray-900 font-semibold mt-1">{vendor.contact_person || "—"}</p>
                            </div>

                            <div>
                                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</p>
                                <p className="text-gray-900 font-semibold mt-1">{vendor.phone || "—"}</p>
                            </div>

                            <div>
                                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Email</p>
                                <p className="text-gray-900 font-semibold mt-1 truncate">{vendor.email || "—"}</p>
                            </div>

                            <div>
                                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Location</p>
                                <p className="text-gray-900 font-semibold mt-1">
                                    {vendor.city && vendor.state
                                        ? `${vendor.city}, ${vendor.state}`
                                        : vendor.city || vendor.state || "—"}
                                </p>
                            </div>

                        </div>

                        {/* Additional Info */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
                            <div>
                                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">GST Number</p>
                                <p className="text-gray-900 font-semibold mt-1">{vendor.gst || vendor.gst_number || "—"}</p>
                            </div>
                            <div>
                                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Address</p>
                                <p className="text-gray-900 font-semibold mt-1">{vendor.address || "—"}</p>
                            </div>
                        </div>

                    </div>

                    {/* Procurement Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">

                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-gray-600 text-sm font-medium">Total Procurement Value</p>
                                    <p className="text-3xl font-bold text-blue-600 mt-2">
                                        ₹{((procurement?.total_value || 0) / 100000).toFixed(2)}L
                                    </p>
                                </div>
                                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                                    <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M8.16 2.75a.75.75 0 00-.32 1.02l3.168 7.068H9.5a.75.75 0 000 1.5h7a.75.75 0 000-1.5h-1.508L17.16 3.77a.75.75 0 10-1.34-.69l-3.168 7.07H10.5a.75.75 0 000-1.5h1.508L8.84 2.75a.75.75 0 01.32-1.02z" />
                                    </svg>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-gray-600 text-sm font-medium">Total Purchase Orders</p>
                                    <p className="text-3xl font-bold text-green-600 mt-2">
                                        {procurement?.total_pos || 0}
                                    </p>
                                </div>
                                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                                    <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" />
                                    </svg>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-gray-600 text-sm font-medium">Vendor Rating</p>
                                    <div className="flex items-center gap-1 mt-2">
                                        <span className="text-3xl font-bold text-yellow-500">★</span>
                                        <p className="text-2xl font-bold text-gray-900">
                                            {performance?.overall_rating || 0}
                                        </p>
                                    </div>
                                </div>
                                <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                                    <svg className="w-6 h-6 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                    </svg>
                                </div>
                            </div>
                        </div>

                    </div>

                    {/* Contacts Section */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-8 overflow-hidden">

                        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                            <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                                <svg className="w-5 h-5 mr-2 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.766l.296 1.486a1 1 0 01-.502 1.21l-1.42.71a7.001 7.001 0 006.3 6.3l.71-1.42a1 1 0 011.21-.502l1.486.296a1 1 0 01.766.986V17a1 1 0 01-1 1h-2.57C6.553 18 3 14.447 3 10V5a1 1 0 011-1h2.153z" />
                                </svg>
                                Vendor Contacts
                            </h2>
                        </div>

                        {contacts.length === 0 ? (
                            <div className="p-8 text-center">
                                <p className="text-gray-500">No contacts assigned</p>
                            </div>
                        ) : (
                            <table className="w-full">

                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-200">
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">Name</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">Designation</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">Phone</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">Email</th>
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-gray-200">
                                    {contacts.map((c) => (
                                        <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-gray-900 font-semibold">{c.name}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-gray-600">{c.designation || "—"}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-gray-600">{c.phone || "—"}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-blue-600 truncate">{c.email || "—"}</div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>

                            </table>
                        )}

                    </div>

                    {/* Purchase History Section */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">

                        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                            <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                                <svg className="w-5 h-5 mr-2 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                                    <path fillRule="evenodd" d="M4 5a2 2 0 012-2 1 1 0 000-2H2a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2h-2a1 1 0 000 2h2v10H4V5z" clipRule="evenodd" />
                                </svg>
                                Purchase History
                            </h2>
                        </div>

                        {history.length === 0 ? (
                            <div className="p-8 text-center">
                                <p className="text-gray-500">No purchase history</p>
                            </div>
                        ) : (
                            <table className="w-full">

                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-200">
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">PO Number</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">Date</th>
                                        <th className="px-6 py-3 text-center text-xs font-semibold text-gray-900 uppercase tracking-wider">Quantity</th>
                                        <th className="px-6 py-3 text-right text-xs font-semibold text-gray-900 uppercase tracking-wider">Value</th>
                                        <th className="px-6 py-3 text-center text-xs font-semibold text-gray-900 uppercase tracking-wider">Status</th>
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-gray-200">
                                    {history.map((h) => (
                                        <tr key={h.id} className="hover:bg-gray-50 transition-colors">

                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <button
                                                    onClick={() => navigate(`/purchase-orders/${h.id}`)}
                                                    className="text-blue-600 hover:text-blue-800 hover:underline font-semibold"
                                                >
                                                    {h.po_number}
                                                </button>
                                            </td>

                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-gray-900">{new Date(h.order_date).toLocaleDateString()}</div>
                                            </td>

                                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                                <div className="text-gray-900 font-medium">{h.total_qty}</div>
                                            </td>

                                            <td className="px-6 py-4 whitespace-nowrap text-right">
                                                <span className="text-blue-600 font-semibold">
                                                    ₹{((h.total_value || 0) / 100000).toFixed(2)}L
                                                </span>
                                            </td>

                                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                                                    h.delivery_status === "completed"
                                                        ? "bg-green-100 text-green-800"
                                                        : h.delivery_status === "partial"
                                                        ? "bg-yellow-100 text-yellow-800"
                                                        : "bg-red-100 text-red-800"
                                                }`}>
                                                    {h.delivery_status === "completed" ? "Delivered" : h.delivery_status === "partial" ? "Partial" : "Pending"}
                                                </span>
                                            </td>

                                        </tr>
                                    ))}
                                </tbody>

                            </table>
                        )}

                    </div>

                </div>

            </div>

        </Layout>
    );

}