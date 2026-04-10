// src/pages/Profile.tsx
import  { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import Layout from "../components/layout/Layout";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import { Edit2, Trash2, Download, Search as SearchIcon, ArrowLeft, ArrowRight } from "lucide-react";

type UserRow = {
  id: number;
  email: string;
  name: string;
  role?: string | null;
  created_at?: string | null;
};

function initialsFromName(name?: string | null) {
  if (!name) return "U";
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return (parts[0][0] || "U").toUpperCase();
  return ((parts[0][0] || "") + (parts[parts.length - 1][0] || "")).toUpperCase();
}

function niceRoleColor(role?: string | null) {
  const r = (role || "user").toLowerCase();
  if (r === "admin") return "bg-rose-50 text-rose-700";
  if (r === "sales") return "bg-amber-50 text-amber-700";
  if (r === "viewer") return "bg-sky-50 text-sky-700";
  return "bg-slate-100 text-slate-700";
}

function formatDate(d?: string | null) {
  if (!d) return "-";
  try {
    const dt = new Date(d);
    return dt.toLocaleString();
  } catch {
    return d;
  }
}

export default function Profile() {
  const { user, logout } = useAuth();
  const token = api.getAuthToken?.();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const perPage = 8;
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function loadUsers() {
      setLoading(true);
      setError(null);
      try {
        const resp = await fetch(
          `${(import.meta.env.VITE_API_BASE || "http://localhost:4000")}/api/users`,
          {
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            signal: controller.signal,
          }
        );

        if (!resp.ok) {
          const text = await resp.text().catch(() => "");
          try {
            const parsed = JSON.parse(text || "{}");
            const msg = parsed?.message || parsed?.error || text || `Status ${resp.status}`;
            throw new Error(msg);
          } catch {
            throw new Error(text || `Failed to load users (${resp.status})`);
          }
        }

        const body = await resp.json();
        const list: UserRow[] = Array.isArray(body) ? body : body?.users ?? [];
        if (!cancelled) {
          setRows(list);
          if (list.length > 0) {
            setSelectedId((prev) => prev ?? (user?.id ? Number(user.id) : list[0].id));
          }
        }
      } catch (err: any) {
        if (!cancelled) {
          if (err.name === "AbortError") {
            // ignore
          } else {
            setError(err?.message ?? "Failed to load users");
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadUsers();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [token, user?.id]);

  const filtered = useMemo(() => {
    const q = String(query || "").trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      return (
        String(r.name ?? "").toLowerCase().includes(q) ||
        String(r.email ?? "").toLowerCase().includes(q) ||
        String(r.role ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, query]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / perPage));
  useEffect(() => {
    if (page > pageCount) setPage(1);
  }, [pageCount]);

  const pageItems = filtered.slice((page - 1) * perPage, page * perPage);

  function handleExportCsv() {
    const header = ["id", "name", "email", "role", "created_at"];
    const lines = [header.join(",")].concat(
      (filtered || []).map((r) =>
        [
          r.id,
          `"${String(r.name ?? "").replace(/"/g, '""')}"`,
          `"${String(r.email ?? "").replace(/"/g, '""')}"`,
          r.role ?? "",
          r.created_at ?? ""
        ].join(",")
      )
    );
    const csv = lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const dateSafe = new Date().toISOString().slice(0,10);
    a.download = `users_export_${dateSafe}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // --- Updated: actual deletion against server + error handling ---
  async function handleDeleteUser(u: UserRow) {
    const ok = window.confirm(`Delete user "${u.name}" (${u.email})? This cannot be undone in the UI.`);
    if (!ok) return;

    try {
      // show a transient loading notice
      await toast.promise(
        api.deleteUser ? api.deleteUser(u.id) : Promise.reject(new Error('deleteUser API not available')),
        {
          loading: `Deleting user "${u.name}"...`,
          success: `✓ User "${u.name}" deleted`,
          error: (err: any) => {
            const status = err?.status;
            const body = err?.body;
            if (status === 409) {
              const serverMsg = (body && (body.error || body.message)) || 'Conflict: cannot delete user (server prevented it).';
              return `Delete failed: ${serverMsg}`;
            } else {
              const msg = (body && (body.error || body.message)) || err?.message || 'Delete failed';
              return `Delete failed: ${msg}`;
            }
          }
        }
      );

      // on success: remove from UI
      setRows((prev) => prev.filter((r) => r.id !== u.id));
      // if selected user was deleted, pick a sensible fallback
      setSelectedId((prev) => {
        if (prev === u.id) {
          const remaining = rows.filter((r) => r.id !== u.id);
          return remaining.length ? remaining[0].id : null;
        }
        return prev;
      });
    } catch (err: any) {
      console.error('handleDeleteUser error', err);
    }
  }

  function handleEditUser(u: UserRow) {
    setNotice(`Edit UI not implemented for user ID ${u.id}. Implement modal or route to edit users.`);
  }

  const selected = rows.find((r) => r.id === selectedId) ?? null;

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-6 py-4">
        {notice ? (
          <div className="mb-4 rounded-md bg-amber-50 border-l-4 border-amber-400 p-3 text-amber-800">
            <div className="flex items-start justify-between">
              <div className="text-sm">{notice}</div>
              <button className="ml-4 text-xs underline" onClick={() => setNotice(null)}>Dismiss</button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="flex items-start justify-between gap-6 mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Profile</h1>
            <p className="text-sm text-slate-500 mt-1">Manage accounts, roles and access. Only admins can edit or delete users.</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border text-sm hover:shadow"
              title="Refresh"
            >
              Refresh
            </button>

            <button
              onClick={() => { logout(); window.location.href = "/login"; }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-600 text-white text-sm"
            >
              Sign out
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <aside className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-sm border p-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#ff8a70] to-[#ff5f86] text-white flex items-center justify-center text-xl font-bold">
                  {initialsFromName(user?.name ?? user?.email ?? "")}
                </div>
                <div>
                  <div className="text-lg font-semibold text-slate-900">{user?.name ?? user?.email}</div>
                  <div className="text-sm text-slate-500">{user?.email}</div>
                  <div className={`inline-block mt-2 text-xs px-2 py-1 rounded ${niceRoleColor(user?.role)}`.trim()}>
                    {(user?.role ?? "user")?.toUpperCase()}
                  </div>
                </div>
              </div>

              <div className="mt-5 text-sm text-slate-600 space-y-2">
                <div><span className="text-slate-500">Signed in as:</span> <span className="font-medium">{user?.name ?? user?.email}</span></div>
                <div className="text-xs text-slate-400">Account ID: <span className="font-mono text-slate-600">{user?.id ?? "-"}</span></div>
              </div>

              <div className="mt-6 border-t pt-4 flex flex-col gap-2">
                <button
                  className="text-left px-3 py-2 rounded-lg border bg-white hover:shadow-sm text-sm"
                  onClick={() => setNotice("Edit profile UI not implemented.")}
                >
                  Edit profile
                </button>

                <button
                  className="text-left px-3 py-2 rounded-lg border bg-white hover:shadow-sm text-sm"
                  onClick={() => setNotice("Change password UI not implemented.")}
                >
                  Change password
                </button>

                <button
                  className="text-left px-3 py-2 rounded-lg border bg-white hover:shadow-sm text-sm"
                  onClick={() => setNotice("Two-factor authentication not implemented.")}
                >
                  Two-factor authentication
                </button>
              </div>
            </div>
          </aside>

          <section className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">All accounts</h2>
                  <div className="text-sm text-slate-500">Loaded from server. Use search or export CSV.</div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="relative">
                    <input
                      value={query}
                      onChange={(e) => { setQuery(e.target.value); setPage(1); }}
                      placeholder="Search name, email or role"
                      className="pl-10 pr-3 py-2 rounded-lg border bg-slate-50 text-sm w-64 focus:outline-none"
                    />
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><SearchIcon size={16} /></div>
                  </div>

                  <button
                    onClick={handleExportCsv}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border text-sm hover:shadow"
                    title="Export CSV"
                  >
                    <Download size={16} /> Export CSV
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="py-12 text-center text-slate-500">Loading users…</div>
              ) : error ? (
                <div className="py-6 text-center text-rose-600">Error: {error}</div>
              ) : (
                <>
                  <div className="overflow-hidden rounded-lg border">
                    <table className="min-w-full divide-y">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-4 py-3 text-xs text-slate-500 text-left">#</th>
                          <th className="px-4 py-3 text-xs text-slate-500 text-left">Name</th>
                          <th className="px-4 py-3 text-xs text-slate-500 text-left">Email</th>
                          <th className="px-4 py-3 text-xs text-slate-500 text-left">Role</th>
                          <th className="px-4 py-3 text-xs text-slate-500 text-left">Created</th>
                          <th className="px-4 py-3 text-xs text-slate-500 text-right">Actions</th>
                        </tr>
                      </thead>

                      <tbody className="bg-white divide-y">
                        {pageItems.length === 0 ? (
                          <tr><td colSpan={6} className="py-8 text-center text-slate-400">No users found</td></tr>
                        ) : pageItems.map((r, i) => (
                          <tr
                            key={r.id}
                            className={`hover:bg-slate-50 cursor-pointer ${selectedId === r.id ? "bg-slate-50" : ""}`}
                            onClick={() => setSelectedId(r.id)}
                          >
                            <td className="px-4 py-4 text-sm text-slate-700">{(page - 1) * perPage + i + 1}</td>

                            <td className="px-4 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-sm font-semibold">
                                  {initialsFromName(r.name)}
                                </div>
                                <div>
                                  <div className="font-medium text-slate-900">{r.name}</div>
                                  <div className="text-xs text-slate-400">ID: {r.id}</div>
                                </div>
                              </div>
                            </td>

                            <td className="px-4 py-4 text-sm text-slate-600">{r.email}</td>

                            <td className="px-4 py-4">
                              <span className={`text-xs px-2 py-1 rounded ${niceRoleColor(r.role)}`.trim()}>
                                {(r.role ?? "user")?.toUpperCase()}
                              </span>
                            </td>

                            <td className="px-4 py-4 text-sm text-slate-500">{formatDate(r.created_at)}</td>

                            <td className="px-4 py-4 text-right">
                              <div className="inline-flex items-center gap-2 justify-end">
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleEditUser(r); }}
                                  className="p-2 rounded-md hover:bg-slate-100"
                                  title="Edit"
                                >
                                  <Edit2 size={16} />
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleDeleteUser(r); }}
                                  className="p-2 rounded-md hover:bg-slate-100 text-rose-600"
                                  title="Delete"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <div className="text-sm text-slate-500">
                      Showing {(page - 1) * perPage + (pageItems.length ? 1 : 0)}–{(page - 1) * perPage + pageItems.length} of {filtered.length}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded border bg-white text-sm"
                      >
                        <ArrowLeft size={14} /> Prev
                      </button>

                      <div className="text-sm text-slate-600 px-3">{page} / {pageCount}</div>

                      <button
                        onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                        disabled={page === pageCount}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded border bg-white text-sm"
                      >
                        Next <ArrowRight size={14} />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {selected ? (
              <div className="bg-white rounded-2xl shadow-sm border p-6 flex items-center justify-between">
                <div>
                  <div className="text-lg font-semibold text-slate-900">{selected.name}</div>
                  <div className="text-sm text-slate-500">{selected.email}</div>
                  <div className="mt-2 text-xs text-slate-400">Role: <span className="font-medium">{selected.role ?? "user"}</span></div>
                  <div className="mt-1 text-xs text-slate-400">Created: {formatDate(selected.created_at)}</div>
                </div>

                <div className="flex items-center gap-3">
                  <button onClick={() => handleEditUser(selected)} className="px-3 py-2 rounded bg-white border text-sm">Edit</button>
                  <button onClick={() => handleDeleteUser(selected)} className="px-3 py-2 rounded bg-rose-600 text-white text-sm">Delete</button>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </Layout>
  );
}
