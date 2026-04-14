//backend/server/modules/enquiries/routes.js

const express = require("express");
const authMiddleware = require("../../middleware/auth");
const { requireAdminOrSales, requireQuotationCreation } = require("../../middleware/authorization");
const controller = require("./controller");

const router = express.Router();

// Create enquiry
router.post("/enquiries", authMiddleware, requireAdminOrSales, controller.createEnquiry);

// List enquiries
router.get("/enquiries", authMiddleware, requireAdminOrSales, controller.listEnquiries);

// Get single enquiry
router.get("/enquiries/:id", authMiddleware, requireAdminOrSales, controller.getEnquiry);

// Update enquiry
router.put("/enquiries/:id", authMiddleware, requireAdminOrSales, controller.updateEnquiry);

// Delete enquiry
router.delete("/enquiries/:id", authMiddleware, requireAdminOrSales, controller.deleteEnquiry);

// Convert enquiry -> quotation (creates a quotation draft snapshot)
router.post(
  "/enquiries/:id/convert-to-quotation",
  authMiddleware,
  requireQuotationCreation,
  controller.convertToQuotation,
);

module.exports = router;

