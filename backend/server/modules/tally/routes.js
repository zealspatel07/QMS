const express = require("express");
const authMiddleware = require("../../middleware/auth");
const { requireAdminOrSales } = require("../../middleware/authorization");
const controller = require("./controller");

const router = express.Router();

// Export invoices to JSON (Tally integration stub)
router.get("/tally/invoices", authMiddleware, requireAdminOrSales, controller.exportInvoicesJson);

module.exports = router;

