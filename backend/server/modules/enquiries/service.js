//backend/server/modules/enquiries/service.js

const db = require("../../db");

function getConn() {
  return db.getConnection();
}

/** mysql2 may return JSON columns as object, string, or Buffer */
function parseJsonField(v) {
  if (v == null || v === "") return null;
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(v)) {
    const s = v.toString("utf8");
    if (!s || !String(s).trim()) return null;
    try {
      return JSON.parse(s);
    } catch {
      return null;
    }
  }
  if (typeof v === "object" && v !== null) return v;
  if (typeof v === "string" && v.trim()) {
    try {
      return JSON.parse(v);
    } catch {
      return null;
    }
  }
  return null;
}

function normalizeItemsField(v) {
  const parsed = parseJsonField(v);
  if (parsed == null) return [];
  if (Array.isArray(parsed)) return parsed;
  if (typeof parsed === "object") return [parsed];
  return [];
}

function getFinancialYearCode(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const startYear = month >= 4 ? year : year - 1;
  const endYear = startYear + 1;
  return `${String(startYear).slice(-2)}${String(endYear).slice(-2)}`;
}

async function generateEnquiryNo(conn) {
  const fy = getFinancialYearCode();
  const [rows] = await conn.query(
    `
      SELECT MAX(CAST(SUBSTRING(enquiry_no, 9) AS UNSIGNED)) as max_seq
      FROM enquiries
      WHERE enquiry_no LIKE ?
    `,
    [`ENQ${fy}%`],
  );
  const maxSeq = rows?.[0]?.max_seq ? Number(rows[0].max_seq) : 0;
  const seq = String(maxSeq + 1).padStart(3, "0");
  return `ENQ${fy}${seq}`;
}

async function createEnquiry(conn, payload, user) {
  const {
    customer_id = null,
    customer_location_id = null,
    customer_contact_id = null,
    customer_name = null,
    customer_snapshot = null,
    location_snapshot = null,
    contact_snapshot = null,
    enquiry_date = null,
    source = null,
    notes = null,
    items = null,
    lost_reason = null,
  } = payload || {};

  const enquiryNo = await generateEnquiryNo(conn);

  const [result] = await conn.query(
    `
      INSERT INTO enquiries
        (
          enquiry_no,
          customer_id,
          customer_location_id,
          customer_contact_id,
          customer_snapshot,
          location_snapshot,
          contact_snapshot,
          customer_name,
          enquiry_date,
          source,
          notes,
          items,
          lost_reason,
          status,
          created_by
        )
      VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)
    `,
    [
      enquiryNo,
      customer_id || null,
      customer_location_id || null,
      customer_contact_id || null,
      customer_snapshot ? JSON.stringify(customer_snapshot) : null,
      location_snapshot ? JSON.stringify(location_snapshot) : null,
      contact_snapshot ? JSON.stringify(contact_snapshot) : null,
      customer_name || null,
      enquiry_date || new Date().toISOString().slice(0, 10),
      source || null,
      notes || null,
      items != null ? JSON.stringify(Array.isArray(items) ? items : items) : null,
      lost_reason || null,
      user?.id || null,
    ],
  );

  return { success: true, id: result.insertId, enquiry_no: enquiryNo };
}

