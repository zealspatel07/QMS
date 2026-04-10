// server/migrations/15_add_model_to_products.js
const mysql = require('mysql2/promise');
require('dotenv').config();

(async () => {
  let conn;

  try {
    conn = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'prayosha',
    });

    console.log('Adding model field to products table...');

    // Check if the column already exists
    const [existingColumns] = await conn.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'products' AND COLUMN_NAME = 'model'
    `);

    if (existingColumns.length === 0) {
      // Column doesn't exist, so add it
      await conn.query(`
        ALTER TABLE products 
        ADD COLUMN model VARCHAR(255)
      `);
      console.log('✓ model field added successfully to products table');
    } else {
      console.log('ℹ model field already exists in products table');
    }

    // Verify the column exists
    const [columns] = await conn.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'products' AND COLUMN_NAME = 'model'
    `);

    if (columns.length > 0) {
      console.log('✓ Verification successful: model column exists in products table');
    } else {
      console.warn('⚠ Warning: model column not found in products table');
    }

    await conn.end();
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err && err.message ? err.message : err);
    if (conn) try { await conn.end(); } catch (e) { }
    process.exit(1);
  }
})();
