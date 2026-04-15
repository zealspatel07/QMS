import { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Layout from "../components/layout/Layout";
import api from "../api";
import { toast } from "react-toastify";
import { Trash2 } from "lucide-react";
import { ArrowRight } from "lucide-react";

const inputClass =
  "w-full rounded-lg border border-gray-300 px-4 py-2 text-[15px] focus:ring-2 focus:ring-blue-500 focus:outline-none";
const cardClass = "bg-white rounded-xl border border-gray-200 p-6";

type DispatchItem = {
  id: string;
  so_item_id?: number;
  product_id: number;
  product_name: string;
  so_qty: number;
dispatch_qty: number | null;
  uom: string;
};

export default function DispatchCreate() {
  const navigate = useNavigate();
  const location = useLocation();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // Sales Orders list
  const [salesOrders, setSalesOrders] = useState<any[]>([]);
  const [selectedSO, setSelectedSO] = useState<any | null>(null);
  const [soSearch, setSOSearch] = useState("");
  const [openSODropdown, setOpenSODropdown] = useState(false);

  // Dispatch form
  const [dispatchDate, setDispatchDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [dispatchItems, setDispatchItems] = useState<DispatchItem[]>([]);
  const [remarks, setRemarks] = useState("");
  const [stockByProduct, setStockByProduct] = useState<Record<number, number>>({});
  const [checkingStock, setCheckingStock] = useState(false);
  const [addingMissingStock, setAddingMissingStock] = useState(false);

  // Load sales orders on mount
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const sos = await api.getSalesOrders({
          limit: 500,
          status: "confirmed",
        });
        setSalesOrders(Array.isArray(sos) ? sos : []);

        // Auto-select SO from state if coming from SalesOrderView
        const state = location.state as { fromSalesOrderId?: number };
        if (state?.fromSalesOrderId) {
          try {
            const fullSO = await api.getSalesOrderById(state.fromSalesOrderId);
            setSelectedSO(fullSO);
          } catch (err) {
            console.error(err);
            toast.error("Failed to load sales order details");
          }
        }
      } catch (e: any) {
        setErr(e?.message || "Failed to load sales orders");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Populate items when SO is selected
  useEffect(() => {
    if (!selectedSO) {
      setDispatchItems([]);
      return;
    }

    let rawItems: any[] = [];
    if (Array.isArray(selectedSO.items)) {
      rawItems = selectedSO.items;
    } else if (typeof selectedSO.items === "string") {
      try {
        const p = JSON.parse(selectedSO.items);
        rawItems = Array.isArray(p) ? p : [];
      } catch {
        rawItems = [];
      }
    }

    const populated = rawItems.map((it: any, idx: number) => ({
      id: `item-${idx}-${Date.now()}`,
      so_item_id: it.id,
      product_id: it.product_id || 0,
      product_name: it.product_name || "",
      so_qty: Number(it.qty || it.quantity || 0),
      dispatch_qty: null,
      uom: it.uom || "NOS",
    }));

    setDispatchItems(populated);
  }, [selectedSO]);

  const filteredSOs = salesOrders.filter((so) =>
    (so.so_number || "").toLowerCase().includes(soSearch.toLowerCase()),
  );

  const updateItem = (id: string, patch: Partial<DispatchItem>) => {
    setDispatchItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  };

  const removeItem = (id: string) => {
    setDispatchItems((prev) => prev.filter((item) => item.id !== id));
  };

  const loadStockAvailability = async () => {
    const productIds = Array.from(
      new Set(
        dispatchItems
          .map((it) => Number(it.product_id))
          .filter((pid) => Number.isFinite(pid) && pid > 0),
      ),
    );
    if (!productIds.length) {
      setStockByProduct({});
      return;
    }
    try {
      setCheckingStock(true);
      const rows = await api.getAvailableStockBulk(productIds);
      const map: Record<number, number> = {};
      for (const r of Array.isArray(rows) ? rows : []) {
        const pid = Number(r?.product_id);
        if (!Number.isFinite(pid) || pid <= 0) continue;
        map[pid] = Number(r?.available_qty || 0);
      }
      setStockByProduct(map);
    } catch (e) {
      console.error("Stock check failed:", e);
      toast.error("Failed to auto-check stock availability");
    } finally {
      setCheckingStock(false);
    }
  };

  useEffect(() => {
    if (!selectedSO || dispatchItems.length === 0) return;
    loadStockAvailability();
  }, [selectedSO, dispatchItems.length]);

  useEffect(() => {
    if (!selectedSO) return;
    const t = window.setInterval(() => {
      loadStockAvailability();
    }, 20000);
    return () => window.clearInterval(t);
  }, [selectedSO, dispatchItems.length]);

  const shortageByProduct = useMemo(() => {
    const m: Record<number, number> = {};
    for (const item of dispatchItems) {
      const pid = Number(item.product_id);
      const req = Number(item.dispatch_qty || 0);
      if (!Number.isFinite(pid) || pid <= 0 || req <= 0) continue;
      const available = Number(stockByProduct[pid] || 0);
      const shortage = Math.max(0, req - available);
      if (shortage > 0) m[pid] = Math.max(0, (m[pid] || 0) + shortage);
    }
    return m;
  }, [dispatchItems, stockByProduct]);

  const totalShortageQty = useMemo(
    () => Object.values(shortageByProduct).reduce((s, n) => s + Number(n || 0), 0),
    [shortageByProduct],
  );

  const addMissingStock = async (productId?: number) => {
    const today = new Date().toISOString().slice(0, 10);
    const items = productId
      ? [{ product_id: productId, quantity: Number(shortageByProduct[productId] || 0), remarks: "Auto shortage fill from dispatch" }]
      : Object.entries(shortageByProduct)
          .filter(([, qty]) => Number(qty) > 0)
          .map(([pid, qty]) => ({
            product_id: Number(pid),
            quantity: Number(qty),
            remarks: "Auto shortage fill from dispatch",
          }));

    if (!items.length) {
      toast.info("No shortage to add");
      return;
    }

    try {
      setAddingMissingStock(true);
      await api.postManualStockInward({
        grn_date: today,
        remarks: productId
          ? `Auto stock add for product ${productId} from dispatch screen`
          : "Auto stock add for dispatch shortages",
        items,
      });
      toast.success(productId ? "Missing stock added for selected product" : "Missing stock added for all shortage lines");
      await loadStockAvailability();
    } catch (e: any) {
      toast.error(e?.message || "Failed to add missing stock");
    } finally {
      setAddingMissingStock(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedSO) {
      toast.error("Select a sales order");
      return;
    }

    if (dispatchItems.length === 0) {
      toast.error("Add at least one dispatch item");
      return;
    }

    // ✅ NEW VALIDATION (CORRECT)
    const validItems = dispatchItems.filter(
      (item) => Number(item.dispatch_qty) > 0,
    );

    if (validItems.length === 0) {
      toast.error("Enter at least one valid dispatch quantity");
      return;
    }

    for (const item of validItems) {
      const qty = Number(item.dispatch_qty);

      if (qty > item.so_qty) {
        toast.error(
          `Item ${item.product_name}: dispatch cannot exceed SO quantity (${item.so_qty})`,
        );
        return;
      }
    }

    const blockingShortages = validItems
      .map((item) => {
        const available = Number(stockByProduct[item.product_id] || 0);
        const required = Number(item.dispatch_qty || 0);
        return {
          product_name: item.product_name,
          shortage: Math.max(0, required - available),
        };
      })
      .filter((x) => x.shortage > 0);

    if (blockingShortages.length > 0) {
      toast.error(
        `Insufficient stock for ${blockingShortages.length} item(s). Use "Add Missing" or "Auto Add All Missing Stock" first.`,
      );
      return;
    }

    setSaving(true);

    try {
      const result = await api.createDispatch({
        sales_order_id: selectedSO.id,
        dispatch_date: dispatchDate,
        items: validItems.map((item) => ({
          so_item_id: item.so_item_id,
          product_id: item.product_id,
          product_name: item.product_name,
          dispatch_qty: Number(item.dispatch_qty),
          uom: item.uom,
        })),
        remarks,
        status: "pending",
      });

      toast.success("Dispatch created successfully");
      navigate(`/dispatch/${result?.id || selectedSO.id}`, {
        state: { fromSalesOrderId: selectedSO.id },
      });
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Failed to create dispatch");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto p-4 sm:p-8 space-y-6">
        {/* Flow Breadcrumb */}
        {selectedSO && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
            <p className="text-xs font-semibold text-gray-600 uppercase mb-3">
              Document Flow
            </p>
            <div className="flex items-center gap-2 text-sm overflow-x-auto pb-2">
              {selectedSO.enquiry_id && (
                <>
                  <button
                    onClick={() =>
                      selectedSO.enquiry_id &&
                      navigate(`/enquiries/${selectedSO.enquiry_id}`)
                    }
                    className="px-3 py-1 bg-white rounded-lg border border-gray-200 hover:border-blue-400 text-gray-700 hover:text-blue-600 font-medium whitespace-nowrap"
                  >
                    ENQ #{selectedSO.enquiry_id}
                  </button>
                  <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                </>
              )}
              {selectedSO.quotation_id && (
                <>
                  <button
                    onClick={() =>
                      selectedSO.quotation_id &&
                      navigate(`/quotations/${selectedSO.quotation_id}`)
                    }
                    className="px-3 py-1 bg-white rounded-lg border border-gray-200 hover:border-blue-400 text-gray-700 hover:text-blue-600 font-medium whitespace-nowrap"
                  >
                    Q #{selectedSO.quotation_id}
                  </button>
                  <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                </>
              )}
              <button
                onClick={() => navigate(`/sales-orders/${selectedSO.id}`)}
                className="px-3 py-1 bg-white rounded-lg border border-gray-200 hover:border-blue-400 text-gray-700 hover:text-blue-600 font-medium whitespace-nowrap"
              >
                SO #{selectedSO.so_number}
              </button>
              <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <div className="px-3 py-1 bg-blue-100 rounded-lg border border-blue-300 text-blue-700 font-medium whitespace-nowrap">
                DSP (New)
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">New Dispatch</h1>
            <p className="text-gray-600 mt-2">
              Create a new dispatch from a confirmed sales order
            </p>
          </div>
          <button
            onClick={() => navigate("/dispatch")}
            className="px-4 py-2 text-gray-600 hover:text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            ← Back to Dispatches
          </button>
        </div>

        {err && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {err}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-gray-500">
            Loading sales orders...
          </div>
        ) : (
          <>
            {/* Sales Order Selection */}
            <div className={cardClass}>
              <label className="block text-sm font-semibold text-gray-900 mb-3">
                Select Sales Order
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={
                    openSODropdown ? soSearch : selectedSO?.so_number || ""
                  }
                  onFocus={() => {
                    setSOSearch("");
                    setOpenSODropdown(true);
                  }}
                  onChange={(e) => {
                    setSOSearch(e.target.value);
                    setOpenSODropdown(true);
                  }}
                  placeholder="Search sales order..."
                  className={`${inputClass} cursor-pointer`}
                />

                {openSODropdown && (
                  <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-72 overflow-y-auto">
                    {filteredSOs.length === 0 ? (
                      <div className="px-4 py-3 text-center text-gray-500 text-sm">
                        No sales orders found
                      </div>
                    ) : (
                      filteredSOs.map((so) => (
                        <div
                          key={so.id}
                          onMouseDown={async (e) => {
                            e.preventDefault();

                            try {
                              const fullSO = await api.getSalesOrderById(so.id);
                              setSelectedSO(fullSO);
                            } catch (err) {
                              console.error(err);
                              toast.error("Failed to load sales order details");
                              return;
                            }

                            setSOSearch("");
                            setOpenSODropdown(false);
                          }}
                          className="px-4 py-3 cursor-pointer hover:bg-blue-50 border-b last:border-b-0 transition-colors"
                        >
                          <div className="font-semibold text-gray-900">
                            {so.so_number}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {so.customer_snapshot?.company_name || "—"} • ₹
                            {Number(so.total_value || 0).toLocaleString()}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {selectedSO && (
                <div className="mt-4 p-3 rounded-lg border border-gray-200 bg-gray-50 text-sm space-y-1">
                  <p className="font-medium text-gray-900">
                    {selectedSO.so_number}
                  </p>
                  <p className="text-gray-600">
                    {selectedSO.customer_snapshot?.company_name || "—"} •{" "}
                    {selectedSO.customer_snapshot?.location_name || "—"}
                  </p>
                  <p className="text-gray-600">
                    Total: ₹
                    {Number(selectedSO.total_value || 0).toLocaleString()}
                  </p>
                </div>
              )}
            </div>

            {/* Dispatch Date */}
            {selectedSO && (
              <div className={cardClass}>
                <label className="block text-sm font-semibold text-gray-900 mb-3">
                  Dispatch Date
                </label>
                <input
                  type="date"
                  value={dispatchDate}
                  onChange={(e) => setDispatchDate(e.target.value)}
                  className={inputClass}
                />
              </div>
            )}

            {/* Dispatch Items */}
            {selectedSO && dispatchItems.length > 0 && (
              <div className={cardClass}>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Dispatch Items
                </h2>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs text-gray-600">
                    {checkingStock ? "Checking stock..." : "Live stock check active"}
                    {totalShortageQty > 0 && (
                      <span className="ml-2 font-semibold text-red-700">
                        Shortage detected: {totalShortageQty.toFixed(3)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={loadStockAvailability}
                      className="px-3 py-1.5 text-xs rounded border border-gray-300 hover:bg-gray-50"
                    >
                      Refresh Stock
                    </button>
                    <button
                      type="button"
                      onClick={() => addMissingStock()}
                      disabled={addingMissingStock || totalShortageQty <= 0}
                      className="px-3 py-1.5 text-xs rounded bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
                    >
                      {addingMissingStock ? "Adding..." : "Auto Add All Missing Stock"}
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto border rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-4 py-2 text-left font-semibold text-gray-700">
                          #
                        </th>
                        <th className="px-4 py-2 text-left font-semibold text-gray-700">
                          Product
                        </th>
                        <th className="px-4 py-2 text-center font-semibold text-gray-700">
                          SO Qty
                        </th>
                        <th className="px-4 py-2 text-center font-semibold text-gray-700">
                          Dispatch Qty
                        </th>
                        <th className="px-4 py-2 text-center font-semibold text-gray-700">
                          Available
                        </th>
                        <th className="px-4 py-2 text-center font-semibold text-gray-700">
                          Shortage
                        </th>
                        <th className="px-4 py-2 text-center font-semibold text-gray-700">
                          UOM
                        </th>
                        <th className="px-4 py-2 text-center font-semibold text-gray-700">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {dispatchItems.map((item, idx) => (
                        (() => {
                          const available = Number(stockByProduct[item.product_id] || 0);
                          const requested = Number(item.dispatch_qty || 0);
                          const shortage = Math.max(0, requested - available);
                          return (
                        <tr key={item.id} className="border-b hover:bg-gray-50">
                          <td className="px-4 py-3 text-gray-600">{idx + 1}</td>
                          <td className="px-4 py-3 font-medium text-gray-900">
                            {item.product_name}
                          </td>
                          <td className="px-4 py-3 text-center text-gray-600">
                            {item.so_qty}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <input
                              type="number"
                              value={item.dispatch_qty ?? ""}
                              onChange={(e) =>
                                updateItem(item.id, {
                                  dispatch_qty:
                                    e.target.value === ""
                                      ? null
                                      : Number(e.target.value),
                                })
                              }
                              min="0"
                              max={item.so_qty}
                              placeholder="0"
                              className="w-20 text-center rounded border border-gray-300 px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            />
                          </td>
                          <td className="px-4 py-3 text-center text-gray-700">
                            {available.toFixed(3)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {shortage > 0 ? (
                              <div className="inline-flex items-center gap-2">
                                <span className="text-xs font-semibold text-red-700">
                                  {shortage.toFixed(3)}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => addMissingStock(Number(item.product_id))}
                                  disabled={addingMissingStock}
                                  className="px-2 py-1 text-[11px] rounded bg-red-100 text-red-700 hover:bg-red-200"
                                >
                                  Add Missing
                                </button>
                              </div>
                            ) : (
                              <span className="text-xs text-emerald-700 font-semibold">OK</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center text-gray-600">
                            {item.uom}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => removeItem(item.id)}
                              className="text-red-600 hover:text-red-700 font-semibold"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                          );
                        })()
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Remarks */}
            {selectedSO && (
              <div className={cardClass}>
                <label className="block text-sm font-semibold text-gray-900 mb-3">
                  Remarks (Optional)
                </label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  rows={3}
                  placeholder="Add any dispatch remarks..."
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            )}

            {/* Action Buttons */}
            {selectedSO && (
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => navigate("/dispatch")}
                  className="px-6 py-2 rounded-lg border border-gray-300 font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={saving}
                  className="px-6 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? "Creating..." : "Create Dispatch"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
