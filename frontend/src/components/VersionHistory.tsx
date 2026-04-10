// src/components/VersionHistory.tsx
import React, { useState } from "react";

interface VersionRecord {
  id: number;
  quotation_id: number;
  version: string;
  items_snapshot?: any;
  totals_snapshot?: any;
  comment?: string | null;
  changed_by?: string;
  changed_at?: string;
  is_current?: boolean;  // ✅ NEW: Mark current version
}

interface VersionHistoryProps {
  versions: VersionRecord[];
  isLoading?: boolean;
  onViewVersion?: (versionNumber: string) => void;  
  layout?: "vertical" | "horizontal";
}

export const VersionHistory: React.FC<VersionHistoryProps> = ({
  versions = [],
  onViewVersion,
}) => {
  const [expandedVersionId, setExpandedVersionId] = useState<number | null>(
    null
  );

  if (!versions || versions.length === 0) {
    return (
      <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 text-gray-500 text-sm">
        No version history available
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h4 className="font-semibold text-gray-900">Version History</h4>
      <div className="relative space-y-4">
        {/* Timeline line */}
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-400 to-blue-200" />

        {/* Timeline items */}
        {versions.map((version) => (
          <div key={version.id} className="relative pl-16">
            {/* Timeline dot */}
            <div className={`absolute left-0 top-2 w-4 h-4 rounded-full border-4 border-white shadow-md ${
              version.is_current ? 'bg-green-500' : 'bg-blue-500'
            }`} />

            {/* Card */}
            <div className={`border rounded-lg shadow-sm ${
              version.is_current ? 'bg-green-50 border-green-300' : 'bg-white border-gray-200'
            }`}>
              <button
                onClick={() =>
                  setExpandedVersionId(
                    expandedVersionId === version.id ? null : version.id
                  )
                }
                className="w-full p-4 text-left hover:bg-opacity-50 transition"
              >
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">
                        Version {version.version}
                      </span>
                      {version.is_current && (
                        <span className="inline-block bg-green-200 text-green-800 text-xs px-2 py-0.5 rounded font-medium">
                          ← Current
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      Changed by: <span className="font-medium">{version.changed_by || "system"}</span>
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      {version.changed_at &&
                        new Date(version.changed_at).toLocaleString()}
                    </div>
                    {version.comment && (
                      <div className="text-sm text-gray-700 mt-2 p-2 bg-blue-50 rounded border-l-2 border-blue-300">
                        {version.comment}
                      </div>
                    )}
                  </div>
                  <div className="text-gray-400">
                    {expandedVersionId === version.id ? "▼" : "▶"}
                  </div>
                </div>
              </button>

              {/* Expanded details */}
              {expandedVersionId === version.id && (
                <div className="border-t border-gray-300 p-4 bg-opacity-50 text-sm">
                  <div className="space-y-4">
                    {/* Action button */}
                    {onViewVersion && (
                      <button
                        onClick={() => onViewVersion(version.version)}
                        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium text-sm"
                      >
                        📖 View Full Version
                      </button>
                    )}

                    {/* Totals */}
                    {version.totals_snapshot && (
                      <div>
                        <h5 className="font-semibold text-gray-900 mb-2">
                          Totals Snapshot
                        </h5>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-gray-600">Subtotal:</span>
                            <span className="font-medium ml-2">
                              ₹{Number(version.totals_snapshot.subtotal || 0).toLocaleString()}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-600">Discount:</span>
                            <span className="font-medium ml-2">
                              ₹{Number(version.totals_snapshot.total_discount || 0).toLocaleString()}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-600">Tax:</span>
                            <span className="font-medium ml-2">
                              ₹{Number(version.totals_snapshot.tax_total || 0).toLocaleString()}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-600">Grand Total:</span>
                            <span className="font-medium ml-2">
                              ₹{Number(version.totals_snapshot.grand_total || 0).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Items */}
                    {version.items_snapshot &&
                      Array.isArray(version.items_snapshot) &&
                      version.items_snapshot.length > 0 && (
                        <div>
                          <h5 className="font-semibold text-gray-900 mb-2">
                            Items ({version.items_snapshot.length})
                          </h5>
                          <div className="space-y-2">
                            {version.items_snapshot.map((item: any, idx: number) => (
                              <div
                                key={idx}
                                className="p-2 bg-white border border-gray-200 rounded text-xs"
                              >
                                <div className="font-medium">
                                  {item.product_name || item.name || "Item"}
                                </div>
                                <div className="text-gray-600 grid grid-cols-2 gap-2 mt-1">
                                  <span>Qty: {item.qty || 1}</span>
                                  <span>Rate: ₹{Number(item.unit_price || 0).toLocaleString()}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default VersionHistory;
