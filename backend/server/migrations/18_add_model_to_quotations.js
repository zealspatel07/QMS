// server/migrations/18_add_model_to_quotations.js
const mysql = require('mysql2/promise');

(async () => {
  let conn;

  try {
    conn = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'prayosha',
    });

    console.log('Adding model field to quotations table...');

    // Check if the column already exists
    const [existingColumns] = await conn.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'quotations' AND COLUMN_NAME = 'model'
    `);

    if (existingColumns.length === 0) {
      // Column doesn't exist, so add it
      await conn.query(`
        ALTER TABLE quotations 
        ADD COLUMN model LONGTEXT AFTER items
      `);
      console.log('✓ model field added successfully to quotations table');
    } else {
      console.log('ℹ model field already exists in quotations table');
    }

    // Verify the column exists
    const [columns] = await conn.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'quotations' AND COLUMN_NAME = 'model'
    `);

    if (columns.length > 0) {
      console.log('✓ Verification successful: model column exists in quotations table');
    } else {
      console.warn('⚠ Warning: model column not found in quotations table');
    }

    await conn.end();
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err && err.message ? err.message : err);
    if (conn) try { await conn.end(); } catch (e) { }
    process.exit(1);
  }
})();
