// backend/server/routes/erp-users.js
// User Management, Roles & System Settings API

const express = require('express');
const router = express.Router();
const db = require('../db');
const authMiddleware = require('../middleware/auth');

const bcrypt = require('bcryptjs');

const { requireAdmin } = require('../middleware/authorization');

// ============================================
// USERS API
// ============================================

// GET /api/erp/users - List all users with their roles
router.get('/users', authMiddleware, requireAdmin, async (req, res) => {
  let conn;
  try {
    conn = await db.getConnection();

    const [users] = await conn.query(`
      SELECT 
        u.id,
        u.username,
        u.email,
        u.name,
        u.created_at,
        GROUP_CONCAT(r.name SEPARATOR ',') as roles,
        GROUP_CONCAT(r.id SEPARATOR ',') as role_ids
      FROM users u
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      LEFT JOIN roles r ON ur.role_id = r.id
      GROUP BY u.id
      ORDER BY u.name
    `);

    res.json(users);
  } catch (err) {
    console.error('Failed to fetch users:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  } finally {
    if (conn) conn.release();
  }
});

// GET /api/erp/users/:id - Get single user with roles and permissions
router.get('/users/:id', authMiddleware, async (req, res) => {
  let conn;
  try {
    conn = await db.getConnection();

    const [userRows] = await conn.query(
      `SELECT id, username, email, name, created_at FROM users WHERE id = ?`,
      [req.params.id]
    );

    if (!userRows.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userRows[0];

    // Get user's roles WITH assignment info (assigned_at, assigned_by)
    const [roles] = await conn.query(`
      SELECT r.id, r.name, r.description, r.permissions, ur.assigned_at, ur.assigned_by
      FROM roles r
      INNER JOIN user_roles ur ON r.id = ur.role_id
      WHERE ur.user_id = ?
      ORDER BY ur.assigned_at DESC
    `, [req.params.id]);

    user.roles = roles;
    user.permissions = {};

    // Merge all permissions from all roles
    roles.forEach(role => {
      const perms = typeof role.permissions === 'string' ? JSON.parse(role.permissions) : role.permissions;
      Object.keys(perms).forEach(module => {
        user.permissions[module] = user.permissions[module] || [];
        user.permissions[module] = [...new Set([...user.permissions[module], ...perms[module]])];
      });
    });

    res.json(user);
  } catch (err) {
    console.error('Failed to fetch user:', err);
    res.status(500).json({ error: 'Failed to fetch user' });
  } finally {
    if (conn) conn.release();
  }
});

// PUT /api/erp/users/:id/assign-role - Assign or update user roles
router.put('/users/:id/assign-role', authMiddleware, requireAdmin, async (req, res) => {
  let conn;
  try {
    const { role_ids } = req.body; // Array of role IDs

    if (!Array.isArray(role_ids)) {
      return res.status(400).json({ error: 'role_ids must be an array' });
    }

    conn = await db.getConnection();
    await conn.beginTransaction();

    // Delete existing roles
    await conn.query(`DELETE FROM user_roles WHERE user_id = ?`, [req.params.id]);

    // Assign new roles
    for (const roleId of role_ids) {
      await conn.query(
        `INSERT INTO user_roles (user_id, role_id, assigned_by) VALUES (?, ?, ?)`,
        [req.params.id, roleId, req.user?.id || 1]
      );
    }

    // Log audit
    await conn.query(`
      INSERT INTO audit_logs (user_id, action, module, entity_type, entity_id, new_values)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      req.user?.id || 1,
      'UPDATE',
      'users',
      'user',
      req.params.id,
      JSON.stringify({ role_ids })
    ]);

    await conn.commit();
    res.json({ success: true, message: 'Roles assigned successfully' });
  } catch (err) {
    if (conn) await conn.rollback();
    console.error('Failed to assign roles:', err);
    res.status(500).json({ error: 'Failed to assign roles' });
  } finally {
    if (conn) conn.release();
  }
});

// ============================================
// ROLES API
// ============================================

// GET /api/erp/roles - List all roles
router.get('/roles', authMiddleware, async (req, res) => {
  let conn;
  try {
    conn = await db.getConnection();

    const [roles] = await conn.query(`
      SELECT 
        id,
        name,
        description,
        permissions,
        is_active,
        created_at
      FROM roles
      ORDER BY name
    `);

    // Parse permissions JSON
    const parsedRoles = roles.map(r => ({
      ...r,
      permissions: typeof r.permissions === 'string' ? JSON.parse(r.permissions) : r.permissions
    }));

    res.json(parsedRoles);
  } catch (err) {
    console.error('Failed to fetch roles:', err);
    res.status(500).json({ error: 'Failed to fetch roles' });
  } finally {
    if (conn) conn.release();
  }
});

// GET /api/erp/roles/:id - Get single role
router.get('/roles/:id', authMiddleware, async (req, res) => {
  let conn;
  try {
    conn = await db.getConnection();

    const [roleRows] = await conn.query(
      `SELECT * FROM roles WHERE id = ?`,
      [req.params.id]
    );

    if (!roleRows.length) {
      return res.status(404).json({ error: 'Role not found' });
    }

    const role = roleRows[0];
    role.permissions = typeof role.permissions === 'string' ? JSON.parse(role.permissions) : role.permissions;

    res.json(role);
  } catch (err) {
    console.error('Failed to fetch role:', err);
    res.status(500).json({ error: 'Failed to fetch role' });
  } finally {
    if (conn) conn.release();
  }
});

// PUT /api/erp/roles/:id - Update role permissions
router.put('/roles/:id', authMiddleware, requireAdmin, async (req, res) => {
  let conn;
  try {
    const { name, description, permissions } = req.body;

    conn = await db.getConnection();

    await conn.query(`
      UPDATE roles
      SET name = ?, description = ?, permissions = ?
      WHERE id = ?
    `, [name, description, JSON.stringify(permissions), req.params.id]);

    // Log audit
    await conn.query(`
      INSERT INTO audit_logs (user_id, action, module, entity_type, entity_id, new_values)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      req.user.id,
      'UPDATE',
      'roles',
      'role',
      req.params.id,
      JSON.stringify({ name, description, permissions })
    ]);

    res.json({ success: true, message: 'Role updated successfully' });
  } catch (err) {
    console.error('Failed to update role:', err);
    res.status(500).json({ error: 'Failed to update role' });
  } finally {
    if (conn) conn.release();
  }
});


// ✅ CREATE USER
router.post('/users', async (req, res) => {
  const {
    username,
    name,
    email,
    phone,
    position,
    role,
    password
  } = req.body || {};

  if (!username || !password || !name) {
    return res.status(400).json({
      error: 'missing_fields',
      message: 'username, name and password are required'
    });
  }

  let conn;
  try {
    conn = await db.getConnection();

    // ✅ Check username uniqueness ONLY
    const [existing] = await conn.query(
      'SELECT id FROM users WHERE username = ? LIMIT 1',
      [username]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        error: 'username_exists',
        message: 'Username already exists'
      });
    }

    // 🔐 Hash password
    const hash = await bcrypt.hash(password, 10);

    // ✅ Insert user (email NOT unique)
    const [result] = await conn.query(
      `INSERT INTO users 
        (username, name, email, phone, position, role, password_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        username,
        name,
        email || null,
        phone || null,
        position || null,
        role || 'sales',
        hash
      ]
    );

    return res.status(201).json({
      success: true,
      id: result.insertId
    });

  } catch (err) {
    console.error('Create user error:', err);

    return res.status(500).json({
      error: 'server_error',
      message: err.message
    });

  } finally {
    if (conn) conn.release();
  }
});

module.exports = router;


