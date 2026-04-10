// backend/server/routes/erp-settings.js
// System Settings & Notification API

const express = require('express');
const router = express.Router();
const db = require('../db');
const authMiddleware = require('../middleware/auth');
const nodemailer = require('nodemailer');

const { requireAdmin } = require('../middleware/authorization');

// ============================================
// SYSTEM SETTINGS API
// ============================================

// GET /api/erp/settings - Get all system settings
router.get('/settings', authMiddleware, async (req, res) => {
  let conn;
  try {
    conn = await db.getConnection();

    const [settings] = await conn.query(`
      SELECT 
        id,
        setting_key,
        setting_value,
        data_type,
        category,
        description
      FROM system_settings
      WHERE is_active = TRUE
      ORDER BY category, setting_key
    `);

    // Convert to object for easier access
    const settingsObj = {};
    settings.forEach(s => {
      let value = s.setting_value;
      if (s.data_type === 'boolean') {
        value = value === 'true' || value === '1';
      } else if (s.data_type === 'number') {
        value = Number(value);
      } else if (s.data_type === 'json') {
        value = JSON.parse(value);
      }
      settingsObj[s.setting_key] = value;
    });

    res.json(settingsObj);
  } catch (err) {
    console.error('Failed to fetch settings:', err);
    res.status(500).json({ error: 'Failed to fetch settings' });
  } finally {
    if (conn) conn.release();
  }
});

// GET /api/erp/settings/:key - Get single setting
router.get('/settings/:key', authMiddleware, async (req, res) => {
  let conn;
  try {
    conn = await db.getConnection();

    const [settingRows] = await conn.query(
      `SELECT * FROM system_settings WHERE setting_key = ?`,
      [req.params.key]
    );

    if (!settingRows.length) {
      return res.status(404).json({ error: 'Setting not found' });
    }

    const setting = settingRows[0];
    
    // Convert value based on type
    if (setting.data_type === 'boolean') {
      setting.setting_value = setting.setting_value === 'true' || setting.setting_value === '1';
    } else if (setting.data_type === 'number') {
      setting.setting_value = Number(setting.setting_value);
    } else if (setting.data_type === 'json') {
      setting.setting_value = JSON.parse(setting.setting_value);
    }

    res.json(setting);
  } catch (err) {
    console.error('Failed to fetch setting:', err);
    res.status(500).json({ error: 'Failed to fetch setting' });
  } finally {
    if (conn) conn.release();
  }
});

