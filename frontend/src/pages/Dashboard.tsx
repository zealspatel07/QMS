//frontend/src/pages/Dashboard.tsx
import { useEffect, useState } from "react";
import Layout from "../components/layout/Layout";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { Plus } from "lucide-react";


/* ================= TYPES ================= */

type Summary = {
  expired: number;
  expiring_today: number;
  expiring_soon: number;
  portfolio_value: number;
  followups_due_today: number;
  followups_overdue: number;
  pending: number;
  won: number;
  lost: number;
  won_revenue: number;
};

type ExtendedSummary = Summary & {
  avg_deal_size: number;
  conversion_rate: number;
  open_pipeline_value: number;
  gross_margin_avg: number;
  sla_breach_percent: number;

  pipeline_aging: {
    d0_7: number;
    d8_15: number;
    d16_30: number;
    d30_plus: number;
  };
};

type ActionQuotation = {
  id: number;
  quotation_no: string;
  company_name: string;
  valid_until: string;
  remaining_days: number;
  last_followup_at?: string | null;
  no_followup: number;
  salesperson_name?: string;
};

type FollowupDue = {
  id: number;
  quotation_id: number;
  quotation_no: string;
  company_name: string;
  followup_type: string;
  next_followup_date: string;
  salesperson_name?: string;
};

/* ================= UTILS ================= */

function getISTGreeting(): string {
  const now = new Date();
  const ist = new Date(now.getTime() + (5 * 60 + 30) * 60 * 1000);
  const hour = ist.getUTCHours();
  if (hour >= 5 && hour < 12) return "Good Morning";
  if (hour >= 12 && hour < 17) return "Good Afternoon";
  if (hour >= 17 && hour < 21) return "Good Evening";
  return "Good Night";
}

function formatDate(d?: string | null) {
  if (!d) return "—";
  const date = new Date(d);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  // If today, show time
  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  }
  
  // If yesterday, show "Yesterday"
  if (date.toDateString() === yesterday.toDateString()) {
    return "Yesterday";
  }
  
  // Otherwise show date
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}


/* ================= COMPONENT ================= */

