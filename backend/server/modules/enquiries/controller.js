//backend/server/modules/enquiries/controller.js

const service = require("./service");

async function createEnquiry(req, res) {
  let conn;
  try {
    conn = await service.getConn();
    const result = await service.createEnquiry(conn, req.body, req.user);
    res.json(result);
  } catch (err) {
    console.error("createEnquiry error:", err);
    res.status(500).json({ error: "Failed to create enquiry", details: err.message });
  } finally {
    conn?.release();
  }
}

async function listEnquiries(req, res) {
  let conn;
  try {
    conn = await service.getConn();
    const rows = await service.listEnquiries(conn, req.query);
    res.json(rows);
  } catch (err) {
    console.error("listEnquiries error:", err);
    res.status(500).json({ error: "Failed to list enquiries", details: err.message });
  } finally {
    conn?.release();
  }
}

async function getEnquiry(req, res) {
  let conn;
  try {
    const enquiryId = Number(req.params.id);
    if (!Number.isFinite(enquiryId) || enquiryId <= 0) {
      return res.status(400).json({ error: "Invalid enquiry id" });
    }

    conn = await service.getConn();
    const row = await service.getEnquiryById(conn, enquiryId);
    if (!row) return res.status(404).json({ error: "Enquiry not found" });
    res.json(row);
  } catch (err) {
    console.error("getEnquiry error:", err);
    res.status(500).json({ error: "Failed to get enquiry", details: err.message });
  } finally {
    conn?.release();
  }
}

async function updateEnquiry(req, res) {
  let conn;
  try {
    const enquiryId = Number(req.params.id);
    if (!Number.isFinite(enquiryId) || enquiryId <= 0) {
      return res.status(400).json({ error: "Invalid enquiry id" });
    }

    conn = await service.getConn();
    const result = await service.updateEnquiry(conn, enquiryId, req.body, req.user);
    res.json(result);
  } catch (err) {
    console.error("updateEnquiry error:", err);
    res.status(500).json({ error: "Failed to update enquiry", details: err.message });
  } finally {
    conn?.release();
  }
}

async function deleteEnquiry(req, res) {
  let conn;
  try {
    const enquiryId = Number(req.params.id);
    if (!Number.isFinite(enquiryId) || enquiryId <= 0) {
      return res.status(400).json({ error: "Invalid enquiry id" });
    }

    conn = await service.getConn();
    const result = await service.deleteEnquiry(conn, enquiryId);
    if (!result?.success) return res.status(404).json({ error: "Enquiry not found" });
    res.json(result);
  } catch (err) {
    console.error("deleteEnquiry error:", err);
    res.status(500).json({ error: "Failed to delete enquiry", details: err.message });
  } finally {
    conn?.release();
  }
}

async function convertToQuotation(req, res) {
  let conn;
  try {
    const enquiryId = Number(req.params.id);
    if (!Number.isFinite(enquiryId) || enquiryId <= 0) {
      return res.status(400).json({ error: "Invalid enquiry id" });
    }

    conn = await service.getConn();
    await conn.beginTransaction();
    const result = await service.convertEnquiryToQuotation(conn, enquiryId, req.body, req.user);
    await conn.commit();
    res.json(result);
  } catch (err) {
    if (conn) await conn.rollback();
    console.error("convertToQuotation error:", err);
    res.status(500).json({ error: "Failed to convert enquiry", details: err.message });
  } finally {
    conn?.release();
  }
}

module.exports = {
  createEnquiry,
  listEnquiries,
  getEnquiry,
  updateEnquiry,
  deleteEnquiry,
  convertToQuotation,
};

