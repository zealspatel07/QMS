import { forwardRef, useImperativeHandle, useState } from "react";
import api from "../../api";
import { toast } from "react-toastify";
import type { Customer, CustomerLocation, CustomerContact } from "../../types/crm";
import { ModalShell, inputClass, textareaClass, PrimaryButton } from "./enquiryUi";
import { Building2, MapPin, Package, UserPlus } from "lucide-react";

export type EnquiryProductLite = {
  id: number;
  name: string;
  description?: string;
  uom?: string;
  unit_price?: number;
  tax_rate?: number;
  hsn_code?: string;
};

export type EnquiryMasterToolkitRef = {
  /** Open product modal and optionally attach the saved product to this line item row. */
  openProductForRow: (rowId: string | null) => void;
};

export type EnquiryMasterModalsProps = {
  customers: Customer[];
  setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>;
  selectedCustomer: Customer | null;
  setSelectedCustomer: (c: Customer | null) => void;
  locations: CustomerLocation[];
  setLocations: React.Dispatch<React.SetStateAction<CustomerLocation[]>>;
  selectedLocation: CustomerLocation | null;
  setSelectedLocation: (l: CustomerLocation | null) => void;
  contacts: CustomerContact[];
  setContacts: React.Dispatch<React.SetStateAction<CustomerContact[]>>;
  selectedContact: CustomerContact | null;
  setSelectedContact: (c: CustomerContact | null) => void;
  products: EnquiryProductLite[];
  setProducts: React.Dispatch<React.SetStateAction<EnquiryProductLite[]>>;
  /** Fired after product save; `rowId` set when modal was opened from a line row. */
  onProductCreated?: (product: EnquiryProductLite, rowId: string | null) => void;
  variant?: "full" | "compact";
  disabled?: boolean;
};

type ModalKey = "customer" | "location" | "contact" | "product" | null;

const btnBase =
  "inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold transition shadow-sm disabled:opacity-45 disabled:pointer-events-none";
const btnPrimary = "border-indigo-200 bg-gradient-to-br from-indigo-600 to-violet-600 text-white hover:from-indigo-700 hover:to-violet-700";
const btnMuted = "border-slate-200 bg-white text-slate-800 hover:bg-slate-50";

function normalizeProduct(raw: any): EnquiryProductLite {
  return {
    id: Number(raw?.id ?? raw?._id),
    name: raw?.name ?? raw?.product_name ?? "",
    description: raw?.description ?? "",
    uom: raw?.uom ?? "NOS",
    unit_price: Number(raw?.unit_price ?? 0),
    tax_rate: Number(raw?.tax_rate ?? 18),
    hsn_code: raw?.hsn_code ?? "",
  };
}

