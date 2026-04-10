const express = require("express");
const router = express.Router();
const db = require("../db");
const authMiddleware = require("../middleware/auth");
const { requireReportAccess } = require("../middleware/authorization");

/* ========================================
   Helpers
======================================== */

function roleFilter(req, alias = "q") {
  if (req.user.role === "admin") return { sql: "", params: [] };
  return {
    sql: `AND ${alias}.salesperson_id = ?`,
    params: [req.user.id],
  };
}

// Check if a table has a specific column in the current database
async function hasColumn(conn, table, column) {
  try {
    const schema =
      process.env.MYSQLDATABASE || process.env.MYSQL_DATABASE || process.env.DB_NAME;
    if (!schema) return false;
    const [rows] = await conn.query(
      `SELECT COUNT(*) AS cnt FROM information_schema.columns WHERE table_schema = ? AND table_name = ? AND column_name = ?`,
      [schema, table, column]
    );
    return Array.isArray(rows) && rows[0] && Number(rows[0].cnt || 0) > 0;
  } catch (e) {
    return false;
  }
}

/* ========================================
   GET /api/dashboard/summary
======================================== */
router.get("/summary", authMiddleware, async (req, res) => {
  let conn;
  try {
    conn = await db.getConnection();
    const role = roleFilter(req);

    const [[summary]] = await conn.query(
      `
      SELECT
  /* ---- STATUS COUNTS ---- */
  SUM(CASE WHEN q.status = 'won' THEN 1 ELSE 0 END) AS won,
  SUM(CASE WHEN q.status = 'lost' THEN 1 ELSE 0 END) AS lost,

  SUM(
    CASE
      WHEN q.status = 'pending'
        AND DATE(
          DATE_ADD(COALESCE(q.validity_start_date, q.quotation_date), INTERVAL q.validity_days DAY)
        ) >= CURDATE() THEN 1
      ELSE 0
    END
  ) AS pending,

  /* ---- REVENUE ---- */
  SUM(
    CASE
      WHEN q.status = 'won' THEN q.total_value
      ELSE 0
    END
  ) AS won_revenue,

  /* ---- VALIDITY ---- */
  /* NOTE: Don't count won/lost as they're closed artifacts */
  SUM(
    CASE
      WHEN q.status NOT IN ('draft', 'won', 'lost')
        AND DATE(
          DATE_ADD(COALESCE(q.validity_start_date, q.quotation_date), INTERVAL q.validity_days DAY)
        ) < CURDATE() THEN 1 ELSE 0
    END
  ) AS expired,

  SUM(
    CASE
      WHEN q.status NOT IN ('draft', 'won', 'lost')
        AND DATE(
          DATE_ADD(COALESCE(q.validity_start_date, q.quotation_date), INTERVAL q.validity_days DAY)
        ) = CURDATE() THEN 1 ELSE 0
    END
  ) AS expiring_today,

  SUM(
    CASE
      WHEN q.status NOT IN ('draft', 'won', 'lost')
        AND DATE(
          DATE_ADD(COALESCE(q.validity_start_date, q.quotation_date), INTERVAL q.validity_days DAY)
        ) BETWEEN DATE_ADD(CURDATE(), INTERVAL 1 DAY) AND DATE_ADD(CURDATE(), INTERVAL 3 DAY) THEN 1 ELSE 0
    END
  ) AS expiring_soon,

  SUM(q.total_value) AS portfolio_value

FROM quotations q
WHERE q.is_deleted = 0
  ${role.sql}
 `,
      role.params
    );

    const [[followups]] = await conn.query(
      `
      SELECT
        SUM(
          CASE
            WHEN DATE(f.next_followup_date) = CURRENT_DATE
                 AND f.is_completed = 0 THEN 1 ELSE 0
          END
        ) AS due_today,

        SUM(
          CASE
            WHEN DATE(f.next_followup_date) < CURRENT_DATE
                 AND f.is_completed = 0 THEN 1 ELSE 0
          END
        ) AS overdue
      FROM quotation_followups f
      INNER JOIN quotations q ON q.id = f.quotation_id
      WHERE q.is_deleted = 0
      ${role.sql}
      `,
      role.params
    );

    res.json({
      ...summary,
      expiring_today: summary.expiring_today,
      expiring_soon: summary.expiring_soon,
      followups_due_today: followups.due_today,
      followups_overdue: followups.overdue,
    });
  } catch (err) {
    console.error("Dashboard summary error:", err);
    res.status(500).json({ error: "Dashboard summary failed" });
  } finally {
    if (conn) conn.release();
  }
});

