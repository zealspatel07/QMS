import { useEffect, useState, useCallback } from "react";
import toast from "react-hot-toast";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api";
import Layout from "../components/layout/Layout";
import CreatableSelect from "react-select/creatable";
import { Package } from "lucide-react";

type Vendor = {
    id: number;
    name: string;
    gst?: string;
    gst_number?: string;
    phone?: string;
    city?: string;
    email?: string;
    address?: string;
    state?: string;
    gst_verified?: number;
};

export default function EditPO() {

    const { id } = useParams();
    const navigate = useNavigate();

    // Generate unique temporary ID for new items
    const generateTempId = () => `_temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Document Header Fields
    const [poNumber, setPoNumber] = useState("");
    const [orderDate, setOrderDate] = useState("");
    const [vendorQuoteNo, setVendorQuoteNo] = useState("");
    const [vendorQuoteDate, setVendorQuoteDate] = useState("");
    const [deliveryDate, setDeliveryDate] = useState("");
    const [paymentTerms, setPaymentTerms] = useState("");
    const [remarks, setRemarks] = useState("");

    // Procurement Items
    const [items, setItems] = useState<any[]>([]);
    const [vendors, setVendors] = useState<any[]>([]);
    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Product Management
    const [showProductModal, setShowProductModal] = useState(false);
    const [productCreating, setProductCreating] = useState(false);
    const [currentProductRowIndex, setCurrentProductRowIndex] = useState<number | null>(null);
    const [productSearchInput, setProductSearchInput] = useState<Record<number, string>>({});
    const [showProductDropdown, setShowProductDropdown] = useState<Record<number, boolean>>({});
    const [newProduct, setNewProduct] = useState({
        name: "",
        description: "",
        hsn_code: "",
        uom: "NOS",
        unit_price: "",
        tax_rate: 18
    });

    const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
    const [vendorGST, setVendorGST] = useState("");
    const [vendorPhone, setVendorPhone] = useState("");
    const [vendorCity, setVendorCity] = useState("");
    const [vendorEmail, setVendorEmail] = useState("");
    const [vendorAddress, setVendorAddress] = useState("");

    useEffect(() => {
        fetchPO();
        fetchVendors();
        fetchProducts();
    }, []);

    // ---------------- FETCH ----------------

    const fetchPO = async () => {
        const res = await api.getPurchaseOrder(id!);
        
        console.log("[EditPO] Fetched PO:", res);
        
        // Set document header fields
        setPoNumber(res.po_number || "");
        setOrderDate(res.order_date ? res.order_date.split("T")[0] : "");
        setVendorQuoteNo(res.vendor_quote_no || "");
        setVendorQuoteDate(res.vendor_quote_date ? res.vendor_quote_date.split("T")[0] : "");
        setDeliveryDate(res.delivery_date ? res.delivery_date.split("T")[0] : "");
        setPaymentTerms(res.payment_terms || "");
        setRemarks(res.remarks || "");
        
        // Set items - ensure each item has either an id or a _tempId for React key
        const itemsWithKeys = (res.items || []).map((item: any) => ({
            ...item,
            _tempId: item._tempId || (item.id ? null : generateTempId())
        }));
        
        console.log("[EditPO] Loaded items:", itemsWithKeys);

        const firstVid = itemsWithKeys.find((item: any) => item.vendor_id)?.vendor_id ?? null;
        const normalizedItems = firstVid != null
            ? itemsWithKeys.map((item: any) => ({ ...item, vendor_id: firstVid }))
            : itemsWithKeys;
        setItems(normalizedItems);

        if (firstVid != null) {
            try {
                const row = await api.getVendor(Number(firstVid));
                if (row?.id) {
                    const v: Vendor = {
                        id: row.id,
                        name: row.name || "",
                        gst: row.gst,
                        gst_number: row.gst_number,
                        phone: row.phone,
                        city: row.city,
                        email: row.email,
                        address: row.address,
                        state: row.state,
                        gst_verified: row.gst_verified
                    };
                    setSelectedVendor(v);
                    setVendorGST(String(v.gst_number || v.gst || ""));
                    setVendorPhone(v.phone || "");
                    setVendorCity(v.city || "");
                    setVendorEmail(v.email || "");
                    setVendorAddress(v.address || "");
                }
            } catch (err) {
                console.error("[EditPO] Failed to load vendor", err);
            }
        } else {
            setSelectedVendor(null);
            setVendorGST("");
            setVendorPhone("");
            setVendorCity("");
            setVendorEmail("");
            setVendorAddress("");
        }

        setLoading(false);
    };

    const fetchVendors = async () => {
        const res = await api.getVendors();
        setVendors(Array.isArray(res) ? res : (res as any).vendors || []);
    };

    const applyPoVendor = useCallback(async (vendorId: number | null) => {
        if (vendorId == null || Number.isNaN(Number(vendorId))) {
            setSelectedVendor(null);
            setVendorGST("");
            setVendorPhone("");
            setVendorCity("");
            setVendorEmail("");
            setVendorAddress("");
            setItems(prev => prev.map(i => ({ ...i, vendor_id: null })));
            return;
        }
        const id = Number(vendorId);
        try {
            const row = await api.getVendor(id);
            if (!row?.id) throw new Error("Invalid vendor");
            const vendor: Vendor = {
                id: row.id,
                name: row.name || "",
                gst: row.gst,
                gst_number: row.gst_number,
                phone: row.phone,
                city: row.city,
                email: row.email,
                address: row.address,
                state: row.state,
                gst_verified: row.gst_verified
            };
            setSelectedVendor(vendor);
            setVendorGST(String(vendor.gst_number || vendor.gst || ""));
            setVendorPhone(vendor.phone || "");
            setVendorCity(vendor.city || "");
            setVendorEmail(vendor.email || "");
            setVendorAddress(vendor.address || "");
            setItems(prev => prev.map(i => ({ ...i, vendor_id: id })));
        } catch (err) {
            console.error(err);
            const v = vendors.find(x => x.id === id);
            if (v) {
                setSelectedVendor(v);
                setVendorGST(v.gst_number || v.gst || "");
                setVendorPhone(v.phone || "");
                setVendorCity(v.city || "");
                setVendorEmail(v.email || "");
                setVendorAddress(v.address || "");
                setItems(prev => prev.map(i => ({ ...i, vendor_id: id })));
            } else {
                toast.error("Could not load vendor details");
            }
        }
    }, [vendors]);

    const fetchProducts = async () => {
        try {
            const res = await api.getProducts();
            setProducts(Array.isArray(res) ? res : res.products || []);
        } catch (err) {
            console.error("Failed to fetch products", err);
        }
    };

    async function createProduct() {
        if (!newProduct.name.trim()) {
            toast.error("Product name is required");
            return;
        }

        setProductCreating(true);
        try {
            const created = await api.addProduct({
                name: newProduct.name,
                description: newProduct.description || "",
                hsn_code: newProduct.hsn_code || "",
                uom: newProduct.uom || "NOS",
                unit_price: newProduct.unit_price ? Number(newProduct.unit_price) : 0,
                tax_rate: newProduct.tax_rate ? Number(newProduct.tax_rate) : 18
            });

            console.log("[EditPO] Product created:", created);

            // Extract product from response (API wraps it in { success: true, product: {...} })
            const productData = created.product || created;

            // Auto-fill in the PO row if we came from product creation
            if (currentProductRowIndex !== null) {
                const updated = [...items];
                updated[currentProductRowIndex].product_id = productData.id;
                updated[currentProductRowIndex].product_name = productData.name;
                updated[currentProductRowIndex].product_description = productData.description || "";
                updated[currentProductRowIndex].hsn_code = productData.hsn_code || "";
                updated[currentProductRowIndex].uom = productData.uom || "NOS";
                updated[currentProductRowIndex].tax_rate = productData.tax_rate || 18;
                setItems(updated);
                
                // Update search input to show product name in field
                setProductSearchInput(prev => ({
                    ...prev,
                    [currentProductRowIndex]: productData.name
                }));

                // Close the dropdown after product is created
                setShowProductDropdown(prev => ({
                    ...prev,
                    [currentProductRowIndex]: false
                }));
                
                console.log("[EditPO] Auto-filled row", currentProductRowIndex, "with product:", productData.name);
            }

            // Reset modal
            setNewProduct({
                name: "",
                description: "",
                hsn_code: "",
                uom: "NOS",
                unit_price: "",
                tax_rate: 18
            });
            setCurrentProductRowIndex(null);
            setShowProductModal(false);

            toast.success("Product created successfully!");
        } catch (err) {
            console.error("Product creation error:", err);
            toast.error("Failed to create product");
        } finally {
            setProductCreating(false);
        }
    }

    // ---------------- HANDLERS ----------------

    const updateQty = (index: number, value: number) => {
        const updated = [...items];
        updated[index].ordered_qty = value;
        setItems(updated);
    };

    function hasVendorDetailChanged() {
        if (!selectedVendor) return false;
        const original = vendors.find(v => v.id === selectedVendor.id);
        if (!original) return false;
        return (
            vendorPhone !== (original.phone || "") ||
            vendorEmail !== (original.email || "") ||
            vendorCity !== (original.city || "") ||
            vendorAddress !== (original.address || "") ||
            vendorGST !== (original.gst || original.gst_number || "")
        );
    }

    const updatePrice = (index: number, price: number) => {
        const updated = [...items];
        updated[index].unit_price = price;
        setItems(updated);
    };



    const removeItem = (index: number) => {
        const updated = [...items];
        updated.splice(index, 1);
        setItems(updated);
    };

    // ---------------- SAVE ----------------

    const handleSave = async () => {
        try {
            if (!selectedVendor?.id) {
                toast.error("Please select a vendor for this purchase order");
                return;
            }
            if (!vendorGST?.trim()) {
                toast.error("Vendor GST number is required");
                return;
            }

            if (selectedVendor.id) {
                const originalVendor = vendors.find(v => v.id === selectedVendor.id);
                const vendorChanges: Record<string, string> = {};
                if (vendorPhone !== (originalVendor?.phone || "")) vendorChanges.phone = vendorPhone;
                if (vendorEmail !== (originalVendor?.email || "")) vendorChanges.email = vendorEmail;
                if (vendorCity !== (originalVendor?.city || "")) vendorChanges.city = vendorCity;
                if (vendorAddress !== (originalVendor?.address || "")) vendorChanges.address = vendorAddress;
                if (vendorGST !== (originalVendor?.gst || originalVendor?.gst_number || "")) {
                    vendorChanges.gst_number = vendorGST;
                }
                if (Object.keys(vendorChanges).length > 0) {
                    try {
                        await api.updateVendor(selectedVendor.id, vendorChanges);
                    } catch (err) {
                        console.error("Failed to update vendor master", err);
                    }
                }
            }

            const vid = selectedVendor.id;
            const updatedItems = items.map(i => ({ ...i, vendor_id: vid }));

            const payload = {
                vendorQuoteNo: vendorQuoteNo,
                vendorQuoteDate: vendorQuoteDate,
                deliveryDate: deliveryDate,
                paymentTerms: paymentTerms,
                remarks: remarks,
                
                items: updatedItems.map(i => ({
                    id: i.id || null,
                    indent_item_id: i.indent_item_id || null,
                    product_id: i.product_id || null,
                    product_name: i.product_name || "",
                    product_description: i.product_description || "",
                    uom: i.uom || "NOS",
                    hsn_code: i.hsn_code || "",
                    quantity: Number(i.ordered_qty || 0),
                    vendor_id: vid,
                    unit_price: Number(i.unit_price || 0)
                }))
            };

            console.log("[EditPO] Save payload:", JSON.stringify(payload, null, 2));

            const res = await api.updatePurchaseOrder(id!, payload);
            console.log("[EditPO] Save response:", res);
            toast.success("✓ PO Updated Successfully");
            navigate(`/purchase-orders/${id}`);
        } catch (err: any) {
            console.error("[EditPO] Save error:", err);
            toast.error(err?.message || "Failed to save changes");
        }
    };

    if (loading) return <Layout>Loading...</Layout>;

    return (
        <Layout>
            <div className="p-6 w-full mx-auto">

                <h2 className="text-2xl font-bold mb-6">
                    Edit Purchase Order
                </h2>

                {/* ====== DOCUMENT HEADER SECTION ====== */}
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 mb-6">
                    <h3 className="text-lg font-semibold mb-4 text-slate-800">Document Header</h3>
                    
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        {/* PO Number */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">PO Number</label>
                            <input
                                type="text"
                                value={poNumber}
                                disabled
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed"
                                placeholder="PO Number"
                            />
                        </div>

                        {/* PO Date */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">PO Date</label>
                            <input
                                type="date"
                                value={orderDate}
                                disabled
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed"
                            />
                        </div>

                        {/* Vendor Quotation No */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Vendor Quotation No</label>
                            <input
                                type="text"
                                value={vendorQuoteNo}
                                onChange={(e) => setVendorQuoteNo(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Enter Vendor Quote No"
                            />
                        </div>

                        {/* Vendor Quote Date */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Vendor Quote Date</label>
                            <div className="relative">
                                <input
                                    type="date"
                                    value={vendorQuoteDate}
                                    onChange={(e) => setVendorQuoteDate(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
                                    placeholder="dd-mm-yyyy"
                                />
                                <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none">
                                    📅
                                </span>
                            </div>
                        </div>

                        {/* Delivery Date */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Delivery Date</label>
                            <div className="relative">
                                <input
                                    type="date"
                                    value={deliveryDate}
                                    onChange={(e) => setDeliveryDate(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
                                    placeholder="dd-mm-yyyy"
                                />
                                <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none">
                                    📅
                                </span>
                            </div>
                        </div>

                        {/* Payment Terms */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Payment Terms</label>
                            <CreatableSelect
                                value={
                                    paymentTerms
                                        ? { value: paymentTerms, label: paymentTerms }
                                        : null
                                }
                                onChange={(selected: any) => {
                                    if (selected) {
                                        setPaymentTerms(selected.value || selected.label);
                                    } else {
                                        setPaymentTerms("");
                                    }
                                }}
                                options={[
                                    { value: "Advance", label: "Advance" },
                                    { value: "30 Days", label: "30 Days" },
                                    { value: "60 Days", label: "60 Days" },
                                    { value: "90 Days", label: "90 Days" },
                                    { value: "Net 30", label: "Net 30" },
                                    { value: "Net 60", label: "Net 60" }
                                ]}
                                placeholder="Select or type payment terms..."
                                isSearchable
                                isClearable
                                formatCreateLabel={(inputValue) => `Use "${inputValue}" as payment term`}
                                isValidNewOption={(inputValue) =>
                                    inputValue.trim().length > 0
                                }
                                styles={{
                                    control: (base, state) => ({
                                        ...base,
                                        borderColor: state.isFocused ? "#3b82f6" : "#cbd5e1",
                                        boxShadow: state.isFocused ? "0 0 0 3px rgba(59, 130, 246, 0.1)" : "none",
                                        minHeight: "40px"
                                    }),
                                    option: (base, state) => ({
                                        ...base,
                                        backgroundColor: state.isSelected ? "#3b82f6" : state.isFocused ? "#dbeafe" : "white",
                                        color: state.isSelected ? "white" : "#1f2937"
                                    })
                                }}
                            />
                        </div>
                    </div>

                    {/* Remarks */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Remarks</label>
                        <textarea
                            value={remarks}
                            onChange={(e) => setRemarks(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Any notes..."
                            rows={3}
                        />
                    </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-6 mb-6">
                    <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2 mb-4">
                        <Package size={20} className="text-emerald-600" />
                        Vendor
                    </h2>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Supplier</label>
                    <CreatableSelect
                        value={
                            selectedVendor
                                ? { value: selectedVendor.id, label: selectedVendor.name }
                                : null
                        }
                        onChange={(selected: any) => {
                            if (!selected) {
                                void applyPoVendor(null);
                                return;
                            }
                            if (selected.__isNew__) {
                                toast.error("Create new vendors from the Create PO screen");
                                return;
                            }
                            void applyPoVendor(selected.value);
                        }}
                        options={vendors.map(v => ({ value: v.id, label: v.name }))}
                        placeholder="Search or select vendor"
                        isSearchable
                        isClearable
                        isValidNewOption={() => false}
                        menuPortalTarget={document.body}
                        menuPosition="fixed"
                        styles={{
                            container: (base) => ({ ...base, width: "100%", maxWidth: "480px" }),
                            control: (base, state) => ({
                                ...base,
                                minHeight: "42px",
                                borderRadius: "8px",
                                borderColor: selectedVendor ? "#cbd5e1" : "#f87171",
                                boxShadow: state.isFocused ? "0 0 0 2px #3b82f6" : "none",
                                fontSize: "14px"
                            }),
                            menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                            menu: (base) => ({ ...base, zIndex: 9999 })
                        }}
                    />

                    <div className="mt-6 border-t border-slate-100 pt-6">
                        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                            <h3 className="text-base font-semibold text-slate-800">Vendor details</h3>
                            {hasVendorDetailChanged() && (
                                <span className="text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded font-medium">
                                    Changes will sync to vendor master on save
                                </span>
                            )}
                        </div>

                        {selectedVendor && !vendorGST?.trim() && (
                            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
                                GST number is required before saving.
                            </div>
                        )}

                        {selectedVendor ? (
                            <div className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Supplier GST</label>
                                        <input
                                            type="text"
                                            value={vendorGST}
                                            onChange={(e) => {
                                                setVendorGST(e.target.value);
                                                setSelectedVendor({ ...selectedVendor, gst: e.target.value });
                                            }}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Phone</label>
                                        <input
                                            type="text"
                                            value={vendorPhone}
                                            onChange={(e) => {
                                                setVendorPhone(e.target.value);
                                                setSelectedVendor({ ...selectedVendor, phone: e.target.value });
                                            }}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1.5">City</label>
                                        <input
                                            type="text"
                                            value={vendorCity}
                                            onChange={(e) => {
                                                setVendorCity(e.target.value);
                                                setSelectedVendor({ ...selectedVendor, city: e.target.value });
                                            }}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
                                        <input
                                            type="email"
                                            value={vendorEmail}
                                            onChange={(e) => {
                                                setVendorEmail(e.target.value);
                                                setSelectedVendor({ ...selectedVendor, email: e.target.value });
                                            }}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Address</label>
                                    <textarea
                                        value={vendorAddress}
                                        onChange={(e) => {
                                            setVendorAddress(e.target.value);
                                            setSelectedVendor({ ...selectedVendor, address: e.target.value });
                                        }}
                                        rows={2}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="p-6 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-center text-sm">
                                Select a supplier to load details from the vendor master.
                            </div>
                        )}
                    </div>
                </div>

                {/* TABLE */}
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">

                    <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
                        <h3 className="font-semibold">Material Procurement Table</h3>
                        <div className="flex gap-3 items-center">
                            <button
                                onClick={() => {
                                    setItems(prev => [
                                        ...prev,
                                        {
                                            id: null,
                                            product_id: null,
                                            indent_item_id: null,
                                            product_name: "",
                                            product_description: "",
                                            hsn_code: "",
                                            uom: "NOS",
                                            ordered_qty: 1,
                                            vendor_id: selectedVendor?.id ?? null,
                                            unit_price: 0,
                                            tax_rate: 18
                                        }
                                    ]);
                                }}
                                className="bg-blue-600 text-white px-4 py-2 rounded text-sm"
                            >
                                + Add Item
                            </button>
                            <span className="text-xs text-gray-500">
                                Set unit pricing per line; vendor applies to all lines
                            </span>
                        </div>
                    </div>

                    <table className="w-full text-sm">

                        <thead className="bg-slate-100 text-xs uppercase">
                            <tr>
                                <th className="p-3 text-left">Product</th>
                                <th className="p-3 text-center">Qty</th>
                                <th className="p-3 text-right">Unit Price</th>
                                <th className="p-3 text-right">Amount</th>
                                <th className="p-3 text-center">Status</th>
                                <th className="p-3 text-center">Action</th>
                            </tr>
                        </thead>

                        <tbody>

                            {items.map((i, index) => {

                                const amount = (i.ordered_qty || 0) * (i.unit_price || 0);
                                const ready = selectedVendor?.id && i.unit_price;

                                return (
                                    <tr key={i.id || i._tempId} className="border-t hover:bg-slate-50">

                                        <td className="p-3">
                                            <div 
                                                className="flex flex-col gap-2" 
                                                data-product-field 
                                                style={{ 
                                                    position: 'relative', 
                                                    zIndex: showProductModal ? -1 : 99999,
                                                    pointerEvents: showProductModal ? 'none' : 'auto',
                                                    display: showProductModal ? 'none' : 'flex',
                                                    transition: 'opacity 0.2s, pointer-events 0.2s'
                                                }}
                                            >
                                                {/* Product Search Input */}
                                                <div className="relative" style={{ position: 'relative', zIndex: 99999 }}>
                                                    <input
                                                        type="text"
                                                        placeholder="Search or select product"
                                                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                                                        value={productSearchInput[index] !== undefined ? productSearchInput[index] : (i.product_id ? i.product_name || "" : "")}
                                                        onChange={(e) => {
                                                            const newVal = e.target.value;
                                                            setProductSearchInput(prev => ({
                                                                ...prev,
                                                                [index]: newVal
                                                            }));
                                                        }}
                                                        onFocus={() => {
                                                            setShowProductDropdown(prev => ({
                                                                ...prev,
                                                                [index]: true
                                                            }));
                                                        }}
                                                    />
                                                    {i.product_id && (
                                                        <div className="absolute right-2 top-1/2 transform -translate-y-1/2 text-green-500">
                                                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                            </svg>
                                                        </div>
                                                    )}

                                                    {/* Product Dropdown */}
                                                    {showProductDropdown[index] && (
                                                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-2xl" style={{ maxHeight: '400px', overflowY: 'auto', zIndex: 99999, position: 'relative' }}>
                                                            {(() => {
                                                                const searchTerm = (productSearchInput[index] || i.product_name || "").toLowerCase();
                                                                const filtered = products.filter(p =>
                                                                    p.name.toLowerCase().includes(searchTerm)
                                                                );
                                                                const hasSearchInput = searchTerm.trim().length > 0;
                                                                const hasMatches = filtered.length > 0;

                                                                return (
                                                                    <>
                                                                        {filtered.length === 0 && !hasSearchInput && (
                                                                            <div className="px-4 py-3 text-sm text-gray-600 text-center">
                                                                                Start typing to search products...
                                                                            </div>
                                                                        )}
                                                                        {filtered.map(p => (
                                                                            <button
                                                                                key={p.id}
                                                                                type="button"
                                                                                className="w-full text-left px-4 py-2 hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-b-0"
                                                                                onClick={() => {
                                                                                    const updated = [...items];
                                                                                    updated[index].product_id = p.id;
                                                                                    updated[index].product_name = p.name;
                                                                                    updated[index].product_description = p.description || "";
                                                                                    updated[index].hsn_code = p.hsn_code || "";
                                                                                    updated[index].uom = p.uom || "NOS";
                                                                                    updated[index].tax_rate = p.tax_rate || 18;
                                                                                    setItems(updated);
                                                                                    setProductSearchInput(prev => ({
                                                                                        ...prev,
                                                                                        [index]: p.name
                                                                                    }));
                                                                                    setShowProductDropdown(prev => ({
                                                                                        ...prev,
                                                                                        [index]: false
                                                                                    }));
                                                                                }}
                                                                            >
                                                                                <div className="font-medium text-gray-900">{p.name}</div>
                                                                                {p.description && <div className="text-xs text-gray-600">📝 {p.description}</div>}
                                                                            </button>
                                                                        ))}
                                                                        {hasSearchInput && !hasMatches && (
                                                                            <button
                                                                                type="button"
                                                                                className="w-full text-left px-4 py-2 text-blue-600 hover:bg-blue-50 border-t border-gray-200 font-medium transition-colors bg-blue-50"
                                                                                onClick={() => {
                                                                                    setCurrentProductRowIndex(index);
                                                                                    setNewProduct(prev => ({
                                                                                        ...prev,
                                                                                        name: searchTerm.charAt(0).toUpperCase() + searchTerm.slice(1)
                                                                                    }));
                                                                                    setShowProductModal(true);
                                                                                    setShowProductDropdown(prev => ({
                                                                                        ...prev,
                                                                                        [index]: false
                                                                                    }));
                                                                                }}
                                                                            >
                                                                                + Create New Product: "{searchTerm}"
                                                                            </button>
                                                                        )}
                                                                    </>
                                                                );
                                                            })()}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Product Description */}
                                                <textarea
                                                    rows={2}
                                                    placeholder="Product description"
                                                    className="w-full px-3 py-2 text-xs border border-gray-200 rounded-md focus:ring-1 focus:ring-blue-500 bg-slate-50"
                                                    value={i.product_description || ""}
                                                    onChange={(e) => {
                                                        const updated = [...items];
                                                        updated[index].product_description = e.target.value;
                                                        setItems(updated);
                                                    }}
                                                />
                                            </div>
                                        </td>

                                        <td className="p-3 text-center">
                                            <input
                                                type="number"
                                                aria-label="Ordered quantity"
                                                value={i.ordered_qty}
                                                onChange={(e) => updateQty(index, Number(e.target.value))}
                                                className="border px-2 py-1 w-20 text-center rounded"
                                            />
                                        </td>

                                        <td className="p-3 text-right">
                                            <input
                                                type="number"
                                                aria-label="Unit price"
                                                value={i.unit_price || ""}
                                                onChange={(e) => updatePrice(index, Number(e.target.value))}
                                                className={`border px-2 py-1 w-24 text-right rounded ${!i.unit_price ? "border-red-400" : ""
                                                    }`}
                                            />
                                        </td>

                                        <td className="p-3 text-right font-semibold text-blue-600">
                                            ₹ {amount.toFixed(2)}
                                        </td>

                                        <td className="p-3 text-center">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${ready ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                                                }`}>
                                                {ready ? "Ready" : "Incomplete"}
                                            </span>
                                        </td>

                                        <td className="p-3 text-center">
                                            <button
                                                onClick={() => removeItem(index)}
                                                className="bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded text-sm"
                                            >
                                                Remove
                                            </button>
                                        </td>

                                    </tr>
                                );
                            })}

                        </tbody>

                    </table>

                </div>

                {/* ACTIONS */}
                <div className="flex justify-end gap-4 mt-6">

                    <button
                        onClick={() => navigate(-1)}
                        className="px-5 py-2 bg-gray-500 text-white rounded-lg"
                    >
                        Cancel
                    </button>

                    <button
                        onClick={handleSave}
                        className="px-6 py-2 bg-green-600 text-white rounded-lg"
                    >
                        Save Changes
                    </button>

                </div>

                {/* ====== CREATE PRODUCT MODAL ====== */}
                    {showProductModal && (
                        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4 backdrop-blur-sm">
                            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-8 max-h-[90vh] overflow-y-auto">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="p-3 bg-emerald-100 rounded-lg">
                                        <svg className="w-6 h-6 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-bold text-slate-900">Create New Product</h2>
                                        <p className="text-sm text-slate-600 mt-1">Add product to your catalog</p>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    {/* Product Name */}
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">Product Name *</label>
                                        <input
                                            type="text"
                                            placeholder="Enter product name"
                                            value={newProduct.name}
                                            onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                                            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition"
                                        />
                                    </div>

                                    {/* Description */}
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">Description</label>
                                        <textarea
                                            placeholder="Enter product description..."
                                            value={newProduct.description}
                                            onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                                            rows={3}
                                            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none resize-none transition"
                                        />
                                    </div>

                                    {/* Row 1: HSN Code */}
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">HSN Code</label>
                                        <input
                                            type="text"
                                            placeholder="Enter HSN code"
                                            value={newProduct.hsn_code}
                                            onChange={(e) => setNewProduct({ ...newProduct, hsn_code: e.target.value })}
                                            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition"
                                        />
                                    </div>

                                    {/* Row 2: UOM & Tax Rate */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-semibold text-slate-700 mb-2">Unit of Measure</label>
                                            <select
                                                aria-label="Unit of Measure"
                                                value={newProduct.uom}
                                                onChange={(e) => setNewProduct({ ...newProduct, uom: e.target.value })}
                                                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition"
                                            >
                                                <option value="NOS">Nos (Numbers)</option>
                                                <option value="KG">KG (Kilograms)</option>
                                                <option value="L">L (Liters)</option>
                                                <option value="M">M (Meters)</option>
                                                <option value="BOX">BOX</option>
                                                <option value="PACK">PACK</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-semibold text-slate-700 mb-2">Tax Rate (%)</label>
                                            <input
                                                type="number"
                                                placeholder="18"
                                                value={newProduct.tax_rate}
                                                onChange={(e) => setNewProduct({ ...newProduct, tax_rate: Number(e.target.value) })}
                                                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition"
                                            />
                                        </div>
                                    </div>

                                    {/* Info Box */}
                                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                        <p className="text-sm text-blue-800">
                                            <span className="font-semibold">💡 Note:</span> Fill minimum required fields. Other details can be updated later in Products section.
                                        </p>
                                    </div>
                                </div>

                                <div className="flex gap-3 mt-8 pt-6 border-t border-slate-200">
                                    <button
                                        onClick={() => {
                                            setShowProductModal(false);
                                            setNewProduct({
                                                name: "",
                                                description: "",
                                                hsn_code: "",
                                                uom: "NOS",
                                                unit_price: "",
                                                tax_rate: 18
                                            });
                                            setCurrentProductRowIndex(null);
                                        }}
                                        className="flex-1 px-4 py-2.5 text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors font-semibold"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={createProduct}
                                        disabled={productCreating || !newProduct.name.trim()}
                                        className="flex-1 px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {productCreating ? "Creating..." : "Create Product"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

            </div>
        </Layout>
    );
}
