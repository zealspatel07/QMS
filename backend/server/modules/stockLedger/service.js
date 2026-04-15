const db = require("../../db");

function getConn() {
  return db.getConnection();
}

async function getAvailableStock(conn, productId) {
  const [[row]] = await conn.query(
    `
      SELECT
        COALESCE(SUM(CASE WHEN direction = 'IN' THEN quantity ELSE -quantity END), 0) AS available
      FROM stock_ledger
      WHERE product_id = ?
    `,
    [productId],
  );
  const val = row ? Number(row.available || 0) : 0;
  // avoid -0
  return Math.max(0, Math.round(val * 1000) / 1000);
}

async function getAvailableStockBulk(conn, productIds) {
  const ids = Array.from(
    new Set(
      (Array.isArray(productIds) ? productIds : [])
        .map((x) => Number(x))
        .filter((n) => Number.isFinite(n) && n > 0),
    ),
  );

  if (ids.length === 0) return [];

  const placeholders = ids.map(() => "?").join(",");
  const [rows] = await conn.query(
    `
      SELECT
        product_id,
        COALESCE(SUM(CASE WHEN direction = 'IN' THEN quantity ELSE -quantity END), 0) AS available_qty
      FROM stock_ledger
      WHERE product_id IN (${placeholders})
      GROUP BY product_id
    `,
    ids,
  );

  const map = new Map(rows.map((r) => [Number(r.product_id), Math.max(0, Math.round(Number(r.available_qty || 0) * 1000) / 1000)]));
  return ids.map((id) => ({ product_id: id, available_qty: map.get(id) ?? 0 }));
}

async function listLedger(conn, query) {
  const {
    product_id,
    txn_type,
    direction,
    from,
    to,
    limit = 200,
    offset = 0,
  } = query || {};

  const where = [];
  const params = [];

  if (product_id) {
    where.push("sl.product_id = ?");
    params.push(Number(product_id));
  }
  if (txn_type) {
    where.push("sl.txn_type = ?");
    params.push(String(txn_type));
  }
  if (direction) {
    where.push("sl.direction = ?");
    params.push(String(direction));
  }
  if (from && to) {
    where.push("DATE(sl.txn_date) BETWEEN ? AND ?");
    params.push(from, to);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const lim = Math.min(Math.max(Number(limit) || 200, 1), 1000);
  const off = Math.max(Number(offset) || 0, 0);

  const [rows] = await conn.query(
    `
      SELECT
        sl.id,
        sl.txn_date,
        sl.txn_type,
        sl.direction,
        sl.quantity,
        sl.uom,
        sl.unit_cost,
        sl.ref_table,
        sl.ref_id,
        sl.ref_item_id,
        sl.remarks,
        sl.created_at,
        sl.product_id,
        p.name AS product_name,
        p.hsn_code,
        p.uom AS product_uom
      FROM stock_ledger sl
      LEFT JOIN products p ON p.id = sl.product_id
      ${whereSql}
      ORDER BY sl.txn_date DESC, sl.id DESC
      LIMIT ?
      OFFSET ?
    `,
    [...params, lim, off],
  );

  return rows;
}

async function getInStock(conn, query) {
  const { q = "", limit = 200, only_positive = "true" } = query || {};
  const lim = Math.min(Math.max(Number(limit) || 200, 1), 2000);
  const onlyPositive = String(only_positive).toLowerCase() !== "false";

  const params = [];
  let searchSql = "";
  if (q && String(q).trim() !== "") {
    searchSql = "AND (p.name LIKE ? OR p.hsn_code LIKE ?)";
    params.push(`%${q}%`, `%${q}%`);
  }

  const havingSql = onlyPositive ? "HAVING available_qty > 0" : "";

  const [rows] = await conn.query(
    `
      SELECT
        p.id AS product_id,
        p.name AS product_name,
        p.hsn_code,
        p.uom,
        COALESCE(SUM(CASE WHEN sl.direction = 'IN' THEN sl.quantity ELSE -sl.quantity END), 0) AS available_qty
      FROM products p
      LEFT JOIN stock_ledger sl ON sl.product_id = p.id
      WHERE 1=1
      ${searchSql}
      GROUP BY p.id
      ${havingSql}
      ORDER BY p.name ASC
      LIMIT ?
    `,
    [...params, lim],
  );

  return rows.map((r) => ({
    ...r,
    available_qty: Math.max(0, Math.round(Number(r.available_qty || 0) * 1000) / 1000),
  }));
}

function normalizeItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("items[] required");
  }
  return items.map((it) => {
    const product_id = Number(it.product_id);
    const quantity = Number(it.quantity);
    if (!Number.isFinite(product_id) || product_id <= 0) throw new Error("Invalid product_id");
    if (!Number.isFinite(quantity) || quantity <= 0) throw new Error("Invalid quantity");
    return {
      product_id,
      quantity: Math.round(quantity * 1000) / 1000,
      uom: it.uom || null,
      unit_cost: it.unit_cost != null ? Number(it.unit_cost) : null,
      remarks: it.remarks || null,
      ref_item_id: it.ref_item_id != null ? Number(it.ref_item_id) : null,
    };
  });
}

