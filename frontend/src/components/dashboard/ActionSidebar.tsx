/**
 * ActionSidebar - Fixed Right-Hand Sidebar Component
 * Converts delivery alerts into actionable Task Cards with "Days Until Due"
 * Implements sticky positioning and color-coded urgency levels
 */

import { AlertCircle, X, CheckCircle2, Clock, TrendingUp } from "lucide-react";
import { calculateDaysUntilDue, getAlertType } from "./utils";

interface DeliveryAlert {
  id: number;
  po_number: string;
  vendor_name: string;
  status: string;
  expected_delivery_date: string;
  alert_type?: string;
}

interface ActionSidebarProps {
  alerts: DeliveryAlert[];
  isOpen: boolean;
  onClose: () => void;
}

function getTaskCardStyle(alertType: "delayed" | "due_today" | "due_soon" | "on_track") {
  const styles: Record<
    "delayed" | "due_today" | "due_soon" | "on_track",
    { bg: string; border: string; icon: React.ReactNode; label: string; urgency: string }
  > = {
    delayed: {
      bg: "bg-rose-50",
      border: "border-rose-300",
      icon: <AlertCircle className="text-rose-600" size={18} />,
      label: "🔴 DELAYED",
      urgency: "text-rose-700",
    },
    due_today: {
      bg: "bg-amber-50",
      border: "border-amber-300",
      icon: <Clock className="text-amber-600" size={18} />,
      label: "🟡 DUE TODAY",
      urgency: "text-amber-700",
    },
    due_soon: {
      bg: "bg-orange-50",
      border: "border-orange-300",
      icon: <TrendingUp className="text-orange-600" size={18} />,
      label: "🟠 DUE SOON",
      urgency: "text-orange-700",
    },
    on_track: {
      bg: "bg-emerald-50",
      border: "border-emerald-300",
      icon: <CheckCircle2 className="text-emerald-600" size={18} />,
      label: "🟢 ON TRACK",
      urgency: "text-emerald-700",
    },
  };

  return styles[alertType];
}

export default function ActionSidebar({ alerts, isOpen, onClose }: ActionSidebarProps) {
  if (!isOpen) return null;

  // Process and sort alerts by urgency
  const processedAlerts = alerts
    .map((alert) => {
      const daysUntilDue = calculateDaysUntilDue(alert.expected_delivery_date);
      const alertType = getAlertType(daysUntilDue, alert.status);
      return { ...alert, daysUntilDue, alertType };
    })
    .sort((a, b) => {
      // Sort by urgency: delayed > due_today > due_soon > on_track
      const urgencyOrder: Record<"delayed" | "due_today" | "due_soon" | "on_track", number> = {
        delayed: 0,
        due_today: 1,
        due_soon: 2,
        on_track: 3,
      };
      return (
        (urgencyOrder[a.alertType] || 3) - (urgencyOrder[b.alertType] || 3)
      );
    });

  return (
    <div className="fixed right-0 top-0 h-full w-80 bg-white border-l border-slate-200 shadow-xl z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
        <div>
          <h3 className="font-semibold text-slate-900">Delivery Alerts</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {processedAlerts.length} active task{processedAlerts.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-slate-200 rounded-md transition-colors"
        >
          <X size={20} className="text-slate-600" />
        </button>
      </div>

      {/* Alerts List */}
      <div className="flex-1 overflow-y-auto">
        {processedAlerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 p-6">
            <CheckCircle2 size={40} opacity={0.5} />
            <p className="text-sm mt-3 text-center">All deliveries on track!</p>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {processedAlerts.map((alert) => {
              const style = getTaskCardStyle(alert.alertType);
              const daysText =
                alert.daysUntilDue < 0
                  ? `${Math.abs(alert.daysUntilDue)} days overdue`
                  : alert.daysUntilDue === 0
                    ? "Due Today"
                    : `${alert.daysUntilDue} days until due`;

              return (
                <div
                  key={alert.id}
                  className={`p-4 rounded-lg border-2 ${style.bg} ${style.border} transition-all hover:shadow-md`}
                >
                  {/* Header: PO Number + Status Badge */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="font-semibold text-slate-900 text-sm">
                        {alert.po_number}
                      </div>
                      <div className="text-xs text-slate-600 mt-1">{alert.vendor_name}</div>
                    </div>
                    <div className="flex items-center gap-1 ml-2">{style.icon}</div>
                  </div>

                  {/* Days Until Due - Prominent Display */}
                  <div className={`mb-3 p-2.5 rounded-md bg-white border ${style.border}`}>
                    <div className="text-xs text-slate-600 font-medium">Days Until Due</div>
                    <div className={`text-2xl font-bold ${style.urgency}`}>
                      {Math.max(0, alert.daysUntilDue)}
                    </div>
                    <div className="text-xs text-slate-600 mt-1">{daysText}</div>
                  </div>

                  {/* Alert Type Badge */}
                  <div className={`text-xs font-bold px-3 py-1.5 rounded-full text-center ${style.urgency} bg-white border ${style.border}`}>
                    {style.label}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 mt-3">
                    <button
                      className={`flex-1 text-xs px-2 py-2 rounded font-medium transition-colors ${
                        alert.alertType === "delayed"
                          ? "bg-rose-600 text-white hover:bg-rose-700"
                          : alert.alertType === "due_today"
                            ? "bg-amber-600 text-white hover:bg-amber-700"
                            : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                      }`}
                    >
                      Follow Up
                    </button>
                    <button className="flex-1 text-xs px-2 py-2 rounded font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors">
                      View PO
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer Stats */}
      <div className="px-6 py-4 border-t border-slate-200 bg-slate-50">
        <div className="grid grid-cols-3 gap-3 text-center text-xs">
          <div>
            <div className="font-bold text-rose-600">
              {processedAlerts.filter((a) => a.alertType === "delayed").length}
            </div>
            <div className="text-slate-600">Delayed</div>
          </div>
          <div>
            <div className="font-bold text-amber-600">
              {
                processedAlerts.filter(
                  (a) => a.alertType === "due_today" || a.alertType === "due_soon"
                ).length
              }
            </div>
            <div className="text-slate-600">Due Soon</div>
          </div>
          <div>
            <div className="font-bold text-emerald-600">
              {processedAlerts.filter((a) => a.alertType === "on_track").length}
            </div>
            <div className="text-slate-600">On Track</div>
          </div>
        </div>
      </div>
    </div>
  );
}
