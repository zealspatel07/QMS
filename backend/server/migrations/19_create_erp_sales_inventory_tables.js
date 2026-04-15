// backend/server/migrations/22_create_erp_sales_inventory_tables.js
// Creates ERP tables: enquiries, sales_orders, dispatches, dispatch_items, invoices, stock_ledger

const mysql = require("mysql2/promise");

(async () => {
  let conn;

  try {
    conn = await mysql.createConnection({
      host: process.env.DB_HOST || process.env.MYSQLHOST || "localhost",
      user: process.env.DB_USER || process.env.MYSQLUSER || "root",
      password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || "",
      database: process.env.DB_NAME || process.env.MYSQLDATABASE || "prayosha",
      multipleStatements: true,
    });

    console.log("🔧 Starting Migration 22: ERP sales/inventory tables...");

    // Ensure charset/collation consistent with rest of schema
    // Note: CHECK constraints require MySQL 8.0+ to be enforced.

    // --------------------------------------------------
    // ENQUIRIES
    // --------------------------------------------------
    await conn.query(`
      CREATE TABLE IF NOT EXISTS enquiries (
        id INT AUTO_INCREMENT PRIMARY KEY,
        enquiry_no VARCHAR(64) NOT NULL UNIQUE,

        customer_id INT NULL,
        customer_snapshot JSON NULL,
        customer_name VARCHAR(255) NULL,

        enquiry_date DATE NULL,
        source VARCHAR(255) NULL,
        notes TEXT NULL,

        status ENUM('open','quoted','lost','closed') NOT NULL DEFAULT 'open',

        created_by INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

        INDEX idx_enquiries_status (status),
        INDEX idx_enquiries_customer_id (customer_id),
        INDEX idx_enquiries_created_at (created_at),
        CONSTRAINT fk_enquiries_customer
          FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // --------------------------------------------------
    // SALES ORDERS (quotation-centric, immutable after confirmation in app layer)
    // --------------------------------------------------
    await conn.query(`
      CREATE TABLE IF NOT EXISTS sales_orders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        so_number VARCHAR(64) NOT NULL UNIQUE,

        enquiry_id INT NULL,
        quotation_id INT NULL,

        customer_id INT NULL,
        customer_snapshot JSON NULL,

        quotation_snapshot JSON NULL,
        items JSON NOT NULL,

        currency VARCHAR(10) NOT NULL DEFAULT 'INR',
        subtotal DECIMAL(18,2) NOT NULL DEFAULT 0,
        total_discount DECIMAL(18,2) NOT NULL DEFAULT 0,
        tax_total DECIMAL(18,2) NOT NULL DEFAULT 0,
        total_value DECIMAL(18,2) NOT NULL DEFAULT 0,

        status ENUM('draft','confirmed','partial_dispatch','completed','cancelled') NOT NULL DEFAULT 'draft',
        confirmed_at DATETIME NULL,
        confirmed_by INT NULL,

        created_by INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

        UNIQUE KEY uq_sales_orders_quotation (quotation_id),
        INDEX idx_sales_orders_status (status),
        INDEX idx_sales_orders_customer_id (customer_id),
        INDEX idx_sales_orders_created_at (created_at),
        INDEX idx_sales_orders_enquiry_id (enquiry_id),

        CONSTRAINT fk_sales_orders_customer
          FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
        CONSTRAINT fk_sales_orders_enquiry
          FOREIGN KEY (enquiry_id) REFERENCES enquiries(id) ON DELETE SET NULL,
        CONSTRAINT fk_sales_orders_quotation
          FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE SET NULL,

        CONSTRAINT chk_sales_orders_confirmed_at
          CHECK (
            (status = 'draft' AND confirmed_at IS NULL)
            OR (status <> 'draft')
          )
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // --------------------------------------------------
    // DISPATCHES (partial dispatch supported via dispatch_items)
    // --------------------------------------------------
    await conn.query(`
      CREATE TABLE IF NOT EXISTS dispatches (
        id INT AUTO_INCREMENT PRIMARY KEY,
        dispatch_no VARCHAR(64) NOT NULL UNIQUE,

        sales_order_id INT NOT NULL,
        dispatch_date DATE NULL,

        status ENUM('draft','dispatched','partial','completed','cancelled') NOT NULL DEFAULT 'draft',
        remarks TEXT NULL,

        created_by INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

        INDEX idx_dispatches_sales_order_id (sales_order_id),
        INDEX idx_dispatches_status (status),
        INDEX idx_dispatches_created_at (created_at),

        CONSTRAINT fk_dispatches_sales_order
          FOREIGN KEY (sales_order_id) REFERENCES sales_orders(id) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // --------------------------------------------------
    // DISPATCH ITEMS
    // --------------------------------------------------
    await conn.query(`
      CREATE TABLE IF NOT EXISTS dispatch_items (
        id INT AUTO_INCREMENT PRIMARY KEY,

        dispatch_id INT NOT NULL,
        sales_order_id INT NOT NULL,
        product_id INT NOT NULL,

        product_snapshot JSON NULL,
        uom VARCHAR(30) NULL,

        ordered_qty DECIMAL(18,3) NOT NULL DEFAULT 0,
        dispatched_qty DECIMAL(18,3) NOT NULL DEFAULT 0,

        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

        INDEX idx_dispatch_items_dispatch_id (dispatch_id),
        INDEX idx_dispatch_items_sales_order_id (sales_order_id),
        INDEX idx_dispatch_items_product_id (product_id),

        CONSTRAINT fk_dispatch_items_dispatch
          FOREIGN KEY (dispatch_id) REFERENCES dispatches(id) ON DELETE CASCADE,
        CONSTRAINT fk_dispatch_items_sales_order
          FOREIGN KEY (sales_order_id) REFERENCES sales_orders(id) ON DELETE RESTRICT,
        CONSTRAINT fk_dispatch_items_product
          FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,

        CONSTRAINT chk_dispatch_items_qty
          CHECK (ordered_qty >= 0 AND dispatched_qty >= 0 AND dispatched_qty <= ordered_qty)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // --------------------------------------------------
    // INVOICES (1 invoice per dispatch)
    // --------------------------------------------------
    await conn.query(`
      CREATE TABLE IF NOT EXISTS invoices (
        id INT AUTO_INCREMENT PRIMARY KEY,
        invoice_no VARCHAR(64) NOT NULL UNIQUE,

        dispatch_id INT NOT NULL,
        sales_order_id INT NOT NULL,

        invoice_date DATE NULL,
        due_date DATE NULL,

        status ENUM('draft','issued','cancelled') NOT NULL DEFAULT 'issued',
        payment_status ENUM('unpaid','partial','paid') NOT NULL DEFAULT 'unpaid',

        customer_snapshot JSON NULL,
        items JSON NOT NULL,

        currency VARCHAR(10) NOT NULL DEFAULT 'INR',
        subtotal DECIMAL(18,2) NOT NULL DEFAULT 0,
        total_discount DECIMAL(18,2) NOT NULL DEFAULT 0,
        tax_total DECIMAL(18,2) NOT NULL DEFAULT 0,
        total_amount DECIMAL(18,2) NOT NULL DEFAULT 0,

        amount_paid DECIMAL(18,2) NOT NULL DEFAULT 0,
        balance_due DECIMAL(18,2) GENERATED ALWAYS AS (GREATEST(total_amount - amount_paid, 0)) STORED,

        terms TEXT NULL,
        notes TEXT NULL,

        created_by INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

        UNIQUE KEY uq_invoices_dispatch (dispatch_id),
        INDEX idx_invoices_sales_order_id (sales_order_id),
        INDEX idx_invoices_status (status),
        INDEX idx_invoices_payment_status (payment_status),
        INDEX idx_invoices_created_at (created_at),

        CONSTRAINT fk_invoices_dispatch
          FOREIGN KEY (dispatch_id) REFERENCES dispatches(id) ON DELETE RESTRICT,
        CONSTRAINT fk_invoices_sales_order
          FOREIGN KEY (sales_order_id) REFERENCES sales_orders(id) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // --------------------------------------------------
    // STOCK LEDGER (single source of truth for inventory)
    // --------------------------------------------------
    await conn.query(`
      CREATE TABLE IF NOT EXISTS stock_ledger (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,

        product_id INT NOT NULL,

        txn_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        txn_type ENUM('GRN','DISPATCH','ADJUSTMENT') NOT NULL,
        direction ENUM('IN','OUT') NOT NULL,

        quantity DECIMAL(18,3) NOT NULL,
        uom VARCHAR(30) NULL,
        unit_cost DECIMAL(18,2) NULL,

        ref_table VARCHAR(50) NULL,
        ref_id INT NULL,
        ref_item_id INT NULL,

        remarks TEXT NULL,
        created_by INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

        INDEX idx_stock_ledger_product_date (product_id, txn_date),
        INDEX idx_stock_ledger_type (txn_type),
        INDEX idx_stock_ledger_ref (ref_table, ref_id),

        CONSTRAINT fk_stock_ledger_product
          FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,

        CONSTRAINT chk_stock_ledger_qty
          CHECK (quantity > 0),
        CONSTRAINT chk_stock_ledger_direction
          CHECK (direction IN ('IN','OUT'))
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log("✅ Migration 22 completed: ERP tables ready");
  } catch (err) {
    console.error("❌ Migration 22 failed:", err.message);
    process.exitCode = 1;
  } finally {
    if (conn) {
      try {
        await conn.end();
      } catch (e) {
        console.error("Error closing connection:", e.message);
      }
    }
  }
})();

