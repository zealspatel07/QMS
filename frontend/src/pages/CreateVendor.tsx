import React, { useState } from "react";
import Layout from "../components/layout/Layout";
import api from "../api";
import { useNavigate } from "react-router-dom";

interface Contact {
    id: string;
    name: string;
    designation: string;
    phone: string;
    email: string;
    is_primary: boolean;
}

interface FormState {
    vendor_code: string;
    name: string;
    contact_person: string;
    phone: string;
    email: string;
    address: string;
    city: string;
    state: string;
    gst_number: string;
}

interface FormErrors {
    [key: string]: string;
}

interface ContactErrors {
    [key: string]: { [field: string]: string };
}

function FormField({
    label,
    name,
    value,
    placeholder,
    type = "text",
    required = false,
    error,
    onChange
}: any) {
    return (
        <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">
                {label}
                {required && <span className="text-red-500 ml-1">*</span>}
            </label>

            <input
                type={type}
                name={name}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                className={`w-full px-3.5 py-2.5 text-sm border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    error
                        ? "border-red-300 bg-red-50"
                        : "border-gray-300 bg-white hover:border-gray-400"
                }`}
            />

            {error && (
                <p className="text-xs text-red-600 mt-1">{error}</p>
            )}
        </div>
    );
}

function ContactField({
    label,
    value,
    placeholder,
    type = "text",
    error,
    onChange
}: {
    label: string;
    value: string;
    placeholder?: string;
    type?: string;
    error?: string;
    onChange: (e: any) => void;
}) {
    return (
        <div className="space-y-1.5">
            <label className="block text-xs font-medium text-gray-600">
                {label}
            </label>
            <input
                type={type}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                className={`w-full px-3 py-2 text-sm border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    error
                        ? "border-red-300 bg-red-50"
                        : "border-gray-300 bg-white hover:border-gray-400"
                }`}
            />
            {error && <p className="text-xs text-red-600 mt-0.5">{error}</p>}
        </div>
    );
}

