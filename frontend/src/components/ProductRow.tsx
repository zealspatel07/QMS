//frontend/src/components/ProductRow.tsx

import { useState } from "react";
import { useNavigate } from "react-router-dom";

interface PODetail {
  po_id: number;
  po_number: string;
  vendor_name: string;
  ordered_qty: number;
}

interface ProductRowProps {
  product_name: string;
  product_description: string;
  required_qty: number;
  ordered_qty: number;
  pending_qty: number;
  uom: string; // ✅ ADD THIS
  status: "Pending PO" | "PO Created" | "Partially Received" | "Completed" | "Closed";
  po_details?: PODetail[];
  canViewPOs: boolean;
}

export default function ProductRow({
  product_name,
  product_description,
  required_qty,
  ordered_qty,
  pending_qty,
  uom,
  status,
  po_details,
  canViewPOs,
}: ProductRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const navigate = useNavigate();

  const getStatusColor = (s: string) => {
    switch (s) {
      case "Pending PO":
        return "bg-gray-100 text-gray-700";

      case "PO Created":
        return "bg-blue-100 text-blue-700";

      case "Partially Received":
        return "bg-orange-100 text-orange-700";

      case "Completed":
        return "bg-green-100 text-green-700";

      case "Closed": // ✅ NEW
        return "bg-red-100 text-red-700";

      default:
        return "bg-gray-100 text-gray-700";
    }
  };



  return (
    <>
      <tr className="border-t hover:bg-gray-50">

        {/* Product Column */}
        <td className="p-4">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-left w-full"
          >
            <p className="font-semibold text-gray-900">
              {product_name}
            </p>

            {product_description && (
              <p className="text-gray-500 text-sm whitespace-pre-line break-words">
                {product_description}
              </p>
            )}
          </button>
        </td>

        {/* Quantities */}
        <td className="p-4 text-right font-semibold text-blue-600">
          {Number(required_qty || 0)} {uom}
        </td>

        <td className="p-4 text-right font-semibold text-green-600">
          {Number(ordered_qty || 0)} {uom}
        </td>

        <td className="p-4 text-right font-semibold text-orange-600">
          {Number(pending_qty || 0)} {uom}
        </td>
        {/* Status */}
        <td className="p-4 text-center">
          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(status)}`}
          >
            {status}
          </span>
        </td>

      </tr>

      {/* Expanded Row - PO Details */}
      {canViewPOs && isExpanded && (
        <tr className="bg-gray-50 border-t">
          <td colSpan={5} className="p-6">
            <div>
              <h4 className="font-semibold text-gray-900 mb-4">POs Created for {product_name}</h4>

              {po_details && po_details.length > 0 ? (
                <div className="space-y-3">
                  {po_details?.map((po, idx) => (
                    <div
                      key={idx}
                      onClick={() => navigate(`/purchase-orders/${po.po_id}`)}
                      className="border rounded p-4 bg-white hover:shadow-md transition-all cursor-pointer"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold text-blue-600 text-lg">{po.po_number}</p>
                          <p className="text-sm text-gray-600">Vendor: {po.vendor_name}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-600">Ordered Qty</p>
                          <p className="text-lg font-bold text-green-600">{Number(po.ordered_qty || 0)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-600">No POs created yet</p>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
