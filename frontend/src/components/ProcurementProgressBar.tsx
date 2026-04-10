

interface ProcurementProgressBarProps {
  requiredQty: number;
  orderedQty: number;
}

export default function ProcurementProgressBar({
  requiredQty,
  orderedQty,
}: ProcurementProgressBarProps) {
  const coverage = requiredQty > 0 ? Math.round((orderedQty / requiredQty) * 100) : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-gray-700">Procurement Progress</span>
        <span className="text-lg font-bold text-blue-600">{coverage}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
        <div
          className={`h-3 rounded-full transition-all duration-300 ${
            coverage >= 100
              ? "bg-green-500"
              : coverage >= 75
              ? "bg-blue-500"
              : coverage >= 50
              ? "bg-yellow-500"
              : "bg-orange-500"
          }`}
          style={{ width: `${Math.min(coverage, 100)}%` }}
        ></div>
      </div>
      <p className="text-xs text-gray-600 mt-2">
        {orderedQty} of {requiredQty} units ordered
      </p>
    </div>
  );
}
