import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import Layout from "../components/layout/Layout";
import api from "../api";
import { toast } from "react-toastify";

const cardClass = "bg-white rounded-2xl border border-slate-200 shadow-sm p-5";

export default function InvoiceView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const invoiceId = Number(id);

  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [addAmount, setAddAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");
  const [dueDate, setDueDate] = useState("");

  const handlePrintInvoice = () => {
    if (!invoice) return;

    const esc = (v: any) =>
      String(v ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");

    const fmt = (n: number) =>
      "₹" + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });

    const fmtDate = (d?: string) => {
      if (!d) return "—";
      const date = new Date(d);
      return isNaN(date.getTime()) ? "—" : date.toLocaleDateString("en-GB");
    };

    const customer = invoice?.customer_snapshot || {};
    const items = Array.isArray(invoice?.items) ? invoice.items : [];

    // Calculate totals
    let subtotal = 0;
    let totalGst = 0;
    const gstByRate: Record<string, { taxable: number; gst: number }> = {};

    const rowsHtml = items
      .map((item: any, idx: number) => {
        const qty = Number(item.qty || 0);
        const rate = Number(item.unit_price || 0);
        const taxRate = Number(item.tax_rate || 0);
        const taxable = qty * rate;
        const gst = (taxable * taxRate) / 100;
        const total = taxable + gst;

        subtotal += taxable;
        totalGst += gst;

        const rateKey = `${taxRate.toFixed(0)}%`;
        if (!gstByRate[rateKey]) {
          gstByRate[rateKey] = { taxable: 0, gst: 0 };
        }
        gstByRate[rateKey].taxable += taxable;
        gstByRate[rateKey].gst += gst;

        return `
<tr>
  <td class="center">${idx + 1}</td>
  <td>
    <strong>${esc(item.product_name || "Product")}</strong><br/>
    <span class="desc">${esc(item.description || "")}</span><br/>
    <span class="hsn">HSN: ${esc(item.hsn_code || "-")}</span>
  </td>
  <td class="center">${qty.toFixed(2)}</td>
  <td class="center">${esc(item.uom || "NOS")}</td>
  <td class="right">${fmt(rate)}</td>
  <td class="right">${fmt(taxable)}</td>
  <td class="center">${taxRate.toFixed(2)}%</td>
  <td class="right">${fmt(gst)}</td>
  <td class="right">${fmt(total)}</td>
</tr>`;
      })
      .join("");

    const gstBreakdownHtml = Object.entries(gstByRate)
      .map(
        ([rate, values]) => `
<tr>
  <td colspan="7" class="right"><strong>GST @ ${rate}</strong></td>
  <td class="right">${fmt(values.taxable)}</td>
  <td class="right">${fmt(values.gst)}</td>
</tr>`
      )
      .join("");

    const grandTotal = subtotal + totalGst - (invoice?.total_discount || 0);
    const balanceDue = Number(invoice?.total_amount || 0) - Number(invoice?.amount_paid || 0);

    const css = `
@page {
  size: A4;
  margin: 10mm;
}

body {
  font-family: Calibri, Arial, sans-serif;
  font-size: 11px;
  color: #000;
  margin: 0;
}

.page {
  border: 1px solid #000;
  padding: 8px;
  box-sizing: border-box;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  border: 2px solid #000;
  padding: 8px;
  margin-bottom: 6px;
  background: #f5f5f5;
}

.header-left {
  flex: 0 0 auto;
}

.header-right {
  flex: 1;
  padding-left: 12px;
  font-size: 10px;
  line-height: 1.4;
}

.company-name {
  font-weight: bold;
  font-size: 12px;
  margin-bottom: 4px;
}

.logo {
  height: 50px;
  width: auto;
}

.title {
  text-align: center;
  font-size: 16px;
  font-weight: bold;
  margin: 6px 0;
}

.invoice-header-box {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 6px;
  margin-bottom: 6px;
}

.invoice-info-box {
  border: 1px solid #000;
  padding: 6px;
  font-size: 10px;
  line-height: 1.5;
}

.invoice-info-box strong {
  display: block;
  margin-bottom: 3px;
}

.party-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  margin-bottom: 6px;
}

.party-box {
  border: 1px solid #000;
  padding: 6px;
  font-size: 10px;
  line-height: 1.5;
}

.party-title {
  font-weight: bold;
  margin-bottom: 4px;
  border-bottom: 1px solid #000;
}

.items-table {
  width: 100%;
  border-collapse: collapse;
  border: 1px solid #000;
  margin-bottom: 6px;
  font-size: 10px;
}

.items-table th,
.items-table td {
  border: 1px solid #000;
  padding: 4px;
  vertical-align: top;
}

.items-table th {
  background: #000;
  color: #fff;
  font-weight: bold;
  text-align: center;
}

.center { text-align: center; }
.right { text-align: right; }

.desc { font-size: 9px; color: #666; }
.hsn { font-size: 9px; color: #666; }

.summary-table {
  width: 100%;
  border-collapse: collapse;
  border: 1px solid #000;
  margin-bottom: 6px;
  font-size: 10px;
  margin-left: auto;
  width: 60%;
}

.summary-table td {
  border: 1px solid #000;
  padding: 4px;
}

.summary-table .label { text-align: right; font-weight: bold; width: 60%; }
.summary-table .amount { text-align: right; width: 40%; }
.summary-table .grand { background: #000; color: #fff; }

.amount-words {
  border: 1px solid #000;
  padding: 6px;
  margin-bottom: 6px;
  background: #e8f5e9;
  font-weight: bold;
  font-size: 11px;
}

.notes-section {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  margin-bottom: 6px;
}

.notes-box {
  border: 1px solid #000;
  padding: 6px;
  font-size: 10px;
  line-height: 1.4;
}

.notes-box strong {
  display: block;
  margin-bottom: 3px;
  border-bottom: 1px solid #000;
}

.footer {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-top: 12px;
  font-size: 10px;
}

.signature {
  text-align: right;
}

.signature-line {
  border-top: 1px solid #000;
  width: 150px;
  margin-top: 30px;
}
`;

    const html = `
<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<title>${esc(invoice.invoice_no)}</title>
<style>${css}</style>
</head>
<body>
<div class="page">

  <!-- HEADER -->
  <div class="header">
    <div class="header-left">
      <img src="${window.location.origin}/logo.png" class="logo" alt="Logo"/>
    </div>
    <div class="header-right">
      <div class="company-name">PRAYOSHA AUTOMATION PRIVATE LIMITED</div>
      <div>Third Floor, 28, Samravy Sequence, Opp. Ambe School, Manjalpur, Vadodara - 390011</div>
      <div>Ph: +91-265-2633635 | Email: sales@prayosha.net.in</div>
      <div>GSTIN: 24AALCP3186E1ZD | Website: www.prayosha.net.in</div>
    </div>
  </div>

  <div class="title">TAX INVOICE</div>

  <!-- Invoice Details Header -->
  <div class="invoice-header-box">
    <div class="invoice-info-box">
      <strong>Invoice No:</strong> ${esc(invoice.invoice_no || "-")}<br/>
      <strong>Date:</strong> ${fmtDate(invoice.invoice_date)}<br/>
      <strong>Due Date:</strong> ${fmtDate(invoice.due_date)}
    </div>
    <div class="invoice-info-box">
      <strong>Sales Order:</strong> ${esc(invoice.so_number || "-")}<br/>
      <strong>Dispatch:</strong> ${esc(invoice.dispatch_no || "-")}<br/>
      <strong>Status:</strong> ${(invoice?.payment_status || "-").toUpperCase()}
    </div>
    <div class="invoice-info-box">
      <strong>Currency:</strong> ${invoice?.currency || "INR"}<br/>
      <strong>Payment Status:</strong> ${(invoice?.status || "-").toUpperCase()}<br/>
      <strong>Balance Due:</strong> ${fmt(balanceDue)}
    </div>
  </div>

  <!-- Party Details -->
  <div class="party-grid">
    <div class="party-box">
      <div class="party-title">Bill To (Customer)</div>
      <strong>${esc(customer.company_name || "-")}</strong><br/>
      ${customer.location_name ? esc(customer.location_name) + "<br/>" : ""}
      ${customer.address ? esc(customer.address) + "<br/>" : ""}
      <strong>GSTIN:</strong> ${esc(customer.gstin || "-")}<br/>
      <strong>Contact:</strong> ${esc(customer.contact_name || "-")}<br/>
      <strong>Phone:</strong> ${esc(customer.phone || "-")}<br/>
      <strong>Email:</strong> ${esc(customer.email || "-")}
    </div>
    <div class="party-box">
      <div class="party-title">Ship To / Delivery</div>
      <strong>${esc(customer.company_name || "-")}</strong><br/>
      ${customer.location_name ? esc(customer.location_name) + "<br/>" : ""}
      ${customer.address ? esc(customer.address) + "<br/>" : ""}
      <strong>GSTIN:</strong> ${esc(customer.gstin || "-")}
    </div>
  </div>

  <!-- Items Table -->
  <table class="items-table">
    <thead>
      <tr>
        <th style="width: 5%">#</th>
        <th style="width: 30%">Item Description</th>
        <th style="width: 8%">Qty</th>
        <th style="width: 8%">UOM</th>
        <th style="width: 12%">Rate</th>
        <th style="width: 12%">Taxable</th>
        <th style="width: 8%">Tax %</th>
        <th style="width: 10%">Tax Amt</th>
        <th style="width: 12%">Amount (₹)</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>

  <!-- Summary Table -->
  <table class="summary-table">
    <tr>
      <td class="label">Subtotal (Taxable)</td>
      <td class="amount">${fmt(subtotal)}</td>
    </tr>
    ${gstBreakdownHtml}
    ${invoice?.total_discount ? `<tr>
      <td class="label">Discount</td>
      <td class="amount">- ${fmt(invoice.total_discount)}</td>
    </tr>` : ""}
    <tr>
      <td class="label">Total GST</td>
      <td class="amount">${fmt(totalGst)}</td>
    </tr>
    <tr class="grand">
      <td class="label">GRAND TOTAL</td>
      <td class="amount">${fmt(grandTotal)}</td>
    </tr>
    ${invoice?.amount_paid ? `<tr>
      <td class="label">Amount Paid</td>
      <td class="amount">${fmt(invoice.amount_paid)}</td>
    </tr>` : ""}
    <tr>
      <td class="label">Balance Due</td>
      <td class="amount">${fmt(balanceDue)}</td>
    </tr>
  </table>

  <!-- Notes -->
  <div class="notes-section">
    ${invoice?.terms ? `<div class="notes-box">
      <strong>Terms & Conditions</strong>
      <div>${esc(invoice.terms).replace(/\n/g, "<br>")}</div>
    </div>` : ""}
    ${invoice?.notes ? `<div class="notes-box">
      <strong>Notes</strong>
      <div>${esc(invoice.notes).replace(/\n/g, "<br>")}</div>
    </div>` : ""}
  </div>

  <!-- Footer -->
  <div class="footer">
    <div>System generated invoice. No signature required.</div>
    <div class="signature">
      For PRAYOSHA AUTOMATION PRIVATE LIMITED<br/>
      <div class="signature-line"></div>
      Authorised Signatory
    </div>
  </div>

</div>
</body>
</html>`;

    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) return;

    doc.open();
    doc.write(html);
    doc.close();

    iframe.onload = () => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => document.body.removeChild(iframe), 1000);
    };
  };

  const loadInvoice = async () => {
    if (!Number.isFinite(invoiceId) || invoiceId <= 0) {
      setErr("Invalid invoice id");
      return;
    }
    try {
      setLoading(true);
      setErr(null);
      const data = await api.getInvoiceById(invoiceId);
      setInvoice(data);
      setNotes(data?.notes || "");
      setTerms(data?.terms || "");
      setDueDate(data?.due_date || "");
    } catch (e: any) {
      setErr(e?.message || "Failed to load invoice");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvoice();
    const interval = window.setInterval(loadInvoice, 20000);
    return () => window.clearInterval(interval);
  }, [invoiceId]);

  const items = useMemo(() => {
    if (!invoice?.items) return [];
    if (Array.isArray(invoice.items)) return invoice.items;
    return [];
  }, [invoice]);

  const handleAddPayment = async () => {
    const amt = Number(addAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error("Enter valid payment amount");
      return;
    }
    try {
      setSaving(true);
      await api.updateInvoicePayment(invoiceId, { add_amount: amt });
      toast.success("Payment updated");
      setAddAmount("");
      await loadInvoice();
    } catch (e: any) {
      toast.error(e?.message || "Failed to update payment");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveInvoice = async () => {
    try {
      setSaving(true);
      await api.updateInvoice(invoiceId, {
        due_date: dueDate || null,
        notes: notes || null,
        terms: terms || null,
      });
      toast.success("Invoice updated");
      await loadInvoice();
    } catch (e: any) {
      toast.error(e?.message || "Failed to update invoice");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Delete this invoice?")) return;
    try {
      setSaving(true);
      await api.deleteInvoice(invoiceId);
      toast.success("Invoice deleted");
      navigate("/invoices");
    } catch (e: any) {
      toast.error(e?.message || "Failed to delete invoice");
    } finally {
      setSaving(false);
    }
  };

  if (loading && !invoice) {
    return <Layout><div className="max-w-6xl mx-auto p-8 text-gray-500">Loading invoice...</div></Layout>;
  }

  if (err && !invoice) {
    return <Layout><div className="max-w-6xl mx-auto p-8 text-red-700">{err}</div></Layout>;
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto p-4 sm:p-8 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{invoice?.invoice_no || "Invoice"}</h1>
            <p className="text-sm text-slate-600 mt-1">
              {invoice?.invoice_date || "—"} | SO: {invoice?.so_number || "—"} | Dispatch: {invoice?.dispatch_no || "—"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="px-4 py-2 rounded-lg border" onClick={() => navigate("/invoices")} type="button">
              Back
            </button>
            <Link className="px-4 py-2 rounded-lg border" to={`/invoices/${invoiceId}/edit`}>
              Edit
            </Link>
            <button className="px-4 py-2 rounded-lg border" onClick={handlePrintInvoice} type="button">
              Print
            </button>
            <button className="px-4 py-2 rounded-lg bg-red-600 text-white" disabled={saving} onClick={handleDelete} type="button">
              Delete
            </button>
          </div>
        </div>

        {err && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-red-700 text-sm">{err}</div>}

        <div className="grid md:grid-cols-4 gap-4">
          <div className={cardClass}><p className="text-xs text-slate-500">Total</p><p className="text-xl font-bold">₹{Number(invoice?.total_amount || 0).toFixed(2)}</p></div>
          <div className={cardClass}><p className="text-xs text-slate-500">Paid</p><p className="text-xl font-bold text-emerald-700">₹{Number(invoice?.amount_paid || 0).toFixed(2)}</p></div>
          <div className={cardClass}><p className="text-xs text-slate-500">Balance</p><p className="text-xl font-bold text-amber-700">₹{Number(invoice?.balance_due || 0).toFixed(2)}</p></div>
          <div className={cardClass}><p className="text-xs text-slate-500">Payment Status</p><p className="text-xl font-bold text-indigo-700 capitalize">{invoice?.payment_status || "-"}</p></div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className={cardClass}>
              <h2 className="font-semibold mb-3">Invoice Items</h2>
              <div className="overflow-x-auto border rounded-xl">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50"><tr><th className="text-left px-3 py-3">Product</th><th className="text-left px-3 py-3">HSN</th><th className="text-right px-3 py-3">Qty</th><th className="text-left px-3 py-3">UOM</th><th className="text-right px-3 py-3">Rate</th><th className="text-right px-3 py-3">Tax</th><th className="text-right px-3 py-3">Amount</th></tr></thead>
                  <tbody>
                    {items.map((it: any, idx: number) => (
                      <tr key={idx} className="border-t align-top">
                        <td className="px-3 py-3">
                          <div className="font-semibold text-slate-900">{it.product_name || `#${it.product_id}`}</div>
                          {it.description && <div className="text-xs text-slate-500 mt-1">{it.description}</div>}
                        </td>
                        <td className="px-3 py-3">{it.hsn_code || "-"}</td>
                        <td className="px-3 py-3 text-right">{Number(it.qty || 0).toFixed(2)}</td>
                        <td className="px-3 py-3">{it.uom || "-"}</td>
                        <td className="px-3 py-3 text-right">{Number(it.unit_price || 0).toFixed(2)}</td>
                        <td className="px-3 py-3 text-right">{Number(it.tax_rate || 0).toFixed(2)}%</td>
                        <td className="px-3 py-3 text-right">{((Number(it.qty || 0) * Number(it.unit_price || 0)) * (1 + Number(it.tax_rate || 0) / 100)).toFixed(2)}</td>
                      </tr>
                    ))}
                    {items.length === 0 && <tr><td className="px-3 py-5 text-center text-slate-500" colSpan={7}>No items</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>

            <div className={cardClass}>
              <h2 className="font-semibold mb-3">Payment Update</h2>
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="text-xs text-slate-600">Add payment amount</label>
                  <input value={addAmount} onChange={(e) => setAddAmount(e.target.value)} className="block border rounded-lg px-3 py-2" />
                </div>
                <button type="button" onClick={handleAddPayment} disabled={saving} className="px-4 py-2 rounded-lg bg-emerald-600 text-white">
                  Add Payment
                </button>
              </div>
            </div>

            <div className={cardClass}>
              <h2 className="font-semibold mb-3">Quick Edit</h2>
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-600">Due Date</label>
                  <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="block w-full border rounded-lg px-3 py-2" />
                </div>
                <div>
                  <label className="text-xs text-slate-600">Terms</label>
                  <input value={terms} onChange={(e) => setTerms(e.target.value)} className="block w-full border rounded-lg px-3 py-2" />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs text-slate-600">Notes</label>
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="block w-full border rounded-lg px-3 py-2" />
                </div>
              </div>
              <div className="mt-3">
                <button type="button" onClick={handleSaveInvoice} disabled={saving} className="px-4 py-2 rounded-lg bg-blue-600 text-white">
                  Save Invoice
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className={cardClass}>
              <h2 className="font-semibold mb-3">Customer Details</h2>
              <div className="space-y-3 text-sm">
                <div><span className="text-slate-500">Company</span><div className="font-semibold">{invoice?.customer_snapshot?.company_name || "-"}</div></div>
                <div><span className="text-slate-500">Location</span><div className="font-semibold">{invoice?.customer_snapshot?.location_name || "-"}</div></div>
                <div><span className="text-slate-500">Address</span><div className="font-semibold">{invoice?.customer_snapshot?.address || "-"}</div></div>
                <div><span className="text-slate-500">GSTIN</span><div className="font-semibold">{invoice?.customer_snapshot?.gstin || "-"}</div></div>
                <div><span className="text-slate-500">Contact</span><div className="font-semibold">{invoice?.customer_snapshot?.contact_name || "-"}</div></div>
                <div><span className="text-slate-500">Phone</span><div className="font-semibold">{invoice?.customer_snapshot?.phone || "-"}</div></div>
                <div><span className="text-slate-500">Email</span><div className="font-semibold break-all">{invoice?.customer_snapshot?.email || "-"}</div></div>
              </div>
            </div>

            <div className={cardClass}>
              <h2 className="font-semibold mb-3">Commercial Summary</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span className="font-semibold">₹{Number(invoice?.subtotal || 0).toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Discount</span><span className="font-semibold">₹{Number(invoice?.total_discount || 0).toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Tax</span><span className="font-semibold">₹{Number(invoice?.tax_total || 0).toFixed(2)}</span></div>
                <div className="flex justify-between border-t pt-2"><span className="text-slate-700 font-semibold">Grand Total</span><span className="font-bold">₹{Number(invoice?.total_amount || 0).toFixed(2)}</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
