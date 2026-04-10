//SRC/pages/CreateUserModal.tsx
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { api } from "../api";
import { Shield } from "lucide-react";



const USERNAME_REGEX =
  /^(?=.*[A-Z])(?=.*[0-9])(?=.*[@_])[A-Za-z0-9@_]{4,100}$/;

export default function CreateUserModal({
  open,
  user,
  onClose,
  onCreated,
}: {
  open: boolean;
  user?: any;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    username: "",
    name: "",
    email: "",
    phone: "",
    position: "",
    role: "sales",
    password: "",
  });

    
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  /* Helper for role styling */
  function getRoleClasses(roleValue: string, isSelected: boolean) {
    const classes: Record<string, string> = {
      admin: isSelected
        ? "border-indigo-500 bg-indigo-50"
        : "border-slate-200 hover:border-slate-300",
      sales: isSelected
        ? "border-emerald-500 bg-emerald-50"
        : "border-slate-200 hover:border-slate-300",
      purchase: isSelected
        ? "border-blue-500 bg-blue-50"
        : "border-slate-200 hover:border-slate-300",
      viewer: isSelected
        ? "border-amber-500 bg-amber-50"
        : "border-slate-200 hover:border-slate-300",
    };
    return classes[roleValue] || classes.admin;
  }
  useEffect(() => {
    if (user) {
      // EDIT MODE
      setForm({
        username: user.username ?? "",
        name: user.name ?? "",
        email: user.email ?? "",
        phone: user.phone ?? "",
        position: user.position ?? "",
        role: user.role ?? "sales",
        password: "",
      });
    } else {
      // CREATE MODE
      setForm({
        username: "",
        name: "",
        email: "",
        phone: "",
        position: "",
        role: "sales",
        password: "",
      });
    }
  }, [user, open]);


  if (!open) return null;

  async function submit() {
    if (!form.email || (!user && !form.password)) {
      toast.error("Email and password are required");
      return;
    }

    if (form.username && !USERNAME_REGEX.test(form.username)) {
      toast.error("Username must contain 1 capital letter, 1 number, and @ or _");
      return;
    }

    try {
      setSaving(true);

      if (user) {
        // ✅ EDIT MODE
        await api.updateUser(user.id, {
          username: form.username,
          name: form.name,
          email: form.email,
          phone: form.phone,
          position: form.position,
          role: form.role,
        });

        // 2️⃣ Update password ONLY if user entered one
        if (form.password && form.password.trim().length > 0) {
          await api.updateUserPassword(user.id, form.password);
          toast.success("User updated successfully");

          // 🔐 FORCE LOGOUT IF USER CHANGED OWN PASSWORD
          const currentUserId = Number(localStorage.getItem("user_id"));
          if (currentUserId && user.id === currentUserId) {
            toast.success("Password updated. Please login again.");
            setTimeout(() => {
              localStorage.removeItem("token");
              localStorage.removeItem("user_id");
              window.location.href = "/login";
            }, 1500);
            return; // ⛔ stop execution
          }
        } else {
          toast.success("User updated successfully");
        }
      } else {
        // ✅ CREATE MODE
        await toast.promise(
          api.createUser({
            username: form.username,
            name: form.name,
            email: form.email,
            phone: form.phone,
            position: form.position,
            role: form.role,
            password: form.password,
          }),
          {
            loading: "Creating user...",
            success: "✓ User created successfully",
            error: "Failed to create user"
          }
        );
      }

      onClose();
      onCreated();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative bg-white w-full max-w-2xl rounded-xl shadow-xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center gap-2 mb-6">
          <Shield className="text-indigo-600" size={24} />
          <h3 className="text-lg font-semibold">
            {user ? "Edit User" : "Create New User"}
          </h3>
        </div>

        {/* ---------- PERSONAL INFO SECTION ---------- */}
        <div className="mb-6 pb-6 border-b">
          <h4 className="text-sm font-semibold text-slate-700 mb-4">Personal Information</h4>
          
          <div className="grid grid-cols-2 gap-4">
            <input
              placeholder="Username"
              className="border px-3 py-2 rounded focus:ring-2 focus:ring-blue-200"
              value={form.username}
              onChange={(e) =>
                setForm({ ...form, username: e.target.value })
              }
            />

            <input
              placeholder="Full name"
              className="border px-3 py-2 rounded focus:ring-2 focus:ring-blue-200"
              value={form.name}
              onChange={(e) =>
                setForm({ ...form, name: e.target.value })
              }
            />

            <input
              placeholder="Email"
              type="email"
              className="border px-3 py-2 rounded focus:ring-2 focus:ring-blue-200"
              value={form.email}
              onChange={(e) =>
                setForm({ ...form, email: e.target.value })
              }
            />

            <input
              placeholder="Phone"
              className="border px-3 py-2 rounded focus:ring-2 focus:ring-blue-200"
              value={form.phone}
              onChange={(e) =>
                setForm({ ...form, phone: e.target.value })
              }
            />

            <input
              placeholder="Position"
              className="col-span-2 border px-3 py-2 rounded focus:ring-2 focus:ring-blue-200"
              value={form.position}
              onChange={(e) =>
                setForm({ ...form, position: e.target.value })
              }
            />
          </div>
        </div>

        {/* ---------- ROLE ASSIGNMENT SECTION ---------- */}
        <div className="mb-6 pb-6 border-b">
          <h4 className="text-sm font-semibold text-slate-700 mb-4">Role Assignment</h4>
          
          <div className="space-y-3">
            {[
              {
                value: "admin",
                label: "Administrator",
                desc: "Full system access. Manage users, settings, and all modules.",
              },
              {
                value: "sales",
                label: "Sales",
                desc: "Create quotations and indents. View customers and reports.",
              },
              {
                value: "purchase",
                label: "Purchase",
                desc: "Create purchase orders and manage vendors. View indents.",
              },
              {
                value: "viewer",
                label: "Viewer",
                desc: "Read-only access to all data. No create/edit permissions.",
              },
            ].map((role) => (
              <label
                key={role.value}
                className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${getRoleClasses(
                  role.value,
                  form.role === role.value
                )}`}
              >
                <input
                  type="radio"
                  name="role"
                  value={role.value}
                  checked={form.role === role.value}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="font-medium text-slate-900">{role.label}</div>
                  <div className="text-xs text-slate-500">{role.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* ---------- PASSWORD SECTION ---------- */}
        <div className="mb-6">
          <h4 className="text-sm font-semibold text-slate-700 mb-4">
            {user ? "Change Password (Optional)" : "Password"}
          </h4>
          
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder={user ? "Leave blank to keep current password" : "Enter password"}
              className="border px-3 py-2 rounded w-full pr-20 focus:ring-2 focus:ring-blue-200"
              value={form.password}
              onChange={(e) =>
                setForm({ ...form, password: e.target.value })
              }
            />

            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-blue-600 hover:text-blue-700"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
          
          {!user && (
            <div className="mt-2 p-2 bg-slate-50 rounded text-xs text-slate-600">
              <strong>Requirements:</strong> At least 1 capital letter, 1 number, and @ or _ symbol
            </div>
          )}
        </div>

        {/* ---------- ACTIONS ---------- */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <button 
            onClick={onClose} 
            className="px-4 py-2 border rounded hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving
              ? user ? "Updating…" : "Creating…"
              : user ? "Update User" : "Create User"}
          </button>
        </div>
      </div>
    </div>
  );
}