// PUT /api/erp/settings/:key - Update system setting
router.put('/settings/:key', authMiddleware, requireAdmin, async (req, res) => {
  let conn;
  try {
    const { setting_value } = req.body;

    conn = await db.getConnection();

    await conn.query(
      `UPDATE system_settings SET setting_value = ? WHERE setting_key = ?`,
      [String(setting_value), req.params.key]
    );

    // Log audit
    await conn.query(`
      INSERT INTO audit_logs (user_id, action, module, entity_type, entity_id, new_values)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      req.user.id,
      'UPDATE',
      'settings',
      'setting',
      null,
      JSON.stringify({ [req.params.key]: setting_value })
    ]);

    res.json({ success: true, message: 'Setting updated successfully' });
  } catch (err) {
    console.error('Failed to update setting:', err);
    res.status(500).json({ error: 'Failed to update setting' });
  } finally {
    if (conn) conn.release();
  }
});

// ============================================
// NOTIFICATIONS API
// ============================================

// GET /api/erp/notifications - Get user's notifications
router.get('/notifications', authMiddleware, async (req, res) => {
  let conn;
  try {
    conn = await db.getConnection();

    const [notifications] = await conn.query(`
      SELECT *
      FROM notifications
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 50
    `, [req.user.id]);

    res.json(notifications);
  } catch (err) {
    console.error('Failed to fetch notifications:', err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  } finally {
    if (conn) conn.release();
  }
});

// POST /api/erp/notifications/send-email - Send email notification
router.post('/notifications/send-email', authMiddleware, async (req, res) => {
  let conn;
  try {
    const {
      to_email,
      to_user_id,
      subject,
      body,
      email_type,
      reference_type,
      reference_id
    } = req.body;

    conn = await db.getConnection();

    // Get email settings
    const [[emailSettings]] = await conn.query(`
      SELECT setting_value as enabled
      FROM system_settings
      WHERE setting_key = 'email_enabled'
    `);

    if (!emailSettings || emailSettings.enabled !== 'true') {
      return res.status(400).json({ error: 'Email notifications are disabled' });
    }

    // Get SMTP settings
    const [smtpSettings] = await conn.query(`
      SELECT setting_key, setting_value
      FROM system_settings
      WHERE setting_key IN ('email_smtp_host', 'email_smtp_port', 'email_from_address', 'email_from_name')
    `);

    const config = {};
    smtpSettings.forEach(s => {
      config[s.setting_key] = s.setting_value;
    });

    // Create transporter
    const transporter = nodemailer.createTransport({
      host: config.email_smtp_host,
      port: Number(config.email_smtp_port),
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    // Send email
    const mailOptions = {
      from: `${config.email_from_name} <${config.email_from_address}>`,
      to: to_email,
      subject: subject,
      html: body,
    };

    await transporter.sendMail(mailOptions);

    // Log email
    await conn.query(`
      INSERT INTO email_logs (from_user_id, to_email, subject, email_type, reference_type, reference_id, status)
      VALUES (?, ?, ?, ?, ?, ?, 'sent')
    `, [req.user.id, to_email, subject, email_type, reference_type, reference_id]);

    // Create notification for recipient if user_id provided
    if (to_user_id) {
      await conn.query(`
        INSERT INTO notifications (user_id, title, message, notification_type, reference_type, reference_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        to_user_id,
        subject,
        body,
        'email',
        reference_type,
        reference_id
      ]);
    }

    res.json({ success: true, message: 'Email sent successfully' });
  } catch (err) {
    console.error('Failed to send email:', err);

    // Log error
    if (conn) {
      await conn.query(`
        INSERT INTO email_logs (from_user_id, to_email, subject, email_type, status, error_message)
        VALUES (?, ?, ?, ?, 'failed', ?)
      `, [req.user.id, req.body.to_email, req.body.subject, req.body.email_type, err.message]);
    }

    res.status(500).json({ error: 'Failed to send email', details: err.message });
  } finally {
    if (conn) conn.release();
  }
});

// POST /api/erp/notifications/send-to-role - Send email to all users with a role
router.post('/notifications/send-to-role', authMiddleware, requireAdmin, async (req, res) => {
  let conn;
  try {
    const { role_name, subject, body, email_type, reference_type, reference_id } = req.body;

    conn = await db.getConnection();

    // Get all users with the role
    const [users] = await conn.query(`
      SELECT DISTINCT u.id, u.email
      FROM users u
      INNER JOIN user_roles ur ON u.id = ur.user_id
      INNER JOIN roles r ON ur.role_id = r.id
      WHERE r.name = ?
    `, [role_name]);

    const results = [];
    for (const user of users) {
      try {
        // Send email via notification endpoint
        await new Promise((resolve, reject) => {
          const mailOptions = {
            from: `QMS System <noreply@company.com>`,
            to: user.email,
            subject: subject,
            html: body,
          };

          // In production, use nodemailer
          // For now, just log
          console.log(`Email queued for ${user.email}: ${subject}`);

          results.push({
            user_id: user.id,
            email: user.email,
            status: 'queued'
          });

          resolve();
        });
      } catch (err) {
        results.push({
          user_id: user.id,
          email: user.email,
          status: 'failed',
          error: err.message
        });
      }
    }

    res.json({
      success: true,
      message: `Notifications queued for ${users.length} users`,
      results
    });
  } catch (err) {
    console.error('Failed to send notifications:', err);
    res.status(500).json({ error: 'Failed to send notifications' });
  } finally {
    if (conn) conn.release();
  }
});

module.exports = router;
