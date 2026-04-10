//server/migrations/03_create_purchase_orders_table.js

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

    console.log('Creating purchase_orders table...');

    await conn.query(`
      CREATE TABLE IF NOT EXISTS purchase_orders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        po_number VARCHAR(100) NOT NULL UNIQUE,
        indent_id INT,
        order_date DATETIME NOT NULL,
        status VARCHAR(50) DEFAULT 'created',

        -- 🔥 TERMS SNAPSHOT
        terms_snapshot LONGTEXT,

        created_by VARCHAR(100),
        created_by_name VARCHAR(255),

        -- 🔥 VENDOR SNAPSHOT (CRITICAL FIX)
        vendor_name VARCHAR(255),
        vendor_gst VARCHAR(50),
        vendor_state_code VARCHAR(50),

        vendor_address TEXT,
        vendor_city VARCHAR(100),
        vendor_state VARCHAR(100),
        vendor_country VARCHAR(100),
        vendor_pincode VARCHAR(20),

        -- 🔥 CONTACT SNAPSHOT
        contact_person VARCHAR(255),
        contact_email VARCHAR(255),
        contact_phone VARCHAR(20),

        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

        FOREIGN KEY (indent_id) REFERENCES indents(id) ON DELETE SET NULL,

        INDEX idx_po_number (po_number),
        INDEX idx_indent_id (indent_id),
        INDEX idx_status (status),
        INDEX idx_order_date (order_date),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    console.log('✓ purchase_orders table created successfully');

    // --------------------------------------------------
    // PO ITEMS TABLE (NO CHANGE REQUIRED)
    // --------------------------------------------------
    console.log('Creating po_items table...');

    await conn.query(`
      CREATE TABLE IF NOT EXISTS po_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        po_id INT NOT NULL,
        indent_item_id INT,

        product_name VARCHAR(255) NOT NULL,
        product_description LONGTEXT,

        ordered_qty DECIMAL(10, 2) NOT NULL DEFAULT 0,
        received_qty DECIMAL(10, 2) DEFAULT 0,

        vendor_id INT,

        unit_price DECIMAL(15, 2) DEFAULT 0.00,
        line_total DECIMAL(15, 2) DEFAULT 0.00,

        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

        FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
        FOREIGN KEY (indent_item_id) REFERENCES indent_items(id) ON DELETE SET NULL,
        FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE SET NULL,

        INDEX idx_po_id (po_id),
        INDEX idx_indent_item_id (indent_item_id),
        INDEX idx_vendor_id (vendor_id),
        INDEX idx_product_name (product_name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    console.log('✓ po_items table created successfully');

    await conn.end();

    console.log('\n✅ Purchase Orders migration completed successfully');
    process.exit(0);

  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    if (conn) await conn.end();
    process.exit(1);
  }
})();