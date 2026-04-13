// frontend/src/pages/EditIndent.tsx

import React, { useEffect, useState, useRef } from "react";
import toast from "react-hot-toast";
import Layout from "../components/layout/Layout";
import api from "../api";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

interface Product {
    id: number;
    name: string;
    description: string;
}

interface Item {
    product_id: number | null;
    product_name: string;
    product_description: string;
    quantity: number;
}

interface FormErrors {
    [key: string]: string;
}

export default function EditIndent() {
    const navigate = useNavigate();
    const { id } = useParams();
    const { user } = useAuth();

    const [products, setProducts] = useState<Product[]>([]);
    const [items, setItems] = useState<Item[]>([
        {
            product_id: null,
            product_name: "",
            product_description: "",
            quantity: 1,
        },
    ]);

    const [newVendor, setNewVendor] = useState({
        name: "",
        gst_number: "",
        phone: "",
        email: "",
    });

    const today = new Date().toISOString().split("T")[0];

    const [customerName, setCustomerName] = useState("");
    const [customers, setCustomers] = useState<{ id: number; company_name: string }[]>([]);
    const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
    const [showCustomerModal, setShowCustomerModal] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState<any>(null);

    const [newCustomer, setNewCustomer] = useState({
        company_name: "",
        gstin: "",
        email: "",
        location_name: "",
        address: "",
        city: "",
        state: "",
        contact_name: "",
        contact_email: "",
        contact_phone: ""
    });
    const [preferredVendor, setPreferredVendor] = useState("");
    const [indentDate, setIndentDate] = useState(today);
    const [poNumber, setPoNumber] = useState("");
    const [notes, setNotes] = useState("");

    const [vendors, setVendors] = useState<{ id: number; name: string }[]>([]);
    const [showVendorDropdown, setShowVendorDropdown] = useState(false);

    const [showVendorModal, setShowVendorModal] = useState(false);
    const [vendorCreating, setVendorCreating] = useState(false);

    const [showModal, setShowModal] = useState(false);
    const [productCreating, setProductCreating] = useState(false);

    const [newProduct, setNewProduct] = useState({
        name: "",
        description: "",
    });

    const [errors, setErrors] = useState<FormErrors>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [documents, setDocuments] = useState<File[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const dateRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (id) {
            fetchAllData();
        }
    }, [id]);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (!target.closest('[data-customer-field]') && !target.closest('[data-vendor-field]')) {
                setShowCustomerDropdown(false);
                setShowVendorDropdown(false);
            }
        };
        globalThis.document.addEventListener("click", handler);
        return () => globalThis.document.removeEventListener("click", handler);
    }, []);

    async function fetchAllData() {
        if (!id) {
            toast.error("Invalid indent ID");
            setIsLoading(false);
            return;
        }

        try {
            const [indent, products, customers, vendors] = await Promise.all([
                api.getIndent(id),
                api.getProducts(),
                api.getCustomers(),
                api.getVendors(),
            ]);

            // Set form data from indent
            setCustomerName(indent.customer_name || "");
            
            // Set selected customer with full details
            if (indent.customer_id) {
                setSelectedCustomer({
                    id: indent.customer_id,
                    company_name: indent.customer_name,
                    location_id: indent.customer_location_id,
                    contact_id: indent.customer_contact_id
                });
            }
            
            setPreferredVendor(indent.preferred_vendor || "");
            setIndentDate(indent.indent_date?.split("T")[0] || today);
            setPoNumber(indent.po_number || "");
            setNotes(indent.notes || "");

            // Set items
            if (indent.items && Array.isArray(indent.items)) {
                const formattedItems = indent.items.map((item: any) => ({
                    product_id: item.product_id || null,
                    product_name: item.product_name || "",
                    product_description: item.product_description || "",
                    quantity: Number(item.required_qty || item.quantity || 1),
                }));
                setItems(formattedItems);
            }

            setProducts(products);
            setCustomers(customers);
            setVendors(Array.isArray(vendors) ? vendors : []);
            setIsLoading(false);
        } catch (err) {
            console.error("Failed to fetch indent data:", err);
            toast.error("Failed to load indent data");
            setIsLoading(false);
        }
    }

    function validateForm(): boolean {
        const newErrors: FormErrors = {};

        if (!customerName.trim()) {
            newErrors.customerName = "Customer is required";
        }

        if (!indentDate) {
            newErrors.indentDate = "Indent date is required";
        }

        const validItems = items.filter(i => i.product_id);
        if (validItems.length === 0) {
            newErrors.items = "At least one product with quantity is required";
        }

        for (const item of validItems) {
            if (!item.product_name || !item.product_name.trim()) {
                newErrors.items = "All products must have a name. Please select valid products.";
                break;
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }

    function addItem() {
        setItems([
            ...items,
            {
                product_id: null,
                product_name: "",
                
                product_description: "",
                quantity: 1,
            },
        ]);
    }

    function removeItem(index: number) {
        const updated = [...items];
        updated.splice(index, 1);
        setItems(updated);
    }

    function updateItem(index: number, field: string, value: any) {
        const updated = [...items];
        (updated[index] as any)[field] = value;
        setItems(updated);
    }

    function selectProduct(index: number, productId: number) {
        const product = products.find((p) => p.id === productId);
        if (!product) return;

        const updated = [...items];
        updated[index].product_id = product.id;
        updated[index].product_name = product.name;
        updated[index].product_description = product.description;
        setItems(updated);
    }

    async function createProduct() {
        if (!newProduct.name.trim()) {
            toast.error("Product name required");
            return;
        }
        setProductCreating(true);
        try {
            const created = await api.addProduct(newProduct);
            setProducts([...products, created]);

            setItems((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                    product_id: created.id,
                    product_name: created.name,
                    product_description: created.description,
                    quantity: 1,
                };
                return updated;
            });

            setShowModal(false);
            setNewProduct({ name: "", description: "" });
            toast.success("Product created successfully!");
        } catch (err) {
            toast.error("Failed to create product");
            console.error("Product creation error:", err);
        } finally {
            setProductCreating(false);
        }
    }

    async function createVendor() {
        if (!newVendor.name.trim()) {
            toast.error("Vendor name required");
            return;
        }

        setVendorCreating(true);
        try {
            const created = await api.createVendor(newVendor);

            if (!created || !created.name) {
                throw new Error("Invalid vendor response");
            }

            setVendors(prev => [...prev, created]);
            setPreferredVendor(created.name);

            setShowVendorModal(false);
            toast.success("Vendor created successfully!");

        } catch (err) {
            console.error("Vendor error:", err);
            toast.error("Vendor creation failed");
        } finally {
            setVendorCreating(false);
        }
    }

    async function createCustomer() {
        if (
            !newCustomer.company_name.trim() ||
            !newCustomer.location_name.trim() ||
            !newCustomer.contact_name.trim()
        ) {
            toast.error("Required fields missing: Company Name, Location Name, and Contact Person");
            return;
        }

        try {
            // Step 1: Create customer
            const customerRes = await api.addCustomer({
                company_name: newCustomer.company_name,
                gstin: newCustomer.gstin,
                email: newCustomer.email
            });
            
            // Step 2: Add location
            const locationRes = await api.addCustomerLocation(customerRes.id, {
                location_name: newCustomer.location_name,
                address: newCustomer.address,
                city: newCustomer.city,
                state: newCustomer.state
            });
            
            // Step 3: Add contact
            const contactRes = await api.addCustomerContact(locationRes.id, {
                contact_name: newCustomer.contact_name,
                email: newCustomer.contact_email,
                phone: newCustomer.contact_phone,
                is_primary: true
            });
            
            // Store full customer structure with location/contact info
            const customerData = {
                id: customerRes.id,
                company_name: customerRes.company_name,
                location_id: locationRes.id,
                contact_id: contactRes.id
            };
            
            setSelectedCustomer(customerData);
            setCustomerName(customerRes.company_name);
            setCustomers(prev => [...prev, customerData]);
            
            setShowCustomerModal(false);
            setNewCustomer({
                company_name: "",
                gstin: "",
                email: "",
                location_name: "",
                address: "",
                city: "",
                state: "",
                contact_name: "",
                contact_email: "",
                contact_phone: ""
            });
            toast.success("Customer created successfully!");
        } catch (err) {
            console.error("Customer creation error:", err);
            toast.error("Customer creation failed");
        }
    }

    async function submitIndent(finalStatus: "submitted" | "draft") {
        if (!id) {
            toast.error("Invalid indent ID");
            return;
        }

        if (!validateForm()) {
            return;
        }

        if (!user) {
            toast.error("User session expired. Please log in again.");
            return;
        }

        const filteredItems = items.filter(i => i.product_id);

        const formData = new FormData();
        formData.append("customer_id", selectedCustomer?.id || "");
        formData.append("customer_location_id", selectedCustomer?.location_id || "");
        formData.append("customer_contact_id", selectedCustomer?.contact_id || "");
        formData.append("customer_name", customerName);
        formData.append("preferred_vendor", preferredVendor);
        formData.append("indent_date", indentDate);
        formData.append("po_number", poNumber);
        formData.append("notes", notes);
        formData.append("status", finalStatus);
        formData.append("items", JSON.stringify(filteredItems));

        if (documents && documents.length) {
            for (const f of documents) {
                formData.append("documents", f);
            }
        }

        setIsSubmitting(true);
        try {
            await toast.promise(
                api.updateIndent(id, formData),
                {
                    loading: "Updating indent...",
                    success: "✓ Indent updated successfully!",
                    error: (err: any) => {
                        const errorMsg = err?.response?.data?.error || err?.message || "Failed to update indent";
                        return errorMsg;
                    }
                }
            );
            setTimeout(() => {
                navigate(`/indents/${id}`);
            }, 1500);
        } catch (err: any) {
            console.error("Indent update error:", err);
        } finally {
            setIsSubmitting(false);
        }
    }

    const filteredCustomers = customers.filter((c) =>
        c.company_name.toLowerCase().includes(customerName.toLowerCase())
    );

    const filteredVendors = vendors.filter((v) =>
        v.name.toLowerCase().includes(preferredVendor.toLowerCase())
    );

    const totalProducts = items.filter(i => i.product_id).length;
    const totalQty = items.reduce((sum, i) => sum + (i.product_id ? i.quantity : 0), 0);

    if (isLoading) {
        return (
            <Layout>
                <div className="max-w-7xl mx-auto px-6 py-8">
                    <p>Loading...</p>
                </div>
            </Layout>
        );
    }

    return (
        <Layout>
            <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4 sm:px-6 lg:px-8">
                <div className="w-full">

                    {/* Header Section */}
                    <div className="mb-8">
                        <div className="flex items-center justify-between">
                            <div>
                                <h1 className="text-4xl font-bold text-gray-900 tracking-tight">
                                    Edit Indent Requisition
                                </h1>
                                <p className="text-gray-600 mt-2">
                                    Update the indent details
                                </p>
                            </div>
                            <button
                                onClick={() => navigate(`/indents/${id}`)}
                                className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                ← Back
                            </button>
                        </div>
                    </div>

                    <div className="space-y-6">

                        {/* CUSTOMER & VENDOR INFO SECTION */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                            <div className="px-8 py-6 border-b border-gray-200">
                                <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                                    <svg className="w-5 h-5 mr-2 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM9 12a3 3 0 11-6 0 3 3 0 016 0zM9 18a3 3 0 11-6 0 3 3 0 016 0zM16.325 8.756a1 1 0 00-1.414-1.414l-5.656 5.656a1 1 0 101.414 1.414l5.656-5.656zm0 7.07a1 1 0 00-1.414-1.413l-2.828 2.829a1 1 0 101.414 1.414l2.828-2.83z" />
                                    </svg>
                                    Customer & Vendor Details
                                </h2>
                            </div>

                            <div className="px-8 py-6">
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">

                                    {/* Customer */}
                                    <div className="relative" data-customer-field>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                            Customer *
                                        </label>
                                        <input
                                            placeholder="Search or select customer"
                                            className={`w-full px-3.5 py-2.5 text-sm border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.customerName
                                                ? "border-red-300 bg-red-50"
                                                : "border-gray-300 bg-white hover:border-gray-400"
                                                }`}
                                            value={customerName}
                                            onChange={(e) => {
                                                setCustomerName(e.target.value);
                                                setShowCustomerDropdown(true);
                                                if (errors.customerName) {
                                                    setErrors(prev => ({ ...prev, customerName: "" }));
                                                }
                                            }}
                                            onFocus={() => setShowCustomerDropdown(true)}
                                        />
                                        {errors.customerName && (
                                            <p className="text-xs text-red-600 mt-1">{errors.customerName}</p>
                                        )}
                                        {showCustomerDropdown && filteredCustomers.length > 0 && (
                                            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-auto z-10">
                                                {filteredCustomers.map((c) => (
                                                    <button
                                                        key={c.id}
                                                        type="button"
                                                        className="w-full text-left px-4 py-2 hover:bg-blue-50 transition-colors"
                                                        onClick={() => {
                                                            setCustomerName(c.company_name);
                                                            setSelectedCustomer(c);
                                                            setShowCustomerDropdown(false);
                                                        }}
                                                    >
                                                        <div className="font-medium text-gray-900">{c.company_name}</div>
                                                    </button>
                                                ))}
                                                <button
                                                    type="button"
                                                    className="w-full text-left px-4 py-2 text-blue-600 hover:bg-blue-50 border-t border-gray-200 font-medium transition-colors"
                                                    onClick={() => {
                                                        setShowCustomerModal(true);
                                                        setShowCustomerDropdown(false);
                                                    }}
                                                >
                                                    + Create New Customer
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Vendor */}
                                    <div className="relative" data-vendor-field>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                            Preferred Vendor
                                        </label>
                                        <input
                                            placeholder="Search or select vendor"
                                            className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-lg hover:border-gray-400 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                            value={preferredVendor}
                                            onChange={(e) => {
                                                setPreferredVendor(e.target.value);
                                                setShowVendorDropdown(true);
                                            }}
                                            onFocus={() => setShowVendorDropdown(true)}
                                        />
                                        {showVendorDropdown && (
                                            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-auto z-10">
                                                {filteredVendors.map((v) => (
                                                    <button
                                                        key={v.id}
                                                        type="button"
                                                        className="w-full text-left px-4 py-2 hover:bg-blue-50 transition-colors"
                                                        onClick={() => {
                                                            setPreferredVendor(v.name);
                                                            setShowVendorDropdown(false);
                                                        }}
                                                    >
                                                        <div className="font-medium text-gray-900">{v.name}</div>
                                                    </button>
                                                ))}
                                                <button
                                                    type="button"
                                                    className="w-full text-left px-4 py-2 text-blue-600 hover:bg-blue-50 border-t border-gray-200 font-medium transition-colors"
                                                    onClick={() => {
                                                        setShowVendorModal(true);
                                                        setShowVendorDropdown(false);
                                                    }}
                                                >
                                                    + Create New Vendor
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Date */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                            Indent Date *
                                        </label>
                                        <div className="relative">
                                            <input
                                                ref={dateRef}
                                                type="date"
                                                aria-label="Indent Date"
                                                className={`w-full px-3.5 py-2.5 text-sm border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.indentDate
                                                    ? "border-red-300 bg-red-50"
                                                    : "border-gray-300 bg-white hover:border-gray-400"
                                                    }`}
                                                value={indentDate}
                                                onChange={(e) => {
                                                    setIndentDate(e.target.value);
                                                    if (errors.indentDate) {
                                                        setErrors(prev => ({ ...prev, indentDate: "" }));
                                                    }
                                                }}
                                            />
                                            <svg
                                                onClick={() => dateRef.current?.showPicker?.()}
                                                className="absolute right-3 top-3 w-5 h-5 text-gray-400 cursor-pointer hover:text-gray-600 transition-colors"
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                        </div>
                                        {errors.indentDate && (
                                            <p className="text-xs text-red-600 mt-1">{errors.indentDate}</p>
                                        )}
                                    </div>

                                    {/* PO Number */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                            Customer PO Number
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="Enter PO number"
                                            className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-lg hover:border-gray-400 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                            value={poNumber}
                                            onChange={(e) => {
                                                setPoNumber(e.target.value);
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* LINE ITEMS SECTION */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                            <div className="px-8 py-6 border-b border-gray-200">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                                        <svg className="w-5 h-5 mr-2 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                            <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 6H6.28l-.31-1.243A1 1 0 005 4H3z" />
                                        </svg>
                                        Line Items
                                    </h2>
                                    {errors.items && (
                                        <p className="text-xs text-red-600">{errors.items}</p>
                                    )}
                                </div>
                            </div>

                            <div className="px-8 py-6">
                                {/* Items Table */}
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b border-gray-200 bg-gray-50">
                                                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">#</th>
                                                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Product</th>

                                                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Quantity</th>
                                                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {items.map((item, index) => (
                                                <React.Fragment key={index}>
                                                    <tr className="border-b border-gray-200">
                                                        <td className="px-4 py-3 text-sm text-gray-600 font-medium">
                                                            {index + 1}
                                                        </td>

                                                        <td className="px-4 py-3">
                                                            <div className="space-y-2">
                                                                <select
                                                                    aria-label="Select product"
                                                                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                                                                    value={item.product_id ?? ""}
                                                                    onChange={(e) => {
                                                                        if (e.target.value === "new") {
                                                                            setShowModal(true);
                                                                        } else {
                                                                            selectProduct(index, Number(e.target.value));
                                                                        }
                                                                    }}
                                                                >
                                                                    <option value="">Select product</option>
                                                                    {products.map((p) => (
                                                                        <option key={p.id} value={p.id}>
                                                                            {p.name}
                                                                        </option>
                                                                    ))}
                                                                    <option value="new">+ Create Product</option>
                                                                </select>

                                                                <textarea
                                                                    rows={2}
                                                                    placeholder="Product description"
                                                                    className="w-full px-3 py-2 text-xs border border-gray-200 rounded-md focus:ring-1 focus:ring-blue-500"
                                                                    value={item.product_description}
                                                                    onChange={(e) =>
                                                                        updateItem(index, "product_description", e.target.value)
                                                                    }
                                                                />
                                                            </div>
                                                        </td>

                                                        <td className="px-4 py-3">
                                                            <input
                                                                type="number"
                                                                min={1}
                                                                aria-label="Quantity"
                                                                className="w-20 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                                                value={item.quantity}
                                                                onChange={(e) =>
                                                                    updateItem(index, "quantity", Number(e.target.value))
                                                                }
                                                            />
                                                        </td>

                                                        <td className="px-4 py-3">
                                                            <button
                                                                type="button"
                                                                onClick={() => removeItem(index)}
                                                                className="text-red-600 hover:text-red-800 text-sm font-medium"
                                                            >
                                                                Remove
                                                            </button>
                                                        </td>
                                                    </tr>
                                                </React.Fragment>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                <button
                                    type="button"
                                    onClick={addItem}
                                    className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                                >
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                                    </svg>
                                    Add Line Item
                                </button>
                            </div>
                        </div>

                        {/* NOTES SECTION */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                            <div className="px-8 py-6 border-b border-gray-200">
                                <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                                    <svg className="w-5 h-5 mr-2 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M4 4a2 2 0 012-2h6a2 2 0 012 2v12a1 1 0 110 2h-7a1 1 0 110-2h7V4z" />
                                    </svg>
                                    Additional Notes
                                </h2>
                            </div>
                            <div className="px-8 py-6 space-y-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                        Notes
                                    </label>
                                    <textarea
                                        className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-lg hover:border-gray-400 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                        rows={4}
                                        placeholder="Add any special instructions or notes about this indent..."
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                        Attach Supporting Document
                                    </label>
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="file"
                                            accept=".pdf,.png,.jpg,.jpeg"
                                            multiple
                                            aria-label="Attach Supporting Document"
                                            onChange={(e) => {
                                                if (e.target.files) {
                                                    setDocuments(Array.from(e.target.files));
                                                }
                                            }}
                                            className="block w-full text-sm text-gray-500
                                                file:mr-4 file:py-2.5 file:px-4
                                                file:rounded-lg file:border-0
                                                file:text-sm file:font-medium
                                                file:bg-blue-50 file:text-blue-700
                                                hover:file:bg-blue-100
                                                transition-colors cursor-pointer"
                                        />
                                        {documents && documents.length > 0 && (
                                            <div className="flex flex-col">
                                                {documents.map((d, idx) => (
                                                    <span key={idx} className="text-sm text-green-600 font-medium flex items-center gap-1">
                                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                        </svg>
                                                        {d.name}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-xs text-gray-500 mt-2">
                                        Supported formats: PDF, PNG, JPG, JPEG (Max 10MB)
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* SUMMARY SECTION */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="bg-white rounded-lg border border-gray-200 p-4">
                                <p className="text-gray-600 text-sm">Total Products</p>
                                <p className="text-3xl font-bold text-blue-600 mt-1">{totalProducts}</p>
                            </div>
                            <div className="bg-white rounded-lg border border-gray-200 p-4">
                                <p className="text-gray-600 text-sm">Total Quantity</p>
                                <p className="text-3xl font-bold text-green-600 mt-1">{totalQty}</p>
                            </div>
                            <div className="bg-white rounded-lg border border-gray-200 p-4">
                                <p className="text-gray-600 text-sm">Customer</p>
                                <p className="text-lg font-semibold text-gray-900 mt-1 truncate">{customerName || "-"}</p>
                            </div>
                            <div className="bg-white rounded-lg border border-gray-200 p-4">
                                <p className="text-gray-600 text-sm">Preferred Vendor</p>
                                <p className="text-lg font-semibold text-gray-900 mt-1 truncate">{preferredVendor || "-"}</p>
                            </div>
                        </div>

                        {/* ACTION BUTTONS */}
                        <div className="flex justify-end gap-3">
                            {/* CANCEL BUTTON */}
                            <button
                                type="button"
                                onClick={() => navigate(`/indents/${id}`)}
                                disabled={isSubmitting}
                                className="px-6 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Cancel
                            </button>

                            {/* SAVE AS DRAFT BUTTON */}
                            <button
                                type="button"
                                onClick={() => submitIndent("draft")}
                                disabled={isSubmitting}
                                className="px-6 py-2.5 text-sm font-medium text-white bg-gray-600 rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                            >
                                {isSubmitting ? (
                                    <>
                                        <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                            <path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" />
                                        </svg>
                                        Save as Draft
                                    </>
                                )}
                            </button>

                            {/* UPDATE & SUBMIT BUTTON */}
                            <button
                                type="button"
                                onClick={() => submitIndent("submitted")}
                                disabled={isSubmitting}
                                className="px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                            >
                                {isSubmitting ? (
                                    <>
                                        <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                        Updating...
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 1113.8 1.776.75.75 0 01-1.5-.172A5.5 5.5 0 105.75 4.5H7a.75.75 0 000-1.5H4a.75.75 0 00-.75.75v3a.75.75 0 001.5 0V2a1 1 0 011-1z" clipRule="evenodd" />
                                        </svg>
                                        Update & Submit
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* CUSTOMER MODAL */}
                    {showCustomerModal && (
                        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                            <div className="bg-white rounded-xl shadow-lg max-w-lg w-full">
                                <div className="px-6 py-4 border-b border-gray-200">
                                    <h2 className="text-lg font-semibold text-gray-900">Create Customer</h2>
                                </div>

                                <div className="p-6 space-y-4">
                                    {/* Company */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Company Name *</label>
                                        <input
                                            placeholder="Company Name"
                                            className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            value={newCustomer.company_name}
                                            onChange={(e) => setNewCustomer({ ...newCustomer, company_name: e.target.value })}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">GSTIN</label>
                                        <input
                                            placeholder="GSTIN"
                                            className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            value={newCustomer.gstin}
                                            onChange={(e) => setNewCustomer({ ...newCustomer, gstin: e.target.value })}
                                        />
                                    </div>

                                    {/* Location */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Location Name *</label>
                                        <input
                                            placeholder="Location Name"
                                            className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            value={newCustomer.location_name}
                                            onChange={(e) => setNewCustomer({ ...newCustomer, location_name: e.target.value })}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Address</label>
                                        <input
                                            placeholder="Address"
                                            className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            value={newCustomer.address}
                                            onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">City</label>
                                        <input
                                            placeholder="City"
                                            className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            value={newCustomer.city}
                                            onChange={(e) => setNewCustomer({ ...newCustomer, city: e.target.value })}
                                        />
                                    </div>

                                    {/* Contact */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Contact Person *</label>
                                        <input
                                            placeholder="Contact Person"
                                            className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            value={newCustomer.contact_name}
                                            onChange={(e) => setNewCustomer({ ...newCustomer, contact_name: e.target.value })}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Contact Email</label>
                                        <input
                                            placeholder="Contact Email"
                                            className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            value={newCustomer.contact_email}
                                            onChange={(e) => setNewCustomer({ ...newCustomer, contact_email: e.target.value })}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Contact Phone</label>
                                        <input
                                            placeholder="Contact Phone"
                                            className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            value={newCustomer.contact_phone}
                                            onChange={(e) => setNewCustomer({ ...newCustomer, contact_phone: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="px-6 py-4 flex justify-end gap-3 border-t border-gray-200">
                                    <button
                                        type="button"
                                        onClick={() => setShowCustomerModal(false)}
                                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                                    >
                                        Cancel
                                    </button>

                                    <button
                                        type="button"
                                        onClick={createCustomer}
                                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                                    >
                                        Create Customer
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* PRODUCT MODAL */}
                    {showModal && (
                        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                            <div className="bg-white rounded-xl shadow-lg max-w-md w-full">
                                <div className="px-6 py-4 border-b border-gray-200">
                                    <h2 className="text-xl font-semibold text-gray-900">Create New Product</h2>
                                </div>
                                <div className="p-6 space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                            Product Name *
                                        </label>
                                        <input
                                            placeholder="Enter product name"
                                            className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            value={newProduct.name}
                                            onChange={(e) =>
                                                setNewProduct({ ...newProduct, name: e.target.value })
                                            }
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                            Description
                                        </label>
                                        <textarea
                                            placeholder="Enter product description"
                                            className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                            rows={3}
                                            value={newProduct.description}
                                            onChange={(e) =>
                                                setNewProduct({
                                                    ...newProduct,
                                                    description: e.target.value,
                                                })
                                            }
                                        />
                                    </div>
                                </div>
                                <div className="px-6 py-4 bg-gray-50 rounded-b-xl flex justify-end gap-3">
                                    <button
                                        type="button"
                                        disabled={productCreating}
                                        onClick={() => {
                                            setShowModal(false);
                                            setNewProduct({ name: "", description: "" });
                                        }}
                                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        disabled={productCreating}
                                        onClick={createProduct}
                                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 inline-flex items-center gap-2"
                                    >
                                        {productCreating && <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>}
                                        Create Product
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* VENDOR MODAL */}
                    {showVendorModal && (
                        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                            <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full animate-in fade-in zoom-in-95">

                                <div className="px-6 py-5 border-b border-gray-200">
                                    <h2 className="text-xl font-semibold text-gray-900">
                                        Create New Vendor
                                    </h2>
                                    <p className="text-sm text-gray-500 mt-1">
                                        Add vendor details for procurement
                                    </p>
                                </div>

                                <div className="px-6 py-6 space-y-5">

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Vendor Name <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={newVendor.name}
                                            onChange={(e) =>
                                                setNewVendor({ ...newVendor, name: e.target.value })
                                            }
                                            className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                                            placeholder="Enter vendor name"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                GSTIN
                                            </label>
                                            <input
                                                type="text"
                                                value={newVendor.gst_number}
                                                onChange={(e) =>
                                                    setNewVendor({ ...newVendor, gst_number: e.target.value })
                                                }
                                                className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                                placeholder="22ABCDE1234F1Z5"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Phone
                                            </label>
                                            <input
                                                type="tel"
                                                value={newVendor.phone}
                                                onChange={(e) =>
                                                    setNewVendor({ ...newVendor, phone: e.target.value })
                                                }
                                                className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                                placeholder="9876543210"
                                            />
                                        </div>

                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Email
                                        </label>
                                        <input
                                            type="email"
                                            value={newVendor.email}
                                            onChange={(e) =>
                                                setNewVendor({ ...newVendor, email: e.target.value })
                                            }
                                            className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                            placeholder="vendor@email.com"
                                        />
                                    </div>

                                </div>

                                <div className="px-6 py-4 bg-gray-50 rounded-b-2xl flex justify-end gap-3">

                                    <button
                                        type="button"
                                        disabled={vendorCreating}
                                        onClick={() => {
                                            setShowVendorModal(false);
                                            setNewVendor({
                                                name: "",
                                                gst_number: "",
                                                phone: "",
                                                email: "",
                                            });
                                        }}
                                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                                    >
                                        Cancel
                                    </button>

                                    <button
                                        type="button"
                                        disabled={vendorCreating}
                                        onClick={createVendor}
                                        className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
                                    >
                                        {vendorCreating && (
                                            <svg
                                                className="w-4 h-4 animate-spin"
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path
                                                    strokeWidth={2}
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    d="M4 12a8 8 0 018-8"
                                                />
                                            </svg>
                                        )}
                                        Create Vendor
                                    </button>

                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </Layout>
    );
}
