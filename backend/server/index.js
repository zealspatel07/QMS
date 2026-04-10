// server/index.js:-

const path = require("path");
require("dotenv").config({
  path: path.resolve(__dirname, "../.env"),
});

const express = require('express');
const cors = require('cors');
const { DB_NAME, ...db } = require('./db'); // must expose getConnection() and endPool()
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { spawnSync } = require("child_process");

console.log("DB ENV CHECK:", {
  DB_HOST: process.env.DB_HOST,
  DB_USER: process.env.DB_USER,
  DB_NAME: DB_NAME,
  DB_PORT: process.env.DB_PORT,
});

const http = require('http');
const { calculateTotals } = require('./utils/quotationCalculator');
const { Server } = require('socket.io');
const { getSettingsFromDB } = require("./utils/settings");
const crypto = require('crypto');

const nodemailer = require('nodemailer');

const {
  requireAdmin,
  requireAdminOrSales,
  requireQuotationAccess,
  requireQuotationCreation,
  requireUserManagement,
  requireSettingsAccess,
  requireAdminOrPurchase,
} = require('./middleware/authorization');

const dashboardRoutes = require("./routes/dashboard");
const purchaseDashboardRoutes = require("./routes/purchase-dashboard");
const customerRoutes = require("./routes/customers");
const indentRoutes = require('./routes/indent');
const purchaseRoutes = require("./routes/purchaseOrders");
const vendorRoutes = require("./routes/vendors");
const app = express();

const XLSX = require('xlsx');
const multer = require('multer');


const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5 MB safety limit
});

// Serve static public assets (frontend expects /logo.png etc.)

// ---------- CORS ----------
const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser requests (Postman, curl, same-origin)
    if (!origin) return callback(null, true);

    // Allow if no origin restrictions configured
    if (allowedOrigins.length === 0) return callback(null, true);

    // Allow whitelisted origins
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Reject everything else
    return callback(
      new Error(`CORS blocked origin: ${origin}`)
    );
  },

  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "Accept",
    "X-Requested-With",
  ],
  credentials: true,
  optionsSuccessStatus: 204,
};

// 🔐 APPLY CORS FIRST
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

// 🔐 BODY PARSER AFTER CORS
app.use(express.json({ limit: "1mb" }));


/*-----------App settings------*/


app.get('/api/settings', authMiddleware, requireSettingsAccess, async (req, res) => {
  // Only Admin can read - requireSettingsAccess already validates this

  let conn;
  try {
    conn = await db.getConnection();
    const [[row]] = await conn.query(
      'SELECT * FROM app_settings WHERE id = 1'
    );
    res.json(row || {});
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load settings' });
  } finally {
    conn?.release();
  }
});


app.get('/api/settings/terms', authMiddleware, async (req, res) => {
  let conn;
  try {
    conn = await db.getConnection();
    const [[row]] = await conn.query(
      `SELECT terms_conditions, terms_applied_at, terms_applied_by
        FROM app_settings
        WHERE id = 1`
    );

    return res.json({
      terms: row?.terms_conditions ?? "",
      applied_at: row?.terms_applied_at ?? null,
      applied_by: row?.terms_applied_by ?? null,
    });
  } catch (err) {
    console.error('fetch terms error', err);
    res.status(500).json({ error: 'failed_to_fetch_terms' });
  } finally {
    conn?.release();
  }
});

app.post('/api/settings/terms/draft', authMiddleware, requireSettingsAccess, async (req, res) => {
  // Only Admin can update - requireSettingsAccess already validates this

  const { terms } = req.body || {};
  if (typeof terms !== 'string') {
    return res.status(400).json({ error: 'invalid_terms' });
  }

  let conn;
  try {
    conn = await db.getConnection();
    await conn.query(
      `UPDATE app_settings
        SET terms_conditions = ?
        WHERE id = 1`,
      [terms]
    );

    res.json({ success: true, draft: true });
  } catch (err) {
    console.error('save terms draft error', err);
    res.status(500).json({ error: 'failed_to_save_draft' });
  } finally {
    conn?.release();
  }
});

app.post('/api/settings/terms/apply', authMiddleware, requireSettingsAccess, async (req, res) => {
  // Only Admin can apply - requireSettingsAccess already validates this

  const { terms } = req.body || {};
  if (typeof terms !== 'string' || !terms.trim()) {
    return res.status(400).json({ error: 'terms_required' });
  }

  let conn;
  try {
    conn = await db.getConnection();
    await conn.query(
      `UPDATE app_settings
        SET terms_conditions = ?,
            terms_applied_at = NOW(),
            terms_applied_by = ?
        WHERE id = 1`,
      [terms, req.user.id]
    );

    res.json({ success: true, applied: true });
  } catch (err) {
    console.error('apply terms error', err);
    res.status(500).json({ error: 'failed_to_apply_terms' });
  } finally {
    conn?.release();
  }
});


app.get('/api/settings/po-terms', authMiddleware, async (req, res) => {
  let conn;
  try {
    conn = await db.getConnection();
    const [[row]] = await conn.query(
      `SELECT po_terms_conditions
       FROM app_settings
       WHERE id = 1`
    );

    return res.json({
      terms: row?.po_terms_conditions ?? ""
    });

  } catch (err) {
    console.error('fetch po terms error', err);
    res.status(500).json({ error: 'failed_to_fetch_po_terms' });
  } finally {
    conn?.release();
  }
});

app.post('/api/settings/po-terms/draft', authMiddleware, requireSettingsAccess, async (req, res) => {
  const { terms } = req.body || {};

  if (typeof terms !== 'string') {
    return res.status(400).json({ error: 'invalid_terms' });
  }

  let conn;
  try {
    conn = await db.getConnection();

    await conn.query(
      `UPDATE app_settings
       SET po_terms_conditions = ?
       WHERE id = 1`,
      [terms]
    );

    res.json({ success: true, draft: true });

  } catch (err) {
    console.error('save po terms draft error', err);
    res.status(500).json({ error: 'failed_to_save_po_terms_draft' });
  } finally {
    conn?.release();
  }
});


app.post('/api/settings/po-terms/apply', authMiddleware, requireSettingsAccess, async (req, res) => {
  const { terms } = req.body || {};

  if (typeof terms !== 'string' || !terms.trim()) {
    return res.status(400).json({ error: 'terms_required' });
  }

  let conn;
  try {
    conn = await db.getConnection();

    await conn.query(
      `UPDATE app_settings
       SET po_terms_conditions = ?,
           terms_applied_at = NOW(),
           terms_applied_by = ?
       WHERE id = 1`,
      [terms, req.user.id]
    );

    res.json({ success: true, applied: true });

  } catch (err) {
    console.error('apply po terms error', err);
    res.status(500).json({ error: 'failed_to_apply_po_terms' });
  } finally {
    conn?.release();
  }
});


app.post('/api/settings', authMiddleware, requireSettingsAccess, async (req, res) => {
  // Only Admin can update - requireSettingsAccess already validates this

  const {
    companyName,
    companyAddress,
    contactEmail,
    contactPhone,
    invoicePrefix,
    invoiceNextSeq,
    smtpHost,
    smtpPort,
    smtpUser,
    smtpFrom,
    enforceStrongPassword,
    logoDataUrl,
  } = req.body;

  let conn;
  try {
    conn = await db.getConnection();

    await conn.query(
      `
        UPDATE app_settings SET
          company_name = ?,
          company_address = ?,
          contact_email = ?,
          contact_phone = ?,
          invoice_prefix = ?,
          invoice_next_seq = ?,
          smtp_host = ?,
          smtp_port = ?,
          smtp_user = ?,
          smtp_from = ?,
          enforce_strong_password = ?,
          logo_data_url = ?
        WHERE id = 1
        `,
      [
        companyName || null,
        companyAddress || null,
        contactEmail || null,
        contactPhone || null,
        invoicePrefix || 'QT',
        Number(invoiceNextSeq || 1),
        smtpHost || null,
        smtpPort || null,
        smtpUser || null,
        smtpFrom || null,
        enforceStrongPassword ? 1 : 0,
        logoDataUrl || null,
      ]
    );

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save settings' });
  } finally {
    conn?.release();
  }
});

// 🔐 ROUTES
app.use("/api", customerRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/dashboard", authMiddleware, requireAdminOrPurchase, purchaseDashboardRoutes);
app.use("/api", indentRoutes);
app.use("/api", purchaseRoutes);
app.use("/api", vendorRoutes);
app.use("/uploads", express.static("uploads"));

// App-level constants
const PORT = process.env.PORT || 3001;

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET is not set');
}
const JWT_SECRET = process.env.JWT_SECRET;

// ---------- Helpers ----------
function nameToInitials(name) {
  if (!name) return '';
  return String(name).trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(n => String(n)[0].toUpperCase())
    .slice(0, 3)
    .join('');
}

function generateTokenId() {
  return crypto.randomBytes(32).toString('hex');
}


function normalizeDateForDb(input) {
  if (!input) return null;
  const s = String(input).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  return null;
}

function fixYearFormat(qno) {
  if (!qno || typeof qno !== 'string') return qno;
  const parts = qno.split('/');
  if (parts.length < 4) return qno;
  const yy = parts[1];
  if (/^\d{6}$/.test(yy)) return qno;
  if (/^\d{2}$/.test(yy)) {
    const startYear = Number(`20${yy}`);
    if (!isNaN(startYear)) {
      const next = String(startYear + 1).slice(-2);
      parts[1] = `${startYear}${next}`;
      return parts.join('/');
    }
  }
  if (/^\d{4}$/.test(yy)) {
    const startYear = Number(yy);
    if (!isNaN(startYear)) {
      const next = String(startYear + 1).slice(-2);
      parts[1] = `${startYear}${next}`;
      return parts.join('/');
    }
  }
  return qno;
}

function computeValidityState(q) {
  if (!q.validity_start_date || q.status === "draft") {
    return "valid";
  }

  const start = new Date(q.validity_start_date);
  const expiry = new Date(start);
  expiry.setDate(expiry.getDate() + (q.validity_days || 0));

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  expiry.setHours(0, 0, 0, 0);

  return expiry < today ? "expired" : "valid";
}

function buildFiscalYearStringForDate(dt = new Date()) {
  const d = dt instanceof Date ? dt : new Date(dt);

  let startYear = d.getFullYear();

  // Jan–Mar belong to previous FY
  if (d.getMonth() < 3) {
    startYear = startYear - 1;
  }

  const endYY = String(startYear + 1).slice(-2);

  // ✅ Change here → full start year + last 2 digits of next year
  return `${startYear}${endYY}`;
}



/**
 * Accept only integer numeric id parameters.
 * Returns sanitized numeric string or null if invalid.
 */
function sanitizeIdParam(raw) {
  if (raw == null) return null;
  try {
    const decoded = decodeURIComponent(String(raw));
    const beforeQ = decoded.split('?')[0].trim();
    if (/^\d+$/.test(beforeQ)) return beforeQ;
    return null;
  } catch (e) {
    return null;
  }
}



function escapeHtml(input) {
  if (input == null) return '';
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeJsonParse(val, fallback = []) {
  if (Array.isArray(val) || typeof val === 'object') return val;
  if (typeof val !== 'string') return fallback;
  try {
    return JSON.parse(val);
  } catch (e) {
    return fallback;
  }
}

function getNextVersion(version) {
  const num = Number(version);

  if (!version || isNaN(num)) return '1.0';

  return `${Math.floor(num) + 1}.0`;
}

// ---------- Global error handlers ----------

process.on('unhandledRejection', (reason, p) => {
  console.error('Unhandled Rejection:', { reason, promise: p });
});

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
});

// ---------- Schema/DB bootstrappers ----------
async function ensureUsersTable() {
  let conn;
  try {
    conn = await db.getConnection();
    await conn.query(`
        CREATE TABLE IF NOT EXISTS users (
          id INT AUTO_INCREMENT PRIMARY KEY,
          username VARCHAR(100),
          email VARCHAR(255) NOT NULL,
          name VARCHAR(255) NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          phone VARCHAR(50),
          position VARCHAR(100),
          role VARCHAR(50) NOT NULL DEFAULT 'user',
          is_active TINYINT(1) NOT NULL DEFAULT 1,
          active_token_id VARCHAR(128) DEFAULT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
         
          UNIQUE KEY uq_users_username (username)
        ) ENGINE=INNODB;
      `);
  } finally {
    if (conn) await conn.release();
  }
}


async function getNextQuotationNumber(conn, fyCode, salespersonName) {

  const [rows] = await conn.query(
    `
      SELECT last_number
      FROM quotation_sequences
      WHERE financial_year = ?
      FOR UPDATE
      `,
    [fyCode]
  );

  let nextNumber = 1;

  if (rows.length === 0) {

    await conn.query(
      `
        INSERT INTO quotation_sequences
        (financial_year, last_number)
        VALUES (?, ?)
        `,
      [fyCode, 1]
    );

  } else {

    nextNumber = rows[0].last_number + 1;

    await conn.query(
      `
        UPDATE quotation_sequences
        SET last_number = ?
        WHERE financial_year = ?
        `,
      [nextNumber, fyCode]
    );

  }

  return `QT${fyCode}${String(nextNumber).padStart(3, '0')}`;
}

async function ensureQuotationsTable() {
  let conn;
  try {
    conn = await db.getConnection();
    await conn.query(`
        CREATE TABLE IF NOT EXISTS quotations (
          id INT AUTO_INCREMENT PRIMARY KEY,
          quotation_no VARCHAR(255) UNIQUE,
          customer_id INT,
          customer_snapshot JSON,
          customer_name VARCHAR(255),
          salesperson_id INT,
          quotation_date DATE,
          validity_days INT DEFAULT 30,
          items JSON,
          terms TEXT,
          notes TEXT,
          subtotal DECIMAL(18,2) DEFAULT 0,
          total_discount DECIMAL(18,2) DEFAULT 0,
          tax_total DECIMAL(18,2) DEFAULT 0,
          total_value DECIMAL(18,2) DEFAULT 0,
          version VARCHAR(50) DEFAULT '0.1',
          status VARCHAR(50) DEFAULT 'draft',
          approved_by VARCHAR(255) DEFAULT NULL,
          approved_at DATETIME DEFAULT NULL,
          is_deleted TINYINT(1) DEFAULT 0,
          deleted_at DATETIME DEFAULT NULL,
          deleted_by INT DEFAULT NULL,
          reissued_from_id INT DEFAULT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=INNODB;
      `);

    const schema =
      process.env.MYSQLDATABASE ||
      process.env.MYSQL_DATABASE ||
      DB_NAME;
    if (!schema) {
      throw new Error('DB_NAME environment variable is not set');
    }

    const table = 'quotations';
    const [cols] = await conn.query(
      `SELECT COLUMN_NAME FROM information_schema.columns WHERE table_schema = ? AND table_name = ?`,
      [schema, table]
    );
    const existing = Array.isArray(cols) ? cols.map(c => String(c.COLUMN_NAME).toLowerCase()) : [];

    const required = [
      { name: 'is_deleted', def: 'is_deleted TINYINT(1) DEFAULT 0' },
      { name: 'deleted_at', def: 'deleted_at DATETIME DEFAULT NULL' },
      { name: 'deleted_by', def: 'deleted_by INT DEFAULT NULL' },
      { name: 'approved_by', def: 'approved_by VARCHAR(255) DEFAULT NULL' },
      { name: 'approved_at', def: 'approved_at DATETIME DEFAULT NULL' },
      { name: 'items', def: 'items JSON' },
      { name: 'version', def: "version VARCHAR(50) DEFAULT '0.1'" },
      { name: 'subtotal', def: 'subtotal DECIMAL(18,2) DEFAULT 0' },
      { name: 'total_discount', def: 'total_discount DECIMAL(18,2) DEFAULT 0' },
      { name: 'tax_total', def: 'tax_total DECIMAL(18,2) DEFAULT 0' },
      { name: 'total_value', def: 'total_value DECIMAL(18,2) DEFAULT 0' },
      { name: 'salesperson_phone', def: 'salesperson_phone VARCHAR(50)' },
      { name: 'salesperson_email', def: 'salesperson_email VARCHAR(255)' },
      { name: 'customer_contact_person', def: 'customer_contact_person VARCHAR(255)' },
      { name: 'customer_snapshot', def: 'customer_snapshot JSON' },
      { name: 'customer_phone', def: 'customer_phone VARCHAR(50)' },
      { name: 'customer_email', def: 'customer_email VARCHAR(255)' },
      { name: 'customer_address', def: 'customer_address TEXT' },
      { name: 'customer_gst', def: 'customer_gst VARCHAR(64)' },
      { name: 'reissued_from_id', def: 'reissued_from_id INT DEFAULT NULL' },
      { name: 'customer_location_id', def: 'customer_location_id INT' },
      { name: 'customer_contact_id', def: 'customer_contact_id INT' },
      { name: 'payment_terms', def: 'payment_terms TEXT DEFAULT NULL' },
      { name: 'validity_start_date', def: 'validity_start_date DATE DEFAULT NULL' },
      { name: 'remarks', def: 'remarks TEXT DEFAULT NULL' }

    ];

    for (const reqCol of required) {
      if (!existing.includes(reqCol.name)) {
        try {
          await conn.query(`ALTER TABLE ${table} ADD COLUMN ${reqCol.def}`);
          console.log(`ensureQuotationsTable: added missing column ${reqCol.name}`);
        } catch (alterErr) {
          console.warn(`ensureQuotationsTable: failed to add column ${reqCol.name}:`, alterErr && alterErr.message);
        }
      }
    }
  } finally {
    if (conn) try { await conn.release(); } catch (e) { }
  }
}

async function ensureCustomersTable() {
  let conn;
  try {
    conn = await db.getConnection();
    await conn.query(`
        CREATE TABLE IF NOT EXISTS customers (
          id INT AUTO_INCREMENT PRIMARY KEY,
          company_name VARCHAR(255) NOT NULL,
          contact_person VARCHAR(255),
          phone VARCHAR(50),
          email VARCHAR(255),
          gstin VARCHAR(64),
          address TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=INNODB;
      `);
  } finally {
    if (conn) try { await conn.release(); } catch (e) { }
  }
}

