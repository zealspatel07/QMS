// server/migrations/07_add_gst_verified_column.js
const mysql = require('mysql2/promise');

/**
 * Migration to add gst_verified column to vendors table
 * Tracks whether vendor details were auto-populated from GST API
 * 
 * gst_verified = 0: Manual entry (not verified)
 * gst_verified = 1: Auto-populated from GST API (verified)
 */
(async () => {
  let conn;

  try {
    conn = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'prayosha',
    });

    console.log('Checking vendors table for gst_verified column...');

    // Check if column already exists
    const [columns] = await conn.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'vendors' AND COLUMN_NAME = 'gst_verified'"
    );

    if (columns.length > 0) {
      console.log('✓ gst_verified column already exists');
    } else {
      console.log('Adding gst_verified column to vendors table...');

      await conn.query(`
        ALTER TABLE vendors 
        ADD COLUMN gst_verified TINYINT DEFAULT 0 
        COMMENT 'Flag: 1 = auto-populated from GST API, 0 = manual entry',
        ADD INDEX idx_gst_verified (gst_verified)
      `);

      console.log('✓ gst_verified column added successfully');
    }

    await conn.end();
    console.log('\n✅ GST verification migration completed successfully');
    process.exit(0);

  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    if (conn) await conn.end();
    process.exit(1);
  }
})();
