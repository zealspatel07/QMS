//frontend/src/pages/CreatePO.tsx
import { useEffect, useState, useRef, useCallback } from "react";
import toast from "react-hot-toast";
import Layout from "../components/layout/Layout";
import CreatableSelect from "react-select/creatable";
import api from "../api";
import { useParams, useNavigate } from "react-router-dom";
import { FileText, DollarSign, Package } from "lucide-react";

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

export default function CreatePO() {

    const { indentId } = useParams<{ indentId: string }>();
    const navigate = useNavigate();

    const [indent, setIndent] = useState<any>(null);
    const [items, setItems] = useState<any[]>([]);
    const [vendors, setVendors] = useState<any[]>([]);

    const [products, setProducts] = useState<any[]>([]);

    const [poDate, setPoDate] = useState(
        new Date().toISOString().split("T")[0]
    );

    // For direct PO creation (without indent)


    const [vendorQuoteNo, setVendorQuoteNo] = useState("");
    const [vendorQuoteDate, setVendorQuoteDate] = useState("");
    const [deliveryDate, setDeliveryDate] = useState("");
    const [remarks, setRemarks] = useState("");

    // Vendor Creation Modal
    const [showVendorModal, setShowVendorModal] = useState(false);
    const [vendorCreating, setVendorCreating] = useState(false);
    const [newVendor, setNewVendor] = useState({
        name: "",
        contact_person: "",
        phone: "",
        email: "",
        gst_number: "",
        address: "",
        city: "",
        state: ""
    });

    // Product Creation Modal
    const [showProductModal, setShowProductModal] = useState(false);
    const [productCreating, setProductCreating] = useState(false);
    const [currentProductRowIndex, setCurrentProductRowIndex] = useState<number | null>(null);
    const [newProduct, setNewProduct] = useState({
        name: "",
        description: "",
        hsn_code: "",
        uom: "NOS",
        unit_price: "",
        tax_rate: 18,
    });

    // Enterprise Fields
    const [paymentTerms, setPaymentTerms] = useState("");
    const [vendorGST, setVendorGST] = useState("");
    const [vendorPhone, setVendorPhone] = useState("");
    const [vendorCity, setVendorCity] = useState("");
    const [vendorEmail, setVendorEmail] = useState("");
    const [vendorAddress, setVendorAddress] = useState("");
    const [taxRate] = useState(18);
    const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);

    // ✅ Product search states (like CreateIndent)
    const [productSearchInput, setProductSearchInput] = useState<Record<number, string>>({});
    const [showProductDropdown, setShowProductDropdown] = useState<Record<number, boolean>>({});

    const [terms, setTerms] = useState("");
    const indentVendorSyncedRef = useRef(false);

    // Date picker refs
    const vendorQuoteDateRef = useRef<HTMLInputElement>(null);
    const deliveryDateRef = useRef<HTMLInputElement>(null);

    const poDateRef = useRef<HTMLInputElement>(null);

    // ✅ Auto-focus first product input
    const firstInputRef = useRef<HTMLInputElement>(null);

    const subtotal = items.reduce(
        (sum, i) => sum + (i.quantity * (i.unit_price || 0)),
        0
    )

    const igst = subtotal * (taxRate / 100);
    const total = subtotal + igst;



    useEffect(() => {
        fetchVendors();
        fetchPOTerms();
        fetchProducts();

        if (indentId) {
            fetchIndent();
            fetchIndentItems();
        } else {
            // ✅ FIX: Initialize with 1 empty row
            setItems([
                {
                    id: Date.now(),
                    product_id: null,
                    product_name: "",
                    product_description: "",
                    quantity: 1,
                    vendor_id: "",
                    unit_price: "",
                    hsn_code: "",
                    uom: "NOS",
                    tax_rate: 18,
                    original_product_id: null,
                    original_product_name: "",
                    original_product_description: ""
                }
            ]);
        }
    }, [indentId]);

    // ✅ Auto-focus first product input for enterprise UX
    useEffect(() => {
        firstInputRef.current?.focus();
    }, [items.length]);

    // ✅ CRITICAL FIX: Close all dropdowns when modal opens (prevent z-index overlap)
    useEffect(() => {
        if (showVendorModal || showProductModal) {
            // Close all product dropdowns when modal is shown
            setShowProductDropdown({});
            // Disable body scroll and interactions
            document.body.style.overflow = 'hidden';
            document.body.style.pointerEvents = 'auto';
        } else {
            // Re-enable when modal closes
            document.body.style.overflow = 'auto';
            document.body.style.pointerEvents = 'auto';
        }
        
        return () => {
            // Cleanup on unmount
            document.body.style.overflow = 'auto';
            document.body.style.pointerEvents = 'auto';
        };
    }, [showVendorModal, showProductModal]);

    // ✅ FIX 2: Close dropdowns on outside click (improved)
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            // ✅ Allow clicks inside dropdown AND input field
            if (
                !target.closest('[data-product-field]') &&
                !target.closest('[data-product-dropdown]')
            ) {
                setShowProductDropdown({});
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    async function fetchIndent() {
        try {
            const res = await api.getIndent(Number(indentId));
            setIndent(res);
        } catch (err) {
            console.error("Failed to load indent", err);
        }
    }

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

            // ✅ FIX 1: Update items with immutable update
            if (currentProductRowIndex !== null) {
                const rowIndex = currentProductRowIndex;
                
                setItems(prev =>
                    prev.map((item, idx) => {
                        if (idx !== rowIndex) return item;

                        return {
                            ...item,
                            product_id: created.id,
                            product_name: created.name,
                            product_description: created.description || "",
                            hsn_code: created.hsn_code || "",
                            uom: created.uom || "NOS",
                            unit_price: created.unit_price || "",
                            tax_rate: created.tax_rate || 18,
                            original_product_id: created.id,
                            original_product_name: created.name,
                            original_product_description: created.description || ""
                        };
                    })
                );
                
                // ✅ FIX 2: Immediately set input to show product name
                setProductSearchInput(prev => ({
                    ...prev,
                    [rowIndex]: created.name
                }));
                
                // ✅ FIX 3: Close dropdown after creation
                setShowProductDropdown(prev => ({
                    ...prev,
                    [rowIndex]: false
                }));
                
                setCurrentProductRowIndex(null);
            }

            // ✅ FIX 4: Re-fetch products from backend to ensure new product is included
            // This ensures the product list is always in sync with the server
            await fetchProducts();

            // Reset modal and states
            setNewProduct({
                name: "",
                description: "",
                hsn_code: "",
                uom: "NOS",
                unit_price: "",
                tax_rate: 18,
            });
            setShowProductModal(false);

            toast.success("Product created successfully!");
        } catch (err) {
            console.error("Product creation error:", err);
            toast.error("Failed to create product");
        } finally {
            setProductCreating(false);
        }
    }


    async function fetchIndentItems() {
        try {
            const res = await api.getAvailableIndentItems(Number(indentId));
            let itemsToSet = Array.isArray(res) ? res : (res as any).items || [];

            if (itemsToSet.length === 0) {
                itemsToSet = [{
                    id: Date.now(),
                    product_id: null,
                    product_name: "",
                    product_description: "",
                    quantity: 1,
                    vendor_id: "",
                    unit_price: "",
                    hsn_code: "",
                    uom: "NOS",
                    tax_rate: 18,
                    original_product_id: null,
                    original_product_name: "",
                    original_product_description: ""
                }];
            }

            setItems(itemsToSet);
        } catch (err) {
            console.error("Failed to load indent items", err);
        }
    }

    async function fetchProducts() {
        try {
            const res = await api.getProducts(); // create this if not exists
            setProducts(Array.isArray(res) ? res : res.products || []);
        } catch (err) {
            console.error("Failed to fetch products", err);
        }
    }

    async function handleGSTChange(value: string) {
        const gst = value.toUpperCase();
        setNewVendor(prev => ({ ...prev, gst_number: gst }));
    }

    async function fetchPOTerms() {
        try {
            const token = localStorage.getItem("token");
            const resp = await fetch(
                `${import.meta.env.VITE_API_BASE || "http://localhost:3001"}/api/settings/po-terms`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );
            if (!resp.ok) throw new Error();
            const data = await resp.json();
            setTerms(data.terms || "");
        } catch (err) {
            console.error("Failed to load PO terms", err);
        }
    }

    async function fetchVendors() {
        try {
            const res = await api.getVendors();
            setVendors(Array.isArray(res) ? res : (res as any).vendors || []);
        } catch (err) {
            console.error("Failed to load vendors", err);
        }
    }

    const applyPoVendor = useCallback(async (vendorId: number | null) => {
        if (vendorId == null || Number.isNaN(Number(vendorId))) {
            setSelectedVendor(null);
            setVendorGST("");
            setVendorPhone("");
            setVendorCity("");
            setVendorEmail("");
            setVendorAddress("");
            return;
        }
        const id = Number(vendorId);
        try {
            const row = await api.getVendor(id);
            if (!row || !row.id) throw new Error("Invalid vendor");
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
        } catch (err) {
            console.error("Failed to load vendor", err);
            const v = vendors.find(x => x.id === id);
            if (v) {
                setSelectedVendor(v);
                setVendorGST(v.gst_number || v.gst || "");
                setVendorPhone(v.phone || "");
                setVendorCity(v.city || "");
                setVendorEmail(v.email || "");
                setVendorAddress(v.address || "");
            } else {
                toast.error("Could not load vendor details");
            }
        }
    }, [vendors]);

    useEffect(() => {
        indentVendorSyncedRef.current = false;
    }, [indentId]);

    useEffect(() => {
        if (!indentId || indentVendorSyncedRef.current || !items.length) return;
        const vids = items
            .map(i => i.vendor_id)
            .filter(v => v !== "" && v != null)
            .map(Number);
        if (!vids.length) return;
        if (!vids.every(v => v === vids[0])) return;
        indentVendorSyncedRef.current = true;
        void applyPoVendor(vids[0]);
    }, [indentId, items, applyPoVendor]);

    function updatePrice(index: number, price: number) {

        const updated = [...items];

        updated[index].unit_price = price;

        setItems(updated);

    }

    function removeItem(index: number) {
        const updated = [...items];
        updated.splice(index, 1);
        setItems(updated);
    }

    // Check if vendor detail has changed
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



    async function createPO() {
        const finalIndentId = indentId ? Number(indentId) : null;

        if (!items.length) {
            toast.error("No items available");
            return;
        }

        if (!selectedVendor?.id) {
            toast.error("Please select a vendor for this purchase order");
            return;
        }

        for (const i of items) {
            if (!i.product_name) {
                toast.error(`Missing product name in item`);
                return;
            }
            if (i.unit_price === "" || i.unit_price === null || i.unit_price === undefined) {
                toast.error(`Price missing for ${i.product_name}`);
                return;
            }
            if (Number(i.unit_price) <= 0) {
                toast.error(`Invalid price for ${i.product_name}`);
                return;
            }
        }

        if (!vendorGST || !vendorGST.trim()) {
            toast.error("Vendor GST number is required");
            return;
        }

        try {
            if (selectedVendor && selectedVendor.id) {
                const originalVendor = vendors.find(v => v.id === selectedVendor.id);
                const vendorChanges: any = {};

                if (vendorPhone && vendorPhone !== (originalVendor?.phone || "")) {
                    vendorChanges.phone = vendorPhone;
                }
                if (vendorEmail && vendorEmail !== (originalVendor?.email || "")) {
                    vendorChanges.email = vendorEmail;
                }
                if (vendorCity && vendorCity !== (originalVendor?.city || "")) {
                    vendorChanges.city = vendorCity;
                }
                if (vendorAddress && vendorAddress !== (originalVendor?.address || "")) {
                    vendorChanges.address = vendorAddress;
                }
                if (vendorGST && vendorGST !== (originalVendor?.gst || originalVendor?.gst_number || "")) {
                    vendorChanges.gst_number = vendorGST;
                }

                if (Object.keys(vendorChanges).length > 0) {
                    try {
                        await (api as any).updateVendor(selectedVendor.id, vendorChanges);
                    } catch (err) {
                        console.error("Failed to update vendor master", err);
                    }
                }
            }

            const processedItems = await Promise.all(items.map(async (i) => {
                const itemPayload: any = {
                    indent_item_id: finalIndentId ? i.id : null,
                    product_name: i.product_name,
                    product_description: i.product_description,
                    quantity: i.quantity,
                    vendor_id: selectedVendor.id,
                    unit_price: i.unit_price
                };

                // If product was selected from master (has original_product_id)
                if (i.original_product_id) {
                    const nameChanged = i.product_name !== i.original_product_name;
                    const descriptionChanged = i.product_description !== i.original_product_description;

                    // ✅ Logic:
                    // - Only name changed → Update existing product name in master
                    // - Description changed → Create new product
                    // - Both changed → Create new product

                    if (descriptionChanged) {
                        // Create new product (description modified)
                        console.log("📝 Creating new product (description modified):", i.product_name);
                        try {
                            const newProd = await api.addProduct({
                                name: i.product_name,
                                description: i.product_description,
                                hsn_code: i.hsn_code || "",
                                uom: i.uom || "NOS",
                                unit_price: i.unit_price || 0,
                                tax_rate: i.tax_rate || 18
                            });
                            itemPayload.product_id = newProd.id;
                            console.log("✅ New product created with ID:", newProd.id);
                        } catch (err) {
                            console.error("Failed to create new product", err);
                            toast.error("Failed to create product variant");
                        }
                    } else if (nameChanged && !descriptionChanged) {
                        // Update existing product name only (keep description)
                        console.log("✏️ Updating product name only:", i.original_product_name, "→", i.product_name);
                        try {
                            await api.updateProduct(i.original_product_id, {
                                name: i.product_name,
                                description: i.original_product_description,
                                hsn_code: i.hsn_code || "",
                                uom: i.uom || "NOS",
                                unit_price: i.unit_price || 0,
                                tax_rate: i.tax_rate || 18
                            });
                            itemPayload.product_id = i.original_product_id;
                            console.log("✅ Product name updated in master");
                        } catch (err) {
                            console.error("Failed to update product", err);
                            toast.error("Failed to update product");
                        }
                    } else {
                        // No changes, use original product
                        itemPayload.product_id = i.original_product_id;
                    }
                } else if (i.product_id) {
                    // New product created in this PO
                    itemPayload.product_id = i.product_id;
                }

                return itemPayload;
            }));

            const poPayload = {
                po_date: poDate,
                indent_id: finalIndentId || null,
                created_by: 1,
                created_by_name: "Admin",
                terms: terms,
                vendor_quote_no: vendorQuoteNo,
                vendor_quote_date: vendorQuoteDate || null,
                payment_terms: paymentTerms,
                delivery_date: deliveryDate || null,
                remarks: remarks,
                gst_rate: taxRate || 18,
                terms_snapshot: terms,
                vendor_details: {
                    gst: vendorGST,
                    email: vendorEmail,
                    phone: vendorPhone,
                    city: vendorCity,
                    address: vendorAddress
                },
                items: processedItems
            };

            await api.createPurchaseOrder(poPayload as any);
            toast.success("Purchase Order Created Successfully");
            navigate("/purchase-orders");

        } catch (err) {
            console.error(err);
            toast.error("Failed to create PO");
        }
    }

    async function createVendor() {
        if (!newVendor.name.trim()) {
            toast.error("Vendor name is required");
            return;
        }

        setVendorCreating(true);
        try {
            const created = await api.createVendor(newVendor);

            if (!created || !created.name) {
                throw new Error("Invalid vendor response");
            }

            setVendors(prev => [...prev, created]);
            await applyPoVendor(created.id);

            // Reset modal
            setNewVendor({
                name: "",
                contact_person: "",
                phone: "",
                email: "",
                gst_number: "",
                address: "",
                city: "",
                state: ""
            });
            setShowVendorModal(false);

            toast.success("Vendor created successfully!");
        } catch (err) {
            console.error("Vendor creation error:", err);
            toast.error("Failed to create vendor");
        } finally {
            setVendorCreating(false);
        }
    }

    const canCreatePO =
        items.length > 0 &&
        !!selectedVendor?.id &&
        !!vendorGST?.trim() &&
        items.every(
            i =>
                i.product_name &&
                i.unit_price !== "" &&
                i.unit_price != null &&
                Number(i.unit_price) > 0
        );

    return (

        <Layout>

            <div className="p-6 w-full max-w-[1400px] mx-auto" style={{ 
                pointerEvents: showVendorModal || showProductModal ? 'none' : 'auto',
                opacity: showVendorModal || showProductModal ? 0.5 : 1,
                transition: 'opacity 0.2s ease'
            }}>

                {/* PAGE HEADER */}
                <div className="mb-8 flex items-start justify-between">
                    <div>
                        <h1 className="text-3xl font-bold mb-2 text-slate-900">Create Purchase Order</h1>
                        <p className="text-slate-600 text-sm">Enterprise-grade tax-compliant procurement document</p>
                    </div>
                    <div className="p-3 bg-blue-100 rounded-lg">
                        <FileText className="text-blue-600" size={32} />
                    </div>
                </div>

                {/* PO FORM - Direct PO Creation */}
                <div>

                    {/* PO HEADER - VOUCHER & REFERENCES */}
                    <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-6 mb-6">
                        <h2 className="text-lg font-semibold mb-4 text-slate-900">Document Header</h2>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">

                            {/* PO Date */}
                            <div>
                                <label className="block text-sm font-medium mb-1.5">PO Date</label>

                                <div className="relative">
                                    <input
                                        ref={poDateRef}
                                        type="date"
                                        aria-label="PO Date"
                                        value={poDate}
                                        onChange={(e) => setPoDate(e.target.value)}
                                        className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg 
                 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 
                 outline-none cursor-pointer"
                                    />

                                    {/* Calendar Button */}
                                    <button
                                        type="button"
                                        onClick={() => poDateRef.current?.showPicker?.()}
                                        title="Open PO date picker"
                                        aria-label="Open PO date picker"
                                        className="absolute right-2 top-1/2 transform -translate-y-1/2 
                 p-1 text-gray-400 hover:text-blue-600 transition-colors"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M8 7V3m8 4V3m-9 8h18M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                                            />
                                        </svg>
                                    </button>
                                </div>
                            </div>

                            {/* Vendor Quotation No */}
                            <div>
                                <label className="block text-sm font-medium mb-1.5">Vendor Quotation No</label>
                                <input
                                    type="text"
                                    placeholder="Enter Vendor Quote No"
                                    value={vendorQuoteNo}
                                    onChange={(e) => setVendorQuoteNo(e.target.value)}
                                    className="w-full px-3 py-2 border rounded-lg"
                                />
                            </div>

                            {/* Vendor Quotation Date */}
                            <div>
                                <label className="block text-sm font-medium mb-1.5">Vendor Quote Date</label>
                                <div className="relative">
                                    <input
                                        ref={vendorQuoteDateRef}
                                        type="date"
                                        aria-label="Vendor Quote Date"
                                        value={vendorQuoteDate}
                                        onChange={(e) => setVendorQuoteDate(e.target.value)}
                                        className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none cursor-pointer"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => {
                                            vendorQuoteDateRef.current?.showPicker?.();
                                        }}
                                        title="Open vendor quote date picker"
                                        aria-label="Open vendor quote date picker"
                                        className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 text-gray-400 hover:text-blue-600 transition-colors"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h18M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                    </button>
                                </div>
                            </div>

                            {/* Payment Terms */}
                            <div>
                                <label className="block text-sm font-medium mb-1.5">Payment Terms</label>
                                <select
                                    aria-label="Payment Terms"
                                    value={paymentTerms}
                                    onChange={(e) => setPaymentTerms(e.target.value)}
                                    className="w-full px-3 py-2 border rounded-lg"
                                >
                                    <option value="">Select Terms</option>
                                    <option value="Advance">Advance</option>
                                    <option value="30 Days">30 Days</option>
                                    <option value="60 Days">60 Days</option>
                                </select>
                            </div>

                            {/* Delivery Date */}
                            <div>
                                <label className="block text-sm font-medium mb-1.5">Delivery Date</label>
                                <div className="relative">
                                    <input
                                        ref={deliveryDateRef}
                                        type="date"
                                        aria-label="Delivery Date"
                                        value={deliveryDate}
                                        onChange={(e) => setDeliveryDate(e.target.value)}
                                        className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none cursor-pointer"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => {
                                            deliveryDateRef.current?.showPicker?.();
                                        }}
                                        title="Open delivery date picker"
                                        aria-label="Open delivery date picker"
                                        className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 text-gray-400 hover:text-blue-600 transition-colors"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h18M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                    </button>
                                </div>
                            </div>

                            {/* Remarks */}
                            <div className="md:col-span-3">
                                <label className="block text-sm font-medium mb-1.5">Remarks</label>
                                <input
                                    type="text"
                                    placeholder="Any notes..."
                                    value={remarks}
                                    onChange={(e) => setRemarks(e.target.value)}
                                    className="w-full px-3 py-2 border rounded-lg"
                                />
                            </div>

                        </div>
                    </div>

                    {/* PO HEADER CARD */}
                    <div className="bg-gradient-to-r from-blue-50 to-slate-50 border border-slate-200 rounded-lg shadow-sm p-6 mb-6">
                        <h2 className="text-lg font-semibold mb-4 text-slate-900">Procurement Details</h2>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">

                            <div>
                                <p className="text-xs uppercase text-slate-600 font-semibold mb-1">Indent</p>
                                <p className="text-lg font-bold text-blue-600">
                                    {indent ? indent.indent_number : "Direct PO"}
                                </p>
                            </div>

                            <div>
                                <p className="text-xs uppercase text-slate-600 font-semibold mb-1">Customer</p>
                                <p className="text-lg font-bold text-slate-900">{indent?.customer_name}</p>
                            </div>

                            <div>
                                <p className="text-xs uppercase text-slate-600 font-semibold mb-1">Buyer</p>
                                <p className="text-lg font-bold text-slate-900">PRAYOSHA AUTOMATION PVT. LTD.</p>
                            </div>

                            <div>
                                <p className="text-xs uppercase text-slate-600 font-semibold mb-1">PO Date</p>
                                <p className="text-lg font-bold text-slate-900">
                                    {new Date(poDate).toLocaleDateString()}
                                </p>
                            </div>

                        </div>
                    </div>


                    {/* VENDOR — single PO supplier */}
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
                                    setNewVendor(prev => ({ ...prev, name: selected.label }));
                                    setShowVendorModal(true);
                                    return;
                                }
                                void applyPoVendor(selected.value);
                            }}
                            options={vendors.map(v => ({ value: v.id, label: v.name }))}
                            placeholder="Search or select vendor"
                            isSearchable
                            isClearable
                            formatCreateLabel={(inputValue) => `+ Create "${inputValue}"`}
                            isValidNewOption={(inputValue, _, options) =>
                                inputValue.trim().length > 0 &&
                                !options.some(opt => opt.label.toLowerCase() === inputValue.toLowerCase())
                            }
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
                                <div className="flex gap-2 items-center">
                                    {hasVendorDetailChanged() && (
                                        <span className="text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded font-medium animate-pulse">
                                            Changes will sync to vendor master
                                        </span>
                                    )}
                                    <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded font-medium">Editable</span>
                                </div>
                            </div>
                            <p className="text-sm text-slate-600 mb-4">
                                Loaded from the supplier record when you select a vendor. You can adjust for this PO; changes sync to vendor master on create.
                            </p>

                            {selectedVendor && !vendorGST?.trim() && (
                                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                                    <div className="flex items-start gap-3">
                                        <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                        </svg>
                                        <div className="flex-1">
                                            <p className="font-semibold text-red-800 mb-2">Required to create purchase order</p>
                                            <ul className="text-sm text-red-700 space-y-1 ml-4">
                                                <li className="list-disc">GST number is required (Supplier GST field)</li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {selectedVendor ? (
                                <div className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1.5">Supplier GST</label>
                                            <input
                                                type="text"
                                                placeholder="Supplier GSTIN"
                                                value={vendorGST}
                                                onChange={(e) => {
                                                    setVendorGST(e.target.value);
                                                    setSelectedVendor({
                                                        ...selectedVendor,
                                                        gst: e.target.value
                                                    });
                                                }}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white hover:border-slate-400 transition-colors"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1.5">Phone</label>
                                            <input
                                                type="text"
                                                placeholder="Phone Number"
                                                value={vendorPhone}
                                                onChange={(e) => {
                                                    setVendorPhone(e.target.value);
                                                    setSelectedVendor({
                                                        ...selectedVendor,
                                                        phone: e.target.value
                                                    });
                                                }}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white hover:border-slate-400 transition-colors"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1.5">City</label>
                                            <input
                                                type="text"
                                                placeholder="City"
                                                value={vendorCity}
                                                onChange={(e) => {
                                                    setVendorCity(e.target.value);
                                                    setSelectedVendor({
                                                        ...selectedVendor,
                                                        city: e.target.value
                                                    });
                                                }}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white hover:border-slate-400 transition-colors"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
                                            <input
                                                type="email"
                                                placeholder="Email"
                                                value={vendorEmail}
                                                onChange={(e) => {
                                                    setVendorEmail(e.target.value);
                                                    setSelectedVendor({
                                                        ...selectedVendor,
                                                        email: e.target.value
                                                    });
                                                }}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white hover:border-slate-400 transition-colors"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Address</label>
                                        <textarea
                                            placeholder="Vendor address"
                                            rows={2}
                                            value={vendorAddress}
                                            onChange={(e) => {
                                                setVendorAddress(e.target.value);
                                                setSelectedVendor({
                                                    ...selectedVendor,
                                                    address: e.target.value
                                                });
                                            }}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white hover:border-slate-400 transition-colors resize-none"
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div className="p-6 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-center text-sm">
                                    Select a supplier to load GST, contact, and address from the vendor master.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* MATERIAL PROCUREMENT TABLE */}
                    <div className="bg-white border border-slate-200 rounded-lg shadow-sm mb-6" style={{ overflow: 'visible' }}>

                        <div className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200 p-6">
                            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                                <DollarSign size={20} className="text-indigo-600" />
                                Material Procurement Table
                            </h2>
                        </div>

                        <div className="relative">
                            <div className="flex justify-end mb-4">
                                <button
                                    onClick={() => {
                                        setItems(prev => [
                                            ...prev,
                                            {
                                                id: Date.now(),
                                                product_id: null,
                                                product_name: "",
                                                product_description: "",
                                                quantity: 1,
                                                vendor_id: "",
                                                unit_price: "",
                                                hsn_code: "",
                                                uom: "NOS",
                                                tax_rate: 18,
                                                original_product_id: null,
                                                original_product_name: "",
                                                original_product_description: ""
                                            }
                                        ]);
                                    }}
                                    className="bg-blue-600 text-white px-4 py-2 rounded"
                                >
                                    + Add Item
                                </button>
                            </div>
                            <div className="w-full" style={{ overflow: 'visible' }}>
                                <table className="w-full text-sm" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>

                                    <thead className="bg-gradient-to-r from-slate-50 to-slate-100 text-xs uppercase font-semibold text-slate-700 border-b border-slate-200">

                                        <tr>
                                            <th className="p-4 text-left min-w-[280px]">Product</th>
                                            <th className="p-4 text-center min-w-[60px]">Qty</th>
                                            <th className="p-4 text-right min-w-[100px]">Unit Price</th>
                                            <th className="p-4 text-center min-w-[60px]">Tax Rate %</th>
                                            <th className="p-4 text-right min-w-[80px]">Amount</th>
                                            <th className="p-4 text-center min-w-[80px]">Status</th>
                                            <th className="p-4 text-center min-w-[80px]">Action</th>
                                        </tr>

                                    </thead>

                                    <tbody style={{ overflow: 'visible' }}>

                                        {items.map((i, index) => {

                                            const itemSubtotal = i.quantity * (i.unit_price || 0);
                                            const itemTax = itemSubtotal * (taxRate / 100);
                                            const itemTotal = itemSubtotal + itemTax;

                                            if (index === 0) {
                                                console.log("🔍 FIRST ITEM IN TABLE:", i);
                                                console.log("🔍 product_name value:", i.product_name);
                                            }

                                            return (
                                                <tr key={i.id} className="border-t border-slate-200 hover:bg-slate-50 align-top" style={{ overflow: 'visible' }}>

                                                    {/* PRODUCT - Search Input + Dropdown (Like CreateIndent) */}
                                                    <td className="p-4 relative" style={{ overflow: 'visible', zIndex: 99999 }}>
                                                        <div className="flex flex-col gap-2">

                                                            {/* Product Search Input */}
                                                            <div className="relative" data-product-field style={{ position: 'relative', zIndex: 99999 }}>
                                                                <input
                                                                    type="text"
                                                                    placeholder="Search or select product"
                                                                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                                                                    value={
                                                                        // ✅ Show product name from item state, or search input if user is typing
                                                                        productSearchInput[index] != null ? productSearchInput[index] : (i.product_name || "")
                                                                    }
                                                                    onChange={(e) => {
                                                                        const newVal = e.target.value;
                                                                        setProductSearchInput(prev => ({
                                                                            ...prev,
                                                                            [index]: newVal
                                                                        }));
                                                                        // ✅ Show dropdown when typing
                                                                        setShowProductDropdown(prev => ({
                                                                            ...prev,
                                                                            [index]: true
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
                                                                {showProductDropdown[index] && !showVendorModal && !showProductModal && (
                                                                    <div
                                                                        data-product-dropdown
                                                                        className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-2xl"
                                                                        style={{ maxHeight: '400px', overflowY: 'auto', zIndex: 9998, position: 'relative', display: (!showVendorModal && !showProductModal && showProductDropdown[index]) ? 'block' : 'none' }}
                                                                    >
                                                                        {(() => {
                                                                            const searchTerm = (productSearchInput[index] || "").toLowerCase();
                                                                            const filtered = products.filter(p =>
                                                                                p.name && p.name.toLowerCase().includes(searchTerm)
                                                                            );

                                                                            return (
                                                                                <>
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
                                                                                                updated[index].original_product_id = p.id;
                                                                                                updated[index].original_product_name = p.name;
                                                                                                updated[index].original_product_description = p.description || "";
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
                                                                                            <div className="text-xs text-gray-600 space-y-1">
                                                                                                {p.description && <div>📝 {p.description}</div>}
                                                                                            </div>
                                                                                        </button>
                                                                                    ))}
                                                                                    <button
                                                                                        type="button"
                                                                                        className="w-full text-left px-4 py-2 text-blue-600 hover:bg-blue-50 border-t border-gray-200 font-medium transition-colors"
                                                                                        onClick={() => {
                                                                                            setCurrentProductRowIndex(index);
                                                                                            setShowProductModal(true);
                                                                                            setShowProductDropdown(prev => ({
                                                                                                ...prev,
                                                                                                [index]: false
                                                                                            }));
                                                                                        }}
                                                                                    >
                                                                                        + Create New Product
                                                                                    </button>
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
                                                                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-md focus:ring-1 focus:ring-blue-500"
                                                                value={i.product_description || ""}
                                                                onChange={(e) => {
                                                                    const updated = [...items];
                                                                    updated[index].product_description = e.target.value;
                                                                    setItems(updated);
                                                                }}
                                                            />
                                                        </div>
                                                    </td>

                                                    {/* QTY */}
                                                    <td className="p-5 text-center">
                                                        <input
                                                            type="number"
                                                            placeholder="Qty"
                                                            aria-label="Item Quantity"
                                                            value={i.quantity || 1}
                                                            onChange={(e) => {
                                                                const updated = [...items];
                                                                updated[index].quantity = Number(e.target.value);
                                                                setItems(updated);
                                                            }}
                                                            className="border px-2 py-1 w-20 text-center rounded"
                                                        />
                                                    </td>

                                                    {/* UNIT PRICE */}
                                                    <td className="p-5 text-right">
                                                        <input
                                                            type="number"
                                                            placeholder="Enter Price"
                                                            value={i.unit_price || ""}
                                                            onChange={(e) => updatePrice(index, Number(e.target.value))}
                                                            className="border border-slate-300 rounded px-3 py-2 w-28 text-right text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                                        />
                                                    </td>

                                                    {/* TAX */}
                                                    <td className="p-5 text-center font-semibold text-slate-900">
                                                        {taxRate}%
                                                    </td>

                                                    {/* AMOUNT */}
                                                    <td className="p-5 text-right font-semibold text-indigo-700">
                                                        ₹ {itemTotal.toFixed(2)}
                                                    </td>

                                                    {/* STATUS */}
                                                    <td className="p-5 text-center">
                                                        <span
                                                            className={`px-3 py-1 rounded-full text-xs font-semibold ${selectedVendor?.id && i.unit_price
                                                                ? "bg-emerald-100 text-emerald-700"
                                                                : "bg-amber-100 text-amber-700"
                                                                }`}
                                                        >
                                                            {selectedVendor?.id && i.unit_price ? "Ready" : "Incomplete"}
                                                        </span>
                                                    </td>

                                                    {/* ACTION */}
                                                    <td className="p-5 text-center">
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

                        </div>

                        {/* TOTALS SUMMARY */}
                        <div className="bg-gradient-to-r from-slate-50 to-slate-100 border border-slate-200 rounded-lg shadow-sm p-6 mb-6">
                            <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                                <DollarSign size={20} className="text-blue-600" />
                                Tax & Cost Summary
                            </h2>

                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">

                                {/* SUBTOTAL */}
                                <div className="bg-white border border-slate-200 rounded-lg p-4">
                                    <p className="text-xs uppercase text-slate-600 font-semibold mb-2">Subtotal (Before Tax)</p>
                                    <p className="text-2xl font-bold text-slate-900">₹ {subtotal.toFixed(2)}</p>
                                    <p className="text-xs text-slate-500 mt-1">{items.length} items</p>
                                </div>

                                {/* TAX RATE */}
                                <div className="bg-white border border-slate-200 rounded-lg p-4">
                                    <p className="text-xs uppercase text-slate-600 font-semibold mb-2">Tax Rate (IGST)</p>
                                    <p className="text-2xl font-bold text-orange-600">{taxRate}%</p>
                                    <p className="text-xs text-slate-500 mt-1">India GST Applicable</p>
                                </div>

                                {/* IGST AMOUNT */}
                                <div className="bg-white border border-slate-200 rounded-lg p-4">
                                    <p className="text-xs uppercase text-slate-600 font-semibold mb-2">IGST Amount</p>
                                    <p className="text-2xl font-bold text-yellow-600">₹ {igst.toFixed(2)}</p>
                                    <p className="text-xs text-slate-500 mt-1">{((igst / subtotal) * 100).toFixed(1)}% of subtotal</p>
                                </div>

                                {/* TOTAL */}
                                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-300 rounded-lg p-4">
                                    <p className="text-xs uppercase text-emerald-700 font-semibold mb-2">Total Amount Due</p>
                                    <p className="text-2xl font-bold text-emerald-700">₹ {total.toFixed(2)}</p>
                                    <p className="text-xs text-emerald-600 mt-1">Including all taxes</p>
                                </div>

                            </div>
                        </div>

                        {/* TERMS & CONDITIONS */}
                        <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-6 mb-6">
                            <h2 className="text-lg font-semibold text-slate-900 mb-2">
                                Terms & Conditions
                            </h2>

                            <p className="text-sm text-slate-600 mb-4">
                                Default terms are loaded from system settings. You can modify them for this Purchase Order.
                            </p>

                            <textarea
                                value={terms}
                                onChange={(e) => setTerms(e.target.value)}
                                rows={8}
                                className="w-full px-4 py-3 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="Enter terms and conditions..."
                            />
                        </div>


                        {/* ACTION BAR */}
                        <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-6 flex justify-end gap-4">

                            <button
                                className="px-6 py-2.5 bg-slate-500 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors"
                                onClick={() => navigate(-1)}
                            >
                                Cancel
                            </button>

                            <button
                                disabled={!canCreatePO}
                                className={`px-8 py-2.5 rounded-lg font-semibold transition-all ${canCreatePO
                                    ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-md hover:shadow-lg"
                                    : "bg-slate-300 text-slate-500 cursor-not-allowed"
                                    }`}
                                onClick={createPO}
                            >
                                {canCreatePO ? "Create Purchase Order" : "Fill Required Fields"}
                            </button>

                        </div>

                    </div>

                </div>

            </div>

            {/* ====== CREATE VENDOR MODAL ====== */}
            {showVendorModal && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-8 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-3 bg-blue-100 rounded-lg">
                                <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M8 16.5a1 1 0 11-2 0 1 1 0 012 0z" />
                                    <path fillRule="evenodd" d="M1 6.912V19a3 3 0 003 3h12a3 3 0 003-3V6.912A3 3 0 0016.05 3.5H3.95A3 3 0 001 6.912zm14 1.854H5v10a1 1 0 001 1h8a1 1 0 001-1v-10z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-bold text-slate-900">Create New Vendor</h2>
                                        <p className="text-sm text-slate-600 mt-1">Add vendor details for procurement</p>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    {/* Name, contact person, GST */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-semibold text-slate-700 mb-2">Vendor Name *</label>
                                            <input
                                                type="text"
                                                placeholder="Enter vendor name"
                                                value={newVendor.name}
                                                onChange={(e) => setNewVendor({ ...newVendor, name: e.target.value })}
                                                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-semibold text-slate-700 mb-2">Contact person</label>
                                            <input
                                                type="text"
                                                placeholder="Name of primary contact"
                                                value={newVendor.contact_person}
                                                onChange={(e) => setNewVendor({ ...newVendor, contact_person: e.target.value })}
                                                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                                            />
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-semibold text-slate-700 mb-2">GST number *</label>
                                            <input
                                                type="text"
                                                placeholder="22ABCDE1234F1Z5"
                                                value={newVendor.gst_number}
                                                onChange={(e) => handleGSTChange(e.target.value)}
                                                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                                            />
                                        </div>
                                    </div>

                                    {/* Row 2: Phone & Email */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-semibold text-slate-700 mb-2">Phone</label>
                                            <input
                                                type="tel"
                                                placeholder="9876543210"
                                                value={newVendor.phone}
                                                onChange={(e) => setNewVendor({ ...newVendor, phone: e.target.value })}
                                                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-semibold text-slate-700 mb-2">Email</label>
                                            <input
                                                type="email"
                                                placeholder="vendor@example.com"
                                                value={newVendor.email}
                                                onChange={(e) => setNewVendor({ ...newVendor, email: e.target.value })}
                                                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                                            />
                                        </div>
                                    </div>

                                    {/* Address */}
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">Address</label>
                                        <textarea
                                            placeholder="Office address"
                                            value={newVendor.address}
                                            onChange={(e) => setNewVendor({ ...newVendor, address: e.target.value })}
                                            rows={2}
                                            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none transition"
                                        />
                                    </div>

                                    {/* Row 3: City & State */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-semibold text-slate-700 mb-2">City</label>
                                            <input
                                                type="text"
                                                placeholder="e.g., Mumbai"
                                                value={newVendor.city}
                                                onChange={(e) => setNewVendor({ ...newVendor, city: e.target.value })}
                                                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-semibold text-slate-700 mb-2">State</label>
                                            <input
                                                type="text"
                                                placeholder="e.g., Maharashtra"
                                                value={newVendor.state}
                                                onChange={(e) => setNewVendor({ ...newVendor, state: e.target.value })}
                                                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-3 mt-8 pt-6 border-t border-slate-200">
                                    <button
                                        onClick={() => {
                                            setShowVendorModal(false);
                                            setNewVendor({
                                                name: "",
                                                contact_person: "",
                                                phone: "",
                                                email: "",
                                                gst_number: "",
                                                address: "",
                                                city: "",
                                                state: ""
                                            });
                                        }}
                                        className="flex-1 px-4 py-2.5 text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors font-semibold"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={createVendor}
                                        disabled={vendorCreating || !newVendor.name.trim()}
                                        className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {vendorCreating ? "Creating..." : "Create Vendor"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

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
                                    <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
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

        </Layout>
    );
}