async function ensureProductsTable() {
  let conn;
  try {
    conn = await db.getConnection();
    await conn.query(`
        CREATE TABLE IF NOT EXISTS products (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          hsn_code VARCHAR(50),
          uom VARCHAR(30),
          unit_price DECIMAL(12,2),
          tax_rate DECIMAL(5,2),
          model VARCHAR(255),
          status VARCHAR(20) DEFAULT 'active',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=INNODB;
      `);
  } finally {
    if (conn) try { await conn.release(); } catch (e) { }
  }
}

async function ensureCustomerLocationsTable() {
  let conn;
  try {
    conn = await db.getConnection();
    await conn.query(`
        CREATE TABLE IF NOT EXISTS customer_locations (
          id INT AUTO_INCREMENT PRIMARY KEY,
          customer_id INT NOT NULL,
          location_name VARCHAR(255) NOT NULL,
          gstin VARCHAR(64),
          address TEXT,
          city VARCHAR(100),
          state VARCHAR(100),
          is_active TINYINT DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
          INDEX idx_customer_id (customer_id)
        ) ENGINE=INNODB;
      `);
  } finally {
    if (conn) try { await conn.release(); } catch (e) { }
  }
}

async function ensureCustomerContactsTable() {
  let conn;
  try {
    conn = await db.getConnection();
    await conn.query(`
        CREATE TABLE IF NOT EXISTS customer_contacts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_location_id INT NOT NULL,
    contact_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    email VARCHAR(255),
    is_primary TINYINT DEFAULT 0,
    is_active TINYINT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_location_id)
      REFERENCES customer_locations(id)
      ON DELETE CASCADE,
    INDEX idx_customer_location_id (customer_location_id)
  ) ENGINE=INNODB;
      `);
  } finally {
    if (conn) try { await conn.release(); } catch (e) { }
  }
}

async function ensureNotificationsTable() {
  let conn;
  try {
    conn = await db.getConnection();
    await conn.query(`
        CREATE TABLE IF NOT EXISTS notifications (
          id BIGINT AUTO_INCREMENT PRIMARY KEY,
          uuid VARCHAR(100) NOT NULL UNIQUE,
          title VARCHAR(255) NOT NULL,
          description TEXT NULL,
          url VARCHAR(255) NULL,
          user_id INT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=INNODB;
      `);




    const schema =
      process.env.MYSQLDATABASE ||
      process.env.MYSQL_DATABASE ||
      DB_NAME;
    if (!schema) {
      throw new Error('DB_NAME environment variable is not set');
    }

    const [idxRows] = await conn.query(
      `SELECT COUNT(*) AS cnt
        FROM information_schema.statistics
        WHERE table_schema = ?
        AND table_name = 'notifications'
        AND index_name = 'idx_notifications_created_at'`,
      [schema]
    );
    const cnt = Array.isArray(idxRows) && idxRows[0] ? Number(idxRows[0].cnt || 0) : 0;
    if (cnt === 0) {
      await conn.query(`CREATE INDEX idx_notifications_created_at ON notifications (created_at)`);
    }
  } finally {
    if (conn) try { await conn.release(); } catch (e) { }
  }
}



async function ensureQuotationVersionsTable() {
  let conn;
  try {
    conn = await db.getConnection();

    // 1️⃣ Create table (if not exists)
    await conn.query(`
      CREATE TABLE IF NOT EXISTS quotation_versions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        quotation_id INT NOT NULL,

        version_major INT NOT NULL,
        version_minor INT NOT NULL,
        version_label VARCHAR(32),

        items JSON,

        -- ✅ FULL FINANCIAL SNAPSHOT
        subtotal DECIMAL(18,2) DEFAULT 0,
        total_discount DECIMAL(18,2) DEFAULT 0,
        tax DECIMAL(18,2) DEFAULT 0,
        total DECIMAL(18,2) DEFAULT 0,

        change_history JSON,
        created_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE,
        INDEX idx_qv_qid (quotation_id)
      ) ENGINE=INNODB;
    `);

    // 2️⃣ BACKWARD COMPATIBILITY (VERY IMPORTANT)
    const schema =
      process.env.MYSQLDATABASE ||
      process.env.MYSQL_DATABASE ||
      DB_NAME;

    const [cols] = await conn.query(
      `SELECT COLUMN_NAME 
       FROM information_schema.columns 
       WHERE table_schema = ? 
       AND table_name = 'quotation_versions'`,
      [schema]
    );

    const existing = cols.map(c => c.COLUMN_NAME.toLowerCase());

    // 3️⃣ ADD MISSING COLUMNS SAFELY
    if (!existing.includes('total_discount')) {
      await conn.query(`
        ALTER TABLE quotation_versions
        ADD COLUMN total_discount DECIMAL(18,2) DEFAULT 0
      `);
      console.log('✅ Added total_discount to quotation_versions');
    }

  } finally {
    if (conn) await conn.release();
  }
}


async function ensureQuotationFollowupsTable() {
  let conn;
  try {
    conn = await db.getConnection();
    await conn.query(`
        CREATE TABLE IF NOT EXISTS quotation_followups (
          id INT AUTO_INCREMENT PRIMARY KEY,
          quotation_id INT NOT NULL,
          created_by INT,
          followup_date DATE NOT NULL,
          note TEXT NOT NULL,
          followup_type ENUM(
            'call','email','whatsapp','meeting','site_visit','other'
          ) NOT NULL DEFAULT 'other',
          next_followup_date DATE DEFAULT NULL,
          is_completed TINYINT DEFAULT 0,
          completed_at DATETIME DEFAULT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE,
          INDEX idx_qf_quotation (quotation_id)
        ) ENGINE=InnoDB;
      `);
  } finally {
    if (conn) await conn.release();
  }
}


async function ensureQuotationDecisionsTable() {
  let conn;
  try {
    conn = await db.getConnection();
    await conn.query(`
        CREATE TABLE IF NOT EXISTS quotation_decisions (
          id INT AUTO_INCREMENT PRIMARY KEY,
          quotation_id INT NOT NULL,
          decision ENUM('won','lost') NOT NULL,
          comment TEXT NULL,
          decided_by VARCHAR(255),
          decided_at DATETIME NOT NULL,
          FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE,
          INDEX idx_qd_quotation (quotation_id)
        ) ENGINE=INNODB;
      `);
  } finally {
    if (conn) await conn.release();
  }
}

async function ensureAppSettingsTable() {
  let conn;
  try {
    conn = await db.getConnection();

    // 1️⃣ Base table (fresh installs)
    await conn.query(`
        CREATE TABLE IF NOT EXISTS app_settings (
          id INT PRIMARY KEY,

          company_name VARCHAR(255),
          company_address TEXT,
          contact_email VARCHAR(255),
          contact_phone VARCHAR(50),

          invoice_prefix VARCHAR(20),
          invoice_next_seq INT DEFAULT 1,

          smtp_host VARCHAR(255),
          smtp_port INT,
          smtp_user VARCHAR(255),
          smtp_from VARCHAR(255),

          enforce_strong_password TINYINT DEFAULT 0,
          logo_data_url LONGTEXT,

          -- ✅ TERMS GOVERNANCE
          terms_conditions TEXT,
          terms_applied_at DATETIME DEFAULT NULL,
          terms_applied_by INT DEFAULT NULL
        ) ENGINE=INNODB;
      `);

    // 2️⃣ Ensure singleton row
    await conn.query(
      `INSERT IGNORE INTO app_settings (id) VALUES (1)`
    );

    // 3️⃣ Backward-compatible column patching
    const schema =
      process.env.MYSQLDATABASE ||
      process.env.MYSQL_DATABASE ||
      DB_NAME;
    if (!schema) {
      throw new Error('DB_NAME environment variable is not set');
    }

    const [cols] = await conn.query(
      `SELECT COLUMN_NAME
        FROM information_schema.columns
        WHERE table_schema = ?
          AND table_name = 'app_settings'`,
      [schema]
    );

    const existingCols = cols.map(c => c.COLUMN_NAME.toLowerCase());

    const required = [
      { name: 'terms_conditions', def: 'terms_conditions TEXT' },
      { name: 'terms_applied_at', def: 'terms_applied_at DATETIME DEFAULT NULL' },
      { name: 'terms_applied_by', def: 'terms_applied_by INT DEFAULT NULL' }
    ];

    for (const col of required) {
      if (!existingCols.includes(col.name)) {
        await conn.query(
          `ALTER TABLE app_settings ADD COLUMN ${col.def}`
        );
        console.log(`ensureAppSettingsTable: added ${col.name}`);
      }
    }

  } finally {
    if (conn) await conn.release();
  }
}


async function ensureAdminUser() {
  let conn;
  try {
    conn = await db.getConnection();

    const bcrypt = require("bcryptjs");

    const username = "Admin@1";
    const email = "admin@qms.com";
    const password = "Admin@12345";

    const passwordHash = await bcrypt.hash(password, 10);

    await conn.query(`
      INSERT INTO users (username, email, name, password_hash, role, is_active)
      VALUES (?, ?, 'Admin', ?, 'admin', 1)
      ON DUPLICATE KEY UPDATE
        password_hash = VALUES(password_hash),
        role = 'admin',
        is_active = 1
    `, [username, email, passwordHash]);

    console.log("✅ Admin ensured (Admin@1)");
  } catch (err) {
    console.error("❌ Admin seed failed:", err.message);
  } finally {
    conn?.release();
  }
}


// ---------- DB schema initialization (RUN ONCE AT STARTUP) ----------

async function runLegacyMigrationsFromIndexIfEnabled() {
  const envFlagEnabled =
    String(process.env.RUN_MIGRATIONS_ON_STARTUP || "").toLowerCase() === "true" ||
    String(process.env.RUN_MIGRATIONS_ON_STARTUP || "") === "1";

  let shouldRun = envFlagEnabled;
  const requiredMigrationTables = [
    'indents',
    'indent_items',
    'indent_documents',
    'vendors',
    'vendor_contacts',
    'vendor_performance',
    'vendor_procurement_stats',
    'purchase_orders',
    'po_items',
    'quotation_sequences',
    'roles',
    'user_roles',
    'system_settings',
    'email_logs',
    'audit_logs',
  ];

  // Auto-heal: if core tables are missing, run migrations automatically.
  if (!shouldRun) {
    let conn;
    try {
      conn = await db.getConnection();
      const schema = process.env.MYSQLDATABASE || process.env.MYSQL_DATABASE || DB_NAME;
      if (schema) {
        const placeholders = requiredMigrationTables.map(() => '?').join(', ');
        const [rows] = await conn.query(
          `SELECT table_name
             FROM information_schema.tables
            WHERE table_schema = ?
              AND table_name IN (${placeholders})`,
          [schema, ...requiredMigrationTables]
        );
        const existingTables = new Set((rows || []).map((row) => String(row.table_name || row.TABLE_NAME || '').toLowerCase()));
        const missingTables = requiredMigrationTables.filter(
          (tableName) => !existingTables.has(tableName.toLowerCase())
        );

        if (missingTables.length > 0) {
          shouldRun = true;
          console.log('Missing migrated tables detected:', missingTables.join(', '));
        }
      } else {
        // If schema name is not available yet, force migrations once.
        shouldRun = true;
      }
    } catch (e) {
      // If metadata check fails, run migrations to self-heal.
      shouldRun = true;
    } finally {
      if (conn) try { await conn.release(); } catch (e) { }
    }
  }

  if (!shouldRun) return;

  console.log("🧱 Running migrations 01→20 (startup)...");

  const runnerPath = path.join(__dirname, "migrations", "run-all-migrations-railway.js");
  const res = spawnSync(process.execPath, [runnerPath], {
    stdio: "inherit",
    env: process.env,
  });

  const code = typeof res.status === "number" ? res.status : 1;
  if (code !== 0) {
    throw new Error(`Migrations failed (exit code ${code})`);
  }

  console.log("✅ Migrations completed.");
}

(async function initDatabaseSchema() {
  try {
    await runLegacyMigrationsFromIndexIfEnabled();
    console.log('Initializing database schema...');
    await ensureUsersTable();
    await ensureCustomersTable();
    await ensureCustomerLocationsTable();
    await ensureCustomerContactsTable();
    await ensureProductsTable();
    await ensureQuotationsTable();
    await ensureQuotationFollowupsTable();
    await ensureQuotationDecisionsTable();
    await ensureQuotationVersionsTable();
    await ensureAppSettingsTable();
    await ensureAdminUser();

    await ensureNotificationsTable();
    console.log('Database schema ready');
  } catch (err) {
    console.error('❌ Failed to initialize DB schema:', err);
    throw err;
  }
})();



// ---------- Auth middleware ----------

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'missing authorization header' });
  const parts = header.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return res.status(401).json({ error: 'invalid authorization format' });
  const token = parts[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    return next();
  } catch (e) {
    return res.status(401).json({ error: 'invalid or expired token' });
  }
}


// ---------- Optional routers (kept as before if present) ----------
// ❌ DISABLED: quotationsRouter was intercepting /api/quotations before individual routes
// The actual endpoints (GET /api/quotations, POST /api/quotations, etc.) are defined below
// try {
//   const quotationsRouter = require('./routes/quotations-advanced.js');
//   app.use('/api/quotations', quotationsRouter);
//   console.log('Mounted /api/quotations router from ./routes/quotations-advanced');
// } catch (err) {
//   console.warn('quotations router not mounted (missing ./routes/quotations-advanced):', err && err.message);
// }

try {
  const quotationsAdvancedRouter = require('./routes/quotations-advanced');
  app.use('/api/v2/quotations', quotationsAdvancedRouter);
  console.log('Mounted /api/v2/quotations router from ./routes/quotations-advanced');
} catch (err) {
  console.warn('quotations-advanced router not mounted:', err && err.message);
}

try {
  const salesOrdersRouter = require('./routes/sales-orders');
  app.use('/api/sales-orders', salesOrdersRouter);
  console.log('Mounted /api/sales-orders router from ./routes/sales-orders');
} catch (err) {
  console.warn('sales-orders router not mounted:', err && err.message);
}

try {
  const reportsRouter = require('./routes/reports');
  app.use('/api/reports', reportsRouter);
  console.log('Mounted /api/reports router from ./routes/reports');
} catch (err) {
  console.warn('reports router not mounted:', err && err.message);
}

try {
  const remindersRouter = require('./routes/reminders');
  app.use('/api/quotations/reminders', remindersRouter);
  console.log('Mounted /api/quotations/reminders router from ./routes/reminders');
} catch (err) {
  console.warn('reminders router not mounted:', err && err.message);
}

// ========== ERP USER MANAGEMENT & SETTINGS ==========
try {
  const erpUsersRouter = require('./routes/erp-users');
  app.use('/api/erp', erpUsersRouter);
  console.log('✓ Mounted /api/erp/users, /api/erp/roles from ./routes/erp-users');
} catch (err) {
  console.warn('⚠ ERP users router not mounted:', err && err.message);
}

try {
  const erpSettingsRouter = require('./routes/erp-settings');
  app.use('/api/erp', erpSettingsRouter);
  console.log('✓ Mounted /api/erp/settings, /api/erp/notifications from ./routes/erp-settings');
} catch (err) {
  console.warn('⚠ ERP settings router not mounted:', err && err.message);
}

// ---------- Health / debug ----------
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.get('/api/debug-headers', (req, res) => {
  const header = req.headers.authorization || null;
  const masked = header ? (typeof header === 'string' ? (header.slice(0, 20) + '...') : true) : null;
  res.json({ hasAuthorization: !!header, maskedAuthorization: masked });
});


// ---------- Auth routes ----------


app.post('/api/login', async (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({
      error: 'missing_credentials',
      message: 'username and password are required',
    });
  }

  const USERNAME_REGEX =
    /^(?=.*[A-Z])(?=.*[0-9])(?=.*[@_])[A-Za-z0-9@_]{4,100}$/;

  if (!USERNAME_REGEX.test(username)) {
    return res.status(400).json({
      error: 'invalid_username_format',
      message:
        'Username must contain at least one capital letter, one number, and @ or _',
    });
  }

  let conn;
  try {
    conn = await db.getConnection();

    const [rows] = await conn.query(
      `
        SELECT
          id,
          username,
          email,
          name,
          password_hash,
          role,
          is_active
        FROM users
        WHERE username = ?
        LIMIT 1
        `,
      [username]
    );

    if (!rows || !rows[0]) {
      return res.status(401).json({ error: 'invalid_credentials' });
    }

    const user = rows[0];

    if (user.is_active === 0) {
      return res.status(403).json({
        error: 'account_disabled',
        message: 'Your account has been disabled. Please contact admin.',
      });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'invalid_credentials' });
    }

    const tokenPayload = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      name: user.name,
    };

    // 🔐 Generate session token ID
    const tokenId = generateTokenId();

    /* 🔒 Enforce single active session for NON-admin users */
    if (user.role !== 'admin') {
      await conn.query(
        `UPDATE users SET active_token_id = ? WHERE id = ?`,
        [tokenId, user.id]
      );
    }

    /* JWT payload now includes token_id */
    const token = jwt.sign(
      {
        ...tokenPayload,
        token_id: tokenId,
      },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    return res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'server_error' });
  } finally {
    if (conn) {
      try { await conn.release(); } catch { }
    }
  }
});




app.post('/api/register', async (req, res) => {
  const { username, name, email, password } = req.body || {};

  // ✅ Validation
  if (!username || !email || !password || !name) {
    return res.status(400).json({
      error: 'missing_fields',
      message: 'username, name, email and password required'
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
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10);
    const hash = await bcrypt.hash(password, saltRounds);

    // ✅ Insert (email NOT unique)
    const [r] = await conn.query(
      `INSERT INTO users (username, name, email, password_hash)
       VALUES (?, ?, ?, ?)`,
      [username, name, email, hash]
    );

    // ✅ Fetch created user
    const [rows] = await conn.query(
      'SELECT id, username, email, name, role FROM users WHERE id = ? LIMIT 1',
      [r.insertId]
    );

    const created = rows?.[0];
    if (!created) {
      return res.status(500).json({ error: 'create_failed' });
    }

    const payload = {
      id: created.id,
      username: created.username,
      email: created.email,
      name: created.name,
      role: created.role || 'user'
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });

    return res.status(201).json({ token, user: payload });

  } catch (err) {
    console.error('Register error:', err?.message || err);

    return res.status(500).json({
      error: 'server_error',
      details: err?.message
    });

  } finally {
    if (conn) await conn.release();
  }
});
// ---------- User info ----------
app.get('/api/me', authMiddleware, (req, res) => {
  try {
    res.json({ user: req.user });
  } catch (err) {
    console.error('Error in /api/me:', err);
    res.status(500).json({ error: 'server error' });
  }
});

