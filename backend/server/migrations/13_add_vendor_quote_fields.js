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

    console.log('Adding vendor quotation fields to purchase_orders table...');

    // Helper function to check column existence
    const columnExists = async (columnName) => {
      const [rows] = await conn.query(`
        SELECT COUNT(*) as count
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME = 'purchase_orders'
        AND COLUMN_NAME = ?
      `, [process.env.DB_NAME || 'prayosha', columnName]);

      return rows[0].count > 0;
    };

    // Add columns safely
    const columns = [
      { name: 'vendor_quote_no', def: 'VARCHAR(100)' },
      { name: 'vendor_quote_date', def: 'DATE' },
      { name: 'payment_terms', def: 'VARCHAR(255)' },
      { name: 'delivery_date', def: 'DATE' },
      { name: 'remarks', def: 'LONGTEXT' },
    ];

    for (const col of columns) {
      const exists = await columnExists(col.name);

      if (!exists) {
        console.log(`➕ Adding column: ${col.name}`);
        await conn.query(`
          ALTER TABLE purchase_orders
          ADD COLUMN ${col.name} ${col.def}
        `);
      } else {
        console.log(`⚠️ Column already exists: ${col.name}`);
      }
    }

    // Index check
    const [indexRows] = await conn.query(`
      SELECT COUNT(*) as count
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = ?
      AND TABLE_NAME = 'purchase_orders'
      AND INDEX_NAME = 'idx_vendor_quote_no'
    `, [process.env.DB_NAME || 'prayosha']);

    if (indexRows[0].count === 0) {
      console.log('➕ Creating index idx_vendor_quote_no');
      await conn.query(`
        ALTER TABLE purchase_orders
        ADD INDEX idx_vendor_quote_no (vendor_quote_no)
      `);
    } else {
      console.log('⚠️ Index already exists');
    }

    console.log('\n✅ Migration 08 completed successfully');

    await conn.end();
    process.exit(0);

  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    if (conn) await conn.end();
    process.exit(1);
  }
})();