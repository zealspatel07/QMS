// src/components/layout/Header.tsx
import React, { useEffect, useRef, useState } from "react";
import { Bell, ChevronDown, Search, Plus, Menu } from "lucide-react";
import { useNavigate } from "react-router-dom";

type HeaderProps = {
  /** Optional callback to toggle the app sidebar on mobile. */
  onToggleSidebar?: () => void;
  /** Logged in user display name (falls back to "Admin") */
  userName?: string;
  /** Path to the brand logo. Defaults to uploaded preview path for local dev. */
  logoSrc?: string;
};

const Header: React.FC<HeaderProps> = ({
  onToggleSidebar,
  userName = "Admin",
  // local preview image (you can change to "/logo.png" for production)
  logoSrc = "/mnt/data/036436f6-8060-40d3-a735-586e61b7f470.png",
}) => {
  const nav = useNavigate();
  const [query, setQuery] = useState("");
  const [acctOpen, setAcctOpen] = useState(false);
  const acctRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDoc(e: Event) {
      const t = e.target as Node | null;
      if (acctRef.current && t && !acctRef.current.contains(t)) setAcctOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setAcctOpen(false);
    }
    document.addEventListener("click", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <header
      role="banner"
      className="sticky top-0 z-50 w-full bg-white/95 border-b border-slate-100"
      style={{
        height: "var(--header-height, 72px)",
        backdropFilter: "saturate(120%) blur(6px)",
        WebkitBackdropFilter: "saturate(120%) blur(6px)",
        boxShadow: "0 6px 18px rgba(11,15,30,0.04)",
      }}
    >
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center gap-4">
        {/* LEFT: hamburger + brand */}
        <div className="flex items-center gap-3 min-w-[220px]">
          <button
            onClick={onToggleSidebar}
            aria-label="Toggle navigation"
            className="p-2 rounded-md bg-white border border-slate-100 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[rgba(58,91,160,0.12)] transition"
            type="button"
          >
            <Menu size={18} />
          </button>

          <a href="/" className="flex items-center gap-3 no-underline">
            <img
              src={logoSrc}
              alt="Prayosha Automation"
              className="h-9 w-9 rounded-md object-contain"
              loading="lazy"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = "/logo.png";
              }}
            />
            <div className="hidden md:block leading-tight">
              <div className="text-sm font-semibold text-[#001F66]">Prayosha Automation</div>
              <div className="text-xs text-slate-400">Quotation Management</div>
            </div>
          </a>
        </div>

        {/* CENTER: search */}
        <div className="flex-1 flex justify-center px-4">
          <div className="relative w-full max-w-2xl">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
              <Search size={16} />
            </span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search quotations, customers, products..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-100 rounded-full text-sm shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(58,91,160,0.14)]"
              aria-label="Search the app"
              onKeyDown={(e) => {
                if (e.key === "Enter" && query.trim()) {
                  nav(`/quotations?search=${encodeURIComponent(query.trim())}`);
                }
              }}
            />
            <button
              onClick={() => {
                if (query.trim()) nav(`/quotations?search=${encodeURIComponent(query.trim())}`);
              }}
              aria-label="Submit search"
              className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full px-3 py-1 text-sm font-medium bg-white/90 border border-slate-100 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(58,91,160,0.18)] transition"
            >
              Go
            </button>
          </div>
        </div>

        {/* RIGHT: CTA, notifications, account */}
        <div className="flex items-center gap-3 min-w-[240px] justify-end">
          <button
            className="hidden md:inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-[#3A5BA0] to-[#6C7BFF] text-white text-sm font-semibold shadow-active hover:shadow-lg transform-gpu transition hover:-translate-y-0.5"
            onClick={() => nav("/quotations/create")}
            title="Create new quotation"
            aria-label="Create new quotation"
            type="button"
            style={{ boxShadow: "0 8px 24px rgba(58,91,160,0.12)" }}
          >
            <Plus size={14} />
            <span>New Quote</span>
          </button>

          <button
            className="p-2 rounded-full bg-white border border-slate-100 hover:shadow focus:outline-none relative"
            aria-label="Notifications"
            title="Notifications"
            onClick={() => nav("/notifications")}
          >
            <Bell size={18} className="text-slate-700" />
            <span className="absolute top-[6px] right-[6px] w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white" />
          </button>

          <div className="relative" ref={acctRef}>
            <button
              className="flex items-center gap-3 px-2 py-1 rounded-md hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(58,91,160,0.18)] transition"
              onClick={() => setAcctOpen((s) => !s)}
              aria-haspopup="menu"
              aria-expanded={acctOpen}
            >
              <div className="hidden sm:block text-right leading-tight">
                <div className="text-sm font-medium text-slate-900">{userName}</div>
                <div className="text-xs text-slate-500">ADMIN</div>
              </div>

              <div className="w-8 h-8 rounded-full bg-[#F46A5E] flex items-center justify-center text-white text-sm font-bold">
                {userName
                  .split(" ")
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase()}
              </div>

              <ChevronDown className="hidden sm:block text-slate-400" size={16} />
            </button>

            {acctOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white shadow-lg rounded-md ring-1 ring-black/5 z-50">
                <button
                  className="w-full text-left px-4 py-2 hover:bg-slate-50 text-sm"
                  onClick={() => {
                    setAcctOpen(false);
                    nav("/profile");
                  }}
                  type="button"
                >
                  View Profile
                </button>

                <button
                  className="w-full text-left px-4 py-2 hover:bg-slate-50 text-sm"
                  onClick={() => {
                    setAcctOpen(false);
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
                    setAcctOpen(false);
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
    </header>
  );
};

export default Header;
