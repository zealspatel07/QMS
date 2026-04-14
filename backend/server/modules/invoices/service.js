const db = require("../../db");

function getConn() {
  return db.getConnection();
}

function getFinancialYearCode(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const startYear = month >= 4 ? year : year - 1;
  const endYear = startYear + 1;
  return `${String(startYear).slice(-2)}${String(endYear).slice(-2)}`;
}

async function generateInvoiceNo(conn) {
  const fy = getFinancialYearCode();
  const [rows] = await conn.query(
    `
      SELECT MAX(CAST(SUBSTRING(invoice_no, 9) AS UNSIGNED)) as max_seq
      FROM invoices
      WHERE invoice_no LIKE ?
    `,
    [`INV${fy}%`],
  );
  const maxSeq = rows?.[0]?.max_seq ? Number(rows[0].max_seq) : 0;
  const seq = String(maxSeq + 1).padStart(3, "0");
  return `INV${fy}${seq}`;
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

function calcTotals(items) {
  // items: [{qty, unit_price, tax_rate?, discount?}]
  let subtotal = 0;
  let tax_total = 0;
  let total_discount = 0;

  for (const it of items) {
    const qty = Number(it.qty || 0);
    const price = Number(it.unit_price || 0);
    const line = qty * price;
    const discount = Number(it.discount || 0);
    const taxRate = Number(it.tax_rate || it.gst_rate || 0);
    const taxable = Math.max(0, line - discount);
    const tax = (taxable * taxRate) / 100;

    subtotal += line;
    total_discount += discount;
    tax_total += tax;
  }

  subtotal = Math.round(subtotal * 100) / 100;
  total_discount = Math.round(total_discount * 100) / 100;
  tax_total = Math.round(tax_total * 100) / 100;
  const total_amount = Math.round((subtotal - total_discount + tax_total) * 100) / 100;
  return { subtotal, total_discount, tax_total, total_amount };
}

async function listInvoices(conn, query) {
  const { payment_status, status, from, to, limit } = query || {};
  const where = [];
  const params = [];

  if (payment_status) {
    where.push("i.payment_status = ?");
    params.push(payment_status);
  }
  if (status) {
    where.push("i.status = ?");
    params.push(status);
  }
  if (from && to) {
    where.push("DATE(i.created_at) BETWEEN ? AND ?");
    params.push(from, to);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const lim = Math.min(Math.max(Number(limit) || 100, 1), 500);

  const [rows] = await conn.query(
    `
      SELECT
        i.id,
        i.invoice_no,
        i.dispatch_id,
        i.sales_order_id,
        i.invoice_date,
        i.due_date,
        i.status,
        i.payment_status,
        i.total_amount,
        i.amount_paid,
        i.balance_due,
        i.created_at
      FROM invoices i
      ${whereSql}
      ORDER BY i.created_at DESC
      LIMIT ?
    `,
    [...params, lim],
  );

  return rows;
}

async function getInvoice(conn, id) {
  const [[row]] = await conn.query(
    `
      SELECT
        i.*,
        d.dispatch_no,
        so.so_number
      FROM invoices i
      LEFT JOIN dispatches d ON d.id = i.dispatch_id
      LEFT JOIN sales_orders so ON so.id = i.sales_order_id
      WHERE i.id = ?
      LIMIT 1
    `,
    [id],
  );
  if (!row) return null;
  return {
    ...row,
    customer_snapshot: safeJson(row.customer_snapshot, null),
    items: safeJson(row.items, []),
  };
}

async function createFromDispatch(conn, dispatchId, payload, user) {
  const { invoice_date = null, due_date = null, terms = null, notes = null } = payload || {};

  const [[existing]] = await conn.query(`SELECT id, invoice_no FROM invoices WHERE dispatch_id = ? LIMIT 1`, [dispatchId]);
  if (existing) {
    return { success: true, id: existing.id, invoice_no: existing.invoice_no, message: "Invoice already exists" };
  }

  const [[d]] = await conn.query(
    `
      SELECT d.id, d.sales_order_id, d.dispatch_no, d.dispatch_date
      FROM dispatches d
      WHERE d.id = ?
      LIMIT 1
    `,
    [dispatchId],
  );
  if (!d) throw new Error("Dispatch not found");

  const soId = Number(d.sales_order_id);
  const [[so]] = await conn.query(
    `SELECT id, customer_snapshot, items, currency FROM sales_orders WHERE id = ? LIMIT 1`,
    [soId],
  );
  if (!so) throw new Error("Sales order not found");

  const [diRows] = await conn.query(
    `
      SELECT product_id, dispatched_qty, product_snapshot, uom
      FROM dispatch_items
      WHERE dispatch_id = ?
      ORDER BY id ASC
    `,
    [dispatchId],
  );
  if (!diRows.length) throw new Error("Dispatch has no items");

  const soItems = safeJson(so.items, []);
  const soItemByProduct = new Map();
  for (const it of Array.isArray(soItems) ? soItems : []) {
    const pid = Number(it.product_id);
    if (Number.isFinite(pid) && pid > 0) soItemByProduct.set(pid, it);
  }

  // Build invoice items from dispatch qty + SO pricing snapshot
  const invItems = diRows.map((di) => {
    const pid = Number(di.product_id);
    const qty = Number(di.dispatched_qty || 0);
    const soIt = soItemByProduct.get(pid) || safeJson(di.product_snapshot, null) || {};

    return {
      product_id: pid,
      product_name: soIt.product_name || soIt.name || soIt.product || null,
      uom: di.uom || soIt.uom || null,
      qty,
      unit_price: Number(soIt.unit_price || soIt.price || 0),
      tax_rate: Number(soIt.tax_rate || soIt.gst_rate || 0),
      discount: Number(soIt.discount || 0),
    };
  });

  const totals = calcTotals(invItems);
  const invoiceNo = await generateInvoiceNo(conn);

  const invDate = invoice_date || new Date().toISOString().slice(0, 10);
  const [res] = await conn.query(
    `
      INSERT INTO invoices
        (invoice_no, dispatch_id, sales_order_id, invoice_date, due_date,
         status, payment_status, customer_snapshot, items, currency,
         subtotal, total_discount, tax_total, total_amount, amount_paid, terms, notes, created_by)
      VALUES
        (?, ?, ?, ?, ?, 'issued', 'unpaid', ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
    `,
    [
      invoiceNo,
      dispatchId,
      soId,
      invDate,
      due_date || null,
      so.customer_snapshot ? JSON.stringify(safeJson(so.customer_snapshot, null)) : null,
      JSON.stringify(invItems),
      so.currency || "INR",
      totals.subtotal,
      totals.total_discount,
      totals.tax_total,
      totals.total_amount,
      terms || null,
      notes || `Invoice for dispatch ${d.dispatch_no}`,
      user?.id || null,
    ],
  );

  return { success: true, id: res.insertId, invoice_no: invoiceNo, total_amount: totals.total_amount };
}

async function updatePayment(conn, invoiceId, payload, user) {
  const { amount_paid, add_amount } = payload || {};

  const [[inv]] = await conn.query(
    `SELECT id, total_amount, amount_paid, payment_status FROM invoices WHERE id = ? LIMIT 1`,
    [invoiceId],
  );
  if (!inv) throw new Error("Invoice not found");

  let newPaid = Number(inv.amount_paid || 0);
  if (add_amount != null) {
    const delta = Number(add_amount);
    if (!Number.isFinite(delta) || delta <= 0) throw new Error("add_amount must be > 0");
    newPaid += delta;
  } else if (amount_paid != null) {
    const val = Number(amount_paid);
    if (!Number.isFinite(val) || val < 0) throw new Error("amount_paid must be >= 0");
    newPaid = val;
  } else {
    throw new Error("amount_paid or add_amount required");
  }

  const total = Number(inv.total_amount || 0);
  if (newPaid > total) newPaid = total;

  const paymentStatus = newPaid <= 0 ? "unpaid" : newPaid >= total ? "paid" : "partial";

  await conn.query(
    `UPDATE invoices SET amount_paid = ?, payment_status = ?, updated_at = NOW() WHERE id = ?`,
    [Math.round(newPaid * 100) / 100, paymentStatus, invoiceId],
  );

  return { success: true, id: invoiceId, amount_paid: Math.round(newPaid * 100) / 100, payment_status: paymentStatus };
}

module.exports = {
  getConn,
  listInvoices,
  getInvoice,
  createFromDispatch,
  updatePayment,
};

