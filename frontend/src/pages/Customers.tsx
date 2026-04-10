// src/pages/Customers.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api';
import Layout from '../components/layout/Layout';
import { toast } from 'react-toastify';
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

type C = {
  id: number;
  company_name: string;

  gstin?: string;
  address?: string;
};

export default function Customers() {
  console.log('Customers component render');

  const [rows, setRows] = useState<C[]>([]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [form, setForm] = useState({
    company_name: '',
    gstin: '',
    address: ''
  });
  const navigate = useNavigate();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { permissions } = useAuth();

  // pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // ref to modal card for click-outside detection
  const modalRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // close on Escape
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setEditingId(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  async function load() {
    try {
      const data = await api.getCustomers();
      setRows(Array.isArray(data) ? data : []);
      setPage(1);
    } catch (e) {
      console.error(e);
      try {
        toast.error('Failed to fetch customers. See console for details.');
      } catch {
        alert('Failed to fetch customers');
      }
    }
  }


  async function handleDownloadCSV() {
  try {
    const token = localStorage.getItem("token");
    if (!token) {
      toast.error("Authentication required");
      return;
    }

    const res = await fetch(
      `${import.meta.env.VITE_API_BASE}/api/customers/export`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!res.ok) {
      throw new Error("Export failed");
    }

    const blob = await res.blob();

    // Create file download
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "customers_full_export.csv";
    document.body.appendChild(a);
    a.click();

    // Cleanup
    a.remove();
    window.URL.revokeObjectURL(url);
  } catch (err) {
    console.error(err);
    toast.error("Export failed");
  }
}

  // ---- IMPORTANT: submit maps company_name -> name for the server ----
  async function submit() {
    if (!form.company_name.trim()) {
      try {
        toast.warn('Company Name is required');
      } catch {
        alert('Company Name is required');
      }
      return;
    }
    setSubmitting(true);
    try {
      // Build payload matching server DB column names (server expects `name`)
      const payload = {
        company_name: form.company_name,
        gstin: form.gstin,
        address: form.address
      };

      if (editingId != null) {
        // ---- UPDATE CUSTOMER ----
        if (typeof (api as any).updateCustomer === 'function') {
          await (api as any).updateCustomer(editingId, payload);
        } else if (typeof (api as any).editCustomer === 'function') {
          await (api as any).editCustomer(editingId, payload);
        } else {
          console.warn('No update API found, falling back to add');
          await api.addCustomer(payload);
        }

        toast.success('Customer updated');

      } else {
        // ---- ADD CUSTOMER (FIXED) ----
        const created = await api.addCustomer(payload);

        // ✅ instant UI update (NO reload dependency)
        setRows(prev => [created, ...prev]);

        toast.success('Customer added');
      }

      // ---- COMMON CLEANUP ----
      setOpen(false);
      setEditingId(null);
      setForm({ company_name: '', address: '', gstin: '' });
      //await load();
    } catch (e) {
      console.error(e);
      try {
        toast.error('Failed to save customer. See console for details.');
      } catch {
        alert('Failed to save customer');
      }
    } finally {
      setSubmitting(false);
    }
  }

  function filteredRows() {
    if (!query.trim()) return rows;
    const q = query.toLowerCase();
    return rows.filter(
      (r) =>
        r.company_name.toLowerCase().includes(q) ||
        (r.gstin || '').toLowerCase().includes(q) ||
        (r.address || '').toLowerCase().includes(q)
    );
  }

  const filtered = useMemo(() => filteredRows(), [rows, query]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages, page]);



  function initials(name?: string) {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  // overlay click: close if clicked outside modal card
  function onOverlayClick(e: React.MouseEvent) {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      setOpen(false);
      setEditingId(null);
    }
  }

  return (
    <Layout>
      {/* full-width like Dashboard / Quotations */}
      <div className="space-y-6 p-6">
        {/* Header row: left title, right button */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm text-slate-400 mb-1">Customers</div>
            <h1 className="text-3xl font-semibold text-slate-800">Manage customers</h1>
            <p className="text-sm text-slate-500 mt-1">Contact details, GSTIN, and quick actions</p>
          </div>
          <div className="flex items-center gap-2">
            {permissions.isAdmin && (
              <button
                onClick={handleDownloadCSV}
                className="px-4 py-2 text-sm rounded-md border bg-white hover:bg-slate-50"
              >
                Download CSV
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setForm({ company_name: '', address: '', gstin: '' });
                setEditingId(null);
                setOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-rose-500 text-white hover:bg-rose-600 focus:outline-none focus:ring-2 focus:ring-rose-200 shadow"
              aria-haspopup="dialog"
            >
              + Add Customer
            </button>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white border border-slate-100 rounded-xl shadow-sm">
          {/* Card header: controls */}
          <div className="px-6 py-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
            <div className="flex-1 min-w-0">
              <label htmlFor="search-customers" className="sr-only">
                Search customers
              </label>
              <div className="relative">
                <svg
                  className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden
                >
                  <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <input
                  id="search-customers"
                  type="search"
                  placeholder="Search customers, email, phone or GSTIN..."
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(1);
                  }}
                  className="w-full pl-10 pr-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-rose-100 border-slate-200"
                  aria-label="Search customers"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="customers-filter" className="sr-only">
                Filter customers
              </label>
              <select
                id="customers-filter"
                className="px-3 py-2 border rounded-md text-sm border-slate-200 bg-white"
                aria-label="Filter customers"
                defaultValue="all"
              >
                <option value="all">All</option>
              </select>


            </div>
          </div>

          {/* Table */}
          <div className="p-6 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <caption className="sr-only">List of customers</caption>

              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Customer</th>

                  <th className="px-4 py-3 text-left font-medium text-slate-600">GSTIN</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-600">Actions</th>
                </tr>
              </thead>

              <tbody className="bg-white divide-y divide-slate-100">
                {paged.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-4 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center font-semibold text-sm">
                        {initials(r.company_name)}
                      </div>
                      <div>
                        <div className="font-medium text-slate-800">{r.company_name}</div>
                        <div className="text-xs text-slate-400">{r.address ?? ''}</div>
                      </div>
                    </td>


                    <td className="px-4 py-4 text-slate-600">{r.gstin || 'N/A'}</td>

                    <td className="px-4 py-4 text-right">
                      <button
                        onClick={() => navigate(`/customers/${r.id}`)}
                        className="px-2 py-1 rounded-md bg-indigo-50 text-indigo-600 text-xs hover:underline"
                      >
                        Details
                      </button>
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setForm({
                              company_name: r.company_name || '',

                              address: r.address || '',

                              gstin: r.gstin || ''
                            });
                            setEditingId(r.id);
                            setOpen(true);
                          }}
                          className="px-2 py-1 rounded-md bg-slate-50 border border-slate-100 text-slate-700 text-xs hover:bg-slate-100"
                          aria-label={`Edit ${r.company_name}`}
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={async () => {
                            if (!confirm(`Delete ${r.company_name}?`)) return;
                            if (typeof (api as any).deleteCustomer !== 'function') {
                              try {
                                toast.error('Delete API not implemented');
                              } catch {
                                alert('Delete API not implemented');
                              }
                              return;
                            }
                            (document.activeElement as HTMLElement)?.blur();
                            try {
                              await api.deleteCustomer(r.id);
                              setRows(prev => prev.filter(c => c.id !== r.id));
                              try { toast.success('Customer deleted'); } catch { alert('Customer deleted'); }
                            } catch (err: any) {
                              console.error('deleteCustomer error:', err);
                              const msg = String(err?.message || err);
                              if (msg.includes('404') || msg.toLowerCase().includes('not found')) {
                                try { toast.error('Customer not found (404) — it may already be deleted.'); }
                                catch { alert('Customer not found (404) — it may already be deleted.'); }
                              } else {
                                try { toast.error('Delete failed. See console.'); }
                                catch { alert('Delete failed. See console.'); }
                              }
                            }
                          }}
                          className="px-2 py-1 rounded-md bg-rose-50 text-rose-600 text-xs hover:underline"
                          aria-label={`Delete ${r.company_name}`}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                      <div className="mb-2 text-lg">No customers found</div>
                      <div className="text-sm mb-4">
                        Add your first customer using the <strong>Add Customer</strong> button.
                      </div>
                      <button
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-rose-500 text-white hover:bg-rose-600"
                        onClick={() => {
                          setForm({
                            company_name: '',

                            address: '',


                            gstin: ''
                          });
                          setEditingId(null);
                          setOpen(true);
                        }}
                      >
                        + Add Customer
                      </button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination footer */}
          <div className="px-6 py-4 border-t border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="text-sm text-slate-500">
              Showing{' '}
              <span className="font-medium text-slate-700">
                {filtered.length ? Math.min((page - 1) * pageSize + 1, filtered.length) : 0}
              </span>{' '}
              to{' '}
              <span className="font-medium text-slate-700">
                {filtered.length ? Math.min(page * pageSize, filtered.length) : 0}
              </span>{' '}
              of <span className="font-medium text-slate-700">{filtered.length}</span> customers
            </div>

            <div className="flex items-center gap-3">
              <label className="text-sm text-slate-500 hidden md:inline">Rows</label>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="px-2 py-1 border rounded-md text-sm border-slate-200"
                aria-label="Rows per page"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={25}>25</option>
              </select>

              <div className="inline-flex items-center rounded-md overflow-hidden border bg-white">
                <button
                  className="px-3 py-2 text-sm text-slate-600 disabled:opacity-40"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  Prev
                </button>
                <div className="px-3 py-2 text-sm border-l border-r text-slate-700 bg-slate-50">
                  {page} / {totalPages}
                </div>
                <button
                  className="px-3 py-2 text-sm text-slate-600 disabled:opacity-40"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* CENTERED MODAL - Add/Edit Customer */}
        {open && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            onMouseDown={onOverlayClick}
          >
            <div
              ref={modalRef}
              onMouseDown={(e) => e.stopPropagation()}
              className="bg-white w-full max-w-xl rounded-2xl shadow-xl border border-slate-200"
            >
              {/* HEADER */}
              <div className="flex items-start justify-between px-6 py-4 border-b">
                <div>
                  <h2 className="text-lg font-semibold text-slate-800">
                    {editingId ? 'Edit Customer' : 'Add New Customer'}
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">
                    Company details and GST information
                  </p>
                </div>

                <button
                  onClick={() => {
                    setOpen(false);
                    setEditingId(null);
                    setForm({ company_name: '', address: '', gstin: '' });
                  }}
                  className="text-slate-400 hover:text-slate-600"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>

              {/* BODY */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  submit();
                }}
                className="px-6 py-6 space-y-5"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Company Name */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Company Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      required
                      autoFocus
                      value={form.company_name}
                      onChange={(e) =>
                        setForm({ ...form, company_name: e.target.value })
                      }
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200"
                      placeholder="Enter company name"
                    />
                  </div>

                  {/* GSTIN */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      GSTIN
                    </label>
                    <input
                      value={form.gstin}
                      onChange={(e) =>
                        setForm({ ...form, gstin: e.target.value })
                      }
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200"
                      placeholder="Optional"
                    />
                  </div>

                  {/* Address */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Address
                    </label>
                    <textarea
                      rows={3}
                      value={form.address}
                      onChange={(e) =>
                        setForm({ ...form, address: e.target.value })
                      }
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-rose-200"
                      placeholder="Registered office address"
                    />
                  </div>
                </div>

                {/* FOOTER */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      setEditingId(null);
                      setForm({ company_name: '', address: '', gstin: '' });
                    }}
                    className="px-4 py-2 rounded-md border text-sm text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 rounded-md bg-rose-500 text-white text-sm font-medium hover:bg-rose-600 disabled:opacity-50"
                  >
                    {submitting
                      ? 'Saving…'
                      : editingId
                        ? 'Save Changes'
                        : 'Add Customer'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </Layout>
  );
}
