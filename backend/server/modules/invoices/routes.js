const express = require("express");
const authMiddleware = require("../../middleware/auth");
const { requireAdminOrSales } = require("../../middleware/authorization");
const controller = require("./controller");

const router = express.Router();

router.get("/invoices", authMiddleware, requireAdminOrSales, controller.listInvoices);
router.get("/invoices/:id", authMiddleware, requireAdminOrSales, controller.getInvoice);

router.post("/invoices/from-dispatch/:dispatchId", authMiddleware, requireAdminOrSales, controller.createFromDispatch);

router.put("/invoices/:id/payment", authMiddleware, requireAdminOrSales, controller.updatePayment);

module.exports = router;

