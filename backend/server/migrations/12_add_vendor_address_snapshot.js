const mysql = require("mysql2/promise");

(async () => {
  let conn;

  try {
    conn = await mysql.createConnection({
      host: process.env.DB_HOST || "localhost",
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
      database: process.env.DB_NAME || "prayosha",
    });

    console.log("🔄 Adding vendor address snapshot columns...");

    // --------------------------------------------------
    // 🔹 SAFE COLUMN ADD (NO DUPLICATE ERROR)
    // --------------------------------------------------
    const [columns] = await conn.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'purchase_orders'
      AND TABLE_SCHEMA = DATABASE()
    `);

    const existingCols = columns.map(c => c.COLUMN_NAME);

    const addColumn = async (colName, definition) => {
      if (!existingCols.includes(colName)) {
        console.log(`➕ Adding column: ${colName}`);
        await conn.query(`ALTER TABLE purchase_orders ADD COLUMN ${colName} ${definition}`);
      } else {
        console.log(`⏭️ Skipping (exists): ${colName}`);
      }
    };

    // --------------------------------------------------
    // 🔹 ADD SNAPSHOT COLUMNS
    // --------------------------------------------------
    await addColumn("vendor_address", "TEXT");
    await addColumn("vendor_city", "VARCHAR(100)");
    await addColumn("vendor_state", "VARCHAR(100)");
    await addColumn("vendor_country", "VARCHAR(100)");
    await addColumn("vendor_pincode", "VARCHAR(20)");

    console.log("✅ Vendor snapshot columns ensured");

    await conn.end();

    console.log("\n🎉 Migration completed successfully");
    process.exit(0);

  } catch (err) {
    console.error("❌ Migration failed:", err.message);
    if (conn) await conn.end();
    process.exit(1);
  }
})();