async function inwardGrn(conn, payload, user) {
  const { po_id = null, grn_date = null, items, remarks = null } = payload || {};
  const normalized = normalizeItems(items);

  const refTable = po_id ? "purchase_orders" : "manual_grn";
  const refId = po_id ? Number(po_id) : null;

  const rows = normalized.map((it) => [
    it.product_id,
    grn_date ? new Date(grn_date) : new Date(),
    "GRN",
    "IN",
    it.quantity,
    it.uom,
    it.unit_cost,
    refTable,
    refId,
    it.ref_item_id,
    it.remarks || remarks,
    user?.id || null,
  ]);

  await conn.query(
    `
      INSERT INTO stock_ledger
        (product_id, txn_date, txn_type, direction, quantity, uom, unit_cost,
         ref_table, ref_id, ref_item_id, remarks, created_by)
      VALUES ?
    `,
    [rows],
  );

  return { success: true, posted: rows.length };
}

async function inwardGrnFromPo(conn, poId, payload, user) {
  const resolvedPoId = Number(poId);
  if (!Number.isFinite(resolvedPoId) || resolvedPoId <= 0) throw new Error("Invalid poId");

  const { grn_date = null, remarks = null } = payload || {};

  // Fetch PO items and their received_qty
  const [poItems] = await conn.query(
    `
      SELECT
        pi.id AS po_item_id,
        pi.product_id,
        pi.product_name,
        pi.ordered_qty,
        pi.received_qty,
        pi.uom,
        pi.unit_price
      FROM po_items pi
      WHERE pi.po_id = ?
        AND pi.product_id IS NOT NULL
    `,
    [resolvedPoId],
  );

  if (!poItems.length) {
    throw new Error("No PO items found for GRN (product_id missing?)");
  }

  // Already posted GRN quantities for each PO item
  const [postedRows] = await conn.query(
    `
      SELECT
        ref_item_id AS po_item_id,
        product_id,
        COALESCE(SUM(quantity), 0) AS posted_qty
      FROM stock_ledger
      WHERE ref_table = 'purchase_orders'
        AND ref_id = ?
        AND txn_type = 'GRN'
        AND direction = 'IN'
      GROUP BY ref_item_id, product_id
    `,
    [resolvedPoId],
  );

  const postedMap = new Map(
    postedRows.map((r) => [Number(r.po_item_id), Number(r.posted_qty || 0)]),
  );

  const rowsToPost = [];

  for (const it of poItems) {
    const poItemId = Number(it.po_item_id);
    const productId = Number(it.product_id);
    const received = Number(it.received_qty || 0);
    const alreadyPosted = Number(postedMap.get(poItemId) || 0);
    const delta = Math.round((received - alreadyPosted) * 1000) / 1000;

    if (delta <= 0) continue; // nothing new to post

    rowsToPost.push([
      productId,
      grn_date ? new Date(grn_date) : new Date(),
      "GRN",
      "IN",
      delta,
      it.uom || null,
      it.unit_price != null ? Number(it.unit_price) : null,
      "purchase_orders",
      resolvedPoId,
      poItemId,
      remarks || `GRN against PO ${resolvedPoId}`,
      user?.id || null,
    ]);
  }

  if (rowsToPost.length === 0) {
    return { success: true, posted: 0, message: "No new received quantity to post into stock ledger" };
  }

  await conn.query(
    `
      INSERT INTO stock_ledger
        (product_id, txn_date, txn_type, direction, quantity, uom, unit_cost,
         ref_table, ref_id, ref_item_id, remarks, created_by)
      VALUES ?
    `,
    [rowsToPost],
  );

  return { success: true, posted: rowsToPost.length };
}

