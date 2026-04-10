// server/utils/auditLogger.js

/**
 * Log an action to audit_logs table
 */
async function logAudit(db, {
  entity_type,
  entity_id,
  action,
  changed_by,
  ip_address,
  user_agent
}) {
  try {
    const conn = await db.getConnection();
    await conn.query(
      `INSERT INTO audit_logs 
       (entity_type, entity_id, action, changed_by, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [entity_type, entity_id, action, changed_by, ip_address, user_agent]
    );
    conn.release();
  } catch (err) {
    console.error('Failed to log audit:', err.message);
    // Don't throw - silently log failures
  }
}

/**
 * Middleware to capture request metadata
 */
function getAuditMetadata(req) {
  return {
    ip_address: req.ip || req.connection.remoteAddress || 'unknown',
    user_agent: req.headers['user-agent'] || 'unknown'
  };
}

module.exports = {
  logAudit,
  getAuditMetadata
};
