const service = require("./service");

async function exportInvoicesJson(req, res) {
  let conn;
  try {
    conn = await service.getConn();
    const data = await service.exportInvoicesJson(conn, req.query);
    res.json({ success: true, count: data.length, invoices: data });
  } catch (err) {
    console.error("exportInvoicesJson error:", err);
    res.status(500).json({ error: "Failed to export invoices", details: err.message });
  } finally {
    conn?.release();
  }
}

module.exports = { exportInvoicesJson };

