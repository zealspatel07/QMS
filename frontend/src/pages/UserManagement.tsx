import { useEffect, useMemo, useState } from "react";
import Layout from "../components/layout/Layout";
import { api } from "../api";
import { toast } from "react-toastify";
import CreateUserModal from "./CreateUserModal";
import { Trash2, Edit2, CheckCircle, Lock } from "lucide-react";

/* ================= TYPES ================= */

type User = {
  id: number;
  name: string;
  username: string;
  email: string;
  phone?: string;
  position?: string;
  role: string;
  is_active: number; // 1 = active, 0 = disabled
  created_at?: string;
};

/* ================= COMPONENT ================= */

export default function AdminUsers() {
  /* ---------- STATE ---------- */
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  // modal
  const [modalOpen, setModalOpen] = useState(false);

  // pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);


  //edit user state can be added here later
  const [editingUser, setEditingUser] = useState<User | null>(null);

  /* ---------- DATA LOAD ---------- */
  async function loadUsers() {
    setLoading(true);
    try {
      const res = await api.getUsers();
      const data = Array.isArray(res) ? res : res?.data ?? [];
      setUsers(data);
      setPage(1);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  /* ---------- STATUS TOGGLE ---------- */
  async function toggleUserStatus(user: User) {
  const isActive = user.is_active === 1;
  const nextStatus = isActive ? 0 : 1;
  const action = isActive ? "Deactivate" : "Activate";

  if (!confirm(`${action} user "${user.name}"?`)) return;

  try {
    await api.toggleUserStatus(user.id, nextStatus);

    // Optimistic UI update
    setUsers((prev) =>
      prev.map((u) =>
        u.id === user.id ? { ...u, is_active: nextStatus } : u
      )
    );

    toast.success(`User ${action.toLowerCase()}d successfully`);
  } catch (err) {
    console.error(err);
    toast.error("Unable to update user status");
  }
}

  /* ---------- DELETE USER ---------- */
  async function deleteUser(user: User) {
    if (!confirm(`Delete user "${user.name}"? This action cannot be undone.`)) return;

    try {
      await api.deleteUser(user.id);
      
      // Remove from state
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      
      toast.success("User deleted successfully");
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete user");
    }
  }


  /* ---------- SEARCH ---------- */
  const filteredUsers = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.phone || "").toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
    );
  }, [users, search]);

  /* ---------- PAGINATION ---------- */
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));

  const pagedUsers = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredUsers.slice(start, start + pageSize);
  }, [filteredUsers, page, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  /* ---------- STATS ---------- */
  const userStats = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => u.is_active === 1).length;
    const inactive = users.filter((u) => u.is_active === 0).length;
    
    const roleCount = {
      admin: users.filter((u) => u.role === "admin").length,
      sales: users.filter((u) => u.role === "sales").length,
      purchase: users.filter((u) => u.role === "purchase").length,
      viewer: users.filter((u) => u.role === "viewer").length,
    };

    return { total, active, inactive, roleCount };
  }, [users]);

  /* ---------- HELPERS ---------- */
  function initials(name?: string) {
    if (!name) return "?";
    const p = name.trim().split(/\s+/);
    return p.length === 1
      ? p[0].slice(0, 2).toUpperCase()
      : (p[0][0] + p[1][0]).toUpperCase();
  }

  function roleBadge(role: string) {
    const map: Record<string, string> = {
      admin: "bg-indigo-100 text-indigo-700",
      sales: "bg-emerald-100 text-emerald-700",
      purchase: "bg-blue-100 text-blue-700",
      viewer: "bg-amber-100 text-amber-700",
    };
    return map[role] ?? "bg-slate-100 text-slate-700";
  }

  function statusBadge(isActive: number) {
    return isActive
      ? "bg-emerald-100 text-emerald-700"
      : "bg-slate-200 text-slate-600";
  }

  /* ================= RENDER ================= */

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* ---------- HEADER ---------- */}
        <div className="flex justify-between items-start">
          <div>
            <div className="text-sm text-slate-400">Users</div>
            <h1 className="text-3xl font-semibold text-slate-800">
              User Management
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Manage system users, roles, and access control
            </p>
          </div>

         <button
  onClick={() => {
    setEditingUser(null); // 👈 CREATE MODE
    setModalOpen(true);
  }}
  className="px-4 py-2 bg-rose-500 text-white rounded-md hover:bg-rose-600 shadow"
>
  + Add User
