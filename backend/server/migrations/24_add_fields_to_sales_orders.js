// backend/server/migrations/24_add_fields_to_sales_orders.js
// Adds terms, notes, and delivery_date columns to sales_orders table

const mysql = require("mysql2/promise");

async function columnExists(conn, schema, table, column) {
  const [rows] = await conn.query(
    `
    SELECT COUNT(*) AS cnt
    FROM information_schema.columns
    WHERE table_schema = ? AND table_name = ? AND column_name = ?
  `,
    [schema, table, column],
  );
  return Number(rows?.[0]?.cnt || 0) > 0;
}

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

    const schema =
      process.env.DB_NAME ||
      process.env.MYSQLDATABASE ||
      process.env.MYSQL_DATABASE ||
      "prayosha";

    console.log("🔧 Starting Migration 24: add fields to sales_orders...");

    const table = "sales_orders";
    const columnsToAdd = [];

    // Check and add missing columns
    if (!(await columnExists(conn, schema, table, "terms"))) {
      columnsToAdd.push("ADD COLUMN terms TEXT NULL COMMENT 'Sales order terms and conditions'");
    }

    if (!(await columnExists(conn, schema, table, "notes"))) {
      columnsToAdd.push("ADD COLUMN notes TEXT NULL COMMENT 'Internal notes for sales order'");
    }

    if (!(await columnExists(conn, schema, table, "delivery_date"))) {
      columnsToAdd.push("ADD COLUMN delivery_date DATE NULL COMMENT 'Expected delivery date'");
    }

    if (columnsToAdd.length === 0) {
      console.log("✅ All columns already exist. No changes needed.");
      return;
    }

    const alterSQL = `ALTER TABLE ${table} ${columnsToAdd.join(", ")}`;
    console.log("Executing:", alterSQL);
    await conn.query(alterSQL);

    console.log("✅ Migration 24 completed successfully!");
  } catch (err) {
    console.error("❌ Migration 24 failed:", err.message);
    process.exit(1);
  } finally {
    conn?.end();
  }
})();
