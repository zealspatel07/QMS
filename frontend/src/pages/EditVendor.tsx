import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import Layout from "../components/layout/Layout";
import api from "../api";
import { useParams, useNavigate } from "react-router-dom";

interface Contact {
  id: string;
  name: string;
  designation?: string;
  phone?: string;
  email?: string;
  is_primary?: boolean;
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

export default function EditVendor() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [vendor, setVendor] = useState<FormState>({
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
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);


  async function loadVendor() {
    try {
      const v = await api.getVendor(id!);
      const c = await api.getVendorContacts(id!);

      setVendor({
        vendor_code: v?.vendor_code || "",
        name: v?.name || "",
        contact_person: v?.contact_person || "",
        phone: v?.phone || "",
        email: v?.email || "",
        address: v?.address || "",
        city: v?.city || "",
        state: v?.state || "",
        gst_number: v?.gst_number || ""
      });

      // If no contacts exist, create a default one from contact_person
      let contactsToSet = c && Array.isArray(c) ? c : [];
      if (contactsToSet.length === 0 && v?.contact_person) {
        contactsToSet = [
          {
            id: crypto.randomUUID(),
            name: v.contact_person,
            designation: "",
            phone: v.phone || "",
            email: v.email || "",
            is_primary: true
          }
        ];
      }
      
      setContacts(contactsToSet);
      toast.success("Vendor loaded successfully");
    } catch (err) {
      console.error("Load failed", err);
      toast.error("Failed to load vendor");
    } finally {
      setLoading(false);
    }
  }
  
  useEffect(() => {
    if (id) {
      loadVendor();
    }
  }, [id]);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};
    const newContactErrors: ContactErrors = {};

    // Validate vendor form
    if (!vendor.name.trim()) {
      newErrors.name = "Vendor name is required";
    }

    if (vendor.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(vendor.email)) {
      newErrors.email = "Please enter a valid email address";
    }

    if (vendor.phone && !/^[\d\s\-+()]+$/.test(vendor.phone)) {
      newErrors.phone = "Please enter a valid phone number";
    }

    if (vendor.gst_number && vendor.gst_number.length !== 15) {
      newErrors.gst_number = "GST number must be 15 digits";
    }

    // Validate contacts - make them optional
    contacts.forEach((contact) => {
      newContactErrors[contact.id] = {};

      // Only validate filled contacts
      if (contact.name.trim()) {
        if (contact.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) {
          newContactErrors[contact.id].email = "Please enter a valid email address";
        }

        if (contact.phone && !/^[\d\s\-+()]+$/.test(contact.phone)) {
          newContactErrors[contact.id].phone = "Please enter a valid phone number";
        }
      }
    });

    // Contacts are now optional
    setErrors(newErrors);
    setContactErrors(newContactErrors);
    return Object.keys(newErrors).length === 0;
  };

  function updateField(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    setVendor(prev => ({
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
      toast.error("At least one contact must be present");
      return;
    }
    setContacts(prev => prev.filter(c => c.id !== contactId));
    setContactErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[contactId];
      return newErrors;
    });
    toast.success("Contact removed");
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Always update vendor
      const promises = [
        api.updateVendor(id!, vendor)
      ];
      
      // Only save contacts if there are any with names
      const validContacts = contacts.filter(c => c.name.trim());
      if (validContacts.length > 0) {
        promises.push(api.saveVendorContacts(id!, validContacts));
      }

      await toast.promise(
        Promise.all(promises),
        {
          loading: "Updating vendor...",
          success: "✓ Vendor updated successfully!",
          error: (err: any) => {
            const errorMsg = err?.body?.error || err?.message || "Failed to update vendor";
            return errorMsg;
          }
        }
      );
      setTimeout(() => {
        navigate(`/vendors/${id}`);
      }, 1500);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading vendor...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-full mx-auto">

          {/* Header Section */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-4xl font-bold text-gray-900 tracking-tight">
                  Edit Vendor
                </h1>
                <p className="text-gray-600 mt-2">
                  Update supplier information and contacts
                </p>
              </div>
              <button
                onClick={() => navigate(`/vendors/${id}`)}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                ← Back
              </button>
            </div>
          </div>

          {/* Main Form Card */}
          <form onSubmit={handleSave} className="bg-white rounded-xl shadow-sm border border-gray-200">

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
                  value={vendor.vendor_code}
                  onChange={updateField}
                  placeholder="e.g., VND-001 (Optional)"
                />

                <FormField
                  label="Vendor Name"
                  name="name"
                  value={vendor.name}
                  onChange={updateField}
                  placeholder="Supplier company name"
                  required
                  error={errors.name}
                />

                <FormField
                  label="Contact Person"
                  name="contact_person"
                  value={vendor.contact_person}
                  onChange={updateField}
                  placeholder="Primary contact name"
                />

                <FormField
                  label="Email"
                  name="email"
                  type="email"
                  value={vendor.email}
                  onChange={updateField}
                  placeholder="vendor@company.com"
                  error={errors.email}
                />

                <FormField
                  label="Phone"
                  name="phone"
                  value={vendor.phone}
                  onChange={updateField}
                  placeholder="+91 98765 43210"
                  error={errors.phone}
                />

                <FormField
                  label="GST Number"
                  name="gst_number"
                  value={vendor.gst_number}
                  onChange={updateField}
                  placeholder="15-digit GSTIN"
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
                  value={vendor.city}
                  onChange={updateField}
                  placeholder="e.g., Mumbai"
                />

                <FormField
                  label="State"
                  name="state"
                  value={vendor.state}
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
                  value={vendor.address}
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
                  Vendor Contacts (Optional)
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
                      <div>
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
                        label="Contact Name"
                        value={contact.name}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          updateContact(contact.id, "name", e.target.value)
                        }
                        placeholder="Full name"
                        error={contactErrors[contact.id]?.name}
                      />

                      <ContactField
                        label="Designation"
                        value={contact.designation || ""}
                        onChange={(e) =>
                          updateContact(contact.id, "designation", e.target.value)
                        }
                        placeholder="e.g., Manager"
                      />

                      <ContactField
                        label="Phone"
                        value={contact.phone || ""}
                        onChange={(e) =>
                          updateContact(contact.id, "phone", e.target.value)
                        }
                        placeholder="+91 98765 43210"
                        error={contactErrors[contact.id]?.phone}
                      />

                      <ContactField
                        label="Email"
                        type="email"
                        value={contact.email || ""}
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
                onClick={() => navigate(`/vendors/${id}`)}
                disabled={isSubmitting}
                className="px-6 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 border border-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </button>
            </div>

          </form>

        </div>
      </div>
    </Layout>
  );
}