// ---------- Stats ----------
app.get('/api/stats', async (req, res) => {
  let conn;
  try {

    conn = await db.getConnection();
    const [rows] = await conn.query('SELECT COUNT(*) as total FROM quotations WHERE is_deleted = 0');
    const total = (rows && rows[0] && rows[0].total) ? rows[0].total : 0;
    res.json({ totalQuotations: total });
  } catch (err) {
    console.error('Error fetching stats:', err && err.message ? err.message : err);
    res.status(500).json({ error: 'db error' });
  } finally {
    if (conn) try { await conn.release(); } catch (e) { }
  }
});

// ---------- Recent & list quotations (protected & filtered) ----------
// ---------- Recent & list quotations (protected & filtered) ----------
app.get('/api/quotations/recent', authMiddleware, requireQuotationAccess, async (req, res) => {
  let conn;
  try {
    conn = await db.getConnection();

    const role = String(req.user?.role || '').toLowerCase();
    const userId = Number(req.user?.id || 0);
    const isAdmin = role === 'admin';

    const whereClause = isAdmin
      ? 'q.is_deleted = 0'
      : (userId
        ? 'q.is_deleted = 0 AND q.salesperson_id = ?'
        : 'q.is_deleted = 0 AND 1 = 0');

    const params = isAdmin ? [] : [userId];

    const sql = `
      SELECT
        q.id,
        q.quotation_no,
        q.items,
        q.total_value,
        q.status,
        q.created_at,
        q.reissued_from_id,

        -- 🔹 Parent (old version)
        parent_q.quotation_no AS reissued_from_quotation_no,

        -- 🔹 Latest child (new version)
        child_q.id AS superseded_by_id,
        child_q.quotation_no AS superseded_by_quotation_no,

        -- 🔹 Salesperson
        u.name AS salesperson_name,

        -- 🔹 Customer
        c.id AS customer_id,
        c.company_name,

        -- 🔹 Location
        l.id AS location_id,
        l.location_name,

        -- 🔹 Contact
        ct.id AS contact_id,
        ct.contact_name

      FROM quotations q

      -- 🔹 Parent
      LEFT JOIN quotations parent_q
        ON parent_q.id = q.reissued_from_id

      -- 🔹 Latest child (CRITICAL FIX)
      LEFT JOIN (
        SELECT reissued_from_id, MAX(id) AS id
        FROM quotations
        GROUP BY reissued_from_id
      ) latest_child
        ON latest_child.reissued_from_id = q.id

      LEFT JOIN quotations child_q
        ON child_q.id = latest_child.id

      -- 🔹 Master joins
      LEFT JOIN users u
        ON u.id = q.salesperson_id

      LEFT JOIN customers c
        ON c.id = q.customer_id

      LEFT JOIN customer_locations l
        ON l.id = q.customer_location_id

      LEFT JOIN customer_contacts ct
        ON ct.id = q.customer_contact_id

      WHERE ${whereClause}
      ORDER BY q.created_at DESC
      LIMIT 10
    `;

    const [rows] = await conn.query(sql, params);

    const parsed = rows.map(r => {
      const items = safeJsonParse(r.items, []);

      const productNames = Array.isArray(items)
        ? items.map(it => it?.name || it?.product_name || '').filter(Boolean)
        : [];

      return {
        id: r.id,
        quotation_no: r.quotation_no,
        status: r.status,
        total_value: r.total_value,
        created_at: r.created_at,

        // 🔹 Version chain
        reissued_from: r.reissued_from_id ? {
          id: r.reissued_from_id,
          quotation_no: r.reissued_from_quotation_no
        } : null,

        superseded_by: r.superseded_by_id ? {
          id: r.superseded_by_id,
          quotation_no: r.superseded_by_quotation_no
        } : null,

        // 🔹 Products
        productNames,

        // 🔹 Sales
        salesperson_name: r.salesperson_name || null,

        // 🔹 Customer
        customer: r.customer_id ? {
          id: r.customer_id,
          company_name: r.company_name || '—'
        } : null,

        // 🔹 Location
        location: r.location_id ? {
          id: r.location_id,
          name: r.location_name || '—'
        } : null,

        // 🔹 Contact
        contact: r.contact_id ? {
          id: r.contact_id,
          name: r.contact_name || '—'
        } : null
      };
    });

    res.json(parsed);

  } catch (err) {
    console.error('Error fetching recent quotations:', err);
    res.status(500).json({ error: 'db error' });
  } finally {
    if (conn) {
      try { conn.release(); } catch { }
    }
  }
});

// ---------- Get quotations (list) ----------
app.get('/api/quotations', authMiddleware, requireQuotationAccess, async (req, res) => {
  let conn;
  try {
    console.log('\n🔍🔍🔍 GET /api/quotations ENDPOINT HIT 🔍🔍🔍');
    console.log('Request user:', req.user);

    conn = await db.getConnection();

    const role = String(req.user?.role || '').toLowerCase();
    const userId = Number(req.user?.id || 0);
    const isAdmin = role === 'admin';

    const { validity, followup, status, type } = req.query;

    console.log('\n🔍 GET /api/quotations - Query Debug:');
    console.log('   Role:', role, '| IsAdmin:', isAdmin, '| UserId:', userId);
    console.log('   Filters:', { validity, followup, status, type });

    // ========== SIMPLE VERSION: Just get the quotations first ==========
    const where = ['q.is_deleted = 0'];
    const params = [];

    if (!isAdmin) {
      if (!userId) {
        console.log('   ⚠️  Non-admin user with no userId, returning empty');
        return res.json([]);
      }
      where.push('q.salesperson_id = ?');
      params.push(userId);
    }

    const simpleQuery = `
  SELECT
    q.id,
    q.quotation_no,
    q.customer_id,
    q.customer_name,
    q.customer_location_id,
    q.customer_contact_id,
    q.items,
    q.total_value,
    q.status,
    q.version,
    q.created_at,
    q.quotation_date,
    q.validity_days,
    q.validity_start_date,
    q.payment_terms,
    q.reissued_from_id,
    q.salesperson_id,

    parent_q.id AS parent_id,
    parent_q.quotation_no AS parent_quotation_no,

    -- ✅ ADD THIS BLOCK (CRITICAL FIX)
    DATE(
      DATE_ADD(
        COALESCE(q.validity_start_date, q.quotation_date),
        INTERVAL q.validity_days DAY
      )
    ) AS valid_until,

    DATEDIFF(
      DATE(
        DATE_ADD(
          COALESCE(q.validity_start_date, q.quotation_date),
          INTERVAL q.validity_days DAY
        )
      ),
      CURDATE()
    ) AS remaining_days,

    CASE
      WHEN q.status = 'draft' THEN 'not_applicable'
      WHEN q.status = 'won' THEN 'converted'
      WHEN q.status = 'lost' THEN 'closed_lost'

      WHEN DATEDIFF(
        DATE(
          DATE_ADD(
            COALESCE(q.validity_start_date, q.quotation_date),
            INTERVAL q.validity_days DAY
          )
        ),
        CURDATE()
      ) < 0 THEN 'expired'

      WHEN DATEDIFF(
        DATE(
          DATE_ADD(
            COALESCE(q.validity_start_date, q.quotation_date),
            INTERVAL q.validity_days DAY
          )
        ),
        CURDATE()
      ) = 0 THEN 'today'

      WHEN DATEDIFF(
        DATE(
          DATE_ADD(
            COALESCE(q.validity_start_date, q.quotation_date),
            INTERVAL q.validity_days DAY
          )
        ),
        CURDATE()
      ) BETWEEN 1 AND 3 THEN 'soon'

      ELSE 'valid'
    END AS validity_state

  FROM quotations q
  LEFT JOIN quotations parent_q ON parent_q.id = q.reissued_from_id
  WHERE ${where.join(' AND ')}
  ORDER BY q.created_at DESC
`;

    console.log('   WHERE:', where.join(' AND '));
    console.log('   Params:', params);

    const [basicRows] = await conn.query(simpleQuery, params);
    console.log('   ✅ Basic query returned:', basicRows.length, 'rows');

    if (basicRows.length === 0) {
      console.log('   No rows found, checking total in database...');
      const [[{ count }]] = await conn.query('SELECT COUNT(*) as count FROM quotations WHERE is_deleted = 0');
      console.log('   Total quotations in DB:', count);
      return res.json([]);
    }

    // ========== NOW: Enrich with customer, salesperson, and calculations ==========
    // Get user names
    const userIds = [...new Set(basicRows.map(r => r.salesperson_id).filter(Boolean))];
    const [users] = userIds.length > 0
      ? await conn.query('SELECT id, name FROM users WHERE id IN (?)', [userIds])
      : [[]];
    const userMap = Object.fromEntries(users.map((u) => [u.id, u.name]));

    // Get customers
    const custIds = [...new Set(basicRows.map(r => r.customer_id).filter(Boolean))];
    const [customers] = custIds.length > 0
      ? await conn.query('SELECT id, company_name, gstin FROM customers WHERE id IN (?)', [custIds])
      : [[]];
    const custMap = Object.fromEntries(customers.map((c) => [c.id, c]));

    // Get locations
    const locIds = [...new Set(basicRows.map(r => r.customer_location_id).filter(Boolean))];
    const [locations] = locIds.length > 0
      ? await conn.query('SELECT id, location_name, address, city, state FROM customer_locations WHERE id IN (?)', [locIds])
      : [[]];
    const locMap = Object.fromEntries(locations.map((l) => [l.id, l]));

    // Get contacts
    const contactIds = [...new Set(basicRows.map(r => r.customer_contact_id).filter(Boolean))];
    const [contacts] = contactIds.length > 0
      ? await conn.query('SELECT id, contact_name, phone, email FROM customer_contacts WHERE id IN (?) AND is_active = 1', [contactIds])
      : [[]];
    const contactMap = Object.fromEntries(contacts.map((c) => [c.id, c]));


    // ========== TRANSFORM RESULTS ==========
    let out = basicRows.map((r) => {
      const salesperson = userMap[r.salesperson_id];
      const customer = custMap[r.customer_id];
      const location = locMap[r.customer_location_id];
      const contact = contactMap[r.customer_contact_id];

      // Parse items
      let items = [];
      if (r.items) {
        try {
          items = typeof r.items === 'string' ? JSON.parse(r.items) : r.items;
        } catch {
          items = [];
        }
      }

      // Calculate validity_state using helper (now with validity_start_date support)


      // Calculate remaining_days for UI


      // Calculate lifecycle_state
      let lifecycle_state = 'active';
      if (r.reissued_from_id) {
        lifecycle_state = 'reissued';
      }

      return {
        id: r.id,
        quotation_no: r.quotation_no,
        status: r.status || 'draft',
        version: r.version || '1.0',
        total_value: r.total_value,
        created_at: r.created_at,
        payment_terms: r.payment_terms || null,
        items,

        validity: r.status === 'draft' ? null : {
          quotation_date: r.quotation_date,
          validity_days: r.validity_days || 30,
          valid_until: r.quotation_date ? (() => {
            const startDate = r.validity_start_date || r.quotation_date;
            const d = new Date(startDate);
            d.setDate(d.getDate() + (r.validity_days || 30));
            return d.toISOString().split('T')[0];
          })() : null,
          validity_state: r.validity_state,
          remaining_days: r.remaining_days
        },

        lifecycle_state: lifecycle_state,
        is_superseded: false,
        reissued_from: r.parent_id ? {
          id: r.parent_id,
          quotation_no: r.parent_quotation_no
        } : null,

        customer: {
          id: r.customer_id,
          company_name: customer?.company_name || r.customer_name || 'N/A',
          gstin: customer?.gstin || null
        },

        location: location ? {
          name: location.location_name,
          address: location.address,
          city: location.city,
          state: location.state
        } : null,

        contact: contact ? {
          id: contact.id,
          name: contact.contact_name,
          phone: contact.phone,
          email: contact.email
        } : null,

        salesperson_name: salesperson || 'Unassigned'
      };
    });

    // ========== APPLY KPI FILTERS ==========
    if (status) {
      const statusLower = String(status).toLowerCase();
      out = out.filter(q => (q.status || '').toLowerCase() === statusLower);
      console.log(`   ✅ Filtered by status="${status}": ${out.length} rows`);
    }

    if (validity) {
      const validityLower = String(validity).toLowerCase();
      out = out.filter(q => q.validity?.validity_state === validityLower);
      console.log(`   ✅ Filtered by validity="${validity}": ${out.length} rows`);
    }

    res.json(out);

  } catch (err) {
    console.error('❌ Error fetching quotations:', err);
    res.status(500).json({ error: 'db error', details: err.message });
  } finally {
    if (conn) conn.release();
  }
});


// ---------- Next quotation preview ----------

async function handleNextQuotation(req, res) {
  let conn;

  try {
    conn = await db.getConnection();

    // 👤 Get logged-in user (salesperson)
    const [[sp]] = await conn.query(
      'SELECT name FROM users WHERE id = ?',
      [req.user.id]
    );

    if (!sp) {
      throw new Error('User not found');
    }

    // 👤 Build initials (if needed inside generator)
    const initials = sp.name
      .trim()
      .split(/\s+/)
      .map(p => p[0])
      .join('')
      .toUpperCase();

    // 📅 Financial Year (April → March)
    const fyCode = buildFiscalYearStringForDate(new Date());

    /**
     * 🔐 IMPORTANT:
     * We use transaction ONLY to reuse locking logic
     * but we DO NOT persist anything (preview mode)
     */
    await conn.beginTransaction();

    const quotation_no = await getNextQuotationNumber(
      conn,
      fyCode,
      sp.name // or initials depending on your logic
    );

    // ❗ Always rollback (this is preview, not creation)
    await conn.rollback();

    // ✅ Correct API response
    return res.json({
      quotation_no
    });

  } catch (err) {
    if (conn) {
      try { await conn.rollback(); } catch { }
    }

    console.error('failed to build next quotation number', err);

    return res.status(500).json({
      error: 'server_error'
    });

  } finally {
    if (conn) {
      try { await conn.release(); } catch { }
    }
  }
}

app.get('/api/quotations/next', authMiddleware, handleNextQuotation);


// ---------- Socket.IO bootstrap ----------
async function createServerAndIO() {


  const httpServer = http.createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins.length ? allowedOrigins : false,
      methods: ['GET', 'POST']
    },
    path: '/socket.io'
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.t || null;
      if (!token) {
        socket.user = null;
        return next();
      }
      const user = jwt.verify(token, JWT_SECRET);
      socket.user = user;
      if (user && user.id) socket.join(`user:${user.id}`);
      return next();
    } catch (err) {
      socket.user = null;
      return next(); // allow anonymous connections
    }
  });

  io.on('connection', (socket) => {
    console.log('WS connected', socket.id, 'user:', socket.user?.id ?? 'anon');
    socket.on('disconnect', () => {
      console.log('WS disconnected', socket.id);
    });
  });

  app.locals.io = io;
  app.locals.broadcastNotification = function broadcastNotification(notif) {
    try {
      if (notif && notif.user_id) {
        io.to(`user:${notif.user_id}`).emit('notification', notif);
      } else {
        io.emit('notification', notif);
      }
    } catch (err) {
      console.error('broadcastNotification error', err && err.message ? err.message : err);
    }
  };

  return { httpServer, io };
}


