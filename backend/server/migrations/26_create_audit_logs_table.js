const db = require('../db');

/**
 * Migration 19: Create Audit Logs Table
 * 
 * Tracks all user actions (create, update, delete, approve, etc.)
 * for compliance, security, and analytics
 */

async function migrate() {
  let conn;
  try {
    conn = await db.getConnection();

    // Check if table exists
    const [tables] = await conn.query(
      "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'audit_logs'"
    );

    if (tables.length > 0) {
      console.log('✅ audit_logs table already exists');
      return;
    }

    // Create audit_logs table
    await conn.query(`
      CREATE TABLE audit_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        
        -- WHO: User Information
        user_id INT NOT NULL,
        user_email VARCHAR(255),
        user_name VARCHAR(255),
        
        -- WHAT: Action Details
        action VARCHAR(50) NOT NULL,  -- CREATE, UPDATE, DELETE, APPROVE, REJECT, EXPORT, etc.
        
        -- WHERE: Module Information
        module VARCHAR(50) NOT NULL,  -- QUOTATION, PURCHASE_ORDER, INDENT, CUSTOMER, PRODUCT, VENDOR, etc.
        
        -- WHICH: Entity Reference
        entity_id INT,
        entity_type VARCHAR(100),  -- quotation_no, po_number, indent_number, etc.
        entity_identifier VARCHAR(255),  -- Human-readable ID (Q001, PO-2026-001, etc.)
        
        -- CHANGES: Before/After Data (JSON)
        old_values JSON,  -- Previous state (for UPDATE/DELETE)
        new_values JSON,  -- Current state (for CREATE/UPDATE)
        changes JSON,     -- Summary of what changed {field: {old: X, new: Y}}
        
        -- META: Request/Environment Information
        ip_address VARCHAR(45),  -- IPv4 or IPv6
        user_agent TEXT,
        request_headers JSON,
        
        -- STATUS
        is_success BOOLEAN DEFAULT true,
        error_message TEXT,
        
        -- TIMESTAMPS
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        -- INDEXES for performance
        INDEX idx_user_id (user_id),
        INDEX idx_module (module),
        INDEX idx_action (action),
        INDEX idx_created_at (created_at),
        INDEX idx_entity (entity_id, entity_type),
        INDEX idx_combined (module, action, created_at)
      )
      ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log('✅ Created audit_logs table');

  } catch (err) {
    console.error('❌ Migration 19 failed:', err);
    throw err;
  } finally {
    if (conn) conn.release();
  }
}

module.exports = { migrate };
