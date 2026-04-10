
//src/components/CustomerSelect.tsx
import { useEffect, useState } from "react";
import { api } from "../api";
import { toast } from "react-toastify";
import type {
  Customer,
  CustomerLocation,
  CustomerContact,
  CreateCustomerPayload,
  CreateLocationPayload,
  CreateContactPayload,
} from "../types/crm";

interface CustomerSelectProps {
  onSelectionChange?: (state: {
    customer: Customer | null;
    location: CustomerLocation | null;
    contact: CustomerContact | null;
  }) => void;
  autoSelectPrimary?: boolean;
}

export const CustomerSelect = ({
  onSelectionChange,
  autoSelectPrimary = true,
}: CustomerSelectProps) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null
  );
  const [locations, setLocations] = useState<CustomerLocation[]>([]);
  const [selectedLocation, setSelectedLocation] =
    useState<CustomerLocation | null>(null);
  const [contacts, setContacts] = useState<CustomerContact[]>([]);
  const [selectedContact, setSelectedContact] = useState<CustomerContact | null>(
    null
  );

  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [loadingContacts, setLoadingContacts] = useState(false);

  // Modals
  const [showCreateCustomer, setShowCreateCustomer] = useState(false);
  const [showCreateLocation, setShowCreateLocation] = useState(false);
  const [showCreateContact, setShowCreateContact] = useState(false);

  // Form data
  const [customerForm, setCustomerForm] = useState<CreateCustomerPayload>({
    company_name: "",
  });
  const [locationForm, setLocationForm] = useState<CreateLocationPayload>({
    location_name: "",
  });
  const [contactForm, setContactForm] = useState<CreateContactPayload>({
    contact_name: "",
  });

  // Edit mode
  const [editingContact, setEditingContact] = useState<CustomerContact | null>(
    null
  );

  // Load customers on mount
  useEffect(() => {
    fetchCustomers();
  }, []);

  // Load locations when customer changes
  useEffect(() => {
    if (selectedCustomer) {
        
      fetchLocations(selectedCustomer.id);
    } else {
      setLocations([]);
      setSelectedLocation(null);
      setContacts([]);
      setSelectedContact(null);
    }
  }, [selectedCustomer]);

  // Load contacts when location changes
  useEffect(() => {
    if (selectedLocation) {
        setSelectedContact(null);
      fetchContacts(selectedLocation.id);
    } else {
      setContacts([]);
      setSelectedContact(null);
    }
  }, [selectedLocation]);

  // Auto-select primary contact
  useEffect(() => {
  if (!autoSelectPrimary) return;

  if (contacts.length === 0) {
    setSelectedContact(null);
    return;
  }

  const primary = contacts.find((c) => c.is_primary === 1) || null;

  setSelectedContact(primary);
}, [contacts, autoSelectPrimary]);

  // Notify parent on selection change
  useEffect(() => {
    onSelectionChange?.({
      customer: selectedCustomer,
      location: selectedLocation,
      contact: selectedContact,
    });
  }, [selectedCustomer, selectedLocation, selectedContact, onSelectionChange]);

  useEffect(() => {
  onSelectionChange?.({
    customer: selectedCustomer,
    location: selectedLocation,
    contact: selectedLocation ? selectedContact : null,
  });
}, [selectedCustomer, selectedLocation, selectedContact, onSelectionChange]);

  // ===== Fetch Functions =====

  const fetchCustomers = async () => {
    try {
      setLoadingCustomers(true);
      const data = await api.getCustomers();
      setCustomers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error loading customers:", err);
      toast.error("Failed to load customers");
    } finally {
      setLoadingCustomers(false);
    }
  };

  const fetchLocations = async (customerId: number) => {
    try {
      setLoadingLocations(true);
      const data = await api.getCustomerLocations(customerId);
      setLocations(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error loading locations:", err);
      toast.error("Failed to load locations");
    } finally {
      setLoadingLocations(false);
    }
  };

  const fetchContacts = async (locationId: number) => {
    try {
      setLoadingContacts(true);
      const data = await api.getCustomerContacts(locationId);
      setContacts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error loading contacts:", err);
      toast.error("Failed to load contacts");
    } finally {
      setLoadingContacts(false);
    }
  };

  // ===== Create Functions =====

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerForm.company_name.trim()) {
      toast.error("Company name is required");
      return;
    }

    try {
      const newCustomer = await api.addCustomer(customerForm);
      setCustomers([newCustomer, ...customers]);
      setSelectedCustomer(newCustomer);
      setCustomerForm({ company_name: "" });
      setShowCreateCustomer(false);
      toast.success("Customer created successfully");
    } catch (err) {
      console.error("Error creating customer:", err);
      toast.error("Failed to create customer");
    }
  };

  const handleCreateLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer || !locationForm.location_name.trim()) {
      toast.error("Location name is required");
      return;
    }

    try {
      const newLocation = await api.addCustomerLocation(
        selectedCustomer.id,
        locationForm
      );
      setLocations([newLocation, ...locations]);
      setSelectedLocation(newLocation);
      setLocationForm({ location_name: "" });
      setShowCreateLocation(false);
      toast.success("Location created successfully");
    } catch (err) {
      console.error("Error creating location:", err);
      toast.error("Failed to create location");
    }
  };

  const handleCreateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLocation || !contactForm.contact_name.trim()) {
      toast.error("Contact name is required");
      return;
    }

    try {
      const newContact = await api.addCustomerContact(
        selectedLocation.id,
        contactForm
      );
      setContacts([newContact, ...contacts]);
      if (contactForm.is_primary) {
        setSelectedContact(newContact);
      }
      setContactForm({ contact_name: "" });
      setShowCreateContact(false);
      toast.success("Contact created successfully");
    } catch (err) {
      console.error("Error creating contact:", err);
      toast.error("Failed to create contact");
    }
  };

  // ===== Edit/Delete Functions =====

  const handleEditContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingContact || !selectedLocation) return;

    try {
      const updated = await api.updateCustomerContact(
        selectedLocation.id,
        editingContact.id,
        editingContact
      );
      setContacts(
        contacts.map((c) => (c.id === updated.id ? updated : c))
      );
      setEditingContact(null);
      if (selectedContact?.id === updated.id) {
        setSelectedContact(updated);
      }
      toast.success("Contact updated successfully");
    } catch (err) {
      console.error("Error updating contact:", err);
      toast.error("Failed to update contact");
    }
  };

  const handleDeleteContact = async (contactId: number) => {
    if (!selectedLocation) return;
    if (
      !window.confirm(
        "Are you sure you want to delete this contact? (Soft delete)"
      )
    ) {
      return;
    }

    try {
      await api.deleteCustomerContact(selectedLocation.id, contactId);
      setContacts(contacts.filter((c) => c.id !== contactId));
      if (selectedContact?.id === contactId) {
        setSelectedContact(null);
      }
      toast.success("Contact deleted successfully");
    } catch (err) {
      console.error("Error deleting contact:", err);
      toast.error("Failed to delete contact");
    }
  };

  return (
    <div className="space-y-6 p-4 bg-white rounded-lg border border-gray-200">
      {/* CUSTOMER SELECTION */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Customer <span className="text-red-500">*</span>
        </label>
        <div className="flex gap-2">
          <select
            aria-label="Select customer company"
            value={selectedCustomer?.id || ""}
            onChange={(e) => {
              const cust = customers.find(
                (c) => c.id === Number(e.target.value)
              );
              setSelectedCustomer(cust || null);
            }}
            disabled={loadingCustomers}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">
              {loadingCustomers ? "Loading..." : "Choose a customer"}
            </option>
            {customers.map((cust) => (
              <option key={cust.id} value={cust.id}>
                {cust.company_name}
              </option>
            ))}
          </select>
          <button
            onClick={() => setShowCreateCustomer(true)}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
          >
            + New
          </button>
        </div>
      </div>

      {/* LOCATION SELECTION */}
      {selectedCustomer && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Location <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-2">
            <select
              aria-label="Select location or plant"
              value={selectedLocation?.id || ""}
              onChange={(e) => {
                const loc = locations.find(
                  (l) => l.id === Number(e.target.value)
                );
                setSelectedLocation(loc || null);
              }}
              disabled={loadingLocations}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">
                {loadingLocations ? "Loading..." : "Choose a location"}
              </option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.location_name} {loc.address ? `- ${loc.address}` : ""}
                </option>
              ))}
            </select>
            <button
              onClick={() => setShowCreateLocation(true)}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
            >
              + New
            </button>
          </div>
        </div>
      )}

      {/* CONTACT SELECTION */}
      {selectedLocation && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Contact <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-2 mb-3">
            <select
              aria-label="Select contact person"
              value={selectedContact?.id || ""}
              onChange={(e) => {
                const cont = contacts.find(
                  (c) => c.id === Number(e.target.value)
                );
                setSelectedContact(cont || null);
              }}
              disabled={loadingContacts}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">
                {loadingContacts ? "Loading..." : "Choose a contact"}
              </option>
              {contacts.map((cont) => (
                <option key={cont.id} value={cont.id}>
                  {cont.contact_name}
                  {cont.is_primary === 1 ? " ⭐ (Primary)" : ""}
                </option>
              ))}
            </select>
            <button
              onClick={() => setShowCreateContact(true)}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
            >
              + New
            </button>
          </div>

          {/* Contact Details */}
          {selectedContact && (
            <div className="p-3 bg-gray-50 rounded-md border border-gray-200">
              {editingContact?.id === selectedContact.id ? (
                <form onSubmit={handleEditContact} className="space-y-3">
                  <input
                    type="text"
                    value={editingContact.contact_name}
                    onChange={(e) =>
                      setEditingContact({
                        ...editingContact,
                        contact_name: e.target.value,
                      })
                    }
                    className="w-full px-2 py-1 border border-gray-300 rounded"
                    placeholder="Contact name"
                  />
                  <input
                    type="text"
                    value={editingContact.phone || ""}
                    onChange={(e) =>
                      setEditingContact({
                        ...editingContact,
                        phone: e.target.value,
                      })
                    }
                    className="w-full px-2 py-1 border border-gray-300 rounded"
                    placeholder="Phone"
                  />
                  <input
                    type="email"
                    value={editingContact.email || ""}
                    onChange={(e) =>
                      setEditingContact({
                        ...editingContact,
                        email: e.target.value,
                      })
                    }
                    className="w-full px-2 py-1 border border-gray-300 rounded"
                    placeholder="Email"
                  />
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={editingContact.is_primary === 1}
                      onChange={(e) =>
                        setEditingContact({
                          ...editingContact,
                          is_primary: e.target.checked ? 1 : 0,
                        })
                      }
                    />
                    <span className="text-sm">Mark as primary</span>
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingContact(null)}
                      className="px-3 py-1 bg-gray-400 text-white rounded text-sm hover:bg-gray-500"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div>
                  <p className="font-medium">
                    {selectedContact.contact_name}
                    {selectedContact.is_primary === 1 && " ⭐"}
                  </p>
                  {selectedContact.phone && (
                    <p className="text-sm text-gray-600">
                      📞 {selectedContact.phone}
                    </p>
                  )}
                  {selectedContact.email && (
                    <p className="text-sm text-gray-600">
                      ✉️ {selectedContact.email}
                    </p>
                  )}
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => setEditingContact(selectedContact)}
                      className="px-3 py-1 bg-yellow-500 text-white rounded text-sm hover:bg-yellow-600"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() =>
                        handleDeleteContact(selectedContact.id)
                      }
                      className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* MODALS */}

      {/* Create Customer Modal */}
      {showCreateCustomer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Create New Customer</h2>
            <form onSubmit={handleCreateCustomer} className="space-y-4">
              <input
                type="text"
                value={customerForm.company_name}
                onChange={(e) =>
                  setCustomerForm({
                    ...customerForm,
                    company_name: e.target.value,
                  })
                }
                placeholder="Company Name"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
              <input
                type="text"
                value={customerForm.gstin || ""}
                onChange={(e) =>
                  setCustomerForm({ ...customerForm, gstin: e.target.value })
                }
                placeholder="GSTIN (optional)"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
              <textarea
                value={customerForm.address || ""}
                onChange={(e) =>
                  setCustomerForm({ ...customerForm, address: e.target.value })
                }
                placeholder="Address (optional)"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowCreateCustomer(false)}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Location Modal */}
      {showCreateLocation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Create New Location</h2>
            <form onSubmit={handleCreateLocation} className="space-y-4">
              <input
                type="text"
                value={locationForm.location_name}
                onChange={(e) =>
                  setLocationForm({
                    ...locationForm,
                    location_name: e.target.value,
                  })
                }
                placeholder="Location Name"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
              <input
                type="text"
                value={locationForm.gstin || ""}
                onChange={(e) =>
                  setLocationForm({ ...locationForm, gstin: e.target.value })
                }
                placeholder="GSTIN (optional)"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
              <textarea
                value={locationForm.address || ""}
                onChange={(e) =>
                  setLocationForm({ ...locationForm, address: e.target.value })
                }
                placeholder="Address (optional)"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
              <input
                type="text"
                value={locationForm.city || ""}
                onChange={(e) =>
                  setLocationForm({ ...locationForm, city: e.target.value })
                }
                placeholder="City (optional)"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
              <input
                type="text"
                value={locationForm.state || ""}
                onChange={(e) =>
                  setLocationForm({ ...locationForm, state: e.target.value })
                }
                placeholder="State (optional)"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowCreateLocation(false)}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Contact Modal */}
      {showCreateContact && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Create New Contact</h2>
            <form onSubmit={handleCreateContact} className="space-y-4">
              <input
                type="text"
                value={contactForm.contact_name}
                onChange={(e) =>
                  setContactForm({
                    ...contactForm,
                    contact_name: e.target.value,
                  })
                }
                placeholder="Contact Name"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
              <input
                type="text"
                value={contactForm.phone || ""}
                onChange={(e) =>
                  setContactForm({ ...contactForm, phone: e.target.value })
                }
                placeholder="Phone (optional)"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
              <input
                type="email"
                value={contactForm.email || ""}
                onChange={(e) =>
                  setContactForm({ ...contactForm, email: e.target.value })
                }
                placeholder="Email (optional)"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={contactForm.is_primary || false}
                  onChange={(e) =>
                    setContactForm({
                      ...contactForm,
                      is_primary: e.target.checked,
                    })
                  }
                />
                <span className="text-sm">Mark as primary contact</span>
              </label>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowCreateContact(false)}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerSelect;
