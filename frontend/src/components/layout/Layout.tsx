// src/components/layout/Layout.tsx
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import { useLocation } from "react-router-dom";
type LayoutProps = { children?: React.ReactNode };

type SidebarContextShape = {
  collapsed: boolean;
  toggle: () => void;
};

const SIDEBAR_STORAGE_KEY = "ui:sidebar:collapsed";
const SidebarContext = createContext<SidebarContextShape | undefined>(undefined);

export const useSidebar = (): SidebarContextShape => {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used within <Layout />");
  return ctx;
};

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const getInitial = () => {
    try {
      const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
      if (stored === "true") return true;
      if (stored === "false") return false;
      if (typeof window !== "undefined") {
        return window.innerWidth < 1024;
      }
      return false;
    } catch {
      return false;
    }
  };

  const [collapsed, setCollapsed] = useState<boolean>(getInitial);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, collapsed ? "true" : "false");
    } catch { }
  }, [collapsed]);

  const toggle = () => setCollapsed((c) => !c);

  const sidebarWidth = useMemo(
    () => (collapsed ? "var(--sidebar-w-collapsed)" : "var(--sidebar-w-expanded)"),
    [collapsed]
  );

  const contextValue = useMemo(() => ({ collapsed, toggle }), [collapsed]);

  const location = useLocation();
  const isAuthPage = location.pathname === "/login";

  // responsive mobile detection for overlay
  const [isMobile, setIsMobile] = useState<boolean>(() => typeof window !== "undefined" && window.innerWidth < 1024);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const showMobileOverlay = !collapsed && isMobile;

  // header height token (exposed to CSS via inline vars)
  const headerHeightPx = 75;

  return (
    <SidebarContext.Provider value={contextValue}>
      <div
        className="app-layout min-h-screen bg-gray-50 text-slate-900"
        style={
          {
            ["--current-sidebar-width" as any]: sidebarWidth,
            ["--sidebar-w-expanded" as any]: "288px",
            ["--sidebar-w-collapsed" as any]: "80px",
            ["--header-height" as any]: `${headerHeightPx}px`,
          } as React.CSSProperties
        }
      >
        {/* TopBar: render outside the padded content so main padding can push content below */}
        {!isAuthPage && <TopBar />}

        {!isAuthPage && (
          <div style={{ position: "fixed", left: 0, top: `var(--header-height)`, bottom: 0, zIndex: 40 }}>
            <Sidebar collapsed={collapsed} onToggle={toggle} />
          </div>
        )}

        {/* Mobile overlay when sidebar open on small screens */}
        {showMobileOverlay && (
          <button
            aria-hidden="true"
            className="fixed inset-0 z-30 md:hidden"
            onClick={() => setCollapsed(true)}
            type="button"
            style={{ background: "rgba(0,0,0,0.28)" }}
          />
        )}

        {/* Main area: padding-left equals sidebar width and padding-top equals header height + breathing space */}
        <div
          className="min-h-screen transition-[padding-left] duration-300 ease-in-out"
          style={{
            paddingLeft: `calc(var(--current-sidebar-width, var(--sidebar-w-expanded)))`,
            paddingTop: isAuthPage
              ? "0"
              : `calc(var(--header-height) + 0.5rem)`, // FIXED: Reduced vertical gap
          }}
        >
          {/* Page content — let CSS control spacing for consistency */}
      <main className="main-content bg-transparent overflow-y-auto max-h-[calc(100vh-var(--header-height))]">
  {children}
</main>

        </div>
      </div>
    </SidebarContext.Provider>
  );
};

export default Layout;