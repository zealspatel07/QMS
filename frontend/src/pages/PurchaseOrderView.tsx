//frontend/src/pages/PurchaseOrderView.tsx
import { useEffect, useState } from "react";
import Layout from "../components/layout/Layout";
import api from "../api";
import { useParams, useNavigate } from "react-router-dom";
import POStatusTimeline from "../components/POStatusTimeline";
import ReceiveQuantityModal from "../components/ReceiveQuantityModal";
import ClosePoModal from "../components/ClosePoModal";
import styles from "./PurchaseOrderView.module.css";
import {
  Package,
  TrendingUp,
  CheckCircle,
  AlertCircle,
  Building,
  Calendar,
  FileText,
  Truck,
  Printer,
  Mail,
  XCircle,
  DollarSign
} from "lucide-react";

interface POItem {
  id: number;
  product_name: string;
  product_description: string;
  ordered_qty: number;
  uom?: string;
  received_qty: number;
  unit_price?: number;
  line_total?: number;
}

interface ModalState {
  isOpen: boolean;
  item: POItem | null;
}

function getStatusColor(status: string): { bg: string; text: string } {
  const colors: Record<string, { bg: string; text: string }> = {
    created: { bg: "bg-yellow-100", text: "text-yellow-700" },
    pending: { bg: "bg-yellow-100", text: "text-yellow-700" },
    partial: { bg: "bg-purple-100", text: "text-purple-700" },
    completed: { bg: "bg-emerald-100", text: "text-emerald-700" },
    closed: { bg: "bg-red-100", text: "text-red-700" },
    cancelled: { bg: "bg-red-100", text: "text-red-700" }
  };
  return colors[status] || { bg: "bg-slate-100", text: "text-slate-700" };
}

