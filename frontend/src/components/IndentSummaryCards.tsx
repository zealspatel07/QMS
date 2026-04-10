
interface IndentSummaryCardsProps {
  totalProducts: number;
  requiredQty: number;
  orderedQty: number;
  pendingQty: number;
}

export default function IndentSummaryCards({
  totalProducts,
  requiredQty,
  orderedQty,
  pendingQty,
}: IndentSummaryCardsProps) {
  const coverage = requiredQty > 0 ? Math.round((orderedQty / requiredQty) * 100) : 0;

  const cards = [
    { label: "Products", value: totalProducts, color: "blue" },
    { label: "Required Qty", value: requiredQty, color: "green" },
    { label: "Ordered Qty", value: orderedQty, color: "purple" },
    { label: "Pending Qty", value: pendingQty, color: "orange" },
  ];

  const colorClasses: { [key: string]: { bg: string; border: string; text: string } } = {
    blue: { bg: "bg-blue-50", border: "border-blue-500", text: "text-blue-700" },
    green: { bg: "bg-green-50", border: "border-green-500", text: "text-green-700" },
    purple: { bg: "bg-purple-50", border: "border-purple-500", text: "text-purple-700" },
    orange: { bg: "bg-orange-50", border: "border-orange-500", text: "text-orange-700" },
  };

  return (
    <div className="grid grid-cols-4 gap-4 mb-6">
      {cards.map((card) => {
        const classes = colorClasses[card.color];
        return (
          <div key={card.label} className={`${classes.bg} border-l-4 ${classes.border} p-4 rounded`}>
            <p className="text-sm text-gray-600">{card.label}</p>
            <p className={`text-2xl font-bold ${classes.text}`}>{card.value}</p>
          </div>
        );
      })}

      {/* Coverage Card */}
      <div className="col-span-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white p-4 rounded">
        <p className="text-sm opacity-90">Procurement Coverage</p>
        <div className="flex items-end justify-between">
          <p className="text-3xl font-bold">{coverage}%</p>
          <div className="w-full bg-blue-400 rounded-full h-2 ml-4 mx-auto">
            <div
              className="bg-white h-2 rounded-full transition-all"
              style={{ width: `${Math.min(coverage, 100)}%` }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
}
