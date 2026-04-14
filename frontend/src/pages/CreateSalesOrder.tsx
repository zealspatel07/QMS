import { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Layout from "../components/layout/Layout";
import { api } from "../api";
import { toast } from "react-toastify";
import { Plus, Trash2 } from "lucide-react";

const inputClass = "w-full rounded-lg border border-gray-300 px-4 py-2 text-[15px] focus:ring-2 focus:ring-blue-500 focus:outline-none";
const cardClass = "bg-white rounded-xl border border-gray-200 p-6";

type SOItem = {
  id: string;
  quotation_item_id?: number;
  product_id: number;
  product_name: string;
  description: string;
  qty: number | "";
  uom: string;
  unit_price: number | "";
  tax_rate: number | "";
  hsn_code?: string;
};

export default function CreateSalesOrder() {
  const navigate = useNavigate();
  const location = useLocation();
  const quotationPrefillRef = useRef<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // Quotations list
  const [quotations, setQuotations] = useState<any[]>([]);
  const [selectedQuotation, setSelectedQuotation] = useState<any | null>(null);
  const [quotationSearch, setQuotationSearch] = useState("");
  const [openQuotationDropdown, setOpenQuotationDropdown] = useState(false);

  // Sales Order form
  const [soDate, setSODate] = useState(new Date().toISOString().slice(0, 10));
  const [soItems, setSOItems] = useState<SOItem[]>([]);
  const [terms, setTerms] = useState("");
  const [notes, setNotes] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");

  // Load quotations on mount
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const quots = await api.getQuotations({ status: "pending" });
        setQuotations(Array.isArray(quots) ? quots : []);
      } catch (e: any) {
        setErr(e?.message || "Failed to load quotations");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Prefill from quotation if provided
  useEffect(() => {
    const st: any = location.state || {};
    const quotationId = Number(st.fromQuotationId);
    if (!Number.isFinite(quotationId) || quotationId <= 0) {
      quotationPrefillRef.current = null;
      return;
    }
    if (!quotations.length) return;

    const key = `quotation-${quotationId}`;
    if (quotationPrefillRef.current === key) return;
    quotationPrefillRef.current = key;

    let cancelled = false;
    (async () => {
      try {
        const quot: any = await api.getQuotation(quotationId);
        if (cancelled || !quot) {
          quotationPrefillRef.current = null;
          return;
        }

        setSelectedQuotation(quot);

        // Prefill items from quotation
        let rawItems: any[] = [];
        if (Array.isArray(quot.items)) {
          rawItems = quot.items;
        } else if (typeof quot.items === "string" && quot.items.trim()) {
          try {
            const p = JSON.parse(quot.items);
            rawItems = Array.isArray(p) ? p : [];
          } catch {
            rawItems = [];
          }
        }

        if (rawItems.length > 0) {
          const mapped: SOItem[] = rawItems.map((it: any, idx: number) => ({
            id: `so-item-${quotationId}-${idx}`,
            quotation_item_id: it.id,
            product_id: it.product_id || 0,
            product_name: it.product_name || "",
            description: it.description || "",
            qty: Number(it.qty || it.quantity || 1) || 1,
            uom: it.uom || "NOS",
            unit_price: Number(it.unit_price || 0) || "",
            tax_rate: Number(it.tax_rate || 18) || 18,
            hsn_code: it.hsn_code || "",
          }));
          setSOItems(mapped);
        }

        if (quot.quotation_date) {
          const d = new Date(quot.quotation_date);
          if (!Number.isNaN(d.getTime())) {
            setSODate(new Date(d).toISOString().slice(0, 10));
          }
        }

        if (quot.terms) setTerms(quot.terms);
        if (quot.notes) setNotes(quot.notes);

        toast.success(`Prefilled from quotation ${quot.quotation_no}`);
        navigate("/create-sales-order", { replace: true, state: {} });
      } catch (e: any) {
        console.error(e);
        quotationPrefillRef.current = null;
        toast.error("Could not load quotation to prefill sales order");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [quotations, location.state, navigate]);

  const filteredQuotations = quotations.filter((quot) =>
    (quot.quotation_no || "").toLowerCase().includes(quotationSearch.toLowerCase())
  );

  const updateItem = (id: string, patch: Partial<SOItem>) => {
    setSOItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
  };

  const removeItem = (id: string) => {
    setSOItems((prev) => prev.filter((item) => item.id !== id));
  };

  const addItem = () => {
    setSOItems((prev) => [
      ...prev,
      {
        id: `so-item-${Date.now()}`,
        product_id: 0,
        product_name: "",
        description: "",
        qty: 1,
        uom: "NOS",
        unit_price: "",
        tax_rate: 18,
        hsn_code: "",
      },
    ]);
  };

  const subtotal = soItems.reduce(
    (sum, item) => sum + (Number(item.qty) || 0) * (Number(item.unit_price) || 0),
    0
  );

  const taxTotal = soItems.reduce(
    (sum, item) =>
      sum +
      ((Number(item.qty) || 0) * (Number(item.unit_price) || 0) * (Number(item.tax_rate) || 0)) / 100,
    0
  );

  const grandTotal = subtotal + taxTotal;

  const handleSubmit = async () => {
    if (!selectedQuotation) {
      toast.error("Select a quotation");
      return;
    }

    if (soItems.length === 0) {
      toast.error("Add at least one sales order item");
      return;
    }

    for (const item of soItems) {
      if (!item.product_name.trim()) {
        toast.error("All items must have a product name");
        return;
      }
      if (Number(item.qty) <= 0) {
        toast.error("Item quantities must be greater than 0");
        return;
      }
    }

    setSaving(true);

    try {
      await api.createSalesOrder({
        quotation_id: selectedQuotation.id,
        customer_id: selectedQuotation.customer_id,
        customer_location_id: selectedQuotation.customer_location_id,
        customer_contact_id: selectedQuotation.customer_contact_id,
        so_date: soDate,
        delivery_date: deliveryDate || null,
        items: soItems.map((item) => ({
          quotation_item_id: item.quotation_item_id,
          product_id: item.product_id,
          product_name: item.product_name,
          description: item.description,
          qty: Number(item.qty),
          uom: item.uom,
          unit_price: Number(item.unit_price) || 0,
          tax_rate: Number(item.tax_rate) || 0,
          hsn_code: item.hsn_code || null,
        })),
        terms,
        notes,
        total_value: grandTotal,
        status: "confirmed",
      });

      // Update quotation status to "converted"
      try {
        await api.updateQuotation(selectedQuotation.id, { status: "converted" });
      } catch (e) {
        console.warn("Failed to update quotation status", e);
      }

      toast.success("Sales order created successfully");
      navigate("/sales-orders");
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Failed to create sales order");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="max-w-6xl mx-auto p-8 text-center text-gray-500">Loading quotations...</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto p-4 sm:p-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">New Sales Order</h1>
          <p className="text-gray-600 mt-2">Create a sales order from a quotation</p>
        </div>

        {err && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {err}
          </div>
        )}

        {/* Quotation Selection */}
        <div className={cardClass}>
          <label className="block text-sm font-semibold text-gray-900 mb-3">
            Select Quotation
          </label>
          <div className="relative">
            <input
              type="text"
              value={openQuotationDropdown ? quotationSearch : selectedQuotation?.quotation_no || ""}
              onFocus={() => {
                setQuotationSearch("");
                setOpenQuotationDropdown(true);
              }}
              onChange={(e) => {
                setQuotationSearch(e.target.value);
                setOpenQuotationDropdown(true);
              }}
              placeholder="Search quotation..."
              className={`${inputClass} cursor-pointer`}
            />

            {openQuotationDropdown && (
              <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-72 overflow-y-auto">
                {filteredQuotations.length === 0 ? (
                  <div className="px-4 py-3 text-center text-gray-500 text-sm">
                    No quotations found
                  </div>
                ) : (
                  filteredQuotations.map((quot) => (
                    <div
                      key={quot.id}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setSelectedQuotation(quot);
                        // Trigger prefill
                        navigate("/create-sales-order", { state: { fromQuotationId: quot.id } });
                        setQuotationSearch("");
                        setOpenQuotationDropdown(false);
                      }}
                      className="px-4 py-3 cursor-pointer hover:bg-blue-50 border-b last:border-b-0 transition-colors"
                    >
                      <div className="font-semibold text-gray-900">{quot.quotation_no}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {quot.customer_snapshot?.company_name || "—"} • ₹{Number(quot.total_value || 0).toLocaleString()}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {selectedQuotation && (
            <div className="mt-4 p-3 rounded-lg border border-gray-200 bg-gray-50 text-sm space-y-1">
              <p className="font-medium text-gray-900">{selectedQuotation.quotation_no}</p>
              <p className="text-gray-600">
                {selectedQuotation.customer_snapshot?.company_name || "—"}
              </p>
              <p className="text-gray-600">Total: ₹{Number(selectedQuotation.total_value || 0).toLocaleString()}</p>
            </div>
          )}
        </div>

        {/* SO Date and Delivery Date */}
        {selectedQuotation && (
          <div className="grid md:grid-cols-2 gap-4">
            <div className={cardClass}>
              <label className="block text-sm font-semibold text-gray-900 mb-3">
                Sales Order Date
              </label>
              <input
                type="date"
                value={soDate}
                onChange={(e) => setSODate(e.target.value)}
                className={inputClass}
              />
            </div>
            <div className={cardClass}>
              <label className="block text-sm font-semibold text-gray-900 mb-3">
                Delivery Date (Optional)
              </label>
              <input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
        )}

        {/* Line Items */}
        {selectedQuotation && soItems.length > 0 && (
          <div className={cardClass}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Sales Order Items</h2>
              <button
                type="button"
                onClick={addItem}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                <Plus className="w-4 h-4" />
                Add Item
              </button>
            </div>

            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">#</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Product</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-700">Qty</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-700">UOM</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-700">Rate</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-700">Tax %</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-700">Amount</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-700">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {soItems.map((item, idx) => (
                    <tr key={item.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-600">{idx + 1}</td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={item.product_name}
                          onChange={(e) =>
                            updateItem(item.id, { product_name: e.target.value })
                          }
                          placeholder="Product name"
                          className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={item.qty}
                          onChange={(e) =>
                            updateItem(item.id, {
                              qty: e.target.value === "" ? "" : Number(e.target.value),
                            })
                          }
                          min="0"
                          placeholder="0"
                          className="w-16 text-center rounded border border-gray-300 px-2 py-1 text-sm focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={item.uom}
                          onChange={(e) => updateItem(item.id, { uom: e.target.value })}
                          placeholder="NOS"
                          className="w-16 text-center rounded border border-gray-300 px-2 py-1 text-sm focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={item.unit_price}
                          onChange={(e) =>
                            updateItem(item.id, {
                              unit_price: e.target.value === "" ? "" : Number(e.target.value),
                            })
                          }
                          placeholder="0"
                          className="w-24 text-right rounded border border-gray-300 px-2 py-1 text-sm focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={item.tax_rate}
                          onChange={(e) =>
                            updateItem(item.id, {
                              tax_rate: e.target.value === "" ? "" : Number(e.target.value),
                            })
                          }
                          placeholder="0"
                          className="w-16 text-right rounded border border-gray-300 px-2 py-1 text-sm focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">
                        ₹{((Number(item.qty) || 0) * (Number(item.unit_price) || 0)).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 font-semibold">
                    <td colSpan={6} className="px-4 py-3 text-right">
                      Subtotal:
                    </td>
                    <td className="px-4 py-3 text-right">₹{subtotal.toLocaleString()}</td>
                    <td></td>
                  </tr>
                  <tr className="bg-gray-50 font-semibold">
                    <td colSpan={6} className="px-4 py-3 text-right">
                      Tax:
                    </td>
                    <td className="px-4 py-3 text-right">₹{taxTotal.toLocaleString()}</td>
                    <td></td>
                  </tr>
                  <tr className="bg-blue-50 font-bold text-lg">
                    <td colSpan={6} className="px-4 py-3 text-right">
                      Grand Total:
                    </td>
                    <td className="px-4 py-3 text-right text-blue-600">
                      ₹{grandTotal.toLocaleString()}
                    </td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Terms and Notes */}
        {selectedQuotation && (
          <div className="grid md:grid-cols-2 gap-4">
            <div className={cardClass}>
              <label className="block text-sm font-semibold text-gray-900 mb-3">
                Terms & Conditions
              </label>
              <textarea
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                rows={4}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div className={cardClass}>
              <label className="block text-sm font-semibold text-gray-900 mb-3">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {selectedQuotation && (
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={() => navigate("/sales-orders")}
              className="px-6 py-2 rounded-lg border border-gray-300 font-semibold text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving || soItems.length === 0}
              className="px-6 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Creating..." : "Create Sales Order"}
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
}
