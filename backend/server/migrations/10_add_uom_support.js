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

    console.log('🔄 Starting UOM migration...');

    // ---------------------------------------------------
    // 1. PRODUCTS TABLE
    // ---------------------------------------------------
    console.log('Adding UOM to products...');

    await conn.query(`
      ALTER TABLE products
      ADD COLUMN uom VARCHAR(20) DEFAULT 'NOS'
    `).catch(err => {
      if (err.code === 'ER_DUP_FIELDNAME') {
        console.log('⚠️ products.uom already exists');
      } else throw err;
    });

    console.log('✓ products updated');

    // ---------------------------------------------------
    // 2. INDENT ITEMS TABLE
    // ---------------------------------------------------
    console.log('Adding UOM to indent_items...');

    await conn.query(`
      ALTER TABLE indent_items
      ADD COLUMN uom VARCHAR(20) DEFAULT 'NOS'
    `).catch(err => {
      if (err.code === 'ER_DUP_FIELDNAME') {
        console.log('⚠️ indent_items.uom already exists');
      } else throw err;
    });

    console.log('✓ indent_items updated');

    // ---------------------------------------------------
    // 3. PO ITEMS TABLE (if exists)
    // ---------------------------------------------------
    console.log('Adding UOM to po_items...');

    await conn.query(`
      ALTER TABLE po_items
      ADD COLUMN uom VARCHAR(20) DEFAULT 'NOS'
    `).catch(err => {
      if (err.code === 'ER_NO_SUCH_TABLE') {
        console.log('⚠️ po_items table does not exist yet (skipping)');
      } else if (err.code === 'ER_DUP_FIELDNAME') {
        console.log('⚠️ po_items.uom already exists');
      } else throw err;
    });

    console.log('✓ po_items updated (if existed)');

    // ---------------------------------------------------
    // 4. BACKFILL EXISTING DATA
    // ---------------------------------------------------
    console.log('Backfilling existing indent_items...');

    await conn.query(`
      UPDATE indent_items ii
      LEFT JOIN products p ON ii.product_id = p.id
      SET ii.uom = COALESCE(p.uom, 'NOS')
      WHERE ii.uom IS NULL OR ii.uom = ''
    `);

    console.log('✓ Existing indent_items updated');

    // ---------------------------------------------------
    // DONE
    // ---------------------------------------------------
    await conn.end();

    console.log('\n✅ UOM migration completed successfully');
    process.exit(0);

  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    if (conn) await conn.end();
    process.exit(1);
  }
})();