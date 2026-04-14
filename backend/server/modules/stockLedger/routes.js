const express = require("express");
const authMiddleware = require("../../middleware/auth");
const { requireAdminOrPurchase, requireAdminOrSales } = require("../../middleware/authorization");
const controller = require("./controller");

const router = express.Router();

// Available stock for a product (calculated from stock_ledger)
router.get("/stock-ledger/available/:productId", authMiddleware, requireAdminOrSales, controller.getAvailableStock);

// Bulk available stock: /api/stock-ledger/available?product_ids=1,2,3
router.get("/stock-ledger/available", authMiddleware, requireAdminOrSales, controller.getAvailableStockBulk);

// Inward GRN (from PO or manual) - purchase/admin
router.post("/stock-ledger/inward-grn", authMiddleware, requireAdminOrPurchase, controller.inwardGrn);

// GRN from purchase order receiving (idempotent delta posting)
router.post("/grn/from-po/:poId", authMiddleware, requireAdminOrPurchase, controller.inwardGrnFromPo);

// Outward dispatch booking - sales/admin (normally called from dispatch module)
router.post("/stock-ledger/outward-dispatch", authMiddleware, requireAdminOrSales, controller.outwardDispatch);

// Ledger list (paged)
router.get("/stock-ledger", authMiddleware, requireAdminOrSales, controller.listLedger);

// In-stock aggregation (grouped by product)
router.get("/in-stock", authMiddleware, requireAdminOrSales, controller.getInStock);

module.exports = router;

