// backend/server/middleware/auditMiddleware.js

const AuditService = require('../services/auditService');

/**
 * Audit Middleware
 * 
 * Captures request metadata for audit logging.
 * Attach this to specific routes that need audit trail tracking.
 * 
 * Usage:
 * router.post('/quotations', auditMiddleware, async (req, res) => {
 *   // Your handler
 *   req.auditData = { action: 'CREATE', module: 'QUOTATION', ... }
 *   // At the end, call await AuditService.logAction(req.auditData)
 * });
 */

function captureAuditData(req, res, next) {
  // Extract IP address (handle proxy)
  const getClientIp = (req) => {
    return (
      req.headers['x-forwarded-for']?.split(',')[0].trim() ||
      req.headers['x-real-ip'] ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      'unknown'
    );
  };

  // Store audit context on request object
  req.auditContext = {
    user_id: req.user?.id,
    user_email: req.user?.email,
    user_name: req.user?.name,
    ip_address: getClientIp(req),
    user_agent: req.headers['user-agent'],
    request_headers: {
      'content-type': req.headers['content-type'],
      'origin': req.headers['origin'],
    },
  };

  next();
}

/**
 * Helper: Log action with context
 * Call this at the end of your route handler
 */
async function logAuditAction(auditContext, auditData) {
  const payload = {
    ...auditContext,
    ...auditData,
  };

  return AuditService.logAction(payload);
}

module.exports = {
  captureAuditData,
  logAuditAction,
};