// ---------- Create quotation (protected) ----------
app.post('/api/quotations', authMiddleware, requireQuotationCreation, async (req, res) => {
  console.log('\n==== Incoming Create Quotation Request ====');
  console.log('Payload:', JSON.stringify(req.body, null, 2));

  const {

    quotation_no: manualQuotationNo, // optional (backend generates anyway)
    customer_id,
    customer_location_id,
    customer_contact_id,
    customer_snapshot, // optional (frontend may send, backend rebuilds anyway)
    customer_name,
    salesperson_id,
    quotation_date,
    validity_days,
    payment_terms,
    items,
    notes,
    remarks,
    status,
    version
  } = req.body || {};

  /* -------------------- VALIDATION -------------------- */

  if (!customer_id) {
    return res.status(400).json({ error: 'customer_id is required' });
  }
  if (!customer_location_id) {
    return res.status(400).json({ error: 'customer_location_id is required' });
  }
  if (!customer_contact_id) {
    return res.status(400).json({ error: 'customer_contact_id is required' });
  }

  const finalCustomerName =
    customer_name ||
    customer_snapshot?.company_name ||
    null;

  if (!finalCustomerName) {
    return res.status(400).json({
      error: 'customer_name_missing',
      message: 'customer_snapshot.company_name is required'
    });
  }

  let conn;
  try {
    conn = await db.getConnection();
    await conn.beginTransaction();

    /* -------------------- NORMALIZE DATA -------------------- */
    const dbDate = normalizeDateForDb(quotation_date);
    const finalStatus = (status || 'draft').toLowerCase();
    const isDraft = finalStatus === 'draft';

    /**
     * ✅ CORRECT LOGIC:
     * - Draft → NO validity
     * - Any active status (pending/approved/etc.) → start NOW
     *
     * NEVER use quotation_date for validity start
     */
    const validityStartDate = isDraft ? null : new Date();
    const totals = calculateTotals(items || []);
    const itemsJson = items ? JSON.stringify(items) : null;

    const normalizedPaymentTerms =
      typeof payment_terms === "string" && payment_terms.trim()
        ? payment_terms.trim()
        : null;

    // ✅ Extract model data from items
    const modelsData = (items || []).map(item => ({
      product_id: item.product_id,
      model: item.model || null
    }));
    const modelsJson = modelsData.length > 0 ? JSON.stringify(modelsData) : null;

    /* -------------------- SALESPERSON -------------------- */

    const actorId =
      req.user && req.user.id != null ? Number(req.user.id) : null;

    const salespersonToSave =
      salesperson_id != null ? salesperson_id : actorId;

    const [userRows] = await conn.query(
      'SELECT phone, email FROM users WHERE id = ?',
      [salespersonToSave]
    );

    const salesperson = userRows?.[0] || {};



    /* -------------------- CUSTOMER SNAPSHOT -------------------- */

    const [custRows] = await conn.query(
      'SELECT company_name FROM customers WHERE id = ?',
      [customer_id]
    );

    const [locRows] = await conn.query(
      `SELECT location_name, gstin, address, city, state
        FROM customer_locations
        WHERE id = ?`,
      [customer_location_id]
    );

    const [contactRows] = await conn.query(
      `SELECT contact_name, phone, email
        FROM customer_contacts
        WHERE id = ?`,
      [customer_contact_id]
    );

    const snapshot = {
      company_name: custRows?.[0]?.company_name || null,
      location_name: locRows?.[0]?.location_name || null,
      gstin: locRows?.[0]?.gstin || null,
      address: locRows?.[0]?.address || null,
      city: locRows?.[0]?.city || null,
      state: locRows?.[0]?.state || null,
      contact_name: contactRows?.[0]?.contact_name || null,
      phone: contactRows?.[0]?.phone || null,
      email: contactRows?.[0]?.email || null
    };

    const snapshotJson = JSON.stringify(snapshot);

    console.log('Saving customer snapshot:', snapshotJson);



    /* -------------------- GENERATE QUOTATION NO -------------------- */
    const [[sp]] = await conn.query(
      'SELECT name FROM users WHERE id = ?',
      [salespersonToSave]
    );

    if (!sp) {
      throw new Error('Salesperson not found for quotation numbering');
    }

    const initials = sp.name
      .trim()
      .split(/\s+/)
      .map(p => p[0])
      .join('')
      .toUpperCase();

    const fyCode = buildFiscalYearStringForDate(new Date());


    let quotation_no;

    if (manualQuotationNo && String(manualQuotationNo).trim()) {
      quotation_no = String(manualQuotationNo).trim();

      const [[exists]] = await conn.query(
        'SELECT id FROM quotations WHERE quotation_no = ? LIMIT 1',
        [quotation_no]
      );

      if (exists) {
        await conn.rollback();
        return res.status(409).json({
          error: 'quotation_no_exists',
          message: 'Quotation number already exists'
        });
      }
    } else {
      quotation_no = await getNextQuotationNumber(
        conn,
        fyCode,
        sp.name
      );
    }



    /* -------------------- TERMS SNAPSHOT (LOCKED) -------------------- */

    // 1️⃣ Prefer user-edited terms from Create Quotation
    let appliedTerms =
      typeof req.body.terms === 'string'
        ? req.body.terms
        : null;

    // 2️⃣ Fallback to App Settings ONLY if user did not provide terms
    if (!appliedTerms) {
      const [[settings]] = await conn.query(
        `SELECT terms_conditions FROM app_settings WHERE id = 1`
      );

      appliedTerms =
        typeof settings?.terms_conditions === 'string'
          ? settings.terms_conditions
          : null;
    }



    /* -------------------- INSERT QUOTATION -------------------- */

    const [ins] = await conn.query(
      `
        INSERT INTO quotations
  (
    quotation_no,
    customer_id,
    customer_name,

    customer_location_id,
    customer_contact_id,
    customer_snapshot,

    salesperson_id,
    salesperson_phone,
    salesperson_email,

    quotation_date,
    validity_days,
    validity_start_date,
    payment_terms,

    items,
    model,
    subtotal,
    total_discount,
    tax_total,
    total_value,

    terms,
    notes,
    remarks,
    status,
    version
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`, [
      quotation_no,
      customer_id,
      finalCustomerName,

      customer_location_id,
      customer_contact_id,
      snapshotJson,

      salespersonToSave,
      salesperson.phone || null,
      salesperson.email || null,

      dbDate,
      validity_days || 30,
      validityStartDate,
      normalizedPaymentTerms,

      itemsJson,
      modelsJson,
      totals.subtotal,
      totals.total_discount,
      totals.tax_total,
      totals.grand_total,

      appliedTerms,
      notes || null,
      remarks || null,
      finalStatus,
      '1.0'
    ]);

    const newId = ins.insertId;

    await conn.commit();


    console.log('Quotation created:', quotation_no);

    return res.status(201).json({ id: newId, quotation_no });

  } catch (err) {
    console.error('\n❌ ERROR CREATING QUOTATION', err);
    return res.status(500).json({
      error: 'db error',
      details: err?.message
    });
  } finally {
    if (conn) {
      try { await conn.release(); } catch { }
    }
  }
});

// ---------- Get quotation by id (protected + visibility enforcement) ----------
app.get('/api/quotations/:id', authMiddleware, requireQuotationAccess, async (req, res) => {
  let conn;
  try {
    const id = Number(req.params.id);
    if (!id) {
      return res.status(400).json({ error: 'invalid id' });
    }

    conn = await db.getConnection();

    const [rows] = await conn.query(
      `
       SELECT
        q.*,

        -- 🔹 CORE DATE CALCULATION (ONLY ONCE)
        DATE(
          DATE_ADD(
            COALESCE(q.validity_start_date, q.quotation_date),
            INTERVAL q.validity_days DAY
          )
        ) AS computed_valid_until,

        DATEDIFF(
          DATE(
            DATE_ADD(
              COALESCE(q.validity_start_date, q.quotation_date),
              INTERVAL q.validity_days DAY
            )
          ),
          CURDATE()
        ) AS computed_remaining_days,

        -- 🔹 VALIDITY STATE (SINGLE SOURCE OF TRUTH)
        CASE
          WHEN q.status = 'draft' THEN 'not_applicable'
          WHEN q.status = 'won' THEN 'converted'
          WHEN q.status = 'lost' THEN 'closed_lost'

          WHEN DATEDIFF(
            DATE(
              DATE_ADD(
                COALESCE(q.validity_start_date, q.quotation_date),
                INTERVAL q.validity_days DAY
              )
            ),
            CURDATE()
          ) < 0 THEN 'expired'

          WHEN DATEDIFF(
            DATE(
              DATE_ADD(
                COALESCE(q.validity_start_date, q.quotation_date),
                INTERVAL q.validity_days DAY
              )
            ),
            CURDATE()
          ) = 0 THEN 'today'

          WHEN DATEDIFF(
            DATE(
              DATE_ADD(
                COALESCE(q.validity_start_date, q.quotation_date),
                INTERVAL q.validity_days DAY
              )
            ),
            CURDATE()
          ) BETWEEN 1 AND 3 THEN 'soon'

          ELSE 'valid'
        END AS validity_state,

        -- 🔹 SALES PERSON
        u.name  AS salesperson_name,
        u.phone AS salesperson_phone,
        u.email AS salesperson_email,

        -- 🔹 CUSTOMER
        c.id AS customer_id,
        c.company_name,

        -- 🔹 LOCATION
        l.id AS location_id,
        l.location_name,
        l.address AS location_address,
        l.city,
        l.state,
        l.gstin AS location_gstin,

        -- 🔹 CONTACT
        ct.id AS contact_id,
        ct.contact_name,
        ct.phone AS contact_phone,
        ct.email AS contact_email,

        -- 🔹 REISSUE RELATIONS
        parent_q.quotation_no AS reissued_from_quotation_no,

        child_q.id AS reissued_to_id,
        child_q.quotation_no AS reissued_to_quotation_no

      FROM quotations q

      LEFT JOIN users u ON u.id = q.salesperson_id
      LEFT JOIN customers c ON c.id = q.customer_id
      LEFT JOIN customer_locations l ON l.id = q.customer_location_id
      LEFT JOIN customer_contacts ct ON ct.id = q.customer_contact_id

      LEFT JOIN quotations parent_q
        ON parent_q.id = q.reissued_from_id

      LEFT JOIN (
        SELECT reissued_from_id, MAX(id) AS id
        FROM quotations
        GROUP BY reissued_from_id
      ) latest_child
        ON latest_child.reissued_from_id = q.id

      LEFT JOIN quotations child_q
        ON child_q.id = latest_child.id

      WHERE q.id = ? AND q.is_deleted = 0
      LIMIT 1
    `, [id]);


    if (!rows.length) {
      return res.status(404).json({ error: 'not found' });
    }

    const q = rows[0];

    /* 🔥 LIFECYCLE STATE COMPUTATION (INDEPENDENT CHECKS) */
    let is_superseded = false;
    let lifecycle_state = "active";

    // 🔹 Check if this is a NEW quotation (has parent)
    if (q.reissued_from_id) {
      lifecycle_state = "reissued";
    }

    // 🔹 Check if this is an OLD quotation (has child)
    if (q.reissued_to_id) {
      lifecycle_state = "superseded";
      is_superseded = true;
    }

    /* 🔐 Access control */
    const role = String(req.user?.role || '').toLowerCase();
    if (role !== 'admin' && q.salesperson_id !== req.user.id) {
      return res.status(403).json({ error: 'forbidden' });
    }

    /* ✅ ALLOW READING SUPERSEDED (lock only in UI) */
    // Frontend will handle UI locking based on lifecycle_state

    /* ✅ Normalize items ONCE */
    const rawItems = safeJsonParse(q.items, []);
    const items = Array.isArray(rawItems)
      ? rawItems.map(it => ({
        product_id: it.product_id ?? null,
        product_name: it.product_name ?? it.name ?? '—',
        description: it.description ?? '',
        model: it.model ?? null,
        qty: Number(it.qty ?? it.quantity ?? 0),
        uom: it.uom ?? 'NOS',
        discount_percent: Number(it.discount_percent ?? 0),
        unit_price: Number(it.unit_price ?? it.price ?? 0),
        tax_rate: Number(it.tax_rate ?? 0),
        hsn_code: it.hsn_code ?? null,
      }))
      : [];

    /* ✅ PARSE CUSTOMER SNAPSHOT */
    let customerSnapshot = null;
    if (q.customer_snapshot) {
      try {
        customerSnapshot =
          typeof q.customer_snapshot === 'string'
            ? JSON.parse(q.customer_snapshot)
            : q.customer_snapshot;
      } catch {
        customerSnapshot = null;
      }
    }

    /* ✅ RESPONSE */
    return res.json({
      quotation: {
        id: q.id,
        quotation_no: fixYearFormat(q.quotation_no),
        status: q.status,
        version: q.version,
        is_superseded,
        lifecycle_state,

        // 🔹 Reissue chain relationships (BOTH must be returned)
        // reissued_from_id → this is a NEW quotation (child of parent)
        // reissued_to_id → this is an OLD quotation (parent of child)
        reissued_from_id: q.reissued_from_id || null,
        reissued_from: q.reissued_from_id ? {
          id: q.reissued_from_id,
          quotation_no: q.reissued_from_quotation_no
        } : null,

        reissued_to_id: q.reissued_to_id || null,
        reissued_to: q.reissued_to_id ? {
          id: q.reissued_to_id,
          quotation_no: q.reissued_to_quotation_no
        } : null,

        total_value: q.total_value,
        created_at: q.created_at,
        quotation_date: q.quotation_date,
        terms: q.terms,
        notes: q.notes,
        remarks: q.remarks,
        validity_days: q.validity_days,

        payment_terms: q.payment_terms ?? null,

        validity: q.status === 'draft' ? null : {
          quotation_date: q.quotation_date,
          validity_days: q.validity_days,
          valid_until: q.computed_valid_until,
          remaining_days: q.computed_remaining_days,
          validity_state: q.validity_state
        },

        customer_snapshot: customerSnapshot,

        customer_name: q.company_name,
        customer_address: q.location_address || q.customer_address,
        customer_gst: q.location_gstin,
        customer_phone: q.contact_phone,
        customer_email: q.contact_email,
        customer_contact_person: q.contact_name,

        salesperson_id: q.salesperson_id,
        salesperson_name: q.salesperson_name,
        salesperson_phone: q.salesperson_phone,
        salesperson_email: q.salesperson_email,

        approved_by: q.approved_by,
        approved_at: q.approved_at,

        items,

        customer: q.customer_id
          ? {
            id: q.customer_id,
            company_name: q.company_name,
          }
          : null,

        location: q.location_id
          ? {
            id: q.location_id,
            location_name: q.location_name,
            address: q.location_address,
            city: q.city,
            state: q.state,
            gstin: q.location_gstin,
          }
          : null,

        contact: q.contact_id
          ? {
            id: q.contact_id,
            contact_name: q.contact_name,
            phone: q.contact_phone,
            email: q.contact_email,
          }
          : null,
      },
    });

  } catch (err) {
    console.error('Quotation fetch failed:', err);
    return res.status(500).json({ error: 'db error' });
  } finally {
    if (conn) conn.release();
  }
});


// ---------- Re-issue quotation (protected) ----------

app.post('/api/quotations/:id/reissue', authMiddleware, requireQuotationCreation, async (req, res) => {
  const sourceId = Number(req.params.id);
  const { validity_days = 30 } = req.body;

  if (!sourceId || !Number.isInteger(validity_days) || validity_days <= 0) {
    return res.status(400).json({ error: 'Invalid re-issue request' });
  }

  let conn;
  try {
    conn = await db.getConnection();
    await conn.beginTransaction();

    // 🔒 Lock source quotation
    const [[source]] = await conn.query(`
      SELECT q.*,
        DATE(
          DATE_ADD(
            COALESCE(q.validity_start_date, q.quotation_date),
            INTERVAL COALESCE(q.validity_days, 0) DAY
          )
        ) AS computed_valid_until,
        CASE
          WHEN DATE(
            DATE_ADD(
              COALESCE(q.validity_start_date, q.quotation_date),
              INTERVAL COALESCE(q.validity_days, 0) DAY
            )
          ) < CURDATE() THEN 'expired'
          ELSE 'active'
        END AS validity_state
      FROM quotations q
      WHERE q.id = ?
      FOR UPDATE
    `, [sourceId]);

    if (!source) {
      await conn.rollback();
      return res.status(404).json({ error: 'Source quotation not found' });
    }

    // ✅ Prevent duplicate reissue (child already exists)
    const [[alreadyReissued]] = await conn.query(
      `SELECT id FROM quotations WHERE reissued_from_id = ? LIMIT 1`,
      [source.id]
    );

    if (alreadyReissued) {
      await conn.rollback();
      return res.status(409).json({ error: 'Quotation already re-issued' });
    }

    // ✅ Business rules
    if (source.validity_state !== 'expired') {
      await conn.rollback();
      return res.status(409).json({ error: 'Only expired quotations can be re-issued' });
    }

    if (source.status === 'won' || source.status === 'lost') {
      await conn.rollback();
      return res.status(409).json({ error: 'Cannot re-issue a closed quotation' });
    }

    // ✅ Salesperson validation
    const [[sp]] = await conn.query(
      'SELECT name FROM users WHERE id = ?',
      [source.salesperson_id]
    );

    if (!sp) {
      throw new Error('Salesperson not found');
    }

    // ✅ Generate new quotation number
    const fyCode = buildFiscalYearStringForDate(new Date());

    const quotation_no = await getNextQuotationNumber(
      conn,
      fyCode,
      sp.name
    );

    // ✅ Normalize JSON fields
    const itemsJson =
      typeof source.items === 'string'
        ? source.items
        : JSON.stringify(source.items ?? []);

    const customerSnapshotJson =
      typeof source.customer_snapshot === 'string'
        ? source.customer_snapshot
        : JSON.stringify(source.customer_snapshot ?? {});

    // ✅ CREATE NEW QUOTATION (ONE-WAY LINK ONLY)
    const [result] = await conn.query(`
      INSERT INTO quotations (
        quotation_no,
        quotation_date,
        validity_days,
        validity_start_date,
        customer_id,
        customer_location_id,
        customer_contact_id,
        salesperson_id,
        customer_snapshot,
        items,
        terms,
        notes,
        total_value,
        status,
        version,
        is_deleted,
        reissued_from_id,
        created_at
      )
      VALUES (
        ?,
        CURRENT_DATE,
        ?,
        CURRENT_DATE,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        'pending',
        '1.0',
        0,
        ?,   -- ✅ ONLY LINK (child → parent)
        NOW()
      )
    `, [
      quotation_no,
      validity_days,
      source.customer_id,
      source.customer_location_id,
      source.customer_contact_id,
      source.salesperson_id,
      customerSnapshotJson,
      itemsJson,
      source.terms ?? null,
      source.notes ?? null,
      source.total_value ?? 0,
      source.id   // ✅ CORRECT LINK
    ]);

    const newQuotationId = result.insertId;

    // ❌ REMOVED: reverse linking (VERY IMPORTANT)
    // await conn.query(
    //   `UPDATE quotations SET reissued_from_id = ? WHERE id = ?`,
    //   [newQuotationId, source.id]
    // );

    await conn.commit();

    return res.json({ id: newQuotationId });

  } catch (err) {
    if (conn) await conn.rollback();
    console.error('Re-issue failed:', err);
    return res.status(500).json({ error: 'Failed to re-issue quotation' });
  } finally {
    if (conn) conn.release();
  }
});
// ---------- Create Indent (from quotation) and start order flow ----------
app.post('/api/quotations/:id/create-order', authMiddleware, requireQuotationCreation, async (req, res) => {
  let conn;
  try {
    const rawId = req.params.id;
    const id = sanitizeIdParam(rawId);
    if (!id) return res.status(400).json({ error: 'invalid id' });

    conn = await db.getConnection();
    await conn.beginTransaction();

    // Fetch quotation and items
    const [[q]] = await conn.query(`SELECT id, quotation_no, customer_name, items FROM quotations WHERE id = ? AND is_deleted = 0 LIMIT 1`, [id]);
    if (!q) {
      await conn.rollback();
      return res.status(404).json({ error: 'quotation not found' });
    }

    const parsedItems = (() => {
      try { return typeof q.items === 'string' ? JSON.parse(q.items) : q.items || []; } catch (e) { return []; }
    })();

    if (!Array.isArray(parsedItems) || parsedItems.length === 0) {
      await conn.rollback();
      return res.status(400).json({ error: 'quotation has no items to create indent' });
    }

    // Generate indent number (year based)
    const year = new Date().getFullYear();
    const [countRows] = await conn.query("SELECT COUNT(*) as count FROM indents WHERE YEAR(created_at)=?", [year]);
    const nextNumber = (countRows && countRows[0]) ? (countRows[0].count + 1) : 1;
    const indentNumber = `IND/${year}/${String(nextNumber).padStart(3, '0')}`;

    // Insert indent
    const [indentResult] = await conn.query(`INSERT INTO indents (indent_number, customer_name, indent_date, po_number, notes, status, created_by, created_by_name) VALUES (?,?,?,?,?,?,?,?)`, [
      indentNumber,
      q.customer_name || null,
      new Date(),
      null, // po_number is optional
      `Created from quotation ${q.quotation_no}`,
      'submitted',
      req.user.id,
      req.user.name || null
    ]);

    const indentId = indentResult.insertId;

    // Insert indent items
    const values = parsedItems.map(it => ([
      indentId,
      it.product_id || null,
      it.product_name || (it.name || null),
      it.model || it.model_number || null,
      it.product_description || it.description || null,
      Number(it.qty || it.quantity || 0)
    ]));

    await conn.query(`INSERT INTO indent_items (indent_id, product_id, product_name, model_number, product_description, quantity) VALUES ?`, [values]);

    await conn.commit();

    // Return created indent info and a suggested next URL for creating PO
    return res.json({ success: true, indent_id: indentId, indent_number: indentNumber, next: `/purchase-orders?indent=${indentId}` });

  } catch (err) {
    console.error('create-order from quotation failed:', err);
    if (conn) try { await conn.rollback(); } catch { };
    return res.status(500).json({ error: 'create-order failed', details: err?.message });
  } finally {
    if (conn) conn.release();
  }
});
// ---------- Notifications ----------
app.get('/api/notifications', authMiddleware, async (req, res) => {
  let conn;
  try {

    conn = await db.getConnection();
    const userId = req.user?.id ?? null;
    const [rows] = await conn.query(
      `SELECT id, uuid, title, description, url, user_id, created_at
    FROM notifications
    WHERE user_id IS NULL OR user_id = ?
    ORDER BY created_at DESC
    LIMIT 200`,
      [userId]
    );
    const out = (rows || []).map(r => ({
      id: r.id,
      uuid: r.uuid,
      title: r.title,
      description: r.description,
      url: r.url,
      user_id: r.user_id,
      createdAt: (r.created_at instanceof Date) ? r.created_at.toISOString() : String(r.created_at)
    }));
    res.json(out);
  } catch (err) {
    console.error('Error fetching notifications:', err && err.message ? err.message : err);
    res.status(500).json({ error: 'db error', details: err && err.message });
  } finally {
    if (conn) try { await conn.release(); } catch (e) { }
  }
});

