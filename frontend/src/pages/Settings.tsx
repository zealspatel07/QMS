// src/pages/Settings.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import Layout from "../components/layout/Layout";
import { useAuth } from "../context/AuthContext";
import { toast } from "react-toastify";

type SettingsShape = {
  companyName?: string;
  companyAddress?: string;
  contactEmail?: string;
  contactPhone?: string;
  invoicePrefix?: string;
  invoiceNextSeq?: number;
  smtpHost?: string;
  smtpPort?: number | "";
  smtpUser?: string;
  smtpFrom?: string;
  enforceStrongPassword?: boolean;
  logoDataUrl?: string | null;

  // --- Terms & Conditions (Admin-controlled) ---
  termsConditions?: string;
  poTermsConditions?: string;
  termsAppliedAt?: string | null;
  termsAppliedBy?: number | null;
};

const defaultSettings: SettingsShape = {
  companyName: "",
  companyAddress: "",
  contactEmail: "",
  contactPhone: "",
  invoicePrefix: "QT",
  invoiceNextSeq: 1,
  smtpHost: "",
  smtpPort: "",
  smtpUser: "",
  smtpFrom: "",
  enforceStrongPassword: true,
  logoDataUrl: null,

  // --- Terms & Conditions ---
  termsConditions: "",
  poTermsConditions: "",
  termsAppliedAt: null,
  termsAppliedBy: null,
};

function FieldRow({ children }: { children: React.ReactNode }) {
  return <div className="mb-4 last:mb-0">{children}</div>;
}

