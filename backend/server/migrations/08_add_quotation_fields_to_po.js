// server/migrations/08_add_quotation_fields_to_po.js

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

    console.log('🔍 Checking purchase_orders table...');

    // =========================
    // PURCHASE ORDERS
    // =========================
    const [columns] = await conn.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'purchase_orders' 
      AND COLUMN_NAME IN (
        'vendor_quote_no',
        'vendor_state_name',
        'vendor_quote_date',
        'payment_terms',
        'delivery_date',
        'remarks',
        'terms_snapshot'
      )
    `);

    const existingColumns = columns.map(col => col.COLUMN_NAME);
    const columnsToAdd = [];

    if (!existingColumns.includes('vendor_quote_no')) {
      columnsToAdd.push("ADD COLUMN vendor_quote_no VARCHAR(100) COMMENT 'Vendor quotation number'");
    }

    if (!existingColumns.includes('vendor_state_name')) {
      columnsToAdd.push("ADD COLUMN vendor_state_name VARCHAR(100) COMMENT 'Vendor state name'");
    }

    if (!existingColumns.includes('vendor_quote_date')) {
      columnsToAdd.push("ADD COLUMN vendor_quote_date DATE COMMENT 'Vendor quotation date'");
    }

    if (!existingColumns.includes('payment_terms')) {
      columnsToAdd.push("ADD COLUMN payment_terms VARCHAR(255) COMMENT 'Payment terms agreed'");
    }

    if (!existingColumns.includes('delivery_date')) {
      columnsToAdd.push("ADD COLUMN delivery_date DATE COMMENT 'Expected delivery date'");
    }

    if (!existingColumns.includes('remarks')) {
      columnsToAdd.push("ADD COLUMN remarks TEXT COMMENT 'Additional remarks/notes'");
    }

    if (!existingColumns.includes('terms_snapshot')) {
      columnsToAdd.push("ADD COLUMN terms_snapshot LONGTEXT COMMENT 'Snapshot of PO terms at creation time'");
    }

    if (columnsToAdd.length > 0) {
      const alterQuery = `ALTER TABLE purchase_orders ${columnsToAdd.join(', ')}`;
      await conn.query(alterQuery);
      console.log(`✅ Added ${columnsToAdd.length} column(s) to purchase_orders`);
    } else {
      console.log('✅ purchase_orders already up to date');
    }

    // =========================
    // PO ITEMS (IMPORTANT FIX)
    // =========================
    console.log('🔍 Checking po_items table...');

    const [poItemCols] = await conn.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'po_items' 
      AND COLUMN_NAME IN ('model_number', 'product_description')
    `);

    const existingPoItemCols = poItemCols.map(col => col.COLUMN_NAME);
    const poItemColumnsToAdd = [];

    if (!existingPoItemCols.includes('model_number')) {
      poItemColumnsToAdd.push("ADD COLUMN model_number VARCHAR(100) COMMENT 'Product model number'");
    }

    if (!existingPoItemCols.includes('product_description')) {
      poItemColumnsToAdd.push("ADD COLUMN product_description TEXT COMMENT 'Product description'");
    }

    if (poItemColumnsToAdd.length > 0) {
      const alterPoItemsQuery = `ALTER TABLE po_items ${poItemColumnsToAdd.join(', ')}`;
      await conn.query(alterPoItemsQuery);
      console.log(`✅ Added ${poItemColumnsToAdd.length} column(s) to po_items`);
    } else {
      console.log('✅ po_items already up to date');
    }

    await conn.end();
    console.log('\n🎉 Migration completed successfully');

    process.exit(0);

  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    if (conn) await conn.end();
    process.exit(1);
  }
})();