import { useEffect, useState } from "react";
import Layout from "../components/layout/Layout";
import api from "../api";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Eye, Trash2 } from "lucide-react";

interface Vendor {
  id: number;
  vendor_code?: string;
  name: string;
  gst?: string;
  gst_number?: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  city?: string;
  rating?: number;
  total_pos?: number;
  total_value?: number;
  is_active?: number;
  gst_verified?: number;
}

export default function Vendors() {

  const navigate = useNavigate();

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchVendors();
  }, []);

  async function fetchVendors() {
    try {
      const data = await api.getVendors();

      if (Array.isArray(data)) {
        setVendors(data);
        if (data.length === 0) {
          toast.success("No vendors loaded yet");
        }
      } else {
        setVendors([]);
        toast.error("Invalid vendor data received");
      }
    } catch (err) {
      console.error("Failed to load vendors", err);
      toast.error("Failed to load vendors");
      setVendors([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteVendor(id: number, vendorName: string) {
    const ok = confirm(
      `Are you sure you want to delete vendor ${vendorName}? This action cannot be undone.`
    );
    if (!ok) return;

    try {
      await api.deleteVendor(id);
      setVendors((prev) => prev.filter((v) => v.id !== id));
      toast.success("Vendor deleted successfully");
    } catch (err: any) {
      console.error("Delete failed", err);
      toast.error("Failed to delete vendor");
    }
  }

  const filteredVendors = vendors.filter(v =>
    v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.vendor_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.contact_person?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalValue = vendors.reduce((sum, v) => sum + (v.total_value || 0), 0);
  const totalPOs = vendors.reduce((sum, v) => sum + (v.total_pos || 0), 0);

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4 sm:px-6 lg:px-8">
        <div className="w-full">

          {/* Header Section */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-4xl font-bold text-gray-900 tracking-tight">
                  Vendor Registry
                </h1>
                <p className="text-gray-600 mt-2">
                  Manage and track all procurement suppliers
                </p>
              </div>
              <button
                onClick={() => navigate("/vendors/create")}
                className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-blue-600 border border-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
                Add New Vendor
              </button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm font-medium">Total Vendors</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">{vendors.length}</p>
                  </div>
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm font-medium">Total Purchase Orders</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">{totalPOs}</p>
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
                    <p className="text-gray-600 text-sm font-medium">Total Procurement Value</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">₹{(totalValue / 100000).toFixed(1)}L</p>
                  </div>
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M8.16 2.75a.75.75 0 00-.32 1.02l3.168 7.068H9.5a.75.75 0 000 1.5h7a.75.75 0 000-1.5h-1.508L17.16 3.77a.75.75 0 10-1.34-.69l-3.168 7.07H10.5a.75.75 0 000-1.5h1.508L8.84 2.75a.75.75 0 01.32-1.02z" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Search Bar */}
          <div className="mb-6">
            <div className="relative">
              <svg className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search by vendor name, code, or contact..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">

            {loading ? (
              <div className="p-12 text-center">
                <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-600">Loading vendors...</p>
              </div>
            ) : filteredVendors.length === 0 ? (
              <div className="p-12 text-center">
                <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
                <p className="text-gray-600 text-lg font-medium">No vendors found</p>
                <p className="text-gray-500 text-sm mt-1">
                  {searchTerm ? "Try adjusting your search criteria" : "Start by adding your first vendor"}
                </p>
                {!searchTerm && (
                  <button
                    onClick={() => navigate("/vendors/create")}
                    className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                    </svg>
                    Add First Vendor
                  </button>
                )}
              </div>
            ) : (
              <table className="w-full table-fixed">

                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-900">
                    <th className="px-3 py-3 text-left w-[26%]">Vendor</th>
                    <th className="px-3 py-3 text-left w-[17%]">Contact</th>
                    <th className="px-3 py-3 text-left w-[17%]">Location</th>
                    <th className="px-3 py-3 text-center w-[8%]">POs</th>
                    <th className="px-3 py-3 text-right w-[10%]">Value</th>
                    <th className="px-3 py-3 text-center w-[10%]">Status</th>
                    <th className="px-3 py-3 text-center w-[12%]">Action</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-200">
                  {filteredVendors.map((v) => (
                    <tr 
                      key={v.id} 
                      onClick={() => navigate(`/vendors/${v.id}`)}
                      className="hover:bg-gray-50 transition-colors cursor-pointer group"
                    >

                      {/* Vendor */}
                      <td className="px-3 py-3 overflow-hidden">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                            <span className="text-sm font-semibold text-blue-600">
                              {v.name.charAt(0).toUpperCase()}
                            </span>
                          </div>

                          <div className="min-w-0">
                            <div className="font-semibold text-gray-900 truncate" title={v.name}>
                            {v.name}
                          </div>
                            <div className="text-xs text-gray-500 truncate">
                              {v.vendor_code || "—"}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Contact */}
                      <td className="px-3 py-3 overflow-hidden">
                        <div className="min-w-0">
                          <div className="text-gray-900 font-medium truncate">
                            {v.contact_person || "—"}
                          </div>
                          <div className="text-xs text-gray-500 truncate">
                            {v.phone || "—"}
                          </div>
                        </div>
                      </td>

                      {/* Location */}
                      <td className="px-3 py-3 overflow-hidden">
                        <div className="min-w-0">
                          <div className="text-gray-900 font-medium truncate">
                            {v.city || "—"}
                          </div>
                          <div className="text-xs text-gray-500 truncate">
                            {v.gst || v.gst_number
                              ? `GST: ${v.gst || v.gst_number}`
                              : "No GST"}
                          </div>
                        </div>
                      </td>

                      {/* POs */}
                      <td className="px-3 py-3 text-center whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                          {v.total_pos || 0}
                        </span>
                      </td>

                      {/* Value */}
                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        <span className="font-semibold text-gray-900 text-sm">
                          ₹{((v.total_value || 0) / 100000).toFixed(2)}L
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-3 py-3 text-center whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-semibold ${v.is_active
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                            }`}
                        >
                          {v.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="px-3 py-3 text-center whitespace-nowrap">
                        <div className="flex items-center gap-1 justify-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/vendors/${v.id}`);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                            title="View vendor"
                          >
                            <Eye size={16} />
                            View
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteVendor(v.id, v.name);
                            }}
                            className="p-2 text-red-600 hover:text-red-700 transition"
                            title="Delete vendor"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
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