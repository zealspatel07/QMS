//backend/server/modules/dispatches/service.js

const db = require("../../db");
const stockLedger = require("../stockLedger/service");

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

async function generateDispatchNo(conn) {
  const fy = getFinancialYearCode();
  const [rows] = await conn.query(
    `
      SELECT MAX(CAST(SUBSTRING(dispatch_no, 9) AS UNSIGNED)) as max_seq
      FROM dispatches
      WHERE dispatch_no LIKE ?
    `,
    [`DSP${fy}%`],
  );
  const maxSeq = rows?.[0]?.max_seq ? Number(rows[0].max_seq) : 0;
  const seq = String(maxSeq + 1).padStart(3, "0");
  return `DSP${fy}${seq}`;
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

function normalizeItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    const err = new Error("items[] required");
    err.statusCode = 400;
    err.code = "VALIDATION_ERROR";
    throw err;
  }

  return items.map((it) => {
    const product_id = Number(it.product_id);

    // ✅ FIXED HERE
    const qty = Number(
      it.dispatch_qty ?? it.qty ?? it.quantity ?? it.dispatched_qty,
    );

    if (!Number.isFinite(product_id) || product_id <= 0) {
      const err = new Error("Invalid product_id");
      err.statusCode = 400;
      err.code = "VALIDATION_ERROR";
      throw err;
    }

    if (!Number.isFinite(qty) || qty <= 0) {
      const err = new Error(`Invalid qty for product ${product_id}`);
      err.statusCode = 400;
      err.code = "VALIDATION_ERROR";
      throw err;
    }

    return {
      product_id,
      qty: Math.round(qty * 1000) / 1000,
    };
  });
}

