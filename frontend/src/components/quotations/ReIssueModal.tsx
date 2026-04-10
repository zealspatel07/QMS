import { useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: (opts: {
    mode: "same" | "edit";
    validityDays: number;
  }) => void;

  // 👇 ADD CONTEXT
  quotationNo?: string;
  version?: string;
  validUntil?: string;
};

export default function ReIssueModal({
  open,
  onClose,
  onConfirm,
  quotationNo,
  version,
  validUntil,
}: Props) {
  const [mode, setMode] = useState<"same" | "edit">("same");
  const [validityDays, setValidityDays] = useState(30);
  const [confirmCheck, setConfirmCheck] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  function handleConfirm() {
    // 🔥 Guard against double submit
    if (loading) return;
    
    setError("");

    if (validityDays < 1 || validityDays > 365) {
      setError("Validity must be between 1 and 365 days");
      return;
    }

    // 🔥 Fix: Use !== true to avoid stale state issues
    if (confirmCheck !== true) {
      setError("Please confirm before re-issuing");
      return;
    }

    setLoading(true);

    onConfirm({ mode, validityDays });
  }
  
  function handleClose() {
    // Reset state when closing
    setMode("same");
    setValidityDays(30);
    setConfirmCheck(false);
    setError("");
    setLoading(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
      <div className="bg-white rounded-xl w-[440px] p-6 space-y-5">

        {/* HEADER */}
        <div>
          <h3 className="text-base font-semibold text-gray-800">
            Re-Issue Quotation
          </h3>

          <div className="text-xs text-gray-500 mt-1">
            {quotationNo && <div>Ref: {quotationNo}</div>}
            {version && <div>Version: v{version}</div>}
            {validUntil && <div>Expired on: {validUntil}</div>}
          </div>
        </div>

        {/* WARNING */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
          This will create a new quotation version and lock the current one.
        </div>

        {/* MODE */}
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              checked={mode === "same"}
              onChange={() => setMode("same")}
            />
            Re-issue with same details
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              checked={mode === "edit"}
              onChange={() => setMode("edit")}
            />
            Re-issue and edit details
          </label>
        </div>

        {/* VALIDITY */}
        <div>
          <label className="text-xs text-gray-500 block mb-1">
            Validity (days)
          </label>

          <input
            type="number"
            min={1}
            max={365}
            value={validityDays}
            onChange={(e) => setValidityDays(Number(e.target.value))}
            aria-label="Validity in days"
            className="w-full h-10 rounded-lg border px-3 text-sm"
          />

          {/* QUICK PRESETS */}
          <div className="flex gap-2 mt-2">
            {[15, 30, 45].map((d) => (
              <button
                key={d}
                onClick={() => setValidityDays(d)}
                className="px-2 py-1 text-xs border rounded hover:bg-gray-50"
              >
                {d}d
              </button>
            ))}
          </div>
        </div>

        {/* CONFIRM CHECK */}
        <label className="flex items-center gap-2 text-xs text-gray-600">
          <input
            type="checkbox"
            checked={confirmCheck}
            onChange={(e) => setConfirmCheck(e.target.checked)}
          />
          I understand this will create a new version
        </label>

        {/* ERROR */}
        {error && (
          <div className="text-xs text-red-600">{error}</div>
        )}

        {/* ACTIONS */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={handleClose}
            disabled={loading}
            className="px-4 py-2 text-sm border rounded-lg"
          >
            Cancel
          </button>

          <button
            onClick={handleConfirm}
            disabled={loading}
            className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg disabled:opacity-50"
          >
            {loading ? "Re-issuing..." : "Re-Issue"}
          </button>
        </div>
      </div>
    </div>
  );
}