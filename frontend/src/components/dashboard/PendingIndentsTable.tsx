/**
 * PendingIndentsTable - Indents Requiring Action
 * Displays approved indents waiting for PO creation
 */

interface Indent {
  id: number;
  indent_number: string;
  customer_name: string;
  created_by_name: string;
  indent_date: string;
  item_count: number;
  total_qty: number;
}

interface PendingIndentsTableProps {
  indents: Indent[];
  onCreatePO: (indent: Indent) => void;
  onViewIndent: (indent: Indent) => void;
}

export default function PendingIndentsTable({
  indents,
  onCreatePO,
  onViewIndent,
}: PendingIndentsTableProps) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
      <div className="px-6 py-4 border-b bg-slate-50">
        <h2 className="text-lg font-semibold text-slate-900">Indents Requiring PO Creation</h2>
        <p className="text-sm text-slate-500 mt-1">
          Approved indents waiting for purchase orders ({indents.length})
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 border-b sticky top-0 z-10">
            <tr>
              <th className="px-6 py-3 text-left font-semibold text-slate-700">Indent #</th>
              <th className="px-6 py-3 text-left font-semibold text-slate-700">Customer</th>
              <th className="px-6 py-3 text-left font-semibold text-slate-700">Items</th>
              <th className="px-6 py-3 text-left font-semibold text-slate-700">Qty</th>
              <th className="px-6 py-3 text-left font-semibold text-slate-700">Requested By</th>
              <th className="px-6 py-3 text-left font-semibold text-slate-700">Date</th>
              <th className="px-6 py-3 text-right font-semibold text-slate-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {indents.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                  <div className="flex flex-col items-center">
                    <p className="text-base font-medium">No pending indents</p>
                    <p className="text-xs mt-1">All indents have been converted to purchase orders</p>
                  </div>
                </td>
              </tr>
            ) : (
              indents.map((indent) => (
                <tr
                  key={indent.id}
                  className="border-b bg-amber-50 hover:bg-amber-100 transition-colors"
                >
                  <td className="px-6 py-4 font-semibold text-blue-600">{indent.indent_number}</td>
                  <td className="px-6 py-4 text-slate-700">{indent.customer_name}</td>
                  <td className="px-6 py-4 text-slate-700 font-medium">{indent.item_count}</td>
                  <td className="px-6 py-4 text-slate-700">{indent.total_qty}</td>
                  <td className="px-6 py-4 text-slate-600">{indent.created_by_name}</td>
                  <td className="px-6 py-4 text-slate-600">
                    {new Date(indent.indent_date).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => onCreatePO(indent)}
                        className="px-4 py-2 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition-colors"
                      >
                        Create PO
                      </button>
                      <button
                        onClick={() => onViewIndent(indent)}
                        className="px-4 py-2 text-xs bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
                      >
                        View
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}