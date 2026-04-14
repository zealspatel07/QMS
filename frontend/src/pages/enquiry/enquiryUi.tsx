import type { ReactNode } from "react";
import { Check, X } from "lucide-react";

export const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm " +
  "placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition";

export const textareaClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm resize-none " +
  "placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition";

export const selectClass = inputClass;

export const cardClass =
  "rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/50 overflow-hidden";

export const subtleCard =
  "rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3 text-sm text-slate-700";

export function EnquiryStatusBadge({ status }: { status: string }) {
  const s = (status || "—").toLowerCase();
  const styles: Record<string, string> = {
    open: "bg-emerald-50 text-emerald-800 border-emerald-200",
    quoted: "bg-violet-50 text-violet-800 border-violet-200",
    lost: "bg-red-50 text-red-800 border-red-200",
    closed: "bg-slate-100 text-slate-700 border-slate-200",
  };
  const cls = styles[s] || "bg-slate-100 text-slate-700 border-slate-200";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${cls}`}>
      {status || "—"}
    </span>
  );
}

export function SectionTitle({ icon, title, subtitle }: { icon?: ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="flex items-start gap-3 px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50/80 to-white">
      {icon && <div className="mt-0.5 text-indigo-600 shrink-0">{icon}</div>}
      <div>
        <h2 className="text-sm font-semibold text-slate-900 tracking-tight">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

export function EnquiryFlowRail({ status }: { status: string }) {
  const s = (status || "open").toLowerCase();
  const openDone = true;
  const quotedDone = s === "quoted" || s === "closed";
  const closedDone = s === "closed";
  const lostActive = s === "lost";

  const Step = ({
    label,
    desc,
    done,
    active,
    tone = "default",
    index,
  }: {
    label: string;
    desc: string;
    done: boolean;
    active: boolean;
    tone?: "default" | "danger" | "neutral";
    index: number;
  }) => {
    const ring =
      tone === "danger"
        ? active
          ? "border-red-300 bg-red-50"
          : "border-red-100 bg-red-50/50"
        : tone === "neutral"
          ? active
            ? "border-slate-300 bg-slate-50"
            : "border-slate-100 bg-white"
          : active
            ? "border-indigo-300 bg-indigo-50"
            : "border-slate-100 bg-white";
    return (
      <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 min-w-[132px] transition shadow-sm ${ring}`}>
        <div
          className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
            done ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-600"
          }`}
        >
          {done ? <Check className="w-4 h-4" strokeWidth={2.5} /> : index + 1}
        </div>
        <div>
          <div className="text-xs font-semibold text-slate-900">{label}</div>
          <div className="text-[10px] text-slate-500">{desc}</div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-wrap gap-3">
      <Step label="Enquiry open" desc="Captured in CRM" done={openDone} active={s === "open"} index={0} />
      <Step label="Quotation" desc="Draft from enquiry" done={quotedDone} active={s === "quoted"} index={1} />
      {lostActive ? (
        <Step label="Lost" desc="Not proceeding" done tone="danger" active index={2} />
      ) : (
        <Step label="Closed" desc="Won or archived" done={closedDone} active={closedDone} tone="neutral" index={2} />
      )}
    </div>
  );
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
  type = "button",
  variant = "primary",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  variant?: "primary" | "secondary" | "danger";
}) {
  const base =
    "inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50 disabled:pointer-events-none";
  const variants = {
    primary: "bg-indigo-600 text-white shadow-md shadow-indigo-500/25 hover:bg-indigo-700",
    secondary: "border border-slate-200 bg-white text-slate-800 hover:bg-slate-50",
    danger: "border border-red-200 bg-white text-red-700 hover:bg-red-50",
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${variants[variant]}`}>
      {children}
    </button>
  );
}

export function ModalShell({
  title,
  subtitle,
  children,
  footer,
  onClose,
  wide,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div
        className={`relative w-full ${wide ? "max-w-2xl" : "max-w-lg"} max-h-[min(90vh,720px)] rounded-2xl border border-slate-200/90 bg-white shadow-2xl shadow-slate-900/25 flex flex-col overflow-hidden`}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-6 py-4 bg-gradient-to-br from-indigo-50/90 via-white to-violet-50/40">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 tracking-tight">{title}</h3>
            {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-4 space-y-4 flex-1">{children}</div>
        {footer && <div className="border-t border-slate-100 px-6 py-4 bg-slate-50/90 flex flex-wrap justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

export function PageHero({
  eyebrow,
  title,
  subtitle,
  right,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br from-[#3A5BA0] via-indigo-600 to-violet-600 px-6 py-6 text-white shadow-lg shadow-indigo-900/20">
      <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_20%_120%,white,transparent_55%)] pointer-events-none" />
      <div className="relative flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          {eyebrow && <p className="text-[11px] font-semibold uppercase tracking-wider text-white/70">{eyebrow}</p>}
          <h1 className="text-2xl font-bold tracking-tight mt-1">{title}</h1>
          {subtitle && <p className="text-sm text-white/85 mt-1 max-w-xl">{subtitle}</p>}
        </div>
        {right && <div className="flex flex-wrap gap-2 shrink-0">{right}</div>}
      </div>
    </div>
  );
}
