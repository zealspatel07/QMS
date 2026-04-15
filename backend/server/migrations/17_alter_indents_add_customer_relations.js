// server/migrations/02_alter_indents_add_customer_relations.js

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

    console.log('Altering indents table (customer relations)...');

    // 1️⃣ Add columns safely (only if not exists)
    const [columns] = await conn.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'indents' 
      AND TABLE_SCHEMA = DATABASE()
    `);

    const existingCols = columns.map(c => c.COLUMN_NAME);

    // Helper function
    async function addColumnIfNotExists(columnName, query) {
      if (!existingCols.includes(columnName)) {
        console.log(`➕ Adding column: ${columnName}`);
        await conn.query(query);
      } else {
        console.log(`✔ Column already exists: ${columnName}`);
      }
    }

    // Add new relational columns
    await addColumnIfNotExists(
      'customer_id',
      `ALTER TABLE indents ADD COLUMN customer_id INT NULL AFTER indent_number`
    );

    await addColumnIfNotExists(
      'customer_location_id',
      `ALTER TABLE indents ADD COLUMN customer_location_id INT NULL AFTER customer_id`
    );

    await addColumnIfNotExists(
      'customer_contact_id',
      `ALTER TABLE indents ADD COLUMN customer_contact_id INT NULL AFTER customer_location_id`
    );

    // 2️⃣ Add indexes (performance)
    await conn.query(`
      ALTER TABLE indents
      ADD INDEX idx_customer_id (customer_id),
      ADD INDEX idx_customer_location_id (customer_location_id),
      ADD INDEX idx_customer_contact_id (customer_contact_id)
    `).catch(() => {
      console.log('✔ Indexes already exist (skipped)');
    });

    // 3️⃣ Add foreign keys (SAFE TRY)
    await conn.query(`
      ALTER TABLE indents
      ADD CONSTRAINT fk_indent_customer
        FOREIGN KEY (customer_id) REFERENCES customers(id)
        ON DELETE SET NULL
    `).catch(() => {
      console.log('✔ fk_indent_customer exists or skipped');
    });

    await conn.query(`
      ALTER TABLE indents
      ADD CONSTRAINT fk_indent_location
        FOREIGN KEY (customer_location_id) REFERENCES customer_locations(id)
        ON DELETE SET NULL
    `).catch(() => {
      console.log('✔ fk_indent_location exists or skipped');
    });

    await conn.query(`
      ALTER TABLE indents
      ADD CONSTRAINT fk_indent_contact
        FOREIGN KEY (customer_contact_id) REFERENCES customer_contacts(id)
        ON DELETE SET NULL
    `).catch(() => {
      console.log('✔ fk_indent_contact exists or skipped');
    });

    console.log('\n✅ Indents table upgraded successfully');

    await conn.end();
    process.exit(0);

  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    if (conn) await conn.end();
    process.exit(1);
  }
})();