async function listEnquiries(conn, query) {
  const { status, from, to, limit, q } = query || {};

  const where = [];
  const params = [];

  if (status) {
    where.push("e.status = ?");
    params.push(status);
  }

  if (q && String(q).trim()) {
    const term = `%${String(q).trim()}%`;
    where.push("(e.enquiry_no LIKE ? OR e.customer_name LIKE ? OR e.source LIKE ?)");
    params.push(term, term, term);
  }

  if (from && to) {
    where.push("DATE(e.created_at) BETWEEN ? AND ?");
    params.push(from, to);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const lim = Math.min(Math.max(Number(limit) || 100, 1), 500);

  const [rows] = await conn.query(
    `
      SELECT
        e.id,
        e.enquiry_no,
        e.customer_id,
        e.customer_location_id,
        e.customer_contact_id,
        e.customer_name,
        e.enquiry_date,
        e.source,
        e.status,
        e.created_at,
        e.updated_at
      FROM enquiries e
      ${whereSql}
      ORDER BY e.created_at DESC
      LIMIT ?
    `,
    [...params, lim],
  );

  return rows;
}

async function getEnquiryById(conn, enquiryId) {
  const [[row]] = await conn.query(
    `
      SELECT
        e.id,
        e.enquiry_no,
        e.customer_id,
        e.customer_location_id,
        e.customer_contact_id,
        e.customer_snapshot,
        e.location_snapshot,
        e.contact_snapshot,
        e.customer_name,
        e.enquiry_date,
        e.source,
        e.notes,
        e.items,
        e.lost_reason,
        e.status,
        e.created_by,
        e.created_at,
        e.updated_at,
        u.name AS created_by_name
      FROM enquiries e
      LEFT JOIN users u ON u.id = e.created_by
      WHERE e.id = ?
      LIMIT 1
    `,
    [enquiryId],
  );

  if (!row) return null;

  return {
    ...row,
    customer_snapshot: parseJsonField(row.customer_snapshot),
    location_snapshot: parseJsonField(row.location_snapshot),
    contact_snapshot: parseJsonField(row.contact_snapshot),
    items: normalizeItemsField(row.items),
  };
}

async function updateEnquiry(conn, enquiryId, payload, user) {
  const {
    customer_id,
    customer_location_id,
    customer_contact_id,
    customer_name,
    customer_snapshot,
    location_snapshot,
    contact_snapshot,
    enquiry_date,
    source,
    notes,
    items,
    lost_reason,
    status,
  } = payload || {};

  const allowedStatus = new Set(["open", "quoted", "lost", "closed"]);
  const nextStatus = status && allowedStatus.has(String(status)) ? String(status) : null;

  const [result] = await conn.query(
    `
      UPDATE enquiries
      SET
        customer_id = COALESCE(?, customer_id),
        customer_location_id = COALESCE(?, customer_location_id),
        customer_contact_id = COALESCE(?, customer_contact_id),
        customer_name = COALESCE(?, customer_name),
        customer_snapshot = COALESCE(?, customer_snapshot),
        location_snapshot = COALESCE(?, location_snapshot),
        contact_snapshot = COALESCE(?, contact_snapshot),
        enquiry_date = COALESCE(?, enquiry_date),
        source = COALESCE(?, source),
        notes = COALESCE(?, notes),
        items = COALESCE(?, items),
        lost_reason = COALESCE(?, lost_reason),
        status = COALESCE(?, status),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      LIMIT 1
    `,
    [
      customer_id !== undefined ? (customer_id || null) : null,
      customer_location_id !== undefined ? (customer_location_id || null) : null,
      customer_contact_id !== undefined ? (customer_contact_id || null) : null,
      customer_name !== undefined ? (customer_name || null) : null,
      customer_snapshot !== undefined ? (customer_snapshot ? JSON.stringify(customer_snapshot) : null) : null,
      location_snapshot !== undefined ? (location_snapshot ? JSON.stringify(location_snapshot) : null) : null,
      contact_snapshot !== undefined ? (contact_snapshot ? JSON.stringify(contact_snapshot) : null) : null,
      enquiry_date !== undefined ? (enquiry_date || null) : null,
      source !== undefined ? (source || null) : null,
      notes !== undefined ? (notes || null) : null,
      items !== undefined ? (items != null ? JSON.stringify(Array.isArray(items) ? items : items) : null) : null,
      lost_reason !== undefined ? (lost_reason || null) : null,
      nextStatus,
      enquiryId,
    ],
  );

  if (!result?.affectedRows) return { success: false, error: "not_found" };
  return { success: true, id: enquiryId };
}

async function deleteEnquiry(conn, enquiryId) {
  const [res] = await conn.query(`DELETE FROM enquiries WHERE id = ? LIMIT 1`, [enquiryId]);
  if (!res?.affectedRows) return { success: false };
  return { success: true };
}

async function convertEnquiryToQuotation(conn, enquiryId, payload, user) {
  // Minimal conversion: create a DRAFT quotation with snapshot + optional items/terms from payload
  const { items = [], terms = null, notes = null, validity_days = 30 } = payload || {};

  const [[e]] = await conn.query(
    `SELECT id, enquiry_no, customer_id, customer_name, customer_snapshot, items FROM enquiries WHERE id = ? LIMIT 1`,
    [enquiryId],
  );

  if (!e) {
    throw new Error("Enquiry not found");
  }

  // Use existing helper endpoint for next quotation number if present; otherwise keep null and let client use /api/quotations/next.
  // Here we create quotation with a temporary null quotation_no (allowed by schema in index.js ensureQuotationsTable).
  const quotationDate = new Date().toISOString().slice(0, 10);

  const enquiryItems = (() => {
    const v = e.items;
    if (Array.isArray(v)) return v;
    if (v == null) return [];
    if (typeof v === "string" && v.trim()) {
      try {
        const parsed = JSON.parse(v);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  })();

  let itemsJson = Array.isArray(items) ? items : [];
  if (!itemsJson.length && enquiryItems.length) {
    itemsJson = enquiryItems.map((it) => ({
      product_id: it.product_id ?? null,
      product_name: it.product_name ?? it.name ?? "",
      description: it.description ?? "",
      qty: Number(it.qty ?? it.quantity ?? 1),
      quantity: Number(it.qty ?? it.quantity ?? 1),
      uom: it.uom ?? "NOS",
      unit_price: Number(it.unit_price ?? 0),
      tax_rate: Number(it.tax_rate ?? 0),
      hsn_code: it.hsn_code ?? "",
    }));
  }
  const customerSnapshotObj = (() => {
    try {
      if (!e.customer_snapshot) return null;
      return typeof e.customer_snapshot === "string" ? JSON.parse(e.customer_snapshot) : e.customer_snapshot;
    } catch {
      return null;
    }
  })();

  const [qRes] = await conn.query(
    `
      INSERT INTO quotations
        (quotation_no, customer_id, customer_snapshot, customer_name, quotation_date, validity_days, items, terms, notes, status, created_at)
      VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', NOW())
    `,
    [
      null,
      e.customer_id || null,
      customerSnapshotObj ? JSON.stringify(customerSnapshotObj) : null,
      e.customer_name || null,
      quotationDate,
      Number(validity_days) || 30,
      JSON.stringify(itemsJson),
      terms || null,
      notes || `Converted from enquiry ${e.enquiry_no}`,
    ],
  );

  await conn.query(`UPDATE enquiries SET status = 'quoted' WHERE id = ?`, [enquiryId]);

  return { success: true, enquiry_id: enquiryId, quotation_id: qRes.insertId };
}

module.exports = {
  getConn,
  createEnquiry,
  listEnquiries,
  getEnquiryById,
  updateEnquiry,
  deleteEnquiry,
  convertEnquiryToQuotation,
};

