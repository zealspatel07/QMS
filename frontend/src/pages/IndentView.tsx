//frontend/src/pages/IndentView.tsx

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import api from "../api";
import { useParams, useNavigate } from "react-router-dom";
import Layout from "../components/layout/Layout";
import ProcurementProgressBar from "../components/ProcurementProgressBar";
import ActivityTimeline from "../components/ActivityTimeline";
import ProductRow from "../components/ProductRow";

interface Summary {
  products: number;
  required_qty: number;
  ordered_qty: number;
  pending_qty: number;
  coverage: number;
}

interface PODetail {
  po_id: number;
  po_number: string;
  vendor_name: string;
  ordered_qty: number;
}

interface IndentItem {
  item_id: number;
  product_id: number;
  product_name: string;
  product_description: string;
  required_qty: number;
  ordered_qty: number;
  pending_qty: number;
    uom: string; 
 status: "Pending PO" | "PO Created" | "Partially Received" | "Completed" | "Closed";
  po_details: PODetail[];
}

interface Activity {
  id: number | null;
  activity_type: string;
  created_at: string;
  po_number?: string;
  vendor_name?: string;
}

interface Indent {
  id: number;
  indent_number: string;
  customer_name: string;
  indent_date: string;
  status: string;
  created_by_name: string;
   po_number?: string;
}

