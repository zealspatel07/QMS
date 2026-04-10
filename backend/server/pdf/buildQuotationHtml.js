module.exports = function buildQuotationHtml(q) {
  // Helper function to format date - handles multiple formats
  const formatDate = (date) => {
    if (!date) return '—';
    
    // Handle various date formats
    let d;
    if (typeof date === 'string') {
      // Remove time part if present
      const dateOnly = date.split('T')[0];
      d = new Date(dateOnly + 'T00:00:00Z'); // Add UTC timezone for correct parsing
    } else if (date instanceof Date) {
      d = date;
    } else {
      return '—';
    }
    
    // Check if valid date
    if (isNaN(d.getTime())) return '—';
    
    return d.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  // Helper function to format currency
  const formatCurrency = (value) => {
    if (!value || isNaN(value)) return '₹0.00';
    return '₹' + parseFloat(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Determine if this is a PO or Quotation
  const isPO = q.po_number || q.vendor_name;
  const docType = isPO ? 'Purchase Order' : 'Quotation';
  const docNo = q.po_number || q.quotation_no;

  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
body { font-family: Arial, sans-serif; font-size: 11px; margin: 0; padding: 10px; }
table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
th, td { border: 1px solid #999; padding: 6px; text-align: left; }
th { background: #e8e8e8; font-weight: bold; }
tr.highlight { background: #f5f5f5; }
.header { margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid #333; }
.header-title { font-size: 18px; font-weight: bold; margin: 5px 0; }
.header-info { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 10px; }
.header-box { padding: 8px; border: 1px solid #ddd; background: #fafafa; }
.section-title { font-weight: bold; font-size: 12px; margin-top: 10px; margin-bottom: 5px; background: #e8e8e8; padding: 4px; }
.items-table { margin-top: 10px; }
.items-table th { font-size: 10px; }
.items-table tbody tr td:nth-last-child(2) { background: #2f4f4f10; }
.items-table tbody tr:last-child td { font-weight: bold; }
.bold { font-weight: bold; }
.right { text-align: right; }
.total-row { font-weight: bold; background: #f0f0f0; }
.footer { margin-top: 15px; font-size: 9px; color: #666; }
.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 10px; }
.info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 10px; }
.label { font-weight: bold; color: #333; }
.value { color: #555; }
</style>
</head>

<body>

<!-- HEADER -->
<div class="header">
  <div class="header-title">${docType}</div>
  <div class="header-info">
    <div class="header-box">
      <div class="label">Document No:</div>
      <div class="value">${docNo}</div>
      <div class="label" style="margin-top: 5px;">Date:</div>
      <div class="value">${formatDate(q.created_at || q.order_date)}</div>
    </div>
    <div class="header-box">
      <div class="label">Customer:</div>
      <div class="value">${q.customer_name || 'N/A'}</div>
      ${q.customer_gst ? `<div class="label" style="margin-top: 5px;">GST:</div><div class="value">${q.customer_gst}</div>` : ''}
    </div>
  </div>
</div>

<!-- VENDOR DETAILS (for PO) -->
${isPO ? `
<div class="section-title">VENDOR DETAILS</div>
<table>
<tr>
  <td><span class="label">Name:</span> ${q.vendor_name || 'N/A'}</td>
  <td><span class="label">GST:</span> ${q.vendor_gst || 'N/A'}</td>
  <td><span class="label">State:</span> ${q.vendor_state_code ? q.vendor_state_code.substring(0, 2) : 'N/A'}</td>
</tr>
<tr>
  <td><span class="label">Contact Person:</span> ${q.contact_person || 'N/A'}</td>
  <td><span class="label">Email:</span> ${q.contact_email || 'N/A'}</td>
  <td><span class="label">Phone:</span> ${q.contact_phone || 'N/A'}</td>
</tr>
</table>
` : ''}

<!-- QUOTATION DETAILS (for PO) -->
${isPO && q.vendor_quote_no ? `
<div class="section-title">VENDOR QUOTATION DETAILS</div>
<table>
<tr>
  <td><span class="label">Quote No:</span> ${q.vendor_quote_no || '—'}</td>
  <td><span class="label">Quote Date:</span> ${formatDate(q.vendor_quote_date)}</td>
  <td><span class="label">Payment Terms:</span> ${q.payment_terms || '—'}</td>
  <td><span class="label">Delivery Date:</span> ${formatDate(q.delivery_date)}</td>
</tr>
${q.remarks ? `<tr><td colspan="4"><span class="label">Remarks:</span> ${q.remarks}</td></tr>` : ''}
</table>
` : ''}

<!-- LINE ITEMS -->
<div class="section-title">ITEMS</div>
<table class="items-table">
<thead>
<tr>
  <th style="width: 5%;">#</th>
  <th style="width: 30%;">Description</th>
  <th style="width: 10%; text-align: right;">Qty</th>
  <th style="width: 13%; text-align: right;">HSN/SAC</th>
  <th style="width: 15%; text-align: right;">Rate</th>
  <th style="width: 15%; text-align: right;">Total</th>
</tr>
</thead>
<tbody>
${q.items.map((it, i) => {
  const qty = parseFloat(it.qty || it.quantity || 0);
  const rate = parseFloat(it.unit_price || it.rate || 0);
  const total = qty * rate;
  return `
<tr>
  <td>${i + 1}</td>
  <td>${it.product_name || it.description || ''}</td>
  <td style="text-align: right;">${qty.toFixed(2)}</td>
  <td style="text-align: right;">${it.hsn_code || ''}</td>
  <td style="text-align: right;">${formatCurrency(rate)}</td>
  <td style="text-align: right;">${formatCurrency(total)}</td>
</tr>
`;
}).join('')}

<!-- SUBTOTAL ROW -->
<tr>
  <td>&nbsp;</td>
  <td></td>
  <td></td>
  <td></td>
  <td></td>
  <td style="text-align: right; font-weight: bold;">Sub Total</td>
  <td style="text-align: right;">${formatCurrency(q.subtotal_value || q.total_value || 0)}</td>
</tr>

${q.discount_value > 0 ? `
<!-- DISCOUNT ROW -->
<tr>
  <td></td>
  <td></td>
  <td></td>
  <td></td>
  <td></td>
  <td style="text-align: right; font-weight: bold;">Discount</td>
  <td style="text-align: right;">- ${formatCurrency(q.discount_value)}</td>
</tr>
` : ''}

<!-- TAX ROW -->
<tr>
  <td></td>
  <td></td>
  <td></td>
  <td></td>
  <td></td>
  <td style="text-align: right; font-weight: bold;">Tax (GST)</td>
  <td style="text-align: right;">${formatCurrency(q.tax_value)}</td>
</tr>

<!-- GRAND TOTAL ROW -->
<tr>
  <td></td>
  <td></td>
  <td></td>
  <td></td>
  <td></td>
  <td style="text-align: right; font-weight: bold;">GRAND TOTAL</td>
  <td style="text-align: right; font-weight: bold;">${formatCurrency(q.total_value)}</td>
</tr>
</tbody>
</table>

<!-- FOOTER -->
<div class="footer">
  <p style="margin: 5px 0;">Generated on ${formatDate(new Date())} | Document Type: ${docType}</p>
</div>

</body>
</html>
`;
};
