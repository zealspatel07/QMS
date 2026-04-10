/**
 * StatusTable - Enhanced PO Table Component
 * Features: Search/Filter, Sticky Headers, Conditional Row Colors, Status Badges
 * Implements 2026 UX best practices for data scannability
 */

import { useState, useMemo } from "react";
import { Search, ChevronUp, ChevronDown } from "lucide-react";

interface PO {
  id: number;
  po_number: string;
  vendor_name: string;
  item_count: number;
  status: "ordered" | "in_transit" | "delivered" | "partial" | "cancelled";
  order_date: string;
  expected_delivery_date: string;
  total_value: number;
}

interface StatusTableProps {
  pos: PO[];
  onRowClick?: (po: PO) => void;
}

function getStatusColor(status: string) {
  const colors: Record<string, { bg: string; text: string; badge: string }> = {
    ordered: {
      bg: "bg-yellow-50",
      text: "text-yellow-700",
      badge: "bg-yellow-100 text-yellow-700",
    },
    in_transit: {
      bg: "bg-purple-50",
      text: "text-purple-700",
      badge: "bg-purple-100 text-purple-700",
    },
    delivered: {
      bg: "bg-emerald-50",
      text: "text-emerald-700",
      badge: "bg-emerald-100 text-emerald-700",
    },
    partial: {
      bg: "bg-purple-50",
      text: "text-purple-700",
      badge: "bg-purple-100 text-purple-700",
    },
    cancelled: {
      bg: "bg-red-50",
      text: "text-red-700",
      badge: "bg-red-100 text-red-700",
    },
  };
  return colors[status] || colors.ordered;
}

type SortField = keyof PO;
type SortOrder = "asc" | "desc";

export default function StatusTable({ pos, onRowClick }: StatusTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("order_date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");

  // Filter and sort data
  const filteredPos = useMemo(() => {
    let filtered = pos;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (po) =>
          po.po_number.toLowerCase().includes(query) ||
          po.vendor_name.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (selectedStatus !== "all") {
      filtered = filtered.filter((po) => po.status === selectedStatus);
    }

    // Sort
    filtered.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];

      let comparison = 0;
      if (typeof aVal === "string") {
        comparison = aVal.localeCompare(String(bVal));
      } else {
        comparison = Number(aVal) - Number(bVal);
      }

      return sortOrder === "asc" ? comparison : -comparison;
    });

    return filtered;
  }, [pos, searchQuery, selectedStatus, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const SortIndicator = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <div className="w-4" />;
    return sortOrder === "asc" ? (
      <ChevronUp size={16} className="inline ml-1" />
    ) : (
      <ChevronDown size={16} className="inline ml-1" />
    );
  };

  const statusOptions = [
    { value: "all", label: "All POs" },
    { value: "ordered", label: "Ordered" },
    { value: "in_transit", label: "In Transit" },
    { value: "partial", label: "Partial" },
    { value: "delivered", label: "Delivered" },
    { value: "cancelled", label: "Cancelled" },
  ];

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
      {/* Header */}
      <div className="px-6 py-4 border-b bg-slate-50">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">
          Purchase Orders in Progress
        </h2>

        {/* Search and Filter Row */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          {/* Search Box */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search PO # or vendor name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
          >
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Results Summary */}
        <div className="mt-3 text-sm text-slate-600">
          Showing {filteredPos.length} of {pos.length} purchase orders
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          {/* Sticky Header */}
          <thead className="bg-slate-100 border-b sticky top-0 z-10">
            <tr>
              <th className="px-6 py-3 text-left font-semibold text-slate-700">
                <button
                  onClick={() => handleSort("po_number")}
                  className="flex items-center hover:text-slate-900 transition-colors"
                >
                  PO # <SortIndicator field="po_number" />
                </button>
              </th>
              <th className="px-6 py-3 text-left font-semibold text-slate-700">
                <button
                  onClick={() => handleSort("vendor_name")}
                  className="flex items-center hover:text-slate-900 transition-colors"
                >
                  Vendor <SortIndicator field="vendor_name" />
                </button>
              </th>
              <th className="px-6 py-3 text-left font-semibold text-slate-700">
                Items
              </th>
              <th className="px-6 py-3 text-left font-semibold text-slate-700">
                <button
                  onClick={() => handleSort("status")}
                  className="flex items-center hover:text-slate-900 transition-colors"
                >
                  Status <SortIndicator field="status" />
                </button>
              </th>
              <th className="px-6 py-3 text-left font-semibold text-slate-700">
                <button
                  onClick={() => handleSort("order_date")}
                  className="flex items-center hover:text-slate-900 transition-colors"
                >
                  Order Date <SortIndicator field="order_date" />
                </button>
              </th>
              <th className="px-6 py-3 text-left font-semibold text-slate-700">
                <button
                  onClick={() => handleSort("expected_delivery_date")}
                  className="flex items-center hover:text-slate-900 transition-colors"
                >
                  Expected Delivery <SortIndicator field="expected_delivery_date" />
                </button>
              </th>
              <th className="px-6 py-3 text-right font-semibold text-slate-700">
                <button
                  onClick={() => handleSort("total_value")}
                  className="flex items-center justify-end hover:text-slate-900 transition-colors"
                >
                  Value <SortIndicator field="total_value" />
                </button>
              </th>
            </tr>
          </thead>

          {/* Table Body */}
          <tbody>
            {filteredPos.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                  <div className="flex flex-col items-center">
                    <Search size={32} opacity={0.3} className="mb-2" />
                    <p>No purchase orders found</p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredPos.map((po) => {
                const colors = getStatusColor(po.status);
                return (
                  <tr
                    key={po.id}
                    className={`border-b ${colors.bg} hover:opacity-90 transition-opacity cursor-pointer`}
                    onClick={() => onRowClick?.(po)}
                  >
                    <td className="px-6 py-4 font-semibold text-blue-600">
                      {po.po_number}
                    </td>
                    <td className="px-6 py-4 text-slate-700">{po.vendor_name}</td>
                    <td className="px-6 py-4 text-slate-700">{po.item_count}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-3 py-1.5 rounded-full text-xs font-bold ${colors.badge}`}
                      >
                        {po.status.replace("_", " ").toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {new Date(po.order_date).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {new Date(po.expected_delivery_date).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-6 py-4 text-right font-semibold text-slate-900">
                      ₹{(po.total_value / 100000).toFixed(1)}L
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}