export default function IndentView() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [indent, setIndent] = useState<Indent | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [items, setItems] = useState<IndentItem[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>("");

  useEffect(() => {
    if (id) {
      fetchAllData();
      detectUserRole();
    }
  }, [id]);

  const detectUserRole = () => {
    // Get role from localStorage or auth context
    const user = localStorage.getItem("user");
    if (user) {
      try {
        const userData = JSON.parse(user);
        setUserRole(userData.role || "sales");
      } catch {
        setUserRole("sales");
      }
    }
  };

const fetchAllData = async () => {
  if (!id) return;

  setIsLoading(true);

  try {

    const [indent, summary, items, activities, docs] = await Promise.all([
      api.getIndent(id),
      api.getIndentSummary(id),
      api.getIndentItems(id),
      api.getIndentPOHistory(id),
      api.getIndentDocuments(id)
    ]);

    setIndent(indent || null);
    setSummary(summary || null);

    // 🔥 CRITICAL FIX: Normalize items + status
    const normalizedItems = Array.isArray(items)
      ? items.map((item) => ({
          ...item,
          status: (item.status || "").trim()  // remove spaces/null safety
        }))
      : [];

    setItems(normalizedItems);

    setActivities(Array.isArray(activities) ? activities : []);
    setDocuments(Array.isArray(docs) ? docs : []);

  } catch (error) {

    console.error("Error fetching indent data:", error);

    setItems([]);
    setActivities([]);

  } finally {
    setIsLoading(false);
  }
};

  const canCreatePO = ["purchase", "admin"].includes(userRole);
  const canViewPOs = ["purchase", "admin"].includes(userRole);
  const allItemsCompleted = items.every(
    (item) => item.status === "Completed" || item.status === "Closed"
  );

  const pendingItemsCount = Array.isArray(items)
    ? items.filter((item) => item.pending_qty > 0).length
    : 0;

  if (isLoading) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-6 py-8">
          <p>Loading...</p>
        </div>
      </Layout>
    );
  }

  if (!indent || !summary) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-6 py-8">
          <p>Error loading indent</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-full mx-auto p-6 space-y-6">

        {/* ===================================================== */}
        {/* INDENT HEADER */}
        {/* ===================================================== */}

        <div className="bg-white shadow rounded-lg p-6">

          <div className="flex justify-between items-center mb-5">

            <div>
              <h1 className="text-3xl font-bold text-gray-800">
                {indent.indent_number}
              </h1>

              <p className="text-gray-500 font-medium">
                Procurement Command Center
              </p>
            </div>

            <span
              className={`px-4 py-1 text-sm font-semibold rounded-full
          ${indent.status === "submitted" ? "bg-blue-100 text-blue-700" : ""}
          ${indent.status === "draft" ? "bg-gray-100 text-gray-700" : ""}
          ${indent.status === "completed" ? "bg-green-100 text-green-700" : ""}
          `}
            >
              {indent.status}
            </span>
          </div>

          {/* Metadata Grid */}

          <div className="grid grid-cols-4 gap-6 border-t pt-5">

            <div>
              <p className="text-xs uppercase text-gray-500 tracking-wide">
                Customer
              </p>
              <p className="font-semibold text-gray-900 mt-1">
                {indent.customer_name}
              </p>
            </div>

            <div>
              <p className="text-xs uppercase text-gray-500 tracking-wide">
                Indent Date
              </p>
              <p className="font-semibold text-gray-900 mt-1">
                {new Date(indent.indent_date).toLocaleDateString("en-US", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </p>
            </div>

            <div>
              <p className="text-xs uppercase text-gray-500 tracking-wide">
                PO NUMBER
              </p>
              <p className="font-semibold text-gray-900 mt-1 capitalize">
               {indent?.po_number || "—"}
              </p>
            </div>

            <div>
              <p className="text-xs uppercase text-gray-500 tracking-wide">
                Status
              </p>
              <p className="font-semibold text-blue-600 mt-1 capitalize">
                {indent.status}
              </p>
            </div>

             

          </div>
        </div>

          {/* DOCUMENTS */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Documents</h2>
            {documents && documents.length > 0 ? (
              <ul className="space-y-2">
                {documents.map((d) => (
                  <li key={d.id} className="flex items-center justify-between border rounded p-3">
                    <div className="truncate">
                      <div className="font-medium text-gray-900">{d.file_name}</div>
                      <div className="text-xs text-gray-500">Uploaded: {new Date(d.created_at).toLocaleString()}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={async () => {
                          try {
                            const blob = await api.downloadDocument(d.id);

                            // Basic sanity check: ensure blob is binary/pdf
                            const mime = blob.type || '';
                            if (!mime || (!mime.includes('pdf') && !mime.startsWith('image/'))) {
                              // try to read as text for error details
                              const txt = await blob.text();
                              console.error('Unexpected download payload:', txt);
                              toast.error('Download failed: server returned unexpected data');
                              return;
                            }

                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = d.file_name || 'document';
                            document.body.appendChild(a);
                            a.click();
                            a.remove();
                            URL.revokeObjectURL(url);
                            toast.success('Document downloaded');
                          } catch (err: any) {
                            console.error('Download failed', err);
                            toast.error(err?.message || 'Download failed');
                          }
                        }}
                        className="px-3 py-1 bg-blue-600 text-white rounded text-sm"
                      >
                        Download
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">No supporting documents uploaded for this indent.</p>
            )}
          </div>

        {/* ===================================================== */}
        {/* PROCUREMENT PROGRESS */}
        {/* ===================================================== */}

        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">
            Procurement Progress
          </h2>

          <ProcurementProgressBar
            requiredQty={Number(summary.required_qty || 0)}
            orderedQty={Number(summary.ordered_qty || 0)}
          />
        </div>

        {/* ===================================================== */}
        {/* ACTION BAR */}
        {/* ===================================================== */}

        <div className="flex justify-between items-center">

          <div className="flex gap-3">

            {canCreatePO && (
              <button
                onClick={() => navigate(`/purchase-orders/create/${id}`)}
                disabled={allItemsCompleted || indent.status === "draft"}
                className={`px-5 py-2 rounded text-white font-semibold
                        ${allItemsCompleted || indent.status === "draft"
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700"
                  }`}
                title={indent.status === "draft" ? "Cannot create PO for Draft Indent. Please submit first." : ""}
              >
                {indent.status === "draft"
                  ? "Submit Indent First"
                  : allItemsCompleted
                  ? "All items completed"
                  : `Create Purchase Order${pendingItemsCount > 0
                    ? ` (${pendingItemsCount} Pending)`
                    : ""
                  }`}
              </button>
            )}

            {canViewPOs && (
              <button
                onClick={() => navigate(`/purchase-orders?indent=${id}`)}
                className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-semibold"
              >
                View All POs
              </button>
            )}

          </div>

          <div className="flex gap-3">

            <button
              onClick={() => navigate(`/indents/edit/${id}`)}
              className="px-5 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded font-semibold"
            >
              Edit
            </button>

            <button className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded font-semibold">
              Export
            </button>

          </div>

        </div>

        {/* ===================================================== */}
        {/* MATERIAL TRACKING */}
        {/* ===================================================== */}

        <div className="bg-white shadow rounded-lg">

          <div className="border-b px-6 py-4">
            <h2 className="text-lg font-bold text-gray-800">
              Material Tracking
            </h2>
          </div>

          <div className="overflow-x-auto">

            <table className="w-full">

              <thead className="bg-gray-100 text-sm text-gray-700">

                <tr>
                  <th className="p-4 text-left">Product</th>
                  <th className="p-4 text-right">Required</th>
                  <th className="p-4 text-right">Ordered</th>
                  <th className="p-4 text-right">Pending</th>
                  <th className="p-4 text-center">Status</th>
                </tr>

              </thead>

              <tbody>

                {Array.isArray(items) && items.length > 0 ? (
                  items.map((item) => (
                    <ProductRow
                      key={item.item_id}
                      product_name={item.product_name}
                      product_description={item.product_description}
                      required_qty={item.required_qty}
                      ordered_qty={item.ordered_qty}
                      pending_qty={item.pending_qty}
                       uom={item.uom} 
                      status={item.status}
                      po_details={item.po_details}
                      canViewPOs={canViewPOs}
                    />
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-gray-500">
                      No products in this indent
                    </td>
                  </tr>
                )}

              </tbody>

            </table>

          </div>

          {/* Table Footer Totals */}

          <div className="border-t bg-gray-50 px-6 py-4 flex justify-end gap-10">

            <div>
              <p className="text-sm text-gray-500">Total Required</p>
              <p className="font-semibold text-gray-800">
                {Number(summary.required_qty || 0)}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-500">Total Ordered</p>
              <p className="font-semibold text-green-600">
                {Number(summary.ordered_qty || 0)}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-500">Total Pending</p>
              <p className="font-semibold text-orange-600">
                {Number(summary.pending_qty || 0)}
              </p>
            </div>

          </div>

        </div>

        {/* ===================================================== */}
        {/* ACTIVITY TIMELINE */}
        {/* ===================================================== */}

        {Array.isArray(activities) && activities.length > 0 && (
          <ActivityTimeline activities={activities} />
        )}

      </div>
    </Layout>
  );
}