export default function Settings() {
  const { user } = useAuth();
  const isAdmin = (user?.role ?? "").toLowerCase() === "admin";

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<SettingsShape>(defaultSettings);
  const [initial, setInitial] = useState<SettingsShape | null>(null);



  const validationErrors = useMemo(() => {
    const errs: string[] = [];
    if (!settings.companyName || settings.companyName.trim().length < 2)
      errs.push("Company name is required.");
    if (settings.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.contactEmail))
      errs.push("Contact email is invalid.");
    if (settings.smtpPort && (Number(settings.smtpPort) <= 0 || Number(settings.smtpPort) > 65535))
      errs.push("SMTP port must be 1–65535.");
    if (!settings.invoicePrefix || settings.invoicePrefix.trim().length < 1)
      errs.push("Invoice prefix is required.");
    return errs;
  }, [settings]);

  const loadSettings = useCallback(async () => {
    setLoading(true);

    try {
      const token = localStorage.getItem("token");

      const resp = await fetch(
        `${import.meta.env.VITE_API_BASE || "http://localhost:3001"}/api/settings`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!resp.ok) {
        throw new Error("Failed to load settings");
      }

      const body = await resp.json();



      const merged: SettingsShape = {
        companyName: body.company_name ?? "",
        companyAddress: body.company_address ?? "",
        contactEmail: body.contact_email ?? "",
        contactPhone: body.contact_phone ?? "",

        invoicePrefix: body.invoice_prefix ?? "QT",
        invoiceNextSeq: body.invoice_next_seq ?? 1,

        smtpHost: body.smtp_host ?? "",
        smtpPort: body.smtp_port ?? "",
        smtpUser: body.smtp_user ?? "",
        smtpFrom: body.smtp_from ?? "",

        enforceStrongPassword: !!body.enforce_strong_password,
        logoDataUrl: body.logo_data_url ?? null,
      };

      setSettings(merged);
      setInitial(merged);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load settings. Using defaults.");
      setSettings(defaultSettings);
      setInitial(defaultSettings);
    } finally {
      setLoading(false);
    }
  }, []);

  // ------------------------------
  // LOAD QUOTATION TERMS
  // ------------------------------
  const loadTerms = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");

      const resp = await fetch(
        `${import.meta.env.VITE_API_BASE || "http://localhost:3001"}/api/settings/terms`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!resp.ok) throw new Error("Failed to load terms");

      const body = await resp.json();

      setSettings((s) => ({
        ...s,
        termsConditions: body.terms ?? "",
      }));
    } catch (err) {
      toast.error("Failed to load Terms & Conditions");
    }
  }, []);


  // ------------------------------
  // LOAD PO TERMS  ✅ NEW
  // ------------------------------
  const loadPOTerms = useCallback(async () => {
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

      if (!resp.ok) throw new Error("Failed to load PO terms");

      const body = await resp.json();

      setSettings((s) => ({
        ...s,
        poTermsConditions: body.terms ?? "",
      }));
    } catch (err) {
      toast.error("Failed to load PO Terms & Conditions");
    }
  }, []);


  // ------------------------------
  // USE EFFECT (UPDATED)
  // ------------------------------
  useEffect(() => {
    if (!isAdmin) return;

    void loadSettings();
    void loadTerms();
    void loadPOTerms();   // ✅ IMPORTANT
  }, [isAdmin, loadSettings, loadTerms, loadPOTerms]);


  // ------------------------------
  // REMAINING CODE (UNCHANGED)
  // ------------------------------
  const handleLogoSelect = async (f?: File | null) => {
    if (!f) {
      setSettings((s) => ({ ...s, logoDataUrl: null }));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setSettings((s) => ({ ...s, logoDataUrl: String(reader.result) }));
    };
    reader.readAsDataURL(f);
  };

  const onFileChange = (ev: React.ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files && ev.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Choose a valid image (PNG/JPG/SVG).");
      return;
    }
    if (file.size > 1_800_000) {
      toast.error("Image too large. Use an image under ~1.8MB.");
      return;
    }
    void handleLogoSelect(file);
  };

  const resetForm = () => {
    if (initial) {
      setSettings(initial);
      toast.info("Reverted to saved settings.");
    } else {
      setSettings(defaultSettings);
      toast.info("Reset to defaults.");
    }
  };

  const sendTestEmail = async () => {
    try {
      const token = localStorage.getItem("token");

      const resp = await fetch(
        `${import.meta.env.VITE_API_BASE || "http://localhost:4000"}/api/settings/test-email`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error || "Failed to send test email");
      }

      toast.success("Test email sent successfully. Check your inbox.");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to send test email");
    }
  };

  const saveTermsDraft = async () => {
    try {
      const token = localStorage.getItem("token");

      const resp = await fetch(
        `${import.meta.env.VITE_API_BASE || "http://localhost:4000"}/api/settings/terms/draft`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            terms: settings.termsConditions ?? "",
          }),
        }
      );

      if (!resp.ok) throw new Error();

      toast.success("Terms draft saved.");
    } catch {
      toast.error("Failed to save terms draft.");
    }
  };

  const savePOTermsDraft = async () => {
    try {
      const token = localStorage.getItem("token");

      const resp = await fetch(
        `${import.meta.env.VITE_API_BASE || "http://localhost:3001"}/api/settings/po-terms/draft`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            terms: settings.poTermsConditions ?? "",
          }),
        }
      );

      if (!resp.ok) throw new Error();

      toast.success("PO Terms draft saved.");
    } catch {
      toast.error("Failed to save PO terms draft.");
    }
  };

  const applyTerms = async () => {
    try {
      const token = localStorage.getItem("token");

      const resp = await fetch(
        `${import.meta.env.VITE_API_BASE || "http://localhost:4000"}/api/settings/terms/apply`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            terms: settings.termsConditions ?? "",
          }),
        }
      );

      if (!resp.ok) throw new Error();

      toast.success("Terms & Conditions applied system-wide.");
    } catch {
      toast.error("Failed to apply terms.");
    }
  };

  const applyPOTerms = async () => {
    try {
      const token = localStorage.getItem("token");

      const resp = await fetch(
        `${import.meta.env.VITE_API_BASE || "http://localhost:3001"}/api/settings/po-terms/apply`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            terms: settings.poTermsConditions ?? "",
          }),
        }
      );

      if (!resp.ok) throw new Error();

      toast.success("PO Terms applied system-wide.");
    } catch {
      toast.error("Failed to apply PO terms.");
    }
  };

  const persistSettings = async () => {
    if (validationErrors.length > 0) {
      toast.error("Fix validation errors before saving.");
      return;
    }

    setSaving(true);

    try {
      const payload = { ...settings };
      const token = localStorage.getItem("token");

      const resp = await fetch(
        `${import.meta.env.VITE_API_BASE || "http://localhost:4000"}/api/settings`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        }
      );

      if (resp.ok) {
        setInitial(payload);
        toast.success("Settings saved.");
      } else {
        toast.error("Failed to save settings (server error).");
      }
    } catch (e) {
      toast.error("Failed to save settings (network error).");
    } finally {
      setSaving(false);
    }
  };


  if (!isAdmin) {
    return (
      <Layout>
        <div className="p-10 max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl shadow-lg p-10">
            <h2 className="text-2xl font-semibold mb-2">Settings</h2>
            <p className="text-slate-600 mb-6">Access denied — only administrators can manage application settings.</p>
            <div className="flex gap-3">
              <button className="px-4 py-2 rounded bg-[#03206B] text-white" onClick={() => window.history.back()}>
                Go back
              </button>
              <a className="px-4 py-2 rounded border" href="/dashboard">
                Dashboard
              </a>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-10 max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-semibold">Application Settings</h1>
            <p className="text-sm text-slate-500 mt-1">Global configuration for the quotation system. Changes apply to all users.</p>
          </div>

          <div className="hidden sm:flex items-center gap-3">
            <button onClick={resetForm} className="px-3 py-2 rounded-lg bg-white border hover:shadow-sm text-sm">Reset</button>
            <button
              onClick={persistSettings}
              className="px-4 py-2 rounded-lg bg-[#03206B] text-white text-sm shadow"
              disabled={saving || loading}
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* left: main form (two-thirds) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h2 className="text-lg font-semibold mb-4">Company</h2>

              <FieldRow>
                <label className="block text-sm font-medium text-slate-700 mb-2">Company name</label>
                <input
                  value={settings.companyName}
                  onChange={(e) => setSettings((s) => ({ ...s, companyName: e.target.value }))}
                  placeholder="Prayosha Automation"
                  className="w-full rounded-lg bg-slate-50 border-0 px-4 py-3 shadow-inner focus:outline-none"
                />
              </FieldRow>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Contact email</label>
                  <input
                    value={settings.contactEmail}
                    onChange={(e) => setSettings((s) => ({ ...s, contactEmail: e.target.value }))}
                    placeholder="support@yourcompany.com"
                    className="w-full rounded-lg bg-slate-50 border-0 px-4 py-3 shadow-inner focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Contact phone</label>
                  <input
                    value={settings.contactPhone}
                    onChange={(e) => setSettings((s) => ({ ...s, contactPhone: e.target.value }))}
                    placeholder="+91 98765 43210"
                    className="w-full rounded-lg bg-slate-50 border-0 px-4 py-3 shadow-inner focus:outline-none"
                  />
                </div>
              </div>

              <FieldRow>
                <label className="block text-sm font-medium text-slate-700 mb-2">Address</label>
                <textarea
                  value={settings.companyAddress}
                  onChange={(e) => setSettings((s) => ({ ...s, companyAddress: e.target.value }))}
                  rows={4}
                  className="w-full rounded-lg bg-slate-50 border-0 px-4 py-3 shadow-inner focus:outline-none"
                />
              </FieldRow>
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h2 className="text-lg font-semibold mb-2">Terms & Conditions</h2>
              <p className="text-sm text-slate-500 mb-4">
                These terms are applied to all newly created quotations. Existing quotations are not affected.
              </p>

              <textarea
                value={settings.termsConditions ?? ""}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, termsConditions: e.target.value }))
                }
                rows={10}
                className="w-full rounded-lg bg-slate-50 border-0 px-4 py-3 shadow-inner focus:outline-none text-sm"
                placeholder="Enter standard terms and conditions here…"
              />

              <div className="flex items-center gap-3 mt-4">
                <button
                  type="button"
                  onClick={saveTermsDraft}
                  className="px-4 py-2 rounded-lg border text-sm hover:shadow-sm"
                >
                  Save Draft
                </button>

                <button
                  type="button"
                  onClick={applyTerms}
                  className="px-4 py-2 rounded-lg bg-[#03206B] text-white text-sm shadow"
                >
                  Apply Changes
                </button>
              </div>

              <div className="text-xs text-slate-500 mt-3">
                Apply Changes will affect all future quotations only.
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h2 className="text-lg font-semibold mb-2">Purchase Order Terms & Conditions</h2>
              <p className="text-sm text-slate-500 mb-4">
                These terms are applied to all newly created Purchase Orders. Users can modify them during PO creation.
              </p>

              <textarea
                value={settings.poTermsConditions ?? ""}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, poTermsConditions: e.target.value }))
                }
                rows={10}
                className="w-full rounded-lg bg-slate-50 border-0 px-4 py-3 shadow-inner focus:outline-none text-sm"
                placeholder="Enter default Purchase Order terms…"
              />

              <div className="flex items-center gap-3 mt-4">
                <button
                  type="button"
                  onClick={savePOTermsDraft}
                  className="px-4 py-2 rounded-lg border text-sm hover:shadow-sm"
                >
                  Save Draft
                </button>

                <button
                  type="button"
                  onClick={applyPOTerms}
                  className="px-4 py-2 rounded-lg bg-[#03206B] text-white text-sm shadow"
                >
                  Apply Changes
                </button>
              </div>

              <div className="text-xs text-slate-500 mt-3">
                Applies only to future Purchase Orders.
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h2 className="text-lg font-semibold mb-4">Invoice & Quotation</h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-2 block">Prefix</label>
                  <input
                    value={settings.invoicePrefix}
                    onChange={(e) => setSettings((s) => ({ ...s, invoicePrefix: e.target.value }))}
                    className="rounded-lg bg-slate-50 border-0 px-4 py-3 shadow-inner focus:outline-none w-full"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700 mb-2 block">Next sequence</label>
                  <input
                    type="number"
                    min={1}
                    value={settings.invoiceNextSeq ?? 1}
                    onChange={(e) => setSettings((s) => ({ ...s, invoiceNextSeq: Number(e.target.value || 1) }))}
                    className="rounded-lg bg-slate-50 border-0 px-4 py-3 shadow-inner focus:outline-none w-full"
                  />
                </div>

                <div className="md:col-span-1 text-sm text-slate-500">
                  <div>Example generated number: <span className="font-medium">QT/2025/XXX/001</span></div>
                </div>
              </div>

              <div className="mt-4 text-xs text-slate-500">Set invoice/quotation series used when generating new documents.</div>
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h2 className="text-lg font-semibold mb-4">Security</h2>

              <FieldRow>
                <label className="inline-flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={!!settings.enforceStrongPassword}
                    onChange={(e) => setSettings((s) => ({ ...s, enforceStrongPassword: e.target.checked }))}
                    className="rounded"
                  />
                  <span className="text-sm">Enforce strong passwords</span>
                </label>
                <div className="text-xs text-slate-500 mt-2">Require passwords to be at least 8 characters with numbers and letters.</div>
              </FieldRow>

              <FieldRow>
                <label className="block text-sm font-medium text-slate-700 mb-2">Admin users & roles</label>
                <div className="text-sm text-slate-600">Manage users and roles under the Users page. Only Admins can change global settings.</div>
              </FieldRow>
            </div>
          </div>

          {/* right: compact column */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-lg p-6 flex flex-col items-center gap-4">
              <h3 className="text-md font-semibold self-start">Branding</h3>

              <div className="w-full flex items-center gap-4">
                <div className="w-24 h-24 rounded-lg bg-slate-50 flex items-center justify-center overflow-hidden border border-dashed border-slate-100">
                  {settings.logoDataUrl ? (
                    <img src={settings.logoDataUrl} alt="Logo" className="object-contain w-full h-full" />
                  ) : (
                    <div className="text-xs text-slate-400 text-center px-2">Logo preview</div>
                  )}
                </div>

                <div className="flex-1">
                  <input type="file" accept="image/*" onChange={onFileChange} className="text-sm" />
                  <div className="text-xs text-slate-500 mt-2">PNG, JPG or SVG. Max ~1.8MB. (Client-side preview)</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="text-md font-semibold mb-3">Email / SMTP</h3>

              <div className="mb-3">
                <label className="block text-sm text-slate-700 mb-2">SMTP host</label>
                <input
                  value={settings.smtpHost}
                  onChange={(e) => setSettings((s) => ({ ...s, smtpHost: e.target.value }))}
                  placeholder="smtp.mailserver.com"
                  className="w-full rounded-lg bg-slate-50 border-0 px-4 py-3 shadow-inner focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-slate-700 mb-2 block">SMTP port</label>
                  <input
                    type="number"
                    value={settings.smtpPort ?? ""}
                    onChange={(e) => setSettings((s) => ({ ...s, smtpPort: e.target.value ? Number(e.target.value) : "" }))}
                    placeholder="587"
                    className="w-full rounded-lg bg-slate-50 border-0 px-4 py-3 shadow-inner focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-sm text-slate-700 mb-2 block">SMTP user</label>
                  <input
                    value={settings.smtpUser}
                    onChange={(e) => setSettings((s) => ({ ...s, smtpUser: e.target.value }))}
                    placeholder="user@mail.com"
                    className="w-full rounded-lg bg-slate-50 border-0 px-4 py-3 shadow-inner focus:outline-none"
                  />
                </div>
              </div>

              <div className="mt-3">
                <label className="text-sm text-slate-700 mb-2 block">From address</label>
                <input
                  value={settings.smtpFrom}
                  onChange={(e) => setSettings((s) => ({ ...s, smtpFrom: e.target.value }))}
                  placeholder="no-reply@yourcompany.com"
                  className="w-full rounded-lg bg-slate-50 border-0 px-4 py-3 shadow-inner focus:outline-none"
                />
                <div className="text-xs text-slate-500 mt-2">Used for outgoing system emails if SMTP is configured.</div>
              </div>
            </div>

            <div className="mt-4">
              <button
                type="button"
                onClick={sendTestEmail}
                className="px-4 py-2 rounded-lg bg-slate-800 text-white text-sm hover:bg-slate-900 disabled:opacity-50"
                disabled={!settings.smtpHost || !settings.smtpUser || !settings.smtpFrom}
              >
                Send Test Email
              </button>

              <div className="text-xs text-slate-500 mt-2">
                Sends a test email to your admin email using the configured SMTP settings.
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-sm font-medium">Validation</div>
                  <div className="text-xs text-slate-500">Form status</div>
                </div>
                <div>
                  {validationErrors.length === 0 ? (
                    <span className="inline-flex items-center px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs">All good</span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-1 rounded-full bg-rose-50 text-rose-700 text-xs">{validationErrors.length} errors</span>
                  )}
                </div>
              </div>

              {validationErrors.length > 0 && (
                <ul className="text-sm text-rose-700 list-disc pl-5">
                  {validationErrors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              )}

              {validationErrors.length === 0 && (
                <div className="text-sm text-slate-500">No validation issues found. Save to apply changes.</div>
              )}
            </div>
          </div>
        </div>

        {/* Floating action bar for smaller screens / persistent quick actions */}
        <div className="fixed right-6 bottom-6 z-50 flex gap-3">
          <button
            onClick={resetForm}
            className="px-4 py-2 rounded-lg bg-white border shadow-sm hover:shadow-md"
            disabled={saving}
          >
            Reset
          </button>
          <button
            onClick={persistSettings}
            className="px-4 py-2 rounded-lg bg-[#03206B] text-white shadow-md"
            disabled={saving || loading || validationErrors.length > 0}
          >
            {saving ? "Saving…" : "Save settings"}
          </button>
        </div>

      </div>
    </Layout>
  );
}
