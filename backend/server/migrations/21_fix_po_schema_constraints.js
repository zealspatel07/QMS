// server/migrations/21_fix_po_schema_constraints.js

const mysql = require('mysql2/promise');
require('dotenv').config();

(async () => {
  let conn;

  try {
    conn = await mysql.createConnection({
      host: process.env.DB_HOST || process.env.MYSQLHOST,
      user: process.env.DB_USER || process.env.MYSQLUSER,
      password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD,
      database: process.env.DB_NAME || process.env.MYSQLDATABASE,
    });

    console.log('🔧 Starting PO schema constraint migration...');

    const schema =
      process.env.MYSQLDATABASE ||
      process.env.MYSQL_DATABASE ||
      process.env.DB_NAME;

    if (!schema) {
      throw new Error('❌ DB_NAME environment variable is not set');
    }

    // --------------------------------------------------
    // 🔍 HELPER: CHECK COLUMN EXISTS
    // --------------------------------------------------
    const columnExists = async (table, column) => {
      const [rows] = await conn.query(
        `SELECT COLUMN_NAME 
         FROM information_schema.columns 
         WHERE table_schema = ? AND table_name = ? AND COLUMN_NAME = ?`,
        [schema, table, column]
      );
      return rows.length > 0;
    };

    // --------------------------------------------------
    // 🔍 HELPER: CHECK NULLABLE
    // --------------------------------------------------
    const isNullable = async (table, column) => {
      const [rows] = await conn.query(
        `SELECT IS_NULLABLE 
         FROM information_schema.columns 
         WHERE table_schema = ? AND table_name = ? AND COLUMN_NAME = ?`,
        [schema, table, column]
      );
      return rows.length > 0 && rows[0].IS_NULLABLE === 'YES';
    };

    // --------------------------------------------------
    // 🛠 FIX purchase_orders TABLE
    // --------------------------------------------------
    console.log('📦 Checking purchase_orders table...');

    const poColumns = [
      { name: 'vendor_address', type: 'TEXT' },
      { name: 'vendor_city', type: 'VARCHAR(255)' },
      { name: 'vendor_state', type: 'VARCHAR(255)' },
      { name: 'vendor_country', type: 'VARCHAR(255)' },
      { name: 'contact_email', type: 'VARCHAR(255)' },
      { name: 'contact_phone', type: 'VARCHAR(50)' },
    ];

    for (const col of poColumns) {
      const exists = await columnExists('purchase_orders', col.name);

      if (!exists) {
        console.log(`➕ Adding missing column: ${col.name}`);
        await conn.query(`
          ALTER TABLE purchase_orders
          ADD COLUMN ${col.name} ${col.type} NULL
        `);
        continue;
      }

      const nullable = await isNullable('purchase_orders', col.name);

      if (!nullable) {
        console.log(`🔄 Making column nullable: ${col.name}`);
        await conn.query(`
          ALTER TABLE purchase_orders
          MODIFY ${col.name} ${col.type} NULL
        `);
      } else {
        console.log(`ℹ ${col.name} already nullable`);
      }
    }

    // --------------------------------------------------
    // 🛠 FIX po_items TABLE
    // --------------------------------------------------
    console.log('📦 Checking po_items table...');

    const poItemsColumns = [
      { name: 'product_id', type: 'INT' },
      { name: 'vendor_id', type: 'INT' },
    ];

    for (const col of poItemsColumns) {
      const exists = await columnExists('po_items', col.name);

      if (!exists) {
        console.log(`⚠ Column missing in po_items: ${col.name} (skipping)`);
        continue;
      }

      const nullable = await isNullable('po_items', col.name);

      if (!nullable) {
        console.log(`🔄 Making po_items.${col.name} nullable`);
        await conn.query(`
          ALTER TABLE po_items
          MODIFY ${col.name} ${col.type} NULL
        `);
      } else {
        console.log(`ℹ po_items.${col.name} already nullable`);
      }
    }

    console.log('✅ PO schema migration completed successfully');

  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    if (conn) {
      try {
        await conn.end();
      } catch (e) {
        console.error('Error closing connection:', e.message);
      }
    }
  }
})();