/* ========================================
   GET /api/dashboard/action-quotations
======================================== */
router.get("/action-quotations", authMiddleware, async (req, res) => {
  let conn;
  try {
    conn = await db.getConnection();
    const role = roleFilter(req);

    const [rows] = await conn.query(
      `
      SELECT
        q.id,
        q.quotation_no,
        COALESCE(
          JSON_UNQUOTE(JSON_EXTRACT(q.customer_snapshot, '$.company_name')),
          c.company_name,
          q.customer_name
        ) AS company_name,

        DATE(
          DATE_ADD(
            COALESCE(q.validity_start_date, q.quotation_date),
            INTERVAL q.validity_days DAY
          )
        ) AS valid_until,

        DATEDIFF(
          DATE(
            DATE_ADD(
              COALESCE(q.validity_start_date, q.quotation_date),
              INTERVAL q.validity_days DAY
            )
          ),
          CURDATE()
        ) AS remaining_days,

        u.name AS salesperson_name,
        MAX(f.created_at) AS last_followup_at,

        CASE
          WHEN COUNT(f.id) = 0 THEN 1 ELSE 0
        END AS no_followup

      FROM quotations q
      INNER JOIN users u ON u.id = q.salesperson_id
      LEFT JOIN quotation_followups f
        ON f.quotation_id = q.id
        AND f.is_completed = 1
        LEFT JOIN customers c ON c.id = q.customer_id

      WHERE q.is_deleted = 0
      AND q.status NOT IN ('draft', 'won', 'lost')
      
      AND DATE(
        DATE_ADD(
          COALESCE(q.validity_start_date, q.quotation_date),
          INTERVAL q.validity_days DAY
        )
      ) >= CURDATE()
      AND DATE(
        DATE_ADD(
          COALESCE(q.validity_start_date, q.quotation_date),
          INTERVAL q.validity_days DAY
        )
      ) <= DATE_ADD(CURDATE(), INTERVAL 10 DAY)
      ${role.sql}

      GROUP BY q.id
      ORDER BY remaining_days ASC, last_followup_at ASC
      LIMIT 10
      `,
      role.params
    );

    res.json(rows);
  } catch (err) {
    console.error("Action quotations error:", err);
    res.status(500).json({ error: "Action quotations failed" });
  } finally {
    if (conn) conn.release();
  }
});

/* ========================================
   GET /api/dashboard/followups-due
======================================== */
router.get("/followups-due", authMiddleware, async (req, res) => {
  let conn;
  try {
    conn = await db.getConnection();
    const role = roleFilter(req, "q");

    const [rows] = await conn.query(
      `
      SELECT
        f.id,
        f.quotation_id,
        q.quotation_no,

        /* ✅ CUSTOMER NAME — SNAPSHOT SAFE */
        COALESCE(
          JSON_UNQUOTE(JSON_EXTRACT(q.customer_snapshot, '$.company_name')),
          c.company_name,
          q.customer_name
        ) AS company_name,

        f.followup_type,
        f.next_followup_date,
        u.name AS salesperson_name

      FROM quotation_followups f
      INNER JOIN quotations q ON q.id = f.quotation_id
      LEFT JOIN customers c ON c.id = q.customer_id
      INNER JOIN users u ON u.id = q.salesperson_id

      WHERE f.is_completed = 0
        AND DATE(f.next_followup_date) <= CURRENT_DATE
        AND q.is_deleted = 0
        ${role.sql}

      ORDER BY f.next_followup_date ASC
      `,
      role.params
    );

    res.json(rows);
  } catch (err) {
    console.error("Followups due error:", err);
    res.status(500).json({ error: "Follow-ups due failed" });
  } finally {
    if (conn) conn.release();
  }
});

