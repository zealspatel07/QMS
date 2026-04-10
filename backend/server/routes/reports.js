// server/routes/reports.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const authMiddleware = require("../middleware/auth");

const latestDecisionJoin = `
LEFT JOIN (
  SELECT d.quotation_id, d.decision, d.decided_at
  FROM quotation_decisions d
  JOIN (
    SELECT quotation_id, MAX(decided_at) latest
    FROM quotation_decisions
    GROUP BY quotation_id
  ) x
    ON x.quotation_id = d.quotation_id
   AND x.latest = d.decided_at
) ld ON ld.quotation_id = q.id
`;

/* ================= KPI ================= */
router.get("/kpis", authMiddleware, async (req, res) => {
  let conn;
  try {
    conn = await db.getConnection();

    const [[totals]] = await conn.query(`
  SELECT 
    COUNT(q.id) AS total_quotations,
    SUM(ld.decision = 'won') AS won,
    SUM(ld.decision = 'lost') AS lost,
    SUM(ld.decision IS NULL) AS pending,
    SUM(CASE WHEN ld.decision = 'won' THEN q.total_value ELSE 0 END) AS total_value,
    AVG(CASE WHEN ld.decision = 'won' THEN q.total_value END) AS avg_deal_size
  FROM quotations q
  ${latestDecisionJoin}
  WHERE q.is_deleted = 0
`);

    const win_rate =
      totals.total_quotations > 0
        ? Number(((totals.won / totals.total_quotations) * 100).toFixed(1))
        : 0;

    res.json({ ...totals, win_rate });
  } catch (err) {
    console.error("KPI report error:", err);
    res.status(500).json({ error: "report_kpi_failed" });
  } finally {
    if (conn) conn.release();
  }
});

/* ================= SALES PERFORMANCE ================= */
router.get("/sales-performance", authMiddleware, async (req, res) => {
  let conn;
  try {
    conn = await db.getConnection();

    const [rows] = await conn.query(`
      SELECT
  u.id AS user_id,
  u.name,
  COUNT(q.id) AS total_quotations,
  SUM(ld.decision = 'won') AS won,
  SUM(ld.decision = 'lost') AS lost,
  ROUND(
    SUM(ld.decision = 'won') / NULLIF(COUNT(q.id), 0) * 100,
    1
  ) AS win_rate,
  SUM(CASE WHEN ld.decision = 'won' THEN q.total_value ELSE 0 END) AS revenue
FROM users u
LEFT JOIN quotations q
  ON q.salesperson_id = u.id AND q.is_deleted = 0
${latestDecisionJoin}
GROUP BY u.id
    `);

    res.json({ data: rows });
  } catch (err) {
    console.error("Sales performance report error:", err);
    res.status(500).json({ error: "sales_performance_failed" });
  } finally {
    if (conn) conn.release();
  }
});

/* ================= CUSTOMER REPORT ================= */
router.get("/customers", authMiddleware, async (req, res) => {
  let conn;
  try {
    conn = await db.getConnection();

    const [rows] = await conn.query(`
     SELECT
  c.id,
  c.company_name,
  COUNT(q.id) AS quotations,
  SUM(ld.decision = 'won') AS won,
  SUM(CASE WHEN ld.decision = 'won' THEN q.total_value ELSE 0 END) AS revenue,
  MAX(ld.decided_at) AS last_deal
FROM customers c
LEFT JOIN quotations q
  ON q.customer_id = c.id AND q.is_deleted = 0
${latestDecisionJoin}
GROUP BY c.id
    `);

    res.json({ data: rows });
  } catch (err) {
    console.error("Customer report error:", err);
    res.status(500).json({ error: "customer_report_failed" });
  } finally {
    if (conn) conn.release();
  }
});

