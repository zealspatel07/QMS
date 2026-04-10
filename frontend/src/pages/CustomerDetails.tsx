// src/pages/CustomerDetails.tsx

import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Layout from "../components/layout/Layout";
import { api } from "../api";
import { toast } from "react-toastify";
import { useAuth } from "../context/AuthContext";

/* ================= TYPES ================= */

type Customer = {
  id: number;
  company_name: string;
  address?: string;
  gstin?: string;
};

type Location = {
  id: number;
  location_name: string;
  gstin?: string;
  address?: string;
};

type Contact = {
  id: number;
  contact_name: string;
  phone?: string;
  email?: string;
  is_primary?: number;
};

/* ================= COMPONENT ================= */

export default function CustomerDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const customerId = Number(id);

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [contacts, setContacts] = useState<Record<number, Contact[]>>({});
  const [activeLocationId, setActiveLocationId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const { permissions } = useAuth();

  const [editContactOpen, setEditContactOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [editContactForm, setEditContactForm] = useState({
    contact_name: "",
    phone: "",
    email: "",
  });

  const [addContactOpen, setAddContactOpen] = useState(false);
  const [addContactForm, setAddContactForm] = useState({
    contact_name: "",
    phone: "",
    email: "",
    is_primary: false,
  });

  const [addLocationOpen, setAddLocationOpen] = useState(false);
  const [addLocationForm, setAddLocationForm] = useState({
    location_name: "",
    gstin: "",
    address: "",
    city: "",
    state: "",
  });

  /* ================= LOAD DATA ================= */

  useEffect(() => {
    if (!customerId) return;
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  async function loadAll() {
    try {
      setLoading(true);

      const customers = await api.getCustomers();
      const cust = customers.find((c: any) => c.id === customerId);

      if (!cust) {
        toast.error("Customer not found");
        navigate("/customers");
        return;
      }

      setCustomer(cust);

      const locs = await api.getCustomerLocations(customerId);
      setLocations(locs);

      if (locs.length > 0) {
        setActiveLocationId(locs[0].id);
      }

      const contactMap: Record<number, Contact[]> = {};
      for (const loc of locs) {
        contactMap[loc.id] = await api.getCustomerContacts(loc.id);
      }
      setContacts(contactMap);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load customer details");
    } finally {
      setLoading(false);
    }
  }

  /* ================= ADD HELPERS ================= */

  async function handleAddLocation() {
    try {
      const loc = await api.addCustomerLocation(customerId, addLocationForm);

      setLocations(prev => [loc, ...prev]);
      setActiveLocationId(loc.id);

      toast.success("Location added");
      setAddLocationOpen(false);
      setAddLocationForm({
        location_name: "",
        gstin: "",
        address: "",
        city: "",
        state: "",
      });
    } catch (err) {
      console.error(err);
      toast.error("Failed to add location");
    }
  }


  async function handleAddContact() {
    if (!activeLocationId) return;

    try {
      const contact = await api.addCustomerContact(activeLocationId, addContactForm);

      setContacts(prev => ({
        ...prev,
        [activeLocationId]: [contact, ...(prev[activeLocationId] || [])],
      }));

      toast.success("Contact added");
      setAddContactOpen(false);
      setAddContactForm({
        contact_name: "",
        phone: "",
        email: "",
        is_primary: false,
      });
    } catch (err) {
      console.error(err);
      toast.error("Failed to add contact");
    }
  }


  function handleEditContact(contact: Contact) {
    setEditingContact(contact);
    setEditContactForm({
      contact_name: contact.contact_name,
      phone: contact.phone || "",
      email: contact.email || "",
    });
    setEditContactOpen(true);
  }

  async function handleDeleteContact(contactId: number) {
    if (!activeLocationId) return;

    const confirmDelete = window.confirm(
      "Are you sure you want to delete this contact?"
    );
    if (!confirmDelete) return;

    try {
      await api.deleteCustomerContact(activeLocationId, contactId);

      setContacts(prev => ({
        ...prev,
        [activeLocationId]: prev[activeLocationId].filter(
          c => c.id !== contactId
        ),
      }));

      toast.success("Contact deleted");
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete contact");
    }
  }

  async function handleDownloadCSV() {
  try {
    const token = localStorage.getItem("token");
    if (!token) {
      toast.error("Not authenticated");
      return;
    }

    const res = await fetch(
      `${import.meta.env.VITE_API_BASE}/api/customers/${customerId}/export`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!res.ok) {
      toast.error("Failed to download CSV");
      return;
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `customer_${customerId}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();

    window.URL.revokeObjectURL(url);
  } catch (err) {
    console.error(err);
    toast.error("Download failed");
  }
}

  async function handleUpdateContact() {
    if (!activeLocationId || !editingContact) return;

    try {
      const updated = await api.updateCustomerContact(
        activeLocationId,
        editingContact.id,
        editContactForm
      );

      setContacts(prev => ({
        ...prev,
        [activeLocationId]: prev[activeLocationId].map(c =>
          c.id === editingContact.id ? updated : c
        ),
      }));

      toast.success("Contact updated");
      setEditContactOpen(false);
      setEditingContact(null);
    } catch (err) {
      console.error(err);
      toast.error("Failed to update contact");
    }
  }

  /* ================= RENDER ================= */

  if (loading) {
    return (
      <Layout>
        <div className="p-6">Loading customer details…</div>
      </Layout>
    );
  }

  if (!customer) return null;

  const activeContacts = activeLocationId
    ? contacts[activeLocationId] || []
    : [];

  const activeLocation = locations.find(l => l.id === activeLocationId);

  return (
    <Layout>
      <div className="p-6 space-y-6">

        {/* BACK */}
        <button
          onClick={() => navigate("/customers")}
          className="text-sm text-slate-500 hover:underline"
        >
          ← Back to customers
        </button>

        {/* CUSTOMER ACCOUNT HEADER */}
        <div className="bg-white border rounded-xl p-6">
          <div className="flex items-start justify-between">
  <div>
    <h1 className="text-2xl font-semibold text-slate-800">
      {customer.company_name}
    </h1>

    <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
      {customer.address && <span>{customer.address}</span>}
      {customer.gstin && (
        <span className="text-xs bg-slate-100 px-2 py-0.5 rounded">
          GSTIN: {customer.gstin}
        </span>
      )}
    </div>
  </div>

  <div className="flex gap-2">
    {permissions.isAdmin && (
      <button
        onClick={handleDownloadCSV}
        className="px-3 py-1.5 text-sm rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
      >
        Download CSV
      </button>
    )}

    <button className="px-3 py-1.5 text-sm rounded-md border text-slate-600 hover:bg-slate-50">
      Edit Customer
    </button>
  </div>
</div>
        </div>

        {/* MAIN GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* LOCATIONS */}
          <div className="bg-white border rounded-xl p-6 flex flex-col">
            {/* HEADER (FIXED) */}
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-medium">
                Locations
                <span className="ml-2 text-sm text-slate-400">
                  ({locations.length})
                </span>
              </h2>

              <button
                onClick={() => setAddLocationOpen(true)}
                className="px-3 py-1 bg-rose-500 text-white rounded-md text-sm"
              >
                + Add
              </button>
            </div>

            {/* SCROLLABLE BODY */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {locations.map(loc => (
                <div
                  key={loc.id}
                  onClick={() => setActiveLocationId(loc.id)}
                  className={`p-3 rounded-lg border cursor-pointer
          ${activeLocationId === loc.id
                      ? "bg-indigo-50 border-indigo-300"
                      : "hover:bg-slate-50"
                    }`}
                >
                  <div className="font-medium text-slate-800">
                    {loc.location_name}
                  </div>
                  <div className="text-xs text-slate-500">
                    GSTIN: {loc.gstin || "N/A"}
                  </div>
                </div>
              ))}

              {locations.length === 0 && (
                <div className="text-sm text-slate-400">
                  No locations added yet.
                </div>
              )}
            </div>
          </div>


          {/* CONTACTS (SPECIFIC LOCATION) */}
          <div className="lg:col-span-2 bg-white border rounded-xl p-6 flex flex-col">

            {/* HEADER (FIXED) */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-medium">Contacts</h2>
                {activeLocation && (
                  <p className="text-sm text-slate-500">
                    {activeLocation.location_name}
                  </p>
                )}
              </div>

              {activeLocationId && (
                <button
                  onClick={() => setAddContactOpen(true)}
                  className="px-3 py-1.5 bg-indigo-600 text-white rounded-md text-sm"
                >
                  + Add Contact
                </button>
              )}
            </div>

            {/* SCROLLABLE BODY */}
            <div className="flex-1 overflow-y-auto pr-1">
              {activeContacts.length === 0 ? (
                <div className="border border-dashed rounded-lg p-8 text-center">
                  <div className="text-sm text-slate-600 font-medium">
                    No contacts added
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    Add at least one contact for this location
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {activeContacts.map(ct => (
                    <div
                      key={ct.id}
                      className="group border rounded-xl p-4 bg-white hover:shadow-sm transition"
                    >
                      <div className="flex justify-between items-start">
                        {/* LEFT */}
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center font-semibold text-sm">
                            {ct.contact_name.slice(0, 2).toUpperCase()}
                          </div>

                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-slate-800">
                                {ct.contact_name}
                              </span>

                              {ct.is_primary && (
                                <span className="text-[11px] px-2 py-0.5 bg-green-100 text-green-700 rounded-full">
                                  Primary
                                </span>
                              )}
                            </div>

                            <div className="mt-1 space-y-0.5 text-xs text-slate-500">
                              {ct.email && <div>Email: {ct.email}</div>}
                              {ct.phone && <div>Phone: {ct.phone}</div>}
                              {!ct.email && !ct.phone && <div>—</div>}
                            </div>
                          </div>
                        </div>

                        {/* ACTIONS */}
                        <div className="opacity-0 group-hover:opacity-100 transition flex gap-2">
                          <button
                            onClick={() => handleEditContact(ct)}
                            className="text-xs px-2 py-1 rounded border text-slate-600 hover:bg-slate-50"
                          >
                            Edit
                          </button>

                          <button
                            onClick={() => handleDeleteContact(ct.id)}
                            className="text-xs px-2 py-1 rounded border border-rose-200 text-rose-600 hover:bg-rose-50"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>


        </div>
      </div>
      {editContactOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white w-full max-w-md rounded-xl p-6 space-y-4">

            {/* HEADER */}
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Edit Contact</h2>
              <button
                onClick={() => setEditContactOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            {/* FORM */}
            <div className="space-y-3">
              <input
                className="w-full border rounded px-3 py-2 text-sm"
                placeholder="Contact name"
                value={editContactForm.contact_name}
                onChange={(e) =>
                  setEditContactForm({
                    ...editContactForm,
                    contact_name: e.target.value,
                  })
                }
              />

              <input
                className="w-full border rounded px-3 py-2 text-sm"
                placeholder="Phone"
                value={editContactForm.phone}
                onChange={(e) =>
                  setEditContactForm({
                    ...editContactForm,
                    phone: e.target.value,
                  })
                }
              />

              <input
                className="w-full border rounded px-3 py-2 text-sm"
                placeholder="Email"
                value={editContactForm.email}
                onChange={(e) =>
                  setEditContactForm({
                    ...editContactForm,
                    email: e.target.value,
                  })
                }
              />
            </div>

            {/* ACTIONS */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                onClick={() => setEditContactOpen(false)}
                className="px-4 py-2 text-sm border rounded"
              >
                Cancel
              </button>

              <button
                onClick={handleUpdateContact}
                className="px-4 py-2 text-sm bg-indigo-600 text-white rounded"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {addContactOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white w-full max-w-md rounded-xl p-6 space-y-4">

            {/* HEADER */}
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Add Contact</h2>
              <button
                onClick={() => setAddContactOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            {/* FORM */}
            <div className="space-y-3">
              <input
                className="w-full border rounded px-3 py-2 text-sm"
                placeholder="Contact name *"
                value={addContactForm.contact_name}
                onChange={(e) =>
                  setAddContactForm({ ...addContactForm, contact_name: e.target.value })
                }
              />

              <input
                className="w-full border rounded px-3 py-2 text-sm"
                placeholder="Phone"
                value={addContactForm.phone}
                onChange={(e) =>
                  setAddContactForm({ ...addContactForm, phone: e.target.value })
                }
              />

              <input
                className="w-full border rounded px-3 py-2 text-sm"
                placeholder="Email"
                value={addContactForm.email}
                onChange={(e) =>
                  setAddContactForm({ ...addContactForm, email: e.target.value })
                }
              />

              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={addContactForm.is_primary}
                  onChange={(e) =>
                    setAddContactForm({ ...addContactForm, is_primary: e.target.checked })
                  }
                />
                Set as primary contact
              </label>
            </div>

            {/* ACTIONS */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                onClick={() => setAddContactOpen(false)}
                className="px-4 py-2 text-sm border rounded"
              >
                Cancel
              </button>

              <button
                onClick={handleAddContact}
                disabled={!addContactForm.contact_name.trim()}
                className="px-4 py-2 text-sm bg-indigo-600 text-white rounded disabled:opacity-50"
              >
                Add Contact
              </button>
            </div>
          </div>
        </div>
      )}

      {addLocationOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white w-full max-w-lg rounded-xl p-6 space-y-4">

            {/* HEADER */}
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Add Location</h2>
              <button
                onClick={() => setAddLocationOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            {/* FORM */}
            <div className="space-y-3">
              <input
                className="w-full border rounded px-3 py-2 text-sm"
                placeholder="Location / Plant name *"
                value={addLocationForm.location_name}
                onChange={(e) =>
                  setAddLocationForm({ ...addLocationForm, location_name: e.target.value })
                }
              />

              <input
                className="w-full border rounded px-3 py-2 text-sm"
                placeholder="GSTIN"
                value={addLocationForm.gstin}
                onChange={(e) =>
                  setAddLocationForm({ ...addLocationForm, gstin: e.target.value })
                }
              />

              <textarea
                className="w-full border rounded px-3 py-2 text-sm"
                rows={3}
                placeholder="Address"
                value={addLocationForm.address}
                onChange={(e) =>
                  setAddLocationForm({ ...addLocationForm, address: e.target.value })
                }
              />

              <div className="grid grid-cols-2 gap-3">
                <input
                  className="border rounded px-3 py-2 text-sm"
                  placeholder="City"
                  value={addLocationForm.city}
                  onChange={(e) =>
                    setAddLocationForm({ ...addLocationForm, city: e.target.value })
                  }
                />

                <input
                  className="border rounded px-3 py-2 text-sm"
                  placeholder="State"
                  value={addLocationForm.state}
                  onChange={(e) =>
                    setAddLocationForm({ ...addLocationForm, state: e.target.value })
                  }
                />
              </div>
            </div>

            {/* ACTIONS */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                onClick={() => setAddLocationOpen(false)}
                className="px-4 py-2 text-sm border rounded"
              >
                Cancel
              </button>

              <button
                onClick={handleAddLocation}
                disabled={!addLocationForm.location_name.trim()}
                className="px-4 py-2 text-sm bg-rose-500 text-white rounded disabled:opacity-50"
              >
                Add Location
              </button>
            </div>
          </div>
        </div>
      )}

    </Layout>

  );
}