async function outwardDispatch(conn, payload, user) {
  const { dispatch_id, dispatch_date = null, items, remarks = null } = payload || {};
  const dispatchId = Number(dispatch_id);
  if (!Number.isFinite(dispatchId) || dispatchId <= 0) {
    const err = new Error("dispatch_id required");
    err.statusCode = 400;
    err.code = "VALIDATION_ERROR";
    throw err;
  }

  const normalized = normalizeItems(items);

  // Validate stock availability per line (strict)
  for (const it of normalized) {
    const available = await getAvailableStock(conn, it.product_id);
    if (available < it.quantity) {
      const err = new Error(
        `Insufficient stock for product_id ${it.product_id}. Available ${available}, required ${it.quantity}`,
      );
      err.statusCode = 400;
      err.code = "INSUFFICIENT_STOCK";
      throw err;
    }
  }

  const rows = normalized.map((it) => [
    it.product_id,
    dispatch_date ? new Date(dispatch_date) : new Date(),
    "DISPATCH",
    "OUT",
    it.quantity,
    it.uom,
    null,
    "dispatches",
    dispatchId,
    it.ref_item_id,
    it.remarks || remarks,
    user?.id || null,
  ]);

  await conn.query(
    `
      INSERT INTO stock_ledger
        (product_id, txn_date, txn_type, direction, quantity, uom, unit_cost,
         ref_table, ref_id, ref_item_id, remarks, created_by)
      VALUES ?
    `,
    [rows],
  );

  return { success: true, posted: rows.length };
}

async function inwardReturnDispatch(conn, payload, user) {
  const { dispatch_id, dispatch_date = null, items, remarks = null } = payload || {};
  const dispatchId = Number(dispatch_id);
  if (!Number.isFinite(dispatchId) || dispatchId <= 0) {
    const err = new Error("dispatch_id required");
    err.statusCode = 400;
    err.code = "VALIDATION_ERROR";
    throw err;
  }

  const normalized = normalizeItems(items);
  const rows = normalized.map((it) => [
    it.product_id,
    dispatch_date ? new Date(dispatch_date) : new Date(),
    "ADJUSTMENT",
    "IN",
    it.quantity,
    it.uom,
    null,
    "dispatches",
    dispatchId,
    it.ref_item_id,
    it.remarks || remarks || "Dispatch reversal",
    user?.id || null,
  ]);

  await conn.query(
    `
      INSERT INTO stock_ledger
        (product_id, txn_date, txn_type, direction, quantity, uom, unit_cost,
         ref_table, ref_id, ref_item_id, remarks, created_by)
      VALUES ?
    `,
    [rows],
  );

  return { success: true, posted: rows.length };
}

module.exports = {
  getConn,
  getAvailableStock,
  getAvailableStockBulk,
  listLedger,
  getInStock,
  inwardGrn,
  inwardGrnFromPo,
  outwardDispatch,
  inwardReturnDispatch,
};

