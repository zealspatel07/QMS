// backend/server/routes/audit-logs.js

const express = require('express');
const router = express.Router();
const db = require('../db');
const AuditService = require('../services/auditService');

const authMiddleware = require('../middleware/auth');
const { requireAdmin } = require('../middleware/authorization');

/**
 * GET /api/audit-logs
 * 
 * Fetch audit logs with filtering and pagination
 * Admin only
 */
router.get('/', authMiddleware, requireAdmin, async (req, res) => {
  let conn;
  try {
    const {
      user_id,
      action,
      module,
      entity_id,
      from_date,
      to_date,
      limit = 100,
      offset = 0,
    } = req.query;

    conn = await db.getConnection();

    let query = 'SELECT * FROM audit_logs WHERE 1=1';
    const params = [];

    if (user_id) {
      query += ' AND user_id = ?';
      params.push(user_id);
    }

    if (action) {
      query += ' AND action = ?';
      params.push(action);
    }

    if (module) {
      query += ' AND module = ?';
      params.push(module);
    }

    if (entity_id) {
      query += ' AND entity_id = ?';
      params.push(entity_id);
    }

    if (from_date && to_date) {
      query += ' AND created_at BETWEEN ? AND ?';
      params.push(from_date, to_date);
    }

    // Get total count
    const countQuery = query.replace('SELECT * FROM', 'SELECT COUNT(*) as count FROM');
    console.log('Count query:', countQuery);
    console.log('Count params:', params);
    
    const [countResult] = await conn.query(countQuery, params);
    
    if (!countResult || countResult.length === 0) {
      return res.json({
        data: [],
        total: 0,
        limit: parseInt(limit),
        offset: parseInt(offset),
      });
    }
    
    const total = countResult[0].count || 0;
    console.log('Total count:', total);

    // Get paginated data
    const dataQuery = query + ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    console.log('Data query:', dataQuery);
    console.log('Data params:', [...params, parseInt(limit), parseInt(offset)]);
    
    const [rows] = await conn.query(dataQuery, [...params, parseInt(limit), parseInt(offset)]);

    console.log('Rows returned:', rows.length);

    // Parse JSON fields
    const parsed = rows.map(row => ({
      ...row,
      old_values: row.old_values ? (typeof row.old_values === 'string' ? JSON.parse(row.old_values) : row.old_values) : null,
      new_values: row.new_values ? (typeof row.new_values === 'string' ? JSON.parse(row.new_values) : row.new_values) : null,
      changes: row.changes ? (typeof row.changes === 'string' ? JSON.parse(row.changes) : row.changes) : null,
    }));

    res.json({
      data: parsed,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  } catch (err) {
    console.error('Audit logs fetch error:', err);
    console.error('Error details:', err.message, err.stack);
    res.status(500).json({ error: 'Failed to fetch audit logs', details: err.message });
  } finally {
    if (conn) conn.release();
  }
});

/**
 * GET /api/audit-logs/entity/:entityId
 * 
 * Get audit history for a specific entity (e.g., quotation change timeline)
 */
router.get('/entity/:entityId', authMiddleware, async (req, res) => {
  try {
    const { entityId } = req.params;
    const histories = await AuditService.getEntityHistory(entityId);

    res.json({
      entity_id: entityId,
      history: histories,
    });
  } catch (err) {
    console.error('Entity history fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch entity history' });
  }
});

/**
 * GET /api/audit-logs/stats
 * 
 * Get audit statistics (user activity, action distribution, etc.)
 */
router.get('/stats', authMiddleware, requireAdmin, async (req, res) => {
  let conn;
  try {
    conn = await db.getConnection();

    // Actions distribution
    const [[actionStats]] = await conn.query(`
      SELECT
        action,
        COUNT(*) as count
      FROM audit_logs
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY action
      ORDER BY count DESC
    `);

    // Top users
    const [[userStats]] = await conn.query(`
      SELECT
        user_id,
        user_name,
        COUNT(*) as count
      FROM audit_logs
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY user_id
      ORDER BY count DESC
      LIMIT 10
    `);

    // Module distribution
    const [[moduleStats]] = await conn.query(`
      SELECT
        module,
        COUNT(*) as count
      FROM audit_logs
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY module
      ORDER BY count DESC
    `);

    res.json({
      actions: actionStats || [],
      topUsers: userStats || [],
      modules: moduleStats || [],
      period: 'Last 30 days',
    });
  } catch (err) {
    console.error('Audit stats error:', err);
    res.status(500).json({ error: 'Failed to fetch audit stats', details: err.message });
  } finally {
    if (conn) conn.release();
  }
});

module.exports = router;
