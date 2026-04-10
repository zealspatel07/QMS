// src/components/layout/TopBar.tsx  (debug / verification version)
import React, { useEffect, useRef, useState } from "react";
import { Bell, ChevronDown, Menu } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useSidebar } from "./Layout";
import { useAuth } from "../../context/AuthContext";

/* ---------- HELPERS ---------- */
function getInitials(name?: string) {
  if (!name) return "U";
  return name
    .split(" ")
    .map(w => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

console.info("[TopBar] loaded (debug)"); // <-- look for this in browser console

const TopBar: React.FC = () => {
  const { collapsed, toggle } = useSidebar();
  const [open, setOpen] = useState(false);
  const nav = useNavigate();

  const ref = useRef<HTMLDivElement | null>(null);
  const buttonId = "topbar-account-button";
  const menuId = "topbar-account-menu";
  const [_query, _setQuery] = useState("");


  /*----------------Notification---------------*/

  const [notifOpen, setNotifOpen] = useState(false);


  /*---------------User Menu---------------*/

  const { user, isAuthenticated: _isAuthenticated, logout } = useAuth();





  //effect to close menu on outside click or escape key
  useEffect(() => {
    function onDoc(e: Event) {
      const t = e.target as Node | null;
      if (ref.current && t && !ref.current.contains(t)) {
        setOpen(false);
        setNotifOpen(false);
      }
    }


    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("click", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div
      role="banner"
      className="sticky top-0 w-full bg-white/95 border-b border-slate-100"
      style={{
        height: "var(--header-height)",
        zIndex: 60,
        backdropFilter: "saturate(120%) blur(6px)",
        WebkitBackdropFilter: "saturate(120%) blur(6px)",
        boxShadow: "0 6px 18px rgba(11,15,30,0.04)",
        outline: "2px solid rgba(220,20,60,0.06)" // <<-- visible debug outline
      }}
    >
      <div className="w-full px-4 sm:px-6 lg:px-8 h-full flex items-center gap-4">
        <div className="flex items-center gap-3 min-w-[200px]">
          <button
            onClick={toggle}
            aria-label={collapsed ? "Open navigation" : "Close navigation"}
            aria-expanded={!collapsed ? "true" : "false"}
            title={collapsed ? "Open navigation" : "Close navigation"}
            className="p-2 rounded-md bg-white border border-slate-100 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[rgba(58,91,160,0.12)] transition"
            type="button"
          >
            <Menu size={18} />
          </button>

          <a href="/" className="flex items-center gap-3 no-underline">
            <img
              // Use the uploaded file path for preview here; fallback to /logo.png for normal dev/prod
              src="/mnt/data/036436f6-8060-40d3-a735-586e61b7f470.png"
              alt="Prayosha Automation"
              className="h-15 w-20 rounded-md object-contain"
              loading="lazy"
              onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/logo.png"; }}
            />
            <div className="hidden md:block leading-tight">

            </div>
          </a>
        </div>

        <div className="flex-1 flex justify-center px-4">

        </div>

        <div className="flex items-center gap-3 min-w-[240px] justify-end">


          <div className="relative">
            <button
              className="p-2 rounded-full bg-white border border-slate-100 hover:shadow focus:outline-none relative"
              aria-label="Notifications"
              onClick={() => setNotifOpen((s) => !s)}
            >
              <Bell size={18} className="text-slate-700" />
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-rose-500 rounded-full ring-2 ring-white" />
            </button>

            {notifOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-white shadow-lg rounded-md ring-1 ring-black/5 z-50">
                <div className="px-4 py-2 text-sm font-medium text-slate-700 border-b">
                  Notifications
                </div>

                <div className="px-4 py-3 text-sm text-slate-500">
                  No new notifications
                </div>
              </div>

            )}
          </div>

          <div className="relative" ref={ref}>
            <button
              id={buttonId}
              className="flex items-center gap-3 px-3 py-1 rounded-md hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(58,91,160,0.12)] transition"
              onClick={() => setOpen((s) => !s)}
              aria-haspopup="menu"
              aria-controls={menuId}
            >
              <div className="hidden sm:block text-right leading-tight">
                <div className="text-sm font-medium text-slate-900">
                  {user?.name ?? "User"}
                </div>
                <div className="text-xs text-slate-500 uppercase">
                  {user?.role ?? "viewer"}
                </div>
              </div>

              <div className="w-8 h-8 rounded-full bg-[#F46A5E] flex items-center justify-center text-white text-sm font-bold">
                {getInitials(user?.name)}
              </div>
              <ChevronDown className="hidden sm:block text-slate-400" size={16} />
            </button>

            {open && (
              <div
                id={menuId}
                className="absolute right-0 mt-2 w-48 bg-white shadow-lg rounded-md ring-1 ring-black/5 z-50"
              >
                <button
                  className="w-full text-left px-4 py-2 hover:bg-slate-50 text-sm"
                  onClick={() => {
                    setOpen(false);
                    nav("/profile");
                  }}
                  type="button"
                >
                  View Profile
                </button>

                <button
                  className="w-full text-left px-4 py-2 hover:bg-slate-50 text-sm"
                  onClick={() => {
                    setOpen(false);
                    nav("/settings");
                  }}
                  type="button"
                >
                  Settings
                </button>

                <div className="border-t border-slate-100" />

                <button
                  className="w-full text-left px-4 py-2 hover:bg-slate-50 text-sm text-rose-600"
                  onClick={() => {
                    logout();
                    setOpen(false);
                    nav("/login");
                  }}
                  type="button"
                >
                  Logout
                </button>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};

export default TopBar;
