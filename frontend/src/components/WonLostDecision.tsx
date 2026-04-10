// src/components/WonLostDecision.tsx
import React, { useState } from "react";

interface WonLostDecisionProps {
  quotationId: number | string;
  status?: string;
  onWon: () => Promise<void>;
  onLost: (comment: string) => Promise<void>;
  isLoading?: boolean;
}

export const WonLostDecision: React.FC<WonLostDecisionProps> = ({
  quotationId: _quotationId,
  status,
  onWon,
  onLost,
  isLoading = false,
}) => {
  const [lossModalOpen, setLossModalOpen] = useState(false);
  const [lossReason, setLossReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isDecided =
    status && ["won", "lost"].includes(String(status).toLowerCase());

  const handleWon = async () => {
    if (window.confirm("Mark this quotation as Won?")) {
      try {
        await onWon();
      } catch (err) {
        console.error("Error marking as won:", err);
      }
    }
  };

  const handleLossClick = () => {
    setLossModalOpen(true);
    setLossReason("");
  };

  const handleLossConfirm = async () => {
    if (!lossReason.trim()) {
      alert("Loss reason is mandatory");
      return;
    }

    setSubmitting(true);
    try {
      await onLost(lossReason);
      setLossModalOpen(false);
      setLossReason("");
    } catch (err) {
      console.error("Error marking as lost:", err);
    } finally {
      setSubmitting(false);
    }
  };

  if (isDecided) {
    return null;
  }

  return (
    <>
      <div className="flex gap-3">
        <button
          onClick={handleWon}
          disabled={isLoading || submitting}
          className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          ✓ WON
        </button>
        <button
          onClick={handleLossClick}
          disabled={isLoading || submitting}
          className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          ✗ LOST
        </button>
      </div>

      {/* Loss Reason Modal */}
      {lossModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setLossModalOpen(false)} />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-4">Loss Reason</h3>
            <p className="text-sm text-gray-600 mb-4">
              Please provide a reason for marking this quotation as lost. This is mandatory.
            </p>
            <textarea
              value={lossReason}
              onChange={(e) => setLossReason(e.target.value)}
              placeholder="Enter loss reason..."
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={4}
              disabled={submitting}
            />
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setLossModalOpen(false)}
                disabled={submitting}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleLossConfirm}
                disabled={submitting || !lossReason.trim()}
                className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {submitting ? "Marking as Lost..." : "Confirm Loss"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default WonLostDecision;
