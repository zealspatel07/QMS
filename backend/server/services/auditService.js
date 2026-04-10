// backend/server/services/auditService.js

const db = require('../db');

/**
 * Audit Service
 * 
 * Provides centralized logging of all user actions for compliance,
 * security auditing, and change tracking.
 */

class AuditService {
  /**
   * Log an action to the audit_logs table
   * 
   * @param {Object} options
   * @param {number} options.user_id - User performing the action
   * @param {string} options.user_email - User email
   * @param {string} options.user_name - User name
   * @param {string} options.action - CREATE, UPDATE, DELETE, APPROVE, REJECT, EXPORT, etc.
   * @param {string} options.module - QUOTATION, PURCHASE_ORDER, INDENT, CUSTOMER, etc.
   * @param {number} options.entity_id - ID of the affected entity
   * @param {string} options.entity_identifier - Human-readable identifier (Q001, PO-2026-001)
   * @param {Object} options.old_values - Previous state (for UPDATE/DELETE)
   * @param {Object} options.new_values - Current state (for CREATE/UPDATE)
   * @param {Object} options.changes - Summary of changes {field: {old, new}}
   * @param {string} options.ip_address - IP address of requester
   * @param {string} options.user_agent - Browser user agent
   * @param {boolean} options.is_success - Whether action succeeded
   * @param {string} options.error_message - Error message if failed
   * @returns {Promise<{success: boolean, auditId: number}>}
   */
  static async logAction(options = {}) {
    let conn;
    try {
      conn = await db.getConnection();

      const {
        user_id,
        user_email,
        user_name,
        action,
        module,
        entity_id,
        entity_identifier,
        old_values = null,
        new_values = null,
        changes = null,
        ip_address = null,
        user_agent = null,
        request_headers = null,
        is_success = true,
        error_message = null,
      } = options;

      // Validate required fields
      if (!user_id || !action || !module) {
        console.warn('❌ AuditService: Missing required fields', {
          user_id,
          action,
          module,
        });
        return { success: false, auditId: null };
      }

      // Insert audit log
      const [result] = await conn.query(
        `INSERT INTO audit_logs
        (user_id, user_email, user_name, action, module, entity_id, entity_identifier,
         old_values, new_values, changes, ip_address, user_agent, request_headers,
         is_success, error_message)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          user_id,
          user_email,
          user_name,
          action,
          module,
          entity_id || null,
          entity_identifier || null,
          old_values ? JSON.stringify(old_values) : null,
          new_values ? JSON.stringify(new_values) : null,
          changes ? JSON.stringify(changes) : null,
          ip_address,
          user_agent,
          request_headers ? JSON.stringify(request_headers) : null,
          is_success,
          error_message,
        ]
      );

      return {
        success: true,
        auditId: result.insertId,
      };
    } catch (err) {
      console.error('❌ AuditService.logAction failed:', err);
      return { success: false, auditId: null };
    } finally {
      if (conn) conn.release();
    }
  }

  /**
   * Helper: Extract changes between old and new objects
   * Returns only fields that changed and their before/after values
   */
  static getChanges(oldObj, newObj) {
    if (!oldObj || !newObj) return null;

    const changes = {};
    const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);

    for (const key of allKeys) {
      const oldVal = oldObj[key];
      const newVal = newObj[key];

      // Convert to strings for comparison (handles null, undefined, etc.)
      if (String(oldVal) !== String(newVal)) {
        changes[key] = { old: oldVal, new: newVal };
      }
    }

    return Object.keys(changes).length > 0 ? changes : null;
  }

  /**
   * Get audit logs with filtering
   * 
   * @param {Object} filters
   * @returns {Promise<Array>}
   */
  static async getLogs(filters = {}) {
    let conn;
    try {
      conn = await db.getConnection();

      let query = 'SELECT * FROM audit_logs WHERE 1=1';
      const params = [];

      if (filters.user_id) {
        query += ' AND user_id = ?';
        params.push(filters.user_id);
      }

      if (filters.action) {
        query += ' AND action = ?';
        params.push(filters.action);
      }

      if (filters.module) {
        query += ' AND module = ?';
        params.push(filters.module);
      }

      if (filters.entity_id) {
        query += ' AND entity_id = ?';
        params.push(filters.entity_id);
      }

      if (filters.from_date && filters.to_date) {
        query += ' AND created_at BETWEEN ? AND ?';
        params.push(filters.from_date, filters.to_date);
      }

      query += ' ORDER BY created_at DESC';

      if (filters.limit) {
        query += ' LIMIT ?';
        params.push(filters.limit);
      }

      const [rows] = await conn.query(query, params);

      // Parse JSON fields
      return rows.map(row => ({
        ...row,
        old_values: row.old_values ? JSON.parse(row.old_values) : null,
        new_values: row.new_values ? JSON.parse(row.new_values) : null,
        changes: row.changes ? JSON.parse(row.changes) : null,
        request_headers: row.request_headers ? JSON.parse(row.request_headers) : null,
      }));
    } catch (err) {
      console.error('❌ AuditService.getLogs failed:', err);
      return [];
    } finally {
      if (conn) conn.release();
    }
  }

  /**
   * Get audit history for a specific entity
   */
  static async getEntityHistory(entityId, entityType = 'quotation') {
    return this.getLogs({
      entity_id: entityId,
      module: entityType.toUpperCase(),
    });
  }
}

module.exports = AuditService;
