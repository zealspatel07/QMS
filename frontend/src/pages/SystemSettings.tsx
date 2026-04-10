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
      <div className="p-6 md:p-8 max-w-7xl mx-auto">
        <div className="flex items-start justify-between mb-10">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
            <p className="text-slate-600 mt-2">Configure system-wide settings. Changes apply to all users globally.</p>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <button onClick={resetForm} className="px-4 py-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-sm font-medium transition-colors">Reset</button>
            <button
              onClick={persistSettings}
              className="px-5 py-2 rounded-lg bg-[#03206B] text-white text-sm font-medium shadow hover:shadow-md transition-all"
              disabled={saving || loading}
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          {/* left: main form (two-thirds) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Company Section */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="mb-5 pb-4 border-b border-slate-100">
                <h2 className="text-base font-bold text-slate-900">Company Information</h2>
                <p className="text-xs text-slate-500 mt-1">Basic company details used in documents</p>
              </div>

              <FieldRow>
                <label className="block text-sm font-medium text-slate-700 mb-2">Company Name</label>
                <input
                  value={settings.companyName}
                  onChange={(e) => setSettings((s) => ({ ...s, companyName: e.target.value }))}
                  placeholder="Prayosha Automation"
                  className="w-full rounded-lg bg-slate-50 border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#03206B] focus:border-transparent transition-all"
                />
              </FieldRow>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FieldRow>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
                  <input
                    value={settings.contactEmail}
                    onChange={(e) => setSettings((s) => ({ ...s, contactEmail: e.target.value }))}
                    placeholder="support@company.com"
                    className="w-full rounded-lg bg-slate-50 border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#03206B] focus:border-transparent transition-all"
                  />
                </FieldRow>

                <FieldRow>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Phone</label>
                  <input
                    value={settings.contactPhone}
                    onChange={(e) => setSettings((s) => ({ ...s, contactPhone: e.target.value }))}
                    placeholder="+91 98765 43210"
                    className="w-full rounded-lg bg-slate-50 border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#03206B] focus:border-transparent transition-all"
                  />
                </FieldRow>
              </div>

              <FieldRow>
                <label className="block text-sm font-medium text-slate-700 mb-2">Address</label>
                <textarea
                  value={settings.companyAddress}
                  onChange={(e) => setSettings((s) => ({ ...s, companyAddress: e.target.value }))}
                  rows={3}
                  placeholder="123 Business Street, City, State 12345"
                  className="w-full rounded-lg bg-slate-50 border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#03206B] focus:border-transparent transition-all resize-none"
                />
              </FieldRow>
            </div>

            {/* Quotation Terms */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="mb-4 pb-4 border-b border-slate-100">
                <h2 className="text-base font-bold text-slate-900">Quotation Terms & Conditions</h2>
                <p className="text-xs text-slate-500 mt-1">Applied to all new quotations. Existing quotations unaffected.</p>
              </div>

              <textarea
                value={settings.termsConditions ?? ""}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, termsConditions: e.target.value }))
                }
                rows={6}
                placeholder="Enter standard terms and conditions…"
                className="w-full rounded-lg bg-slate-50 border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#03206B] focus:border-transparent transition-all resize-none"
              />

              <div className="flex items-center gap-2 mt-4">
                <button
                  type="button"
                  onClick={saveTermsDraft}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium hover:bg-slate-50 transition-colors"
                >
                  Save Draft
                </button>

                <button
                  type="button"
                  onClick={applyTerms}
                  className="px-4 py-2 rounded-lg bg-[#03206B] text-white text-sm font-medium hover:shadow-md transition-all"
                >
                  Apply
                </button>
              </div>
            </div>

            {/* PO Terms */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="mb-4 pb-4 border-b border-slate-100">
                <h2 className="text-base font-bold text-slate-900">Purchase Order Terms & Conditions</h2>
                <p className="text-xs text-slate-500 mt-1">Applied to all new POs. Users can modify during creation.</p>
              </div>

              <textarea
                value={settings.poTermsConditions ?? ""}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, poTermsConditions: e.target.value }))
                }
                rows={6}
                placeholder="Enter default PO terms…"
                className="w-full rounded-lg bg-slate-50 border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#03206B] focus:border-transparent transition-all resize-none"
              />

              <div className="flex items-center gap-2 mt-4">
                <button
                  type="button"
                  onClick={savePOTermsDraft}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium hover:bg-slate-50 transition-colors"
                >
                  Save Draft
                </button>

                <button
                  type="button"
                  onClick={applyPOTerms}
                  className="px-4 py-2 rounded-lg bg-[#03206B] text-white text-sm font-medium hover:shadow-md transition-all"
                >
                  Apply
                </button>
              </div>
            </div>

            {/* Invoice & Quotation */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="mb-5 pb-4 border-b border-slate-100">
                <h2 className="text-base font-bold text-slate-900">Document Numbering</h2>
                <p className="text-xs text-slate-500 mt-1">Configure quotation and invoice series</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FieldRow>
                  <label className="text-sm font-medium text-slate-700 mb-2 block">Prefix</label>
                  <input
                    value={settings.invoicePrefix}
                    onChange={(e) => setSettings((s) => ({ ...s, invoicePrefix: e.target.value }))}
                    placeholder="QT"
                    className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#03206B] focus:border-transparent transition-all w-full"
                  />
                  <p className="text-xs text-slate-500 mt-1">Example: QT/2026/JAN/001</p>
                </FieldRow>

                <FieldRow>
                  <label className="text-sm font-medium text-slate-700 mb-2 block">Next Sequence</label>
                  <input
                    type="number"
                    min={1}
                    value={settings.invoiceNextSeq ?? 1}
                    onChange={(e) => setSettings((s) => ({ ...s, invoiceNextSeq: Number(e.target.value || 1) }))}
                    className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#03206B] focus:border-transparent transition-all w-full"
                  />
                  <p className="text-xs text-slate-500 mt-1">Starting number for new documents</p>
                </FieldRow>

              </div>
            </div>

            {/* Security Section */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="mb-5 pb-4 border-b border-slate-100">
                <h2 className="text-base font-bold text-slate-900">Security</h2>
                <p className="text-xs text-slate-500 mt-1">System-wide security settings</p>
              </div>

              <FieldRow>
                <label className="inline-flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!settings.enforceStrongPassword}
                    onChange={(e) => setSettings((s) => ({ ...s, enforceStrongPassword: e.target.checked }))}
                    className="w-4 h-4 rounded border-slate-300"
                  />
                  <span className="text-sm font-medium text-slate-700">Enforce Strong Passwords</span>
                </label>
                <p className="text-xs text-slate-500 mt-2 ml-7">Minimum 8 characters with numbers, uppercase, and special characters</p>
              </FieldRow>

              <FieldRow>
                <p className="text-sm text-slate-600">User roles and access control are managed in the <span className="font-medium">User Management</span> section. Only administrators can modify global settings.</p>
              </FieldRow>
            </div>
          </div>

          {/* right: compact column */}
          <div className="space-y-6">
            {/* Branding */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="mb-4 pb-3 border-b border-slate-100">
                <h3 className="text-base font-bold text-slate-900">Branding</h3>
                <p className="text-xs text-slate-500 mt-1">Company logo</p>
              </div>

              <div className="flex flex-col gap-4">
                <div className="w-full h-32 rounded-lg bg-slate-50 flex items-center justify-center overflow-hidden border-2 border-dashed border-slate-200">
                  {settings.logoDataUrl ? (
                    <img src={settings.logoDataUrl} alt="Logo" className="object-contain w-full h-full p-2 max-w-full" />
                  ) : (
                    <div className="text-xs text-slate-400 text-center">Logo preview</div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Upload Logo</label>
                  <input type="file" accept="image/*" onChange={onFileChange} className="text-xs w-full block" />
                  <p className="text-xs text-slate-500 mt-2">PNG, JPG or SVG. Max 1.8MB</p>
                </div>
              </div>
            </div>

            {/* Email Configuration */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="mb-4 pb-3 border-b border-slate-100">
                <h3 className="text-base font-bold text-slate-900">Email Configuration</h3>
                <p className="text-xs text-slate-500 mt-1">SMTP server settings</p>
              </div>

              <FieldRow>
                <label className="block text-sm font-medium text-slate-700 mb-2">SMTP Host</label>
                <input
                  value={settings.smtpHost}
                  onChange={(e) => setSettings((s) => ({ ...s, smtpHost: e.target.value }))}
                  placeholder="smtp.gmail.com"
                  className="w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#03206B] focus:border-transparent transition-all"
                />
              </FieldRow>

              <div className="grid grid-cols-2 gap-3">
                <FieldRow>
                  <label className="text-sm font-medium text-slate-700 mb-2 block">Port</label>
                  <input
                    type="number"
                    value={settings.smtpPort ?? ""}
                    onChange={(e) => setSettings((s) => ({ ...s, smtpPort: e.target.value ? Number(e.target.value) : "" }))}
                    placeholder="587"
                    className="w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#03206B] focus:border-transparent transition-all"
                  />
                </FieldRow>

                <FieldRow>
                  <label className="text-sm font-medium text-slate-700 mb-2 block">Username</label>
                  <input
                    value={settings.smtpUser}
                    onChange={(e) => setSettings((s) => ({ ...s, smtpUser: e.target.value }))}
                    placeholder="your@email.com"
                    className="w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#03206B] focus:border-transparent transition-all"
                  />
                </FieldRow>
              </div>

              <FieldRow>
                <label className="text-sm font-medium text-slate-700 mb-2 block">From Address</label>
                <input
                  value={settings.smtpFrom}
                  onChange={(e) => setSettings((s) => ({ ...s, smtpFrom: e.target.value }))}
                  placeholder="noreply@company.com"
                  className="w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#03206B] focus:border-transparent transition-all"
                />
                <p className="text-xs text-slate-500 mt-1">System emails come from this address</p>
              </FieldRow>

              <button
                type="button"
                onClick={sendTestEmail}
                className="w-full mt-4 px-4 py-2.5 rounded-lg bg-slate-700 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                disabled={!settings.smtpHost || !settings.smtpUser || !settings.smtpFrom}
              >
                Send Test Email
              </button>
            </div>

            {/* Validation Status */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Form Status</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Validation</p>
                </div>
                {validationErrors.length === 0 ? (
                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-medium">✓ Valid</span>
                ) : (
                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-red-100 text-red-700 text-xs font-medium">{validationErrors.length} Issues</span>
                )}
              </div>

              {validationErrors.length > 0 && (
                <ul className="text-xs text-red-700 list-disc pl-5 mt-3 space-y-1">
                  {validationErrors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              )}

              {validationErrors.length === 0 && (
                <p className="text-xs text-slate-500 mt-3">All fields validated. Ready to save.</p>
              )}
            </div>
          </div>
        </div>

        {/* Mobile action bar */}
        <div className="md:hidden fixed right-4 bottom-6 z-40 flex gap-2">
          <button
            onClick={resetForm}
            className="px-4 py-2.5 rounded-lg bg-white border border-slate-300 text-sm font-medium hover:bg-slate-50 transition-colors"
            disabled={saving}
          >
            Reset
          </button>
          <button
            onClick={persistSettings}
            className="px-4 py-2.5 rounded-lg bg-[#03206B] text-white text-sm font-medium hover:shadow-md transition-all"
            disabled={saving || loading || validationErrors.length > 0}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>

      </div>
    </Layout>
  );
}
