// server/migrations/04_add_po_terms_to_app_settings.js
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

    console.log('Adding po_terms_conditions column to app_settings...');

    // ✅ Check if column already exists (safe migration)
    const [columns] = await conn.query(`
      SHOW COLUMNS FROM app_settings LIKE 'po_terms_conditions'
    `);

    if (columns.length === 0) {
      await conn.query(`
        ALTER TABLE app_settings 
        ADD COLUMN po_terms_conditions TEXT AFTER terms_conditions
      `);

      console.log('✓ po_terms_conditions column added successfully');
    } else {
      console.log('⚠️ Column po_terms_conditions already exists, skipping...');
    }

    // ✅ Optional: Set default PO terms (only if empty)
    const [rows] = await conn.query(`
      SELECT po_terms_conditions FROM app_settings LIMIT 1
    `);

    if (rows.length && !rows[0].po_terms_conditions) {
      await conn.query(`
        UPDATE app_settings
        SET po_terms_conditions = ?
      `, [
        `1. Delivery must be within agreed timeline
2. Material should meet required specifications
3. Payment will be made within agreed credit period
4. Goods are subject to inspection upon receipt`
      ]);

      console.log('✓ Default PO terms initialized');
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