export default function CreateVendor() {
    const navigate = useNavigate();

    const [form, setForm] = useState<FormState>({
        vendor_code: "",
        name: "",
        contact_person: "",
        phone: "",
        email: "",
        address: "",
        city: "",
        state: "",
        gst_number: ""
    });

    const [contacts, setContacts] = useState<Contact[]>([]);

    const [errors, setErrors] = useState<FormErrors>({});
    const [contactErrors, setContactErrors] = useState<ContactErrors>({});
    const [isLoading, setIsLoading] = useState(false);
    const [successMessage, setSuccessMessage] = useState("");
    const [errorMessage, setErrorMessage] = useState("");

    const validateForm = (): boolean => {
        const newErrors: FormErrors = {};
        const newContactErrors: ContactErrors = {};

        // Validate vendor form
        if (!form.name.trim()) {
            newErrors.name = "Vendor name is required";
        }

        if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
            newErrors.email = "Please enter a valid email address";
        }

        if (form.phone && !/^[\d\s\-+()]+$/.test(form.phone)) {
            newErrors.phone = "Please enter a valid phone number";
        }

        if (!form.gst_number.trim()) {
            newErrors.gst_number = "GST number is required";
        } else if (form.gst_number.length !== 15) {
            newErrors.gst_number = "GST number must be 15 digits";
        }

        // Validate contacts
        contacts.forEach((contact) => {
            newContactErrors[contact.id] = {};

            if (contact.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) {
                newContactErrors[contact.id].email = "Please enter a valid email address";
            }

            if (contact.phone && !/^[\d\s\-+()]+$/.test(contact.phone)) {
                newContactErrors[contact.id].phone = "Please enter a valid phone number";
            }
        });

        setErrors(newErrors);
        setContactErrors(newContactErrors);
        return Object.keys(newErrors).length === 0;
    };

    function updateField(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
        const { name, value } = e.target;
        setForm(prev => ({
            ...prev,
            [name]: value
        }));
        // Clear error for this field when user starts typing
        if (errors[name]) {
            setErrors(prev => ({
                ...prev,
                [name]: ""
            }));
        }
    }



    function updateContact(
        contactId: string,
        field: keyof Contact,
        value: string | boolean
    ) {
        setContacts(prev =>
            prev.map(contact =>
                contact.id === contactId
                    ? { ...contact, [field]: value }
                    : contact
            )
        );
        // Clear error for this field
        if (contactErrors[contactId]?.[field as string]) {
            setContactErrors(prev => ({
                ...prev,
                [contactId]: {
                    ...prev[contactId],
                    [field]: ""
                }
            }));
        }
    }

    function addContact() {
        const newContact: Contact = {
            id: crypto.randomUUID(),
            name: "",
            designation: "",
            phone: "",
            email: "",
            is_primary: false
        };
        setContacts(prev => [...prev, newContact]);
    }

    function removeContact(contactId: string) {
        // Don't allow removing if only one contact exists
        if (contacts.length <= 1) {
            alert("At least one contact must be present");
            return;
        }
        setContacts(prev => prev.filter(c => c.id !== contactId));
        setContactErrors(prev => {
            const newErrors = { ...prev };
            delete newErrors[contactId];
            return newErrors;
        });
    }

    function setPrimaryContact(contactId: string) {
        setContacts(prev =>
            prev.map(contact => ({
                ...contact,
                is_primary: contact.id === contactId
            }))
        );
    }

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setSuccessMessage("");
        setErrorMessage("");

        if (!validateForm()) {
            return;
        }

        setIsLoading(true);

        try {
            const vendorData = await api.createVendor(form);

            // Extract vendor ID from response (backend returns vendor_id)
            const vendorId = vendorData?.vendor_id;

            if (!vendorId) {
                console.error("Vendor creation response:", vendorData);
                throw new Error("Failed to get vendor ID from creation response");
            }

            // Add contacts for the newly created vendor
            for (const contact of contacts) {
                if (contact.name.trim()) {
                    await api.addVendorContact(vendorId, {
                        name: contact.name,
                        designation: contact.designation || null,
                        phone: contact.phone || null,
                        email: contact.email || null,
                        is_primary: contact.is_primary ? 1 : 0
                    });
                }
            }

            setSuccessMessage("Vendor and contacts created successfully!");
            setTimeout(() => {
                navigate("/vendors");
            }, 1500);
        } catch (err: any) {
            console.error(err);
            const errorMsg = err?.body?.error || err?.message || "Failed to create vendor. Please try again.";
            setErrorMessage(errorMsg);
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <Layout>
            <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4 sm:px-6 lg:px-8">
                <div className="max-w-4xl mx-auto">

                    {/* Header Section */}
                    <div className="mb-8">
                        <div className="flex items-center justify-between">
                            <div>
                                <h1 className="text-4xl font-bold text-gray-900 tracking-tight">
                                    Add New Vendor
                                </h1>
                                <p className="text-gray-600 mt-2">
                                    Register a new supplier in your procurement system
                                </p>
                            </div>
                            <button
                                onClick={() => navigate("/vendors")}
                                className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                ← Back
                            </button>
                        </div>
                    </div>

                    {/* Alert Messages */}
                    {successMessage && (
                        <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-800 rounded-lg flex items-center">
                            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            {successMessage}
                        </div>
                    )}

                    {errorMessage && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-800 rounded-lg flex items-center">
                            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                            {errorMessage}
                        </div>
                    )}

                    {/* Main Form Card */}
                    <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-200">

                        {/* Basic Information Section */}
                        <div className="px-8 py-6 border-b border-gray-200">
                            <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
                                <svg className="w-5 h-5 mr-2 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" />
                                </svg>
                                Basic Information
                            </h2>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <FormField
                                    label="Vendor Code"
                                    name="vendor_code"
                                    value={form.vendor_code}
                                    onChange={updateField}
                                    placeholder="e.g., VND-001 (Optional)"
                                />

                                <FormField
                                    label="Vendor Name"
                                    name="name"
                                    value={form.name}
                                    onChange={updateField}
                                    placeholder="Supplier company name"
                                    required
                                    error={errors.name}
                                />

                                <FormField
                                    label="Contact Person"
                                    name="contact_person"
                                    value={form.contact_person}
                                    onChange={updateField}
                                    placeholder="Primary contact name"
                                />

                                <FormField
                                    label="Email"
                                    name="email"
                                    type="email"
                                    value={form.email}
                                    onChange={updateField}
                                    placeholder="vendor@company.com"
                                    error={errors.email}
                                />

                                <FormField
                                    label="Phone"
                                    name="phone"
                                    value={form.phone}
                                    onChange={updateField}
                                    placeholder="+91 98765 43210"
                                    error={errors.phone}
                                />

                                <FormField
                                    label="GST Number"
                                    name="gst_number"
                                    value={form.gst_number}
                                    onChange={updateField}
                                    placeholder="15-digit GSTIN"
                                    required
                                    error={errors.gst_number}
                                />
                            </div>
                        </div>

                        {/* Location Information Section */}
                        <div className="px-8 py-6 border-b border-gray-200">
                            <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
                                <svg className="w-5 h-5 mr-2 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                                </svg>
                                Location Information
                            </h2>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                <FormField
                                    label="City"
                                    name="city"
                                    value={form.city}
                                    onChange={updateField}
                                    placeholder="e.g., Mumbai"
                                />

                                <FormField
                                    label="State"
                                    name="state"
                                    value={form.state}
                                    onChange={updateField}
                                    placeholder="e.g., Maharashtra"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                    Address
                                </label>
                                <textarea
                                    name="address"
                                    rows={4}
                                    value={form.address}
                                    onChange={updateField}
                                    placeholder="Complete office address, street, building, postal code..."
                                    className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-lg hover:border-gray-400 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 resize-none"
                                />
                            </div>
                        </div>

                        {/* Contact Information Section */}
                        <div className="px-8 py-6 border-b border-gray-200">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                                    <svg className="w-5 h-5 mr-2 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.766l.296 1.486a1 1 0 01-.502 1.21l-1.42.71a7.001 7.001 0 006.3 6.3l.71-1.42a1 1 0 011.21-.502l1.486.296a1 1 0 01.766.986V17a1 1 0 01-1 1h-2.57C6.553 18 3 14.447 3 10V5a1 1 0 011-1h2.153z" />
                                    </svg>
                                    Vendor Contacts
                                </h2>
                            </div>

                            <div className="space-y-4">
                                {contacts.map((contact, index) => (
                                    <div
                                        key={contact.id}
                                        className="p-4 border border-gray-200 rounded-lg bg-gray-50 space-y-4"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="text-sm font-medium text-gray-700">
                                                Contact #{index + 1}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={contact.is_primary}
                                                        onChange={() =>
                                                            setPrimaryContact(contact.id)
                                                        }
                                                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                                    />
                                                    <span className="text-xs font-medium text-gray-600">
                                                        Primary
                                                    </span>
                                                </label>
                                                {contacts.length > 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => removeContact(contact.id)}
                                                        className="text-red-600 hover:text-red-800 hover:bg-red-50 p-1.5 rounded transition-colors"
                                                        title="Remove contact"
                                                    >
                                                        <svg
                                                            className="w-4 h-4"
                                                            fill="currentColor"
                                                            viewBox="0 0 20 20"
                                                        >
                                                            <path
                                                                fillRule="evenodd"
                                                                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                                                                clipRule="evenodd"
                                                            />
                                                        </svg>
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <ContactField
                                                label="Contact Name *"
                                                value={contact.name}
                                                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                                    updateContact(contact.id, "name", e.target.value)
                                                }
                                                placeholder="Full name"
                                                error={contactErrors[contact.id]?.name}
                                            />

                                            <ContactField
                                                label="Designation"
                                                value={contact.designation}
                                                onChange={(e) =>
                                                    updateContact(contact.id, "designation", e.target.value)
                                                }
                                                placeholder="e.g., Manager"
                                            />

                                            <ContactField
                                                label="Phone"
                                                value={contact.phone}
                                                onChange={(e) =>
                                                    updateContact(contact.id, "phone", e.target.value)
                                                }
                                                placeholder="+91 98765 43210"
                                                error={contactErrors[contact.id]?.phone}
                                            />

                                            <ContactField
                                                label="Email"
                                                type="email"
                                                value={contact.email}
                                                onChange={(e) =>
                                                    updateContact(contact.id, "email", e.target.value)
                                                }
                                                placeholder="contact@company.com"
                                                error={contactErrors[contact.id]?.email}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <button
                                type="button"
                                onClick={addContact}
                                className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                            >
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path
                                        fillRule="evenodd"
                                        d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z"
                                        clipRule="evenodd"
                                    />
                                </svg>
                                Add Another Contact
                            </button>
                        </div>

                        {/* Action Buttons */}
                        <div className="px-8 py-6 bg-gray-50 rounded-b-xl flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => navigate("/vendors")}
                                disabled={isLoading}
                                className="px-6 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Cancel
                            </button>

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="px-8 py-2.5 text-sm font-semibold text-white bg-blue-600 border border-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                            >
                                {isLoading ? (
                                    <>
                                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                        Creating...
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                                        </svg>
                                        Create Vendor
                                    </>
                                )}
                            </button>
                        </div>
                    </form>

                    {/* Help Text */}
                    <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-sm text-blue-900">
                            <span className="font-semibold">💡 Tip:</span> Fields marked with <span className="text-red-500">*</span> are required. You can add multiple contacts and mark one as primary. Additional vendor details like ratings can be added later.
                        </p>
                    </div>
                </div>
            </div>
        </Layout>
    );
}