//--- PDF Router mount---///

try {
  const quotationPdfRouter = require('./routes/quotation-pdf');
  app.use('/api/quotations', quotationPdfRouter);
  console.log('✓ Mounted PDF routes: /api/quotations/:id/pdf, /api/quotations/po/:id/pdf');
} catch (err) {
  console.warn('⚠ PDF router not mounted:', err && err.message);
}

// ---------- Customers CRUD ----------//
app.get('/api/customers', authMiddleware, async (req, res) => {
  let conn;
  try {

    conn = await db.getConnection();
    const [rows] = await conn.query('SELECT id, company_name, gstin, address, created_at FROM customers ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    console.error('customers GET error', err && err.message ? err.message : err);
    res.status(500).json({ error: 'db error', details: err && err.message });
  } finally {
    if (conn) try { await conn.release(); } catch (e) { }
  }
});

app.post('/api/customers', authMiddleware, async (req, res) => {
  let conn;
  try {
    const { company_name, name, gstin, address } = req.body || {};
    const custName = (company_name || name || '').trim();

    if (!custName) {
      return res.status(400).json({ error: 'company_name required' });
    }

    conn = await db.getConnection();

    const [result] = await conn.query(
      `INSERT INTO customers
        SET company_name = ?, gstin = ?, address = ?`,
      [custName, gstin || null, address || null]
    );

    const [rows] = await conn.query(
      `SELECT id, company_name, gstin, address, created_at
        FROM customers
        WHERE id = ?`,
      [result.insertId]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('create customer error:', err.sqlMessage || err.message || err);
    res.status(500).json({
      error: 'db error',
      details: err.sqlMessage || err.message
    });
  } finally {
    if (conn) conn.release();
  }
});

app.put('/api/customers/:id', authMiddleware, async (req, res) => {
  let conn;
  const id = Number(req.params.id);

  try {
    const { company_name, name, gstin, address } = req.body || {};
    const custName = (company_name || name || '').trim();

    if (!custName) {
      return res.status(400).json({ error: 'company_name required' });
    }

    conn = await db.getConnection();

    const [result] = await conn.query(
      `UPDATE customers
        SET company_name = ?, gstin = ?, address = ?
        WHERE id = ?`,
      [custName, gstin || null, address || null, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'not found' });
    }

    const [rows] = await conn.query(
      `SELECT id, company_name, gstin, address, created_at
        FROM customers
        WHERE id = ?`,
      [id]
    );

    res.json(rows[0]);
  } catch (err) {
    console.error('update customer error', err);
    res.status(500).json({ error: 'db error' });
  } finally {
    if (conn) conn.release();
  }
});

app.delete('/api/customers/:id', authMiddleware, async (req, res) => {
  let conn;
  const { id } = req.params;
  try {
    conn = await db.getConnection();
    const [r] = await conn.query('DELETE FROM customers WHERE id = ?', [id]);
    res.json({ affectedRows: r.affectedRows });
  } catch (err) {
    console.error('delete customer error', err && err.message ? err.message : err);
    res.status(500).json({ error: 'db error', details: err && err.message });
  } finally {
    if (conn) try { await conn.release(); } catch (e) { }
  }
});

// ========== CUSTOMER LOCATIONS CRUD ==========

app.get('/api/customers/:customerId/locations', authMiddleware, async (req, res) => {
  let conn;
  const customerId = Number(req.params.customerId);
  try {
    conn = await db.getConnection();
    const [rows] = await conn.query(
      `SELECT id, customer_id, location_name, gstin, address, city, state, is_active, created_at
        FROM customer_locations
        WHERE customer_id = ? AND is_active = 1
        ORDER BY created_at DESC`,
      [customerId]
    );
    res.json(rows || []);
  } catch (err) {
    console.error('get locations error', err);
    res.status(500).json({ error: 'db error' });
  } finally {
    if (conn) try { await conn.release(); } catch (e) { }
  }
});

app.post('/api/customers/:customerId/locations', authMiddleware, async (req, res) => {
  let conn;
  const customerId = Number(req.params.customerId);
  try {
    const { location_name, gstin, address, city, state } = req.body || {};

    if (!location_name || !location_name.trim()) {
      return res.status(400).json({ error: 'location_name required' });
    }

    conn = await db.getConnection();

    // Verify customer exists
    const [custRows] = await conn.query('SELECT id FROM customers WHERE id = ?', [customerId]);
    if (!custRows || custRows.length === 0) {
      return res.status(404).json({ error: 'customer not found' });
    }

    const [result] = await conn.query(
      `INSERT INTO customer_locations (customer_id, location_name, gstin, address, city, state)
        VALUES (?, ?, ?, ?, ?, ?)`,
      [customerId, location_name.trim(), gstin || null, address || null, city || null, state || null]
    );

    const [rows] = await conn.query(
      `SELECT id, customer_id, location_name, gstin, address, city, state, is_active, created_at
        FROM customer_locations
        WHERE id = ?`,
      [result.insertId]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('create location error', err);
    res.status(500).json({ error: 'db error' });
  } finally {
    if (conn) try { await conn.release(); } catch (e) { }
  }
});

app.put('/api/customers/:customerId/locations/:locationId', async (req, res) => {
  let conn;
  const customerId = Number(req.params.customerId);
  const locationId = Number(req.params.locationId);
  try {
    const { location_name, gstin, address, city, state } = req.body || {};

    if (!location_name || !location_name.trim()) {
      return res.status(400).json({ error: 'location_name required' });
    }

    conn = await db.getConnection();

    const [result] = await conn.query(
      `UPDATE customer_locations
        SET location_name = ?, gstin = ?, address = ?, city = ?, state = ?
        WHERE id = ? AND customer_id = ?`,
      [location_name.trim(), gstin || null, address || null, city || null, state || null, locationId, customerId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'location not found' });
    }

    const [rows] = await conn.query(
      `SELECT id, customer_id, location_name, gstin, address, city, state, is_active, created_at
        FROM customer_locations
        WHERE id = ?`,
      [locationId]
    );

    res.json(rows[0]);
  } catch (err) {
    console.error('update location error', err);
    res.status(500).json({ error: 'db error' });
  } finally {
    if (conn) try { await conn.release(); } catch (e) { }
  }
});

app.delete('/api/customers/:customerId/locations/:locationId', async (req, res) => {
  let conn;
  const customerId = Number(req.params.customerId);
  const locationId = Number(req.params.locationId);
  try {
    conn = await db.getConnection();

    // Soft delete: set is_active = 0
    const [result] = await conn.query(
      `UPDATE customer_locations
        SET is_active = 0
        WHERE id = ? AND customer_id = ?`,
      [locationId, customerId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'location not found' });
    }

    res.json({ success: true, affectedRows: result.affectedRows });
  } catch (err) {
    console.error('delete location error', err);
    res.status(500).json({ error: 'db error' });
  } finally {
    if (conn) try { await conn.release(); } catch (e) { }
  }
});

// ========== CUSTOMER CONTACTS CRUD ==========

app.get('/api/customer-locations/:locationId/contacts', authMiddleware, async (req, res) => {
  let conn;
  const locationId = Number(req.params.locationId);

  try {
    conn = await db.getConnection();

    const [rows] = await conn.query(
      `SELECT id, customer_location_id, contact_name, phone, email, is_primary, is_active, created_at
        FROM customer_contacts
        WHERE customer_location_id = ? AND is_active = 1
        ORDER BY is_primary DESC, created_at DESC`,
      [locationId]
    );

    res.json(rows || []);
  } catch (err) {
    console.error('get contacts error', err);
    res.status(500).json({ error: 'db error' });
  } finally {
    if (conn) try { await conn.release(); } catch { }
  }
});

app.post('/api/customer-locations/:locationId/contacts', authMiddleware, async (req, res) => {
  let conn;
  const locationId = Number(req.params.locationId);

  try {
    const { contact_name, phone, email, is_primary } = req.body || {};

    if (!contact_name?.trim()) {
      return res.status(400).json({ error: 'contact_name required' });
    }

    conn = await db.getConnection();

    const [locRows] = await conn.query(
      'SELECT id FROM customer_locations WHERE id = ?',
      [locationId]
    );
    if (locRows.length === 0) {
      return res.status(404).json({ error: 'location not found' });
    }

    if (is_primary) {
      await conn.query(
        `UPDATE customer_contacts SET is_primary = 0 WHERE customer_location_id = ?`,
        [locationId]
      );
    }

    const [result] = await conn.query(
      `INSERT INTO customer_contacts
        (customer_location_id, contact_name, phone, email, is_primary)
        VALUES (?, ?, ?, ?, ?)`,
      [locationId, contact_name.trim(), phone || null, email || null, is_primary ? 1 : 0]
    );

    const [rows] = await conn.query(
      `SELECT id, customer_location_id, contact_name, phone, email, is_primary, is_active, created_at
        FROM customer_contacts
        WHERE id = ?`,
      [result.insertId]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('create contact error', err);
    res.status(500).json({ error: 'db error' });
  } finally {
    if (conn) try { await conn.release(); } catch { }
  }
});

app.put('/api/customer-locations/:locationId/contacts/:contactId', authMiddleware, async (req, res) => {
  let conn;
  const locationId = Number(req.params.locationId);
  const contactId = Number(req.params.contactId);

  try {
    const { contact_name, phone, email, is_primary } = req.body || {};

    if (!contact_name?.trim()) {
      return res.status(400).json({ error: 'contact_name required' });
    }

    conn = await db.getConnection();

    if (is_primary) {
      await conn.query(
        `UPDATE customer_contacts
          SET is_primary = 0
          WHERE customer_location_id = ? AND id != ?`,
        [locationId, contactId]
      );
    }

    const [result] = await conn.query(
      `UPDATE customer_contacts
        SET contact_name = ?, phone = ?, email = ?, is_primary = ?
        WHERE id = ? AND customer_location_id = ?`,
      [contact_name.trim(), phone || null, email || null, is_primary ? 1 : 0, contactId, locationId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'contact not found' });
    }

    const [rows] = await conn.query(
      `SELECT id, customer_location_id, contact_name, phone, email, is_primary, is_active, created_at
        FROM customer_contacts
        WHERE id = ?`,
      [contactId]
    );

    res.json(rows[0]);
  } catch (err) {
    console.error('update contact error', err);
    res.status(500).json({ error: 'db error' });
  } finally {
    if (conn) try { await conn.release(); } catch { }
  }
});