/* ========================================
   GET /api/dashboard/recent-activity
   Returns a unified, paginated activity feed with actor/timestamp and refs
======================================== */
router.get("/recent-activity", authMiddleware, async (req, res) => {
  let conn;
  try {
    conn = await db.getConnection();

    const limit = Math.min(50, Number(req.query.limit || 10));
    const offset = Number(req.query.offset || 0) || 0;

    const isAdmin =
      req.user.role &&
      ["admin", "administrator", "superadmin"].includes(
        String(req.user.role).toLowerCase()
      );
    const isSales =
      req.user.role &&
      ["sales"].includes(String(req.user.role).toLowerCase());
    const isPurchase =
      req.user.role &&
      ["purchase"].includes(String(req.user.role).toLowerCase());

    // Prepare unified UNION SQL selecting consistent columns
    const parts = [];

    // Quotations created
    parts.push(`
      SELECT
        CONCAT('Quotation created: ', q.quotation_no) AS description,
        q.created_at AS timestamp,
        'quotation_created' AS type,
        q.id AS quotation_id,
        NULL AS indent_id,
        NULL AS po_id,
        q.salesperson_id AS actor_id,
        u.name AS actor_name
      FROM quotations q
      LEFT JOIN users u ON u.id = q.salesperson_id
      WHERE q.is_deleted = 0 AND q.reissued_from_id IS NULL
      ${isSales ? `AND q.salesperson_id = ${conn.escape(req.user.id)}` : ''}
    `);

    // Quotation decisions
    parts.push(`
      SELECT
        CONCAT(UPPER(COALESCE(qd.decision, 'decided')), ': ', q.quotation_no) AS description,
        qd.decided_at AS timestamp,
        'quotation_decided' AS type,
        q.id AS quotation_id,
        NULL AS indent_id,
        NULL AS po_id,
        NULL AS actor_id,
        qd.decided_by AS actor_name
      FROM quotation_decisions qd
      INNER JOIN quotations q ON q.id = qd.quotation_id
      WHERE q.is_deleted = 0
      ${isSales ? `AND q.salesperson_id = ${conn.escape(req.user.id)}` : ''}
    `);

    // Indents created
    parts.push(`
      SELECT
        CONCAT('Indent created: ', i.indent_number) AS description,
        i.created_at AS timestamp,
        'indent_created' AS type,
        NULL AS quotation_id,
        i.id AS indent_id,
        NULL AS po_id,
        i.created_by AS actor_id,
        i.created_by_name AS actor_name
      FROM indents i
      ${isSales ? `WHERE i.created_by = ${conn.escape(req.user.id)}` : ''}
    `);

    // Purchase orders created
    parts.push(`
      SELECT
        CONCAT('PO created: ', p.po_number) AS description,
        p.created_at AS timestamp,
        'po_created' AS type,
        NULL AS quotation_id,
        NULL AS indent_id,
        p.id AS po_id,
        p.created_by AS actor_id,
        p.created_by_name AS actor_name
      FROM purchase_orders p
      WHERE p.created_at IS NOT NULL
      ${isPurchase && !isAdmin ? `AND p.created_by = ${conn.escape(req.user.id)}` : ''}
    `);

    // Purchase orders delivered (use updated_at when present else created_at)
    const hasUpdatedAt = await hasColumn(conn, 'purchase_orders', 'updated_at');
    parts.push(`
      SELECT
        CONCAT('PO delivered: ', p.po_number) AS description,
        ${hasUpdatedAt ? 'p.updated_at' : 'p.created_at'} AS timestamp,
        'po_delivered' AS type,
        NULL AS quotation_id,
        NULL AS indent_id,
        p.id AS po_id,
        NULL AS actor_id,
        NULL AS actor_name
      FROM purchase_orders p
      WHERE p.status = 'delivered' ${hasUpdatedAt ? `AND p.${'updated_at'} IS NOT NULL` : 'AND p.created_at IS NOT NULL'}
      ${isPurchase && !isAdmin ? `AND p.created_by = ${conn.escape(req.user.id)}` : ''}
    `);

    const unionSql = parts.join('\nUNION ALL\n');

    const finalSql = `
      SELECT description, timestamp, type, quotation_id, indent_id, po_id, actor_id, actor_name
      FROM (
        ${unionSql}
      ) activities
      ORDER BY timestamp DESC
      LIMIT ${conn.escape(limit)} OFFSET ${conn.escape(offset)}
    `;

    const [rows] = await conn.query(finalSql);

    const normalized = (rows || []).map((r) => ({
      id: `${r.type}:${r.quotation_id || r.indent_id || r.po_id || ''}`,
      type: r.type,
      description: r.description,
      timestamp: r.timestamp,
      actor_id: r.actor_id || null,
      actor_name: r.actor_name || null,
      quotation_id: r.quotation_id || null,
      indent_id: r.indent_id || null,
      po_id: r.po_id || null,
    }));

    res.json(normalized);
  } catch (err) {
    console.error("Recent activity error:", err);
    res.status(500).json({ error: "Recent activity failed" });
  } finally {
    if (conn) conn.release();
  }
});

module.exports = router;