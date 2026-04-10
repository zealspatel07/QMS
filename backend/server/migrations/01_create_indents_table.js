// server/migrations/01_create_indents_table.js
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

    console.log('Creating indents table...');

    // Create indents table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS indents (
        id INT AUTO_INCREMENT PRIMARY KEY,
        indent_number VARCHAR(50) NOT NULL UNIQUE,
        customer_name VARCHAR(255) NOT NULL,
        preferred_vendor VARCHAR(255),
        indent_date DATE NOT NULL,
        notes LONGTEXT,
        status VARCHAR(50) DEFAULT 'submitted',
        created_by VARCHAR(100),
        created_by_name VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_status (status),
        INDEX idx_customer_name (customer_name),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    console.log('✓ indents table created successfully');

    // Create indent_items table
    console.log('Creating indent_items table...');
    await conn.query(`
      CREATE TABLE IF NOT EXISTS indent_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        indent_id INT NOT NULL,
        product_id INT,
        product_name VARCHAR(255) NOT NULL,
        model_number VARCHAR(100),
        product_description LONGTEXT,
        quantity DECIMAL(10, 2) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (indent_id) REFERENCES indents(id) ON DELETE CASCADE,
        INDEX idx_indent_id (indent_id),
        INDEX idx_product_name (product_name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    console.log('✓ indent_items table created successfully');

    // Create indent_documents table
    console.log('Creating indent_documents table...');
    await conn.query(`
      CREATE TABLE IF NOT EXISTS indent_documents (
        id INT AUTO_INCREMENT PRIMARY KEY,
        indent_id INT NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        uploaded_by VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (indent_id) REFERENCES indents(id) ON DELETE CASCADE,
        INDEX idx_indent_id (indent_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    console.log('✓ indent_documents table created successfully');

    await conn.end();
    console.log('\n✅ Indents migration completed successfully');
    process.exit(0);

  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    if (conn) await conn.end();
    process.exit(1);
  }
})();