app.delete('/api/customer-locations/:locationId/contacts/:contactId', authMiddleware, async (req, res) => {
  let conn;
  const locationId = Number(req.params.locationId);
  const contactId = Number(req.params.contactId);

  try {
    conn = await db.getConnection();

    const [result] = await conn.query(
      `UPDATE customer_contacts
        SET is_active = 0
        WHERE id = ? AND customer_location_id = ?`,
      [contactId, locationId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'contact not found' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('delete contact error', err);
    res.status(500).json({ error: 'db error' });
  } finally {
    if (conn) try { await conn.release(); } catch { }
  }
});

// Clear primary flag for all contacts in a location
app.put('/api/customer-locations/:locationId/clear-primary', async (req, res) => {
  let conn;
  const locationId = Number(req.params.locationId);
  try {
    conn = await db.getConnection();
    const [result] = await conn.query(
      `UPDATE customer_contacts SET is_primary = 0 WHERE customer_location_id = ?`,
      [locationId]
    );
    res.json({ success: true, affectedRows: result.affectedRows });
  } catch (err) {
    console.error('clear primary contacts error', err);
    res.status(500).json({ error: 'db error' });
  } finally {
    if (conn) try { await conn.release(); } catch (e) { }
  }
});

// ---------- Users list & delete (admin) ----------
app.get('/api/users', authMiddleware, requireUserManagement, async (req, res) => {
  const requesterRole = (req.user && req.user.role) ? String(req.user.role).toLowerCase() : null;
  if (requesterRole !== 'admin') return res.status(403).json({ error: 'forbidden', message: 'Only admin can list all users' });

  let conn;
  try {

    conn = await db.getConnection();
    const [rows] = await conn.query('SELECT id, username, email, name, phone, position, role, is_active, created_at FROM users ORDER BY created_at DESC');
    res.json(rows || []);
  } catch (err) {
    console.error('/api/users error', err && err.message ? err.message : err);
    res.status(500).json({ error: 'db_error', details: err && err.message });
  } finally {
    if (conn) try { await conn.release(); } catch (e) { }
  }
});

app.delete('/api/users/:id', authMiddleware, requireUserManagement, async (req, res) => {
  let conn;
  try {

    const rawId = req.params.id;
    const id = sanitizeIdParam(rawId);
    if (!id) return res.status(400).json({ error: 'invalid id' });

    const requesterRole = (req.user && req.user.role) ? String(req.user.role).toLowerCase() : null;
    const requesterId = (req.user && req.user.id) ? Number(req.user.id) : null;
    if (requesterRole !== 'admin') return res.status(403).json({ error: 'forbidden', message: 'Only admin users can delete accounts' });
    if (requesterId !== null && Number(id) === requesterId) return res.status(400).json({ error: 'cannot_delete_self', message: 'You cannot delete your own account' });

    const force = String(req.query.force || '').toLowerCase() === 'true';
    conn = await db.getConnection();

    const [rows] = await conn.query('SELECT id, email, name, role FROM users WHERE id = ? LIMIT 1', [id]);
    if (!rows || rows.length === 0) return res.status(404).json({ error: 'not_found', message: `User ${id} not found` });

    if (!force) {
      const [qc] = await conn.query('SELECT COUNT(*) AS c FROM quotations WHERE salesperson_id = ? AND is_deleted = 0', [id]);
      const quotationsCount = Array.isArray(qc) && qc[0] ? Number(qc[0].c || 0) : 0;
      if (quotationsCount > 0) {
        return res.status(409).json({
          error: 'cannot_delete_user_has_quotations',
          message: `User has ${quotationsCount} quotations. Use force=true to delete and cascade if desired.`
        });
      }
    }

    if (force) {
      const [delRes] = await conn.query('DELETE FROM users WHERE id = ?', [id]);
      const affected = delRes && (delRes.affectedRows != null) ? delRes.affectedRows : 0;
      try {

        const notifUUID = `notif-user-force-delete-${id}-${Date.now()}`;
        const title = `User ${id} force-deleted`;
        const description = `User ${id} (${rows[0].email}) was force-deleted by ${req.user && (req.user.name || req.user.email) ? (req.user.name || req.user.email) : 'admin'}`;
        const url = `/users/${id}`;
        await conn.query('INSERT INTO notifications (uuid, title, description, url, user_id) VALUES (?, ?, ?, ?, ?)', [notifUUID, title, description, url, req.user ? req.user.id : null]);
      } catch (notifErr) {
        console.error('Failed to persist force-delete notification:', notifErr && notifErr.message ? notifErr.message : notifErr);
      }
      return res.json({ success: true, force: true, affectedRows: affected });
    } else {
      const [delRes] = await conn.query('DELETE FROM users WHERE id = ?', [id]);
      const affected = delRes && (delRes.affectedRows != null) ? delRes.affectedRows : 0;
      try {

        const notifUUID = `notif-user-delete-${id}-${Date.now()}`;
        const title = `User ${id} deleted`;
        const description = `User ${id} (${rows[0].email}) was deleted by ${req.user && (req.user.name || req.user.email) ? (req.user.name || req.user.email) : 'admin'}`;
        const url = `/users/${id}`;
        await conn.query('INSERT INTO notifications (uuid, title, description, url, user_id) VALUES (?, ?, ?, ?, ?)', [notifUUID, title, description, url, req.user ? req.user.id : null]);
      } catch (notifErr) {
        console.error('Failed to persist delete notification:', notifErr && notifErr.message ? notifErr.message : notifErr);
      }
      return res.json({ success: true, affectedRows: affected, force: false });
    }
  } catch (err) {
    console.error('DELETE /api/users/:id error:', err && err.message ? err.message : err);
    return res.status(500).json({ error: 'server_error', message: 'Failed to delete user', details: err && err.message });
  } finally {
    if (conn) try { await conn.release(); } catch (e) { }
  }
});

// ---------- Update own profile (any authenticated user) ----------
app.put('/api/profile', authMiddleware, async (req, res) => {
  const userId = req.user?.id;
  console.log('🔐 Profile Update Request - User ID:', userId, 'User:', req.user);

  if (!userId) {
    console.error('❌ Profile update failed - No user ID');
    return res.status(401).json({ error: 'not_authenticated' });
  }

  const { name, email, password } = req.body || {};
  console.log('📝 Profile update payload:', { name, email, hasPassword: !!password });

  if (!email) {
    return res.status(400).json({
      error: 'validation_error',
      message: 'email is required',
    });
  }

  let conn;
  try {
    conn = await db.getConnection();

    // Check if email already exists for another user
    const [existing] = await conn.query(
      'SELECT id FROM users WHERE email = ? AND id != ?',
      [email, userId]
    );

    if (existing.length > 0) {
      console.warn('⚠️ Email already in use:', email);
      return res.status(409).json({
        error: 'duplicate_email',
        message: 'Email already in use',
      });
    }

    if (password && password.trim()) {
      const hashedPassword = await bcrypt.hash(password, 10);

      const [result] = await conn.query(
        'UPDATE users SET name = ?, password_hash = ?, email = ? WHERE id = ?',
        [name || '', hashedPassword, email, userId]
      );
      console.log('✅ Profile updated with password - Rows affected:', result.affectedRows);
    } else {
      const [result] = await conn.query(
        'UPDATE users SET name = ?, email = ? WHERE id = ?',
        [name || '', email, userId]
      );
      console.log('✅ Profile updated - Rows affected:', result.affectedRows);
    }

    // Fetch and return updated user data
    const [updatedUser] = await conn.query(
      'SELECT id, username, email, name, created_at, role FROM users WHERE id = ?',
      [userId]
    );

    if (updatedUser.length > 0) {
      console.log('📤 Returning updated user:', updatedUser[0]);
      res.json({ success: true, user: updatedUser[0] });
    } else {
      res.json({ success: true });
    }
  } catch (err) {
    console.error('❌ Update profile error:', err);
    res.status(500).json({ error: 'server_error' });
  } finally {
    if (conn) conn.release();
  }
});

// ---------- Create user (admin only) ----------
app.post('/api/users', authMiddleware, requireUserManagement, async (req, res) => {
  const requesterRole = (req.user && req.user.role)
    ? String(req.user.role).toLowerCase()
    : null;

  // ✅ Admin-only check
  if (requesterRole !== 'admin') {
    return res.status(403).json({
      error: 'forbidden',
      message: 'Only admin users can create users'
    });
  }

  const { username, name, email, phone, position, role, password } = req.body || {};

  // ✅ Validation
  if (!username || !password) {
    return res.status(400).json({
      error: 'validation_error',
      message: 'username and password are required'
    });
  }

  const USERNAME_REGEX =
    /^(?=.*[A-Z])(?=.*[0-9])(?=.*[@_])[A-Za-z0-9@_]{4,100}$/;

  if (!USERNAME_REGEX.test(username)) {
    return res.status(400).json({
      error: 'invalid_username_format',
      message: 'Username must contain 1 capital letter, 1 number, and @ or _'
    });
  }

  let conn;
  try {
    conn = await db.getConnection();

    // ✅ ONLY check username (NOT email)
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
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10);
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // ✅ Insert (email can repeat)
    const [result] = await conn.query(
      `INSERT INTO users
        (username, email, name, password_hash, phone, position, role, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        username,
        email || null,
        name || '',
        passwordHash,
        phone || '',
        position || '',
        role || 'user'
      ]
    );

    // ✅ Return created user
    const [rows] = await conn.query(
      `SELECT id, username, email, name, phone, position, role, created_at
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [result.insertId]
    );

    return res.status(201).json({
      success: true,
      user: rows[0]
    });

  } catch (err) {
    console.error('Create user error:', err?.message || err);

    return res.status(500).json({
      error: 'server_error',
      message: 'Failed to create user'
    });

  } finally {
    if (conn) await conn.release();
  }
});

app.put('/api/users/:id', authMiddleware, requireUserManagement, async (req, res) => {
  const userId = Number(req.params.id);
  const { username, name, email, phone, position, role } = req.body || {};

  if (!userId || !username) {
    return res.status(400).json({
      error: 'validation_error',
      message: 'username is required',
    });
  }

  let conn;
  try {
    conn = await db.getConnection();

    // ✅ ONLY check username (NOT email)
    const [dup] = await conn.query(
      `SELECT id FROM users
       WHERE username = ?
       AND id != ?
       LIMIT 1`,
      [username, userId]
    );

    if (dup.length) {
      return res.status(409).json({
        error: 'username_exists',
        message: 'Username already exists',
      });
    }

    await conn.query(
      `UPDATE users SET
          username = ?,
          name = ?,
          email = ?,
          phone = ?,
          position = ?,
          role = ?
        WHERE id = ?`,
      [
        username,
        name || '',
        email || null,
        phone || '',
        position || '',
        role || 'sales',
        userId,
      ]
    );

    res.json({ success: true });

  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ error: 'server_error' });
  } finally {
    if (conn) conn.release();
  }
});

// ---------- Update user password (admin only OR self) ----------
app.put('/api/users/:id/password', authMiddleware, requireUserManagement, async (req, res) => {
  const userId = Number(req.params.id);
  const { password } = req.body || {};

  if (!userId || !password) {
    return res.status(400).json({
      error: 'validation_error',
      message: 'password is required',
    });
  }

  // Admin can change anyone's password
  // User can change own password
  if (req.user.role !== 'admin' && req.user.id !== userId) {
    return res.status(403).json({ error: 'forbidden' });
  }

  let conn;
  try {
    conn = await db.getConnection();

    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10);
    const passwordHash = await bcrypt.hash(password, saltRounds);

    await conn.query(
      'UPDATE users SET password_hash = ? WHERE id = ?',
      [passwordHash, userId]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Update password error:', err);
    res.status(500).json({ error: 'server_error' });
  } finally {
    if (conn) conn.release();
  }
});




// ---------- Enable / Disable user (admin only) ----------
app.put("/api/users/:id/status", authMiddleware, requireUserManagement, async (req, res) => {
  let conn;
  try {
    const userId = Number(req.params.id);
    const { is_active } = req.body;

    if (!Number.isInteger(userId)) {
      return res.status(400).json({ error: "invalid_user_id" });
    }

    if (typeof is_active !== "boolean" && is_active !== 0 && is_active !== 1) {
      return res.status(400).json({ error: "invalid_status" });
    }

    // only admin can disable users
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "forbidden" });
    }

    conn = await db.getConnection();

    const [result] = await conn.query(
      "UPDATE users SET is_active = ? WHERE id = ?",
      [is_active ? 1 : 0, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "user_not_found" });
    }

    res.json({
      success: true,
      user_id: userId,
      is_active: is_active ? 1 : 0,
    });
  } catch (err) {
    console.error("Disable user error:", err);
    res.status(500).json({ error: "server_error" });
  } finally {
    if (conn) await conn.release();
  }
});


// ---------- Products endpoints ----------
app.get('/api/products', authMiddleware, async (req, res) => {
  let conn;
  try {

    conn = await db.getConnection();
    const [rows] = await conn.query('SELECT * FROM products ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    console.error('products error', err && err.message ? err.message : err);
    res.status(500).json({ error: 'db error' });
  } finally {
    if (conn) try { await conn.release(); } catch (e) { }
  }
});

app.post('/api/products', authMiddleware, async (req, res) => {

  let conn;

  try {

    const {
      name,
      description,
      hsn_code,
      uom,
      unit_price,
      tax_rate,
      model,
      status
    } = req.body;

    console.log("[ProductAPI] Received request body:", { name, description, uom, unit_price, tax_rate });

    if (!name || typeof name !== 'string' || !name.trim()) {
      console.log("[ProductAPI] Name validation failed:", { name, type: typeof name });
      return res.status(400).json({ error: "Product name is required and must be a string" });
    }

    conn = await db.getConnection();

    const insertValues = [
      name.trim(),
      (description && String(description).trim()) || "",
      hsn_code || "",
      uom || "NOS",
      Number(unit_price) || 0,
      Number(tax_rate) || 0,
      model || "",
      status || "active"
    ];

    console.log("[ProductAPI] Insert values:", insertValues);

    const [result] = await conn.query(
      `
        INSERT INTO products
        (
          name,
          description,
          hsn_code,
          uom,
          unit_price,
          tax_rate,
          model,
          status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
      insertValues
    );

    console.log("[ProductAPI] Insert result:", result);

    if (!result.insertId) {
      console.log("[ProductAPI] No insertId returned:", result);
      return res.status(500).json({ error: "Failed to create product - no insert ID returned" });
    }

    const [rows] = await conn.query(
      `SELECT * FROM products WHERE id = ?`,
      [result.insertId]
    );

    console.log("[ProductAPI] Select result:", rows);

    if (!rows || rows.length === 0) {
      console.log("[ProductAPI] Product not found after insert");
      return res.status(500).json({ error: "Product created but could not be retrieved" });
    }

    const product = rows[0];

    const responsePayload = {
      success: true,
      product: {
        id: product.id,
        name: product.name,
        description: product.description || "",
        hsn_code: product.hsn_code || "",
        uom: product.uom || "NOS",
        unit_price: Number(product.unit_price) || 0,
        tax_rate: Number(product.tax_rate) || 0,
        model: product.model || "",
        status: product.status || "active",
        created_at: product.created_at
      }
    };

    console.log("[ProductAPI] Sending response:", responsePayload);

    res.status(201).json(responsePayload);

  } catch (err) {

    console.error("[ProductAPI] Error:", err && err.message ? err.message : String(err));
    console.error("[ProductAPI] Full error:", err);
    res.status(500).json({ error: "Database error creating product. Please try again." });

  } finally {

    if (conn) try { conn.release(); } catch (e) { }

  }

});

app.put('/api/products/:id', async (req, res) => {
  let conn;
  const { id } = req.params;
  const { name, description, hsn_code, uom, unit_price, tax_rate, model, status } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name required' });

  try {
    conn = await db.getConnection();
    const [r] = await conn.query(
      `UPDATE products
        SET name=?, description=?, hsn_code=?, uom=?, unit_price=?, tax_rate=?, model=?, status=?
        WHERE id=?`,
      [name, description || '', hsn_code || '', uom || 'NOS', unit_price || 0, tax_rate || 0, model || '', status || 'active', id]
    );
    res.json({ affectedRows: r.affectedRows });
  } catch (err) {
    console.error('update product error', err && err.message ? err.message : err);
    res.status(500).json({ error: 'db error' });
  } finally {
    if (conn) try { await conn.release(); } catch (e) { }
  }
});

app.delete('/api/products/:id', async (req, res) => {
  let conn;
  const { id } = req.params;
  try {
    conn = await db.getConnection();
    const [r] = await conn.query('DELETE FROM products WHERE id = ?', [id]);
    res.json({ affectedRows: r.affectedRows });
  } catch (err) {
    console.error('delete product error', err && err.message ? err.message : err);
    res.status(500).json({ error: 'db error' });
  } finally {
    if (conn) try { await conn.release(); } catch (e) { }
  }
});


// ---------- BULK PRODUCT UPLOAD (EXCEL) ----------
app.post('/api/products/upload', authMiddleware, upload.single('file'), async (req, res) => {

  // 🔐 Admin, Sales, or Purchase allowed

  const userRole = String(req.user?.role).toLowerCase();
  if (!['admin', 'sales', 'purchase'].includes(userRole)) {
    return res.status(403).json({ error: 'Only Admin, Sales, or Purchase users can upload products' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  let conn;

  try {
    const workbook = XLSX.read(req.file.buffer);
    const sheetName = workbook.SheetNames.find(
      s => s.trim().toLowerCase() === 'products'
    );

    if (!sheetName) {
      return res.status(400).json({
        error: 'Missing sheet: Products',
        availableSheets: workbook.SheetNames
      });
    }

    const sheet = workbook.Sheets[sheetName];

    if (!sheet) {
      return res.status(400).json({ error: 'Missing sheet: Products' });
    }

    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    // DEBUG: Log first row to see all keys
    console.log('🔍 XLSX First Row Keys:', rows.length > 0 ? Object.keys(rows[0]) : 'No rows');
    if (rows.length > 0) {
      console.log('📊 Sample Row Data:', JSON.stringify(rows[0], null, 2));
    }

    // Helper function to find column value with case-insensitive and flexible matching
    const getExcelValue = (row, ...possibleKeys) => {
      for (const key of possibleKeys) {
        if (row[key] !== undefined && row[key] !== null) {
          return String(row[key] || '').trim();
        }
      }
      // If none match, try to find by lowercase version
      const rowKeys = Object.keys(row);
      for (const key of possibleKeys) {
        const match = rowKeys.find(k => k.toLowerCase() === key.toLowerCase());
        if (match && row[match]) {
          return String(row[match] || '').trim();
        }
      }
      return '';
    };

    let inserted = 0;
    let updated = 0;
    const errors = [];

    conn = await db.getConnection();
    await conn.beginTransaction();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      try {
        // Use flexible header detection
        const name = getExcelValue(row, 'name', 'Name', 'NAME').trim();
        if (!name) throw new Error('Missing product name');

        const description = getExcelValue(row, 'description', 'Description', 'DESCRIPTION');
        const hsn_code = getExcelValue(row, 'hsn_code', 'hsn', 'HSN', 'HSN_CODE', 'hsn code');
        const uom = (getExcelValue(row, 'uom', 'UOM', 'Unit') || 'NOS').toUpperCase();
        const model = getExcelValue(row, 'model', 'Model', 'MODEL');

        // DEBUG: Log model extraction for first few rows
        if (i < 3) console.log(`Row ${i + 2}: name="${name}", model="${model}", hsn="${hsn_code}"`);

        const unit_price = Number(getExcelValue(row, 'unit_price', 'Unit Price', 'unit price', 'price') || 0);
        const tax_rate = Number(getExcelValue(row, 'tax_rate', 'Tax Rate', 'tax rate', 'tax') || 0);

        let status = getExcelValue(row, 'status', 'Status', 'STATUS').toLowerCase();
        status = status === 'inactive' ? 'inactive' : 'active';

        if (isNaN(unit_price)) throw new Error('Invalid unit_price');
        if (isNaN(tax_rate)) throw new Error('Invalid tax_rate');

        const [[existing]] = await conn.query(
          `SELECT id FROM products WHERE name = ? LIMIT 1`,
          [name]
        );

        if (existing) {
          // UPDATE
          await conn.query(
            `UPDATE products
                SET description = ?, hsn_code = ?, uom = ?, unit_price = ?, tax_rate = ?, model = ?, status = ?
                WHERE id = ?`,
            [
              description,
              hsn_code,
              uom,
              unit_price,
              tax_rate,
              model,
              status,
              existing.id
            ]
          );
          updated++;
        } else {
          // INSERT
          await conn.query(
            `INSERT INTO products
                (name, description, hsn_code, uom, unit_price, tax_rate, model, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              name,
              description,
              hsn_code,
              uom,
              unit_price,
              tax_rate,
              model,
              status
            ]
          );
          inserted++;
        }

      } catch (rowErr) {
        errors.push({
          row: i + 2, // Excel row number
          product: row.name || '',
          error: rowErr.message
        });
      }
    }

    await conn.commit();

    return res.json({
      success: true,
      inserted,
      updated,
      failed: errors.length,
      errors
    });

  } catch (err) {
    if (conn) await conn.rollback();
    console.error('Product Excel upload failed:', err);
    return res.status(500).json({ error: 'Excel processing failed' });
  } finally {
    if (conn) conn.release();
  }
}
);

