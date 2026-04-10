// src/components/VersionViewer.tsx
// ✅ Read-only viewer for a specific version snapshot
// Shows v0.3 as it was, even when quotation is at v0.4

import React, { useEffect, useState } from 'react';
import { api } from '../api';

interface VersionViewerProps {
  quotationId: number | string;
  versionNumber: string;
  onClose: () => void;
}

export const VersionViewer: React.FC<VersionViewerProps> = ({
  quotationId,
  versionNumber,
  onClose,
}) => {
  const [versionData, setVersionData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadVersion();
  }, [quotationId, versionNumber]);

  const loadVersion = async () => {
    try {
      setLoading(true);
      setError(null);
      const raw = await api.getVersionSnapshot(quotationId, versionNumber);

// ✅ NORMALIZE BACKEND RESPONSE (DO NOT CHANGE FIELD NAMES BELOW)
const normalized = {
  version: raw.version || raw.version_label || versionNumber,
  is_current: raw.is_current ?? false,

  // metadata
  changed_by: raw.changed_by || raw.created_by || 'system',
  changed_at: raw.changed_at || raw.created_at || null,
  comment: raw.comment ?? null,
  note: raw.note ?? null,

  // content
  items: Array.isArray(raw.items) ? raw.items : [],
  totals: raw.totals ?? null,

  // quotation snapshot
  terms: raw.terms || raw.quotation?.terms || '',
  notes: raw.notes || raw.quotation?.notes || '',
};

setVersionData(normalized);
    } catch (err: any) {
      setError(err.message || 'Failed to load version');
    } finally {
      setLoading(false);
    }
  };
    const computedTotals = React.useMemo(() => {
  if (!versionData?.items) return null;

  let subtotal = 0;
  let discount = 0;
  let tax = 0;

  versionData.items.forEach((it: any) => {
    const qty = Number(it.qty || 1);
    const price = Number(it.unit_price || 0);
    const discPct = Number(it.discount_percent || 0);
    const taxPct = Number(it.tax_rate || 0);

    const base = qty * price;
    const disc = (base * discPct) / 100;
    const taxable = base - disc;
    const t = (taxable * taxPct) / 100;

    subtotal += taxable;
    discount += disc;
    tax += t;
  });

  return {
    subtotal,
    total_discount: discount,
    tax_total: tax,
    grand_total: subtotal + tax,
  };
}, [versionData]);

const totals =
  versionData && versionData.totals
    ? versionData.totals
    : computedTotals;

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 max-w-2xl w-full mx-4">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-3 text-gray-600">Loading version {versionNumber}...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 max-w-2xl w-full mx-4">
          <h3 className="text-lg font-semibold text-red-600 mb-3">Error</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={onClose}
            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  if (!versionData) {
    return null;
  }


  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-auto">
      <div className="bg-white rounded-lg max-w-4xl w-full mx-4 my-8">
        {/* Header */}
        <div className="border-b border-gray-200 p-6 flex justify-between items-center sticky top-0 bg-white rounded-t-lg">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Version {versionData.version}
              {versionData.is_current && (
                <span className="ml-3 inline-badge bg-green-100 text-green-800 text-sm px-2 py-1 rounded">
                  ← Current Version
                </span>
              )}
            </h2>
            {versionData.note && (
              <p className="text-sm text-gray-600 mt-2">{versionData.note}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto">
          {/* Metadata */}
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-3">Metadata</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Changed by:</span>
                <span className="font-medium ml-2">{versionData.changed_by || 'system'}</span>
              </div>
              <div>
                <span className="text-gray-600">Date:</span>
                <span className="font-medium ml-2">
                  {versionData.changed_at && new Date(versionData.changed_at).toLocaleString()}
                </span>
              </div>
              {versionData.comment && (
                <div className="col-span-2">
                  <span className="text-gray-600">Comment:</span>
                  <div className="mt-2 p-3 bg-blue-50 border-l-2 border-blue-300 rounded">
                    {versionData.comment}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Totals */}
        {totals &&(
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <h3 className="font-semibold text-gray-900 mb-3">Totals</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Subtotal:</span>
                  <div className="font-medium">
                    ₹{Number(totals?.subtotal || 0).toLocaleString()}
                  </div>
                </div>
                <div>
                  <span className="text-gray-600">Discount:</span>
                  <div className="font-medium">
                    ₹{Number(totals?.total_discount || 0).toLocaleString()}
                  </div>
                </div>
                <div>
                  <span className="text-gray-600">Tax:</span>
                  <div className="font-medium">
                    ₹{Number(totals?.tax_total || 0).toLocaleString()}
                  </div>
                </div>
                <div>
                  <span className="text-gray-600">Grand Total:</span>
                  <div className="font-bold text-lg text-green-700">
                    ₹{Number(totals?.grand_total || 0).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Items */}
          {versionData.items && Array.isArray(versionData.items) && versionData.items.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">
                Items ({versionData.items.length})
              </h3>
              <div className="space-y-2">
                {versionData.items.map((item: any, idx: number) => (
                  <div
                    key={idx}
                    className="p-4 bg-gray-50 border border-gray-200 rounded-lg"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900">
                          {item.product_name || item.name || 'Item'}
                        </div>
                        {item.hsn_code && (
                          <div className="text-xs text-gray-600 mt-1">
                            HSN: {item.hsn_code}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-2 mt-3 text-sm">
                      <div>
                        <span className="text-gray-600">Qty</span>
                        <div className="font-medium">{item.qty || 1}</div>
                      </div>
                      <div>
                        <span className="text-gray-600">Unit Price</span>
                        <div className="font-medium">₹{Number(item.unit_price || 0).toLocaleString()}</div>
                      </div>
                      <div>
                        <span className="text-gray-600">Total</span>
                        <div className="font-medium">
                          ₹{Number((item.qty || 1) * (item.unit_price || 0)).toLocaleString()}
                        </div>
                      </div>
                     {(item.discount_percent ?? item.discount_percentage) > 0 && (
                          <div>
                            <span className="text-gray-600">Discount</span>
                            <div className="font-medium">
                              {item.discount_percent ?? item.discount_percentage}%
                            </div>
                          </div>
                        )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Terms & Notes */}
          {(versionData.terms || versionData.notes) && (
            <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
              {versionData.terms && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Terms</h4>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{versionData.terms}</p>
                </div>
              )}
              {versionData.notes && (
                <div className={versionData.terms ? 'mt-4' : ''}>
                  <h4 className="font-semibold text-gray-900 mb-2">Notes</h4>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{versionData.notes}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-6 bg-gray-50 rounded-b-lg flex gap-3 justify-end sticky bottom-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default VersionViewer;
