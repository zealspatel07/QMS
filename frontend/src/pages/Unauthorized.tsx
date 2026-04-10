
import Layout from "../components/layout/Layout";

export default function Unauthorized() {
  return (
    <Layout>
      <div className="p-6">
        <h1 className="text-2xl font-semibold">Unauthorized</h1>
        <p className="mt-2 text-sm text-slate-600">
          You do not have permission to view this page.
        </p>
      </div>
    </Layout>
  );
}