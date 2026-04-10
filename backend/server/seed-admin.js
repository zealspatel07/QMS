// server/seed-admin.js
require('dotenv').config();
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');

(async () => {
  try {
    const {
      // Railway-style
      MYSQLHOST,
      MYSQLUSER,
      MYSQLPASSWORD,
      MYSQLDATABASE,
      MYSQLPORT,

      // cPanel / local-style
      MYSQL_HOST,
      MYSQL_USER,
      MYSQL_PASSWORD,
      MYSQL_DATABASE,
      MYSQL_PORT,

      ADMIN_EMAIL,
      ADMIN_PASSWORD,
    } = process.env;

    // Resolve DB config (Railway OR cPanel)
    const host = MYSQLHOST || MYSQL_HOST;
    const user = MYSQLUSER || MYSQL_USER;
    const password = MYSQLPASSWORD || MYSQL_PASSWORD;
    const database = MYSQLDATABASE || MYSQL_DATABASE;
    const port = Number(MYSQLPORT || MYSQL_PORT || 3306);

    if (!host || !user || !password || !database) {
      throw new Error('Missing MySQL environment variables');
    }

    if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
      throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be set');
    }

    console.log('🔌 Connecting to DB:', database);

    const conn = await mysql.createConnection({
      host,
      user,
      password,
      database,
      port,
    });

    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

    // Username must satisfy your login regex
    const adminUsername = 'ADMIN@ROOT';

    // 🔐 UPSERT ADMIN USER
    await conn.query(
      `
      INSERT INTO users (username, email, name, password_hash, role, is_active)
      VALUES (?, ?, 'Admin', ?, 'admin', 1)
      ON DUPLICATE KEY UPDATE
        password_hash = VALUES(password_hash),
        role = 'admin',
        is_active = 1
      `,
      [adminUsername, ADMIN_EMAIL, passwordHash]
    );

    console.log('✅ Admin user created / updated successfully');
    console.log(`👉 Username: ${adminUsername}`);
    console.log(`👉 Email: ${ADMIN_EMAIL}`);

    await conn.end();
    process.exit(0);
  } catch (err) {
    console.error('❌ Admin seed failed:', err.message || err);
    process.exit(1);
  }
})();
