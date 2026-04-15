// server/migrations/06_add_po_number_to_indents.js
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

    console.log('Adding po_number column to indents table...');

    // Check if column already exists
    const [rows] = await conn.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'indents' 
      AND COLUMN_NAME = 'po_number'
      AND TABLE_SCHEMA = ?
    `, [process.env.DB_NAME || 'prayosha']);

    if (rows.length === 0) {
      // Add the column
      await conn.query(`
        ALTER TABLE indents
        ADD COLUMN po_number VARCHAR(100) DEFAULT NULL
        AFTER indent_date
      `);
      console.log('✓ po_number column added successfully');
    } else {
      console.log('✓ po_number column already exists');
    }

    await conn.end();
    console.log('\n✅ Migration completed successfully');
    process.exit(0);

  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    if (conn) await conn.end();
    process.exit(1);
  }
})();
