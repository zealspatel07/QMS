import { useState } from "react";
import { AlertCircle, X } from "lucide-react";
import { toast } from "react-toastify";

interface ClosePoModalProps {
  isOpen: boolean;
  poNumber: string;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void>;
  isLoading?: boolean;
}

export default function ClosePoModal({
  isOpen,
  poNumber,
  onClose,
  onSubmit,
  isLoading = false,
}: ClosePoModalProps) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!reason.trim()) {
      setError("Please provide a reason for closing this PO");
      return;
    }

    try {
      await onSubmit(reason);
      setReason("");
      setError("");
      toast.success("Purchase Order closed successfully");
    } catch (err: any) {
      setError(err?.message || "Failed to close PO");
      toast.error(err?.message || "Failed to close PO");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-slate-200">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertCircle className="text-red-600" size={24} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Close Purchase Order</h2>
              <p className="text-sm text-slate-600 mt-1">{poNumber}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            title="Close dialog"
            aria-label="Close Purchase Order dialog"
            className="text-slate-400 hover:text-slate-600 disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          <p className="text-sm text-slate-600 mb-4">
            Please provide a reason for closing this purchase order. This action cannot be undone.
          </p>

          {/* Reason Textarea */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-900 mb-2">
              Reason for Closing <span className="text-red-600">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setError("");
              }}
              placeholder="e.g., Order no longer needed, supplier unavailable, budget cut, etc."
              className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={4}
              disabled={isLoading}
            />
            {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
          </div>

          {/* Warning Box */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-6">
            <p className="text-sm text-red-800">
              <span className="font-semibold">Warning:</span> This will close the PO and prevent further modifications.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-slate-200">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading || !reason.trim()}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? "Closing..." : "Close PO"}
          </button>
        </div>
      </div>
    </div>
  );
}