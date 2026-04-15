// server/migrations/09_add_financial_fields.js
// Adds discount and GST rate fields to purchase_orders table

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

    console.log('Adding financial fields to purchase_orders table...');

    // Check if discount column exists
    const [discountColumns] = await conn.query(
      `SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'purchase_orders' AND COLUMN_NAME = 'discount_percentage'`,
      [process.env.DB_NAME || 'prayosha']
    );

    if (discountColumns[0].cnt === 0) {
      await conn.query(
        `ALTER TABLE purchase_orders ADD COLUMN discount_percentage DECIMAL(5, 2) DEFAULT 0`
      );
      console.log('✓ discount_percentage column added');
    } else {
      console.log('✓ discount_percentage column already exists');
    }

    // Check if gst_rate column exists
    const [gstColumns] = await conn.query(
      `SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'purchase_orders' AND COLUMN_NAME = 'gst_rate'`,
      [process.env.DB_NAME || 'prayosha']
    );

    if (gstColumns[0].cnt === 0) {
      await conn.query(
        `ALTER TABLE purchase_orders ADD COLUMN gst_rate DECIMAL(5, 2) DEFAULT 18`
      );
      console.log('✓ gst_rate column added');
    } else {
      console.log('✓ gst_rate column already exists');
    }

    // Check if total_amount column exists
    const [totalColumns] = await conn.query(
      `SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'purchase_orders' AND COLUMN_NAME = 'total_amount'`,
      [process.env.DB_NAME || 'prayosha']
    );

    if (totalColumns[0].cnt === 0) {
      await conn.query(
        `ALTER TABLE purchase_orders ADD COLUMN total_amount DECIMAL(15, 2) DEFAULT 0`
      );
      console.log('✓ total_amount column added');
    } else {
      console.log('✓ total_amount column already exists');
    }

    await conn.end();
    console.log('\n✅ Financial fields migration completed successfully');
    process.exit(0);

  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    if (conn) await conn.end();
    process.exit(1);
  }
})();
