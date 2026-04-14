import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Layout from "../components/layout/Layout";
import api from "../api";
import { Building2, Layers, Package, Sparkles } from "lucide-react";

import type { Customer, CustomerLocation, CustomerContact } from "../types/crm";
import { cardClass, inputClass, PageHero, PrimaryButton, SectionTitle, selectClass, textareaClass } from "./enquiry/enquiryUi";
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

function toDateInput(v: any) {
  if (!v) return "";
  try {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return String(v).slice(0, 10);
    const offset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - offset).toISOString().slice(0, 10);
  } catch {
    return String(v).slice(0, 10);
  }
}

export default function EnquiryEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const masterToolkitRef = useRef<EnquiryMasterToolkitRef>(null);

  const enquiryId = Number(id);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [enquiryNo, setEnquiryNo] = useState("");
  const [status, setStatus] = useState<"open" | "quoted" | "lost" | "closed">("open");
  const [enquiryDate, setEnquiryDate] = useState("");
  const [source, setSource] = useState("");
  const [notes, setNotes] = useState("");
  const [lostReason, setLostReason] = useState("");

  const [products, setProducts] = useState<Product[]>([]);
  const productMap = useMemo(() => {
    const m: Record<string, Product> = {};
    products.forEach((p) => (m[String(p.id)] = p));
    return m;
  }, [products]);

  const [items, setItems] = useState<EnquiryItem[]>([]);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [locations, setLocations] = useState<CustomerLocation[]>([]);
  const [contacts, setContacts] = useState<CustomerContact[]>([]);

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<CustomerLocation | null>(null);
  const [selectedContact, setSelectedContact] = useState<CustomerContact | null>(null);

  useEffect(() => {
    if (!Number.isFinite(enquiryId) || enquiryId <= 0) {
      setErr("Invalid enquiry id");
      return;
    }

    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const [custResp, prodResp, enquiry] = await Promise.all([
          api.getCustomers(),
          api.getProducts(),
          api.getEnquiry(enquiryId),
        ]);

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

        setEnquiryNo(enquiry?.enquiry_no ?? "");
        setStatus((enquiry?.status as any) || "open");
        setEnquiryDate(toDateInput(enquiry?.enquiry_date));
        setSource(enquiry?.source ?? "");
        setNotes(enquiry?.notes ?? "");
        setLostReason(enquiry?.lost_reason ?? "");

        const custId = Number(enquiry?.customer_id || 0) || null;
        const locId = Number(enquiry?.customer_location_id || 0) || null;
        const conId = Number(enquiry?.customer_contact_id || 0) || null;

        const cust = custId ? custs.find((c: any) => Number(c.id) === custId) || null : null;
        setSelectedCustomer(cust);

        if (custId) {
          const locs = await api.getCustomerLocations(custId);
          const locList = Array.isArray(locs) ? locs : [];
          setLocations(locList);
          const loc = locId ? locList.find((l: any) => Number(l.id) === locId) || null : null;
          setSelectedLocation(loc);

          if (locId) {
            const cts = await api.getCustomerContacts(locId);
            const ctList = Array.isArray(cts) ? cts : [];
            setContacts(ctList);
            const ct = conId ? ctList.find((x: any) => Number(x.id) === conId) || null : null;
            setSelectedContact(ct);
          } else {
            setContacts([]);
            setSelectedContact(null);
          }
        } else {
          setLocations([]);
          setContacts([]);
          setSelectedLocation(null);
          setSelectedContact(null);
        }

        const rawItems = Array.isArray(enquiry?.items) ? enquiry.items : [];
        const normalizedItems: EnquiryItem[] =
          rawItems.length > 0
            ? rawItems.map((it: any) => {
                const pid = Number(it?.product_id ?? 0) || "";
                const p = pid ? normalized.find((x) => x.id === pid) : null;
                return {
                  rowId: uid(),
                  product_id: pid,
                  product_name: it?.product_name ?? p?.name ?? "",
                  description: it?.description ?? p?.description ?? "",
                  qty: Number(it?.qty ?? 1),
                  uom: it?.uom ?? p?.uom ?? "NOS",
                  notes: it?.notes ?? "",
                };
              })
            : [{ rowId: uid(), product_id: "", product_name: "", description: "", qty: 1, uom: "NOS", notes: "" }];
        setItems(normalizedItems);
      } catch (e: any) {
        setErr(e?.message || "Failed to load enquiry");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enquiryId]);

  const onCustomerChange = async (customerId: number | "") => {
    const c = customerId === "" ? null : customers.find((x) => x.id === customerId) || null;
    setSelectedCustomer(c);
    setSelectedLocation(null);
    setSelectedContact(null);
    setContacts([]);
    if (!c?.id) {
      setLocations([]);
      return;
    }
    try {
      const locs = await api.getCustomerLocations(c.id);
      setLocations(Array.isArray(locs) ? locs : []);
    } catch {
      setLocations([]);
    }
  };

  const onLocationChange = async (locationId: number | "") => {
    const l = locationId === "" ? null : locations.find((x) => x.id === locationId) || null;
    setSelectedLocation(l);
    setSelectedContact(null);
    if (!l?.id) {
      setContacts([]);
      return;
    }
    try {
      const cts = await api.getCustomerContacts(l.id);
      setContacts(Array.isArray(cts) ? cts : []);
    } catch {
      setContacts([]);
    }
  };

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

  const save = async () => {
    setErr(null);
    if (!selectedCustomer?.id) {
      setErr("Please select a customer.");
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
        enquiry_date: enquiryDate || null,
        source: source || null,
        notes: notes || null,
        items: cleanedItems,
        status,
        lost_reason: status === "lost" ? (lostReason || null) : null,
      };

      const res: any = await api.updateEnquiry(enquiryId, payload);
      if (!res?.success) throw new Error("Failed to update enquiry");
      navigate(`/enquiries/${enquiryId}`);
    } catch (e: any) {
      setErr(e?.message || "Failed to update enquiry");
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async () => {
    if (!window.confirm("Delete this enquiry?")) return;
    setSaving(true);
    try {
      const res: any = await api.deleteEnquiry(enquiryId);
      if (!res?.success) throw new Error("Failed to delete enquiry");
      navigate("/enquiries");
    } catch (e: any) {
      setErr(e?.message || "Failed to delete enquiry");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-5xl mx-auto p-4 sm:p-8 space-y-6">
        <PageHero
          eyebrow="Edit enquiry"
          title={enquiryNo || "Enquiry"}
          subtitle="Update CRM links, status, and line items. Changes are saved to this enquiry record."
          right={
            <>
              <PrimaryButton variant="secondary" onClick={() => navigate(`/enquiries/${enquiryId}`)} disabled={saving}>
                View
              </PrimaryButton>
              <PrimaryButton variant="secondary" onClick={() => navigate("/enquiries")} disabled={saving}>
                Cancel
              </PrimaryButton>
              <PrimaryButton variant="danger" onClick={doDelete} disabled={saving}>
                Delete
              </PrimaryButton>
              <PrimaryButton onClick={save} disabled={saving || loading}>
                {saving ? "Saving…" : "Save changes"}
              </PrimaryButton>
            </>
          }
        />

        {err && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</div>}

        <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/90 via-white to-violet-50/50 p-4 sm:p-5 shadow-sm shadow-indigo-100/50">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wide text-indigo-700">Master data quick add</p>
              <p className="text-sm text-slate-600 mt-1">
                Add customers, sites, contacts, or products while editing — data is written to master lists for quotations and pricing.
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
              disabled={saving || loading}
            />
          </div>
        </div>

        <div className={cardClass}>
          <SectionTitle icon={<Sparkles className="w-4 h-4" />} title="Header & status" subtitle="Dates, source, pipeline status" />
          <div className="p-6 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <div className="text-xs font-semibold text-slate-500 mb-1.5">Enquiry date</div>
                <input className={inputClass} type="date" value={enquiryDate} onChange={(e) => setEnquiryDate(e.target.value)} disabled={loading} />
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-500 mb-1.5">Source</div>
                <input className={inputClass} value={source} onChange={(e) => setSource(e.target.value)} disabled={loading} placeholder="e.g. Website, referral" />
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-500 mb-1.5">Status</div>
                <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as any)} disabled={loading}>
                  <option value="open">Open</option>
                  <option value="quoted">Quoted</option>
                  <option value="lost">Lost</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-500 mb-1.5">Enquiry no</div>
                <input className={inputClass} value={enquiryNo} disabled />
              </div>
            </div>

            {status === "lost" && (
              <div>
                <div className="text-xs font-semibold text-slate-500 mb-1.5">Lost reason</div>
                <textarea className={textareaClass} rows={2} value={lostReason} onChange={(e) => setLostReason(e.target.value)} placeholder="Why was this enquiry lost?" disabled={loading} />
              </div>
            )}
          </div>
        </div>

        <div className={cardClass}>
          <SectionTitle icon={<Building2 className="w-4 h-4" />} title="Customer & site" subtitle="Company, billing / ship-to location, and contact person" />
          <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className="text-xs font-semibold text-slate-500 mb-1.5">Customer</div>
              <select
                className={selectClass}
                value={selectedCustomer?.id ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  void onCustomerChange(v === "" ? "" : Number(v));
                }}
                disabled={loading}
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
                  const v = e.target.value;
                  void onLocationChange(v === "" ? "" : Number(v));
                }}
                disabled={!selectedCustomer || loading}
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
                  const cid = Number(e.target.value);
                  const ct = contacts.find((x) => x.id === cid) || null;
                  setSelectedContact(ct);
                }}
                disabled={!selectedLocation || loading}
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
            <div className="text-xs font-semibold text-slate-500 mb-1.5">Notes</div>
            <textarea className={textareaClass} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={loading} placeholder="Requirements, competition, timeline…" />
          </div>
        </div>

        <div className={cardClass}>
          <SectionTitle icon={<Layers className="w-4 h-4" />} title="Line items" subtitle="Products and quantities under discussion" />
          <div className="px-6 pb-2 flex justify-end">
            <button
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
              onClick={addRow}
              type="button"
            >
              + Add row
            </button>
          </div>

          <div className="px-4 pb-6 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500 border-b border-slate-100">
                <tr>
                  <th className="px-3 py-2 font-semibold">Product</th>
                  <th className="px-3 py-2 font-semibold">Description</th>
                  <th className="px-3 py-2 font-semibold w-28 text-right">Qty</th>
                  <th className="px-3 py-2 font-semibold w-24">UOM</th>
                  <th className="px-3 py-2 font-semibold">Notes</th>
                  <th className="px-3 py-2 font-semibold w-20 text-right">Remove</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.rowId} className="border-t align-top">
                    <td className="px-3 py-2">
                      <div className="flex gap-1.5 items-start">
                        <select
                          className={`${inputClass} flex-1 min-w-[120px]`}
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
                          disabled={loading}
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
                          disabled={loading || saving}
                        >
                          <Package className="w-4 h-4" aria-hidden />
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <input className={inputClass} value={it.description || ""} onChange={(e) => handleItemChange(it.rowId, { description: e.target.value })} disabled={loading} />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        className={inputClass + " text-right"}
                        type="number"
                        min={0}
                        step="0.01"
                        value={it.qty}
                        onChange={(e) => handleItemChange(it.rowId, { qty: e.target.value === "" ? "" : Number(e.target.value) })}
                        disabled={loading}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input className={inputClass} value={it.uom || ""} onChange={(e) => handleItemChange(it.rowId, { uom: e.target.value })} disabled={loading} />
                    </td>
                    <td className="px-3 py-2">
                      <input className={inputClass} value={it.notes || ""} onChange={(e) => handleItemChange(it.rowId, { notes: e.target.value })} disabled={loading} />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button className="text-red-600 hover:underline text-xs font-semibold disabled:opacity-40" onClick={() => removeRow(it.rowId)} type="button" disabled={items.length <= 1 || loading}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
}

