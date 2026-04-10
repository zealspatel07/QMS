import {
  type ReactNode,
  useEffect,
  useState,
  createContext,
  useContext,
} from "react";
import { API_URL } from "../api";

/* ================= TYPES ================= */

type Role = "admin" | "sales" | "purchase" | "viewer";

export type User = {
  id: number | string;
  email: string;
  name: string;
  role?: Role;
} | null;

type Permissions = {
  isAdmin: boolean;
  isSales: boolean;
  isPurchase: boolean;
  isViewer: boolean;
  canManageUsers: boolean;
  canManageSettings: boolean;
  canCreateQuotation: boolean;
  canCreateIndent: boolean;
  canCreatePO: boolean;
  canViewQuotations: boolean;
  canViewIndents: boolean;
  canViewPurchaseOrders: boolean;
  canViewVendors: boolean;
  canViewCustomers: boolean;
  canViewReports: boolean;
  canViewUsers: boolean;
};

type AuthContextShape = {
  user: User;
  isAuthenticated: boolean;
  permissions: Permissions;
  login: (token: string, immediateUser?: User) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
};

/* ================= CONTEXT ================= */

const AuthContext = createContext<AuthContextShape | undefined>(undefined);

/* ================= HELPERS ================= */

function isTokenValid(token: string | null): boolean {
  if (!token) return false;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    const payload = JSON.parse(atob(parts[1]));
    const now = Date.now() / 1000;
    if (typeof payload.exp === "number") {
      return payload.exp > now;
    }
    return true;
  } catch {
    return false;
  }
}

/* ================= PROVIDER ================= */

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [token, setToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem("token");
    } catch {
      return null;
    }
  });

  const [user, setUser] = useState<User>(() => {
    try {
      const u = localStorage.getItem("user");
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  });

 const isAuthenticated = !!token && isTokenValid(token);

  /* ---------- ROLE & PERMISSIONS ---------- */

  const role: Role = (user?.role as Role) ?? "viewer";

  const permissions: Permissions = {
    // Role checks
    isAdmin: role === "admin",
    isSales: role === "sales",
    isPurchase: role === "purchase",
    isViewer: role === "viewer",

    // Admin permissions
    canManageUsers: role === "admin",
    canManageSettings: role === "admin",

    // Quotation permissions
    canCreateQuotation: role === "admin" || role === "sales",
   canViewQuotations: role === "admin" || role === "sales",

    // Indent permissions
    canCreateIndent: role === "admin" || role === "sales",
    canViewIndents: role === "admin" || role === "sales" || role === "purchase" || role === "viewer",

    // Purchase Order permissions
    canCreatePO: role === "admin" || role === "purchase",
    canViewPurchaseOrders: role === "admin" || role === "purchase",

    // Vendor permissions
    canViewVendors: role === "admin" || role === "purchase",

    // Customer permissions
    canViewCustomers: role === "admin" || role === "sales" || role === "viewer",

    // Reports
    canViewReports: role === "admin" || role === "sales" || role === "purchase" || role === "viewer",

    // User management
    canViewUsers: role === "admin",
  };

  /* ---------- TOKEN HANDLING ---------- */

  const setTokenAndStore = (t: string | null) => {
    try {
      if (t) localStorage.setItem("token", t);
      else localStorage.removeItem("token");
    } catch {}
    setToken(t);
  };

  /* ---------- FETCH CURRENT USER ---------- */

 const fetchMe = async (passedToken?: string) => {
  const tk = passedToken ?? token;

  // 🔒 HARD GUARD — ABSOLUTELY NO TOKEN = NO CALL
  if (!tk) {
    return;
  }

  if (!isTokenValid(tk)) {
    setTokenAndStore(null);
    setUser(null);
    localStorage.removeItem("user");
    return;
  }

  try {
  const res = await fetch(`${API_URL}/api/me`, {
    headers: {
      Authorization: `Bearer ${tk}`,
    },
  });

  if (!res.ok) {
    throw new Error("Unauthorized");
  }

  const body = await res.json();
  const u = body.user;

  const mapped = u
    ? { id: u.id, email: u.email, name: u.name, role: u.role }
    : null;

  setUser(mapped);
  localStorage.setItem("user", JSON.stringify(mapped));

} catch (err) {
  console.error("fetchMe error:", err);
}
};


  /* ---------- AUTH ACTIONS ---------- */

  const login = async (newToken: string, immediateUser?: User) => {
    setTokenAndStore(newToken);

    if (immediateUser) {
      setUser(immediateUser);
      try {
        localStorage.setItem("user", JSON.stringify(immediateUser));
      } catch {}
    }

    await fetchMe(newToken);
  };

  const logout = () => {
    setTokenAndStore(null);
    setUser(null);
    try {
      localStorage.removeItem("user");
    } catch {}
  };

  const refresh = async () => {
    await fetchMe();
  };

  useEffect(() => {
    fetchMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  /* ---------- PROVIDER ---------- */

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        permissions,
        login,
        logout,
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

/* ================= HOOK ================= */

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
};
