// backend/migrations/16_add_product_id_to_po_items.js
// Add product_id column to po_items table for better product reference tracking

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

    console.log('🔄 Running Migration 16: Add product_id to po_items...');

    // Check if column already exists
    const [columns] = await conn.query(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'po_items' AND COLUMN_NAME = 'product_id'
      AND TABLE_SCHEMA = ?
    `, [process.env.DB_NAME || 'prayosha']);

    if (columns.length > 0) {
      console.log('✅ product_id column already exists in po_items');
    } else {
      // Add column with foreign key
      await conn.query(`
        ALTER TABLE po_items
        ADD COLUMN product_id INT,
        ADD FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
      `);
      console.log('✅ Added product_id column to po_items table');
    }

    await conn.end();
    console.log('✅ Migration 16 completed successfully');
    process.exit(0);

  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    if (conn) await conn.end();
    process.exit(1);
  }
})();
