import { useState } from "react";

interface ReceiveQuantityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (quantity: number) => void;
  productName: string;
  ordered: number;
  received: number;
  remaining: number;
  isLoading?: boolean;
}

export default function ReceiveQuantityModal({
  isOpen,
  onClose,
  onSubmit,
  productName,
  ordered,
  received,
  remaining,
  isLoading = false,
}: ReceiveQuantityModalProps) {
  const [inputValue, setInputValue] = useState<string>("");
  const [error, setError] = useState<string>("");

  if (!isOpen) return null;

  const handleSubmit = () => {
    setError("");

    if (!inputValue.trim()) {
      setError("Please enter a quantity");
      return;
    }

    const qty = parseFloat(inputValue);

    if (isNaN(qty) || qty <= 0) {
      setError("Please enter a valid positive number");
      return;
    }

    if (qty > remaining) {
      setError(`Cannot exceed remaining quantity of ${remaining}`);
      return;
    }

    onSubmit(qty);
    setInputValue("");
  };

  const handleClose = () => {
    setInputValue("");
    setError("");
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSubmit();
    } else if (e.key === "Escape") {
      handleClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full mx-4 p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">Receive Material</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
            disabled={isLoading}
          >
            ×
          </button>
        </div>

        {/* Product Info */}
        <div className="bg-gray-50 p-4 rounded mb-4 space-y-2">
          <p className="font-semibold text-gray-900">{productName}</p>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-gray-600">Ordered</p>
              <p className="text-lg font-bold text-blue-600">{ordered}</p>
            </div>
            <div>
              <p className="text-gray-600">Received</p>
              <p className="text-lg font-bold text-green-600">{received}</p>
            </div>
            <div>
              <p className="text-gray-600">Remaining</p>
              <p className="text-lg font-bold text-orange-600">{remaining}</p>
            </div>
          </div>
        </div>

        {/* Input */}
        <div className="mb-4">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Enter Received Quantity
          </label>
          <input
            type="number"
            min="0"
            max={remaining}
            step="0.01"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setError("");
            }}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            placeholder={`Max: ${remaining}`}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            autoFocus
          />
          {error && <p className="text-red-600 text-sm mt-1">{error}</p>}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 disabled:opacity-50 font-semibold transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-semibold transition-all"
          >
            {isLoading ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
