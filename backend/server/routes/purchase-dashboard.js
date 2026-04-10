const express = require("express");
const router = express.Router();
const db = require("../db");

/* ============================================
   PURCHASE DASHBOARD SUMMARY
   GET /api/dashboard/purchase-summary
   ============================================ */
router.get("/purchase-summary", async (req, res) => {
    let conn;
    try {
        conn = await db.getConnection();

        const [[summary]] = await conn.query(
            `SELECT
        SUM(CASE WHEN i.status IN ('submitted') THEN 1 ELSE 0 END) as pending_indents,
        SUM(CASE WHEN i.status IN ('approved') THEN 1 ELSE 0 END) as approved_indents,
        (SELECT COUNT(*) FROM purchase_orders WHERE status IN ('created', 'ordered', 'in_transit', 'partial')) as open_pos,
        (SELECT COUNT(*) FROM purchase_orders WHERE status IN ('delivered', 'completed')) as delivered_pos,
        (SELECT COUNT(*) FROM vendors WHERE is_active = 1) as active_vendors,
        (SELECT COUNT(DISTINCT product_name) FROM po_items) as products_ordered,
        COALESCE((SELECT SUM(line_total) FROM po_items pi WHERE DATE(pi.created_at) >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH)), 0) as procurement_value
      FROM indents i
      WHERE DATE(i.created_at) >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH)`
        );

        res.json(summary || {});
    } catch (err) {
        console.error("Purchase summary error:", err);
        res.status(500).json({ error: "Failed to fetch purchase summary" });
    } finally {
        if (conn) conn.release();
    }
});

/* ============================================
   PENDING INDENTS (REQUIRING PO CREATION)
   GET /api/dashboard/pending-indents
   ============================================ */
router.get("/pending-indents", async (req, res) => {
    let conn;
    try {
        conn = await db.getConnection();

        const [rows] = await conn.query(
            `SELECT 
        i.id,
        i.indent_number,
        i.customer_name,
        i.indent_date,
        i.created_by_name,
        COUNT(DISTINCT ii.id) as item_count,
        COALESCE(SUM(ii.quantity), 0) as total_qty,
        COUNT(DISTINCT CASE WHEN po_ii.id IS NOT NULL THEN ii.id END) as items_with_po,
        COUNT(DISTINCT ii.id) - COUNT(DISTINCT CASE WHEN po_ii.id IS NOT NULL THEN ii.id END) as items_without_po
      FROM indents i
      LEFT JOIN indent_items ii ON ii.indent_id = i.id
      LEFT JOIN po_items po_ii ON po_ii.indent_item_id = ii.id
      WHERE i.status IN ('submitted', 'approved')
      GROUP BY i.id
      HAVING items_without_po > 0
      ORDER BY i.indent_date DESC
      LIMIT 20`
        );

        res.json(rows || []);
    } catch (err) {
        console.error("Pending indents error:", err);
        res.status(500).json({ error: "Failed to fetch pending indents" });
    } finally {
        if (conn) conn.release();
    }
});

/* ============================================
   OPEN PURCHASE ORDERS
   GET /api/dashboard/open-pos
   ============================================ */
router.get("/open-pos", async (req, res) => {
    let conn;
    try {
        conn = await db.getConnection();

        const [rows] = await conn.query(
            `SELECT 
        po.id,
        po.po_number,
        po.vendor_name,
        po.status,
        po.created_at as order_date,
        DATE_ADD(po.created_at, INTERVAL 7 DAY) as expected_delivery_date,
        COUNT(DISTINCT pi.product_name) as item_count,
        COALESCE(SUM(pi.line_total), 0) as total_value
      FROM purchase_orders po
      LEFT JOIN po_items pi ON pi.po_id = po.id
      WHERE po.status IN ('created', 'ordered', 'in_transit', 'partial')
      GROUP BY po.id
      ORDER BY po.created_at DESC
      LIMIT 20`
        );

        res.json(rows || []);
    } catch (err) {
        console.error("Open POs error:", err);
        res.status(500).json({ error: "Failed to fetch open purchase orders" });
    } finally {
        if (conn) conn.release();
    }
});

/* ============================================
   VENDOR ACTIVITY (TOP VENDORS THIS MONTH)
   GET /api/dashboard/vendor-activity
   ============================================ */
router.get("/vendor-activity", async (req, res) => {
    let conn;
    try {
        conn = await db.getConnection();

        const [rows] = await conn.query(
            `SELECT 
        v.id,
        v.name,
        COUNT(DISTINCT po.id) as order_count,
        COALESCE(SUM(pi.line_total), 0) as total_value
      FROM vendors v
      LEFT JOIN po_items pi ON pi.vendor_id = v.id
      LEFT JOIN purchase_orders po ON po.id = pi.po_id
        AND DATE(po.created_at) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      WHERE v.is_active = 1
      GROUP BY v.id
      ORDER BY order_count DESC
      LIMIT 10`
        );

        res.json(rows || []);
    } catch (err) {
        console.error("Vendor activity error:", err);
        res.status(500).json({ error: "Failed to fetch vendor activity" });
    } finally {
        if (conn) conn.release();
    }
});

/* ============================================
   DELIVERY ALERTS
   GET /api/dashboard/delivery-alerts
   ============================================ */
router.get("/delivery-alerts", async (req, res) => {
    let conn;
    try {
        conn = await db.getConnection();

        const [rows] = await conn.query(
            `SELECT 
        po.id,
        po.po_number,
        GROUP_CONCAT(DISTINCT v.name SEPARATOR ', ') as vendor_name,
        po.status,
        DATE_ADD(po.created_at, INTERVAL 7 DAY) as expected_delivery_date,
        'on_track' as alert_type
      FROM purchase_orders po
      LEFT JOIN po_items pi ON pi.po_id = po.id
      LEFT JOIN vendors v ON pi.vendor_id = v.id
      WHERE po.status IN ('created', 'ordered', 'in_transit', 'partial')
      GROUP BY po.id
      ORDER BY po.created_at DESC
      LIMIT 20`
        );

        res.json(rows || []);
    } catch (err) {
        console.error("Delivery alerts error:", err);
        res.status(500).json({ error: "Failed to fetch delivery alerts" });
    } finally {
        if (conn) conn.release();
    }
});

/* ============================================
   PROCUREMENT VALUE (MONTHLY TREND)
   GET /api/dashboard/procurement-value
   ============================================ */
router.get("/procurement-value", async (req, res) => {
    let conn;
    try {
        conn = await db.getConnection();

        const [rows] = await conn.query(
            `SELECT
  DATE_FORMAT(po.created_at, '%Y-%m') AS month,
  DATE_FORMAT(MIN(po.created_at), '%b %Y') AS month_label,
  COALESCE(SUM(pi.line_total), 0) AS value
FROM purchase_orders po
LEFT JOIN po_items pi ON pi.po_id = po.id
WHERE po.created_at >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
GROUP BY DATE_FORMAT(po.created_at, '%Y-%m')
ORDER BY month ASC`
        );

        res.json(rows || []);
    } catch (err) {
        console.error("Procurement value error:", err);
        res.status(500).json({ error: "Failed to fetch procurement value" });
    } finally {
        if (conn) conn.release();
    }
});

module.exports = router;