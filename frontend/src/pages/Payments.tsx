import Layout from "../components/layout/Layout";
import { useEffect, useState } from "react";
import api from "../api";
import { toast } from "react-toastify";

export default function Payments() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [amountById, setAmountById] = useState<Record<number, string>>({});

  const load = () => {
    setLoading(true);
    api
      .getInvoices({ limit: 300, payment_status: "unpaid" })
      .then((r) => setRows(Array.isArray(r) ? r : []))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const interval = window.setInterval(load, 20000);
    return () => window.clearInterval(interval);
  }, []);

  const pay = async (id: number) => {
    const amount = Number(amountById[id] || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter payment amount");
      return;
    }
    try {
      await api.updateInvoicePayment(id, { add_amount: amount });
      toast.success("Payment saved");
      setAmountById((p) => ({ ...p, [id]: "" }));
      load();
    } catch (e: any) {
      toast.error(e?.message || "Payment failed");
    }
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto p-8 space-y-4">
        <h1 className="text-2xl font-semibold text-slate-900">Payments</h1>
        <p className="text-sm text-slate-600">Real-time style payment queue for pending invoices.</p>
        <div className="bg-white border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b text-xs text-slate-500">{loading ? "Loading..." : `${rows.length} pending invoices`}</div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-4 py-2">Invoice</th>
                  <th className="text-right px-4 py-2">Balance</th>
                  <th className="text-right px-4 py-2">Receive</th>
                  <th className="text-right px-4 py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-4 py-2">{r.invoice_no}</td>
                    <td className="px-4 py-2 text-right">{Number(r.balance_due || 0).toFixed(2)}</td>
                    <td className="px-4 py-2 text-right">
                      <input
                        value={amountById[r.id] ?? ""}
                        onChange={(e) => setAmountById((p) => ({ ...p, [r.id]: e.target.value }))}
                        className="w-28 border rounded px-2 py-1 text-right"
                        placeholder="0.00"
                      />
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button onClick={() => pay(Number(r.id))} className="px-3 py-1 rounded bg-emerald-600 text-white text-xs">
                        Add
                      </button>
                    </td>
                  </tr>
                ))}
                {!loading && rows.length === 0 && (
                  <tr><td className="px-4 py-6 text-center text-slate-500" colSpan={4}>No pending invoices.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
}