export default function PurchaseOrderView() {
  const { id } = useParams<{ id: string }>();
  const [po, setPO] = useState<any>(null);
  const [modal, setModal] = useState<ModalState>({ isOpen: false, item: null });
  const [closeModal, setCloseModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (id) {
      console.log("Opening PO:", id);
      fetchPO();
    }
  }, [id]);


  useEffect(() => {
    if (po) {
      console.log("✅ PO DATA LOADED:", {
        po_number: po.po_number,
        vendor_name: po.vendor_name,
        vendor_quote_no: po.vendor_quote_no,
        vendor_quote_date: po.vendor_quote_date,
        delivery_date: po.delivery_date,
        payment_terms: po.payment_terms,
        remarks: po.remarks,
        items: po.items?.length || 0
      });
    }
  }, [po]);


  async function fetchPO() {
    if (!id) return;
    try {
      const res = await api.getPurchaseOrder(Number(id));
      setPO(res);
    } catch (error) {
      console.error("Error fetching PO:", error);
    }
  }

  const handleOpenReceiveModal = (item: POItem) => {
    setModal({ isOpen: true, item });
  };

  const handleCloseModal = () => {
    setModal({ isOpen: false, item: null });
  };

  const handleClosePO = async (reason: string) => {
    if (!id) return;

    setIsLoading(true);
    try {
      await api.closePurchaseOrder(Number(id), reason);
      // Refresh PO data
      await fetchPO();
      setCloseModal(false);
    } catch (error) {
      console.error("Error closing PO:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const handleReceiveSubmit = async (quantity: number) => {
    if (!modal.item) return;

    setIsLoading(true);
    try {
      await api.updatePOItemReceived(modal.item.id, quantity);
      // Refresh PO data
      await fetchPO();
      handleCloseModal();
    } catch (error) {
      console.error("Error updating received quantity:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompleteItem = async (item: POItem) => {

    if (!confirm(`Mark ${item.product_name} as completely delivered?`)) return;

    setIsLoading(true);

    try {

      // Send FULL ordered quantity
      await api.updatePOItemReceived(item.id, item.ordered_qty);

      await fetchPO();

    } catch (error) {

      console.error("Error marking complete:", error);

    } finally {

      setIsLoading(false);

    }

  };
  const handlePrintPO = () => {

    if (!po) return;

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

    const origin = window.location.origin;
    const logoUrl = `${origin}/logo.png`;

    /* ---------- ITEMS ---------- */

    let subtotal = 0;

    const rowsHtml = po.items.map((item: POItem, i: number) => {
      const amount = Number(item.line_total || 0);
      subtotal += amount;

      return `
<tr>
  <td class="center">${i + 1}</td>
  <td>
    <strong>${esc(item.product_name)}</strong><br/>
    ${esc(item.product_description || "")}
  </td>
  <td>${item.ordered_qty} ${item.uom}</td>
  <td class="center">${fmt(Number(item.unit_price || 0))}</td>
  <td class="center">${fmt(amount)}</td>
</tr>`;
    }).join("");

    // Calculate tax (18% IGST by default)
    const taxRate = 18;
    const taxAmount = subtotal * (taxRate / 100);
    const total = subtotal + taxAmount;

    /* ---------- CSS ---------- */

    const css = `

@page {
  size: A4;
  margin: 10mm;
}

body {
  font-family: Calibri, sans-serif;
  font-size: 11px;
  color: #000;
  margin: 0;
}

.page {
  border: 1px solid #000;
  padding: 12px;
  box-sizing: border-box;
  page-break-after: always;
}

/* HEADER */
.top-header {
  display: flex;
  align-items: center;
  border: 1px solid #000;
  padding: 8px;
}

.logo {
  height: 55px;
  margin-right: 10px;
}

.company-info {
  font-size: 11px;
  line-height: 1.4;
  word-break: break-word;
}

/* TITLE */
.title {
  text-align: center;
  font-weight: bold;
  font-size: 16px;
  margin: 8px 0;
}

/* PARTY GRID */
.party-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  border: 1px solid #000;
  margin-top: 6px;
}

.party-box {
  padding: 8px;
  border-right: 1px solid #000;
  font-size: 10px;
  line-height: 1.5;

  word-break: break-word;
  overflow-wrap: break-word;
  white-space: normal;
}

.party-box:last-child {
  border-right: none;
}

.section-title {
  font-weight: bold;
  margin-bottom: 5px;
}

/* INFO TABLE */
.info-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: -1px;
  table-layout: fixed;
}

.info-table td {
  border: 1px solid #000;
  padding: 6px;
  font-size: 11px;
  text-align: center;
  vertical-align: middle;

  word-break: break-word;
  overflow-wrap: break-word;
  white-space: normal;
}

.info-table .head-row td {
  font-weight: bold;
  background: #efefef;
}

/* Equal columns */
.info-table tr td {
  width: 25%;
}

/* ITEMS TABLE (CRITICAL FIXED STRUCTURE) */
.items-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: -1px;
  table-layout: fixed;
}

.items-table th,
.items-table td {
  border: 1px solid #000;
  padding: 6px;
  font-size: 11px;

  word-break: break-word;
  overflow-wrap: break-word;
  white-space: normal;
  vertical-align: top;
}

.items-table th {
  background: #efefef;
  text-align: center;
}

/* COLUMN WIDTH CONTROL */
.items-table th:nth-child(1),
.items-table td:nth-child(1) {
  width: 5%;
  text-align: center;
}

.items-table th:nth-child(2),
.items-table td:nth-child(2) {
  width: 35%;
}

.items-table th:nth-child(3),
.items-table td:nth-child(3) {
  width: 12%;
  text-align: center;
}

.items-table th:nth-child(4),
.items-table td:nth-child(4) {
  width: 10%;
  text-align: center;
}

.items-table th:nth-child(5),
.items-table td:nth-child(5) {
  width: 15%;
  text-align: right;
}

.items-table th:nth-child(6),
.items-table td:nth-child(6) {
  width: 15%;
  text-align: right;
}

/* TOTAL BOX */
.total-box {
  width: 220px;
  margin-left: auto;
  margin-top: -1px;
  border-collapse: collapse;
  page-break-inside: avoid;
}

.total-box td {
  border: 1px solid #000;
  padding: 6px;
}

.grand {
  font-weight: bold;
}

/* TERMS */
.terms {
  margin-top: -1px;
  border: 1px solid #000;
  padding: 8px;
  font-size: 11px;
  line-height: 1.6;

  word-break: break-word;
}

/* FOOTER */
.footer {
  display: flex;
  justify-content: space-between;
  margin-top: 15px;
  font-size: 11px;
}

.signature {
  text-align: right;
}

/* ALIGN HELPERS */
.center { text-align: center; }
.right { text-align: right; }

/* 🔥 PRINT CONTROL (VERY IMPORTANT) */
table, tr, td, th {
  page-break-inside: avoid;
}

tr {
  page-break-inside: avoid;
}

`;

    /* ---------- HTML ---------- */

    const termsHtml = po.terms_snapshot
      ? po.terms_snapshot
        .split("\n")
        .map((line: string) => `<li>${esc(line)}</li>`)
        .join("")
      : `<li>No terms specified</li>`;

    const html = `
<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<title>Purchase Order</title>
<style>${css}</style>
</head>

<body>

<div class="page">

  <!-- HEADER -->
  <div class="top-header">
    <img src="${logoUrl}" class="logo"/>
    <div class="company-info">
      <strong>PRAYOSHA AUTOMATION PRIVATE LIMITED</strong><br/>
      Third Floor, 28, Samanvay Sequence, Opp. Ambe School, Manjalpur, Vadodara – 390011<br/>
      GSTIN: 24AALCP3186E1ZD | Website: www.prayosha.net.in
    </div>
  </div>

  <div class="title">PURCHASE ORDER</div>

  <!-- PARTY -->
  <div class="party-grid">
     <div class="party-box">
  <div class="section-title">Supplier</div>

  <strong>${esc(po.vendor_name || "")}</strong><br/>

  ${po.vendor_address ? esc(po.vendor_address) + "<br/>" : ""}
  ${po.vendor_city ? esc(po.vendor_city) + ", " : ""}
  ${po.vendor_state ? esc(po.vendor_state) + "<br/>" : ""}
  ${po.vendor_country ? esc(po.vendor_country) + " " : ""}
  ${po.vendor_pincode ? esc(po.vendor_pincode) : ""}

  <br/><br/>
  GSTIN: ${esc(po.vendor_gst || "—")}
</div>

   <div class="party-box">
  <div class="section-title">Bill To</div>
  <strong>PRAYOSHA AUTOMATION PRIVATE LIMITED</strong><br/>
  High Rise 408-409, Park Paradise,<br/>
  Nr. Billboard International High School,<br/>
  Kalali-Vadsar Ring Road,<br/>
  Vadsar, Vadodara – 390012 (GJ), IN<br/><br/>
  GSTIN: 24AALCP3186E1ZD
</div>

<div class="party-box">
  <div class="section-title">Ship To</div>
  <strong>PRAYOSHA AUTOMATION PRIVATE LIMITED</strong><br/>
  High Rise 408-409, Park Paradise,<br/>
  Nr. Billboard International High School,<br/>
  Kalali-Vadsar Ring Road,<br/>
  Vadsar, Vadodara – 390012 (GJ), IN<br/><br/>
  GSTIN: 24AALCP3186E1ZD
</div>
  </div>

  <!-- INFO TABLE -->
  <table class="info-table">

    <!-- HEADER ROW 1 -->
    <tr class="head-row">
      <td>PO No</td>
      <td>PO Date</td>
      <td>Delivery Date</td>
      <td>Payment Terms</td>
    </tr>

    <!-- VALUE ROW 1 -->
    <tr>
      <td>${esc(po.po_number)}</td>
      <td>${fmtDate(po.order_date)}</td>
      <td>${fmtDate(po.delivery_date)}</td>
      <td>${esc(po.payment_terms || "—")}</td>
    </tr>

    <!-- HEADER ROW 2 -->
    <tr class="head-row">
      <td>Quotation No</td>
      <td>Quotation Date</td>
      <td colspan="2">Remarks</td>
    </tr>

    <!-- VALUE ROW 2 -->
    <tr>
      <td>${esc(po.vendor_quote_no || "—")}</td>
      <td>${fmtDate(po.vendor_quote_date)}</td>
      <td colspan="2">${esc(po.remarks || "—")}</td>
    </tr>

  </table>

  <!-- ITEMS TABLE -->
  <table class="items-table">
    <thead>
      <tr>
        <th>#</th>
        <th>Description</th>
        <th>Qty</th>
        <th>Rate</th>
        <th>Amount</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>

  <!-- TOTAL -->
  <table class="total-box">
    <tr>
      <td>Sub Total</td>
      <td class="right">${fmt(subtotal)}</td>
    </tr>
    <tr>
      <td>Tax (${taxRate}%)</td>
      <td class="right">${fmt(taxAmount)}</td>
    </tr>
    <tr class="grand">
      <td>Grand Total</td>
      <td class="right">${fmt(total)}</td>
    </tr>
  </table>

  <!-- TERMS -->
 <div class="terms">
  <b>Terms & Conditions:</b>
  <ol>
    ${termsHtml}
  </ol>
</div>

  <!-- FOOTER -->
  <div class="footer">
    <div>SUBJECT TO VADODARA JURISDICTION</div>
    <div class="signature">
      For PRAYOSHA AUTOMATION PRIVATE LIMITED<br/><br/>
      <b>Authorised Signatory</b>
    </div>
  </div>

</div>

</body>
</html>
`;

    const iframe = document.createElement("iframe");
    iframe.className = styles["print-iframe-hidden"];
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

  const handleMailPO = () => {
    const subject = `Purchase Order - ${po?.po_number}`;
    const body = `Hi,\n\nPlease find the Purchase Order details below:\n\nPO Number: ${po?.po_number}\nVendor: ${po?.vendor_name}\nOrder Date: ${po?.order_date ? new Date(po.order_date).toLocaleDateString() : '-'}\nStatus: ${po?.status}\n\nTotal Items: ${po?.items?.length || 0}\nTotal Ordered: ${totals.ordered}\nTotal Received: ${totals.received}\nTotal Pending: ${totals.pending}\n\nThank you`;
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  // Calculate totals with proper number conversion
  const calculateTotals = () => {
    if (!po?.items) return { ordered: 0, received: 0, pending: 0 };

    const ordered = po.items.reduce((sum: number, item: POItem) => {
      return sum + (Number(item.ordered_qty) || 0);
    }, 0);

    const received = po.items.reduce((sum: number, item: POItem) => {
      return sum + (Number(item.received_qty) || 0);
    }, 0);

    const pending = ordered - received;

    return { ordered, received, pending };
  };

  const totals = calculateTotals();

  if (!po) {
    return (
      <Layout>
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
          <div className="text-center">
            <Package className="text-slate-400 mx-auto mb-4" size={48} />
            <p className="text-slate-600 text-lg">Loading purchase order...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* ====== PAGE HEADER ====== */}
          <div className="mb-8">
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <FileText className="text-purple-600" size={28} />
                  </div>
                  <h1 className="text-4xl font-bold text-slate-900 tracking-tight">{po?.po_number}</h1>
                </div>
                <p className="text-slate-600 flex items-center gap-2">
                  <Building size={16} />
                  {po?.vendor_name} • Managed procurement order
                </p>
              </div>
              <div className="flex gap-3">

                {/* ✅ EDIT BUTTON */}
                <button
                  onClick={() => navigate(`/purchase-orders/edit/${po.id}`)}
                  disabled={!(po.status === "created" || po.status === "pending")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors
      ${po.status === "created" || po.status === "pending"
                      ? "bg-yellow-50 hover:bg-yellow-100 text-yellow-700 border-yellow-200"
                      : "bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200"
                    }`}
                >
                  ✏️ Edit
                </button>

                {po.status !== "completed" && po.status !== "closed" && po.status !== "cancelled" && (
                  <button
                    onClick={() => setCloseModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg transition-colors"
                  >
                    <XCircle size={18} />
                    <span className="font-medium">Close</span>
                  </button>
                )}

                <button
                  onClick={handlePrintPO}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg transition-colors"
                >
                  <Printer size={18} />
                  <span className="font-medium">Print</span>
                </button>

                <button
                  onClick={handleMailPO}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg transition-colors"
                >
                  <Mail size={18} />
                  <span className="font-medium">Email</span>
                </button>

              </div>
            </div>

            {/* Header Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm hover:shadow-md transition">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-600 text-sm font-medium">Total Items</p>
                    <p className="text-3xl font-bold text-slate-900 mt-1">{po?.items?.length || 0}</p>
                  </div>
                  <div className="p-3 bg-blue-100 rounded-lg">
                    <Package className="text-blue-600" size={24} />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm hover:shadow-md transition">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-600 text-sm font-medium">Total Ordered</p>
                    <p className="text-3xl font-bold text-slate-900 mt-1">{totals.ordered}</p>
                  </div>
                  <div className="p-3 bg-indigo-100 rounded-lg">
                    <TrendingUp className="text-indigo-600" size={24} />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm hover:shadow-md transition">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-600 text-sm font-medium">Received</p>
                    <p className="text-3xl font-bold text-emerald-600 mt-1">{totals.received}</p>
                  </div>
                  <div className="p-3 bg-emerald-100 rounded-lg">
                    <CheckCircle className="text-emerald-600" size={24} />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm hover:shadow-md transition">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-600 text-sm font-medium">Pending</p>
                    <p className="text-3xl font-bold text-orange-600 mt-1">{totals.pending}</p>
                  </div>
                  <div className="p-3 bg-orange-100 rounded-lg">
                    <AlertCircle className="text-orange-600" size={24} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ====== PRODUCT DELIVERY TRACKING TABLE ====== */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm mb-8 overflow-hidden">
            <div className="border-b border-slate-200 p-6 bg-gradient-to-r from-slate-50 to-slate-100">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Truck className="text-purple-600" size={24} />
                Delivery Tracking
              </h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Product</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Ordered</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Received</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Pending</th>
                    <th className="px-6 py-4 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">Progress</th>
                    <th className="px-6 py-4 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200">
                  {po?.items?.map((item: POItem) => {
                    // Proper number conversion to avoid NaN
                    const ordered = Number(item.ordered_qty || 0);
                    const received = Number(item.received_qty || 0);
                    const pending = ordered - received;
                    const progress = ordered > 0 ? Math.round((received / ordered) * 100) : 0;
                    const isComplete = received >= ordered;

                    return (
                      <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                          <div>
                            <p className="font-semibold text-slate-900">{item.product_name}</p>
                            <p className="text-sm text-slate-600">{item.product_description}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 font-semibold text-sm">{ordered}</span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 font-semibold text-sm">{received}</span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-orange-100 text-orange-700 font-semibold text-sm">{pending}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex-1 bg-slate-200 rounded-full h-2.5">
                              <div
                                className={`${styles.progressBarFill} ${progress === 100 ? "bg-emerald-500" : "bg-indigo-500"
                                  }`}
                                style={{ "--progress-width": `${Math.min(progress, 100)}%` } as React.CSSProperties}
                              ></div>
                            </div>
                            <span className={`text-xs font-semibold w-10 text-right ${progress === 100 ? "text-emerald-600" : "text-slate-600"
                              }`}>
                              {progress}%
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex gap-2 justify-center">
                            <button
                              onClick={() => handleOpenReceiveModal(item)}
                              disabled={isComplete || isLoading || po?.status === 'closed'}
                              title={po?.status === 'closed' ? 'Cannot receive items from a closed PO' : ''}
                              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${isComplete || isLoading || po?.status === 'closed'
                                ? "bg-slate-200 text-slate-500 cursor-not-allowed"
                                : "bg-blue-500 text-white hover:bg-blue-600 hover:shadow-md"
                                }`}
                            >
                              + Receive
                            </button>

                            <button
                              onClick={() => handleCompleteItem(item)}
                              disabled={isComplete || isLoading || po?.status === 'closed'}
                              title={po?.status === 'closed' ? 'Cannot complete items in a closed PO' : ''}
                              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${isComplete || isLoading || po?.status === 'closed'
                                ? "bg-slate-200 text-slate-500 cursor-not-allowed"
                                : "bg-emerald-500 text-white hover:bg-emerald-600 hover:shadow-md"
                                }`}
                            >
                              Complete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Table Footer Summary */}
            <div className="bg-gradient-to-r from-slate-50 to-slate-100 p-6 border-t border-slate-200 flex justify-end gap-8">
              <div>
                <p className="text-xs text-slate-600 font-medium uppercase">Total Ordered</p>
                <p className="text-lg font-bold text-slate-900 mt-1">{totals.ordered}</p>
              </div>
              <div>
                <p className="text-xs text-slate-600 font-medium uppercase">Total Received</p>
                <p className="text-lg font-bold text-emerald-600 mt-1">{totals.received}</p>
              </div>
              <div>
                <p className="text-xs text-slate-600 font-medium uppercase">Total Pending</p>
                <p className="text-lg font-bold text-orange-600 mt-1">{totals.pending}</p>
              </div>
            </div>
          </div>

          {/* ====== VENDOR INFO SECTION ====== */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm mb-8 overflow-hidden">
            <div className="border-b border-slate-200 p-6 bg-gradient-to-r from-slate-50 to-slate-100">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Building className="text-blue-600" size={24} />
                Purchase Order Details
              </h2>
            </div>

            <div className="p-6 grid grid-cols-2 gap-8">
              <div className="border-r border-slate-200 pr-8">
                <p className="text-xs text-slate-600 font-semibold uppercase mb-2">Vendor Name</p>
                <p className="text-lg font-bold text-slate-900">{po?.vendor_name}</p>
              </div>
              <div>
                <p className="text-xs text-slate-600 font-semibold uppercase mb-2">Indent Reference</p>
                <div className="flex items-center gap-2">
                  <p className="text-lg font-bold inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-blue-100 text-blue-700">
                    <FileText size={16} />
                    {po?.indent_number || "-"}
                  </p>
                </div>
              </div>
              <div className="border-r border-slate-200 pr-8">
                <p className="text-xs text-slate-600 font-semibold uppercase mb-2">Order Date</p>
                <p className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Calendar size={16} className="text-slate-500" />
                  {po?.order_date
                    ? new Date(po.order_date).toLocaleDateString()
                    : "-"}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-600 font-semibold uppercase mb-2">Current Status</p>
                <p className={`text-lg font-bold capitalize inline-flex items-center gap-2 px-3 py-1 rounded-lg ${getStatusColor(po?.status || "").bg} ${getStatusColor(po?.status || "").text}`}>
                  <CheckCircle size={16} />
                  {po?.status?.replace(/_/g, " ")}
                </p>
              </div>
            </div>
          </div>

          {/* ====== VENDOR QUOTATION DETAILS SECTION ====== */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm mb-8 overflow-hidden">
            <div className="border-b border-slate-200 p-6 bg-gradient-to-r from-amber-50 to-orange-50">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <FileText className="text-amber-600" size={24} />
                Vendor Quotation Details
              </h2>
            </div>

            <div className="p-6 grid grid-cols-2 gap-8">
              {/* Quotation Number */}
              <div className="border-r border-slate-200 pr-8">
                <p className="text-xs text-slate-600 font-semibold uppercase mb-2">Quotation Number</p>
                <p className="text-lg font-bold text-slate-900">
                  {po?.vendor_quote_no ? (
                    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-amber-100 text-amber-700">
                      <FileText size={16} />
                      {po.vendor_quote_no}
                    </span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </p>
              </div>

              {/* Quotation Date */}
              <div>
                <p className="text-xs text-slate-600 font-semibold uppercase mb-2">Quotation Date</p>
                <p className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Calendar size={16} className="text-slate-500" />
                  {po?.vendor_quote_date
                    ? new Date(po.vendor_quote_date).toLocaleDateString()
                    : <span className="text-slate-400">—</span>}
                </p>
              </div>

              {/* Delivery Date */}
              <div className="border-r border-slate-200 pr-8">
                <p className="text-xs text-slate-600 font-semibold uppercase mb-2">Expected Delivery Date</p>
                <p className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Truck size={16} className="text-slate-500" />
                  {po?.delivery_date
                    ? new Date(po.delivery_date).toLocaleDateString()
                    : <span className="text-slate-400">—</span>}
                </p>
              </div>

              {/* Payment Terms */}
              <div>
                <p className="text-xs text-slate-600 font-semibold uppercase mb-2">Payment Terms</p>
                <p className="text-lg font-bold text-slate-900">
                  {po?.payment_terms || <span className="text-slate-400">—</span>}
                </p>
              </div>

              {/* Remarks - Full Width */}
              <div className="col-span-2">
                <p className="text-xs text-slate-600 font-semibold uppercase mb-2">Remarks / Special Instructions</p>
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 min-h-24">
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">
                    {po?.remarks || <span className="text-slate-400">No remarks</span>}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ====== INDENT COVERAGE SECTION ====== */}
          {po?.items && po.items.length > 0 && (
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm mb-8 overflow-hidden">
              <div className="border-b border-slate-200 p-6 bg-gradient-to-r from-slate-50 to-slate-100">
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <TrendingUp className="text-emerald-600" size={24} />
                  Indent Coverage Tracking
                </h2>
              </div>

              <div className="p-6 space-y-4">
                {po.items.map((item: any) => (
                  <div key={item.id} className="border border-slate-200 rounded-lg p-5 hover:shadow-md transition hover:border-slate-300">
                    <p className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                      <Package size={18} className="text-purple-500" />
                      {item.product_name}
                    </p>
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div className="bg-slate-50 rounded-lg p-4">
                        <p className="text-xs text-slate-600 font-semibold uppercase mb-2">Required (Indent)</p>
                        <p className="text-2xl font-bold text-slate-900">
                          {item.indent_item_id ? "N/A" : "-"}
                        </p>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-4">
                        <p className="text-xs text-slate-600 font-semibold uppercase mb-2">Ordered (This PO)</p>
                        <p className="text-2xl font-bold text-blue-600">{item.ordered_qty} {item.uom || "NOS"}</p>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-4">
                        <p className="text-xs text-slate-600 font-semibold uppercase mb-2">Total Ordered</p>
                        <p className="text-2xl font-bold text-indigo-600">{item.ordered_qty} {item.uom || "NOS"}</p>
                      </div>
                    </div>
                    <div className="pt-4 border-t border-slate-200">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm text-slate-600 font-medium">Coverage Progress</p>
                        <div className="flex-1 bg-slate-200 rounded-full h-2.5">
                          <div
                            className={`${styles.progressBar100} bg-emerald-500 h-2.5 rounded-full transition-all`}
                          ></div>
                        </div>
                        <p className="text-sm font-bold text-emerald-600 w-12 text-right">100%</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl shadow p-5 border border-slate-200">
            <h3 className="text-lg font-semibold mb-4">Vendor Contact & Quotation Summary</h3>

            {/* Contact Information */}
            <div className="mb-6 pb-6 border-b border-slate-200">
              <h4 className="text-sm font-semibold text-slate-600 uppercase mb-3">Contact Information</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">

                <div>
                  <p className="text-gray-500">Vendor Name</p>
                  <p className="font-medium">{po.vendor_name}</p>
                </div>

                <div>
                  <p className="text-gray-500">GST Number</p>
                  <p className="font-medium">{po.vendor_gst || "-"}</p>
                </div>

                <div>
                  <p className="text-gray-500">Contact Person</p>
                  <p className="font-medium">{po.contact_person || "-"}</p>
                </div>

                <div>
                  <p className="text-gray-500">Email</p>
                  <p className="font-medium">{po.contact_email || "-"}</p>
                </div>

                <div>
                  <p className="text-gray-500">Phone</p>
                  <p className="font-medium">{po.contact_phone || "-"}</p>
                </div>

                <div>
                  <p className="text-gray-500">State Code</p>
                  <p className="font-medium">{po.vendor_state_code || "-"}</p>
                </div>

              </div>
            </div>

            {/* Quotation Information */}
            <div>
              <h4 className="text-sm font-semibold text-slate-600 uppercase mb-3">Quotation Reference</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">

                <div>
                  <p className="text-gray-500">Quotation Number</p>
                  <p className="font-medium font-mono text-amber-700 bg-amber-50 px-3 py-2 rounded">
                    {po.vendor_quote_no || <span className="text-gray-400">—</span>}
                  </p>
                </div>

                <div>
                  <p className="text-gray-500">Quotation Date</p>
                  <p className="font-medium">{po.vendor_quote_date ? new Date(po.vendor_quote_date).toLocaleDateString() : "-"}</p>
                </div>

                <div>
                  <p className="text-gray-500">Payment Terms</p>
                  <p className="font-medium">{po.payment_terms || "-"}</p>
                </div>

                <div>
                  <p className="text-gray-500">Delivery Date</p>
                  <p className="font-medium">{po.delivery_date ? new Date(po.delivery_date).toLocaleDateString() : "-"}</p>
                </div>

                {po.remarks && (
                  <div className="col-span-2">
                    <p className="text-gray-500">Remarks</p>
                    <p className="font-medium text-sm bg-slate-50 p-3 rounded border border-slate-200 whitespace-pre-wrap">
                      {po.remarks}
                    </p>
                  </div>
                )}

              </div>
            </div>
          </div>

          {/* ====== TERMS & CONDITIONS SECTION ====== */}
          {po?.terms_snapshot && (
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm mb-8 overflow-hidden">

              <div className="border-b border-slate-200 p-6 bg-gradient-to-r from-slate-50 to-slate-100">
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  📜 Terms & Conditions
                </h2>
              </div>

              <div className="p-6">
                <div className="text-sm text-slate-700 leading-relaxed space-y-2">

                  {po.terms_snapshot.split("\n").map((line: string, index: number) => (
                    <p key={index}>• {line}</p>
                  ))}

                </div>
              </div>

            </div>

          )}


          {/* ====== FINANCIAL SUMMARY SECTION ====== */}
          {po?.items && po.items.length > 0 && (
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm mb-8 overflow-hidden">
              <div className="border-b border-slate-200 p-6 bg-gradient-to-r from-green-50 to-emerald-50">
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <DollarSign className="text-green-600" size={24} />
                  Financial Summary
                </h2>
              </div>

              <div className="p-6">
                {/* Products Table */}
                <div className="mb-8 overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Product</th>
                        <th className="px-6 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Quantity</th>
                        <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Unit Price</th>
                        <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Line Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {po.items.map((item: POItem) => (
                        <tr key={item.id} className="hover:bg-slate-50 transition">
                          <td className="px-6 py-4">
                            <div>
                              <p className="font-semibold text-slate-900">{item.product_name}</p>
                              <p className="text-sm text-slate-600 mt-1">{item.product_description || "-"}</p>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center font-semibold text-slate-900">
                            {item.ordered_qty} {item.uom || "NOS"}
                          </td>
                          <td className="px-6 py-4 text-right font-semibold text-slate-900">
                            ₹{Number(item.unit_price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-6 py-4 text-right font-bold text-slate-900">
                            ₹{Number(item.line_total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Financial Calculations */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Left Side - Calculation Details */}
                  <div className="space-y-4">
                    <div className="border border-slate-200 rounded-lg p-4 space-y-4">
                      {/* Subtotal */}
                      <div className="flex justify-between items-center pb-3 border-b border-slate-200">
                        <span className="text-slate-700 font-medium">Subtotal</span>
                        <span className="text-slate-900 font-bold">
                          ₹{(() => {
                            const subtotal = po.items.reduce((sum: number, item: POItem) =>
                              sum + Number(item.line_total || 0), 0
                            );
                            return subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 });
                          })()}
                        </span>
                      </div>

                      {/* Discount */}
                      {po.discount_percentage > 0 && (
                        <div className="flex justify-between items-center pb-3 border-b border-slate-200">
                          <span className="text-slate-700 font-medium">
                            Discount ({po.discount_percentage}%)
                          </span>
                          <span className="text-red-600 font-bold">
                            -₹{(() => {
                              const subtotal = po.items.reduce((sum: number, item: POItem) =>
                                sum + Number(item.line_total || 0), 0
                              );
                              const discount = subtotal * (po.discount_percentage / 100);
                              return discount.toLocaleString('en-IN', { minimumFractionDigits: 2 });
                            })()}
                          </span>
                        </div>
                      )}

                      {/* Subtotal After Discount */}
                      <div className="flex justify-between items-center pb-3 border-b border-slate-200">
                        <span className="text-slate-700 font-medium">Subtotal After Discount</span>
                        <span className="text-slate-900 font-bold">
                          ₹{(() => {
                            const subtotal = po.items.reduce((sum: number, item: POItem) =>
                              sum + Number(item.line_total || 0), 0
                            );
                            const discount = subtotal * (po.discount_percentage / 100);
                            const subtotalAfterDiscount = subtotal - discount;
                            return subtotalAfterDiscount.toLocaleString('en-IN', { minimumFractionDigits: 2 });
                          })()}
                        </span>
                      </div>

                      {/* GST */}
                      <div className="flex justify-between items-center pb-3 border-b border-slate-200">
                        <span className="text-slate-700 font-medium">
                          GST ({po.gst_rate || 18}%)
                        </span>
                        <span className="text-blue-600 font-bold">
                          ₹{(() => {
                            const subtotal = po.items.reduce((sum: number, item: POItem) =>
                              sum + Number(item.line_total || 0), 0
                            );
                            const discount = subtotal * (po.discount_percentage / 100);
                            const subtotalAfterDiscount = subtotal - discount;
                            const gst = subtotalAfterDiscount * ((po.gst_rate || 18) / 100);
                            return gst.toLocaleString('en-IN', { minimumFractionDigits: 2 });
                          })()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right Side - Grand Total */}
                  <div className="flex flex-col justify-between">
                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-lg p-6">
                      <p className="text-sm text-slate-600 font-semibold uppercase mb-2">Grand Total</p>
                      <p className="text-4xl font-bold text-green-600 mb-4">
                        ₹{(() => {
                          const subtotal = po.items.reduce((sum: number, item: POItem) =>
                            sum + Number(item.line_total || 0), 0
                          );
                          const discount = subtotal * (po.discount_percentage / 100);
                          const subtotalAfterDiscount = subtotal - discount;
                          const gst = subtotalAfterDiscount * ((po.gst_rate || 18) / 100);
                          const total = subtotalAfterDiscount + gst;
                          return total.toLocaleString('en-IN', { minimumFractionDigits: 2 });
                        })()}
                      </p>
                      <div className="text-xs text-slate-600 space-y-1">
                        <p>✓ Includes GST @ {po.gst_rate || 18}%</p>
                        {po.discount_percentage > 0 && (
                          <p>✓ Discount applied: {po.discount_percentage}%</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ====== STATUS TIMELINE SECTION ====== */}
          {po?.status && <POStatusTimeline status={po.status} />}
        </div>
      </div>

      {/* ====== RECEIVE QUANTITY MODAL ====== */}
      {modal.item && (
        <ReceiveQuantityModal
          isOpen={modal.isOpen}
          onClose={handleCloseModal}
          onSubmit={handleReceiveSubmit}
          productName={modal.item.product_name}
          ordered={Number(modal.item.ordered_qty || 0)}
          received={Number(modal.item.received_qty || 0)}
          remaining={Math.max(0, Number(modal.item.ordered_qty || 0) - Number(modal.item.received_qty || 0))}
          isLoading={isLoading}
        />
      )}

      {/* ====== CLOSE PO MODAL ====== */}
      <ClosePoModal
        isOpen={closeModal}
        poNumber={po?.po_number || ""}
        onClose={() => setCloseModal(false)}
        onSubmit={handleClosePO}
        isLoading={isLoading}
      />
    </Layout>
  );
}