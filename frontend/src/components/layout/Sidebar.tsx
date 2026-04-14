// src/components/layout/Sidebar.tsx
import React from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  FileText,
  Building2,
  Package,
  BarChart2,
  Settings,
  ChevronLeft,
  ChevronRight,
  Bell,
  User,
  UserCog,
  ClipboardList,
  Truck,
  ClipboardCheck,
  ShoppingCart,
  Send,
  Receipt,
  Wallet,
  Layers,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";


/* ================= TYPES ================= */

type NavItem = {
  key: string;
  label: string;
  icon: React.ReactNode;
  path: string;
  visible: boolean;
};

type NavSection = {
  key: string;
  title: string;
  items: NavItem[];
  visible: boolean;
};

export type SidebarProps = {
  collapsed?: boolean;
  onToggle?: () => void;
  className?: string;
};

/* ================= LOGO ================= */

const Logo: React.FC<{ collapsed?: boolean }> = ({ collapsed = false }) => (
  <div
    className={`flex items-center gap-3 select-none ${collapsed ? "justify-center" : "justify-start"
      }`}
  >
    <div
      className={`rounded-md overflow-hidden flex items-center ${collapsed ? "w-12 h-12" : "w-40 h-14"
        } p-2 bg-white/90`}
    >
      
    </div>

    {!collapsed && (
      <div className="leading-tight">

      </div>
    )}
  </div>
);

/* ================= NAV ITEM ================= */

const NavItemView: React.FC<{
  item: NavItem;
  collapsed?: boolean;
}> = ({ item, collapsed }) => {
  return (
    <li>
      <NavLink
        to={item.path}
        className={({ isActive }) =>
          `group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all
           ${isActive
            ? "text-[#3A5BA0] font-semibold bg-white/20"
            : "text-white/90 hover:text-white hover:bg-white/10"
          }`
        }
        title={collapsed ? item.label : undefined}
      >
        <div
          className={`flex-none flex items-center justify-center w-11 h-11 rounded-lg ${collapsed ? "mx-auto" : ""
            }`}
        >
          <span className="text-white group-hover:text-white/95">
            {item.icon}
          </span>
        </div>

        <span
          className={`truncate transition-all duration-200 ${collapsed
              ? "opacity-0 w-0 pointer-events-none"
              : "opacity-100"
            }`}
        >
          {item.label}
        </span>
      </NavLink>
    </li>
  );
};

/* ================= SIDEBAR ================= */