export default function Dashboard() {
  const navigate = useNavigate();

  const [summary, setSummary] = useState<ExtendedSummary | null>(null);
  const [actions, setActions] = useState<ActionQuotation[]>([]);
  const [followups, setFollowups] = useState<FollowupDue[]>([]);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [recentOffset, setRecentOffset] = useState(0);
  const [recentLimit] = useState(5);
  const [hasMoreActivities, setHasMoreActivities] = useState(true);
  const [loadingMoreActivities, setLoadingMoreActivities] = useState(false);
  const [user, setUser] = useState<any>(null);






  const isAdmin =
    user?.role &&
    ["admin", "administrator", "superadmin"].includes(
      String(user.role).toLowerCase()
    );

  /* ---------- Load user ---------- */
  useEffect(() => {
    api.getMe().then((r) => setUser(r?.user ?? r));
  }, []);

  /* ---------- Load dashboard data ---------- */
  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      try {
        const [s, a, f, ra] = await Promise.all([
          api.getDashboardSummary(),
          api.getDashboardActionQuotations(),
          api.getDashboardFollowupsDue(),
          api.getDashboardRecentActivity({ limit: recentLimit, offset: 0 }),
        ]);
        setSummary(s);
        setActions(a);
        setFollowups(f);
        setRecentActivities(ra);
        setRecentOffset(ra.length);
        setHasMoreActivities(ra.length >= recentLimit);
      } catch (err) {
        console.error("Dashboard fetch failed", err);
      }
    };

    // Fetch on mount
    fetchData();

    // Set up polling every 30 seconds
    const interval = setInterval(fetchData, 30000);

    return () => clearInterval(interval);
  }, [user]);

  // 🔥 HANDLE ACTIVITY CLICK - Navigate to details page
  const handleActivityClick = (activity: any) => {
    // Use the ID fields directly from the API response
    if (activity.quotation_id) {
      navigate(`/quotations/${activity.quotation_id}`);
    } else if (activity.indent_id) {
      navigate(`/indents/${activity.indent_id}`);
    } else if (activity.po_id) {
      navigate(`/purchase-orders/${activity.po_id}`);
    }
  };

  return (
   <Layout>
  <div className="max-w-[1500px] mx-auto px-6 py-10 space-y-12">

    {/* ================= DECISION BANNER (HERO) ================= */}
    <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl p-8 shadow-lg flex justify-between items-center">
      <div>
        <h1 className="text-2xl font-semibold">
          {getISTGreeting()}, {user?.name || "User"}
        </h1>

        <p className="text-sm mt-2 opacity-90">
          ₹{(summary?.portfolio_value ?? 0).toLocaleString()} pipeline
        </p>

        <p className="mt-3 text-sm font-medium flex items-center gap-2">
          <span>⚡ {summary?.followups_overdue ?? 0} urgent follow-ups •</span>
          <span>{summary?.expiring_today ?? 0} expiring today</span>
        </p>
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => navigate("/create-quotation")}
          className="bg-indigo-800 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-indigo-900 transition flex items-center gap-2"
        >
          <Plus size={16} /> New
        </button>
      </div>
    </div>


    {/* ================= PRIORITY STRIP ================= */}
    <div className="grid md:grid-cols-3 gap-6">
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6 shadow-sm">
        <div className="text-sm font-semibold text-red-700">🚨 High Risk Deals</div>
        <div className="text-3xl font-bold mt-3 text-red-600">
          {(summary?.followups_overdue ?? 0) + (summary?.expiring_today ?? 0)}
        </div>
        <p className="text-xs text-red-600 mt-2">Immediate action needed</p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 shadow-sm">
        <div className="text-sm font-semibold text-amber-700">⏳ Needs Attention</div>
        <div className="text-3xl font-bold mt-3 text-amber-600">
          {summary?.pending ?? 0}
        </div>
        <p className="text-xs text-amber-600 mt-2">Pending quotations</p>
      </div>

      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 shadow-sm">
        <div className="text-sm font-semibold text-emerald-700">✅ Healthy Deals</div>
        <div className="text-3xl font-bold mt-3 text-emerald-600">
          {summary?.won ?? 0}
        </div>
        <p className="text-xs text-emerald-600 mt-2">Won quotations</p>
      </div>
    </div>

    {/* ================= KPI STRIP ================= */}
    <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">

      {/* ---- TOP KPI ROW ---- */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-6">

        <AlertCard title="Expiring Today" value={summary?.expiring_today} tone="danger" onClick={() => navigate("/quotations?validity=today")} />
        <AlertCard title="Expiring Soon" value={summary?.expiring_soon} tone="warning" onClick={() => navigate("/quotations?validity=soon")} />
        <AlertCard title="Follow-Ups Today" value={summary?.followups_due_today} tone="info" onClick={() => navigate("/quotations?followup=today")} />
        <AlertCard title="Overdue Follow-Ups" value={summary?.followups_overdue} tone="danger" onClick={() => navigate("/quotations?followup=overdue")} />
        <AlertCard title="Pending Quotations" value={summary?.pending} tone="info" onClick={() => navigate("/quotations?status=pending")} />
        <AlertCard title="Won Deals" value={summary?.won} tone="success" onClick={() => navigate("/quotations?status=won")} />
        <AlertCard title="Lost Deals" value={summary?.lost} tone="neutral" onClick={() => navigate("/quotations?status=lost")} />
        <AlertCard title="Revenue Generated" value={`₹${(summary?.won_revenue ?? 0).toLocaleString()}`} tone="success" onClick={() => navigate("/quotations?status=won")} />

      </div>
    </div>


    {/* ================= MAIN GRID ================= */}
    <div className="grid xl:grid-cols-3 gap-12">

      {/* ================= ACTION LIST (SMART CARDS) ================= */}
      <div className="xl:col-span-2 bg-white border border-slate-200 rounded-2xl shadow-sm">
        <div className="px-8 py-6 border-b border-slate-200 bg-slate-50 rounded-t-2xl">
          <h3 className="text-sm font-semibold text-slate-900">
            Quotations Requiring Action
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Items that need immediate attention to avoid revenue risk
          </p>
        </div>

        <div className="space-y-4 p-6">
          {actions.slice(0, 10).map((q) => {
            const isCritical = q.remaining_days <= 0;

            return (
              <div
                key={q.id}
                onClick={() => navigate(`/quotations/${q.id}`)}
                className="border rounded-xl p-5 hover:shadow-md transition cursor-pointer bg-white"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="font-semibold text-slate-900">{q.quotation_no}</div>
                    <div className="text-sm text-slate-500 mt-1">
                      {q.company_name}
                    </div>

                    <div className="flex gap-3 mt-3 text-xs flex-wrap">
                      <span className="bg-slate-100 text-slate-700 px-3 py-1 rounded-full font-medium">
                        {formatDate(q.valid_until)}
                      </span>

                      <span
                        className={`px-3 py-1 rounded-full font-medium ${
                          isCritical
                            ? "bg-red-100 text-red-700"
                            : "bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        {q.remaining_days} days
                      </span>

                      {isAdmin && (
                        <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-medium">
                          {q.salesperson_name}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-3">
                    <span
                      className={`text-xs font-medium ${
                        q.no_followup ? "text-red-600" : "text-slate-500"
                      }`}
                    >
                      {q.no_followup ? "No Follow-Up" : "Active"}
                    </span>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/quotations/${q.id}`);
                      }}
                      className="text-xs bg-indigo-50 text-indigo-600 px-4 py-2 rounded-lg font-medium hover:bg-indigo-100 transition"
                    >
                      View Details
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ================= SIDEBAR COLUMN ================= */}
      <div className="space-y-6">

        {/* ================= RECENT ACTIVITIES ================= */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm">
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 rounded-t-2xl">
            <h3 className="text-sm font-semibold text-slate-900">
              Recent Activities
            </h3>
            <p className="text-xs text-slate-500 mt-1">{recentActivities.length} updates</p>
          </div>

          <div className="space-y-2 p-4">
            {recentActivities.length === 0 ? (
              <div className="text-center py-6 text-slate-400">
                <p className="text-sm">No recent activities</p>
              </div>
            ) : (
              recentActivities.map((activity) => (
                <div
                  key={activity.id}
                  onClick={() => handleActivityClick(activity)}
                  className="border rounded-lg p-2.5 hover:shadow-md hover:border-blue-300 transition cursor-pointer bg-white text-xs hover:bg-blue-50 active:scale-95"
                >
                  <div className="flex items-center gap-2 justify-between">
                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full flex-shrink-0"></span>
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-900 font-medium truncate">
                        {activity.description || `Activity`}
                      </p>
                      <div className="text-xs text-slate-500 mt-0.5 truncate">
                        {activity.actor_name ? `By ${activity.actor_name}` : null}
                      </div>
                    </div>
                    <span className="text-slate-500 flex-shrink-0 whitespace-nowrap ml-1">
                      {activity.timestamp ? formatDate(activity.timestamp) : formatDate(new Date().toISOString())}
                    </span>
                  </div>
                </div>
              ))
            )}
            {hasMoreActivities && (
              <div className="flex justify-center mt-3">
                <button
                  disabled={loadingMoreActivities}
                  onClick={async () => {
                    setLoadingMoreActivities(true);
                    try {
                      const more = await api.getDashboardRecentActivity({ limit: recentLimit, offset: recentOffset });
                      setRecentActivities((s) => [...s, ...more]);
                      setRecentOffset((o) => o + more.length);
                      setHasMoreActivities(more.length >= recentLimit);
                    } catch (e) {
                      console.error('Failed to load more activities', e);
                    } finally {
                      setLoadingMoreActivities(false);
                    }
                  }}
                  className="text-xs bg-slate-100 px-3 py-1 rounded-md hover:bg-slate-200"
                >
                  {loadingMoreActivities ? 'Loading…' : 'Load more'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ================= FOLLOW UPS (ACTIONABLE) ================= */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm">
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 rounded-t-2xl">
            <h3 className="text-sm font-semibold text-slate-900">
              Follow-Ups Due Today
            </h3>
            <p className="text-xs text-slate-500 mt-1">{followups.length} action items</p>
          </div>

          <div className="space-y-4 p-6">
            {followups.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <p className="text-sm">No follow-ups due today ✓</p>
              </div>
            ) : (
              followups.map((f) => (
                <div
                  key={f.id}
                  className="border rounded-xl p-4 hover:shadow-md transition bg-white"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="font-semibold text-slate-900">
                        {f.company_name}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {f.quotation_no} • <span className="text-amber-600 font-medium">{f.followup_type}</span>
                      </div>
                      {isAdmin && (
                        <div className="text-xs text-slate-400 mt-1">
                          Owner: {f.salesperson_name}
                        </div>
                      )}
                    </div>

                    <span className="text-xs text-amber-600 font-medium">
                      Due Today
                    </span>
                  </div>

                  <button
                    onClick={() =>
                      api.completeQuotationFollowup(f.id).then(async () => {
                        const [s, fups] = await Promise.all([
                          api.getDashboardSummary(),
                          api.getDashboardFollowupsDue(),
                        ]);
                        setSummary(s);
                        setFollowups(fups);
                      })
                    }
                    className="mt-4 w-full bg-green-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-green-700 transition"
                  >
                    Mark Done
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>


  </div>
</Layout>
  );
}

/* ================= SMALL COMPONENTS ================= */
function AlertCard({
  title,
  value,
  tone = "neutral",
  onClick,
}: {
  title: string;
  value?: number | string;
  tone?: "danger" | "warning" | "info" | "success" | "neutral";
  onClick?: () => void;
}) {
  const toneMap: Record<string, string> = {
    danger: "bg-red-50 border-red-200 hover:shadow-md",
    warning: "bg-amber-50 border-amber-200 hover:shadow-md",
    info: "bg-blue-50 border-blue-200 hover:shadow-md",
    success: "bg-emerald-50 border-emerald-200 hover:shadow-md",
    neutral: "bg-white border-slate-200 hover:shadow-md",
  };

  const iconMap: Record<string, string> = {
    danger: "⚠️",
    warning: "⏳",
    info: "📌",
    success: "✅",
    neutral: "📊",
  };

  const textMap: Record<string, string> = {
    danger: "text-red-600",
    warning: "text-amber-600",
    info: "text-blue-600",
    success: "text-emerald-600",
    neutral: "text-slate-900",
  };

  return (
    <div
      onClick={onClick}
      className={`rounded-xl border p-4 transition-all duration-200 ${toneMap[tone]} ${
        onClick ? "cursor-pointer" : ""
      }`}
    >
      <div className="flex justify-between items-center">
        <span className="text-xs text-slate-500 font-medium">{title}</span>
        <span className="text-xl">{iconMap[tone]}</span>
      </div>

      <div className={`mt-2 text-2xl font-bold ${textMap[tone]}`}>
        {value ?? 0}
      </div>

      <div className="text-xs text-slate-400 mt-1">Click to view details</div>
    </div>
  );
}