//backend/server/middleware/authorization.js

/* ============================================
   ROLE CHECK HELPERS
   ============================================ */

function isAdmin(role) {
  return role === "admin";
}

function isSales(role) {
  return role === "sales";
}

function isPurchase(role) {
  return role === "purchase";
}

function isViewer(role) {
  return role === "viewer";
}

/* ============================================
   PERMISSION MIDDLEWARE FACTORIES
   ============================================ */

/**
 * Admin access only
 */
function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: "unauthorized" });
  }

  if (!isAdmin(req.user.role)) {
    return res.status(403).json({
      error: "forbidden",
      message: "Admin access required",
    });
  }

  next();
}

/**
 * Admin or Sales
 * Usage: quotation creation, indent creation
 */
function requireAdminOrSales(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const { role } = req.user;
  if (!isAdmin(role) && !isSales(role)) {
    return res.status(403).json({
      error: "forbidden",
      message: "Sales or Admin access required",
    });
  }

  next();
}

/**
 * Admin or Purchase
 * Usage: PO creation, vendor management (contacts, edit)
 */
function requireAdminOrPurchase(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const { role } = req.user;
  if (!isAdmin(role) && !isPurchase(role)) {
    return res.status(403).json({
      error: "forbidden",
      message: "Purchase or Admin access required",
    });
  }

  next();
}

/**
 * Admin, Sales, or Purchase
 * Usage: Vendor creation (allows sales to create vendors during indent creation)
 */
function requireAdminOrSalesOrPurchase(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const { role } = req.user;
  if (!isAdmin(role) && !isSales(role) && !isPurchase(role)) {
    return res.status(403).json({
      error: "forbidden",
      message: "Admin, Sales, or Purchase access required",
    });
  }

  next();
}

/**
 * Quotations: Admin, Sales, or Viewer (read)
 */
function requireQuotationAccess(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const { role } = req.user;
  if (!isAdmin(role) && !isSales(role) && !isViewer(role)) {
    return res.status(403).json({
      error: "forbidden",
      message: "Quotation access denied",
    });
  }

  next();
}

/**
 * Quotations Create: Admin or Sales only
 */
function requireQuotationCreation(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const { role } = req.user;
  if (!isAdmin(role) && !isSales(role)) {
    return res.status(403).json({
      error: "forbidden",
      message: "Quotation creation denied",
    });
  }

  next();
}

/**
 * Indents: Admin, Sales, Purchase, or Viewer (read)
 */
function requireIndentAccess(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const { role } = req.user;
  // All roles can view indents
  next();
}

/**
 * Indents Create: Admin or Sales only
 */
function requireIndentCreation(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const { role } = req.user;
  if (!isAdmin(role) && !isSales(role)) {
    return res.status(403).json({
      error: "forbidden",
      message: "Indent creation denied",
    });
  }

  next();
}

/**
 * POs: Admin, Purchase, or Viewer (read)
 */
function requirePOAccess(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const { role } = req.user;
  if (!isAdmin(role) && !isPurchase(role) && !isViewer(role)) {
    return res.status(403).json({
      error: "forbidden",
      message: "Purchase order access denied",
    });
  }

  next();
}

/**
 * POs Create: Admin or Purchase only
 */
function requirePOCreation(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const { role } = req.user;
  if (!isAdmin(role) && !isPurchase(role)) {
    return res.status(403).json({
      error: "forbidden",
      message: "Purchase order creation denied",
    });
  }

  next();
}

/**
 * Vendors: Admin or Purchase only
 */
function requireVendorAccess(req, res, next) {

  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const allowed = ["admin", "purchase", "sales"];

  if (!allowed.includes(req.user.role)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  next();
}

/**
 * Customers: Admin, Sales, or Viewer
 */
function requireCustomerAccess(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const { role } = req.user;
  if (!isAdmin(role) && !isSales(role) && !isViewer(role)) {
    return res.status(403).json({
      error: "forbidden",
      message: "Customer access denied",
    });
  }

  next();
}

/**
 * Reports: All authenticated users
 */
function requireReportAccess(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: "unauthorized" });
  }

  next();
}

/**
 * User Management: Admin only
 */
function requireUserManagement(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: "unauthorized" });
  }

  if (!isAdmin(req.user.role)) {
    return res.status(403).json({
      error: "forbidden",
      message: "User management access denied",
    });
  }

  next();
}

/**
 * Settings: Admin only
 */
function requireSettingsAccess(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: "unauthorized" });
  }

  if (!isAdmin(req.user.role)) {
    return res.status(403).json({
      error: "forbidden",
      message: "Settings access denied",
    });
  }

  next();
}

/* ============================================
   EXPORTS
   ============================================ */

module.exports = {
  isAdmin,
  isSales,
  isPurchase,
  isViewer,
  requireAdmin,
  requireAdminOrSales,
  requireAdminOrPurchase,
  requireAdminOrSalesOrPurchase,
  requireQuotationAccess,
  requireQuotationCreation,
  requireIndentAccess,
  requireIndentCreation,
  requirePOAccess,
  requirePOCreation,
  requireVendorAccess,
  requireCustomerAccess,
  requireReportAccess,
  requireUserManagement,
  requireSettingsAccess,
};
