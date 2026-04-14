//backend/server/modules/salesOrders/controller.js

const service = require("./service");

async function listSalesOrders(req, res) {
  let conn;
  try {
    conn = await service.getConn();
    const rows = await service.listSalesOrders(conn, req.query);
    res.json(rows);
  } catch (err) {
    console.error("listSalesOrders error:", err);
    res.status(500).json({ error: "Failed to list sales orders", details: err.message });
  } finally {
    conn?.release();
  }
}

async function getSalesOrder(req, res) {
  let conn;
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: "Invalid id" });
    conn = await service.getConn();
    const so = await service.getSalesOrder(conn, id);
    if (!so) return res.status(404).json({ error: "Sales order not found" });
    res.json(so);
  } catch (err) {
    console.error("getSalesOrder error:", err);
    res.status(500).json({ error: "Failed to fetch sales order", details: err.message });
  } finally {
    conn?.release();
  }
}

async function createFromQuotation(req, res) {
  let conn;
  try {
    const quotationId = Number(req.params.quotationId);
    if (!Number.isFinite(quotationId) || quotationId <= 0) {
      return res.status(400).json({ error: "Invalid quotation id" });
    }
    conn = await service.getConn();
    await conn.beginTransaction();
    const result = await service.createFromQuotation(conn, quotationId, req.user);
    await conn.commit();
    res.json(result);
  } catch (err) {
    if (conn) await conn.rollback();
    console.error("createFromQuotation error:", err);
    res.status(500).json({ error: "Failed to create sales order", details: err.message });
  } finally {
    conn?.release();
  }
}

async function confirmSalesOrder(req, res) {
  let conn;
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: "Invalid id" });
    conn = await service.getConn();
    const result = await service.confirmSalesOrder(conn, id, req.user);
    res.json(result);
  } catch (err) {
    console.error("confirmSalesOrder error:", err);
    res.status(500).json({ error: "Failed to confirm sales order", details: err.message });
  } finally {
    conn?.release();
  }
}

async function createSalesOrder(req, res) {
  let conn;
  try {
    conn = await service.getConn();
    await conn.beginTransaction();
    const result = await service.createSalesOrder(conn, req.body, req.user);
    await conn.commit();
    res.json(result);
  } catch (err) {
    if (conn) await conn.rollback();
    console.error("createSalesOrder error:", err);
    const status = err?.statusCode && Number.isFinite(err.statusCode) ? err.statusCode : 500;
    res.status(status).json({
      error: err?.code || (status === 400 ? "VALIDATION_ERROR" : "Failed to create sales order"),
      details: err?.message,
    });
  } finally {
    conn?.release();
  }
}

async function updateSalesOrder(req, res) {
  let conn;
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: "Invalid id" });
    conn = await service.getConn();
    const result = await service.updateSalesOrder(conn, id, req.body, req.user);
    res.json(result);
  } catch (err) {
    console.error("updateSalesOrder error:", err);
    const status = err?.statusCode && Number.isFinite(err.statusCode) ? err.statusCode : 500;
    res.status(status).json({
      error: err?.code || "Failed to update sales order",
      details: err?.message,
    });
  } finally {
    conn?.release();
  }
}

async function deleteSalesOrder(req, res) {
  let conn;
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: "Invalid id" });
    conn = await service.getConn();
    const result = await service.deleteSalesOrder(conn, id, req.user);
    res.json(result);
  } catch (err) {
    console.error("deleteSalesOrder error:", err);
    const status = err?.statusCode && Number.isFinite(err.statusCode) ? err.statusCode : 500;
    res.status(status).json({
      error: err?.code || "Failed to delete sales order",
      details: err?.message,
    });
  } finally {
    conn?.release();
  }
}

module.exports = {
  listSalesOrders,
  getSalesOrder,
  createFromQuotation,
  confirmSalesOrder,
  createSalesOrder,
  updateSalesOrder,
  deleteSalesOrder,
};

