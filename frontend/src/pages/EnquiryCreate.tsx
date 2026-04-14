import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/layout/Layout";
import api from "../api";
import { Building2, ChevronLeft, ChevronRight, Layers, Package, Sparkles } from "lucide-react";

import type { Customer, CustomerLocation, CustomerContact } from "../types/crm";
import {
  cardClass,
  inputClass,
  PageHero,
  PrimaryButton,
  SectionTitle,
  selectClass,
  textareaClass,
} from "./enquiry/enquiryUi";
import EnquiryMasterModals, { type EnquiryMasterToolkitRef, type EnquiryProductLite } from "./enquiry/EnquiryMasterModals";

type Product = {
  id: number;
  name: string;
  description?: string;
  uom?: string;
  unit_price?: number;
  tax_rate?: number;
  hsn_code?: string;
};

type EnquiryItem = {
  rowId: string;
  product_id: number | "";
  product_name: string;
  description?: string;
  qty: number | "";
  uom: string;
  notes?: string;
};

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

const STEPS = [
  { id: 0, label: "Details", desc: "Date & source" },
  { id: 1, label: "Customer", desc: "Company & contact" },
  { id: 2, label: "Items", desc: "Products & qty" },
] as const;

export default function EnquiryCreate() {
  const navigate = useNavigate();
  const masterToolkitRef = useRef<EnquiryMasterToolkitRef>(null);

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [enquiryDate, setEnquiryDate] = useState(new Date().toISOString().slice(0, 10));
  const [source, setSource] = useState("");
  const [notes, setNotes] = useState("");

  const [products, setProducts] = useState<Product[]>([]);
  const productMap = useMemo(() => {
    const m: Record<string, Product> = {};
    products.forEach((p) => (m[String(p.id)] = p));
    return m;
  }, [products]);

  const [items, setItems] = useState<EnquiryItem[]>([
    { rowId: uid(), product_id: "", product_name: "", description: "", qty: 1, uom: "NOS", notes: "" },
  ]);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [locations, setLocations] = useState<CustomerLocation[]>([]);
  const [contacts, setContacts] = useState<CustomerContact[]>([]);

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<CustomerLocation | null>(null);
  const [selectedContact, setSelectedContact] = useState<CustomerContact | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [custResp, prodResp] = await Promise.all([api.getCustomers(), api.getProducts()]);
        const custs = Array.isArray(custResp) ? custResp : custResp?.data ?? [];
        setCustomers(custs);

        const prods = Array.isArray(prodResp) ? prodResp : prodResp?.data ?? [];
        const normalized: Product[] = prods
          .map((p: any) => ({
            id: Number(p?.id ?? p?._id),
            name: p?.name ?? p?.product_name ?? "",
            description: p?.description ?? "",
            uom: p?.uom ?? "NOS",
            unit_price: Number(p?.unit_price ?? 0),
            tax_rate: Number(p?.tax_rate ?? 0),
            hsn_code: p?.hsn_code ?? "",
          }))
          .filter((p: Product) => Number.isFinite(p.id) && p.name);
        setProducts(normalized);
      } catch (e: any) {
        setErr(e?.message || "Failed to load master data");
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedCustomer?.id) {
      setLocations([]);
      setContacts([]);
      setSelectedLocation(null);
      setSelectedContact(null);
      return;
    }
    (async () => {
      try {
        const locs = await api.getCustomerLocations(selectedCustomer.id);
        setLocations(Array.isArray(locs) ? locs : []);
      } catch {
        setLocations([]);
      }
      setContacts([]);
      setSelectedLocation(null);
      setSelectedContact(null);
    })();
  }, [selectedCustomer?.id]);

  useEffect(() => {
    if (!selectedLocation?.id) {
      setContacts([]);
      setSelectedContact(null);
      return;
    }
    (async () => {
      try {
        const cts = await api.getCustomerContacts(selectedLocation.id);
        setContacts(Array.isArray(cts) ? cts : []);
      } catch {
        setContacts([]);
      }
      setSelectedContact(null);
    })();
  }, [selectedLocation?.id]);

  const handleItemChange = (rowId: string, patch: Partial<EnquiryItem>) => {
    setItems((prev) => prev.map((it) => (it.rowId === rowId ? { ...it, ...patch } : it)));
  };

  const onMasterProductCreated = (prod: EnquiryProductLite, rowId: string | null) => {
    if (!rowId) return;
    handleItemChange(rowId, {
      product_id: prod.id,
      product_name: prod.name,
      description: prod.description ?? "",
      uom: prod.uom || "NOS",
    });
  };

  const addRow = () => {
    setItems((prev) => [...prev, { rowId: uid(), product_id: "", product_name: "", description: "", qty: 1, uom: "NOS", notes: "" }]);
  };

  const removeRow = (rowId: string) => {
    setItems((prev) => prev.filter((it) => it.rowId !== rowId));
  };

  const validateStep = (s: number): string | null => {
    if (s === 0) return null;
    if (s === 1) {
      if (!selectedCustomer?.id) return "Select a customer to continue.";
      return null;
    }
    return null;
  };

  const next = () => {
    const v = validateStep(step);
    if (v) {
      setErr(v);
      return;
    }
    setErr(null);
    setStep((x) => Math.min(x + 1, STEPS.length - 1));
  };

  const back = () => {
    setErr(null);
    setStep((x) => Math.max(x - 1, 0));
  };

  const submit = async () => {
    setErr(null);
    if (!selectedCustomer?.id) {
      setErr("Please select a customer.");
      setStep(1);
      return;
    }

    const cleanedItems = items
      .map((it) => {
        const pid = it.product_id === "" ? null : Number(it.product_id);
        const p = pid ? productMap[String(pid)] : null;
        const qty = it.qty === "" ? null : Number(it.qty);

        if (!pid || !Number.isFinite(pid) || !qty || !Number.isFinite(qty) || qty <= 0) return null;

        return {
          product_id: pid,
          product_name: it.product_name || p?.name || "",
          description: it.description || p?.description || "",
          qty,
          uom: it.uom || p?.uom || "NOS",
          notes: it.notes || null,
        };
      })
      .filter(Boolean) as any[];

    if (cleanedItems.length === 0) {
      setErr("Add at least one valid line item (product + quantity).");
      setStep(2);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        customer_id: selectedCustomer.id,
        customer_location_id: selectedLocation?.id ?? null,
        customer_contact_id: selectedContact?.id ?? null,
        customer_name: selectedCustomer.company_name,
        customer_snapshot: selectedCustomer,
        location_snapshot: selectedLocation,
        contact_snapshot: selectedContact,
        enquiry_date: enquiryDate,
        source: source || null,
        notes: notes || null,
        items: cleanedItems,
      };

      const res: any = await api.createEnquiry(payload);
      if (!res?.success || !res?.id) throw new Error("Failed to create enquiry");
      navigate(`/enquiries/${res.id}`);
    } catch (e: any) {
      setErr(e?.message || "Failed to create enquiry");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-5xl mx-auto p-4 sm:p-8 space-y-6 pb-24 sm:pb-8">
        <PageHero
          eyebrow="New enquiry"
          title="Capture a sales enquiry"
          subtitle="Walk through details, customer site & contact, then line items. You can convert to a quotation from the enquiry view."
          right={
            <>
              <PrimaryButton variant="secondary" onClick={() => navigate("/enquiries")} disabled={saving}>
                Cancel
              </PrimaryButton>
              <PrimaryButton onClick={submit} disabled={saving}>
                {saving ? "Saving…" : "Save enquiry"}
              </PrimaryButton>
            </>
          }
        />

        {/* Step indicator */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          {STEPS.map((s, i) => {
            const active = step === s.id;
            const done = step > s.id;
            return (
              <div key={s.id} className="flex items-center gap-2 flex-1">
                <button
                  type="button"
                  onClick={() => {
                    if (s.id < step) {
                      setErr(null);
                      setStep(s.id);
                    }
                  }}
                  disabled={s.id >= step}
                  className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition disabled:opacity-100 ${
                    active
                      ? "border-indigo-300 bg-indigo-50 shadow-sm"
                      : done
                        ? "border-slate-200 bg-white hover:bg-slate-50 cursor-pointer"
                        : "border-slate-100 bg-slate-50/80 opacity-90 cursor-default"
                  }`}
                >
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                      done ? "bg-emerald-500 text-white" : active ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {i + 1}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{s.label}</div>
                    <div className="text-xs text-slate-500">{s.desc}</div>
                  </div>
                </button>
                {i < STEPS.length - 1 && <div className="hidden sm:block w-px h-8 bg-slate-200 shrink-0" aria-hidden />}
              </div>
            );
          })}
        </div>

        {err && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</div>}

        <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/90 via-white to-violet-50/50 p-4 sm:p-5 shadow-sm shadow-indigo-100/50">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wide text-indigo-700">Master data quick add</p>
              <p className="text-sm text-slate-600 mt-1">
                Create customers, sites, contacts, or catalogue items here — they are saved to master lists and sync into quotations and price edits when you use them.
              </p>
            </div>
            <EnquiryMasterModals
              ref={masterToolkitRef}
              customers={customers}
              setCustomers={setCustomers}
              selectedCustomer={selectedCustomer}
              setSelectedCustomer={setSelectedCustomer}
              locations={locations}
              setLocations={setLocations}
              selectedLocation={selectedLocation}
              setSelectedLocation={setSelectedLocation}
              contacts={contacts}
              setContacts={setContacts}
              selectedContact={selectedContact}
              setSelectedContact={setSelectedContact}
              products={products}
              setProducts={setProducts}
              onProductCreated={onMasterProductCreated}
              variant="compact"
              disabled={saving}
            />
          </div>
        </div>

        {step === 0 && (
          <div className={cardClass}>
            <SectionTitle icon={<Sparkles className="w-4 h-4" />} title="Enquiry details" subtitle="When and how this lead came in" />
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-xs font-semibold text-slate-500 mb-1.5">Enquiry date</div>
                <input className={inputClass} type="date" value={enquiryDate} onChange={(e) => setEnquiryDate(e.target.value)} />
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-500 mb-1.5">Source</div>
                <input
                  className={inputClass}
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  placeholder="Call, email, website, exhibition…"
                />
              </div>
              <div className="md:col-span-2">
                <div className="text-xs font-semibold text-slate-500 mb-1.5">Early notes (optional)</div>
                <textarea
                  className={textareaClass}
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Budget, timeline, competition — anything the team should know."
                />
              </div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className={cardClass}>
            <SectionTitle icon={<Building2 className="w-4 h-4" />} title="Customer & site" subtitle="Pick company, then location and contact" />
            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <div className="text-xs font-semibold text-slate-500 mb-1.5">Customer</div>
                <select
                  className={selectClass}
                  value={selectedCustomer?.id ?? ""}
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    const c = customers.find((x) => x.id === id) || null;
                    setSelectedCustomer(c);
                  }}
                >
                  <option value="">Select customer…</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.company_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="text-xs font-semibold text-slate-500 mb-1.5">Location</div>
                <select
                  className={selectClass}
                  value={selectedLocation?.id ?? ""}
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    const l = locations.find((x) => x.id === id) || null;
                    setSelectedLocation(l);
                  }}
                  disabled={!selectedCustomer}
                >
                  <option value="">Select location…</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.location_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="text-xs font-semibold text-slate-500 mb-1.5">Contact</div>
                <select
                  className={selectClass}
                  value={selectedContact?.id ?? ""}
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    const ct = contacts.find((x) => x.id === id) || null;
                    setSelectedContact(ct);
                  }}
                  disabled={!selectedLocation}
                >
                  <option value="">Select contact…</option>
                  {contacts.map((ct) => (
                    <option key={ct.id} value={ct.id}>
                      {ct.contact_name}
                      {ct.phone ? ` (${ct.phone})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="px-6 pb-6">
              <p className="text-xs text-slate-500">
                Use <span className="font-semibold text-slate-700">Master data quick add</span> above to register a new company, site, or contact — or manage everything under Customers in the sidebar.
              </p>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className={cardClass}>
            <SectionTitle icon={<Layers className="w-4 h-4" />} title="Line items" subtitle="What the customer is asking for" />
            <div className="px-6 pb-2 flex justify-end">
              <button
                type="button"
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                onClick={addRow}
              >
                + Add row
              </button>
            </div>
            <div className="px-4 pb-6 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500 border-b border-slate-100">
                  <tr>
                    <th className="px-3 py-2">Product</th>
                    <th className="px-3 py-2">Description</th>
                    <th className="px-3 py-2 text-right w-28">Qty</th>
                    <th className="px-3 py-2 w-24">UOM</th>
                    <th className="px-3 py-2">Notes</th>
                    <th className="px-3 py-2 text-right w-20">Remove</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <tr key={it.rowId} className="border-b border-slate-50 align-top hover:bg-slate-50/40">
                      <td className="px-3 py-2">
                        <div className="flex gap-1.5 items-start">
                          <select
                            className={`${selectClass} flex-1 min-w-[120px]`}
                            value={it.product_id === "" ? "" : String(it.product_id)}
                            onChange={(e) => {
                              const pid = e.target.value ? Number(e.target.value) : "";
                              const p = pid ? productMap[String(pid)] : null;
                              handleItemChange(it.rowId, {
                                product_id: pid,
                                product_name: p?.name || "",
                                description: p?.description || "",
                                uom: p?.uom || it.uom || "NOS",
                              });
                            }}
                          >
                            <option value="">Select product…</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            title="New product for this row"
                            className="shrink-0 rounded-xl border border-indigo-200 bg-indigo-50 px-2.5 py-2 text-indigo-700 hover:bg-indigo-100 transition disabled:opacity-40"
                            onClick={() => masterToolkitRef.current?.openProductForRow(it.rowId)}
                            disabled={saving}
                          >
                            <Package className="w-4 h-4" aria-hidden />
                          </button>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          className={inputClass}
                          value={it.description || ""}
                          onChange={(e) => handleItemChange(it.rowId, { description: e.target.value })}
                          placeholder="Optional"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          className={inputClass + " text-right tabular-nums"}
                          type="number"
                          min={0}
                          step="0.01"
                          value={it.qty}
                          onChange={(e) => handleItemChange(it.rowId, { qty: e.target.value === "" ? "" : Number(e.target.value) })}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input className={inputClass} value={it.uom || ""} onChange={(e) => handleItemChange(it.rowId, { uom: e.target.value })} />
                      </td>
                      <td className="px-3 py-2">
                        <input className={inputClass} value={it.notes || ""} onChange={(e) => handleItemChange(it.rowId, { notes: e.target.value })} placeholder="Optional" />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          className="text-red-600 hover:underline text-xs font-semibold disabled:opacity-40"
                          onClick={() => removeRow(it.rowId)}
                          disabled={items.length <= 1}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Mobile / desktop step nav */}
        <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur-md px-4 py-3 sm:static sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 flex items-center justify-between gap-3">
          <PrimaryButton variant="secondary" onClick={back} disabled={step === 0 || saving}>
            <span className="inline-flex items-center gap-2">
              <ChevronLeft className="w-4 h-4" />
              Back
            </span>
          </PrimaryButton>
          {step < STEPS.length - 1 ? (
            <PrimaryButton onClick={next} disabled={saving}>
              <span className="inline-flex items-center gap-2">
                Next
                <ChevronRight className="w-4 h-4" />
              </span>
            </PrimaryButton>
          ) : (
            <PrimaryButton onClick={submit} disabled={saving}>
              {saving ? "Saving…" : "Save enquiry"}
            </PrimaryButton>
          )}
        </div>
      </div>
    </Layout>
  );
}
