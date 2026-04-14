const service = require("./service");

async function listInvoices(req, res) {
  let conn;
  try {
    conn = await service.getConn();
    const rows = await service.listInvoices(conn, req.query);
    res.json(rows);
  } catch (err) {
    console.error("listInvoices error:", err);
    res.status(500).json({ error: "Failed to list invoices", details: err.message });
  } finally {
    conn?.release();
  }
}

async function getInvoice(req, res) {
  let conn;
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: "Invalid id" });
    conn = await service.getConn();
    const inv = await service.getInvoice(conn, id);
    if (!inv) return res.status(404).json({ error: "Invoice not found" });
    res.json(inv);
  } catch (err) {
    console.error("getInvoice error:", err);
    res.status(500).json({ error: "Failed to fetch invoice", details: err.message });
  } finally {
    conn?.release();
  }
}

async function createFromDispatch(req, res) {
  let conn;
  try {
    const dispatchId = Number(req.params.dispatchId);
    if (!Number.isFinite(dispatchId) || dispatchId <= 0) return res.status(400).json({ error: "Invalid dispatch id" });
    conn = await service.getConn();
    await conn.beginTransaction();
    const result = await service.createFromDispatch(conn, dispatchId, req.body, req.user);
    await conn.commit();
    res.json(result);
  } catch (err) {
    if (conn) await conn.rollback();
    console.error("createFromDispatch error:", err);
    res.status(500).json({ error: "Failed to create invoice", details: err.message });
  } finally {
    conn?.release();
  }
}

async function updatePayment(req, res) {
  let conn;
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: "Invalid id" });
    conn = await service.getConn();
    const result = await service.updatePayment(conn, id, req.body, req.user);
    res.json(result);
  } catch (err) {
    console.error("updatePayment error:", err);
    res.status(500).json({ error: "Failed to update payment", details: err.message });
  } finally {
    conn?.release();
  }
}

module.exports = {
  listInvoices,
  getInvoice,
  createFromDispatch,
  updatePayment,
};

