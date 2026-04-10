// File: src/pages/QuotationEdit.tsx

import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Layout from "../components/layout/Layout";
import { api } from "../api";
import VersionCommentModal from "../components/VersionCommentModal";
import { Calendar } from "lucide-react";
import toast from "react-hot-toast";

function toLocalDateInput(dateStr: string) {
  const d = new Date(dateStr);
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 10);
}


export default function QuotationEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);


  // Version comment modal state
  const [versionCommentModalOpen, setVersionCommentModalOpen] = useState(false);
  const [pendingSavePayload, setPendingSavePayload] = useState<any>(null);
  const [originalVersion, setOriginalVersion] = useState<string>("0.1");
  const dateInputRef = useRef<HTMLInputElement>(null);


  const [reissue, setReissue] = useState(false);
  const [newValidityDays, setNewValidityDays] = useState<number>(30);

  const openCalendar = () => {
    dateInputRef.current?.showPicker();
  };



  const [validityState, setValidityState] = useState<
    "valid" | "due" | "overdue" | "expired" | null
  >(null);
  const [defaultTerms, setDefaultTerms] = useState("");

  // ✅ FIX 1: items MUST be array, not string
  const [data, setData] = useState<any>({
    quotation_no: "",
    customer_id: null,
    customer_location_id: null,
    customer_contact_id: null,
    quotation_date: "",
    validity_days: "",
    payment_terms: "",
    status: "draft",
    items: [],
    notes: "",
    remarks: "",
    terms: "",
  });


  const [productList, setProductList] = useState<any[]>([]);

  const [customerSnapshot, setCustomerSnapshot] = useState<any>(null);

  const [customerDraft, setCustomerDraft] = useState<any>(null);

  const [addProductOpen, setAddProductOpen] = useState(false);
  const [productSubmitting, setProductSubmitting] = useState(false);

  const [productForm, setProductForm] = useState({
    name: "",
    unit_price: "",
    tax_rate: "",
    uom: "NOS",
    description: "",
 
  });


  const [activeProductRow, setActiveProductRow] = useState<number | null>(null);
  const [selectedProductRowForModal, setSelectedProductRowForModal] = useState<number | null>(null);
  const [productSearch, setProductSearch] = useState("");

  /* ================= CUSTOMER MODAL STATE ================= */



  useEffect(() => {
    if (!id) return;

    (async () => {
      setLoading(true);
      try {
        /* ================= LOAD PRODUCTS ================= */
        const prodResp: any = await api.getProducts();
        const prods = Array.isArray(prodResp) ? prodResp : prodResp?.data ?? [];

        const m: Record<string, string> = {};
        const list: any[] = [];

        prods.forEach((p: any) => {
          const pid = p?.id ?? p?._id;
          if (pid != null) {
            m[String(pid)] = p.name ?? p.product_name ?? "";
            list.push({
              id: String(pid),
              name: p.name ?? p.product_name ?? "",
              description: p.description ?? "",
              unit_price: Number(p.unit_price ?? p.price ?? 0),
              tax_rate: Number(p.tax_rate ?? p.tax ?? 0),
              uom: p.uom ?? "NOS",
              hsn_code: p.hsn_code ?? "",
             
            });
          }
        });

        setProductList(list);

        /* ================= LOAD CUSTOMERS (ADD HERE) ================= */


        /* ================= LOAD QUOTATION ================= */
        const res: any = await api.getQuotation(id);
        const q = res?.quotation ?? res ?? {};

        setValidityState(q.validity_state ?? null);
        setNewValidityDays(q.validity_days ?? 30);

        setCustomerSnapshot(q.customer_snapshot ?? null);
        let items: any[] = [];
        if (Array.isArray(q.items)) items = q.items;
        else if (typeof q.items === "string" && q.items.trim()) {
          try {
            items = JSON.parse(q.items);
          } catch {
            items = [];
          }
        }

        // ✅ clone snapshot into editable draft
        setCustomerDraft(
          q.customer_snapshot
            ? JSON.parse(JSON.stringify(q.customer_snapshot))
            : {
              company_name: "",
              contact_name: "",
              phone: "",
              email: "",
              location_name: "",
              address: "",
              gstin: "",
            }
        );

        const normalized = items.map((it: any) => {
          const productId = it.product_id ?? it.productId ?? null;
          const prodInfo = list.find(p => String(p.id) === String(productId));

          return {
            ...it,
            product_id: productId ? String(productId) : null,
            name: it.product_name ?? it.name ?? prodInfo?.name ?? "",
            description: it.description ?? prodInfo?.description ?? "",
            qty: Number(it.qty ?? it.quantity ?? 1),
            unit_price: Number(it.unit_price ?? prodInfo?.unit_price ?? 0),
            tax_rate: Number(it.tax_rate ?? prodInfo?.tax_rate ?? 0),
            uom: it.uom ?? prodInfo?.uom ?? "NOS",
            hsn_code: it.hsn_code ?? prodInfo?.hsn_code ?? "",
            
            id: it.id ?? it._id,
          };
        });

        const quotationTerms = q.terms ?? "";

        setData({
          quotation_no: q.quotation_no ?? "",
          customer_id: q.customer?.id ?? null,
          customer_location_id: q.location?.id ?? null,
          customer_contact_id: q.contact?.id ?? null,
          quotation_date: q.quotation_date
  ? toLocalDateInput(q.quotation_date)
  : "",

          validity_days: q.validity_days ?? "",
          payment_terms: q.payment_terms ?? "",
          status: q.status ?? "draft",
          items: normalized,
          terms: quotationTerms,
          notes: q.notes ?? "",
          remarks: q.remarks ?? "",
        });

        setOriginalVersion(q.version ?? "0.1");
        setDefaultTerms(quotationTerms);



      } catch (e) {
        console.error("Failed to load quotation", e);
        toast.error("Failed to load quotation");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);


  const isTermsEditable =
    data.status === "draft" || data.status === "pending";

  const isQuotationNoEditable =
    data.status === "draft" || data.status === "pending";

  const updateItem = (idx: number, patch: any) => {
    setData((prev: any) => {
      const items = [...prev.items];
      items[idx] = { ...items[idx], ...patch };
      return { ...prev, items };
    });
  };

  const addItem = () =>
    setData((prev: any) => ({
      ...prev,
      items: [...prev.items,
      {
        name: "",
        product_id: null,
        description: "",
        qty: 1,
        unit_price: 0,
        tax_rate: 0,
        discount_percent: 0,
        uom: "NOS"
      }],
    }));

  const removeItem = (idx: number) =>
    setData((prev: any) => {
      const items = [...prev.items];
      items.splice(idx, 1);
      return { ...prev, items };
    });

  const subtotal = data.items.reduce((sum: number, it: any) => {
    return sum + it.qty * it.unit_price;
  }, 0);

  const totalDiscount = data.items.reduce((sum: number, it: any) => {
    const lineTotal = it.qty * it.unit_price;
    const discount = lineTotal * (Number(it.discount_percent || 0) / 100);
    return sum + discount;
  }, 0);

  const taxTotal = data.items.reduce((sum: number, it: any) => {
    const lineTotal = it.qty * it.unit_price;
    const discount = lineTotal * (Number(it.discount_percent || 0) / 100);
    const taxable = lineTotal - discount;
    const tax = taxable * (Number(it.tax_rate || 0) / 100);
    return sum + tax;
  }, 0);

  const grandTotal = subtotal - totalDiscount + taxTotal;

  async function handleSave(saveMode: "draft" | "final" = "final") {
    // 1️⃣ Integrity check
    if (!data.customer_id) {
      toast.error("Customer data missing. This quotation may be corrupted.");
      return;
    }

    // 2️⃣ Validity enforcement
    if (validityState === "expired" && !reissue) {
      toast.error("Quotation expired. Re-issue required.");
      return;
    }

    // 3️⃣ Re-Issue flow (fork)
    if (reissue) {
      try {
        setSaving(true);

        const res = await toast.promise(
  api.reissueQuotation(Number(id), {
    validity_days: newValidityDays,
  }),
  {
    loading: "Re-issuing quotation...",
    success: "Quotation re-issued successfully",
    error: "Re-issue failed",
  }
);

        // API returns { new_quotation_id: newQuotationId }
        const newQtId = res?.new_quotation_id;
        if (!newQtId) {
          throw new Error("Re-issue failed: missing new quotation ID");
        }
        navigate(`/quotations/${newQtId}`);
        return;
      } catch (e) {
        console.error("Re-issue failed", e);
        toast.error("Failed to re-issue quotation");
        setSaving(false);
        return;
      }
    }

    // 4️⃣ Normal save flow
    try {
      setSaving(true);

      const itemsPayload = data.items
        .filter((it: any) => it.product_id && it.qty > 0)
        .map((it: any) => ({
          id: it.id,
          product_id: Number(it.product_id),
          product_name: it.name,
          description: it.description,
          qty: Number(it.qty || 0),
          unit_price: Number(it.unit_price || 0),
          discount_percent: Number(it.discount_percent || 0),
          tax_rate: Number(it.tax_rate || 0),
          uom: it.uom,
          hsn_code: it.hsn_code || null,
          
        }));

      const payload = {
        quotation_no: data.quotation_no,

        // 🔗 reference IDs (do NOT change)
        customer_id: data.customer_id,
        customer_location_id: data.customer_location_id,
        customer_contact_id: data.customer_contact_id,

        // 📸 SNAPSHOT (THIS IS THE FIX)
        customer_snapshot: {
          company_name: customerDraft?.company_name || "",
          location_name: customerDraft?.location_name || "",
          address: customerDraft?.address || "",
          gstin: customerDraft?.gstin || "",
          contact_name: customerDraft?.contact_name || "",
          phone: customerDraft?.phone || "",
          email: customerDraft?.email || "",
        },

        quotation_date: data.quotation_date?.split("T")[0],
        validity_days: data.validity_days,
        payment_terms:
          typeof data.payment_terms === "string" && data.payment_terms.trim()
            ? data.payment_terms.trim()
            : null,
          status: saveMode === "final" ? "pending" : "draft",
        items: itemsPayload,
        notes: data.notes,
        remarks: data.remarks,
        terms: data.terms,
        total_value: grandTotal,

        // 🔑 backend decides behaviour
        save_mode: saveMode,
      };
      if (saveMode === "final") {
        setPendingSavePayload(payload);
        setVersionCommentModalOpen(true);
        return;
      }
      // draft → save directly
      await performSave(payload, null);
    } catch (e) {
      console.error("Save failed", e);
      toast.error("Save failed. Please try again.");
    } finally {
      setSaving(false);
    }
  }


  async function performSave(payload: any, versionComment: string | null) {
  setSaving(true);
  try {
    if (versionComment) {
      payload.versionComment = versionComment;
    }

   await toast.promise(
  api.updateQuotation(Number(id), payload),
  {
    loading:
      payload.save_mode === "draft"
        ? "Saving draft..."
        : "Saving quotation...",
    success:
      payload.save_mode === "draft"
        ? "Draft saved successfully"
        : "Quotation saved successfully",
    error: "Save failed",
  }
);

    navigate(`/quotations/${Number(id)}`);
  } catch (e) {
    console.error("Save failed", e);
    toast.error("Save failed");
  } finally {
    setSaving(false);
  }
}



  function handleVersionCommentSubmit(comment: string) {
    setVersionCommentModalOpen(false);

    if (!pendingSavePayload) return;

    performSave(
      JSON.parse(JSON.stringify(pendingSavePayload)),
      comment
    );
  }
  // ================= SUBMIT CUSTOMER FROM QUOTATION =================


  // ================= SUBMIT PRODUCT FROM QUOTATION =================
  async function submitProductFromQuotation() {
    if (!productForm.name.trim()) {
      toast.error("Product name is required");
      return;
    }

    try {
      setProductSubmitting(true);

      const payload = {
        name: productForm.name.trim(),
        unit_price: Number(productForm.unit_price || 0),
        tax_rate: Number(productForm.tax_rate || 0),
        uom: productForm.uom || "NOS",
        description: productForm.description.trim(),
       
      };

      console.log("[QuotationEdit] Creating product with payload:", payload);

      const res: any = await api.addProduct(payload);

      console.log("[QuotationEdit] Product creation response:", res);

      // Handle response - backend now returns { success: true, product: {...} }
      const newProduct = res?.product ?? res;

      console.log("[QuotationEdit] Normalized product:", newProduct);

      if (!newProduct || !newProduct.id) {
        console.error("Invalid response from server - missing product or ID:", res);
        toast.error("Invalid product response from server");
        return;
      }

      const normalizedProduct = {
        id: String(newProduct.id),
        name: newProduct.name || "",
        description: newProduct.description || "",
        unit_price: Number(newProduct.unit_price || 0),
        tax_rate: Number(newProduct.tax_rate || 0),
        uom: newProduct.uom || "NOS",
        hsn_code: newProduct.hsn_code || "",
        
      };

      // Validate normalized product
      if (!normalizedProduct.name.trim()) {
        toast.error("Product name is empty");
        return;
      }

      console.log("[QuotationEdit] Final normalized product:", normalizedProduct);

      // 1️⃣ Add to product list immediately
      setProductList((prev) => {
        const updated = [...prev, normalizedProduct];
        console.log("[QuotationEdit] Updated product list:", updated);
        return updated;
      });

      // 2️⃣ Auto-select product in the correct row
      if (selectedProductRowForModal !== null) {
        console.log("[QuotationEdit] Auto-selecting product in row:", selectedProductRowForModal);
        updateItem(selectedProductRowForModal, {
          product_id: normalizedProduct.id,
          name: normalizedProduct.name,
          description: normalizedProduct.description,
          unit_price: normalizedProduct.unit_price,
          tax_rate: normalizedProduct.tax_rate,
          uom: normalizedProduct.uom,
          hsn_code: normalizedProduct.hsn_code,
        
          qty: 1,
        });
        // Clear the saved row after using it
        setSelectedProductRowForModal(null);
      }

      // 3️⃣ Close modal
      setAddProductOpen(false);

      // 4️⃣ Reset form after successful save
      setProductForm({
        name: "",
        unit_price: "",
        tax_rate: "",
        uom: "NOS",
        description: "",
        
      });

      toast.success("✓ Product created and added to quotation");
    } catch (e: any) {
      console.error("Failed to create product:", e);
      console.error("Error details:", {
        message: e?.message,
        status: e?.status,
        body: e?.body,
      });
      const errorMsg = e?.message || "Failed to create product. Please check console for details.";
      toast.error(errorMsg);
    } finally {
      setProductSubmitting(false);
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="p-8">Loading...</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="w-full px-8 py-8">

        {/* ================= HEADER ================= */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              Edit Quotation
            </h1>
            <p className="text-sm text-gray-500">
              Quotation ID: {id}
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => navigate(-1)}
              className="px-4 py-2 rounded-md border border-gray-300 bg-white text-sm"
            >
              Back
            </button>

            <button
              onClick={() => handleSave("draft")}
              disabled={saving}
              className="px-5 py-2 rounded-md border border-gray-300 bg-white text-sm"
            >
              Save as Draft
            </button>

            <button
              onClick={() => handleSave("final")}
              disabled={saving}
              className="px-5 py-2 rounded-md bg-blue-600 text-white text-sm shadow-sm"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>

        {/* ================= CUSTOMER + META ================= */}
        <div className="bg-white shadow rounded-lg p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">

            {/* ================= LEFT: CUSTOMER DETAILS ================= */}
            <div className="lg:col-span-2">
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-gray-800">
                  Customer Details
                </h3>
              </div>

              {customerSnapshot && customerDraft ? (
                <div className="space-y-4">

                  {/* ================= SAVED SNAPSHOT (READ-ONLY) ================= */}
                  <div className="border rounded-lg p-4 bg-gray-100 text-sm space-y-2">
                    <div className="text-xs font-semibold text-gray-500 uppercase">
                      Saved Snapshot (Last Version)
                    </div>

                    <div className="font-semibold text-gray-900">
                      {customerSnapshot.company_name}
                    </div>

                    <div className="text-gray-600">
                      {customerSnapshot.location_name}
                    </div>

                    {customerSnapshot.address && (
                      <div className="text-gray-600">
                        {customerSnapshot.address}
                      </div>
                    )}

                    {customerSnapshot.gstin && (
                      <div className="text-gray-600">
                        GSTIN: {customerSnapshot.gstin}
                      </div>
                    )}

                    <div className="pt-3 mt-3 border-t">
                      <div className="font-medium text-gray-800">
                        {customerSnapshot.contact_name}
                      </div>

                      {customerSnapshot.phone && (
                        <div className="text-gray-600">📞 {customerSnapshot.phone}</div>
                      )}

                      {customerSnapshot.email && (
                        <div className="text-gray-600">✉️ {customerSnapshot.email}</div>
                      )}
                    </div>
                  </div>

                  {/* ================= EDITABLE DRAFT ================= */}
                  <div className="border rounded-lg p-4 bg-white text-sm space-y-3">
                    <div className="text-xs font-semibold text-blue-600 uppercase">
                      Edit Customer (New Version)
                    </div>

                    {/* COMPANY */}
                    <div>
                      <label className="text-xs text-gray-500">Company Name</label>
                      <input
                        aria-label="Company Name"
                        className="w-full mt-1 p-2 border rounded-md"
                        value={customerDraft.company_name || ""}
                        onChange={(e) =>
                          setCustomerDraft((s: any) => ({ ...s, company_name: e.target.value }))
                        }
                      />
                    </div>

                    {/* LOCATION */}
                    <div>
                      <label className="text-xs text-gray-500">Location</label>
                      <input
                        aria-label="Location"
                        className="w-full mt-1 p-2 border rounded-md"
                        value={customerDraft.location_name || ""}
                        onChange={(e) =>
                          setCustomerDraft((s: any) => ({ ...s, location_name: e.target.value }))
                        }
                      />
                    </div>

                    {/* ADDRESS */}
                    <div>
                      <label className="text-xs text-gray-500">Address</label>
                      <textarea
                        aria-label="Address"
                        rows={2}
                        className="w-full mt-1 p-2 border rounded-md"
                        value={customerDraft.address || ""}
                        onChange={(e) =>
                          setCustomerDraft((s: any) => ({ ...s, address: e.target.value }))
                        }
                      />
                    </div>

                    {/* GST */}
                    <div>
                      <label className="text-xs text-gray-500">GSTIN</label>
                      <input
                        aria-label="GSTIN"
                        className="w-full mt-1 p-2 border rounded-md"
                        value={customerDraft.gstin || ""}
                        onChange={(e) =>
                          setCustomerDraft((s: any) => ({ ...s, gstin: e.target.value }))
                        }
                      />
                    </div>

                    <div className="pt-3 border-t space-y-2">
                      {/* CONTACT */}
                      <div>
                        <label className="text-xs text-gray-500">Contact Person</label>
                        <input
                          aria-label="Contact Person"
                          className="w-full mt-1 p-2 border rounded-md"
                          value={customerDraft.contact_name || ""}
                          onChange={(e) =>
                            setCustomerDraft((s: any) => ({ ...s, contact_name: e.target.value }))
                          }
                        />
                      </div>

                      {/* PHONE */}
                      <div>
                        <label className="text-xs text-gray-500">Phone</label>
                        <input
                          aria-label="Phone"
                          className="w-full mt-1 p-2 border rounded-md"
                          value={customerDraft.phone || ""}
                          onChange={(e) =>
                            setCustomerDraft((s: any) => ({ ...s, phone: e.target.value }))
                          }
                        />
                      </div>

                      {/* EMAIL */}
                      <div>
                        <label className="text-xs text-gray-500">Email</label>
                        <input
                          aria-label="Email"
                          className="w-full mt-1 p-2 border rounded-md"
                          value={customerDraft.email || ""}
                          onChange={(e) =>
                            setCustomerDraft((s: any) => ({ ...s, email: e.target.value }))
                          }
                        />
                      </div>
                    </div>
                  </div>

                </div>
              ) : (
                <div className="text-sm text-gray-500">
                  Customer snapshot not available
                </div>
              )}

            </div>


            {/* ================= RIGHT: QUOTATION DETAILS ================= */}
            <div className="border rounded-lg p-6">

              <div className="mb-4">
                <h3 className="text-sm font-semibold text-gray-800">
                  Quotation Details
                </h3>
              </div>

              {/* QUOTATION NUMBER */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Quotation Number
                </label>

                <input
                  type="text"
                  aria-label="Quotation Number"
                  value={data.quotation_no || ""}
                  disabled={!isQuotationNoEditable}
                  onChange={(e) =>
                    setData((s: any) => ({
                      ...s,
                      quotation_no: e.target.value,
                    }))
                  }
                  className={`w-full h-10 px-3 border rounded-md text-sm
      ${!isQuotationNoEditable
                      ? "bg-gray-100 text-gray-500 cursor-not-allowed"
                      : ""
                    }`}
                />
               

                {!isQuotationNoEditable && (
                  <p className="text-xs text-gray-400 mt-1">
                    Quotation number is locked after approval.
                  </p>
                )}
              </div>

              <div className="space-y-4 border-t pt-4">

                {/* DATE */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Quotation Date
                  </label>
                  <div className="relative">
                    <input
                      ref={dateInputRef}
                      type="date"
                      aria-label="Quotation Date"
                      value={data.quotation_date || ""}
                      onClick={openCalendar}
                      onChange={(e) =>
                        setData((s: any) => ({
                          ...s,
                          quotation_date: e.target.value,
                        }))
                      }
                      className="w-full h-10 px-3 pr-10 border rounded-md cursor-pointer"
                    />

                    <button
                      type="button"
                      aria-label="Open calendar"
                      onClick={openCalendar}
                      className="absolute inset-y-0 right-3 flex items-center text-gray-400"
                      tabIndex={-1}
                    >
                      <Calendar size={16} />
                    </button>
                  </div>
                </div>

                {/* VALIDITY */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Validity (days)
                  </label>
                  <input
                    type="number"
                    min={0}
                    aria-label="Validity in days"
                    value={data.validity_days}
                    disabled={validityState === "expired"}
                    className="w-full h-10 px-3 border rounded-md"
                    onChange={(e) => {
                      const v = e.target.value;
                      setData((s: any) => ({
                        ...s,
                        validity_days: v === "" ? "" : Number(v),
                      }));
                    }}
                  />
                </div>

                {/* STATUS */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Status
                  </label>
                  <select
                    aria-label="Status"
                    value={data.status}
                    onChange={(e) =>
                      setData((s: any) => ({
                        ...s,
                        status: e.target.value,
                      }))
                    }
                    className="w-full h-10 px-3 border rounded-md"
                  >
                    <option value="draft">Draft</option>
                    <option value="pending">Pending</option>
                    <option value="won">Won</option>
                    <option value="lost">Lost</option>
                  </select>
                </div>

              </div>
            </div>
          </div>

          {/* ================= RE-ISSUE ================= */}
          {validityState === "expired" && (
            <div className="mt-6 p-4 border border-red-300 bg-red-50 rounded-lg">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={reissue}
                  onChange={(e) => setReissue(e.target.checked)}
                  className="mt-1"
                />
                <div>
                  <div className="font-semibold text-red-800">
                    Re-Issue quotation
                  </div>
                  <div className="text-sm text-red-700">
                    A new quotation will be created with a fresh validity period.
                    The current quotation will remain unchanged.
                  </div>
                </div>
              </label>

              {reissue && (
                <div className="mt-3">
                  <label
                    htmlFor="reissue-validity-days"
                    className="block text-sm font-medium text-gray-700"
                  >
                    New validity (days)
                  </label>

                  <input
                    id="reissue-validity-days"
                    type="number"
                    min={1}
                    value={newValidityDays}
                    onChange={(e) =>
                      setNewValidityDays(Number(e.target.value))
                    }
                    className="mt-1 w-32 p-2 border rounded-md"
                  />
                </div>
              )}

            </div>
          )}

          {/* Items table */}
          <div className="mt-10 mb-8">
            <h2 className="text-lg font-semibold mb-3">Items</h2>
            <table className="w-full border rounded-lg overflow-hidden">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-2 text-left">Product</th>
                  <th className="p-2 text-left">HSN</th>
                  
                  <th className="p-2 text-left">Qty</th>
                  <th className="p-2 text-left">Unit Price</th>
                  <th className="p-2 text-left">Discount %</th>
                  <th className="p-2 text-left">UOM</th>
                  <th className="p-2 text-left">Tax %</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {(data.items || []).map((item: any, idx: number) => {


                  return (
                    <tr key={idx} className="border-b align-top">

                      {/* PRODUCT */}
                      <td className="p-2 align-top">
                        <label htmlFor={`item-product-${idx}`} className="sr-only">
                          Product
                        </label>

                        <div className="relative space-y-2">

                          {/* PRODUCT SEARCH */}
                          <input
                            type="text"
                            value={
                              activeProductRow === idx
                                ? productSearch
                                : item.name || ""
                            }
                            placeholder="Search product..."
                            className="w-full px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-200"
                            onFocus={() => {
                              setActiveProductRow(idx);
                              setProductSearch(item.name || "");
                            }}
                            onChange={(e) => {
                              setProductSearch(e.target.value);
                              updateItem(idx, {
                                name: e.target.value,
                                product_id: null,
                              });
                            }}
                            onBlur={() =>
                              setTimeout(() => setActiveProductRow(null), 200)
                            }
                          />

                          {/* PRODUCT DESCRIPTION */}
                          <textarea
                            className="w-full px-3 py-2 border rounded-md text-sm bg-gray-50"
                            placeholder="Product description"
                            rows={2}
                            value={item.description || ""}
                            onChange={(e) =>
                              updateItem(idx, { description: e.target.value })
                            }
                          />

                          {/* PRODUCT DROPDOWN */}
                          {activeProductRow === idx && (
                            <div className="absolute z-40 top-[42px] w-full bg-white border border-gray-200 rounded-xl shadow-2xl max-h-80 overflow-y-auto">

                              {productList
                                .filter((p) =>
                                  p.name.toLowerCase().includes(productSearch.toLowerCase())
                                )
                                .map((p) => (
                                  <div
                                    key={p.id}
                                    className="px-4 py-3 cursor-pointer hover:bg-blue-50 transition border-b last:border-b-0"
                                    onMouseDown={() => {
                                      updateItem(idx, {
                                        product_id: p.id,
                                        name: p.name,
                                        description: p.description ?? "",
                                        unit_price: p.unit_price,
                                        tax_rate: p.tax_rate,
                                        uom: p.uom,
                                        qty: item.qty || 1,
                                        // ✅ Include all product details
                                        hsn_code: p.hsn_code ?? "",
                                        
                                      });

                                      setProductSearch(p.name);
                                      setActiveProductRow(null);
                                    }}
                                  >
                                    <div className="font-semibold text-sm text-gray-800">
                                      {p.name}
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">
                                      ₹{p.unit_price} · {p.uom} · {p.tax_rate}% GST
                                    </div>
                                    {p.description && (
                                      <div className="text-xs text-gray-400 mt-1 line-clamp-2">
                                        {p.description}
                                      </div>
                                    )}
                                  </div>
                                ))}

                              {productList.filter((p) =>
                                p.name.toLowerCase().includes(productSearch.toLowerCase())
                              ).length === 0 && (
                                  <div className="px-4 py-3 text-sm text-gray-500">
                                    No product found — type to add custom
                                  </div>
                                )}

                              <div
                                className="px-4 py-3 text-sm text-blue-600 cursor-pointer hover:bg-blue-50 border-t font-medium"
                                onMouseDown={() => {
                                  // Save the current row index BEFORE clearing activeProductRow
                                  setSelectedProductRowForModal(idx);
                                  // Pre-fill product name from search
                                  setProductForm({
                                    name: productSearch.trim() || "",
                                    unit_price: "",
                                    tax_rate: "",
                                    uom: "NOS",
                                    description: "",
                                    
                                  });
                                  setAddProductOpen(true);
                                  setActiveProductRow(null);
                                  // Clear search after opening modal
                                  setTimeout(() => setProductSearch(""), 100);
                                }}
                              >
                                ✨ Create New Product
                              </div>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* HSN CODE */}
                      <td className="p-2">
                        <input
                          type="text"
                          placeholder="HSN (optional)"
                          className="p-2 border rounded-md w-full text-sm"
                          value={item.hsn_code || ""}
                          onChange={(e) =>
                            updateItem(idx, { hsn_code: e.target.value })
                          }
                        />
                      </td>


                      {/* QTY */}
                      <td className="p-2">
                        <label htmlFor={`item-qty-${idx}`} className="sr-only">
                          Quantity
                        </label>
                        <input
                          id={`item-qty-${idx}`}
                          type="number"
                          className="p-2 border rounded-md w-full"
                          value={item.qty ?? 0}
                          onChange={(e) => {
                            const v = e.target.value;
                            updateItem(idx, { qty: v === "" ? "" : Number(v) });
                          }}
                        />
                      </td>

                      {/* UNIT PRICE */}
                      <td className="p-2">
                        <label htmlFor={`item-price-${idx}`} className="sr-only">
                          Unit price
                        </label>
                        <input
                          id={`item-price-${idx}`}
                          type="number"
                          className="p-2 border rounded-md w-full"
                          value={item.unit_price ?? 0}
                          onChange={(e) => {
                            const v = e.target.value;
                            updateItem(idx, { unit_price: v === "" ? "" : Number(v) });
                          }}
                        />
                      </td>

                      {/* DISCOUNT */}
                      <td className="p-2">
                        <label className="sr-only">Discount</label>
                        <input
                          type="number"
                          aria-label="Discount percent"
                          min={0}
                          max={100}
                          className="p-2 border rounded-md w-full"
                          value={item.discount_percent ?? 0}
                          onChange={(e) => {
                            const v = e.target.value;
                            updateItem(idx, {
                              discount_percent: v === "" ? "" : Number(v),
                            });
                          }}
                        />
                      </td>

                      {/* UOM */}
                      <td className="p-2">
                        <label htmlFor={`item-uom-${idx}`} className="sr-only">
                          UOM
                        </label>
                        <input
                          id={`item-uom-${idx}`}
                          className="p-2 border rounded-md w-full"
                          value={item.uom || ""}
                          onChange={(e) =>
                            updateItem(idx, { uom: e.target.value })
                          }
                        />
                      </td>

                      {/* TAX */}
                      <td className="p-2">
                        <label htmlFor={`item-tax-${idx}`} className="sr-only">
                          Tax percent
                        </label>
                        <input
                          id={`item-tax-${idx}`}
                          type="number"
                          className="p-2 border rounded-md w-full"
                          value={item.tax_rate ?? 0}
                          onChange={(e) => {
                            const v = e.target.value;
                            updateItem(idx, { tax_rate: v === "" ? "" : Number(v) });
                          }}
                        />
                      </td>

                      {/* REMOVE */}
                      <td className="p-2">
                        <button
                          onClick={() => removeItem(idx)}
                          className="text-red-500"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}

                <tr>
                  <td colSpan={8} className="p-3">
                    <button
                      onClick={addItem}
                      className="px-4 py-2 bg-gray-100 rounded-md"
                    >
                      + Add Item
                    </button>
                  </td>
                </tr>
              </tbody>

            </table>
          </div>

          {/* PAYMENT TERMS */}
          <div className="mt-10">
            <label className="block text-sm font-medium text-gray-700">
              Payment Terms
            </label>

            <input
              type="text"
              value={data.payment_terms || ""}
              onChange={(e) =>
                setData((s: any) => ({
                  ...s,
                  payment_terms: e.target.value,
                }))
              }
              placeholder="e.g. Net 30 / 100% Advance / 30 days from invoice date"
              className="mt-1 w-full p-2 border rounded-md"
            />

            <p className="text-xs text-gray-400 mt-1">
              This will appear on the quotation and PDF.
            </p>
          </div>
          {/* Notes & Terms */}
          <div className="mt-10 grid grid-cols-2 gap-6">
            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700">Notes</label>
              <textarea id="notes" name="notes" className="mt-1 w-full p-3 border rounded-md min-h-[100px]" value={data.notes || ""} onChange={(e) => setData((s: any) => ({ ...s, notes: e.target.value }))} />
            </div>

            <div>
              <label htmlFor="terms" className="block text-sm font-medium text-gray-700">Terms</label>
              <textarea
                id="terms"
                name="terms"
                className={`mt-1 w-full p-3 border rounded-md min-h-[100px] ${!isTermsEditable ? "bg-gray-100 cursor-not-allowed" : ""
                  }`}
                value={data.terms || ""}
                disabled={!isTermsEditable}
                onChange={(e) =>
                  setData((s: any) => ({ ...s, terms: e.target.value }))
                }
              />

              {isTermsEditable && defaultTerms && data.terms !== defaultTerms && (
                <div className="flex justify-end mt-1">
                  <button
                    type="button"
                    onClick={() =>
                      setData((s: any) => ({ ...s, terms: defaultTerms }))
                    }
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Reset to original terms
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Remarks (Visible in Print) */}
          <div className="mt-6">
            <label htmlFor="remarks" className="block text-sm font-medium text-gray-700">
              Remarks (Visible in quotation print)
            </label>
            <textarea
              id="remarks"
              name="remarks"
              className="mt-1 w-full p-3 border rounded-md min-h-[100px]"
              value={data.remarks || ""}
              onChange={(e) => setData((s: any) => ({ ...s, remarks: e.target.value }))}
              placeholder="e.g., Special instructions, additional conditions, or other remarks..."
            />
          </div>

          {/* Summary */}
          <div className="mt-10 flex justify-end">
            <div className="bg-gray-50 p-5 rounded-lg w-64">
              <p className="text-gray-600">Subtotal</p>
              <p className="text-lg font-semibold">₹{subtotal.toLocaleString()}</p>
              <p className="text-gray-600">Discount</p>
              <p className="text-lg font-semibold text-red-600">
                − ₹{totalDiscount.toLocaleString()}
              </p>

              <p className="text-gray-600">Tax</p>
              <p className="text-lg font-semibold">₹{taxTotal.toLocaleString()}</p>
              <p className="text-gray-600">Total</p>
              <p className="text-xl font-bold">₹{grandTotal.toLocaleString()}</p>

              <button
                onClick={() => handleSave("draft")}
                disabled={saving}
                className="px-5 py-2 rounded-md border border-gray-300 bg-white text-sm"
              >
                Save as Draft
              </button>

              <button
                onClick={() => handleSave("final")}
                disabled={saving}
                className="w-full mt-4 py-2 bg-blue-700 text-white rounded-md"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ================= ADD CUSTOMER MODAL (HERE) ================= */}

      {addProductOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto">
          <div className="absolute inset-0 bg-black/50" onClick={() => setAddProductOpen(false)} />

       <div className="relative bg-white rounded-xl shadow-2xl
                w-full max-w-2xl
                p-8
                max-h-[90vh]
                overflow-y-auto">
  
            <button
              onClick={() => setAddProductOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-2xl leading-none"
              title="Close"
            >
              ×
            </button>

            <h2 className="text-2xl font-bold mb-6 text-gray-900">Add New Product</h2>
           
            <form onSubmit={(e) => { e.preventDefault(); submitProductFromQuotation(); }} className="space-y-5">
              
              {/* Product Name */}
              <div>
                <label htmlFor="product-name" className="block text-sm font-semibold text-gray-700 mb-2">
                  Product Name <span className="text-red-500 font-bold">*</span>
                </label>
                <input
                  id="product-name"
                  type="text"
                  className="w-full border-2 border-gray-300 px-4 py-3 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition"
                  placeholder="Enter product name (required)"
                  value={productForm.name}
                  onChange={(e) => {
                    console.log("[ProductForm] Name changed to:", e.target.value);
                    setProductForm({ ...productForm, name: e.target.value });
                  }}
                  autoFocus
                  disabled={productSubmitting}
                />
                {!productForm.name.trim() && productForm.name !== "" && (
                  <p className="text-xs text-red-500 mt-1">Product name cannot be empty</p>
                )}
              </div>

              {/* Description */}
              <div>
                <label htmlFor="product-desc" className="block text-sm font-semibold text-gray-700 mb-2">
                  Description <span className="text-xs text-gray-500">(Optional)</span>
                </label>
                <textarea
                  id="product-desc"
                  className="w-full border-2 border-gray-300 px-4 py-3 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition resize-none"
                  placeholder="Enter product description (optional)"
                  rows={3}
                  value={productForm.description}
                  onChange={(e) => {
                    console.log("[ProductForm] Description changed");
                    setProductForm({ ...productForm, description: e.target.value });
                  }}
                  disabled={productSubmitting}
                />
              </div>

              {/* Two Column: Unit Price and UOM */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="unit-price" className="block text-sm font-semibold text-gray-700 mb-2">
                    Unit Price <span className="text-xs text-gray-500">(₹)</span>
                  </label>
                  <input
                    id="unit-price"
                    type="number"
                    className="w-full border-2 border-gray-300 px-4 py-3 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition"
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    value={productForm.unit_price}
                    onChange={(e) => {
                      console.log("[ProductForm] Unit price changed to:", e.target.value);
                      setProductForm({ ...productForm, unit_price: e.target.value });
                    }}
                    disabled={productSubmitting}
                  />
                </div>

                <div>
                  <label htmlFor="unit-meas" className="block text-sm font-semibold text-gray-700 mb-2">
                    Unit of Measurement
                  </label>
                  <select
                    id="unit-meas"
                    className="w-full border-2 border-gray-300 px-4 py-3 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition cursor-pointer bg-white"
                    value={productForm.uom}
                    onChange={(e) => {
                      console.log("[ProductForm] UOM changed to:", e.target.value);
                      setProductForm({ ...productForm, uom: e.target.value });
                    }}
                    disabled={productSubmitting}
                  >
                    <option value="NOS">NOS (Number)</option>
                    <option value="SET">SET (Set)</option>
                    <option value="HR">HR (Hour)</option>
                    <option value="KG">KG (Kilogram)</option>
                    <option value="LTR">LTR (Liter)</option>
                    <option value="MTR">MTR (Meter)</option>
                    <option value="BOX">BOX (Box)</option>
                    <option value="PCE">PCE (Piece)</option>
                  </select>
                </div>
              </div>

              {/* Tax Rate */}
              <div>
                <label htmlFor="tax-rate" className="block text-sm font-semibold text-gray-700 mb-2">
                  Tax Rate <span className="text-xs text-gray-500">(%)</span>
                </label>
                <input
                  id="tax-rate"
                  type="number"
                  className="w-full border-2 border-gray-300 px-4 py-3 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition"
                  placeholder="0"
                  step="0.01"
                  min="0"
                  max="100"
                  value={productForm.tax_rate}
                  onChange={(e) => {
                    console.log("[ProductForm] Tax rate changed to:", e.target.value);
                    setProductForm({ ...productForm, tax_rate: e.target.value });
                  }}
                  disabled={productSubmitting}
                />
              </div>

             
              {/* Action Buttons */}
              <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setAddProductOpen(false)}
                  disabled={productSubmitting}
                  className="px-6 py-3 border-2 border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={productSubmitting || !productForm.name.trim()}
                  className="px-8 py-3 bg-rose-500 text-white rounded-lg hover:bg-rose-600 disabled:opacity-50 disabled:cursor-not-allowed transition font-semibold flex items-center gap-2"
                >
                  {productSubmitting ? (
                    <>
                      <span className="inline-block animate-spin">⏳</span>
                      Saving...
                    </>
                  ) : (
                    <>
                      <span>✓</span>
                      Save Product
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Version Comment Modal */}
      <VersionCommentModal
        isOpen={versionCommentModalOpen}
        oldVersion={originalVersion}
        newVersion={(() => {
          function bumpVersion(version: string) {
            const v = parseFloat(version);
            if (isNaN(v)) return '0.1';
            return (Math.round((v + 0.1) * 10) / 10).toFixed(1);
          }
          return bumpVersion(originalVersion);
        })()}
        onConfirm={handleVersionCommentSubmit}
        onCancel={() => {
          setVersionCommentModalOpen(false);
          setPendingSavePayload(null);
        }}
        isLoading={saving}
      />
    </Layout>
  );
}