// ✅ NEW ENDPOINT: View a specific version snapshot
// GET /api/quotations/:id/version/:versionNumber
// Allows users to view v0.3 as it was, even when quotation is at v0.4
app.get('/api/quotations/:id/version/:versionNumber', authMiddleware, requireQuotationAccess, async (req, res) => {
  let conn;
  const rawId = req.params.id;
  const versionNumber = req.params.versionNumber;
  const id = sanitizeIdParam(rawId);
  if (!id) return res.status(400).json({ error: 'invalid id' });
  if (!versionNumber) return res.status(400).json({ error: 'version required' });

  try {
    if (!/^\d+$/.test(String(id))) return res.status(400).json({ error: 'invalid id' });

    conn = await db.getConnection();

    const [quotRows] = await conn.query('SELECT * FROM quotations WHERE id = ? LIMIT 1', [id]);
    if (!quotRows || quotRows.length === 0) return res.status(404).json({ error: 'quotation not found' });
    const current = quotRows[0];

    // If requesting current version, return from quotations table
    if (String(versionNumber) === String(current.version)) {
      return res.json({
        success: true,
        version: versionNumber,
        is_current: true,
        items: safeJsonParse(current.items, []),
        customer_name: current.customer_name,
        quotation_date: current.quotation_date,
        validity_days: current.validity_days,
        totals: {
          subtotal: current.subtotal,
          total_discount: current.total_discount,
          tax_total: current.tax_total,
          grand_total: current.total_value
        },
        terms: current.terms,
        notes: current.notes,
        status: current.status,
        updated_at: current.updated_at
      });
    }

    // Otherwise fetch from version history
    const [versionRows] = await conn.query(
      `SELECT
    qv.id,
    qv.version_label AS version,
    qv.items,
    qv.subtotal,
    qv.total_discount,
    qv.tax,
    qv.total,
    qv.change_history,
    qv.created_at,
    u.name AS changed_by
  FROM quotation_versions qv
  LEFT JOIN users u ON u.id = qv.created_by
  WHERE qv.quotation_id = ? AND qv.version_label = ?
  LIMIT 1`,
      [id, versionNumber]
    );

    if (!versionRows || versionRows.length === 0) {
      return res.status(404).json({ error: 'version not found' });
    }

    const versionData = versionRows[0];
    const changeHistory = safeJsonParse(versionData.change_history, {});
    const items = Array.isArray(changeHistory.items) ? changeHistory.items : safeJsonParse(versionData.items, []);

    return res.json({
      success: true,
      version: versionData.version,
      is_current: false,
      items: items,
      totals: {
        subtotal: Number(versionData.subtotal),
        total_discount: Number(versionData.total_discount),
        tax_total: Number(versionData.tax),
        grand_total: Number(versionData.total)
      },
      comment: changeHistory.comment || null,
      changed_by: versionData.changed_by || '',
      changed_at: versionData.created_at,
      note: `You are viewing version ${versionData.version} (historical). This is a snapshot from ${versionData.created_at}.`
    });
  } catch (err) {
    console.error('fetch specific version error:', err && err.message ? err.message : err);
    return res.status(500).json({ error: 'db error', details: err && err.message });
  } finally {
    if (conn) try { await conn.release(); } catch (e) { }
  }
});


// Version

// ---------- Get quotation version history (LIST) ----------
// GET /api/quotations/:id/versions
app.get('/api/quotations/:id/versions', authMiddleware, requireQuotationAccess, async (req, res) => {
  let conn;
  const rawId = req.params.id;
  const id = sanitizeIdParam(rawId);
  if (!id) return res.status(400).json({ error: 'invalid id' });

  try {
    conn = await db.getConnection();

    // Ensure quotation exists & access control
    const [qRows] = await conn.query(
      'SELECT id, salesperson_id FROM quotations WHERE id = ? LIMIT 1',
      [id]
    );
    if (!qRows || qRows.length === 0) {
      return res.status(404).json({ error: 'quotation not found' });
    }

    const q = qRows[0];
    const role = String(req.user?.role || '').toLowerCase();
    if (role !== 'admin' && q.salesperson_id !== req.user.id) {
      return res.status(403).json({ error: 'forbidden' });
    }

    const [currentRows] = await conn.query(
      'SELECT version FROM quotations WHERE id = ? LIMIT 1',
      [id]
    );

    const currentVersion = currentRows?.[0]?.version || null;

    // ✅ SAFE QUERY (NO LOGIC CHANGE)
    const [rows] = await conn.query(
      `
     SELECT
  qv.id,
  qv.version_label AS version,
  qv.items AS items_snapshot,

  JSON_OBJECT(
    'subtotal', IFNULL(qv.subtotal, 0),
    'total_discount', IFNULL(qv.total_discount, 0),
    'tax_total', IFNULL(qv.tax, 0),
    'grand_total', IFNULL(qv.total, 0)
  ) AS totals_snapshot,

  CASE 
    WHEN JSON_VALID(qv.change_history) 
    THEN JSON_UNQUOTE(JSON_EXTRACT(qv.change_history, '$.comment'))
    ELSE NULL
  END AS comment,

  u.name AS changed_by,
  qv.created_at AS changed_at

FROM quotation_versions qv
LEFT JOIN users u ON u.id = qv.created_by
WHERE qv.quotation_id = '1'
ORDER BY qv.created_at DESC;
      `,
      [id]
    );

    // ✅ SAFE PARSING (NO LOGIC CHANGE)
    const history = (rows || []).map(r => ({
      ...r,
      is_current: false,

      items_snapshot:
        typeof r.items_snapshot === 'string'
          ? safeJSONParse(r.items_snapshot)
          : r.items_snapshot || null,

      totals_snapshot:
        typeof r.totals_snapshot === 'string'
          ? safeJSONParse(r.totals_snapshot)
          : r.totals_snapshot || null,
    }));

    // Inject current version at top
    if (currentVersion) {
      history.unshift({
        id: 0,
        version: currentVersion,
        is_current: true,
        changed_by: 'Current',
        changed_at: new Date(),
        items_snapshot: null,
        totals_snapshot: null,
        comment: null,
      });
    }

    res.json(history);

  } catch (err) {
    console.error('❌ fetch version history error:', err); // 🔥 important
    res.status(500).json({ error: 'db error', details: err.message });
  } finally {
    if (conn) try { await conn.release(); } catch {}
  }
});


// ✅ HELPER (MANDATORY)
function safeJSONParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
// ---------- Get quotation decisions (Won/Lost) ----------
app.get('/api/quotations/:id/decisions', authMiddleware, requireQuotationAccess, async (req, res) => {
  let conn;
  const rawId = req.params.id;
  const id = sanitizeIdParam(rawId);
  if (!id) return res.status(400).json({ error: 'invalid id' });

  try {
    if (!/^\d+$/.test(String(id))) return res.status(400).json({ error: 'invalid id' });

    conn = await db.getConnection();

    const [rows] = await conn.query('SELECT * FROM quotations WHERE id = ? LIMIT 1', [id]);
    if (!rows || rows.length === 0) return res.status(404).json({ error: 'quotation not found' });

    // Fetch decisions
    const [decisions] = await conn.query(
      `SELECT id, quotation_id, decision, comment, decided_by, decided_at
        FROM quotation_decisions
        WHERE quotation_id = ?
        ORDER BY decided_at DESC
        LIMIT 1`,
      [id]
    );

    const latest = Array.isArray(decisions) && decisions.length > 0 ? decisions[0] : null;

    return res.json({ success: true, decision: latest });
  } catch (err) {
    console.error('fetch decisions error:', err && err.message ? err.message : err);
    return res.status(500).json({ error: 'db error', details: err && err.message });
  } finally {
    if (conn) try { await conn.release(); } catch (e) { }
  }
});


// ---------- Mark quotation WON / LOST ----------
app.post('/api/quotations/:id/decision', authMiddleware, requireQuotationAccess, async (req, res) => {
  let conn;
  const rawId = req.params.id;
  const id = sanitizeIdParam(rawId);
  const { decision, comment } = req.body;

  if (!id || !['won', 'lost'].includes(decision)) {
    return res.status(400).json({ error: 'Invalid request' });
  }

  try {
    conn = await db.getConnection();

    const [[q]] = await conn.query(
      `SELECT id, status, validity_start_date, validity_days
       FROM quotations WHERE id = ?`,
      [id]
    );

    if (!q) {
      return res.status(404).json({ error: 'Quotation not found' });
    }

    // 🔴 RULE 1: Already closed
    if (q.status === 'won' || q.status === 'lost') {
      return res.status(409).json({
        error: 'already_closed'
      });
    }

    // 🔴 RULE 2: VALIDITY CHECK
    const validity = computeValidityState(q);

    if (validity === 'expired') {
      return res.status(409).json({
        error: 'expired_quote',
        message: 'Cannot mark expired quotation as WON/LOST. Reissue required.'
      });
    }

    // ✅ UPDATE
    await conn.query(
      `UPDATE quotations SET status = ? WHERE id = ?`,
      [decision, id]
    );

    // ✅ SAVE DECISION HISTORY
    await conn.query(
      `INSERT INTO quotation_decisions
       (quotation_id, decision, comment, decided_by, decided_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [
        id,
        decision,
        comment || null,
        req.user?.name || 'system'
      ]
    );

    return res.json({ success: true });

  } catch (err) {
    console.error('decision error:', err);
    return res.status(500).json({ error: 'server error' });
  } finally {
    if (conn) conn.release();
  }
});

// ---------- Update quotation (protected) ----------
app.put('/api/quotations/:id', authMiddleware, async (req, res) => {
  let conn;

  const rawId = req.params.id;
  const id = sanitizeIdParam(rawId);
  if (!id) return res.status(400).json({ error: 'invalid id' });

  const {
    quotation_no,
    customer_name,
    customer_snapshot,
    customer_location_id,
    customer_contact_id,
    quotation_date,
    validity_days,
    items,
    notes,
    remarks,
    terms,
    payment_terms,
    status,
    salesperson_id,
    versionComment
  } = req.body || {};

  try {
    conn = await db.getConnection();

    const [rows] = await conn.query(
      'SELECT * FROM quotations WHERE id = ? LIMIT 1',
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'not found' });
    }

    const existing = rows[0];

    /* ---------------- STATUS RESOLUTION ---------------- */

    const saveMode = String(req.body.save_mode || 'final').toLowerCase();
    const isDraftSave = saveMode === 'draft';

    const oldStatus = String(existing.status || 'draft').toLowerCase();

    const incomingStatus = status
      ? String(status).toLowerCase()
      : oldStatus;

    const finalStatus = isDraftSave ? 'draft' : incomingStatus;

    /* ---------------- VALIDITY LOGIC ---------------- */

    let validityStartDate = existing.validity_start_date;

    const isActivating =
      oldStatus === 'draft' &&
      finalStatus !== 'draft';

    // Set validity_start_date when activating from draft
    if (!existing.validity_start_date && isActivating) {
      const today = new Date();
      validityStartDate = today.toISOString().split('T')[0]; // Format as YYYY-MM-DD
    }

    // 🔧 FIX: When editing validity_days, reset validity_start_date to today
    // This ensures the remaining days calculation is correct (not off by one)
    if (validity_days !== undefined && validity_days !== null && Number(validity_days) !== Number(existing.validity_days)) {
      const today = new Date();
      validityStartDate = today.toISOString().split('T')[0]; // Format as YYYY-MM-DD
    }

    /* ---------------- PERMISSION CHECK ---------------- */

    const requesterRole = String(req.user?.role || '').toLowerCase();
    const requesterId = Number(req.user?.id || 0);
    const isAdmin = requesterRole === 'admin';

    if (!isAdmin && Number(existing.salesperson_id) !== requesterId) {
      return res.status(403).json({ error: 'forbidden' });
    }

    /* ---------------- EDIT LOCK ---------------- */

    if (!['draft', 'pending'].includes(oldStatus)) {
      return res.status(409).json({
        error: 'locked',
        message: 'Quotation cannot be edited in this status'
      });
    }

    /* ---------------- QUOTATION NO ---------------- */

    let finalQuotationNo = existing.quotation_no;

    if (
      ['draft', 'pending'].includes(oldStatus) &&
      quotation_no &&
      quotation_no.trim() !== existing.quotation_no
    ) {
      const [[exists]] = await conn.query(
        'SELECT id FROM quotations WHERE quotation_no = ? AND id != ?',
        [quotation_no.trim(), id]
      );

      if (exists) {
        return res.status(409).json({
          error: 'quotation_no_exists'
        });
      }

      finalQuotationNo = quotation_no.trim();
    }

    /* ---------------- SNAPSHOT ---------------- */

    let snapshotToSave = existing.customer_snapshot;

    if (customer_snapshot && typeof customer_snapshot === 'object') {
      snapshotToSave = JSON.stringify(customer_snapshot);
    }

    if (snapshotToSave && typeof snapshotToSave !== 'string') {
      snapshotToSave = JSON.stringify(snapshotToSave);
    }

    /* ---------------- ITEMS & TOTALS ---------------- */

    const parsedItems = Array.isArray(items)
      ? items
      : safeJsonParse(items || existing.items, []);

    const itemsJson = JSON.stringify(parsedItems);

    // ✅ Extract model data from items
    const modelsData = (parsedItems || []).map(item => ({
      product_id: item.product_id,
      model: item.model || null
    }));
    const modelsJson = modelsData.length > 0 ? JSON.stringify(modelsData) : null;

    const totals = calculateTotals(parsedItems);

    const dbDate =
      normalizeDateForDb(quotation_date) ||
      existing.quotation_date;

    /* ---------------- SALESPERSON ---------------- */

    const finalSalespersonId =
      salesperson_id ?? existing.salesperson_id;

    let salespersonPhone = existing.salesperson_phone;
    let salespersonEmail = existing.salesperson_email;

    if (Number(finalSalespersonId) !== Number(existing.salesperson_id)) {
      const [userRows] = await conn.query(
        'SELECT phone, email FROM users WHERE id = ?',
        [finalSalespersonId]
      );

      salespersonPhone = userRows?.[0]?.phone || null;
      salespersonEmail = userRows?.[0]?.email || null;
    }

    /* ---------------- VERSION ---------------- */

    const versionBumped = !isDraftSave;
    const newVersion = versionBumped
      ? getNextVersion(existing.version)
      : existing.version;

    /* ---------------- UPDATE ---------------- */

    await conn.query(
      `UPDATE quotations SET
          quotation_no = ?,
          customer_name = ?,
          customer_snapshot = ?,
          customer_location_id = ?,
          customer_contact_id = ?,
          quotation_date = ?,
          validity_days = ?,
          validity_start_date = ?,
          items = ?,
          model = ?,
          subtotal = ?,
          total_discount = ?,
          tax_total = ?,
          total_value = ?,
          notes = ?,
          remarks = ?,
          terms = ?,
          payment_terms = ?,
          status = ?,
          salesperson_id = ?,
          salesperson_phone = ?,
          salesperson_email = ?,
          version = ?
        WHERE id = ?`,
      [
        finalQuotationNo,
        customer_name ?? existing.customer_name,
        snapshotToSave,
        customer_location_id ?? existing.customer_location_id,
        customer_contact_id ?? existing.customer_contact_id,
        dbDate,
        validity_days ?? existing.validity_days,
        validityStartDate,
        itemsJson,
        modelsJson,
        totals.subtotal,
        totals.total_discount,
        totals.tax_total,
        totals.grand_total,
        notes ?? existing.notes,
        remarks ?? existing.remarks,
        terms ?? existing.terms,
        payment_terms ?? existing.payment_terms,
        finalStatus,
        finalSalespersonId,
        salespersonPhone,
        salespersonEmail,
        newVersion,
        id
      ]
    );

    /* ---------------- VERSION SNAPSHOT ---------------- */

    if (versionBumped) {
      const [major, minor] = String(existing.version)
        .split('.')
        .map(v => parseInt(v, 10) || 0);

      await conn.query(
        `INSERT INTO quotation_versions (
            quotation_id,
            version_major,
            version_minor,
            version_label,
            items,
            subtotal,
            total_discount,
            tax,
            total,
            change_history,
            created_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          major,
          minor,
          existing.version,
          JSON.stringify(safeJsonParse(existing.items, [])),
          existing.subtotal,
          existing.total_discount,
          existing.tax_total,
          existing.total_value,
          JSON.stringify({
            comment: versionComment || null
          }),
          req.user?.id
        ]
      );
    }

    /* ---------------- FETCH UPDATED ---------------- */

    const [rows2] = await conn.query(
      `SELECT q.*, u.name as salesperson_name
        FROM quotations q
        LEFT JOIN users u ON u.id = q.salesperson_id
        WHERE q.id = ?`,
      [id]
    );

    const updated = rows2[0];
    updated.items = safeJsonParse(updated.items, []);

    return res.json({
      success: true,
      quotation: updated
    });

  } catch (err) {
    console.error('update quotation error', err);
    res.status(500).json({ error: 'db error' });
  } finally {
    if (conn) conn.release();
  }
});
// ---------- Approve quotation (admin only) ----------
async function handleApproveQuotation(req, res) {
  let conn;
  const rawId = req.params.id;
  const id = sanitizeIdParam(rawId);
  if (!id) return res.status(400).json({ error: 'invalid id' });

  try {
    if (!/^\d+$/.test(String(id))) return res.status(400).json({ error: 'invalid id' });

    const requesterRole = (req.user && req.user.role) ? String(req.user.role).toLowerCase() : null;
    if (requesterRole !== 'admin') return res.status(403).json({ error: 'forbidden', message: 'Only admin users can approve quotations' });


    conn = await db.getConnection();

    const [rows] = await conn.query('SELECT * FROM quotations WHERE id = ? LIMIT 1', [id]);
    if (!rows || rows.length === 0) return res.status(404).json({ error: 'not found' });
    const q = rows[0];

    if (q.status && String(q.status).toLowerCase() === 'approved') return res.status(409).json({ error: 'already_approved', message: 'Quotation already approved' });

    const approver = (req.user && (req.user.name || req.user.email)) ? (req.user.name || req.user.email) : 'system';
    const approvedAt = new Date();

    const [uRes] = await conn.query('UPDATE quotations SET status = ?, approved_by = ?, approved_at = ? WHERE id = ?', ['approved', approver, approvedAt, id]);
    if (!uRes || (uRes.affectedRows == null) || uRes.affectedRows === 0) return res.status(500).json({ error: 'update_failed' });

    const [rows2] = await conn.query(`
        SELECT q.*, u.name as salesperson_name
        FROM quotations q
        LEFT JOIN users u ON u.id = q.salesperson_id
        WHERE q.id = ?
        LIMIT 1
      `, [id]);

    if (!rows2 || rows2.length === 0) return res.status(500).json({ error: 'fetch_failed' });

    const updated = rows2[0];
    updated.items = safeJsonParse(updated.items, []);
    updated.quotation_no = fixYearFormat(updated.quotation_no);

    try {

      const notifUUID = `notif-qt-approve-${id}-${Date.now()}`;
      const title = `Quotation ${updated.quotation_no} approved`;
      const description = `Quotation ${updated.quotation_no} approved by ${approver}`;
      const url = `/quotations/${id}`;
      const [nRes] = await conn.query(`INSERT INTO notifications (uuid, title, description, url, user_id) VALUES (?, ?, ?, ?, NULL)`, [notifUUID, title, description, url]);
      const [nRows] = await conn.query('SELECT id, uuid, title, description, url, user_id, created_at FROM notifications WHERE id = ?', [nRes.insertId]);
      const notifRow = Array.isArray(nRows) && nRows[0] ? nRows[0] : null;

      if (notifRow && app.locals && typeof app.locals.broadcastNotification === 'function') {
        const notif = {
          id: notifRow.id,
          uuid: notifRow.uuid,
          title: notifRow.title,
          description: notifRow.description,
          url: notifRow.url,
          user_id: notifRow.user_id,
          createdAt: (notifRow.created_at instanceof Date) ? notifRow.created_at.toISOString() : String(notifRow.created_at)
        };
        app.locals.broadcastNotification(notif);
      }
    } catch (notifErr) {
      console.error('Failed to persist/broadcast approval notification:', notifErr && notifErr.message ? notifErr.message : notifErr);
    }

    return res.json({ success: true, quotation: updated });
  } catch (err) {
    console.error('approve quotation error:', err && err.message ? err.message : err);
    return res.status(500).json({ error: 'db error', details: err && err.message });
  } finally {
    if (conn) try { await conn.release(); } catch (e) { }
  }
}

