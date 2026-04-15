// server/migrations/05_add_closed_columns.js
const mysql = require('mysql2/promise');

(async () => {
  let conn;

  try {
    const dbName = process.env.DB_NAME || 'prayosha';

    conn = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: dbName,
    });

    console.log('Adding closed columns to purchase_orders table (safe check)...');

    async function columnExists(columnName) {
      const [rows] = await conn.query(
        `SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'purchase_orders' AND COLUMN_NAME = ?`,
        [dbName, columnName]
      );
      return rows[0].cnt > 0;
    }

    if (!(await columnExists('closed_reason'))) {
      console.log('Adding column: closed_reason');
      await conn.query(`ALTER TABLE purchase_orders ADD COLUMN closed_reason TEXT NULL`);
    } else {
      console.log('Column closed_reason already exists');
    }

    if (!(await columnExists('closed_at'))) {
      console.log('Adding column: closed_at');
      await conn.query(`ALTER TABLE purchase_orders ADD COLUMN closed_at DATETIME NULL`);
    } else {
      console.log('Column closed_at already exists');
    }

    if (!(await columnExists('closed_by'))) {
      console.log('Adding column: closed_by');
      await conn.query(`ALTER TABLE purchase_orders ADD COLUMN closed_by INT NULL`);
    } else {
      console.log('Column closed_by already exists');
    }

    console.log('✓ closed columns ensured successfully');

    await conn.end();
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    if (conn) await conn.end();
    process.exit(1);
  }
})();