async function listDispatches(conn, query) {
  const { sales_order_id, status, from, to, limit } = query || {};
  const where = [];
  const params = [];

  if (sales_order_id) {
    where.push("d.sales_order_id = ?");
    params.push(Number(sales_order_id));
  }
  if (status) {
    where.push("d.status = ?");
    params.push(status);
  }
  if (from && to) {
    where.push("DATE(d.created_at) BETWEEN ? AND ?");
    params.push(from, to);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const lim = Math.min(Math.max(Number(limit) || 100, 1), 500);

  const [rows] = await conn.query(
    `
      SELECT
        d.id,
        d.dispatch_no,
        d.sales_order_id,
        d.dispatch_date,
        d.status,
        d.created_at,
        so.so_number,
        so.enquiry_id,
        so.quotation_id
      FROM dispatches d
      LEFT JOIN sales_orders so ON so.id = d.sales_order_id
      ${whereSql}
      ORDER BY d.created_at DESC
      LIMIT ?
    `,
    [...params, lim],
  );
  return rows;
}

async function getDispatch(conn, id) {
  const [[d]] = await conn.query(
    `
      SELECT d.*, 
        so.so_number,
        so.enquiry_id,
        so.quotation_id,
        so.customer_snapshot
      FROM dispatches d
      LEFT JOIN sales_orders so ON so.id = d.sales_order_id
      WHERE d.id = ?
      LIMIT 1
    `,
    [id],
  );
  if (!d) return null;

  const [items] = await conn.query(
    `
      SELECT
        di.id,
        di.product_id,
        di.uom,
        di.ordered_qty,
        di.dispatched_qty,
        di.product_snapshot
      FROM dispatch_items di
      WHERE di.dispatch_id = ?
      ORDER BY di.id ASC
    `,
    [id],
  );

  return {
    ...d,
    items: items.map((it) => ({
      ...it,
      product_snapshot: safeJson(it.product_snapshot, null),
    })),
    customer_snapshot: safeJson(d.customer_snapshot, null),
  };
}

async function createDispatch(conn, payload, user) {
  const {
    sales_order_id,
    dispatch_date = null,
    remarks = null,
    items,
  } = payload || {};
  const soId = Number(sales_order_id);
  if (!Number.isFinite(soId) || soId <= 0) {
    const err = new Error("sales_order_id required");
    err.statusCode = 400;
    err.code = "VALIDATION_ERROR";
    throw err;
  }

  const requested = normalizeItems(items);

  const [[so]] = await conn.query(
    `SELECT id, status, customer_snapshot, items FROM sales_orders WHERE id = ? LIMIT 1`,
    [soId],
  );
  if (!so) throw new Error("Sales order not found");
  if (so.status === "cancelled") {
    const err = new Error("Sales order cancelled");
    err.statusCode = 400;
    err.code = "SO_CANCELLED";
    throw err;
  }

  const soItems = safeJson(so.items, []);
  if (!Array.isArray(soItems) || soItems.length === 0)
    throw new Error("Sales order has no items");

  // Map ordered qty by product_id from SO snapshot
  const orderedByProduct = new Map();
  for (const it of soItems) {
    const pid = Number(it.product_id);
    const qty = Number(it.qty ?? it.quantity ?? 0);
    if (Number.isFinite(pid) && pid > 0) {
      orderedByProduct.set(
        pid,
        (orderedByProduct.get(pid) || 0) + (Number.isFinite(qty) ? qty : 0),
      );
    }
  }

  // Already dispatched quantities across all dispatches for this SO
  const [dispatchedRows] = await conn.query(
    `
      SELECT product_id, COALESCE(SUM(dispatched_qty),0) as dispatched
      FROM dispatch_items
      WHERE sales_order_id = ?
      GROUP BY product_id
    `,
    [soId],
  );
  const alreadyDispatched = new Map(
    dispatchedRows.map((r) => [
      Number(r.product_id),
      Number(r.dispatched || 0),
    ]),
  );

  // Validate each requested line against remaining SO qty + available stock
  for (const r of requested) {
    const ordered = Number(orderedByProduct.get(r.product_id) || 0);
    if (ordered <= 0) {
      const err = new Error(
        `Product_id ${r.product_id} not present in sales order`,
      );
      err.statusCode = 400;
      err.code = "INVALID_SO_ITEM";
      throw err;
    }
    const already = Number(alreadyDispatched.get(r.product_id) || 0);
    const remaining = Math.max(0, ordered - already);
    if (r.qty > remaining) {
      const err = new Error(
        `Dispatch qty exceeds remaining for product_id ${r.product_id}. Remaining ${remaining}, requested ${r.qty}`,
      );
      err.statusCode = 400;
      err.code = "QTY_EXCEEDS_REMAINING";
      throw err;
    }
    const available = await stockLedger.getAvailableStock(conn, r.product_id);
    if (available < r.qty) {
      const err = new Error(
        `Insufficient stock for product_id ${r.product_id}. Available ${available}, requested ${r.qty}`,
      );
      err.statusCode = 400;
      err.code = "INSUFFICIENT_STOCK";
      throw err;
    }
  }

  const dispatchNo = await generateDispatchNo(conn);
  const [dRes] = await conn.query(
    `
      INSERT INTO dispatches (dispatch_no, sales_order_id, dispatch_date, status, remarks, created_by)
      VALUES (?, ?, ?, 'dispatched', ?, ?)
    `,
    [
      dispatchNo,
      soId,
      dispatch_date || new Date().toISOString().slice(0, 10),
      remarks || null,
      user?.id || null,
    ],
  );
  const dispatchId = dRes.insertId;

  // Insert dispatch_items with product_snapshot for invoice generation
  const soItemsByProduct = new Map();
  for (const it of soItems) {
    const pid = Number(it.product_id);
    if (!Number.isFinite(pid) || pid <= 0) continue;
    soItemsByProduct.set(pid, it);
  }

  const itemRows = requested.map((r) => {
    const soItem = soItemsByProduct.get(r.product_id) || null;
    const ordered = Number(orderedByProduct.get(r.product_id) || 0);
    const uom = (soItem && (soItem.uom || soItem.unit || soItem.UOM)) || null;
    return [
      dispatchId,
      soId,
      r.product_id,
      soItem ? JSON.stringify(soItem) : null,
      uom,
      ordered,
      r.qty,
    ];
  });

  await conn.query(
    `
      INSERT INTO dispatch_items
        (dispatch_id, sales_order_id, product_id, product_snapshot, uom, ordered_qty, dispatched_qty)
      VALUES ?
    `,
    [itemRows],
  );

  // Post OUT ledger entries (single source of truth)
  await stockLedger.outwardDispatch(
    conn,
    {
      dispatch_id: dispatchId,
      dispatch_date: dispatch_date || null,
      items: requested.map((r) => ({
        product_id: r.product_id,
        quantity: r.qty,
      })),
      remarks: `Dispatch ${dispatchNo}`,
    },
    user,
  );

  // Update SO status based on remaining qty
  const [[pendingRow]] = await conn.query(
    `
      SELECT
        SUM(CASE WHEN diAgg.dispatched_total < diAgg.ordered_total THEN 1 ELSE 0 END) as pending_lines
      FROM (
        SELECT
          di.product_id,
          MAX(di.ordered_qty) as ordered_total,
          SUM(di.dispatched_qty) as dispatched_total
        FROM dispatch_items di
        WHERE di.sales_order_id = ?
        GROUP BY di.product_id
      ) diAgg
    `,
    [soId],
  );

  const pendingLines = Number(pendingRow?.pending_lines || 0);
  const newStatus = pendingLines === 0 ? "completed" : "partial_dispatch";
  await conn.query(
    `UPDATE sales_orders SET status = ? WHERE id = ? AND status <> 'cancelled'`,
    [newStatus, soId],
  );

  return {
    success: true,
    id: dispatchId,
    dispatch_no: dispatchNo,
    sales_order_id: soId,
  };
}

async function updateDispatch(conn, id, payload, user) {
  const { remarks = null, status = null, dispatch_date = null } = payload || {};

  const [[d]] = await conn.query(
    `SELECT id FROM dispatches WHERE id = ? LIMIT 1`,
    [id],
  );
  if (!d) throw new Error("Dispatch not found");

  const updates = [];
  const values = [];

  if (remarks !== undefined && remarks !== null) {
    updates.push("remarks = ?");
    values.push(remarks);
  }

  if (
    status &&
    ["dispatched", "pending", "completed", "cancelled"].includes(
      String(status).toLowerCase(),
    )
  ) {
    updates.push("status = ?");
    values.push(String(status).toLowerCase());
  }

  if (dispatch_date) {
    updates.push("dispatch_date = ?");
    values.push(dispatch_date);
  }

  if (updates.length === 0) {
    return { success: true, id, message: "No updates provided" };
  }

  updates.push("updated_at = NOW()");
  values.push(id);

  await conn.query(
    `UPDATE dispatches SET ${updates.join(", ")} WHERE id = ?`,
    values,
  );

  return { success: true, id };
}

async function deleteDispatch(conn, id, user) {
  const [[d]] = await conn.query(
    `SELECT id, sales_order_id FROM dispatches WHERE id = ? LIMIT 1`,
    [id],
  );
  if (!d) throw new Error("Dispatch not found");

  // Get dispatch items before deletion for stock reversal
  const [items] = await conn.query(
    `SELECT product_id, dispatched_qty FROM dispatch_items WHERE dispatch_id = ? ORDER BY id ASC`,
    [id],
  );

  // Reverse stock ledger entries
  if (items && items.length > 0) {
    await stockLedger.inwardReturnDispatch(
      conn,
      {
        dispatch_id: id,
        items: items.map((it) => ({
          product_id: it.product_id,
          quantity: it.dispatched_qty,
        })),
        remarks: `Dispatch cancelled/deleted`,
      },
      user,
    );
  }

  // Delete dispatch items first (foreign key constraint)
  await conn.query(`DELETE FROM dispatch_items WHERE dispatch_id = ?`, [id]);

  // Delete dispatch
  await conn.query(`DELETE FROM dispatches WHERE id = ?`, [id]);

  return { success: true, id, message: "Dispatch deleted and stock reversed" };
}

module.exports = {
  getConn,
  createDispatch,
  listDispatches,
  getDispatch,
  updateDispatch,
  deleteDispatch,
};