app.put('/api/quotations/:id/approve', authMiddleware, handleApproveQuotation);
app.post('/api/quotations/:id/approve', authMiddleware, requireQuotationCreation, handleApproveQuotation);

// ---------- Mark quotation as WON ----------
app.post('/api/quotations/:id/won', authMiddleware, requireQuotationCreation, async (req, res) => {
  let conn;
  const rawId = req.params.id;
  const id = sanitizeIdParam(rawId);
  if (!id) return res.status(400).json({ error: 'invalid id' });

  try {
    if (!/^\d+$/.test(String(id))) return res.status(400).json({ error: 'invalid id' });

    conn = await db.getConnection();

    const [rows] = await conn.query('SELECT * FROM quotations WHERE id = ? LIMIT 1', [id]);
    if (!rows || rows.length === 0) return res.status(404).json({ error: 'quotation not found' });
    const q = rows[0];

    // Check if already won/lost
    const existingStatus = q.status && String(q.status).toLowerCase();
    if (existingStatus === 'won' || existingStatus === 'lost') {
      return res.status(409).json({ error: 'already_decided', message: `Quotation already marked as ${existingStatus}` });
    }

    // Only salesperson, admin can mark won
    const requesterRole = (req.user && req.user.role) ? String(req.user.role).toLowerCase() : null;
    const requesterId = (req.user && req.user.id) ? Number(req.user.id) : null;
    const isAdmin = requesterRole === 'admin';
    const ownerId = q.salesperson_id != null ? Number(q.salesperson_id) : null;

    if (!isAdmin && (!requesterId || ownerId !== requesterId)) {
      return res.status(403).json({ error: 'forbidden', message: 'You do not have permission to mark this quotation as won' });
    }

    const decidedBy = (req.user && (req.user.name || req.user.email)) ? (req.user.name || req.user.email) : 'system';
    const decidedAt = new Date();

    // Update quotation status to 'won' and set validity_days to 0 to stop counting
    const [uRes] = await conn.query(
      'UPDATE quotations SET status = ?, validity_days = 0 WHERE id = ?',
      ['won', id]
    );
    if (!uRes || (uRes.affectedRows == null) || uRes.affectedRows === 0) {
      return res.status(500).json({ error: 'update_failed' });
    }

    // Record decision in quotation_decisions table
    const [dRes] = await conn.query(
      'INSERT INTO quotation_decisions (quotation_id, decision, decided_by, decided_at) VALUES (?, ?, ?, ?)',
      [id, 'won', decidedBy, decidedAt]
    );

    // Fetch updated quotation
    const [rows2] = await conn.query(`
        SELECT q.*, u.name as salesperson_name
        FROM quotations q
        LEFT JOIN users u ON u.id = q.salesperson_id
        WHERE q.id = ?
        LIMIT 1
      `, [id]);

    if (!rows2 || rows2.length === 0) return res.status(500).json({ error: 'fetch_failed' });

    const updated = rows2[0];
    updated.items = safeJsonParse(updated.items, []);
    updated.quotation_no = fixYearFormat(updated.quotation_no);

    // Notify
    try {
      const notifUUID = `notif-qt-won-${id}-${Date.now()}`;
      const title = `Quotation ${updated.quotation_no} marked as Won`;
      const description = `Quotation ${updated.quotation_no} marked as Won by ${decidedBy}`;
      const url = `/quotations/${id}`;
      await conn.query(
        'INSERT INTO notifications (uuid, title, description, url, user_id) VALUES (?, ?, ?, ?, NULL)',
        [notifUUID, title, description, url]
      );
    } catch (notifErr) {
      console.error('Failed to persist won notification:', notifErr && notifErr.message ? notifErr.message : notifErr);
    }

    return res.json({ success: true, quotation: updated });
  } catch (err) {
    console.error('mark won quotation error:', err && err.message ? err.message : err);
    return res.status(500).json({ error: 'db error', details: err && err.message });
  } finally {
    if (conn) try { await conn.release(); } catch (e) { }
  }
});

// ---------- Mark quotation as LOST (requires comment) ----------
app.post('/api/quotations/:id/lost', authMiddleware, requireQuotationCreation, async (req, res) => {
  let conn;
  const rawId = req.params.id;
  const id = sanitizeIdParam(rawId);
  if (!id) return res.status(400).json({ error: 'invalid id' });

  const { comment } = req.body || {};

  // Validate: comment is mandatory for lost
  if (!comment || String(comment).trim() === '') {
    return res.status(400).json({ error: 'comment_required', message: 'Loss reason (comment) is mandatory' });
  }

  try {
    if (!/^\d+$/.test(String(id))) return res.status(400).json({ error: 'invalid id' });

    conn = await db.getConnection();

    const [rows] = await conn.query('SELECT * FROM quotations WHERE id = ? LIMIT 1', [id]);
    if (!rows || rows.length === 0) return res.status(404).json({ error: 'quotation not found' });
    const q = rows[0];

    // Check if already won/lost
    const existingStatus = q.status && String(q.status).toLowerCase();
    if (existingStatus === 'won' || existingStatus === 'lost') {
      return res.status(409).json({ error: 'already_decided', message: `Quotation already marked as ${existingStatus}` });
    }

    // Any authenticated user can mark lost (sales team)
    const decidedBy = (req.user && (req.user.name || req.user.email)) ? (req.user.name || req.user.email) : 'system';
    const decidedAt = new Date();

    // Update quotation status to 'lost' and set validity_days to 0 to stop counting
    const [uRes] = await conn.query(
      'UPDATE quotations SET status = ?, validity_days = 0 WHERE id = ?',
      ['lost', id]
    );
    if (!uRes || (uRes.affectedRows == null) || uRes.affectedRows === 0) {
      return res.status(500).json({ error: 'update_failed' });
    }

    // Record decision in quotation_decisions table with reason
    const [dRes] = await conn.query(
      'INSERT INTO quotation_decisions (quotation_id, decision, comment, decided_by, decided_at) VALUES (?, ?, ?, ?, ?)',
      [id, 'lost', comment, decidedBy, decidedAt]
    );

    // Fetch updated quotation
    const [rows2] = await conn.query(`
        SELECT q.*, u.name as salesperson_name
        FROM quotations q
        LEFT JOIN users u ON u.id = q.salesperson_id
        WHERE q.id = ?
        LIMIT 1
      `, [id]);

    if (!rows2 || rows2.length === 0) return res.status(500).json({ error: 'fetch_failed' });

    const updated = rows2[0];
    updated.items = safeJsonParse(updated.items, []);
    updated.quotation_no = fixYearFormat(updated.quotation_no);

    // Notify
    try {
      const notifUUID = `notif-qt-lost-${id}-${Date.now()}`;
      const title = `Quotation ${updated.quotation_no} marked as Lost`;
      const description = `Quotation ${updated.quotation_no} marked as Lost by ${decidedBy}. Reason: ${comment}`;
      const url = `/quotations/${id}`;
      await conn.query(
        'INSERT INTO notifications (uuid, title, description, url, user_id) VALUES (?, ?, ?, ?, NULL)',
        [notifUUID, title, description, url]
      );
    } catch (notifErr) {
      console.error('Failed to persist lost notification:', notifErr && notifErr.message ? notifErr.message : notifErr);
    }

    return res.json({ success: true, quotation: updated });
  } catch (err) {
    console.error('mark lost quotation error:', err && err.message ? err.message : err);
    return res.status(500).json({ error: 'db error', details: err && err.message });
  } finally {
    if (conn) try { await conn.release(); } catch (e) { }
  }
});

// ---------- Create follow-up for a quotation ----------

app.post('/api/quotations/:id/followups', authMiddleware, requireQuotationCreation, async (req, res) => {
  const quotationId = Number(req.params.id);
  const {
    followup_date,
    note,
    followup_type,
    next_followup_date = null,
  } = req.body;

  const ALLOWED_TYPES = [
    "call",
    "email",
    "whatsapp",
    "meeting",
    "site_visit",
    "other",
  ];

  if (
    !quotationId ||
    !followup_date ||
    !note?.trim() ||
    !ALLOWED_TYPES.includes(followup_type)
  ) {
    return res.status(400).json({ error: "Invalid follow-up data" });
  }

  const userId = req.user.id;

  if (!quotationId || !followup_date || !note?.trim()) {
    return res.status(400).json({ error: 'Invalid follow-up data' });
  }

  let conn;
  try {
    conn = await db.getConnection();
    await conn.beginTransaction();

    // 🔒 Lock quotation & validate status
    const [[quotation]] = await conn.query(
      `
          SELECT id, status
          FROM quotations
          WHERE id = ?
          FOR UPDATE
          `,
      [quotationId]
    );

    if (!quotation) {
      await conn.rollback();
      return res.status(404).json({ error: 'Quotation not found' });
    }

    const allowedStatuses = ['draft', 'pending'];

    if (!allowedStatuses.includes(String(quotation.status).toLowerCase())) {
      await conn.rollback();
      return res.status(409).json({
        error: 'Follow-ups allowed only for draft or pending quotations',
      });
    }

    // ✅ Insert follow-up
    await conn.query(
      `
          INSERT INTO quotation_followups
    (
      quotation_id,
      created_by,
      followup_date,
      note,
      followup_type,
      next_followup_date
    )
  VALUES (?, ?, ?, ?, ?, ?)
          `,
      [
        quotationId,
        userId,
        followup_date,
        note.trim(),
        followup_type,
        next_followup_date,
      ]
    );

    await conn.commit();
    res.json({ success: true });
  } catch (err) {
    if (conn) await conn.rollback();
    console.error(err);
    res.status(500).json({ error: 'Failed to create follow-up' });
  } finally {
    if (conn) conn.release();
  }
}
);

//---------------Fetch follow-ups for a quotation ----------------

app.get('/api/quotations/:id/followups', authMiddleware, requireQuotationAccess, async (req, res) => {
  const quotationId = Number(req.params.id);
  if (!quotationId) {
    return res.status(400).json({ error: 'Invalid quotation id' });
  }

  let conn;
  try {
    conn = await db.getConnection();

    const [rows] = await conn.query(
      `
          SELECT
    f.id,
    f.followup_date,
    f.note,
    f.followup_type,
    f.next_followup_date,
    f.is_completed,
    f.completed_at,
    f.created_at,
    u.name AS created_by_name
  FROM quotation_followups f
  LEFT JOIN users u ON u.id = f.created_by
  WHERE f.quotation_id = ?
  ORDER BY f.created_at DESC
          `,
      [quotationId]
    );

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch follow-ups' });
  } finally {
    if (conn) conn.release();
  }
}
);

//-----------complete follow-up ----------------

app.put('/api/quotation-followups/:id/complete', authMiddleware, async (req, res) => {
  const id = Number(req.params.id);
  if (!id) {
    return res.status(400).json({ error: "Invalid follow-up id" });
  }

  let conn;
  try {
    conn = await db.getConnection();

    await conn.query(
      `
          UPDATE quotation_followups
  SET
    is_completed = 1,
    completed_at = NOW(),
    next_followup_date = NULL
  WHERE id = ?
          `,
      [id]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Failed to complete follow-up:", err);
    res.status(500).json({ error: "Failed to complete follow-up" });
  } finally {
    if (conn) conn.release();
  }
}
);

// ---------- Delete quotation ----------
app.delete('/api/quotations/:id', authMiddleware, async (req, res) => {
  let conn;
  const rawId = req.params.id;
  const id = sanitizeIdParam(rawId);
  if (!id) return res.status(400).json({ error: 'invalid id' });

  const force = String(req.query.force || '').toLowerCase() === 'true';
  try {

    conn = await db.getConnection();

    const [rows] = await conn.query('SELECT id, status, salesperson_id FROM quotations WHERE id = ? LIMIT 1', [id]);
    if (!rows || rows.length === 0) return res.status(404).json({ error: 'quotation not found' });
    const q = rows[0];

    // Only owner or admin can delete; force delete requires admin
    const requesterRole = (req.user && req.user.role) ? String(req.user.role).toLowerCase() : null;
    const requesterId = (req.user && req.user.id) ? Number(req.user.id) : null;
    const isAdmin = requesterRole === 'admin';
    const ownerId = q.salesperson_id != null ? Number(q.salesperson_id) : null;
    if (!isAdmin && (!requesterId || ownerId !== requesterId)) {
      return res.status(403).json({ error: 'forbidden', message: 'You do not have permission to delete this quotation' });
    }

    if (q.status && String(q.status).toLowerCase() === 'approved' && !force) {
      return res.status(409).json({ error: 'cannot_delete_approved', message: 'Approved quotations cannot be deleted.' });
    }

    if (force) {
      if (!isAdmin) return res.status(403).json({ error: 'forbidden', message: 'Only admin users can force delete quotations' });

      const [delRes] = await conn.query('DELETE FROM quotations WHERE id = ?', [id]);
      const affected = delRes && (delRes.affectedRows != null) ? delRes.affectedRows : 0;

      try {

        const notifUUID = `notif-qt-force-delete-${id}-${Date.now()}`;
        const title = `Quotation ${id} force-deleted`;
        const description = `Quotation ${id} force-deleted by ${req.user && (req.user.name || req.user.email) ? (req.user.name || req.user.email) : 'admin'}`;
        const url = `/quotations/${id}`;
        await conn.query('INSERT INTO notifications (uuid, title, description, url, user_id) VALUES (?, ?, ?, ?, ?)', [notifUUID, title, description, url, req.user ? req.user.id : null]);
      } catch (notifErr) {
        console.error('Failed to persist force-delete notification:', notifErr && notifErr.message ? notifErr.message : notifErr);
      }

      return res.json({ success: true, force: true, affectedRows: affected });
    }

    const deleterId = (req.user && req.user.id) ? req.user.id : null;
    const now = new Date();
    const [uRes] = await conn.query('UPDATE quotations SET is_deleted = 1, deleted_at = ?, deleted_by = ? WHERE id = ?', [now, deleterId, id]);

    try {

      const notifUUID = `notif-qt-delete-${id}-${Date.now()}`;
      const title = `Quotation ${id} deleted`;
      const description = `Quotation ${id} deleted by ${req.user && (req.user.name || req.user.email) ? (req.user.name || req.user.email) : 'user'}`;
      const url = `/quotations/${id}`;
      await conn.query('INSERT INTO notifications (uuid, title, description, url, user_id) VALUES (?, ?, ?, ?, ?)', [notifUUID, title, description, url, deleterId]);
    } catch (notifErr) {
      console.error('Failed to persist deletion notification:', notifErr && notifErr.message ? notifErr.message : notifErr);
    }

    return res.json({ success: true, affectedRows: uRes.affectedRows, force: false });
  } catch (err) {
    console.error('❌ delete quotation error:', {
      message: err && err.message,
      code: err && err.code,
      sqlMessage: err && err.sqlMessage,
      stack: err && err.stack
    });
    return res.status(500).json({ error: 'db error', details: err && err.message, code: err && err.code });
  } finally {
    if (conn) try { await conn.release(); } catch (e) { }
  }
});

//////////////////--------------EXAMPLE-----------------------/////////////////////////

app.post("/api/settings/test-email", authMiddleware, async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin only" });
  }

  const settings = await getSettingsFromDB();

  if (!settings.smtp_host || !settings.smtp_user) {
    return res.status(400).json({ error: "SMTP not configured" });
  }

  const transporter = nodemailer.createTransport({
    host: settings.smtp_host,
    port: Number(settings.smtp_port),
    secure: Number(settings.smtp_port) === 465,
    auth: {
      user: settings.smtp_user,
      pass: process.env.SMTP_PASSWORD,
    },
  });

  await transporter.sendMail({
    from: settings.smtp_from || settings.smtp_user,
    to: req.user.email,
    subject: "SMTP Test Email",
    text: "Your SMTP configuration is working correctly.",
  });

  res.json({ ok: true });
});

// ================= FRONTEND (PRODUCTION) =================

// Serve React build
app.use(
  express.static(
    path.join(__dirname, "../../frontend/dist")
  )
);

// SPA fallback — MUST BE LAST ROUTE
app.get("*", (req, res) => {
  res.sendFile(
    path.join(__dirname, "../../frontend/dist/index.html")
  );
});

// ---------- Server start (when run directly) ----------
if (require.main === module) {

  (async () => {
    try {
      const { httpServer, io } = await createServerAndIO();

      httpServer.listen(PORT, () => {
        console.log(`Server listening on port ${PORT}`);
        console.log('Socket.IO path: /socket.io');
      });

      httpServer.on('error', (err) => {
        if (err && err.code === 'EADDRINUSE') {
          console.error(`Port ${PORT} is already in use.`);
        } else {
          console.error('Server error:', err && err.message ? err.message : err);
        }
        process.exit(1);
      });

    } catch (err) {
      console.error('Failed to start server with Socket.IO:', err && (err.message || err));
      process.exit(1);
    }
  })();
}
module.exports = app;