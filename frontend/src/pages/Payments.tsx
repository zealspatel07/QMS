import Layout from "../components/layout/Layout";

export default function Payments() {
  return (
    <Layout>
      <div className="max-w-6xl mx-auto p-8 space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900">Payments</h1>
        <p className="text-sm text-slate-600">
          Basic payment tracking is available on each invoice (unpaid/partial/paid). A dedicated payments ledger screen
          will be added next.
        </p>
      </div>
    </Layout>
  );
}