</button>
        </div>

        {/* ---------- STATS CARDS ---------- */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {/* Total Users */}
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <div className="text-xs text-slate-500 font-medium">Total Users</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              {userStats.total}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              {userStats.active} active
            </div>
          </div>

          {/* Admin Role */}
          <div className="rounded-lg border border-indigo-200 p-4 bg-indigo-50">
            <div className="text-xs text-indigo-600 font-medium">Admin</div>
            <div className="text-2xl font-bold text-indigo-700 mt-1">
              {userStats.roleCount.admin}
            </div>
          </div>

          {/* Sales Role */}
          <div className="rounded-lg border border-emerald-200 p-4 bg-emerald-50">
            <div className="text-xs text-emerald-600 font-medium">Sales</div>
            <div className="text-2xl font-bold text-emerald-700 mt-1">
              {userStats.roleCount.sales}
            </div>
          </div>

          {/* Purchase Role */}
          <div className="rounded-lg border border-blue-200 p-4 bg-blue-50">
            <div className="text-xs text-blue-600 font-medium">Purchase</div>
            <div className="text-2xl font-bold text-blue-700 mt-1">
              {userStats.roleCount.purchase}
            </div>
          </div>

          {/* Viewer Role */}
          <div className="rounded-lg border border-amber-200 p-4 bg-amber-50">
            <div className="text-xs text-amber-600 font-medium">Viewer</div>
            <div className="text-2xl font-bold text-amber-700 mt-1">
              {userStats.roleCount.viewer}
            </div>
          </div>
        </div>

        {/* ---------- CARD ---------- */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
          {/* Search */}
          <div className="px-6 py-4 border-b">
            <input
              type="search"
              placeholder="Search by name, email, phone or role…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full px-4 py-2 text-sm border rounded-md focus:ring-2 focus:ring-rose-100"
            />
          </div>

          {/* Table */}
          <div className="overflow-x-auto p-6">
            <table className="min-w-full text-sm divide-y">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left">User</th>
                  <th className="px-4 py-3 hidden md:table-cell">Phone</th>
                  <th className="px-4 py-3 hidden lg:table-cell">Position</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y">
                {loading && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      Loading users…
                    </td>
                  </tr>
                )}

                {!loading &&
                  pagedUsers.map((u) => (
                    <tr
                      key={u.id}
                      className={`hover:bg-slate-50 ${
                        !u.is_active ? "opacity-60 bg-slate-50" : ""
                      }`}
                    >
                      <td className="px-4 py-4 flex gap-3 items-center">
                        <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center font-semibold">
                          {initials(u.name)}
                        </div>
                        <div>
                          <div className="font-medium">{u.name}</div>
                          <div className="text-xs text-slate-400">
                            {u.email}
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-4 hidden md:table-cell">
                        {u.phone || "-"}
                      </td>

                      <td className="px-4 py-4 hidden lg:table-cell">
                        {u.position || "-"}
                      </td>

                      <td className="px-4 py-4">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${roleBadge(
                            u.role
                          )}`}
                        >
                          {u.role}
                        </span>
                      </td>

                      <td className="px-4 py-4">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${statusBadge(
                            u.is_active
                          )}`}
                        >
                          {u.is_active ? "Active" : "Disabled"}
                        </span>
                      </td>

                      <td className="px-4 py-4 text-right">
                        <div className="inline-flex gap-2">
                          <button
                            onClick={() => {
                              setEditingUser(u); 
                              setModalOpen(true);
                            }}
                            title="Edit user"
                            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
                          >
                            <Edit2 size={16} />
                          </button>

                          <button
                            onClick={() => toggleUserStatus(u)}
                            title={u.is_active ? "Deactivate user" : "Activate user"}
                            className={`p-2 rounded transition-colors ${
                              u.is_active
                                ? "text-slate-600 hover:text-rose-600 hover:bg-rose-50"
                                : "text-slate-600 hover:text-emerald-600 hover:bg-emerald-50"
                            }`}
                          >
                            {u.is_active ? <Lock size={16} /> : <CheckCircle size={16} />}
                          </button>

                          <button
                            onClick={() => deleteUser(u)}
                            title="Delete user"
                            className="p-2 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                {!loading && filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      No users found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-6 py-4 border-t flex justify-between items-center text-sm">
            <div>
              Showing {(page - 1) * pageSize + 1}–
              {Math.min(page * pageSize, filteredUsers.length)} of{" "}
              {filteredUsers.length}
            </div>

            <div className="flex items-center gap-2">
              <select
                value={pageSize}
                aria-label="Items per page"
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="border rounded px-2 py-1"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={25}>25</option>
              </select>

              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1 border rounded disabled:opacity-40"
              >
                Prev
              </button>
              <button
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1 border rounded disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>

        {/* ---------- MODAL ---------- */}
       <CreateUserModal
  open={modalOpen}
  user={editingUser}      // ✅ PASS USER
  onClose={() => {
    setModalOpen(false);
    setEditingUser(null); // reset after close
  }}
  onCreated={loadUsers}
/>
      </div>
    </Layout>
  );
}
