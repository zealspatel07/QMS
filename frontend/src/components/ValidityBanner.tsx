// src/components/ValidityBanner.tsx
type Props = {
  validity_state?: "valid" | "due" | "overdue" | "expired" | "today" | "soon" | "converted" | "closed_lost" | "not_applicable";
  remaining_days?: number;
};

export default function ValidityBanner({
  validity_state,
  remaining_days,
}: Props) {
  // Skip display for closed/terminal states (converted/closed_lost) and non-applicable states
  if (!validity_state || validity_state === "valid" || validity_state === "converted" || validity_state === "closed_lost" || validity_state === "not_applicable") return null;

  let color = "";
  let title = "";
  let message = "";

  switch (validity_state) {
    case "due":
    case "soon":
      color = "bg-yellow-50 border-yellow-300 text-yellow-900";
      title = "Quotation nearing expiry";
      message = `Expires in ${remaining_days} day${
        remaining_days !== 1 ? "s" : ""
      }.`;
      break;

    case "overdue":
    case "today":
      color = "bg-orange-50 border-orange-300 text-orange-900";
      title = "Quotation expires today";
      message = "Action recommended to avoid expiry.";
      break;

    case "expired":
      color = "bg-red-50 border-red-300 text-red-900";
      title = "Quotation expired";
      message = "This quotation is no longer valid. Re-issue required.";
      break;
  }

  return (
    <div className={`border rounded-lg px-4 py-3 ${color}`}>
      <div className="font-semibold text-sm">{title}</div>
      <div className="text-sm mt-1">{message}</div>
    </div>
  );
}
