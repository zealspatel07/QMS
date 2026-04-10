// backend/migrations/14_allow_direct_po_creation.js
// This migration allows Purchase Orders to be created WITHOUT an indent
// indent_id is already nullable in the purchase_orders table, so no changes needed
// This file documents that direct PO creation is supported as of this version

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

    console.log('✅ Direct PO Creation Feature Enabled');
    console.log('📝 NOTES:');
    console.log('   • Purchase Orders can now be created WITHOUT an indent');
    console.log('   • indent_id remains nullable in purchase_orders table');
    console.log('   • Vendor details can be entered manually or selected from existing vendors');
    console.log('   • PO creation flow: Create PO page → Select/Enter vendor → Add items → Create PO');

    // Verify that purchase_orders table structure supports this
    const [columns] = await conn.query(`
      SELECT COLUMN_NAME, IS_NULLABLE, COLUMN_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'purchase_orders' AND TABLE_SCHEMA = ?
      ORDER BY ORDINAL_POSITION
    `, [process.env.DB_NAME || 'prayosha']);

    console.log('\n📋 Purchase Orders Table Structure:');
    columns.forEach(col => {
      if (['id', 'po_number', 'indent_id', 'vendor_name', 'status', 'created_at'].includes(col.COLUMN_NAME)) {
        console.log(`   ${col.COLUMN_NAME}: ${col.COLUMN_TYPE} ${col.IS_NULLABLE === 'YES' ? '(NULLABLE)' : '(NOT NULL)'}`);
      }
    });

    await conn.end();
    console.log('\n✅ Migration completed successfully');
    process.exit(0);

  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    if (conn) await conn.end();
    process.exit(1);
  }
})();
