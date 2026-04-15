function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmt(n) {
  const amount = Number(n || 0);
  return "₹" + amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d) {
  if (!d) return "—";
  const date = new Date(d);
  return isNaN(date.getTime()) ? "—" : date.toLocaleDateString("en-GB");
}

module.exports = function buildInvoiceHtml(invoice) {
  const customer = invoice.customer_snapshot || {};
  const items = Array.isArray(invoice.items) ? invoice.items : [];

  // Calculate totals
  let subtotal = 0;
  let totalGst = 0;
  const gstByRate = {};

  const rowsHtml = items
    .map((item, idx) => {
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
  <td style="padding: 8px; border: 1px solid #000; text-align: center;">${idx + 1}</td>
  <td style="padding: 8px; border: 1px solid #000;">
    <div style="font-weight: bold;">${esc(item.product_name || "Product")}</div>
    ${item.description ? `<div style="font-size: 9px; color: #666;">${esc(item.description)}</div>` : ""}
    <div style="font-size: 9px; color: #999;">HSN: ${esc(item.hsn_code || "-")}</div>
  </td>
  <td style="padding: 8px; border: 1px solid #000; text-align: center;">${qty.toFixed(2)}</td>
  <td style="padding: 8px; border: 1px solid #000; text-align: center;">${esc(item.uom || "NOS")}</td>
  <td style="padding: 8px; border: 1px solid #000; text-align: right;">${fmt(rate)}</td>
  <td style="padding: 8px; border: 1px solid #000; text-align: right;">${fmt(taxable)}</td>
  <td style="padding: 8px; border: 1px solid #000; text-align: center;">${taxRate.toFixed(2)}%</td>
  <td style="padding: 8px; border: 1px solid #000; text-align: right;">${fmt(gst)}</td>
  <td style="padding: 8px; border: 1px solid #000; text-align: right;">${fmt(total)}</td>
</tr>`;
    })
    .join("");

  const gstBreakdownHtml = Object.entries(gstByRate)
    .map(
      ([rate, values]) => `
<tr>
  <td colspan="6" style="padding: 6px; border: 1px solid #000; text-align: right;"><strong>GST @ ${rate}</strong></td>
  <td style="padding: 6px; border: 1px solid #000; text-align: right;">${fmt(values.taxable)}</td>
  <td style="padding: 6px; border: 1px solid #000; text-align: right;">${fmt(values.gst)}</td>
</tr>`
    )
    .join("");

  const grandTotal = subtotal + totalGst - (invoice?.total_discount || 0);
  const balanceDue = Number(invoice?.total_amount || 0) - Number(invoice?.amount_paid || 0);

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${esc(invoice.invoice_no)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page { size: A4; margin: 10mm; }
    body { font-family: Arial, sans-serif; font-size: 11px; color: #000; line-height: 1.3; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
    
    .header-table { margin-bottom: 10px; }
    .header-table td { padding: 8px; vertical-align: top; }
    .company-header { border: 2px solid #000; }
    .company-header .left { border-right: 2px solid #000; width: 35%; }
    .company-header .right { padding-left: 10px; }
    .company-name { font-weight: bold; font-size: 13px; margin-bottom: 2px; }
    .company-details { font-size: 9px; line-height: 1.3; }
    
    .title { text-align: center; font-size: 14px; font-weight: bold; margin: 8px 0; }
    
    .info-table { margin-bottom: 10px; }
    .info-table td { border: 1px solid #000; padding: 6px; font-size: 10px; }
    .info-label { font-weight: bold; background: #f5f5f5; width: 25%; }
    .info-value { }
    
    .party-table { margin-bottom: 10px; }
    .party-table td { border: 1px solid #000; padding: 6px; font-size: 10px; width: 50%; }
    .party-title { font-weight: bold; background: #f5f5f5; }
    
    .items-table { margin-bottom: 10px; }
    .items-table th { background: #000; color: #fff; border: 1px solid #000; padding: 6px; text-align: center; font-size: 10px; font-weight: bold; }
    .items-table td { border: 1px solid #000; padding: 6px; font-size: 10px; }
    .items-table .text-center { text-align: center; }
    .items-table .text-right { text-align: right; }
    .items-table .num-col { text-align: center; width: 5%; }
    .items-table .desc-col { width: 30%; }
    .items-table .qty-col { width: 8%; }
    .items-table .uom-col { width: 8%; }
    .items-table .amt-col { width: 11%; }
    
    .summary-section { margin-bottom: 10px; float: right; width: 55%; }
    .summary-table { margin: 0; }
    .summary-table td { border: 1px solid #000; padding: 5px; font-size: 10px; }
    .summary-label { font-weight: bold; text-align: right; width: 60%; }
    .summary-value { text-align: right; width: 40%; }
    .total-row { background: #000; color: #fff; font-weight: bold; }
    .total-row td { border-color: #000; }
    
    .notes-table { clear: both; margin-bottom: 8px; }
    .notes-table td { border: 1px solid #000; padding: 6px; font-size: 9px; width: 50%; }
    .notes-title { font-weight: bold; background: #f5f5f5; }
    
    .footer-table { margin-top: 15px; }
    .footer-table td { padding: 8px; font-size: 9px; vertical-align: top; }
    .sig-line { border-top: 1px solid #000; height: 35px; text-align: center; padding-top: 25px; }
  </style>
</head>
<body>

<!-- HEADER -->
<table class="header-table">
  <tr>
    <td class="company-header">
      <div class="left" style="border-right: 2px solid #000; padding-right: 8px;">
        <div style="font-weight: bold; font-size: 12px;">PRAYOSHA<br/>AUTOMATION</div>
      </div>
    </td>
    <td class="company-header right">
      <div class="company-name">PRAYOSHA AUTOMATION PRIVATE LIMITED</div>
      <div class="company-details">
        Third Floor, 28, Samravy Sequence, Opp. Ambe School, Manjalpur, Vadodara - 390011<br/>
        Ph: +91-265-2633635 | Email: sales@prayosha.net.in<br/>
        GSTIN: 24AALCP3186E1ZD | Website: www.prayosha.net.in
      </div>
    </td>
  </tr>
</table>

<div class="title">TAX INVOICE</div>

<!-- INVOICE INFO -->
<table class="info-table">
  <tr>
    <td class="info-label">Invoice No.:</td>
    <td class="info-value">${esc(invoice.invoice_no || "-")}</td>
    <td class="info-label">Sales Order:</td>
    <td class="info-value">${esc(invoice.so_number || "-")}</td>
    <td class="info-label">Currency:</td>
    <td class="info-value">${invoice?.currency || "INR"}</td>
  </tr>
  <tr>
    <td class="info-label">Date:</td>
    <td class="info-value">${fmtDate(invoice.invoice_date)}</td>
    <td class="info-label">Dispatch:</td>
    <td class="info-value">${esc(invoice.dispatch_no || "-")}</td>
    <td class="info-label">Payment Status:</td>
    <td class="info-value">${(invoice?.payment_status || "-").toUpperCase()}</td>
  </tr>
  <tr>
    <td class="info-label">Due Date:</td>
    <td class="info-value">${fmtDate(invoice.due_date)}</td>
    <td class="info-label">Status:</td>
    <td class="info-value">${(invoice?.status || "-").toUpperCase()}</td>
    <td class="info-label">Balance Due:</td>
    <td class="info-value">${fmt(balanceDue)}</td>
  </tr>
</table>

<!-- PARTY DETAILS -->
<table class="party-table">
  <tr>
    <td>
      <div class="party-title">Bill To (Customer)</div>
      <strong>${esc(customer.company_name || "-")}</strong><br/>
      ${customer.location_name ? `${esc(customer.location_name)}<br/>` : ""}
      ${customer.address ? `${esc(customer.address)}<br/>` : ""}
      <strong>GSTIN:</strong> ${esc(customer.gstin || "-")}<br/>
      <strong>Contact:</strong> ${esc(customer.contact_name || "-")}<br/>
      <strong>Phone:</strong> ${esc(customer.phone || "-")}<br/>
      <strong>Email:</strong> ${esc(customer.email || "-")}
    </td>
    <td>
      <div class="party-title">Ship To / Delivery</div>
      <strong>${esc(customer.company_name || "-")}</strong><br/>
      ${customer.location_name ? `${esc(customer.location_name)}<br/>` : ""}
      ${customer.address ? `${esc(customer.address)}<br/>` : ""}
      <strong>GSTIN:</strong> ${esc(customer.gstin || "-")}
    </td>
  </tr>
</table>

<!-- ITEMS TABLE -->
<table class="items-table">
  <thead>
    <tr>
      <th class="num-col">#</th>
      <th class="desc-col">Item Description</th>
      <th class="qty-col">Qty</th>
      <th class="uom-col">UOM</th>
      <th class="amt-col">Rate</th>
      <th class="amt-col">Taxable</th>
      <th class="amt-col">Tax %</th>
      <th class="amt-col">Tax Amt</th>
      <th class="amt-col">Amount</th>
    </tr>
  </thead>
  <tbody>
    ${rowsHtml}
  </tbody>
</table>

<!-- SUMMARY SECTION -->
<div class="summary-section">
  <table class="summary-table">
    <tr>
      <td class="summary-label">Subtotal (Taxable)</td>
      <td class="summary-value">${fmt(subtotal)}</td>
    </tr>
    ${gstBreakdownHtml}
    ${invoice?.total_discount ? `<tr>
      <td class="summary-label">Discount</td>
      <td class="summary-value">- ${fmt(invoice.total_discount)}</td>
    </tr>` : ""}
    <tr>
      <td class="summary-label">Total GST</td>
      <td class="summary-value">${fmt(totalGst)}</td>
    </tr>
    <tr class="total-row">
      <td class="summary-label">GRAND TOTAL</td>
      <td class="summary-value">${fmt(grandTotal)}</td>
    </tr>
    ${invoice?.amount_paid ? `<tr>
      <td class="summary-label">Amount Paid</td>
      <td class="summary-value">${fmt(invoice.amount_paid)}</td>
    </tr>` : ""}
    <tr>
      <td class="summary-label">Balance Due</td>
      <td class="summary-value">${fmt(balanceDue)}</td>
    </tr>
  </table>
</div>

<!-- NOTES -->
<table class="notes-table" style="clear: both;">
  <tr>
    <td>
      <div class="notes-title">Notes</div>
      ${invoice?.notes ? `<div>${esc(invoice.notes).replace(/\n/g, "<br>")}<br/>Invoice for dispatch ${esc(invoice.dispatch_no)}</div>` : `<div>Invoice for dispatch ${esc(invoice.dispatch_no)}</div>`}
    </td>
    <td>
      <div class="notes-title"></div>
    </td>
  </tr>
</table>

<!-- FOOTER -->
<table class="footer-table">
  <tr>
    <td style="width: 60%;">
      <div style="font-size: 8px;">System generated invoice. No signature required.</div>
    </td>
    <td style="width: 40%; text-align: right;">
      <div>For PRAYOSHA AUTOMATION PRIVATE LIMITED</div>
      <div class="sig-line">Authorised Signatory</div>
    </td>
  </tr>
</table>

</body>
</html>`;

  return html;
};