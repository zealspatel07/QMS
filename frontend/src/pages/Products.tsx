// src/pages/Products.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api';
import Layout from '../components/layout/Layout';
import Card from '../components/Card';
import css from './Products.module.css';
import { toast } from 'react-toastify';

type P = {
  id: number;
  name: string;
  description?: string;
  hsn_code?: string;
  uom: string;
  unit_price: string;
  tax_rate: string;
  status: string;
};



export default function Products() {
  const [rows, setRows] = useState<P[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    uom: 'NOS',
    hsn_code: '',
    unit_price: '',
    tax_rate: '18',
    status: 'active',
  });
  const [editingId, setEditingId] = useState<number | null>(null);



  // paging + search + sort
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [sortBy, setSortBy] = useState<'name' | 'unit_price' | 'tax_rate' | 'status'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [query, setQuery] = useState('');

  // modal ref for click-outside detection
  const modalRef = useRef<HTMLDivElement | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    // close on Escape
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeModal();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  async function load() {
    try {
      const d = await api.getProducts();
      setRows(d || []);
    } catch (e) {
      console.error(e);
      try {
        toast.error('Failed to load products. See console.');
      } catch {
        alert('failed to load products');
      }
    }
  }

  async function submit() {
    // enforce required description
    if (!form.name.trim()) {
      toast.warn('Product name is required');
      return;
    }
    // description is optional now
    // if (!form.description.trim()) {
    //   toast.warn('Description is required');
    //   return;
    // }

    try {
      const payload = {
        name: form.name,
        description: form.description,
        hsn_code: form.hsn_code || null,
        uom: form.uom,
        unit_price: parseFloat(form.unit_price || '0'),
        tax_rate: parseFloat(form.tax_rate || '0'),
        status: form.status,
      };

      if (editingId) {
        if (typeof (api as any).updateProduct === 'function') {
          await (api as any).updateProduct(editingId, payload);
        } else {
          await api.addProduct(payload); // fallback
        }
        toast.success('Product updated');
      } else {
        await api.addProduct(payload);
        toast.success('Product added');
      }

      closeModal();
      await load();
      window.dispatchEvent(new CustomEvent('product-updated', { detail: { id: editingId ?? null, action: editingId ? 'updated' : 'created' } }));
    } catch (e) {
      console.error(e);
      try {
        toast.error('Failed to save product. See console.');
      } catch {
        alert('failed to save product');
      }
    }
  }

  async function handleExcelUpload(file: File) {
    try {
      setUploading(true);
      const res = await api.uploadProductsExcel(file);

      toast.success(
        `Upload complete: ${res.inserted} added, ${res.updated} updated`
      );

      if (res.failed > 0) {
        toast.warn(`${res.failed} rows failed. Check console.`);
        console.table(res.errors);
      }

      await load();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Excel upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function openEdit(r: P) {
    setEditingId(r.id);
    setForm({
      name: r.name,
      description: r.description || '',
      hsn_code: r.hsn_code || '',
      uom: r.uom || 'NOS',
      unit_price: r.unit_price || '',
      tax_rate: r.tax_rate || '18',
      status: r.status || 'active',
    });
    setOpen(true);
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this product?')) return;
    try {
      if (typeof (api as any).deleteProduct !== 'function') {
        toast.error('Delete API not implemented');
        return;
      }
      await (api as any).deleteProduct(id);
      toast.success('Product deleted');
      await load();
      window.dispatchEvent(new CustomEvent('product-updated', { detail: { id, action: 'deleted' } }));
    } catch (e) {
      console.error(e);
      try {
        toast.error('Delete failed. See console.');
      } catch {
        alert('Delete failed');
      }
    }
  }

  // filtered + sorted data
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let data = rows.slice();

    if (q) {
      data = data.filter(
        (r) =>
          String(r.name).toLowerCase().includes(q) ||
          String(r.description || '').toLowerCase().includes(q) ||
          String(r.uom || '').toLowerCase().includes(q)
      );
    }

    const dir = sortDir === 'asc' ? 1 : -1;
    data.sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name) * dir;
      if (sortBy === 'unit_price') return (Number(a.unit_price) - Number(b.unit_price)) * dir;
      if (sortBy === 'tax_rate') return (Number(a.tax_rate) - Number(b.tax_rate)) * dir;
      return String(a.status).localeCompare(String(b.status)) * dir;
    });

    return data;
  }, [rows, query, sortBy, sortDir]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const pageRows = filtered.slice((page - 1) * perPage, page * perPage);

  // reset page when filter/page size changes
  useEffect(() => setPage(1), [perPage, query, sortBy, sortDir]);

  function closeModal() {
    setOpen(false);
    setEditingId(null);
    setForm({
      name: '',
      description: '',
      hsn_code: '',
      uom: 'NOS',
      unit_price: '',
      tax_rate: '18',
      status: 'active',
    });
  }

  // overlay click: close if clicked outside modal card
  function onOverlayClick(e: React.MouseEvent) {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      closeModal();
    }
  }

  return (
    <Layout>
      <div className="w-full px-8 py-8">
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="text-sm text-gray-400">Products</div>
            <h1 className="text-3xl font-bold text-gray-900 mt-1">Manage products</h1>
            <p className="text-sm text-gray-500 mt-1">Manage products, pricing and status</p>
          </div>

          <div className="flex items-center gap-3">
            {/* Upload Excel */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-2 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-md shadow-sm disabled:opacity-50"
            >
              {uploading ? 'Uploading…' : 'Upload Excel'}
            </button>

            {/* Add Product */}
            <button
              onClick={() => {
                setEditingId(null);
                setForm({
                  name: '',
                  description: '',
                  hsn_code: '',
                  uom: 'NOS',
                  unit_price: '',
                  tax_rate: '18',
                  status: 'active',
                });
                setOpen(true);
              }}
              className="inline-flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-md shadow"
            >
              + Add Product
            </button>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              aria-label="Upload Excel file for products"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleExcelUpload(file);
              }}
            />
          </div>
        </div>

        <Card className="p-5 w-full">
          <div className="flex items-center gap-4 mb-4">
            <div className="flex-1">
              <input
                className={`${css.inputField} w-full`}
                placeholder="Search products..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search products"
              />
            </div>

            <div className="flex items-center gap-3">
              <label htmlFor="perPageTop" className="sr-only">Rows per page</label>
              <select
                id="perPageTop"
                value={perPage}
                onChange={(e) => setPerPage(Number(e.target.value))}
                className={`${css.inputField} ${css.selectShort}`}
                aria-label="Rows per page"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={25}>25</option>
              </select>


            </div>
          </div>

          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3 text-sm text-gray-600">
              <label htmlFor="sortBySelect" className="sr-only">Sort by</label>
              <select
                id="sortBySelect"
                className={`${css.inputField} ${css.selectShort}`}
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                aria-label="Sort by"
              >
                <option value="name">Name</option>
                <option value="unit_price">Unit Price</option>
                <option value="tax_rate">Tax Rate</option>
                <option value="status">Status</option>
              </select>

              <button
                className="px-2 py-1 border rounded text-sm"
                onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                aria-label="Toggle sort direction"
              >
                {sortDir === 'asc' ? '▲' : '▼'}
              </button>
            </div>

            <div className="text-sm text-gray-600">
              Showing {(page - 1) * perPage + 1} - {Math.min(page * perPage, total)} of {total} products
            </div>
          </div>

          <div className="overflow-x-auto bg-white rounded-md border">
            <table className={`min-w-full table-auto text-sm ${css.tableCompact}`}>
              <thead>
                <tr className="text-left text-gray-600 text-xs uppercase tracking-wider bg-gray-50">
                  <th className="px-6 py-3">Product</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">HSN</th>
                  <th className="px-4 py-3">UOM</th>
                  <th className="px-4 py-3 text-right">Unit Price</th>
                  <th className="px-4 py-3 text-right">Tax Rate</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100 bg-white">
                {pageRows.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors duration-150">
                    <td className="px-6 py-4 align-top">
                      <div className="font-medium text-gray-800">{r.name}</div>
                    </td>

                    <td className="px-4 py-4 align-top text-gray-700">
                      {r.description ?? '-'}
                    </td>

                    <td className="px-4 py-4 font-mono text-sm text-gray-700">
                      {r.hsn_code || '-'}
                    </td>

                    <td className="px-4 py-4 align-top">{r.uom}</td>
                    <td className="px-4 py-4 text-right align-top">
                      ₹{Number(r.unit_price || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-4 text-right align-top">{Number(r.tax_rate || 0).toFixed(2)}%</td>
                    <td className="px-4 py-4 align-top">
                      {r.status === 'active' ? (
                        <span className="text-xs px-2 py-1 rounded-full bg-green-50 text-green-700">Active</span>
                      ) : (
                        <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700">{r.status}</span>
                      )}
                    </td>

                    <td className="px-4 py-4 text-right align-top">
                      <div className="inline-flex items-center gap-2">
                        <button onClick={() => openEdit(r)} className="text-sm text-rose-600 hover:underline">Edit</button>
                        <button onClick={() => handleDelete(r.id)} className="text-sm text-gray-600 hover:underline">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}

                {pageRows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-6 py-8 text-center text-gray-500">
                      No products found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
            <div>
              Showing {(page - 1) * perPage + 1} to {Math.min(page * perPage, total)} of {total} products
            </div>

            <div className="flex items-center gap-3">
              <div className="text-sm">Rows</div>
              <label htmlFor="perPageBottom" className="sr-only">Rows per page</label>
              <select
                id="perPageBottom"
                value={perPage}
                onChange={(e) => setPerPage(Number(e.target.value))}
                className={`${css.inputField} ${css.selectShort}`}
                aria-label="Rows per page"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={25}>25</option>
              </select>

              <div className="flex items-center gap-2">
                <button
                  className="px-3 py-1 border rounded"
                  disabled={page === 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Prev
                </button>

                <div className="px-3 py-1 border rounded text-sm bg-gray-50">
                  {page} / {totalPages}
                </div>

                <button
                  className="px-3 py-1 border rounded"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </Card>

        {/* CENTERED MODAL - Add/Edit Product */}
        {open && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            aria-modal="true"
            role="dialog"
            onMouseDown={onOverlayClick}
          >
            {/* overlay */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" />

            {/* modal card */}
            <div
              ref={modalRef}
              className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 transform transition-all duration-200 ease-out scale-100 opacity-100"
              onMouseDown={(e) => e.stopPropagation()}
              role="document"
            >
              {/* header */}
              <div className="flex items-start justify-between px-6 py-4 border-b">
                <div>
                  <h2 className="text-lg font-semibold">{editingId ? 'Edit Product' : 'Add New Product'}</h2>
                  <p className="text-sm text-gray-500">Manage product details, pricing and status</p>
                </div>
                <button
                  onClick={() => closeModal()}
                  aria-label="Close add product modal"
                  className="text-gray-500 hover:text-gray-700 rounded p-1"
                >
                  ✕
                </button>
              </div>

              {/* body */}
              <div className="p-6 space-y-4">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    submit();
                  }}
                >
                  <div className={css.gridTwoCol}>
                    <input
                      className={css.inputField}
                      placeholder="Product Name *"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      required
                      autoFocus
                    />

                    <input
                      className={css.inputField}
                      placeholder="HSN Code"
                      value={form.hsn_code}
                      onChange={(e) => setForm({ ...form, hsn_code: e.target.value })}
                    />

                    <input
                      className={css.inputField}
                      placeholder="Unit Price"
                      value={form.unit_price}
                      onChange={(e) => setForm({ ...form, unit_price: e.target.value })}
                    />

                    <label htmlFor="uom" className={css.srOnly}>Unit of Measure</label>
                    <select id="uom" className={css.inputField} value={form.uom} onChange={(e) => setForm({ ...form, uom: e.target.value })}>
                      <option>NOS</option>
                      <option>SET</option>
                      <option>HR</option>
                    </select>

                    <input
                      className={css.inputField}
                      placeholder="Tax Rate"
                      value={form.tax_rate || ''}
                      onChange={(e) => setForm({ ...form, tax_rate: e.target.value })}
                    />

                    <label htmlFor="status" className={css.srOnly}>Status</label>

                    <select id="status" className={css.inputField} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>

                    {/* DESCRIPTION IS optional NOW */}
                    <textarea
                      className={`${css.inputField} col-span-full`}
                      placeholder="Description (optional)"
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      rows={4}
                    />
                  </div>

                  {/* optional decorative image (local path) */}
                  <div className="flex justify-center mt-4">
                    <img src="/mnt/data/d3c1706d-9b97-418c-920b-2b50ad87ddb1.png" alt="decor" className="h-20 object-contain opacity-90" />
                  </div>

                  {/* footer */}
                  <div className="flex items-center justify-end gap-3 mt-6">
                    <button type="button" onClick={() => closeModal()} className="px-4 py-2 rounded border bg-white">Cancel</button>
                    <button type="submit" className="px-4 py-2 rounded bg-rose-500 text-white">{editingId ? 'Save' : 'Add Product'}</button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