const Sidebar: React.FC<SidebarProps> = ({
  collapsed = false,
  onToggle,
  className = "",
}) => {
 const { user } = useAuth();

  /* ---------- NAV CONFIG ---------- */

  const sections: NavSection[] = [
    {
      key: "sales",
      title: "Sales",
      visible: user?.role === "sales" || user?.role === "admin",
      items: [
        {
          key: "dashboard",
          label: "Dashboard",
          icon: <LayoutDashboard size={18} />,
          path: "/dashboard",
          visible: user?.role === "sales" || user?.role === "admin",
        },
        {
          key: "enquiries",
          label: "Enquiries",
          icon: <ClipboardCheck size={18} />,
          path: "/enquiries",
          visible: user?.role === "sales" || user?.role === "admin",
        },
        {
          key: "quotations",
          label: "Quotations",
          icon: <FileText size={18} />,
          path: "/quotations",
          visible: user?.role === "sales" || user?.role === "admin",
        },
        {
          key: "sales_orders",
          label: "Sales Orders",
          icon: <ShoppingCart size={18} />,
          path: "/sales-orders",
          visible: user?.role === "sales" || user?.role === "admin",
        },
        {
          key: "dispatch",
          label: "Dispatch",
          icon: <Send size={18} />,
          path: "/dispatch",
          visible: user?.role === "sales" || user?.role === "admin",
        },
      ],
    },
    {
      key: "procurement",
      title: "Procurement",
      visible: user?.role === "purchase" || user?.role === "admin",
      items: [
        {
          key: "purchase_dashboard",
          label: "Procurement",
          icon: <BarChart2 size={18} />,
          path: "/purchase-dashboard",
          visible: user?.role === "purchase" || user?.role === "admin",
        },
        {
          key: "indents",
          label: "Indents",
          icon: <ClipboardList size={18} />,
          path: "/indents",
          visible: user?.role === "sales" || user?.role === "purchase" || user?.role === "admin",
        },
        {
          key: "purchase_orders",
          label: "Purchase Orders",
          icon: <Package size={18} />,
          path: "/purchase-orders",
          visible: user?.role === "purchase" || user?.role === "admin",
        },
        {
          key: "grn",
          label: "GRN",
          icon: <ClipboardCheck size={18} />,
          path: "/grn",
          visible: user?.role === "purchase" || user?.role === "admin",
        },
        {
          key: "vendors",
          label: "Vendors",
          icon: <Truck size={18} />,
          path: "/vendors",
          visible: user?.role === "purchase" || user?.role === "admin",
        },
      ],
    },
    {
      key: "inventory",
      title: "Inventory",
      visible: true,
      items: [
        {
          key: "stock_ledger",
          label: "Stock Ledger",
          icon: <Layers size={18} />,
          path: "/stock-ledger",
          visible: true,
        },
        {
          key: "in_stock",
          label: "In Stock View",
          icon: <Package size={18} />,
          path: "/in-stock",
          visible: true,
        },
        {
          key: "products",
          label: "Products",
          icon: <Package size={18} />,
          path: "/products",
          visible: true,
        },
      ],
    },
    {
      key: "finance",
      title: "Finance",
      visible: user?.role === "sales" || user?.role === "admin",
      items: [
        {
          key: "invoices",
          label: "Invoices",
          icon: <Receipt size={18} />,
          path: "/invoices",
          visible: user?.role === "sales" || user?.role === "admin",
        },
        {
          key: "payments",
          label: "Payments",
          icon: <Wallet size={18} />,
          path: "/payments",
          visible: user?.role === "sales" || user?.role === "admin",
        },
        {
          key: "tally",
          label: "Tally Export",
          icon: <FileText size={18} />,
          path: "/tally-export",
          visible: user?.role === "sales" || user?.role === "admin",
        },
      ],
    },
    {
      key: "master",
      title: "Master",
      visible: true,
      items: [
        {
          key: "customers",
          label: "Customers",
          icon: <Building2 size={18} />,
          path: "/customers",
          visible: user?.role === "sales" || user?.role === "admin",
        },
        {
          key: "reports",
          label: "Reports",
          icon: <BarChart2 size={18} />,
          path: "/reports",
          visible: user?.role === "admin" || user?.role === "sales" || user?.role === "purchase",
        },
      ],
    },
    {
      key: "admin",
      title: "Admin",
      visible: user?.role === "admin",
      items: [
        {
          key: "users",
          label: "User Management",
          icon: <UserCog size={18} />,
          path: "/user-management",
          visible: user?.role === "admin",
        },
        {
          key: "settings",
          label: "System Settings",
          icon: <Settings size={18} />,
          path: "/system-settings",
          visible: user?.role === "admin",
        },
      ],
    },
    {
      key: "profile",
      title: "Profile",
      visible: true,
      items: [
        {
          key: "profile",
          label: "My Profile",
          icon: <User size={18} />,
          path: "/user-profile",
          visible: true,
        },
      ],
    },
  ];

  const handleToggleClick = (
    e: React.MouseEvent<HTMLButtonElement>
  ) => {
    e.stopPropagation();
    e.preventDefault();
    onToggle?.();
  };

  /* ---------- RENDER ---------- */

  return (
    <aside
      aria-label="Main navigation"
      className={`flex flex-col h-full text-sm shrink-0 transition-[width] duration-300 ease-in-out ${collapsed
          ? "w-[var(--sidebar-w-collapsed)]"
          : "w-[var(--sidebar-w-expanded)]"
        } ${className}`}
      style={{
        background:
          "linear-gradient(180deg, rgba(255,92,168,0.95) 0%, rgba(180,83,255,0.94) 45%, rgba(58,91,160,0.98) 100%)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.04), 0 6px 20px rgba(11,15,30,0.06)",
        paddingTop: "0.75rem",
        paddingBottom: "0.75rem",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div style={{ paddingLeft: 8 }}>
          <Logo collapsed={collapsed} />
        </div>

        <div className="flex items-center gap-2 pr-2">
          {!collapsed && (
            <button
              className="p-2 rounded-md bg-white/12 hover:bg-white/16 transition"
              aria-label="Notifications"
              type="button"
            >
              <Bell size={18} className="text-white" />
            </button>
          )}

          <button
            onClick={handleToggleClick}
            aria-expanded={!collapsed}
            aria-label={
              collapsed ? "Expand sidebar" : "Collapse sidebar"
            }
            type="button"
            className="p-2 rounded-md bg-white/12 hover:bg-white/16 transition"
          >
            {collapsed ? (
              <ChevronLeft size={18} className="text-white" />
            ) : (
              <ChevronRight size={18} className="text-white" />
            )}
          </button>
        </div>
      </div>

      {/* Divider */}
      <div className="px-3">
        <div className="h-px bg-white/10 my-3" />
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <div className="space-y-4">
          {sections
            .filter((s) => s.visible)
            .map((section) => (
              <div key={section.key}>
                {!collapsed && (
                  <div className="px-3 pt-2 pb-1 text-[11px] uppercase tracking-wider text-white/70">
                    {section.title}
                  </div>
                )}
                <ul className="space-y-1">
                  {section.items
                    .filter((item) => item.visible)
                    .map((item) => (
                      <NavItemView key={item.key} item={item} collapsed={collapsed} />
                    ))}
                </ul>
              </div>
            ))}
        </div>
      </nav>

      {/* Footer */}
      <div className={`px-4 py-4 ${collapsed ? "text-center" : ""}`}>
        <div className="text-xs text-white/70">
          {!collapsed ? (
            <div className="flex items-center justify-between">
              <span>v1.0</span>
              <span>© Prayosha</span>
            </div>
          ) : (
            <div>v1.0</div>
          )}
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
