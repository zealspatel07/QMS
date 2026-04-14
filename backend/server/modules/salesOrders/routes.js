//backend/server/modules/salesOrders/routes.js

const express = require("express");
const authMiddleware = require("../../middleware/auth");
const { requireAdminOrSales, requireQuotationCreation } = require("../../middleware/authorization");
const controller = require("./controller");

const router = express.Router();

// List sales orders
router.get("/sales-orders", authMiddleware, requireAdminOrSales, controller.listSalesOrders);
router.get("/sales-orders/:id", authMiddleware, requireAdminOrSales, controller.getSalesOrder);

// Convert quotation -> sales order (locks pricing snapshot)
router.post(
  "/sales-orders/from-quotation/:quotationId",
  authMiddleware,
  requireQuotationCreation,
  controller.createFromQuotation,
);

// Create standalone sales order
router.post(
  "/sales-orders",
  authMiddleware,
  requireAdminOrSales,
  controller.createSalesOrder,
);

// Confirm sales order (immutable after confirmation)
router.post("/sales-orders/:id/confirm", authMiddleware, requireAdminOrSales, controller.confirmSalesOrder);

// Update sales order
router.patch("/sales-orders/:id", authMiddleware, requireAdminOrSales, controller.updateSalesOrder);

// Delete sales order
router.delete("/sales-orders/:id", authMiddleware, requireAdminOrSales, controller.deleteSalesOrder);

module.exports = router;

