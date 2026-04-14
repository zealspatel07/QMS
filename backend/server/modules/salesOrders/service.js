//backend/server/modules/salesOrders/service.js

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

async function generateSoNumber(conn) {
  const fy = getFinancialYearCode();
  const [rows] = await conn.query(
    `
      SELECT MAX(CAST(SUBSTRING(so_number, 8) AS UNSIGNED)) as max_seq
      FROM sales_orders
      WHERE so_number LIKE ?
    `,
    [`SO${fy}%`],
  );
  const maxSeq = rows?.[0]?.max_seq ? Number(rows[0].max_seq) : 0;
  const seq = String(maxSeq + 1).padStart(3, "0");
  return `SO${fy}${seq}`;
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

async function listSalesOrders(conn, query) {
  const { status, from, to, limit } = query || {};
  const where = [];
  const params = [];

  if (status) {
    where.push("so.status = ?");
    params.push(status);
  }
  if (from && to) {
    where.push("DATE(so.created_at) BETWEEN ? AND ?");
    params.push(from, to);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const lim = Math.min(Math.max(Number(limit) || 100, 1), 500);

  const [rows] = await conn.query(
    `
      SELECT
        so.id,
        so.so_number,
        so.quotation_id,
        so.customer_id,
        JSON_EXTRACT(so.customer_snapshot, '$.company_name') as customer_company,
        so.total_value,
        so.status,
        so.confirmed_at,
        so.created_at
      FROM sales_orders so
      ${whereSql}
      ORDER BY so.created_at DESC
      LIMIT ?
    `,
    [...params, lim],
  );

  return rows;
}

async function getSalesOrder(conn, id) {
  const [[row]] = await conn.query(
    `
      SELECT
        so.*,
        e.enquiry_no,
        q.quotation_no
      FROM sales_orders so
      LEFT JOIN enquiries e ON e.id = so.enquiry_id
      LEFT JOIN quotations q ON q.id = so.quotation_id
      WHERE so.id = ?
      LIMIT 1
    `,
    [id],
  );

  if (!row) return null;
  return {
    ...row,
    customer_snapshot: safeJson(row.customer_snapshot, null),
    quotation_snapshot: safeJson(row.quotation_snapshot, null),
    items: safeJson(row.items, []),
  };
}

async function createFromQuotation(conn, quotationId, user) {
  // Quotation is core and lives in index.js endpoints; we only read from table.
  const [[q]] = await conn.query(
    `
      SELECT
        id,
        quotation_no,
        customer_id,
        customer_snapshot,
        customer_name,
        quotation_date,
        validity_days,
        items,
        terms,
        notes,
        subtotal,
        total_discount,
        tax_total,
        total_value,
        status
      FROM quotations
      WHERE id = ? AND is_deleted = 0
      LIMIT 1
    `,
    [quotationId],
  );

  if (!q) throw new Error("Quotation not found");

  // STRICT FLOW RULE: only WON quotations can become Sales Orders
  // (quotation-centric ERP: Enquiry -> Quotation -> WON -> Sales Order)
  const qStatus = String(q.status || "").toLowerCase();
  if (qStatus !== "won") {
    const err = new Error("Quotation must be WON before creating Sales Order");
    err.code = "QUOTATION_NOT_WON";
    throw err;
  }

  // Prevent duplicate SO for same quotation (unique key on sales_orders.quotation_id)
  const [[existing]] = await conn.query(
    `SELECT id, so_number FROM sales_orders WHERE quotation_id = ? LIMIT 1`,
    [quotationId],
  );
  if (existing) {
    return { success: true, id: existing.id, so_number: existing.so_number, message: "Sales order already exists" };
  }

  const soNumber = await generateSoNumber(conn);
  const items = safeJson(q.items, []);
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("Quotation has no items");
  }

  const quotationSnapshot = {
    quotation_id: q.id,
    quotation_no: q.quotation_no,
    quotation_date: q.quotation_date,
    validity_days: q.validity_days,
    terms: q.terms,
    notes: q.notes,
    totals: {
      subtotal: Number(q.subtotal || 0),
      total_discount: Number(q.total_discount || 0),
      tax_total: Number(q.tax_total || 0),
      total_value: Number(q.total_value || 0),
    },
  };

  const customerSnapshot = safeJson(q.customer_snapshot, null) || {
    customer_id: q.customer_id || null,
    customer_name: q.customer_name || null,
  };

  const [res] = await conn.query(
    `
      INSERT INTO sales_orders
        (so_number, quotation_id, customer_id, customer_snapshot, quotation_snapshot, items,
         subtotal, total_discount, tax_total, total_value, status, created_by)
      VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?)
    `,
    [
      soNumber,
      q.id,
      q.customer_id || null,
      customerSnapshot ? JSON.stringify(customerSnapshot) : null,
      JSON.stringify(quotationSnapshot),
      JSON.stringify(items),
      Number(q.subtotal || 0),
      Number(q.total_discount || 0),
      Number(q.tax_total || 0),
      Number(q.total_value || 0),
      user?.id || null,
    ],
  );

  return { success: true, id: res.insertId, so_number: soNumber };
}

async function confirmSalesOrder(conn, id, user) {
  const [[so]] = await conn.query(`SELECT id, status FROM sales_orders WHERE id = ? LIMIT 1`, [id]);
  if (!so) throw new Error("Sales order not found");

  if (so.status !== "draft") {
    return { success: true, id, status: so.status, message: "Sales order already confirmed/processed" };
  }

  await conn.query(
    `UPDATE sales_orders SET status = 'confirmed', confirmed_at = NOW(), confirmed_by = ? WHERE id = ?`,
    [user?.id || null, id],
  );

  return { success: true, id, status: "confirmed" };
}

async function createSalesOrder(conn, payload, user) {
  const { customer_id, items, terms = null, notes = null, delivery_date = null } = payload || {};

  if (!Array.isArray(items) || items.length === 0) {
    const err = new Error("items[] required and must not be empty");
    err.statusCode = 400;
    err.code = "VALIDATION_ERROR";
    throw err;
  }

  if (!customer_id || !Number.isFinite(Number(customer_id))) {
    const err = new Error("customer_id required");
    err.statusCode = 400;
    err.code = "VALIDATION_ERROR";
    throw err;
  }

  // Get customer snapshot
  const [[customer]] = await conn.query(
    `SELECT id, company_name, location_id, contact_id FROM customers WHERE id = ? LIMIT 1`,
    [Number(customer_id)],
  );

  if (!customer) {
    const err = new Error("Customer not found");
    err.statusCode = 404;
    err.code = "CUSTOMER_NOT_FOUND";
    throw err;
  }

  const customerSnapshot = {
    customer_id: customer.id,
    company_name: customer.company_name || null,
    location_id: customer.location_id || null,
    contact_id: customer.contact_id || null,
  };

  // Validate and calculate totals
  let subtotal = 0;
  let taxTotal = 0;
  const validatedItems = items.map((item) => {
    const qty = Number(item.qty || item.quantity || 0);
    const unitPrice = Number(item.unit_price || item.price || 0);
    const taxRate = Number(item.tax_rate || item.tax || 0);

    if (qty <= 0 || !Number.isFinite(qty)) {
      const err = new Error(`Invalid quantity for item: ${item.product_name || item.product_id}`);
      err.statusCode = 400;
      err.code = "VALIDATION_ERROR";
      throw err;
    }

    if (unitPrice < 0 || !Number.isFinite(unitPrice)) {
      const err = new Error(`Invalid unit price for item: ${item.product_name || item.product_id}`);
      err.statusCode = 400;
      err.code = "VALIDATION_ERROR";
      throw err;
    }

    const lineSubtotal = qty * unitPrice;
    const lineTax = (lineSubtotal * taxRate) / 100;

    subtotal += lineSubtotal;
    taxTotal += lineTax;

    return {
      ...item,
      qty: Math.round(qty * 1000) / 1000,
      unit_price: Math.round(unitPrice * 100) / 100,
      tax_rate: Math.round(taxRate * 100) / 100,
    };
  });

  const totalValue = subtotal + taxTotal;
  const soNumber = await generateSoNumber(conn);

  const [res] = await conn.query(
    `
      INSERT INTO sales_orders
        (so_number, customer_id, customer_snapshot, items,
         subtotal, tax_total, total_value, terms, notes, delivery_date, status, created_by)
      VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?)
    `,
    [
      soNumber,
      customer.id,
      JSON.stringify(customerSnapshot),
      JSON.stringify(validatedItems),
      Math.round(subtotal * 100) / 100,
      Math.round(taxTotal * 100) / 100,
      Math.round(totalValue * 100) / 100,
      terms || null,
      notes || null,
      delivery_date || null,
      user?.id || null,
    ],
  );

  return { success: true, id: res.insertId, so_number: soNumber };
}

async function updateSalesOrder(conn, id, payload, user) {
  const { terms = null, notes = null, delivery_date = null, status = null } = payload || {};

  const [[so]] = await conn.query(`SELECT id, status FROM sales_orders WHERE id = ? LIMIT 1`, [id]);
  if (!so) throw new Error("Sales order not found");

  // Only allow editing draft SO, except status can be updated
  if (so.status !== "draft" && !status) {
    const err = new Error("Can only update draft sales orders");
    err.statusCode = 400;
    err.code = "CANNOT_UPDATE_CONFIRMED_SO";
    throw err;
  }

  const updates = [];
  const values = [];

  if (terms !== undefined && terms !== null) {
    updates.push("terms = ?");
    values.push(terms);
  }

  if (notes !== undefined && notes !== null) {
    updates.push("notes = ?");
    values.push(notes);
  }

  if (delivery_date !== undefined && delivery_date !== null) {
    updates.push("delivery_date = ?");
    values.push(delivery_date);
  }

  if (status && ["draft", "confirmed", "partial_dispatch", "completed", "cancelled"].includes(String(status).toLowerCase())) {
    updates.push("status = ?");
    values.push(String(status).toLowerCase());
  }

  if (updates.length === 0) {
    return { success: true, id, message: "No updates provided" };
  }

  updates.push("updated_at = NOW()");
  values.push(id);

  await conn.query(`UPDATE sales_orders SET ${updates.join(", ")} WHERE id = ?`, values);

  return { success: true, id };
}

async function deleteSalesOrder(conn, id, user) {
  const [[so]] = await conn.query(
    `SELECT id, status FROM sales_orders WHERE id = ? LIMIT 1`,
    [id],
  );
  if (!so) throw new Error("Sales order not found");

  if (so.status !== "draft") {
    const err = new Error("Can only delete draft sales orders");
    err.statusCode = 400;
    err.code = "CANNOT_DELETE_CONFIRMED_SO";
    throw err;
  }

  await conn.query(`DELETE FROM sales_orders WHERE id = ?`, [id]);

  return { success: true, id, message: "Sales order deleted" };
}

module.exports = {
  getConn,
  listSalesOrders,
  getSalesOrder,
  createFromQuotation,
  confirmSalesOrder,
  createSalesOrder,
  updateSalesOrder,
  deleteSalesOrder,
};

