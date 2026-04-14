const service = require("./service");

async function getAvailableStock(req, res) {
  let conn;
  try {
    const productId = Number(req.params.productId);
    if (!Number.isFinite(productId) || productId <= 0) {
      return res.status(400).json({ error: "Invalid product id" });
    }
    conn = await service.getConn();
    const available = await service.getAvailableStock(conn, productId);
    res.json({ product_id: productId, available_qty: available });
  } catch (err) {
    console.error("getAvailableStock error:", err);
    res.status(500).json({ error: "Failed to get stock", details: err.message });
  } finally {
    conn?.release();
  }
}

async function getAvailableStockBulk(req, res) {
  let conn;
  try {
    const raw = String(req.query.product_ids || "");
    const ids = raw
      .split(",")
      .map((s) => Number(String(s).trim()))
      .filter((n) => Number.isFinite(n) && n > 0);

    conn = await service.getConn();
    const rows = await service.getAvailableStockBulk(conn, ids);
    res.json(rows);
  } catch (err) {
    console.error("getAvailableStockBulk error:", err);
    res.status(500).json({ error: "Failed to get stock", details: err.message });
  } finally {
    conn?.release();
  }
}

async function listLedger(req, res) {
  let conn;
  try {
    conn = await service.getConn();
    const rows = await service.listLedger(conn, req.query);
    res.json(rows);
  } catch (err) {
    console.error("listLedger error:", err);
    res.status(500).json({ error: "Failed to list ledger", details: err.message });
  } finally {
    conn?.release();
  }
}

async function getInStock(req, res) {
  let conn;
  try {
    conn = await service.getConn();
    const rows = await service.getInStock(conn, req.query);
    res.json(rows);
  } catch (err) {
    console.error("getInStock error:", err);
    res.status(500).json({ error: "Failed to load in-stock", details: err.message });
  } finally {
    conn?.release();
  }
}

async function inwardGrn(req, res) {
  let conn;
  try {
    conn = await service.getConn();
    await conn.beginTransaction();
    const result = await service.inwardGrn(conn, req.body, req.user);
    await conn.commit();
    res.json(result);
  } catch (err) {
    if (conn) await conn.rollback();
    console.error("inwardGrn error:", err);
    res.status(500).json({ error: "Failed to post GRN", details: err.message });
  } finally {
    conn?.release();
  }
}

async function inwardGrnFromPo(req, res) {
  let conn;
  try {
    const poId = Number(req.params.poId);
    if (!Number.isFinite(poId) || poId <= 0) return res.status(400).json({ error: "Invalid poId" });
    conn = await service.getConn();
    await conn.beginTransaction();
    const result = await service.inwardGrnFromPo(conn, poId, req.body, req.user);
    await conn.commit();
    res.json(result);
  } catch (err) {
    if (conn) await conn.rollback();
    console.error("inwardGrnFromPo error:", err);
    res.status(500).json({ error: "Failed to post GRN from PO", details: err.message });
  } finally {
    conn?.release();
  }
}

async function outwardDispatch(req, res) {
  let conn;
  try {
    conn = await service.getConn();
    await conn.beginTransaction();
    const result = await service.outwardDispatch(conn, req.body, req.user);
    await conn.commit();
    res.json(result);
  } catch (err) {
    if (conn) await conn.rollback();
    console.error("outwardDispatch error:", err);
    res.status(500).json({ error: "Failed to post dispatch stock", details: err.message });
  } finally {
    conn?.release();
  }
}

module.exports = {
  getAvailableStock,
  getAvailableStockBulk,
  inwardGrn,
  inwardGrnFromPo,
  outwardDispatch,
  listLedger,
  getInStock,
};

