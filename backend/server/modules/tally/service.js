const db = require("../../db");

function getConn() {
  return db.getConnection();
}

function safeJson(val, fallback) {
  try {
    if (val == null) return fallback;
    if (typeof val === "string") return JSON.parse(val);
    return val;
  } catch {
    return fallback;
  }
}

async function exportInvoicesJson(conn, query) {
  const { from, to, payment_status, status, limit } = query || {};
  const where = [];
  const params = [];

  if (from && to) {
    where.push("DATE(i.invoice_date) BETWEEN ? AND ?");
    params.push(from, to);
  }
  if (payment_status) {
    where.push("i.payment_status = ?");
    params.push(payment_status);
  }
  if (status) {
    where.push("i.status = ?");
    params.push(status);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const lim = Math.min(Math.max(Number(limit) || 500, 1), 5000);

  const [rows] = await conn.query(
    `
      SELECT
        i.id,
        i.invoice_no,
        i.invoice_date,
        i.due_date,
        i.status,
        i.payment_status,
        i.currency,
        i.subtotal,
        i.total_discount,
        i.tax_total,
        i.total_amount,
        i.amount_paid,
        i.balance_due,
        i.customer_snapshot,
        i.items,
        i.created_at,
        d.dispatch_no,
        so.so_number
      FROM invoices i
      LEFT JOIN dispatches d ON d.id = i.dispatch_id
      LEFT JOIN sales_orders so ON so.id = i.sales_order_id
      ${whereSql}
      ORDER BY i.invoice_date DESC, i.id DESC
      LIMIT ?
    `,
    [...params, lim],
  );

  return rows.map((r) => ({
    id: r.id,
    invoice_no: r.invoice_no,
    invoice_date: r.invoice_date,
    due_date: r.due_date,
    status: r.status,
    payment_status: r.payment_status,
    currency: r.currency,
    totals: {
      subtotal: Number(r.subtotal || 0),
      total_discount: Number(r.total_discount || 0),
      tax_total: Number(r.tax_total || 0),
      total_amount: Number(r.total_amount || 0),
      amount_paid: Number(r.amount_paid || 0),
      balance_due: Number(r.balance_due || 0),
    },
    customer: safeJson(r.customer_snapshot, null),
    items: safeJson(r.items, []),
    references: {
      sales_order_no: r.so_number || null,
      dispatch_no: r.dispatch_no || null,
    },
    created_at: r.created_at,
  }));
}

module.exports = {
  getConn,
  exportInvoicesJson,
};

