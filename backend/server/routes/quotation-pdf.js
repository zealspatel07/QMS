// quotation-pdf.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const renderPdf = require('../pdf/renderQuotationPdf');
const buildHtml = require('../pdf/buildQuotationHtml');

// Helper function to format totals
const calculateTotals = (items) => {
  let subtotal = 0;
  let tax = 0;
  
  items.forEach(item => {
    const qty = parseFloat(item.qty || item.quantity || 0);
    const rate = parseFloat(item.unit_price || item.rate || 0);
    const lineTotal = qty * rate;
    subtotal += lineTotal;
    
    // Calculate tax if GST rate is available
    if (item.gst_rate) {
      tax += (lineTotal * parseFloat(item.gst_rate)) / 100;
    }
  });
  
  return { subtotal, tax, total: subtotal + tax };
};

/**
 * GET /api/quotations/:id/pdf
 * Renders a quotation as PDF
 */
router.get('/:id/pdf', async (req, res) => {
  let conn;
  try {
    const id = req.params.id;

    conn = await db.getConnection();
    const [rows] = await conn.query(
      'SELECT * FROM quotations WHERE id = ? AND is_deleted = 0',
      [id]
    );

    if (!rows.length) {
      conn.release();
      return res.status(404).json({ error: 'Quotation not found' });
    }

    const q = rows[0];
    q.items = JSON.parse(q.items || '[]');
    
    // Calculate totals
    const totals = calculateTotals(q.items);
    q.subtotal_value = totals.subtotal;
    q.tax_value = totals.tax;
    q.total_value = totals.total;

    const html = buildHtml(q);
    const pdf = await renderPdf(html);

    const filename = `${q.quotation_no}_v${q.version}.pdf`.replace(/[\/\\]/g, '_');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdf);
  } catch (err) {
    console.error('Quotation PDF error:', err);
    res.status(500).json({ error: 'PDF generation failed', details: err.message });
  } finally {
    if (conn) conn.release();
  }
});

/**
 * GET /api/quotations/po/:id/pdf
 * Renders a purchase order as PDF
 */
router.get('/po/:id/pdf', async (req, res) => {
  let conn;
  try {
    const poId = req.params.id;
    console.log(`📄 Generating PO PDF for ID: ${poId}`);

    conn = await db.getConnection();

    // Fetch purchase order
    const [poRows] = await conn.query(
      `SELECT * FROM purchase_orders WHERE id = ?`,
      [poId]
    );

    if (!poRows.length) {
      console.warn(`⚠ PO not found: ${poId}`);
      conn.release();
      return res.status(404).json({ error: 'Purchase order not found' });
    }

    const po = poRows[0];
    console.log(`✓ PO Found:`, {
      po_number: po.po_number,
      vendor_name: po.vendor_name,
      vendor_quote_no: po.vendor_quote_no,
      vendor_quote_date: po.vendor_quote_date,
      delivery_date: po.delivery_date
    });

    // Fetch PO items
    const [itemRows] = await conn.query(
      `SELECT 
        id, 
        product_name, 
        product_description,
        ordered_qty as quantity,
        unit_price,
        line_total
      FROM po_items 
      WHERE po_id = ?`,
      [poId]
    );

    console.log(`✓ Found ${itemRows.length} items for PO`);

    // Format items for HTML builder
    po.items = itemRows.map(item => ({
      product_name: item.product_name,
      product_description: item.product_description,
      description: item.product_description,
      qty: item.quantity,
      quantity: item.quantity,
      unit_price: item.unit_price,
      rate: item.unit_price
    }));

    // Calculate totals
    const totals = calculateTotals(po.items);
    po.subtotal_value = totals.subtotal;
    po.tax_value = totals.tax;
    po.total_value = itemRows.reduce((sum, item) => sum + parseFloat(item.line_total || 0), 0);

    console.log(`✓ Totals calculated:`, { subtotal: po.subtotal_value, tax: po.tax_value, total: po.total_value });

    const html = buildHtml(po);
    const pdf = await renderPdf(html);

    const filename = `${po.po_number}.pdf`.replace(/[\/\\]/g, '_');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdf);

    console.log(`✅ PO PDF generated successfully: ${filename}`);
  } catch (err) {
    console.error('❌ PO PDF error:', err);
    res.status(500).json({ error: 'PDF generation failed', details: err.message });
  } finally {
    if (conn) conn.release();
  }
});

module.exports = router;
