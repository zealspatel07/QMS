// backend/server/migrations/23_alter_enquiries_add_details.js
// Adds CRM linkage + item list support to enquiries

const mysql = require("mysql2/promise");
require("dotenv").config();

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

async function indexExists(conn, schema, table, indexName) {
  const [rows] = await conn.query(
    `
    SELECT COUNT(*) AS cnt
    FROM information_schema.statistics
    WHERE table_schema = ? AND table_name = ? AND index_name = ?
  `,
    [schema, table, indexName],
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

    console.log("🔧 Starting Migration 23: alter enquiries (details)...");

    const table = "enquiries";

    // Columns
    if (!(await columnExists(conn, schema, table, "customer_location_id"))) {
      await conn.query(`ALTER TABLE enquiries ADD COLUMN customer_location_id INT NULL AFTER customer_id`);
      console.log("✅ Added enquiries.customer_location_id");
    }

    if (!(await columnExists(conn, schema, table, "customer_contact_id"))) {
      await conn.query(`ALTER TABLE enquiries ADD COLUMN customer_contact_id INT NULL AFTER customer_location_id`);
      console.log("✅ Added enquiries.customer_contact_id");
    }

    if (!(await columnExists(conn, schema, table, "location_snapshot"))) {
      await conn.query(`ALTER TABLE enquiries ADD COLUMN location_snapshot JSON NULL AFTER customer_snapshot`);
      console.log("✅ Added enquiries.location_snapshot");
    }

    if (!(await columnExists(conn, schema, table, "contact_snapshot"))) {
      await conn.query(`ALTER TABLE enquiries ADD COLUMN contact_snapshot JSON NULL AFTER location_snapshot`);
      console.log("✅ Added enquiries.contact_snapshot");
    }

    if (!(await columnExists(conn, schema, table, "items"))) {
      await conn.query(`ALTER TABLE enquiries ADD COLUMN items JSON NULL AFTER notes`);
      console.log("✅ Added enquiries.items");
    }

    if (!(await columnExists(conn, schema, table, "lost_reason"))) {
      await conn.query(`ALTER TABLE enquiries ADD COLUMN lost_reason TEXT NULL AFTER items`);
      console.log("✅ Added enquiries.lost_reason");
    }

    // Indexes (safe adds)
    if (!(await indexExists(conn, schema, table, "idx_enquiries_customer_location_id"))) {
      await conn.query(`CREATE INDEX idx_enquiries_customer_location_id ON enquiries (customer_location_id)`);
      console.log("✅ Added index idx_enquiries_customer_location_id");
    }
    if (!(await indexExists(conn, schema, table, "idx_enquiries_customer_contact_id"))) {
      await conn.query(`CREATE INDEX idx_enquiries_customer_contact_id ON enquiries (customer_contact_id)`);
      console.log("✅ Added index idx_enquiries_customer_contact_id");
    }

    console.log("✅ Migration 23 completed");
  } catch (err) {
    console.error("❌ Migration 23 failed:", err.message);
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

