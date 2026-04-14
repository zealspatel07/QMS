//backend/server/modules/dispatches/controller.js

const service = require("./service");

async function createDispatch(req, res) {
  let conn;
  try {
    conn = await service.getConn();
    await conn.beginTransaction();
    const result = await service.createDispatch(conn, req.body, req.user);
    await conn.commit();
    res.json(result);
  } catch (err) {
    if (conn) await conn.rollback();
    console.error("createDispatch error:", err);
    const status = err?.statusCode && Number.isFinite(err.statusCode) ? err.statusCode : 500;
    res.status(status).json({
      error: err?.code || (status === 400 ? "VALIDATION_ERROR" : "Failed to create dispatch"),
      details: err?.message,
    });
  } finally {
    conn?.release();
  }
}

async function listDispatches(req, res) {
  let conn;
  try {
    conn = await service.getConn();
    const rows = await service.listDispatches(conn, req.query);
    res.json(rows);
  } catch (err) {
    console.error("listDispatches error:", err);
    res.status(500).json({ error: "Failed to list dispatches", details: err.message });
  } finally {
    conn?.release();
  }
}

async function getDispatch(req, res) {
  let conn;
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: "Invalid id" });
    conn = await service.getConn();
    const d = await service.getDispatch(conn, id);
    if (!d) return res.status(404).json({ error: "Dispatch not found" });
    res.json(d);
  } catch (err) {
    console.error("getDispatch error:", err);
    res.status(500).json({ error: "Failed to fetch dispatch", details: err.message });
  } finally {
    conn?.release();
  }
}

async function updateDispatch(req, res) {
  let conn;
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: "Invalid id" });
    conn = await service.getConn();
    const result = await service.updateDispatch(conn, id, req.body, req.user);
    res.json(result);
  } catch (err) {
    console.error("updateDispatch error:", err);
    const status = err?.statusCode && Number.isFinite(err.statusCode) ? err.statusCode : 500;
    res.status(status).json({
      error: err?.code || "Failed to update dispatch",
      details: err?.message,
    });
  } finally {
    conn?.release();
  }
}

async function deleteDispatch(req, res) {
  let conn;
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: "Invalid id" });
    conn = await service.getConn();
    await conn.beginTransaction();
    const result = await service.deleteDispatch(conn, id, req.user);
    await conn.commit();
    res.json(result);
  } catch (err) {
    if (conn) await conn.rollback();
    console.error("deleteDispatch error:", err);
    const status = err?.statusCode && Number.isFinite(err.statusCode) ? err.statusCode : 500;
    res.status(status).json({
      error: err?.code || "Failed to delete dispatch",
      details: err?.message,
    });
  } finally {
    conn?.release();
  }
}

module.exports = {
  createDispatch,
  listDispatches,
  getDispatch,
  updateDispatch,
  deleteDispatch,
};

