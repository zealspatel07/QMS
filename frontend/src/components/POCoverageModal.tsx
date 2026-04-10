

interface PODetail {
  po_id: number;
  po_number: string;
  vendor_name: string;
  ordered_qty: number;
}

interface POCoverageModalProps {
  isOpen: boolean;
  onClose: () => void;
  productName: string;
  requiredQty: number;
  totalOrderedQty: number;
  poDetails: PODetail[];
}

export default function POCoverageModal({
  isOpen,
  onClose,
  productName,
  requiredQty,
  totalOrderedQty,
  poDetails,
}: POCoverageModalProps) {
  if (!isOpen) return null;

  const remainingQty = requiredQty - totalOrderedQty;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full mx-4 p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">{productName}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Summary */}
        <div className="bg-gray-50 p-4 rounded mb-4 space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-700">Required:</span>
            <span className="font-semibold">{requiredQty} units</span>
          </div>
          <div className="flex justify-between text-green-600">
            <span className="text-gray-700">Total Ordered:</span>
            <span className="font-semibold">{totalOrderedQty} units</span>
          </div>
          <div className="flex justify-between text-orange-600 border-t pt-2">
            <span className="text-gray-700">Remaining:</span>
            <span className="font-semibold">{Math.max(0, remainingQty)} units</span>
          </div>
        </div>

        {/* PO List */}
        {poDetails.length > 0 ? (
          <div>
            <h3 className="font-semibold text-gray-800 mb-3">Purchase Orders</h3>
            <div className="space-y-3 max-h-48 overflow-y-auto">
              {poDetails.map((po) => (
                <div key={po.po_id} className="border rounded p-3 hover:bg-gray-50">
                  <p className="font-semibold text-blue-600">{po.po_number}</p>
                  <p className="text-sm text-gray-600">{po.vendor_name}</p>
                  <p className="text-sm font-medium text-gray-700 mt-1">
                    Ordered Qty: <span className="text-green-600">{po.ordered_qty}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-center text-gray-500 py-4">No POs created yet</p>
        )}

        {/* Action Button */}
        <button
          onClick={onClose}
          className="w-full bg-blue-600 text-white px-4 py-2 rounded mt-4 hover:bg-blue-700"
        >
          Close
        </button>
      </div>
    </div>
  );
}
