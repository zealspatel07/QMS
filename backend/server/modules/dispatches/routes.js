//backend/server/modules/dispatches/routes.js

const express = require("express");
const authMiddleware = require("../../middleware/auth");
const { requireAdminOrSales } = require("../../middleware/authorization");
const controller = require("./controller");

const router = express.Router();

router.post("/dispatches", authMiddleware, requireAdminOrSales, controller.createDispatch);
router.get("/dispatches", authMiddleware, requireAdminOrSales, controller.listDispatches);
router.get("/dispatches/:id", authMiddleware, requireAdminOrSales, controller.getDispatch);
router.patch("/dispatches/:id", authMiddleware, requireAdminOrSales, controller.updateDispatch);
router.delete("/dispatches/:id", authMiddleware, requireAdminOrSales, controller.deleteDispatch);

module.exports = router;

