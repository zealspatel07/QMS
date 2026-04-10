// src/components/VersionCommentModal.tsx
import React, { useState, useEffect } from "react";

interface VersionCommentModalProps {
  isOpen: boolean;
  oldVersion: string;
  newVersion: string;
  onConfirm: (comment: string) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export const VersionCommentModal: React.FC<VersionCommentModalProps> = ({
  isOpen,
  oldVersion,
  newVersion,
  onConfirm,
  onCancel,
  isLoading = false,
}) => {
  const [comment, setComment] = useState("");

  useEffect(() => {
    if (isOpen) {
      setComment("");
    }
  }, [isOpen]);

 const handleConfirm = () => {
  onConfirm(comment.trim()); // may be empty string
};

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Version Change Comment</h3>
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="text-sm text-gray-700">
              <span className="text-gray-600">Version bumping:</span>
              <span className="font-semibold ml-2">
                {oldVersion} → {newVersion}
              </span>
            </div>
            <div className="text-xs text-gray-600 mt-2">
              Please provide a comment describing what changed in this version.
            </div>
          </div>

          <div>
            <div className="text-xs text-gray-600 mt-2">
  You may optionally describe what changed in this version.
</div>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="e.g., Updated pricing, changed quantities, added new items..."
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={5}
              disabled={isLoading}
            />
            <div className="text-xs text-gray-500 mt-1">
              {comment.length} characters
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isLoading}

            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {isLoading ? "Saving..." : "Save Version"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default VersionCommentModal;
