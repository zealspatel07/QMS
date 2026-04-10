// server/migrations/20_add_remarks_to_quotations.js

const mysql = require('mysql2/promise');
require('dotenv').config();

(async () => {
  let conn;

  try {
    conn = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });

    console.log('🔧 Adding remarks column to quotations table...');

    const schema =
      process.env.MYSQLDATABASE ||
      process.env.MYSQL_DATABASE ||
      process.env.DB_NAME;
    
    if (!schema) {
      throw new Error('DB_NAME environment variable is not set');
    }

    // Check if column exists
    const [cols] = await conn.query(
      `SELECT COLUMN_NAME FROM information_schema.columns 
       WHERE table_schema = ? AND table_name = 'quotations' AND COLUMN_NAME = 'remarks'`,
      [schema]
    );

    if (cols.length > 0) {
      console.log('ℹ remarks column already exists in quotations table');
      return;
    }

    // Add remarks column
    await conn.query(`
      ALTER TABLE quotations 
      ADD COLUMN remarks TEXT DEFAULT NULL
    `);

    console.log('✅ Successfully added remarks column to quotations table');

  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    if (conn) {
      try {
        await conn.end();
      } catch (e) {
        console.error('Error closing connection:', e.message);
      }
    }
  }
})();