const EnquiryMasterModals = forwardRef<EnquiryMasterToolkitRef, EnquiryMasterModalsProps>(function EnquiryMasterModals(p, ref) {
  const [open, setOpen] = useState<ModalKey>(null);
  const [productSubmitting, setProductSubmitting] = useState(false);
  const [productAttachRowId, setProductAttachRowId] = useState<string | null>(null);

  const [customerForm, setCustomerForm] = useState({ company_name: "", gstin: "", address: "" });
  const [locationForm, setLocationForm] = useState({ location_name: "", gstin: "", address: "", city: "", state: "" });
  const [contactForm, setContactForm] = useState({ contact_name: "", phone: "", email: "" });
  const [productForm, setProductForm] = useState({
    name: "",
    description: "",
    uom: "NOS",
    unit_price: "",
    tax_rate: "18",
    hsn_code: "",
  });

  const close = () => setOpen(null);
  const compact = p.variant === "compact";
  const off = Boolean(p.disabled);

  useImperativeHandle(
    ref,
    () => ({
      openProductForRow: (rowId: string | null) => {
        if (off) return;
        setProductAttachRowId(rowId);
        setProductForm({ name: "", description: "", uom: "NOS", unit_price: "", tax_rate: "18", hsn_code: "" });
        setOpen("product");
      },
    }),
    [off],
  );

  const openCustomer = () => {
    if (off) return;
    setCustomerForm({ company_name: "", gstin: "", address: "" });
    setOpen("customer");
  };
  const openLocation = () => {
    if (off) return;
    if (!p.selectedCustomer) {
      toast.warn("Select or add a customer first.");
      return;
    }
    setLocationForm({ location_name: "", gstin: "", address: "", city: "", state: "" });
    setOpen("location");
  };
  const openContact = () => {
    if (off) return;
    if (!p.selectedLocation) {
      toast.warn("Select a site / location first.");
      return;
    }
    setContactForm({ contact_name: "", phone: "", email: "" });
    setOpen("contact");
  };
  const openProductToolbar = () => {
    if (off) return;
    setProductAttachRowId(null);
    setProductForm({ name: "", description: "", uom: "NOS", unit_price: "", tax_rate: "18", hsn_code: "" });
    setOpen("product");
  };

  async function submitCustomer() {
    if (!customerForm.company_name.trim()) {
      toast.warn("Company name is required.");
      return;
    }
    try {
      const saved: any = await api.addCustomer(customerForm);
      const c: Customer = {
        id: saved.id,
        company_name: saved.company_name ?? customerForm.company_name,
        gstin: saved.gstin,
        address: saved.address,
      };
      p.setCustomers((prev) => [...prev, c]);
      p.setSelectedCustomer(c);
      toast.success("Customer saved to master — available everywhere.");
      close();
    } catch (e) {
      console.error(e);
      toast.error("Could not save customer.");
    }
  }

  async function submitLocation() {
    if (!p.selectedCustomer) return;
    if (!locationForm.location_name.trim()) {
      toast.warn("Location name is required.");
      return;
    }
    try {
      const saved: any = await api.addCustomerLocation(p.selectedCustomer.id, locationForm);
      const loc: CustomerLocation = {
        id: saved.id,
        customer_id: p.selectedCustomer.id,
        location_name: saved.location_name ?? locationForm.location_name,
        gstin: saved.gstin,
        address: saved.address,
        city: saved.city,
        state: saved.state,
        is_active: 1,
      };
      p.setLocations((prev) => [...prev, loc]);
      p.setSelectedLocation(loc);
      p.setContacts([]);
      p.setSelectedContact(null);
      toast.success("Site saved — linked to this customer.");
      close();
    } catch (e) {
      console.error(e);
      toast.error("Could not save location.");
    }
  }

  async function submitContact() {
    if (!p.selectedLocation) return;
    if (!contactForm.contact_name.trim()) {
      toast.warn("Contact name is required.");
      return;
    }
    try {
      const saved: any = await api.addCustomerContact(p.selectedLocation.id, {
        contact_name: contactForm.contact_name,
        phone: contactForm.phone || undefined,
        email: contactForm.email || undefined,
      });
      const ct: CustomerContact = {
        id: saved.id,
        location_id: p.selectedLocation.id,
        contact_name: saved.contact_name ?? contactForm.contact_name,
        phone: saved.phone,
        email: saved.email,
        is_primary: saved.is_primary ?? 0,
        is_active: 1,
      };
      p.setContacts((prev) => [...prev, ct]);
      p.setSelectedContact(ct);
      toast.success("Contact saved — available for quotations.");
      close();
    } catch (e) {
      console.error(e);
      toast.error("Could not save contact.");
    }
  }

  async function submitProduct() {
    if (!productForm.name.trim()) {
      toast.warn("Product name is required.");
      return;
    }
    setProductSubmitting(true);
    try {
      const payload = {
        name: productForm.name.trim(),
        description: productForm.description || "",
        uom: productForm.uom || "NOS",
        unit_price: Number(productForm.unit_price || 0),
        tax_rate: Number(productForm.tax_rate || 0),
        hsn_code: productForm.hsn_code || "",
        status: "active",
      };
      const response: any = await api.addProduct(payload);
      const raw = response?.product ?? response;
      const normalized = normalizeProduct(raw);
      if (!Number.isFinite(normalized.id) || !normalized.name) {
        throw new Error("Invalid product response");
      }
      p.setProducts((prev) => {
        if (prev.some((x) => x.id === normalized.id)) return prev;
        return [...prev, normalized];
      });
      const rowId = productAttachRowId;
      p.onProductCreated?.(normalized, rowId);
      toast.success(rowId ? "Product saved and applied to this line." : "Product saved — appears in catalogue & enquiry lines.");
      setProductAttachRowId(null);
      close();
    } catch (e) {
      console.error(e);
      toast.error("Could not save product.");
    } finally {
      setProductSubmitting(false);
    }
  }

  return (
    <>
      <div className={`flex flex-wrap gap-2 ${compact ? "justify-end" : ""}`}>
        <button type="button" className={`${btnBase} ${btnPrimary}`} onClick={openCustomer} disabled={off}>
          <Building2 className="w-4 h-4 shrink-0" />
          <span className={compact ? "hidden sm:inline" : ""}>New customer</span>
          {compact && (
            <span className="sm:hidden sr-only">New customer</span>
          )}
        </button>
        <button type="button" className={`${btnBase} ${btnMuted}`} onClick={openLocation} disabled={off || !p.selectedCustomer}>
          <MapPin className="w-4 h-4 shrink-0" />
          <span className={compact ? "hidden sm:inline" : ""}>New site</span>
          {compact && <span className="sm:hidden sr-only">New site</span>}
        </button>
        <button type="button" className={`${btnBase} ${btnMuted}`} onClick={openContact} disabled={off || !p.selectedLocation}>
          <UserPlus className="w-4 h-4 shrink-0" />
          <span className={compact ? "hidden sm:inline" : ""}>New contact</span>
          {compact && <span className="sm:hidden sr-only">New contact</span>}
        </button>
        <button type="button" className={`${btnBase} ${btnMuted}`} onClick={openProductToolbar} disabled={off}>
          <Package className="w-4 h-4 shrink-0" />
          <span className={compact ? "hidden sm:inline" : ""}>New product</span>
          {compact && <span className="sm:hidden sr-only">New product</span>}
        </button>
      </div>

      {open === "customer" && (
        <ModalShell
          title="Add customer"
          subtitle="Saved to Customers master — usable in quotations and orders."
          onClose={close}
          footer={
            <>
              <PrimaryButton variant="secondary" onClick={close}>
                Cancel
              </PrimaryButton>
              <PrimaryButton onClick={submitCustomer}>Save customer</PrimaryButton>
            </>
          }
        >
          <div>
            <label className="text-xs font-semibold text-slate-600">Company name *</label>
            <input
              className={`${inputClass} mt-1`}
              value={customerForm.company_name}
              onChange={(e) => setCustomerForm((f) => ({ ...f, company_name: e.target.value }))}
              placeholder="Registered name"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">GSTIN</label>
            <input
              className={`${inputClass} mt-1`}
              value={customerForm.gstin}
              onChange={(e) => setCustomerForm((f) => ({ ...f, gstin: e.target.value }))}
              placeholder="Optional"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">Address</label>
            <textarea
              className={`${textareaClass} mt-1`}
              rows={3}
              value={customerForm.address}
              onChange={(e) => setCustomerForm((f) => ({ ...f, address: e.target.value }))}
              placeholder="Billing / registered address"
            />
          </div>
        </ModalShell>
      )}

      {open === "location" && (
        <ModalShell
          title="Add site / location"
          subtitle={`For ${p.selectedCustomer?.company_name ?? "customer"}. Saved to master.`}
          onClose={close}
          wide
          footer={
            <>
              <PrimaryButton variant="secondary" onClick={close}>
                Cancel
              </PrimaryButton>
              <PrimaryButton onClick={submitLocation}>Save site</PrimaryButton>
            </>
          }
        >
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-slate-600">Location name *</label>
              <input
                className={`${inputClass} mt-1`}
                value={locationForm.location_name}
                onChange={(e) => setLocationForm((f) => ({ ...f, location_name: e.target.value }))}
                placeholder="e.g. Head office, Plant 2"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">GSTIN</label>
              <input
                className={`${inputClass} mt-1`}
                value={locationForm.gstin}
                onChange={(e) => setLocationForm((f) => ({ ...f, gstin: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:col-span-2">
              <div>
                <label className="text-xs font-semibold text-slate-600">City</label>
                <input
                  className={`${inputClass} mt-1`}
                  value={locationForm.city}
                  onChange={(e) => setLocationForm((f) => ({ ...f, city: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">State</label>
                <input
                  className={`${inputClass} mt-1`}
                  value={locationForm.state}
                  onChange={(e) => setLocationForm((f) => ({ ...f, state: e.target.value }))}
                />
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-slate-600">Address</label>
              <textarea
                className={`${textareaClass} mt-1`}
                rows={2}
                value={locationForm.address}
                onChange={(e) => setLocationForm((f) => ({ ...f, address: e.target.value }))}
              />
            </div>
          </div>
        </ModalShell>
      )}

      {open === "contact" && (
        <ModalShell
          title="Add contact person"
          subtitle={`At ${p.selectedLocation?.location_name ?? "location"}. Saved to master.`}
          onClose={close}
          footer={
            <>
              <PrimaryButton variant="secondary" onClick={close}>
                Cancel
              </PrimaryButton>
              <PrimaryButton onClick={submitContact}>Save contact</PrimaryButton>
            </>
          }
        >
          <div>
            <label className="text-xs font-semibold text-slate-600">Name *</label>
            <input
              className={`${inputClass} mt-1`}
              value={contactForm.contact_name}
              onChange={(e) => setContactForm((f) => ({ ...f, contact_name: e.target.value }))}
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-600">Phone</label>
              <input
                className={`${inputClass} mt-1`}
                value={contactForm.phone}
                onChange={(e) => setContactForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">Email</label>
              <input
                className={`${inputClass} mt-1`}
                type="email"
                value={contactForm.email}
                onChange={(e) => setContactForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
          </div>
        </ModalShell>
      )}

      {open === "product" && (
        <ModalShell
          title="New product"
          subtitle={
            productAttachRowId
              ? "Saved to Products — line below will pick up this SKU automatically."
              : "Saved to Products — pricing flows into quotations when you pick this SKU."
          }
          onClose={() => {
            setProductAttachRowId(null);
            close();
          }}
          wide
          footer={
            <>
              <PrimaryButton
                variant="secondary"
                onClick={() => {
                  setProductAttachRowId(null);
                  close();
                }}
              >
                Cancel
              </PrimaryButton>
              <PrimaryButton onClick={submitProduct} disabled={productSubmitting}>
                {productSubmitting ? "Saving…" : "Save product"}
              </PrimaryButton>
            </>
          }
        >
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-slate-600">Product name *</label>
              <input
                className={`${inputClass} mt-1`}
                value={productForm.name}
                onChange={(e) => setProductForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-slate-600">Description</label>
              <textarea
                className={`${textareaClass} mt-1`}
                rows={2}
                value={productForm.description}
                onChange={(e) => setProductForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">UOM</label>
              <input
                className={`${inputClass} mt-1`}
                value={productForm.uom}
                onChange={(e) => setProductForm((f) => ({ ...f, uom: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">Unit price</label>
              <input
                type="number"
                className={`${inputClass} mt-1`}
                min={0}
                step="0.01"
                value={productForm.unit_price}
                onChange={(e) => setProductForm((f) => ({ ...f, unit_price: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">Tax %</label>
              <input
                type="number"
                className={`${inputClass} mt-1`}
                value={productForm.tax_rate}
                onChange={(e) => setProductForm((f) => ({ ...f, tax_rate: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">HSN</label>
              <input
                className={`${inputClass} mt-1`}
                value={productForm.hsn_code}
                onChange={(e) => setProductForm((f) => ({ ...f, hsn_code: e.target.value }))}
              />
            </div>
          </div>
        </ModalShell>
      )}
    </>
  );
});

export default EnquiryMasterModals;