/* ================= PRODUCT REPORT ================= */
router.get("/products", authMiddleware, async (req, res) => {
  let conn;
  try {
    conn = await db.getConnection();

    const [rows] = await conn.query(`
      SELECT
  jt.product_name AS name,
  SUM(jt.qty) AS quantity,
  SUM(jt.qty * jt.unit_price) AS revenue
FROM quotations q
${latestDecisionJoin}
JOIN JSON_TABLE(
  q.items,
  '$[*]' COLUMNS (
    product_name VARCHAR(255) PATH '$.product_name',
    qty INT PATH '$.qty',
    unit_price DECIMAL(10,2) PATH '$.unit_price'
  )
) jt
WHERE ld.decision = 'won'
  AND q.is_deleted = 0
GROUP BY jt.product_name
ORDER BY revenue DESC
    `);

    res.json({ data: rows });
  } catch (err) {
    console.error("Product report error:", err);
    res.status(500).json({ error: "product_report_failed" });
  } finally {
    if (conn) conn.release();
  }
});
/* ================= PIPELINE ================= */
router.get("/pipeline", authMiddleware, async (req, res) => {
  let conn;
  try {
    conn = await db.getConnection();

    const [rows] = await conn.query(`
      SELECT
  COALESCE(ld.decision, 'pending') AS status,
  COUNT(*) AS count,
  SUM(q.total_value) AS value
FROM quotations q
${latestDecisionJoin}
WHERE q.is_deleted = 0
GROUP BY COALESCE(ld.decision, 'pending')
    `);

    res.json({ data: rows });
  } catch (err) {
    console.error("Pipeline report error:", err);
    res.status(500).json({ error: "pipeline_report_failed" });
  } finally {
    if (conn) conn.release();
  }
});

/* ================= TIMESERIES ================= */
router.get("/timeseries", authMiddleware, async (req, res) => {
  let conn;
  try {
    const range = req.query.range || "month"; // week | month | quarter | year
    conn = await db.getConnection();

    // Defaults
    let intervalMonths = 6;

    if (range === "week") intervalMonths = 1;
    if (range === "quarter") intervalMonths = 12;
    if (range === "year") intervalMonths = 36;

    const [rows] = await conn.query(
      `
      SELECT
        DATE_FORMAT(q.created_at, '%Y-%m') AS period,
        COUNT(q.id) AS deals,
        SUM(ld.decision = 'won') AS won,
        SUM(
          CASE
            WHEN ld.decision = 'won' THEN q.total_value
            ELSE 0
          END
        ) AS revenue
      FROM quotations q
      ${latestDecisionJoin}
      WHERE q.is_deleted = 0
        AND q.created_at >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
      GROUP BY period
      ORDER BY period
      `,
      [intervalMonths]
    );

    res.json({ data: rows });
  } catch (err) {
    console.error("Timeseries error:", err);
    res.status(500).json({ error: "timeseries_failed" });
  } finally {
    if (conn) conn.release();
  }
});


/* ================= USER METRICS ================= */
/* ================= USER METRICS ================= */
router.get("/user-metrics", authMiddleware, async (req, res) => {
  let conn;
  try {
    const userId = req.user.id;
    conn = await db.getConnection();

    const [[row]] = await conn.query(
      `
      SELECT
        COUNT(q.id) AS total_quotations,

        -- authoritative decision counts
        SUM(ld.decision = 'won')  AS won,
        SUM(ld.decision = 'lost') AS lost,

        -- revenue metrics
        SUM(
          CASE
            WHEN ld.decision = 'won' THEN q.total_value
            ELSE 0
          END
        ) AS total_revenue,

        AVG(
          CASE
            WHEN ld.decision = 'won' THEN q.total_value
            ELSE NULL
          END
        ) AS avg_deal_size,

        -- THIS MONTH (uses decided_at, not created_at)
        SUM(
          ld.decision = 'won'
          AND ld.decided_at >= DATE_FORMAT(CURRENT_DATE, '%Y-%m-01')
        ) AS deals_closed_this_month,

        SUM(
          CASE
            WHEN ld.decision = 'won'
             AND ld.decided_at >= DATE_FORMAT(CURRENT_DATE, '%Y-%m-01')
            THEN q.total_value
            ELSE 0
          END
        ) AS revenue_this_month

      FROM quotations q
      ${latestDecisionJoin}
      WHERE q.salesperson_id = ?
        AND q.is_deleted = 0
      `,
      [userId]
    );

    const conversion_rate =
      row.total_quotations > 0
        ? Number(((row.won / row.total_quotations) * 100).toFixed(1))
        : 0;

    res.json({
      total_quotations: row.total_quotations,
      won: row.won,
      lost: row.lost,
      pending:
        row.total_quotations - (row.won + row.lost),
      total_revenue: row.total_revenue || 0,
      avg_deal_size: row.avg_deal_size || 0,
      deals_closed_this_month: row.deals_closed_this_month || 0,
      revenue_this_month: row.revenue_this_month || 0,
      conversion_rate,
    });
  } catch (err) {
    console.error("user-metrics error:", err);
    res.status(500).json({ error: "user_metrics_failed" });
  } finally {
    if (conn) conn.release();
  }
});


module.exports = router;
